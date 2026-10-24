import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  RUIDO_PIX_KEY, RUIDO_PIX_COPIA_E_COLA, RUIDO_PIX_NOME, RUIDO_PIX_CIDADE,
  createPixBrCode, pixCrc16
} from "../lib/pix-brcode";

test("BR Code Pix estático oficial da chave aprovada, CRC16 correto", () => {
  assert.equal(RUIDO_PIX_KEY, "7748aa32-17c0-4c16-91bc-fd8f65a87f33");
  assert.equal(RUIDO_PIX_NOME, "RUIDO");
  assert.equal(RUIDO_PIX_CIDADE, "ARARAS");
  assert.equal(RUIDO_PIX_COPIA_E_COLA,
    "00020101021126580014br.gov.bcb.pix01367748aa32-17c0-4c16-91bc-fd8f65a87f335204000053039865802BR5905RUIDO6006ARARAS62070503***6304B182"
  );
  assert.equal(pixCrc16(RUIDO_PIX_COPIA_E_COLA.slice(0, -4)), "B182");
  assert.equal(createPixBrCode(RUIDO_PIX_KEY, RUIDO_PIX_NOME, RUIDO_PIX_CIDADE), RUIDO_PIX_COPIA_E_COLA);
  assert.doesNotMatch(RUIDO_PIX_COPIA_E_COLA, /540\d/); // sem valor fixado
});

test("BR Code valida entrada e mantém a chave que identifica o destino", () => {
  assert.throws(() => createPixBrCode("outro-valor", "RUIDO", "ARARAS"));
  assert.throws(() => createPixBrCode(RUIDO_PIX_KEY, "NOME_QUE_NAO_E_PERMITIDO", "ARARAS"));
  assert.match(RUIDO_PIX_COPIA_E_COLA, /br\.gov\.bcb\.pix0136/);
  assert.match(RUIDO_PIX_COPIA_E_COLA, new RegExp(RUIDO_PIX_KEY));
});

test("página exibe QR estático, botões copia e cola e nenhuma plataforma externa", () => {
  const page = readFileSync("app/apoie/page.tsx", "utf8");
  const controls = readFileSync("components/ApoiePixCopiar.tsx", "utf8");
  const qrcode = readFileSync("components/RuidoPixQr.tsx", "utf8");
  const workflows = [
    readFileSync(".github/workflows/deploy-visual-fast.yml", "utf8"),
    readFileSync(".github/workflows/deploy-gh-pages.yml", "utf8")
  ];
  assert.match(page, /<RuidoPixQr\s*\/>/);
  assert.match(page, /copiaECola=\{RUIDO_PIX_COPIA_E_COLA\}/);
  assert.match(controls, /navigator\.clipboard\.writeText/);
  assert.match(controls, /COPIAR PIX COPIA E COLA/);
  assert.match(controls, /COPIAR SÓ A CHAVE/);
  assert.match(qrcode, /viewBox="0 0 49 49"/);
  assert.match(qrcode, /BigInt/);
  assert.doesNotMatch(page, /APOIA\.se|apoiaUrl/);
  for (const workflow of workflows) {
    assert.doesNotMatch(workflow, /NEXT_PUBLIC_RUIDO_PIX_CHAVE/);
    assert.doesNotMatch(workflow, /RUIDO_APOIA_URL/);
  }
});

test("botão flutuante de apoio está no layout inteiro com link direto ao Pix", () => {
  const layout = readFileSync("app/layout.tsx", "utf8");
  const widget = readFileSync("components/RuidoSupportFloating.tsx", "utf8");
  const css = readFileSync("app/globals.css", "utf8");
  const page = readFileSync("app/apoie/page.tsx", "utf8");
  assert.match(layout, /<RuidoSupportFloating\s*\/>/);
  assert.match(widget, /href="\/apoie#pix"/);
  assert.match(widget, /AUMENTAR RUÍDO/);
  assert.match(widget, /aria-label="Aumentar ruído — apoiar o projeto com Pix"/);
  assert.match(css, /\.ruido-support-fab\s*\{[^}]*position:\s*fixed/s);
  assert.match(css, /safe-area-inset-bottom/);
  assert.match(css, /min-height:\s*48px/);
  assert.match(css, /focus-visible/);
  assert.match(page, /id="pix"/);
  assert.doesNotMatch(readFileSync("components/Navbar.tsx", "utf8"), /href: "\/apoie"/);
});
