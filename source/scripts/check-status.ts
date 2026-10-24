import { prisma } from "../lib/prisma";

async function main() {
  const casas = [];
  for (const casa of ["CAMARA", "SENADO"]) {
    const [parlamentares, proposicoes, votacoes, votos, presencas, discursos, coberturaVotacoes, coberturaPresencas] = await Promise.all([
      prisma.parlamentar.count({ where: { casa } }),
      prisma.proposicao.count({ where: { casa } }),
      prisma.votacao.aggregate({ where: { casa }, _count: true, _min: { dataHora: true }, _max: { dataHora: true } }),
      prisma.voto.count({ where: { votacao: { casa } } }),
      prisma.presenca.aggregate({ where: { casa }, _count: true, _min: { dataSessao: true }, _max: { dataSessao: true } }),
      prisma.discurso.aggregate({ where: { parlamentar: { casa } }, _count: true, _min: { dataHora: true }, _max: { dataHora: true } }),
      prisma.votacao.groupBy({ by: ["cobertura"], where: { casa }, _count: true }),
      prisma.presenca.groupBy({ by: ["origem", "cobertura", "status"], where: { casa }, _count: true }),
    ]);
    casas.push({ casa, parlamentares, proposicoes, votacoes, votos, presencas, discursos, coberturaVotacoes, coberturaPresencas });
  }
  const [emendas, bens, resumosIA, ultimaColetaBemSucedida] = await Promise.all([
    prisma.emendaParlamentar.count(),
    prisma.bemDeclarado.count(),
    prisma.resumoIA.count(),
    prisma.syncExecution.findFirst({ where: { status: "SUCESSO" }, orderBy: { finalizadoEm: "desc" }, select: { iniciadoEm: true, finalizadoEm: true } }),
  ]);
  console.log(JSON.stringify({ consultadoEm: new Date().toISOString(), casas, emendas, bens, resumosIA, ultimaColetaBemSucedida,
    observacao: "Datas extremas não comprovam cobertura contínua. Presenças são registros de evidência; não inferir faltas de dados ausentes." }, null, 2));
}

main().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
