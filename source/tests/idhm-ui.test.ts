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
test("mapa prioriza IDHM, mantém evolução anual e indicadores oficiais",()=>{
  assert.match(map,/EVOLUÇÃO DO IDHM|EVOLUÇÃO/);
  assert.match(map,/useState<VisibleMedida>\("idhm"\)/);
  assert.match(map,/ruido-map-zine__guide--atlas/);
  assert.match(map,/MAPA TEMÁTICO/);
  assert.match(map,/pibPerCapita:\{titulo:"PIB POR HABITANTE"/);
  assert.match(pipeline,/collect-idhm\.py/);
});
