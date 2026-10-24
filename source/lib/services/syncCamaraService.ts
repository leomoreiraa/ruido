// lib/services/syncCamaraService.ts
import { prisma } from "@/lib/prisma";
import {
  CasaLegislativa,
  CoberturaPresenca,
  CoberturaVotacao,
  OpcaoVoto,
  OrigemPresenca,
  StatusPresenca,
} from "@/lib/types";
import { camaraApiClient } from "./apiClient";
import {
  CamaraDeputadoContract,
  CamaraEventoContract,
  CamaraProposicaoRefContract,
  CamaraVotacaoDetalheContract,
  CamaraVotacaoResumoContract,
  CamaraVotoNominalContract,
  normalizarVotoCamara,
  obterContagensCamara,
  validarRespostaEnvelopeCamara,
} from "./camaraNormalizer";

const BASE_URL = "https://dadosabertos.camara.leg.br/api/v2";

/** Follow the official next links; never silently truncate a detail collection. */
async function coletarPaginas<T>(initialUrl: string, tolerar404Inicial = false, onNotFound: () => void = () => {}): Promise<T[]> {
  const result: T[] = [];
  const visited = new Set<string>();
  let url: string | undefined = initialUrl;
  while (url) {
    const absolute: URL = new URL(url.startsWith('/') && !url.startsWith('/api/v2/') ? `${BASE_URL}${url}` : url, `${BASE_URL}/`);
    if (absolute.origin !== new URL(BASE_URL).origin || !absolute.pathname.startsWith('/api/v2/')) throw new Error('URL de paginação não oficial');
    if (visited.has(absolute.href)) throw new Error('Ciclo na paginação da Câmara');
    visited.add(absolute.href);
    const raw: unknown = await camaraApiClient.fetchJson<unknown>(absolute.href, { acceptStatuses: tolerar404Inicial && visited.size === 1 ? [404] : [] });
    if (raw === null && tolerar404Inicial && visited.size === 1) {
      console.warn('[Câmara] Votos indisponíveis na API para ' + absolute.href);
      onNotFound();
      return [];
    }
    const envelope: { dados: T[]; links?: { rel: string; href: string }[] } = validarRespostaEnvelopeCamara<T[]>(raw, absolute.href);
    if (!Array.isArray(envelope.dados)) throw new Error('Coleção da Câmara inválida');
    result.push(...envelope.dados);
    url = envelope.links?.find(link => link.rel === 'next')?.href;
  }
  return result;
}

/**
 * Sincroniza a lista de deputados em exercício.
 * Atualiza ativo=true e cadastroAtualizadoEm apenas para os parlamentares do roster oficial retornado.
 */
export async function sincronizarDeputadosAtuaisCamara(): Promise<number> {
  const agora = new Date();
  let totalProcessados = 0;
  const idsEmExercicio: string[] = [];
  const cadastroCompleto: CamaraDeputadoContract[] = [];
  let pagina = 1;
  const itensPorPagina = 100;
  let temMaisPaginas = true;

  while (temMaisPaginas) {
    const url = `/deputados?pagina=${pagina}&itens=${itensPorPagina}&ordem=ASC&ordenarPor=nome`;
    const respostaRaw = await camaraApiClient.fetchJson<unknown>(url);
    const envelope = validarRespostaEnvelopeCamara<CamaraDeputadoContract[]>(
      respostaRaw,
      `deputados pagina=${pagina}`
    );

    const deputados = envelope.dados ?? [];
    idsEmExercicio.push(...deputados.map(dep => String(dep.id)));
    if (deputados.length === 0) {
      break;
    }

    cadastroCompleto.push(...deputados);

    const nextLink = envelope.links?.find((l) => l.rel === "next");
    if (!nextLink || deputados.length < itensPorPagina) {
      temMaisPaginas = false;
    } else {
      pagina++;
    }
  }

  // Do not mark former officeholders as current. Only reconcile after every
  // official page has been fetched and the roster size is plausible.
  if (idsEmExercicio.length < 400 || idsEmExercicio.length > 700 ||
      new Set(idsEmExercicio).size!==idsEmExercicio.length) {
    throw new Error('Cadastro da Câmara incompleto ou com duplicatas; nenhum mandato foi alterado');
  }
  // Só modificar a base após receber e validar todas as páginas do roster.
  for (let i=0;i<cadastroCompleto.length;i+=50){
    const lote=cadastroCompleto.slice(i,i+50);
    await prisma.$transaction(lote.map(dep=>prisma.parlamentar.upsert({
      where:{casa_externalId:{casa:CasaLegislativa.CAMARA,externalId:String(dep.id)}},
      update:{nome:dep.nome,partido:dep.siglaPartido||"S/PARTIDO",
        uf:dep.siglaUf||"BR",urlFoto:dep.urlFoto??null,
        email:dep.email??null,ativo:true,cadastroAtualizadoEm:agora},
      create:{casa:CasaLegislativa.CAMARA,externalId:String(dep.id),nome:dep.nome,
        partido:dep.siglaPartido||"S/PARTIDO",uf:dep.siglaUf||"BR",
        urlFoto:dep.urlFoto??null,email:dep.email??null,
        ativo:true,cadastroAtualizadoEm:agora},
    })));
    totalProcessados+=lote.length;
  }
  await prisma.parlamentar.updateMany({
    where: { casa: CasaLegislativa.CAMARA, ativo: true, externalId: { notIn: idsEmExercicio } },
    data: { ativo: false, cadastroAtualizadoEm: agora },
  });
  return totalProcessados;
}

/**
 * Garante que um parlamentar histórico citado em voto exista no banco sem sobrescrever seu status ativo.
 */
async function garantirParlamentarHistoricoCamara(
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
  dep: { id: number; nome: string; siglaPartido?: string; siglaUf?: string; urlFoto?: string; email?: string }
): Promise<string> {
  const existente = await tx.parlamentar.findUnique({
    where: {
      casa_externalId: {
        casa: CasaLegislativa.CAMARA,
        externalId: String(dep.id),
      },
    },
    select: { id: true },
  });

  if (existente) {
    return existente.id;
  }

  const criado = await tx.parlamentar.create({
    data: {
      casa: CasaLegislativa.CAMARA,
      externalId: String(dep.id),
      nome: dep.nome,
      partido: dep.siglaPartido || "S/PARTIDO",
      uf: dep.siglaUf || "BR",
      urlFoto: dep.urlFoto ?? null,
      email: dep.email ?? null,
      ativo: false, // Histórico não ativo no snapshot atual
    },
    select: { id: true },
  });

  return criado.id;
}

/**
 * Sincroniza votações da Câmara com paginação e suporte a intervalo de datas ou contagem recente.
 * Garante que nenhuma chamada de rede ocorra dentro de transação do Prisma.
 */
export async function sincronizarVotacoesCamara(opcoes: {
  dataInicio?: string;
  dataFim?: string;
  limite?: number;
  ordem?: "ASC" | "DESC";
  todasPaginas?: boolean;
}): Promise<{ votacoesSincronizadas: number; votosSincronizados: number }> {
  if (opcoes.todasPaginas && (!opcoes.dataInicio || !opcoes.dataFim || !Number.isFinite(Date.parse(opcoes.dataInicio)) || !Number.isFinite(Date.parse(opcoes.dataFim)) || opcoes.dataInicio > opcoes.dataFim || (Date.parse(opcoes.dataFim) - Date.parse(opcoes.dataInicio)) > 31 * 86400000)) throw new Error('Paginação integral exige intervalo de até 31 dias');
  const limiteMax = opcoes.todasPaginas ? Number.POSITIVE_INFINITY : opcoes.limite ?? 30;
  let pagina = 1;
  const itensPorPagina = Math.min(limiteMax, 50);
  const votacoesColetadas: CamaraVotacaoResumoContract[] = [];

  while (votacoesColetadas.length < limiteMax) {
    const params = new URLSearchParams();
    params.set("pagina", String(pagina));
    params.set("itens", String(itensPorPagina));
    params.set("ordem", opcoes.ordem ?? "DESC");
    params.set("ordenarPor", "dataHoraRegistro");

    if (opcoes.dataInicio) params.set("dataInicio", opcoes.dataInicio);
    if (opcoes.dataFim) params.set("dataFim", opcoes.dataFim);

    const url = `/votacoes?${params.toString()}`;
    const respostaRaw = await camaraApiClient.fetchJson<unknown>(url);
    const envelope = validarRespostaEnvelopeCamara<CamaraVotacaoResumoContract[]>(
      respostaRaw,
      `votacoes pagina=${pagina}`
    );

    const lista = envelope.dados ?? [];
    if (lista.length === 0) break;

    for (const v of lista) {
      votacoesColetadas.push(v);
      if (votacoesColetadas.length >= limiteMax) break;
    }

    const nextLink = envelope.links?.find((l) => l.rel === "next");
    if (!nextLink) break;
    pagina++;
  }

  let votacoesSincronizadas = 0;
  let votosSincronizados = 0;

  for (const item of votacoesColetadas) {
    const detalheUrl = `${BASE_URL}/votacoes/${item.id}`;
    // Fazer chamadas de rede fora de transações do banco
    // 404 in an official detail does not invalidate the published list row.
    const detalheRaw = await camaraApiClient.fetchJson<unknown>(
      `/votacoes/${item.id}`, { acceptStatuses: [404] }
    );
    const detalhe = detalheRaw === null ? null : validarRespostaEnvelopeCamara<CamaraVotacaoDetalheContract>(
      detalheRaw, `votacao ${item.id}`
    ).dados;
    if (detalheRaw === null) {
      console.warn("[Câmara] Detalhe 404 de " + item.id + " — resumo da listagem preservado.");
    }
    let endpointVotosAusente = false;
    const votosLista = detalhe === null
      ? []
      : await coletarPaginas<CamaraVotoNominalContract>(`/votacoes/${item.id}/votos`, true, () => { endpointVotosAusente = true; });
    const propRef: CamaraProposicaoRefContract | undefined =
      detalhe?.proposicoesAfetadas?.[0] ?? detalhe?.objetosPossiveis?.[0];

    // As votações da Câmara frequentemente fornecem apenas a URI oficial
    // da proposição (sem objeto completo). Aproveitar o cadastro já importado
    // antes de classificar erroneamente uma votação como desvinculada.
    const uriProposicao = (valor: unknown): string | null => {
      if (typeof valor === "string") return valor;
      if (valor && typeof valor === "object" && "uri" in valor &&
          typeof (valor as { uri?: unknown }).uri === "string")
        return (valor as { uri: string }).uri;
      return null;
    };
    const uriReferencias = [
      uriProposicao(detalhe?.ultimaApresentacaoProposicao?.uriProposicaoCitada),
      uriProposicao(item.proposicaoObjeto),
      uriProposicao(propRef),
    ];
    const idsOficiais = uriReferencias.flatMap(uri => {
      if (!uri) return [];
      try {
        const parsed = new URL(uri, BASE_URL);
        if (parsed.origin !== new URL(BASE_URL).origin) return [];
        const match = /^\/api\/v2\/proposicoes\/(\d+)\/?$/.exec(parsed.pathname);
        return match ? [match[1]] : [];
      } catch { return []; }
    });

    const contagens = obterContagensCamara(item, detalhe, votosLista);
    const placarSim = contagens.sim;
    const placarNao = contagens.nao;
    const placarAbstencao = contagens.abstencao;
    const placarObstrucao = contagens.obstrucao;
    const placarOutros = contagens.outros;
    // An unavailable current response cannot invalidate a previously verified tally.
    const placarNaoAtualizavel = votosLista.length === 0 && !contagens.agregado;

    // dataHoraRegistro is the time the vote was ENTERED, potentially days after
    // the official date of the vote; don't present it as voting time.
    const dataHora = item.dataHoraRegistro?.slice(0, 10) === item.data
      ? new Date(item.dataHoraRegistro)
      : new Date(`${item.data}T12:00:00Z`);

    const aprovada =
      (detalhe?.aprovacao ?? item.aprovacao) === 1 ? true : (detalhe?.aprovacao ?? item.aprovacao) === 0 ? false : null;

    const cobertura = detalheRaw === null || endpointVotosAusente
      ? CoberturaVotacao.DADOS_PARCIAIS
      : votosLista.length > 0 ? CoberturaVotacao.NOMINAL_PUBLICA
      : contagens.agregado ? CoberturaVotacao.PLACAR_AGREGADO
      : CoberturaVotacao.SEM_VOTOS_NOMINAIS;

    // Transação estritamente delimitada sem rede interna
    await prisma.$transaction(
      async (tx) => {
        let proposicaoId: string | null = null;
        if (idsOficiais.length) {
          const existente = await tx.proposicao.findFirst({
            where: { casa: CasaLegislativa.CAMARA, externalId: { in: idsOficiais } },
            select: { id: true },
          });
          proposicaoId = existente?.id ?? null;
        }

        if (propRef && propRef.id && propRef.numero && propRef.ano) {
          const propSalva = await tx.proposicao.upsert({
            where: {
              casa_externalId: {
                casa: CasaLegislativa.CAMARA,
                externalId: String(propRef.id),
              },
            },
            update: {
              siglaTipo: propRef.siglaTipo || "PL",
              numero: Number(propRef.numero),
              ano: Number(propRef.ano),
              ementa:
                propRef.ementa ||
                detalhe?.ultimaApresentacaoProposicao?.descricao ||
                item.descricao,
            },
            create: {
              casa: CasaLegislativa.CAMARA,
              externalId: String(propRef.id),
              siglaTipo: propRef.siglaTipo || "PL",
              numero: Number(propRef.numero),
              ano: Number(propRef.ano),
              ementa:
                propRef.ementa ||
                detalhe?.ultimaApresentacaoProposicao?.descricao ||
                item.descricao,
            },
          });
          proposicaoId = propSalva.id;
        }

        const sessaoExternalId = detalhe?.idEvento ? String(detalhe.idEvento) : null;

        const votacaoSalva = await tx.votacao.upsert({
          where: {
            casa_externalId: {
              casa: CasaLegislativa.CAMARA,
              externalId: String(item.id),
            },
          },
          update: {
            dataHora,
            orgao: item.siglaOrgao ?? "PLEN",
            descricao: item.descricao,
            resumo: detalhe?.ultimaApresentacaoProposicao?.descricao || undefined,
            aprovada: aprovada ?? undefined,
            placarSim: placarNaoAtualizavel ? undefined : placarSim,
            placarNao: placarNaoAtualizavel ? undefined : placarNao,
            placarAbstencao: placarNaoAtualizavel ? undefined : placarAbstencao,
            placarObstrucao: placarNaoAtualizavel ? undefined : placarObstrucao,
            placarOutros: placarNaoAtualizavel ? undefined : placarOutros,
            proposicaoId: proposicaoId ?? undefined,
            fonteUrl: detalheRaw === null ? undefined : detalheUrl,
            cobertura: detalheRaw === null || endpointVotosAusente ? undefined : cobertura,
            votacaoSecreta: false,
            sessaoExternalId,
            casaSessao: "CAMARA",
          },
          create: {
            casa: CasaLegislativa.CAMARA,
            externalId: String(item.id),
            dataHora,
            orgao: item.siglaOrgao ?? "PLEN",
            descricao: item.descricao,
            resumo: detalhe?.ultimaApresentacaoProposicao?.descricao ?? null,
            aprovada,
            placarSim,
            placarNao,
            placarAbstencao,
            placarObstrucao,
            placarOutros,
            proposicaoId,
            fonteUrl: detalheRaw === null
              ? `${BASE_URL}/votacoes?dataInicio=${item.data}&dataFim=${item.data}`
              : detalheUrl,
            cobertura,
            votacaoSecreta: false,
            sessaoExternalId,
            casaSessao: "CAMARA",
          },
        });

        for (const votoItem of votosLista) {
          const dep = votoItem.deputado_;
          if (!dep?.id) continue;

          const parlamentarId = await garantirParlamentarHistoricoCamara(tx, dep);
          const { opcaoNormalizada, opcaoOriginal } = normalizarVotoCamara(votoItem.tipoVoto);
          const registradoEm = votoItem.dataRegistroVoto
            ? new Date(votoItem.dataRegistroVoto)
            : dataHora;

          await tx.voto.upsert({
            where: {
              votacaoId_parlamentarId: {
                votacaoId: votacaoSalva.id,
                parlamentarId,
              },
            },
            update: {
              opcao: opcaoNormalizada,
              opcaoOriginal,
              descricaoOriginal: null,
              registradoEm,
              partidoNaEpoca: dep.siglaPartido || "S/PARTIDO",
              ufNaEpoca: dep.siglaUf || "BR",
            },
            create: {
              votacaoId: votacaoSalva.id,
              parlamentarId,
              opcao: opcaoNormalizada,
              opcaoOriginal,
              descricaoOriginal: null,
              registradoEm,
              partidoNaEpoca: dep.siglaPartido || "S/PARTIDO",
              ufNaEpoca: dep.siglaUf || "BR",
            },
          });
        }
      },
      { timeout: 35000 }
    );

    votacoesSincronizadas++;
    votosSincronizados += votosLista.length;
  }

  return { votacoesSincronizadas, votosSincronizados };
}

/**
 * Sincroniza presenças de eventos plenários da Câmara (codTipoEvento=110).
 * REGRA CRÍTICA: /eventos/{id}/deputados fornece evidência positiva de comparecimento.
 * NUNCA infere ausência para deputados que não constam na lista (positive evidence only).
 */
export async function sincronizarPresencasCamara(opcoes: {
  dataInicio?: string;
  dataFim?: string;
  limiteSessoes?: number;
  todasPaginas?: boolean;
}): Promise<number> {
  if (opcoes.todasPaginas && (!opcoes.dataInicio || !opcoes.dataFim || !Number.isFinite(Date.parse(opcoes.dataInicio)) || !Number.isFinite(Date.parse(opcoes.dataFim)) || opcoes.dataInicio > opcoes.dataFim || (Date.parse(opcoes.dataFim) - Date.parse(opcoes.dataInicio)) > 31 * 86400000)) throw new Error('Paginação integral exige intervalo de até 31 dias');
  const limite = opcoes.limiteSessoes ?? 10;
  const params = new URLSearchParams();
  params.set("codTipoEvento", "110");
  params.set("itens", String(opcoes.todasPaginas ? 100 : limite));
  params.set("ordem", "DESC");
  params.set("ordenarPor", "dataHoraInicio");

  if (opcoes.dataInicio) params.set("dataInicio", opcoes.dataInicio);
  if (opcoes.dataFim) params.set("dataFim", opcoes.dataFim);

  const url = `/eventos?${params.toString()}`;
  const eventos = opcoes.todasPaginas
    ? await coletarPaginas<CamaraEventoContract>(url)
    : validarRespostaEnvelopeCamara<CamaraEventoContract[]>(await camaraApiClient.fetchJson<unknown>(url), 'eventos plenários da câmara').dados ?? [];
  let presencasRegistradas = 0;

  for (const evento of eventos) {
    const presentesUrl = `${BASE_URL}/eventos/${evento.id}/deputados`;
    const presentesLista = await coletarPaginas<CamaraDeputadoContract>(`/eventos/${evento.id}/deputados`);
    if (presentesLista.length === 0) continue;

    const dataSessao = new Date(evento.dataHoraInicio);
    const tituloSessao =
      evento.descricao || evento.descricaoTipo || `Sessão Plenária #${evento.id}`;

    // Executa em lote transacional bounded
    await prisma.$transaction(
      async (tx) => {
        for (const dep of presentesLista) {
          const parlamentarId = await garantirParlamentarHistoricoCamara(tx, dep);

          await tx.presenca.upsert({
            where: {
              casa_sessaoExternalId_parlamentarId: {
                casa: CasaLegislativa.CAMARA,
                sessaoExternalId: String(evento.id),
                parlamentarId,
              },
            },
            update: {
              dataSessao,
              tituloSessao,
              status: StatusPresenca.PRESENTE,
              justificativa: null,
              fonteUrl: presentesUrl,
              origem: OrigemPresenca.EVENTO_CAMARA,
              cobertura: CoberturaPresenca.CHAMADA_OFICIAL,
            },
            create: {
              casa: CasaLegislativa.CAMARA,
              sessaoExternalId: String(evento.id),
              parlamentarId,
              dataSessao,
              tituloSessao,
              status: StatusPresenca.PRESENTE,
              justificativa: null,
              fonteUrl: presentesUrl,
              origem: OrigemPresenca.EVENTO_CAMARA,
              cobertura: CoberturaPresenca.CHAMADA_OFICIAL,
            },
          });
          presencasRegistradas++;
        }
      },
      { timeout: 35000 }
    );
  }

  return presencasRegistradas;
}
