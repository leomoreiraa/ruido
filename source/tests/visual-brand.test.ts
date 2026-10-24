import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read=(p: string)=>readFileSync(p,"utf8");
test("three original artwork assets are WebP, no generated PNG dependency",()=>{
  for(const name of ["ruido-hero","ruido-proposito","ruido-como-funciona"]){
    const file=readFileSync("public/assets/"+name+".webp");
    assert.equal(file.subarray(0,4).toString(),"RIFF");
    assert.equal(file.subarray(8,12).toString(),"WEBP");
    assert.ok(file.length<200000,"WebP too large "+name);
    assert.match(read("README.md"),new RegExp(name+"\\.webp"));
  }
});
test("skull remains the mascot and favicon across site and map; deputy punk face remains",()=>{
  const icon=read("app/icon.svg");
  const skull=read("public/assets/skull-xerox.svg");
  const layout=read("app/layout.tsx");
  const navbar=read("components/Navbar.tsx");
  const mugshot=read("components/PoliticianPhoto.tsx");
  assert.match(icon,/Caveira punk RUÍDO/);
  assert.match(icon,/#e42232/);
  assert.match(skull,/<svg/);
  assert.match(navbar,/skull-xerox\.svg/);
  assert.match(layout,/skull-xerox\.svg/);
  assert.match(layout,/shortcut: "\/icon\.svg"/);
  assert.match(mugshot,/punk-target-white\.png/);
  assert.match(mugshot,/target-stamp/);
  assert.match(read("scripts/publish-idhm-map.py"),/brand-skull/);
});
test("visual changes preserve map legend, regional IDHM and source information",()=>{
  const map=read("components/MapaBrasilView.tsx");
  assert.match(map,/MENOR/);assert.match(map,/MAIOR/);
  assert.match(map,/IDHM • DESENVOLVIMENTO HUMANO/);
  assert.match(read("scripts/publish-idhm-map.py"),/Legenda de cores do mapa/);
});
test("a única publicação usa export atualizado e verifica CSS da navbar",()=>{
  const wf=read(".github/workflows/deploy-visual-fast.yml");
  assert.ok(wf.includes("actions/download-artifact@v4"));
  assert.ok(wf.includes("scripts/audit-public-export.py"));
  assert.ok(!wf.includes("actions/deploy-pages@v4"));
  assert.ok(wf.includes("ruido-nav-brush"));
  assert.ok(wf.includes("build-info.json"));
  assert.ok(!wf.includes("patch-static-visuals.py"));
});

test("menu desktop e mobile compartilham tinta vetorial, não abas de papel",()=>{
  const css=read("app/globals.css");
  const nav=read("components/Navbar.tsx");
  const brush=css.slice(css.indexOf(".ruido-nav a.ruido-nav-brush::before"));
  assert.ok(brush.includes("mask: url('/assets/collage/brush-stroke.svg')"));
  assert.ok(brush.includes("background: transparent !important;"));
  assert.ok(brush.includes("display: block !important;"));
  assert.ok(nav.includes('"ruido-nav-brush"'));
  assert.ok(nav.includes('navLinks.map'));
});
test("dossiê usa apenas um papel por seção e avisos planos",()=>{
  const dossier=read("components/DossieFinanceiroNoticias.tsx");
  const css=read("app/globals.css");
  assert.ok(dossier.includes("ruido-dossie-section"));
  assert.ok(dossier.includes("ruido-empty-inline"));
  assert.ok(!dossier.includes("ruido-paper-card"));
  assert.ok(css.includes(".ruido-dossie-section .ruido-dossie-row"));
});
