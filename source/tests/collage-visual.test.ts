import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";

const source = (path: string) => readFileSync(path, "utf8");

test("hero não renderiza o cartaz redundante do RUÍDO", () => {
  const homepage = source("app/page.tsx");
  assert.doesNotMatch(homepage, /ruido-hero\.webp/);
  assert.doesNotMatch(homepage, /<figure className="collage-poster"/);
  assert.match(homepage, /<HomeInstantSearch /);
  assert.match(homepage, /totalVotacoes/);
});

test("colagem reutiliza texturas locais e estiliza fichas sem alterar dados", () => {
  const css = source("app/globals.css");
  for (const asset of ["papel-fibra.jpg", "grime.png"]) {
    assert.ok(css.includes("/assets/" + asset), "Textura local ausente: " + asset);
  }
  assert.match(css, /\.ruido-site-content \.ruido-paper-card:is\(/);
  assert.match(css, /\.politician-mugshot::after/);
  assert.match(css, /pointer-events:\s*none/);
  for (const path of [
    "components/ui/card.tsx",
    "components/ui/DossierCard.tsx",
    "components/ParlamentarCard.tsx",
  ]) {
    assert.match(source(path), /ruido-paper-card/, "Falta a classe de recorte em " + path);
  }
});


test("identidade editorial alcança páginas, componentes e painéis principais", () => {
  const examples = [
    "app/cobertura/page.tsx",
    "app/parlamentares/[id]/page.tsx",
    "app/pautas/[id]/page.tsx",
    "app/sobre/page.tsx",
    "components/EmendasTrackerView.tsx",
    "components/GraficoVotos.tsx",
    "components/MapaBrasilView.tsx",
    "components/ParlamentarHistoricoTabs.tsx",
    "components/ParlamentaresFilterView.tsx",
    "components/PautasFilterView.tsx",
    "components/PerfilIADiscursos.tsx",
    "components/VotacaoItem.tsx"
  ];
  for (const path of examples) {
    assert.match(source(path), /ruido-paper-card|ruido-ink-poster|ruido-red-poster/,
      "Falta tratamento editorial na página ou componente: " + path);
  }
  const css = source("app/globals.css");
  assert.match(css, /\.ruido-site-content \.ruido-map-frame/);
  assert.match(css, /\.ruido-site-content table/);
  assert.match(css, /prefers-reduced-motion:\s*reduce/);
});

test("cartazes estáticos grandes são removidos sem afetar os heros funcionais", () => {
  assert.doesNotMatch(source("app/page.tsx"), /ruido-hero\.webp/);
  assert.doesNotMatch(source("app/sobre/page.tsx"), /ruido-proposito\.webp/);
  assert.doesNotMatch(source("app/cobertura/page.tsx"), /ruido-como-funciona\.webp/);
  assert.match(source("app/page.tsx"), /ruido-hero-wall/);
  assert.match(source("app/sobre/page.tsx"), /ruido-red-poster/);
  assert.match(source("components/MapaBrasilView.tsx"), /<svg viewBox/);
});

test("etiquetas, botoes e ficharios usam classes reutilizaveis", () => {
  for (const [path, marker] of [
    ["components/ui/badge.tsx", "ruido-label-cutout"],
    ["components/ui/button.tsx", "ruido-press-cutout"],
    ["components/ui/input.tsx", "ruido-input-cutout"],
    ["components/ui/table.tsx", "ruido-table-wrap"],
  ] as const) {
    assert.ok(source(path).includes(marker), path + ": classe ausente");
    assert.ok(source("app/globals.css").includes(marker), path + ": falta estilo CSS");
  }
});


test("identidade atual usa folhas físicas, fita e moldura fotográfica de verdade", () => {
  const css = source("app/globals.css");
  for (const asset of ["frame-photo.webp", "tape-paper.webp", "label-acid.svg", "home-wall.svg"]) {
    assert.ok(css.includes("/assets/collage/" + asset));
    assert.ok(existsSync("public/assets/collage/" + asset), "Asset ausente: " + asset);
  }
  for (const paper of ["ripped-paper-white-05.png", "ripped-paper-vintage-25.png", "ripped-paper-newsprint-50.png", "textured-paper.png"]) {
    assert.ok(css.includes("/assets/" + paper));
    assert.ok(existsSync("public/assets/" + paper), "Papel ausente: " + paper);
  }
  assert.match(css, /border-image-source: var\(--ruido-frame-photo\)/);
  assert.match(css, /clip-path: none/);
});


test("molduras físicas são WebP com transparência e não dependem de URLs externas", () => {
  for (const asset of ["frame-paper.webp", "frame-grunge.webp", "frame-photo.webp", "tape-paper.webp"]) {
    const bytes = readFileSync("public/assets/collage/" + asset);
    assert.equal(bytes.toString("ascii", 0, 4), "RIFF", asset);
    assert.equal(bytes.toString("ascii", 8, 12), "WEBP", asset);
  }
});


test("cartões usam papel integral digitalizado, com fibras e silhueta verde-neon", () => {
  const css = source("app/globals.css");
  assert.match(css, /ripped-paper-white-05\.png/);
  assert.match(css, /ripped-paper-vintage-25\.png/);
  assert.match(css, /ripped-paper-newsprint-50\.png/);
  assert.match(css, /textured-paper\.png/);
  assert.match(css, /drop-shadow\(10px 11px 0 var\(--ruido-neon\)\)/);
  assert.match(css, /mask-image: var\(--ruido-card-sheet\)/);
  assert.match(css, /filter: drop-shadow\(4px 5px 0 var\(--ruido-neon\)\)/);
  assert.doesNotMatch(css.slice(css.lastIndexOf("RUÍDO / ZINE MATERIAL")), /border-image-source:\s*var\(--ruido-frame-paper\)/);
});

test("a página inicial aplica fundo gráfico de colagem sem dados artificiais", () => {
  const home = source("app/page.tsx");
  const css = source("app/globals.css");
  const wall = source("public/assets/collage/home-wall.svg");
  assert.match(home, /ruido-home-stage space-y-10/);
  assert.match(css, /url\('\/assets\/collage\/home-wall\.svg'\)/);
  assert.match(css, /url\('\/assets\/grunge-wall\.png'\)/);
  assert.match(css, /body\.collage-body:has\(\.ruido-home-stage\)/);
  assert.match(wall, /<svg/);
  assert.match(wall, /#d3ff20/);
  assert.doesNotMatch(wall, /<text\b/);
  assert.match(source("components/ParlamentarCard.tsx"), /ruido-card-tape/);
});


test("a arte revolucionaria gerada realmente existe no repositorio e é WebP", () => {
  const image = readFileSync("public/assets/collage/revolutionary-wall.webp");
  assert.equal(image.toString("ascii", 0, 4), "RIFF");
  assert.equal(image.toString("ascii", 8, 12), "WEBP");
  assert.ok(image.byteLength > 8000 && image.byteLength < 200000);
  const css = source("app/globals.css");
  assert.match(css, /url\('\/assets\/collage\/ruido-mural-original\.jpg'\)/);
  assert.match(css, /body\.collage-body:has\(\.ruido-home-stage\)/);
});

test("o papel tem somente uma folha e contorno neon acompanha seus rasgos", () => {
  const css = source("app/globals.css");
  const current = css.slice(css.lastIndexOf("RUÍDO / MURO DE SÃO PAULO"));
  assert.match(current, /--ruido-torn-edge: polygon\(/);
  assert.match(current, /background-color: var\(--ruido-paper-tone\)/);
  assert.match(current, /url\('\/assets\/textured-paper\.png'\)/);
  assert.match(current, /clip-path: var\(--ruido-torn-edge\) !important/g);
  assert.match(current, /::after\s*\{[\s\S]*?content: "" !important/);
  assert.match(current, /::after\s*\{[\s\S]*?background: var\(--ruido-neon\) !important/);
  assert.match(current, /::before\s*\{[\s\S]*?inset: -9px -12px/);
  assert.match(current, /::after\s*\{[\s\S]*?inset: -14px -17px/);
  assert.match(current, /mask-image: none !important/);
  assert.match(current, /overflow-wrap: anywhere/);
  assert.doesNotMatch(current, /background:\s*var\(--ruido-card-sheet\) center \/ 100% 100% no-repeat/);
  for (const file of ["components/ParlamentarCard.tsx", "components/VotacaoItem.tsx"]) {
    assert.match(source(file), /ruido-paper-card/);
  }
});

test("caveira com contorno fluorescente no favicon e em todas as aparicoes", () => {
  for (const path of ["public/assets/skull-xerox.svg", "app/icon.svg", "public/icon.svg", "public/favicon.svg"]) {
    const svg = source(path);
    assert.match(svg, /stroke="#d3ff20"/);
    assert.match(svg, /C103 548 64 455/);
  }
  assert.match(source("app/globals.css"), /\.collage-footer-mascot/);
  assert.match(source("app/globals.css"), /\.collage-mascot/);
});

test("votação e parlamentar mantêm a altura variável e um único papel", () => {
  const css = source("app/globals.css");
  const current = css.slice(css.lastIndexOf("RUÍDO / MURO DE SÃO PAULO"));
  assert.match(source("components/VotacaoItem.tsx"), /ruido-paper-card ruido-votacao-folha/);
  assert.match(source("components/ParlamentarCard.tsx"), /ruido-paper-card ruido-parlamentar-folha/);
  assert.match(current, /max-width: 100%/);
  assert.match(current, /min-height: 0/);
  assert.match(current, /padding: clamp\(2\.4rem, 3\.2vw, 3\.2rem\) !important/);
  assert.match(current, /--ruido-paper-tone: var\(--ruido-paper-light\)/);
  assert.match(current, /--ruido-paper-tone: var\(--ruido-paper-muted\)/);
  assert.match(current, /z-index: -2/);
  assert.match(current, /z-index: -1/);
});

test("o mural original é exclusivo da home; as internas usam cimento", () => {
  const jpg = readFileSync("public/assets/collage/ruido-mural-original.jpg");
  assert.equal(jpg[0], 0xff);
  assert.equal(jpg[1], 0xd8);
  assert.ok(jpg.byteLength >= 600_000, "Preservar a arte original sem compressão agressiva");
  const cimento = source("public/assets/collage/cement-wall.svg");
  assert.match(cimento, /feTurbulence/);
  assert.match(cimento, /filter="url\(#concrete-grain\)"/);
  assert.doesNotMatch(cimento, /ruido-mural-original/);
  const css = source("app/globals.css");
  const backgrounds = css.slice(css.lastIndexOf("FUNDOS POR ROTA — HOME: COLAGEM"));
  assert.match(backgrounds, /body\.collage-body:not\(:has\(\.ruido-home-stage\)\)/);
  assert.match(backgrounds, /body\.collage-body:has\(\.ruido-home-stage\)/);
  assert.match(backgrounds, /url\('\/assets\/collage\/cement-wall\.svg'\)/);
  assert.match(backgrounds, /url\('\/assets\/collage\/ruido-mural-original\.jpg'\)/);
  assert.match(backgrounds, /background-repeat: no-repeat, repeat/);
  assert.match(backgrounds, /background-repeat: no-repeat, no-repeat/);
  assert.match(backgrounds, /background-attachment: fixed, fixed/);
  const homeRule = backgrounds.slice(backgrounds.indexOf("body.collage-body:has(.ruido-home-stage) {"));
  assert.doesNotMatch(homeRule, /cement-wall\.svg/);
});

test("paleta usa tinta, papel e verdes do mural; dados sem cores artificiais novas", () => {
  const css = source("app/globals.css");
  const tailwind = source("tailwind.config.ts");
  assert.match(css, /--ruido-neon: #d3ff20/);
  assert.match(css, /--ruido-rust: #ac2c24/);
  assert.match(css, /--ruido-paper: #eee4d1/);
  assert.match(tailwind, /red: "#ac2c24"/);
  assert.match(tailwind, /acid: "#d3ff20"/);
  assert.match(tailwind, /card: "#f0e6d4"/);
  assert.match(css, /\.ruido-votacao-folha \.bg-green-100/);
  assert.match(css, /\.ruido-votacao-folha \.bg-red-100/);
});


test("cartões punk usam fibra, papel rasgado e uma silhueta verde sólida", () => {
  const css = source("app/globals.css");
  const current = css.slice(css.lastIndexOf("RUÍDO / XEROX & LAMBE-LAMBE"));
  assert.match(current, /--zine-stroke: polygon\(/);
  assert.match(current, /::before\s*\{[\s\S]*?background-color: var\(--ruido-paper-tone\) !important/);
  assert.match(current, /::before\s*\{[\s\S]*?url\('\/assets\/textured-paper\.png'\)/);
  assert.match(current, /::after\s*\{[\s\S]*?background: var\(--zine-acid\) !important/);
  assert.match(current, /::after\s*\{[\s\S]*?clip-path: var\(--zine-stroke\) !important/);
  assert.match(current, /::after\s*\{[\s\S]*?filter: none !important/);
  assert.match(current, /margin-block: 2\.7rem/);
  assert.match(current, /min-height: 0/);
  assert.match(current, /max-width: 100%/);
  assert.match(current, /\.ruido-home-search::before/);
  assert.match(current, /var\(--marker\)/);
});

test("home compacta preserva consulta, fontes e componentes funcionais", () => {
  const home = source("app/page.tsx");
  const search = source("components/HomeInstantSearch.tsx");
  const nav = source("components/Navbar.tsx");
  const layout = source("app/layout.tsx");
  assert.match(home, /POLÍTICA SOB LUPA/);
  assert.match(home, /<HomeInstantSearch/);
  assert.match(home, /VOTAÇÕES ↗/);
  assert.match(home, /EMENDAS \(\{totalEmendas\}\)/);
  assert.doesNotMatch(home, /AUDITORIA CÍVICA INDEPENDENTE SEM INTERMEDIÁRIOS/i);
  assert.match(search, /Nome, partido ou UF/);
  assert.match(nav, /aria-expanded=\{menuAberto\}/);
  assert.match(nav, /aria-current=\{isActive \? "page" : undefined\}/);
  assert.match(layout, /ruido-status-strip/);
  assert.doesNotMatch(layout, /running-ticker/);
});

test("páginas internas, menu e botões preservam tipografia e tinta punk", () => {
  const css = source("app/globals.css");
  const button = source("components/ui/button.tsx");
  const badge = source("components/ui/badge.tsx");
  const current = css.slice(css.lastIndexOf("RUÍDO / XEROX & LAMBE-LAMBE"));
  assert.match(button, /ruido-press-cutout ruido-flat-button/);
  assert.match(badge, /ruido-label-cutout/);
  assert.match(current, /--zine-ink-cut: polygon/);
  assert.match(current, /\.ruido-nav-link/);
  assert.match(current, /\.ruido-site-content :is\(\.btn-punk,\.ruido-press-cutout,\.ruido-action\)/);
  assert.match(current, /url\('\/assets\/grime\.png'\)/);
  assert.match(current, /\.ruido-site-content :is\(\.collage-rail,\.newspaper-clip\)/);
  assert.match(current, /\.ruido-site-content table th/);
  assert.match(current, /\.ruido-site-content :is\(input,select,textarea\)/);
  assert.match(current, /:is\(\.ruido-map-frame,\.ruido-poster-cutout\)/);
});


test("imagem enviada pelo usuário aparece apenas no manifesto", () => {
  const manifesto=readFileSync("public/assets/collage/manifesto-bg.jpg");
  const home=readFileSync("public/assets/collage/ruido-mural-original.jpg");
  assert.equal(manifesto[0],0xff);
  assert.equal(manifesto[1],0xd8);
  assert.equal(manifesto.byteLength,458901,"Não recomprimir nem substituir a foto fornecida");
  assert.ok(home.byteLength>=600000,"Mural original precisa permanecer intacto");
  const css=source("app/globals.css");
  const manifestoCss=css.slice(css.lastIndexOf("RUÍDO / MANIFESTO FOTOGRÁFICO"), css.lastIndexOf("RUÍDO / RENDERIZAÇÃO LEVE (2026)"));
  const homeCss=css.slice(css.lastIndexOf("FUNDOS POR ROTA — HOME: COLAGEM"),css.lastIndexOf("RUÍDO / MANIFESTO FOTOGRÁFICO"));
  assert.match(manifestoCss,/\.ruido-site-content \.ruido-home-manifesto \{/);
  assert.match(manifestoCss,/url\('\/assets\/collage\/manifesto-bg\.jpg'\)/);
  assert.match(manifestoCss,/background-size: cover, cover !important/);
  assert.match(manifestoCss,/background: #171512/);
  assert.doesNotMatch(manifestoCss,/body\.collage-body:has\(\.ruido-home-stage\)/);
  assert.match(homeCss,/url\('\/assets\/collage\/ruido-mural-original\.jpg'\)/);
  assert.match(homeCss,/url\('\/assets\/collage\/cement-wall\.svg'\)/);
});


test("mural da home mantém resolução original no tamanho da viewport", () => {
  const css = source("app/globals.css");
  const current = css.slice(css.lastIndexOf("RESTAURAÇÕES VISUAIS / FUNDO NÍTIDO"));
  assert.match(current, /body\.collage-body:has\(\.ruido-home-stage\)/);
  assert.match(current, /url\('\/assets\/collage\/ruido-mural-original\.jpg'\) !important/);
  assert.match(current, /background-size: cover, cover !important/);
  assert.match(current, /background-attachment: fixed, fixed !important/);
  const android = css.slice(css.lastIndexOf("Garantia Android/Chrome:"));
  assert.match(android, /body\.collage-body:has\(\.ruido-home-stage\)::before/);
  assert.match(android, /position: fixed/);
  assert.match(android, /background-size: cover, cover/);
  assert.match(android, /url\('\/assets\/collage\/ruido-mural-original\.jpg'\)/);
  assert.doesNotMatch(current, /url\('\/assets\/collage\/cement-wall\.svg'\)/);
});

test("fotografia do manifesto também aparece no cartaz da rota Sobre", () => {
  const css = source("app/globals.css");
  const about = source("app/sobre/page.tsx");
  const current = css.slice(css.lastIndexOf("RESTAURAÇÕES VISUAIS / FUNDO NÍTIDO"));
  assert.match(about, /ruido-red-poster ruido-manifesto-poster/);
  assert.match(about, /ruido-manifesto-copy/);
  assert.match(current, /\.ruido-site-content \.ruido-red-poster\.ruido-manifesto-poster/);
  assert.match(current, /url\('\/assets\/collage\/manifesto-bg\.jpg'\) !important/);
  assert.match(current, /background-size: cover, cover !important/);
  assert.match(current, /\.ruido-manifesto-copy/);
});

test("hover vermelho e estêncil de rosto funcionam com mouse, toque e teclado", () => {
  const css = source("app/globals.css");
  const photo = source("components/PoliticianPhoto.tsx");
  const current = css.slice(css.lastIndexOf("RESTAURAÇÕES VISUAIS / FUNDO NÍTIDO"));
  assert.match(photo, /data-photo-active=\{efeitoAtivo \? "true" : "false"\}/);
  assert.match(photo, /aria-pressed=\{efeitoAtivo\}/);
  assert.match(photo, /src="\/assets\/punk-target-white\.png"/);
  assert.match(current, /\.politician-mugshot \.target-red-layer \{\s*display: block !important/);
  assert.match(current, /\.politician-mugshot \.target-stamp \{\s*display: flex !important/);
  assert.match(current, /\.politician-mugshot\[data-photo-active="true"\] \.target-red-layer/);
  assert.match(current, /\.politician-mugshot\[data-photo-active="true"\] \.target-stamp/);
});
