import test from "node:test";
import assert from "node:assert/strict";
import { lerValorReais, classificarTipoEmenda, extrairUF, nomeNormalizado, municipioDaLocalidade } from "../lib/services/emendasPortal";

test("converte valores monetários oficiais sem confundir separador de milhar", () => {
  assert.equal(lerValorReais("R$ 1.234.567,89"), 1234567.89);
  assert.equal(lerValorReais("200,50"), 200.5);
  assert.equal(lerValorReais(125.5), 125.5);
  assert.equal(lerValorReais(null), 0);
  assert.throws(() => lerValorReais("valor falso"));
});
test("reconhece categorias reais e conserva categorias não reconhecidas", () => {
  assert.equal(classificarTipoEmenda("Emenda Individual - Transferências Especiais"), "TRANSFERENCIA_ESPECIAL");
  assert.equal(classificarTipoEmenda("Emenda de Comissão"), "COMISSAO");
  assert.equal(classificarTipoEmenda("Emenda de Bancada"), "BANCADA");
  assert.equal(classificarTipoEmenda("Emenda Individual"), "INDIVIDUAL");
  assert.equal(classificarTipoEmenda("outra classificação"), "NAO_CLASSIFICADA");
});
test("identificação conservadora do autor e localidade", () => {
  assert.equal(nomeNormalizado("Deputada Federal Maria da Silva"), "MARIA DA SILVA");
  assert.equal(extrairUF("Campinas (SP)"), "SP");
  assert.equal(municipioDaLocalidade("Campinas (SP)"), "Campinas");
  assert.equal(extrairUF("NACIONAL"), null);
  assert.equal(municipioDaLocalidade("BRASIL"), null);
});
