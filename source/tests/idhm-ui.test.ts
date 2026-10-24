import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const graph=readFileSync("components/GraficoVotos.tsx","utf8");
const map=readFileSync("components/MapaBrasilView.tsx","utf8");
const pipeline=readFileSync(".github/workflows/deploy-gh-pages.yml","utf8");
test("presenças incompletas não geram taxa falsa de 100%",()=>{
  assert.doesNotMatch(graph,/pctPresente|pctJustificado|pctAusente/);
  assert.match(graph,/FREQUÊNCIA TOTAL: NÃO CALCULÁVEL/);
  assert.match(graph,/Não registrados ≠ ausentes/);
});
test("mapa prioriza IDHM, evolução anual e retira rótulo antigo",()=>{
  assert.match(map,/EVOLUÇÃO DO IDHM|EVOLUÇÃO/);
  assert.match(map,/useState<VisibleMedida>\("idhm"\)/);
  assert.doesNotMatch(map,/MAPA TEMÁTICO|PIB POR HABITANTE/);
  assert.match(pipeline,/collect-idhm\.py/);
});
