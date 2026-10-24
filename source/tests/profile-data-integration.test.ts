import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (file: string) => readFileSync(file, "utf8");

test("patrimonio TSE de JSON oficial chega à aba do perfil", () => {
  const page = read("app/parlamentares/[id]/page.tsx");
  const tabs = read("components/ParlamentarHistoricoTabs.tsx");
  const chart = read("components/GraficoPatrimonio.tsx");
  assert.match(page, /public\/data\/dossies\/patrimonio\.json/);
  assert.match(page, /totaisTse=\{totaisTse\}/);
  assert.match(tabs, /totaisTse=\{totaisTse\}/);
  assert.match(chart, /totaisTse\.length > 0/);
  assert.doesNotMatch(chart, /Ainda não há um importador verificado/);
});

test("frequência usa base oficial por sessões auditadas, não infere faltas", () => {
  const page = read("app/parlamentares/[id]/page.tsx");
  const graph = read("components/GraficoVotos.tsx");
  assert.match(page, /prisma\.frequenciaPlenario\.aggregate/);
  assert.match(graph, /frequenciaAuditada\?\.sessoes/);
  assert.match(graph, /não é taxa de assiduidade do mandato inteiro/);
  assert.match(graph, /coberturaRecorte/);
  assert.match(graph, /frequenciaAuditadaPercentual/);
});
