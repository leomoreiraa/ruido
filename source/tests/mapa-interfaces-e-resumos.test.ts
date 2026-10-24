import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const source=(p:string)=>readFileSync(p,"utf8");

test("mapa do Brasil preserva fundo cinza e cores sem confundir regiões",()=>{
  const map=source("components/MapaBrasilView.tsx");
  const css=source("app/globals.css");
  const next=css.slice(css.indexOf(".mapa-brasil .ruido-map-frame"));
  assert.match(map,/ruido-map-frame bg-\[#424943\]/);
  assert.match(map,/ruido-map-canvas/);
  assert.match(next,/\.mapa-brasil \.ruido-map-frame\s*\{/);
  assert.match(next,/background-color: #444b46 !important/);
  assert.match(next,/\.mapa-brasil \.ruido-map-canvas\s*\{/);
  assert.match(next,/background-color: #4f5651 !important/);
  assert.match(map,/if\(s\.uf===uf\)return "#e42232"/);
});
test("cards textuais ganharam pequena superfície editorial de leitura",()=>{
  const css=source("app/globals.css");
  const next=css.slice(css.indexOf(".mapa-brasil .ruido-map-frame"));
  assert.match(next,/\.ruido-paper-card p\.font-mono/);
  assert.match(next,/background-color: rgba\(251,247,238,\.94\)/);
  assert.match(next,/\[aria-labelledby="cidadao-title"\]/);
  assert.match(next,/\[aria-labelledby="juridico-title"\]/);
  assert.match(css,/--zine-stroke: polygon/);
});
test("rótulos públicos usam RESUMO e mantêm atribuição transparente da IA",()=>{
  const page=source("app/pautas/[id]/page.tsx");
  const list=source("components/PautasFilterView.tsx");
  assert.match(page,/RESUMO <span className="text-punk-red">DO PROJETO<\/span>/);
  assert.match(page,/Resumo gerado com auxílio de IA/);
  assert.match(list,/RESUMO • GERADO COM AUXÍLIO DE IA/);
  assert.doesNotMatch(page,/explicação simplificada/i);
  assert.doesNotMatch(list,/Explicação em linguagem simples/i);
});
test("links e botões são tinta mas cards inteiros não são mascarados",()=>{
  const css=source("app/globals.css");
  const next=css.slice(css.indexOf(".mapa-brasil .ruido-map-frame"));
  assert.match(next,/\.ruido-site-content a:not\(:has\(img\)\)/);
  assert.match(next,/footer a:not\(:has\(img\)\)/);
  assert.match(next,/-webkit-mask: var\(--ruido-brush-mask\)/);
  assert.match(next,/a:has\(\.ruido-paper-card\)/);
  assert.match(next,/a\.ruido-search-result/);
  assert.match(next,/focus-visible/);
});
