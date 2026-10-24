import { execSync } from "child_process";
import fs from "fs";
import path from "path";

const rootDir = process.cwd();
const apiDir = path.join(rootDir, "app", "api");
const tempApiDir = path.join(rootDir, "_api_backup_during_export");
const outDir = path.join(rootDir, "out");

function safeMove(src: string, dest: string) {
  if (!fs.existsSync(src)) return false;
  if (fs.existsSync(dest)) {
    fs.rmSync(dest, { recursive: true, force: true, maxRetries: 3 });
  }
  try {
    fs.renameSync(src, dest);
  } catch {
    fs.cpSync(src, dest, { recursive: true });
    fs.rmSync(src, { recursive: true, force: true, maxRetries: 3 });
  }
  return true;
}

function safeRestore(temp: string, original: string) {
  if (!fs.existsSync(temp)) return;
  if (fs.existsSync(original)) {
    fs.rmSync(original, { recursive: true, force: true, maxRetries: 3 });
  }
  try {
    fs.renameSync(temp, original);
  } catch {
    fs.cpSync(temp, original, { recursive: true });
    fs.rmSync(temp, { recursive: true, force: true, maxRetries: 3 });
  }
}

function prefixPublicAssetUrls(directory: string) {
  const base = (process.env.NEXT_PUBLIC_BASE_PATH || "").replace(/\/+$/, "");
  if (!base) return;
  if (!/^\/[A-Za-z0-9/_-]+$/.test(base)) throw new Error("Invalid NEXT_PUBLIC_BASE_PATH");
  const extensions = new Set([".html", ".txt", ".css", ".js", ".json", ".xml"]);
  let modified = 0;
  function visit(dir: string) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const file = path.join(dir, entry.name);
      if (entry.isDirectory()) visit(file);
      else if (entry.isFile() && extensions.has(path.extname(file))) {
        const before = fs.readFileSync(file, "utf8");
        let after = before.replaceAll("/assets/", base + "/assets/").replaceAll("/data/", base + "/data/");
        for (const name of ["favicon.ico", "favicon.png", "favicon.svg", "icon.svg"])
          after = after.replaceAll("/" + name, base + "/" + name);
        if (after !== before) { fs.writeFileSync(file, after); modified++; }
      }
    }
  }
  visit(directory);
  const index = fs.readFileSync(path.join(directory, "index.html"), "utf8");
  if (/src=["']\/assets\//.test(index) || /href=["']\/favicon\./.test(index))
    throw new Error("Static export still contains root-relative public assets");
  console.log("Public asset URLs prefixed in " + modified + " files (" + base + ").");
}

/**
 * Mantém links externos /pautas/<id>/ funcionando sem gerar 30 mil páginas
 * Next.js duplicadas. Links internos usam diretamente /pautas/detalhe?id=<id>.
 */
function createLegacyPautaRedirects(directory: string) {
  const catalog = JSON.parse(fs.readFileSync(path.join(directory, "data", "pautas-index.json"), "utf8")) as
    Array<{ id: string; siglaTipo: string; numero: number; ano: number }>;
  const base = (process.env.NEXT_PUBLIC_BASE_PATH || "").replace(/\/+$/, "");
  const parent = path.join(directory, "pautas");
  for (const prop of catalog) {
    if (!/^[A-Za-z0-9_-]{1,128}$/.test(prop.id)) throw new Error("Invalid proposition ID");
    const url = base + "/pautas/detalhe/?id=" + encodeURIComponent(prop.id);
    const dir = path.join(parent, prop.id);
    fs.mkdirSync(dir, { recursive: true });
    const title = (prop.siglaTipo || "Proposta").replace(/[^A-Za-z0-9]/g, "") +
      " " + Number(prop.numero) + "/" + Number(prop.ano);
    fs.writeFileSync(path.join(dir, "index.html"),
      '<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">' +
      '<title>' + title + ' | RUÍDO</title>' +
      '<meta http-equiv="refresh" content="0;url=' + url + '">' +
      '<link rel="canonical" href="' + url + '"></head>' +
      '<body><a href="' + url + '">Abrir detalhe da proposta no RUÍDO</a></body></html>');
  }
  console.log("Rotas históricas compactadas: " + catalog.length);
}

function main() {
  console.log("=== Gerando build estático para GitHub Pages (output: export) ===");

  const movedApi = safeMove(apiDir, tempApiDir);

  try {
    try {
      execSync("npx prisma generate", { stdio: "inherit" });
    } catch (err) {
      console.warn("Aviso: prisma generate ignorado ou client já gerado (possível bloqueio temporário de DLL no Windows). Prosseguindo...");
    }
    execSync("npx tsx scripts/build-browser-catalogs.ts", { stdio: "inherit" });
    execSync("npx next build", {
      stdio: "inherit",
      env: {
        ...process.env,
        GITHUB_PAGES: "true",
      },
    });

    prefixPublicAssetUrls(outDir);
    createLegacyPautaRedirects(outDir);

    if (fs.existsSync(outDir)) {
      fs.writeFileSync(path.join(outDir, ".nojekyll"), "");
      console.log("Arquivo out/.nojekyll criado com sucesso!");
    }
  } finally {
    if (movedApi) {
      safeRestore(tempApiDir, apiDir);
    }
  }

  console.log("=== Build para GitHub Pages finalizado na pasta ./out ===");
}

main();
