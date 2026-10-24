import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const source = (file: string) => readFileSync(file, "utf8");

test("títulos grandes de proposições nunca são recortados pela máscara de tinta", () => {
  const css = source("app/globals.css");
  const filters = source("components/PautasFilterView.tsx");
  const vote = source("components/VotacaoItem.tsx");
  const current = css.slice(css.lastIndexOf("RUÍDO / TIPOGRAFIA SEM CORTES + FILTROS"));
  assert.match(filters, /ruido-legible-prop-title/);
  assert.match(filters, /className="ruido-proposition-text-link"/);
  assert.match(vote, /ruido-legible-vote-title/);
  assert.match(vote, /className="ruido-proposition-text-link"/);
  assert.match(current, /h3\.ruido-legible-prop-title/);
  assert.match(current, /line-height: 1\.3 !important/);
  assert.match(current, /overflow: visible !important/);
  assert.match(current, /-webkit-mask: none !important/);
  assert.match(current, /mask: none !important/);
  assert.match(current, /a\.ruido-proposition-text-link/);
  assert.match(current, /::after \{/);
  assert.match(current, /a\.ruido-proposition-text-link:focus-visible/);
  assert.doesNotMatch(current, /-webkit-line-clamp/);
});

test("os painéis de busca e seleção recebem pincelada apenas atrás dos rótulos", () => {
  const css = source("app/globals.css");
  const pautas = source("components/PautasFilterView.tsx");
  const políticos = source("components/ParlamentaresFilterView.tsx");
  const emendas = source("components/EmendasTrackerView.tsx");
  const mapa = source("components/MapaBrasilView.tsx");
  const current = css.slice(css.lastIndexOf("RUÍDO / TIPOGRAFIA SEM CORTES + FILTROS"));
  for (const page of [pautas, políticos]) {
    assert.match(page, /ruido-filter-ink-panel/);
    assert.match(page, /ruido-filter-ink-header/);
    assert.match(page, /ruido-filter-ink-form/);
  }
  assert.match(emendas, /ruido-filter-ink-panel/);
  assert.match(emendas, /ruido-filter-ink-form/);
  assert.match(mapa, /ruido-filter-ink-panel/);
  assert.match(mapa, /ruido-filter-ink-form/);
  assert.match(current, /\.ruido-filter-ink-header > span:first-child::before/);
  assert.match(current, /\.ruido-filter-ink-form label::before/);
  assert.match(current, /mask: var\(--ruido-brush-mask\)/);
  assert.match(current, /background-color: #fff8eb !important/);
  assert.match(current, /\.mapa-brasil \.ruido-filter-ink-form select/);
});

test("links de títulos estão excluídos da máscara universal de links", () => {
  const css = source("app/globals.css");
  const paintLinks = css.slice(css.lastIndexOf("RUÍDO / LEITURA E TINTA — MAPA"),css.lastIndexOf("RUÍDO / TIPOGRAFIA SEM CORTES + FILTROS"));
  assert.match(paintLinks, /:not\(\.ruido-proposition-text-link\)/);
  assert.match(paintLinks, /:not\(\.ruido-unmasked-text-link\)/);
  const current = css.slice(css.lastIndexOf("RUÍDO / TIPOGRAFIA SEM CORTES + FILTROS"));
  assert.match(current, /\.ruido-paper-card :is\(h2,h3\) > a:not\(\.btn-punk\)/);
  assert.match(current, /overflow-wrap: anywhere/);
});
