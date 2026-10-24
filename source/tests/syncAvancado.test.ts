import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  normalizarTipoEmenda,
  normalizarStatusEmenda,
  converterValorMonetario,
} from "../lib/services/syncAvancado";
import { TipoEmenda, StatusEmenda } from "../lib/types";

describe("syncAvancado: normalização de emendas parlamentares", () => {
  test("normalizarTipoEmenda identifica Transferência Especial (Emenda PIX)", () => {
    assert.equal(normalizarTipoEmenda("Transferência Especial"), TipoEmenda.TRANSFERENCIA_ESPECIAL);
    assert.equal(normalizarTipoEmenda("TRANSFERENCIA ESPECIAL"), TipoEmenda.TRANSFERENCIA_ESPECIAL);
    assert.equal(normalizarTipoEmenda("Emenda PIX"), TipoEmenda.TRANSFERENCIA_ESPECIAL);
    assert.equal(normalizarTipoEmenda("PIX"), TipoEmenda.TRANSFERENCIA_ESPECIAL);
  });

  test("normalizarTipoEmenda identifica Bancada e Relator", () => {
    assert.equal(normalizarTipoEmenda("Emenda de Bancada"), TipoEmenda.BANCADA);
    assert.equal(normalizarTipoEmenda("Bancada Estadual"), TipoEmenda.BANCADA);
    assert.equal(normalizarTipoEmenda("Emenda de Relator"), TipoEmenda.RELATOR);
    assert.equal(normalizarTipoEmenda("RP9 - Relator Geral"), TipoEmenda.RELATOR);
  });

  test("normalizarTipoEmenda usa INDIVIDUAL como padrão", () => {
    assert.equal(normalizarTipoEmenda("Individual"), TipoEmenda.INDIVIDUAL);
    assert.equal(normalizarTipoEmenda("Emenda Individual Impositiva"), TipoEmenda.INDIVIDUAL);
    assert.equal(normalizarTipoEmenda(null), TipoEmenda.INDIVIDUAL);
    assert.equal(normalizarTipoEmenda(undefined), TipoEmenda.INDIVIDUAL);
  });

  test("normalizarStatusEmenda mapeia Pago, Liquidado, Empenhado e Cancelado", () => {
    assert.equal(normalizarStatusEmenda("PAGO"), StatusEmenda.PAGO);
    assert.equal(normalizarStatusEmenda("Pago"), StatusEmenda.PAGO);
    assert.equal(normalizarStatusEmenda("Concluído"), StatusEmenda.PAGO);
    assert.equal(normalizarStatusEmenda("Liquidado"), StatusEmenda.LIQUIDADO);
    assert.equal(normalizarStatusEmenda("Empenhado"), StatusEmenda.EMPENHADO);
    assert.equal(normalizarStatusEmenda("Cancelado"), StatusEmenda.CANCELADO);
    assert.equal(normalizarStatusEmenda(null), StatusEmenda.EMPENHADO);
  });

  test("converterValorMonetario converte formatos brasileiros e números", () => {
    assert.equal(converterValorMonetario("1.500.234,50"), 1500234.5);
    assert.equal(converterValorMonetario("250.000,00"), 250000);
    assert.equal(converterValorMonetario(12345.67), 12345.67);
    assert.equal(converterValorMonetario(null), 0);
    assert.equal(converterValorMonetario(""), 0);
    assert.equal(converterValorMonetario("invalido"), 0);
  });
});
