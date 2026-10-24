import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const read = (path: string) => readFileSync(path, "utf8");

test("máscara vetorial de pincelada é leve e cobre botões e campos", () => {
  const svg = read("public/assets/collage/brush-stroke.svg");
  const css = read("app/globals.css");
  assert.match(svg, /viewBox="0 0 1000 240"/);
  assert.doesNotMatch(svg, /feTurbulence|feGaussianBlur|<animate/);
  assert.match(css, /--ruido-brush-mask: url\('\/assets\/collage\/brush-stroke\.svg'\)/);
  assert.match(css, /mask-image: var\(--ruido-brush-mask\) !important/);
  assert.match(css, /input:not\(\[type="checkbox"\]\)/);
  assert.match(css, /ruido-action/);
  const paint = css.slice(css.indexOf(".ruido-nav :is(a.ruido-nav-link,button.ruido-nav-toggle)"));
  assert.match(paint, /\.ruido-nav :is\(a\.ruido-nav-link,button\.ruido-nav-toggle\)/);
  assert.match(paint, /\.ruido-site-content :is\(a\.ruido-action,button\.ruido-action/);
  assert.match(paint, /background: transparent !important/);
  assert.match(paint, /::before/);
  assert.match(paint, /-webkit-mask-image: var\(--ruido-brush-mask\)/);
  assert.match(paint, /-webkit-mask-image: none !important/);
});

test("manifesto ocupa a parede inteira de /sobre sem substituir mural da home", () => {
  const css = read("app/globals.css");
  const sobre = read("app/sobre/page.tsx");
  const home = read("app/page.tsx");
  const newCss = css.slice(css.indexOf("body.collage-body:has(.ruido-manifesto-page)::before"));
  assert.match(sobre, /ruido-manifesto-page space-y-12/);
  assert.match(newCss, /body\.collage-body:has\(\.ruido-manifesto-page\)::before/);
  assert.match(newCss, /background-size: cover, cover/);
  assert.match(newCss, /url\('\/assets\/collage\/manifesto-bg\.jpg'\)/);
  assert.match(newCss, /\.ruido-red-poster\.ruido-manifesto-poster/);
  assert.match(newCss, /\.ruido-home-manifesto\s*\{/);
  assert.match(home, /ruido-home-stage/);
  assert.match(css, /url\('\/assets\/collage\/ruido-mural-original\.jpg'\)/);
});

test("ticker desliza em dois segmentos e reduz movimento quando solicitado", () => {
  const layout = read("app/layout.tsx");
  const css = read("app/globals.css");
  assert.match(layout, /ruido-marquee-band/);
  assert.match(layout, /\[0, 1\]\.map/);
  assert.match(css, /@keyframes ruido-bandeira/);
  assert.match(css, /prefers-reduced-motion: reduce/);
  const navbar = read("components/Navbar.tsx");
  assert.match(navbar, /\{ href: "\/sobre", label: "MANIFESTO" \}/);
  assert.doesNotMatch(navbar, /\{ href: "\/sobre", label: "SOBRE" \}/);
  assert.equal((navbar.match(/"ruido-nav-brush"/g) || []).length, 2);
  const paintedNav = css.slice(css.indexOf(".ruido-nav a.ruido-nav-brush {\n  --ruido-ink-fill: #f8f0df;"));
  assert.match(paintedNav, /\.ruido-nav a\.ruido-nav-brush::before/);
  assert.match(paintedNav, /-webkit-mask: var\(--ruido-brush-mask\)/);
  assert.match(paintedNav, /--ruido-ink-fill: #f8f0df/);
  assert.match(paintedNav, /--ruido-ink-fill: #ac2c24/);
  assert.match(paintedNav, /--ruido-ink-fill: #d3ff20/);
});

test("menu hambúrguer atende celular e tablet sem quebrar a linha no desktop", () => {
  const css = read("app/globals.css");
  const nav = read("components/Navbar.tsx");
  assert.match(nav, /className="ruido-nav-toggle inline-flex shrink-0 items-center gap-2 xl:hidden"/);
  assert.match(nav, /className="hidden shrink-0 items-center gap-1\.5 xl:flex"/);
  assert.match(nav, /ruido-mobile-menu pb-4 xl:hidden/);
  assert.match(nav, /aria-expanded=\{menuAberto\}/);
  const mobileCss = css;
  assert.match(mobileCss, /@media \(max-width: 1279px\)/);
  assert.match(mobileCss, /ruido-menu-mobile\.is-open/);
  assert.match(mobileCss, /@media \(min-width: 1280px\)/);
  assert.match(mobileCss, /flex-wrap: nowrap !important/);
  assert.match(mobileCss, /overflow-x: clip/);
  assert.match(mobileCss, /ruido-marquee-band/);
});

test("caveira é uma impressão em papel sem halo, e letras do título são acessíveis", () => {
  const css = read("app/globals.css");
  const home = read("app/page.tsx");
  const politicians = read("components/ParlamentaresFilterView.tsx");
  const newCss = css.slice(css.indexOf("body.collage-body:has(.ruido-manifesto-page)::before"));
  assert.match(home, /ruido-skull-paper/);
  assert.match(home, /ruido-skull-cutout/);
  assert.match(newCss, /\.ruido-skull-cutout img/);
  assert.match(newCss, /filter: none !important/);
  assert.match(politicians, /aria-label="DOSSIÊ DOS PARLAMENTARES"/);
  assert.match(politicians, /data-cor=\{\(offset \+ indiceLetra\) % 3\}/);
  assert.match(newCss, /ruido-politicos-letra\[data-cor="2"\]/);
  assert.match(newCss, /ruido-politicos-subtitulo/);
});
