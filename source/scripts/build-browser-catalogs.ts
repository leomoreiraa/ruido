/**
 * Pré-computa catálogos públicos consumidos sob demanda pelos filtros.
 * Evita hidratar 20 mil+ registros em cada visita à página.
 * Somente dados públicos; sem consultas do navegador às APIs oficiais.
 */
import fs from "node:fs/promises";
import path from "node:path";
import { gzipSync } from "node:zlib";
import { prisma } from "../lib/prisma";
import { fonteHash, explicacaoFielAoObjeto } from "../lib/ai/explicacaoProjetos";

async function main() {
  const dest = path.join(process.cwd(), "public", "data");
  await fs.mkdir(dest, { recursive: true });

  const proposicoes = await prisma.proposicao.findMany({
    orderBy: [{ ano: "desc" }, { numero: "desc" }],
    include: {
      votacoes: { orderBy: { dataHora: "desc" }, take: 1 },
      _count: { select: { votacoes: true } },
    },
  });
  const pautas = proposicoes.map(prop => {
    const uv = prop.votacoes[0];
    const fonte = fonteHash(prop, prop.resumoModelo ?? undefined);
    const iaValida = prop.resumoFonteHash === fonte && !!prop.tituloSimples &&
      !!prop.resumoSimples && !!prop.explicacaoSimples &&
      explicacaoFielAoObjeto(prop.ementa, {
        titulo:prop.tituloSimples, resumo:prop.resumoSimples,
        explicacao:prop.explicacaoSimples,
      });
    return {
      id: prop.id,
      externalId: prop.externalId,
      autorNome: prop.autorNome,
      dataApresentacao: prop.dataApresentacao?.toISOString() ?? null,
      casa: prop.casa,
      siglaTipo: prop.siglaTipo,
      numero: prop.numero,
      ano: prop.ano,
      ementa: prop.ementa,
      tituloSimples: iaValida ? prop.tituloSimples : null,
      resumoSimples: iaValida ? prop.resumoSimples : null,
      totalVotacoes: prop._count.votacoes,
      ultimaVotacao: uv ? {
        id: uv.id,
        descricao: uv.descricao,
        dataHora: uv.dataHora.toISOString(),
        aprovada: uv.aprovada,
        placarSim: uv.placarSim,
        placarNao: uv.placarNao,
      } : null,
    };
  });
  await fs.writeFile(path.join(dest, "pautas-index.json"), JSON.stringify(pautas), "utf8");
  const detailsDir = path.join(dest, "pautas-detalhe");
  await fs.rm(detailsDir, { force: true, recursive: true });
  await fs.mkdir(detailsDir, { recursive: true });
  let detailVotes = 0;
  let detailSessions = 0;
  let detailBytes = 0;
  for (let start = 0; start < proposicoes.length; start += 160) {
    const batch = proposicoes.slice(start, start + 160);
    const sessions = await prisma.votacao.findMany({
      where: { proposicaoId: { in: batch.map(p => p.id) } },
      orderBy: [{ dataHora: "desc" }, { id: "asc" }],
      include: {
        votos: {
          orderBy: [{ opcao: "asc" }, { parlamentar: { nome: "asc" } }],
          include: {
            parlamentar: {
              select: { id: true, nome: true, partido: true, uf: true, urlFoto: true },
            },
          },
        },
      },
    });
    const grouped = new Map<string, typeof sessions>();
    for (const session of sessions) {
      if (!session.proposicaoId) continue;
      const record = grouped.get(session.proposicaoId) ?? [];
      record.push(session);
      grouped.set(session.proposicaoId, record);
      detailVotes += session.votos.length;
      detailSessions++;
    }
    await Promise.all(batch.map(async prop => {
      if (!/^[A-Za-z0-9_-]{1,128}$/.test(prop.id))
        throw new Error("ID de proposição inválido no catálogo");
      const valid = prop.resumoFonteHash === fonteHash(prop, prop.resumoModelo ?? undefined) &&
        !!prop.tituloSimples && !!prop.resumoSimples && !!prop.explicacaoSimples &&
        explicacaoFielAoObjeto(prop.ementa, {
          titulo: prop.tituloSimples, resumo: prop.resumoSimples, explicacao: prop.explicacaoSimples,
        });
      const record = {
        id: prop.id, externalId: prop.externalId, casa: prop.casa,
        siglaTipo: prop.siglaTipo, numero: prop.numero, ano: prop.ano,
        ementa: prop.ementa, autorNome: prop.autorNome,
        urlInteiroTeor: prop.urlInteiroTeor, dataApresentacao: prop.dataApresentacao?.toISOString() ?? null,
        tituloSimples: valid ? prop.tituloSimples : null,
        resumoSimples: valid ? prop.resumoSimples : null,
        explicacaoSimples: valid ? prop.explicacaoSimples : null,
        explicacaoValida: valid,
        votacoes: (grouped.get(prop.id) ?? []).map(v => ({
          id: v.id, dataHora: v.dataHora.toISOString(), orgao: v.orgao,
          descricao: v.descricao, resumo: v.resumo, votacaoSecreta: v.votacaoSecreta,
          aprovada: v.aprovada, cobertura: v.cobertura,
          placarSim: v.placarSim, placarNao: v.placarNao,
          placarAbstencao: v.placarAbstencao, placarObstrucao: v.placarObstrucao,
          placarOutros: v.placarOutros,
          votos: v.votos.map(w => ({
            id: w.id, opcao: w.opcao, opcaoOriginal: w.opcaoOriginal,
            partidoNaEpoca: w.partidoNaEpoca, ufNaEpoca: w.ufNaEpoca,
            parlamentar: w.parlamentar,
          })),
        })),
      };
      const compressed = gzipSync(JSON.stringify({ version: 1, proposicao: record }), { level: 6 });
      detailBytes += compressed.length;
      await fs.writeFile(path.join(detailsDir, prop.id + ".json.gz"), compressed);
    }));
  }
  const detailManifest = {
    version: 1, proposicoes: proposicoes.length, votacoes: detailSessions,
    votosNominais: detailVotes, bytes: detailBytes,
  };
  await fs.writeFile(path.join(dest, "pautas-detalhe-manifest.json"), JSON.stringify(detailManifest));
  console.log("Detalhes oficiais em arquivos gzip: " + JSON.stringify(detailManifest));

  const [votacoesTotais, votacoesVinculadas, votosNominais] = await Promise.all([
    prisma.votacao.count(),
    prisma.votacao.count({ where: { proposicaoId: { not: null } } }),
    prisma.voto.count(),
  ]);
  const auditoria = {
    votacoesTotais,
    votacoesVinculadas,
    votacoesSemPautaIdentificada: votacoesTotais - votacoesVinculadas,
    votosNominais,
    pautasComVotacao: pautas.filter(p => p.totalVotacoes > 0).length,
    pautasSemVotacaoAssociada: pautas.filter(p => p.totalVotacoes === 0).length,
  };
  await fs.writeFile(path.join(dest, "cobertura-votacoes.json"), JSON.stringify(auditoria, null, 2), "utf8");
  console.log("Auditoria de cobertura das votações: " + JSON.stringify(auditoria));
  console.log("Catálogo de pautas gerado: " + pautas.length + " registros.");

  const emendas = await prisma.emendaParlamentar.findMany({
    orderBy: [{ valorPago: "desc" }, { ano: "desc" }],
    include: {
      parlamentar: {
        select: { id: true, nome: true, partido: true, uf: true, casa: true, urlFoto: true },
      },
    },
  });
  const catalogo = emendas.map(em => ({
    id: em.id,
    parlamentarId: em.parlamentarId,
    autorOriginal: em.autorOriginal,
    numeroEmenda: em.numeroEmenda,
    localidadeOriginal: em.localidadeOriginal,
    codigoEmenda: em.codigoEmenda,
    ano: em.ano,
    tipo: em.tipo,
    descricao: em.descricao,
    valorEmpenhado: em.valorEmpenhado,
    valorPago: em.valorPago,
    municipioBeneficiado: em.municipioBeneficiado,
    ufBeneficiada: em.ufBeneficiada,
    funcao: em.funcao,
    status: em.status,
    fonte: em.fonte,
    parlamentar: em.parlamentar ? {
      id: em.parlamentar.id,
      nome: em.parlamentar.nome,
      partido: em.parlamentar.partido,
      uf: em.parlamentar.uf,
      casa: em.parlamentar.casa,
      urlFoto: em.parlamentar.urlFoto,
    } : undefined,
  }));
  await fs.writeFile(path.join(dest, "emendas-index.json"), JSON.stringify(catalogo), "utf8");
  console.log("Catálogo de emendas gerado: " + catalogo.length + " registros.");
}

main().catch(e => { console.error("Falha na exportação dos catálogos:", e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
