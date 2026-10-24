
import { prisma } from "@/lib/prisma";
import {
  CasaLegislativa,
  CoberturaPresenca,
  CoberturaVotacao,
  OpcaoVoto,
  OrigemPresenca,
  StatusPresenca,
} from "@/lib/types";
import { senadoApiClient } from "./apiClient";
import {
  classificarEvidenciaPresencaSenado,
  normalizarVotoSenado,
  SenadoVotacaoFlatContract,
  SenadoVotoItemContract,
  validarItemVotacaoSenado,
} from "./senadoNormalizer";

const BASE_URL = "https://legis.senado.leg.br/dadosabertos";

interface SenadoParlamentarItem {
  IdentificacaoParlamentar: {
    CodigoParlamentar: string;
    NomeParlamentar: string;
    NomeCompletoParlamentar?: string;
    SiglaPartidoParlamentar?: string;
    UfParlamentar?: string;
    UrlFotoParlamentar?: string;
    EmailParlamentar?: string;
  };
}

interface SenadoListaAtualResponse {
  ListaParlamentarEmExercicio?: {
    Parlamentares?: {
      Parlamentar?: SenadoParlamentarItem[] | SenadoParlamentarItem;
    };
  };
}

function toArray<T>(val: T | T[] | undefined | null): T[] {
  if (!val) return [];
  return Array.isArray(val) ? val : [val];
}


export async function sincronizarSenadoresAtuais(): Promise<number> {
  const agora = new Date();
  const url = "/senador/lista/atual.json";
  const resposta = await senadoApiClient.fetchJson<SenadoListaAtualResponse>(url);

  const listaBruta =
    resposta.ListaParlamentarEmExercicio?.Parlamentares?.Parlamentar;
  const senadores = toArray(listaBruta);

  const operacoes = senadores
    .map((s) => s.IdentificacaoParlamentar)
    .filter((id) => Boolean(id?.CodigoParlamentar))
    .map((id) =>
      prisma.parlamentar.upsert({
        where: {
          casa_externalId: {
            casa: CasaLegislativa.SENADO,
            externalId: String(id.CodigoParlamentar),
          },
        },
        update: {
          nome: id.NomeParlamentar,
          nomeCivil: id.NomeCompletoParlamentar ?? null,
          partido: id.SiglaPartidoParlamentar || "S/PARTIDO",
          uf: id.UfParlamentar || "BR",
          urlFoto: id.UrlFotoParlamentar ?? null,
          email: id.EmailParlamentar ?? null,
          ativo: true,
          cadastroAtualizadoEm: agora,
        },
        create: {
          casa: CasaLegislativa.SENADO,
          externalId: String(id.CodigoParlamentar),
          nome: id.NomeParlamentar,
          nomeCivil: id.NomeCompletoParlamentar ?? null,
          partido: id.SiglaPartidoParlamentar || "S/PARTIDO",
          uf: id.UfParlamentar || "BR",
          urlFoto: id.UrlFotoParlamentar ?? null,
          email: id.EmailParlamentar ?? null,
          ativo: true,
          cadastroAtualizadoEm: agora,
        },
      })
    );

  
  
  const codigos=senadores.map(s=>String(s.IdentificacaoParlamentar?.CodigoParlamentar||""));
  if (senadores.length < 70 || senadores.length > 90 ||
      new Set(codigos).size!==senadores.length ||codigos.some(code=>!/^\d+$/.test(code))) {
    throw new Error('Cadastro atual do Senado incompleto; não alterar mandatos com dados parciais');
  }
  if (operacoes.length > 0) {
    await prisma.$transaction(operacoes);
  }
  await prisma.parlamentar.updateMany({
    where: { casa: CasaLegislativa.SENADO, ativo: true,
      externalId: { notIn: senadores.map(s => String(s.IdentificacaoParlamentar.CodigoParlamentar)) } },
    data: { ativo: false, cadastroAtualizadoEm: agora },
  });
  return operacoes.length;
}


async function garantirParlamentarHistoricoSenado(
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
  vp: SenadoVotoItemContract
): Promise<string> {
  const codigo = String(vp.codigoParlamentar);
  const existente = await tx.parlamentar.findUnique({
    where: {
      casa_externalId: {
        casa: CasaLegislativa.SENADO,
        externalId: codigo,
      },
    },
    select: { id: true },
  });

  if (existente) {
    return existente.id;
  }

  const criado = await tx.parlamentar.create({
    data: {
      casa: CasaLegislativa.SENADO,
      externalId: codigo,
      nome: vp.nomeParlamentar || `Senador #${codigo}`,
      partido: vp.siglaPartidoParlamentar || "S/PARTIDO",
      uf: vp.siglaUFParlamentar || "BR",
      ativo: false, 
    },
    select: { id: true },
  });

  return criado.id;
}


export async function sincronizarVotacoesEPresencasSenado(
  dataInicio: string,
  dataFim: string
): Promise<{
  votacoesSincronizadas: number;
  votosSincronizados: number;
  presencasSincronizadas: number;
}> {
  const endpointRelativo = `/votacao?dataInicio=${dataInicio}&dataFim=${dataFim}`;
  const fonteUrl = `${BASE_URL}${endpointRelativo}`;
  const respostaRaw = await senadoApiClient.fetchJson<unknown>(endpointRelativo);

  if (!Array.isArray(respostaRaw)) {
    throw new Error(
      `Resposta inválida da API do Senado em ${endpointRelativo}: esperava um array JSON plano, obteve ${typeof respostaRaw}`
    );
  }

  const votacoes = respostaRaw as unknown[];
  let votacoesSincronizadas = 0;
  let votosSincronizados = 0;

  
  
  const presencasPorSessao = new Map<
    string,
    {
      sessaoExternalId: string;
      parlamentarCodigo: string;
      nomeParlamentar: string;
      partido: string;
      uf: string;
      dataSessao: Date;
      tituloSessao: string;
      status: StatusPresenca;
      justificativa: string | null;
    }
  >();

  for (const itemRaw of votacoes) {
    validarItemVotacaoSenado(itemRaw);
    const vot = itemRaw as SenadoVotacaoFlatContract;

    const codVotacao = String(vot.codigoSessaoVotacao);
    const codSessao = vot.codigoSessao ? String(vot.codigoSessao) : codVotacao;
    const casaSessao = vot.casaSessao ? String(vot.casaSessao) : "SF";
    const ehSecreta =
      vot.votacaoSecreta === "S" ||
      vot.votacaoSecreta === true ||
      vot.votacaoSecreta === "true";

    const votosArray = vot.votos ?? [];
    const temVotosNominais = votosArray.length > 0;

    let placarSim = 0;
    let placarNao = 0;
    let placarAbstencao = 0;
    let placarObstrucao = 0;

    if (!temVotosNominais) {
      placarSim = Number(vot.totalVotosSim ?? 0);
      placarNao = Number(vot.totalVotosNao ?? 0);
      placarAbstencao = Number(vot.totalVotosAbstencao ?? 0);
    } else {
      for (const v of votosArray) {
        const { opcaoNormalizada } = normalizarVotoSenado(v.siglaVotoParlamentar);
        if (opcaoNormalizada === OpcaoVoto.SIM) placarSim++;
        else if (opcaoNormalizada === OpcaoVoto.NAO) placarNao++;
        else if (opcaoNormalizada === OpcaoVoto.ABSTENCAO) placarAbstencao++;
        else if (opcaoNormalizada === OpcaoVoto.OBSTRUCAO) placarObstrucao++;
      }
    }

    const dataSessaoStr = vot.dataSessao || dataInicio;
    const dataHora = new Date(`${dataSessaoStr}T14:00:00Z`);

    const aprovada =
      vot.resultadoVotacao === "A"
        ? true
        : vot.resultadoVotacao === "R"
        ? false
        : null;

    let cobertura: CoberturaVotacao = CoberturaVotacao.NOMINAL_PUBLICA;
    if (ehSecreta) {
      cobertura = CoberturaVotacao.SECRETA_AGREGADA;
    } else if (!temVotosNominais) {
      cobertura = (placarSim + placarNao + placarAbstencao) > 0
        ? CoberturaVotacao.PLACAR_AGREGADO : CoberturaVotacao.SEM_VOTOS_NOMINAIS;
    }

    const descricao =
      vot.descricaoVotacao ||
      vot.ementa ||
      `Votação Plenária do Senado #${codVotacao}`;

    
    await prisma.$transaction(
      async (tx) => {
        let proposicaoId: string | null = null;

        if (vot.codigoMateria) {
          const codMateria = String(vot.codigoMateria);
          const siglaTipo = vot.sigla || "MAT";
          const numero = vot.numero ? parseInt(String(vot.numero), 10) || 0 : 0;
          const ano = vot.ano ? Number(vot.ano) : 0;
          const ementa =
            vot.ementa ||
            vot.identificacao ||
            vot.descricaoVotacao ||
            `Matéria do Senado #${codMateria}`;

          const prop = await tx.proposicao.upsert({
            where: {
              casa_externalId: {
                casa: CasaLegislativa.SENADO,
                externalId: codMateria,
              },
            },
            update: {
              siglaTipo,
              numero,
              ano,
              ementa,
            },
            create: {
              casa: CasaLegislativa.SENADO,
              externalId: codMateria,
              siglaTipo,
              numero,
              ano,
              ementa,
            },
          });
          proposicaoId = prop.id;
        }

        const votacaoSalva = await tx.votacao.upsert({
          where: {
            casa_externalId: {
              casa: CasaLegislativa.SENADO,
              externalId: codVotacao,
            },
          },
          update: {
            dataHora,
            orgao: "PLEN",
            descricao,
            resumo: vot.ementa ?? null,
            aprovada,
            placarSim,
            placarNao,
            placarAbstencao,
            placarObstrucao,
            proposicaoId,
            fonteUrl,
            cobertura,
            votacaoSecreta: ehSecreta,
            sessaoExternalId: codSessao,
            casaSessao,
          },
          create: {
            casa: CasaLegislativa.SENADO,
            externalId: codVotacao,
            dataHora,
            orgao: "PLEN",
            descricao,
            resumo: vot.ementa ?? null,
            aprovada,
            placarSim,
            placarNao,
            placarAbstencao,
            placarObstrucao,
            proposicaoId,
            fonteUrl,
            cobertura,
            votacaoSecreta: ehSecreta,
            sessaoExternalId: codSessao,
            casaSessao,
          },
        });

        for (const vp of votosArray) {
          if (!vp.codigoParlamentar) continue;

          const parlamentarId = await garantirParlamentarHistoricoSenado(tx, vp);
          const { opcaoNormalizada, siglaOriginal } = normalizarVotoSenado(
            vp.siglaVotoParlamentar
          );

          await tx.voto.upsert({
            where: {
              votacaoId_parlamentarId: {
                votacaoId: votacaoSalva.id,
                parlamentarId,
              },
            },
            update: {
              opcao: opcaoNormalizada,
              opcaoOriginal: siglaOriginal,
              descricaoOriginal: vp.descricaoVotoParlamentar ?? null,
              registradoEm: dataHora,
              partidoNaEpoca: vp.siglaPartidoParlamentar || "S/PARTIDO",
              ufNaEpoca: vp.siglaUFParlamentar || "BR",
            },
            create: {
              votacaoId: votacaoSalva.id,
              parlamentarId,
              opcao: opcaoNormalizada,
              opcaoOriginal: siglaOriginal,
              descricaoOriginal: vp.descricaoVotoParlamentar ?? null,
              registradoEm: dataHora,
              partidoNaEpoca: vp.siglaPartidoParlamentar || "S/PARTIDO",
              ufNaEpoca: vp.siglaUFParlamentar || "BR",
            },
          });
        }
      },
      { timeout: 35000 }
    );

    votacoesSincronizadas++;
    votosSincronizados += votosArray.length;

    
    for (const vp of votosArray) {
      if (!vp.codigoParlamentar) continue;
      const codParlamentar = String(vp.codigoParlamentar);
      const evidencia = classificarEvidenciaPresencaSenado(
        vp.siglaVotoParlamentar,
        vp.descricaoVotoParlamentar
      );

      if (!evidencia) {
        continue;
      }

      const chave = `${codSessao}:::${codParlamentar}`;
      const presencaExistente = presencasPorSessao.get(chave);

      if (!presencaExistente) {
        presencasPorSessao.set(chave, {
          sessaoExternalId: codSessao,
          parlamentarCodigo: codParlamentar,
          nomeParlamentar: vp.nomeParlamentar || `Senador #${codParlamentar}`,
          partido: vp.siglaPartidoParlamentar || "S/PARTIDO",
          uf: vp.siglaUFParlamentar || "BR",
          dataSessao: dataHora,
          tituloSessao: `Sessão Plenária do Senado #${codSessao}`,
          status: evidencia.status,
          justificativa: evidencia.justificativa,
        });
      } else {
        
        if (
          evidencia.status === StatusPresenca.PRESENTE &&
          presencaExistente.status !== StatusPresenca.PRESENTE
        ) {
          presencaExistente.status = StatusPresenca.PRESENTE;
          presencaExistente.justificativa = null;
        } else if (
          presencaExistente.status === StatusPresenca.AUSENTE &&
          evidencia.status === StatusPresenca.JUSTIFICADO
        ) {
          presencaExistente.status = StatusPresenca.JUSTIFICADO;
          presencaExistente.justificativa = evidencia.justificativa;
        }
      }
    }
  }

  
  let presencasSincronizadas = 0;
  const listaPresencas = Array.from(presencasPorSessao.values());
  const batchSize = 50;

  for (let i = 0; i < listaPresencas.length; i += batchSize) {
    const lote = listaPresencas.slice(i, i + batchSize);

    await prisma.$transaction(
      async (tx) => {
        for (const item of lote) {
          const parlamentarId = await garantirParlamentarHistoricoSenado(tx, {
            codigoParlamentar: item.parlamentarCodigo,
            nomeParlamentar: item.nomeParlamentar,
            siglaPartidoParlamentar: item.partido,
            siglaUFParlamentar: item.uf,
          });

          await tx.presenca.upsert({
            where: {
              casa_sessaoExternalId_parlamentarId: {
                casa: CasaLegislativa.SENADO,
                sessaoExternalId: item.sessaoExternalId,
                parlamentarId,
              },
            },
            update: {
              dataSessao: item.dataSessao,
              tituloSessao: item.tituloSessao,
              status: item.status,
              justificativa: item.justificativa,
              fonteUrl,
              origem: OrigemPresenca.VOTO_SENADO,
              cobertura: CoberturaPresenca.EVIDENCIA_PARCIAL,
            },
            create: {
              casa: CasaLegislativa.SENADO,
              sessaoExternalId: item.sessaoExternalId,
              parlamentarId,
              dataSessao: item.dataSessao,
              tituloSessao: item.tituloSessao,
              status: item.status,
              justificativa: item.justificativa,
              fonteUrl,
              origem: OrigemPresenca.VOTO_SENADO,
              cobertura: CoberturaPresenca.EVIDENCIA_PARCIAL,
            },
          });
          presencasSincronizadas++;
        }
      },
      { timeout: 35000 }
    );
  }

  return {
    votacoesSincronizadas,
    votosSincronizados,
    presencasSincronizadas,
  };
}
