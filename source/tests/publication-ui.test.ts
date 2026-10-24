import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path: string) => readFileSync(path, "utf8");

test("menu remove apoio, mas preserva acesso pelo botão flutuante", () => {
  const nav = read("components/Navbar.tsx");
  const fab = read("components/RuidoSupportFloating.tsx");
  assert.doesNotMatch(nav, /href: "\/apoie"/);
  assert.match(nav, /MANIFESTO/);
  assert.match(fab, /AUMENTAR RUÍDO/);
  assert.match(fab, /href="\/apoie#pix"/);
});

test("todos os links externos do repositório direcionam para o espelho público", () => {
  for (const path of [
    "README.md", "app/apoie/page.tsx", "app/layout.tsx",
    "scripts/refresh-dossiers-datajud.py", "scripts/refresh-dossiers-judicial.py",
    "scripts/refresh-dossiers-finance.py", "scripts/refresh-dossiers-patrimony.py",
    "scripts/refresh-dossiers-news.ts",
  ]) {
    assert.doesNotMatch(read(path), /github\.com\/leomoreiraa\/radar-congresso/i, path);
  }
  assert.match(read("app/layout.tsx"), /github\.com\/leomoreiraa\/ruido/);
  assert.match(read("app/apoie/page.tsx"), /github\.com\/leomoreiraa\/ruido/);
});

test("404 apresenta cartaz próprio, navegação e CSS responsivo", () => {
  const page = read("app/not-found.tsx");
  const styles = read("app/not-found.module.css");
  assert.match(page, /FREQUÊNCIA/);
  assert.match(page, /PERDIDA/);
  assert.match(page, /href="\/"/);
  assert.match(page, /href="\/parlamentares"/);
  assert.match(page, /aria-labelledby="ruido-404-title"/);
  assert.match(styles, /@media \(max-width: 430px\)/);
  assert.match(styles, /prefers-reduced-motion: reduce/);
  assert.doesNotMatch(page, /ruido-hero\.webp|ruido-mural-original/);
});
