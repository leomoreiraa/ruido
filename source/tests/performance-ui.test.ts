import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = (path: string) => readFileSync(path, "utf8");

test("pautas nunca criam milhares de cards durante SSR/hidratação", () => {
  const page = source("app/pautas/page.tsx");
  const component = source("components/PautasFilterView.tsx");
  assert.match(page, /pautasIniciais=\{pautasIniciais\.slice\(0, 20\)\}/);
  assert.match(page, /totalRegistros=\{pautasIniciais\.length\}/);
  assert.match(component, /const ITENS_POR_PAGINA = 10/);
  assert.match(component, /pautasPaginadas\.map/);
  assert.doesNotMatch(component, /\{pautasFiltradas\.map/);
  assert.match(component, /new Worker\("\/workers\/pautas-search\.js"\)/);
  assert.doesNotMatch(component, /setCatalogo\(dados/);
  assert.match(component, /useDeferredValue\(busca\)/);
});

test("emendas preservam anos e totais sem serializar catálogo inteiro no HTML", () => {
  const page = source("app/emendas/page.tsx");
  const component = source("components/EmendasTrackerView.tsx");
  assert.match(page, /emendasIniciais=\{emendasSerializadas\.slice\(0, 25\)\}/);
  assert.match(page, /totalRegistros=\{emendasSerializadas\.length\}/);
  assert.match(page, /anosDisponiveis=\{/);
  assert.match(component, /fetch\("\/data\/emendas-index\.json"\)/);
  assert.match(component, /emendasPaginadas\.map/);
  assert.match(component, /useDeferredValue\(busca\)/);
});

test("catálogos são pré-computados antes do static export", () => {
  const build = source("scripts/build-ghpages.ts");
  const generator = source("scripts/build-browser-catalogs.ts");
  assert.ok(build.indexOf("scripts/build-browser-catalogs.ts") < build.indexOf("npx next build"));
  assert.match(build, /replaceAll\("\/data\/", base \+ "\/data\/"\)/);
  assert.match(generator, /"pautas-index\.json"/);
  assert.match(generator, /"emendas-index\.json"/);
});

test("papéis rasgados permanecem; rolagem não re-renderiza filtros fractais", () => {
  const css = source("app/globals.css");
  const otimizado = css.slice(css.indexOf(".grain-overlay",css.indexOf("--zine-stroke: polygon(")));
  assert.match(css, /ruido-mural-original\.jpg/);
  assert.match(css, /manifesto-bg\.jpg/);
  assert.match(css, /--zine-stroke: polygon/);
  assert.match(otimizado, /\.grain-overlay\s*\{/);
  assert.match(otimizado, /mix-blend-mode: normal !important/);
  assert.match(otimizado, /grunge-wall\.png/);
  assert.match(otimizado, /content-visibility: auto/);
});
