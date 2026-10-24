/**
 * Exporta o histórico nominal para download progressivo no GitHub Pages.
 * Cada arquivo é comprimido e pertence a um parlamentar. O build SSR inclui
 * somente os 120 registros mais recentes; todo o histórico continua consultável.
 * Executar APENAS no Actions antes de build:ghpages.
 */
import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { gzipSync } from "node:zlib";
import { prisma } from "../lib/prisma";

const folder = path.join(process.cwd(), "public", "data", "historico");
const maxTotal = 600 * 1024 * 1024; // reserve room for HTML/assets under Pages 1 GiB
let totalBytes = 0;
let totalProfiles = 0;
let totalVotes = 0;
let totalAttendance = 0;

async function main() {
  await rm(folder, { recursive: true, force: true });
  await mkdir(folder, { recursive: true });
  const people = await prisma.parlamentar.findMany({ select: { id: true }, orderBy: { id: "asc" } });
  for (const { id } of people) {
    if (!/^[a-zA-Z0-9_-]{1,128}$/.test(id)) throw new Error("ID parlamentar inseguro");
    const [votes, attendance] = await Promise.all([
      prisma.voto.findMany({
        where: { parlamentarId: id },
        orderBy: [{ votacao: { dataHora: "desc" } }, { id: "asc" }],
        include: { votacao: { include: { proposicao: true } } },
      }),
      prisma.presenca.findMany({
        where: { parlamentarId: id },
        orderBy: [{ dataSessao: "desc" }, { id: "asc" }],
      }),
    ]);
    const votos = votes.map(v => ({
      id: v.id, opcao: v.opcao, opcaoOriginal: v.opcaoOriginal,
      registradoEm: v.registradoEm?.toISOString() ?? null,
      partidoNaEpoca: v.partidoNaEpoca, ufNaEpoca: v.ufNaEpoca,
      votacao: {
        id: v.votacao.id, descricao: v.votacao.descricao,
        dataHora: v.votacao.dataHora.toISOString(), aprovada: v.votacao.aprovada,
        placarSim: v.votacao.placarSim, placarNao: v.votacao.placarNao,
        proposicao: v.votacao.proposicao ? {
          id: v.votacao.proposicao.id, siglaTipo: v.votacao.proposicao.siglaTipo,
          numero: v.votacao.proposicao.numero, ano: v.votacao.proposicao.ano,
          ementa: v.votacao.proposicao.ementa,
        } : null,
      },
    }));
    const presencas = attendance.map(p => ({
      id: p.id, sessaoExternalId: p.sessaoExternalId,
      dataSessao: p.dataSessao.toISOString(), tituloSessao: p.tituloSessao,
      status: p.status, justificativa: p.justificativa, fonteUrl: p.fonteUrl,
      origem: p.origem, cobertura: p.cobertura,
    }));
    if (!votos.length && !presencas.length) continue;
    const compressed = gzipSync(JSON.stringify({ version: 1, id, votos, presencas }), { level: 6 });
    totalBytes += compressed.byteLength;
    if (totalBytes > maxTotal) throw new Error("Históricos excederam 600 MiB: dividir exportações antes do deploy");
    await writeFile(path.join(folder, id + ".json.gz"), compressed);
    totalProfiles++;
    totalVotes += votos.length;
    totalAttendance += presencas.length;
  }
  console.log(JSON.stringify({
    state: "history_archive_ready", profiles: totalProfiles,
    votes: totalVotes, attendance: totalAttendance, bytes: totalBytes,
  }));
}

main().catch(error => { console.error(error); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
