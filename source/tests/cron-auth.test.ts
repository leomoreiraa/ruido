import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { autorizarCron, lerDiasSincronizacao } from "../lib/cron-auth";

describe("autorizarCron", () => {
  const secretForte = "a".repeat(32);

  test("recusa quando CRON_SECRET está indefinido ou curto", () => {
    assert.equal(autorizarCron(`Bearer ${secretForte}`, undefined), false);
    assert.equal(autorizarCron(`Bearer curto`, "curto"), false);
  });

  test("recusa quando cabeçalho é ausente ou formato incorreto", () => {
    assert.equal(autorizarCron(null, secretForte), false);
    assert.equal(autorizarCron("", secretForte), false);
    assert.equal(autorizarCron(`Token ${secretForte}`, secretForte), false);
    assert.equal(autorizarCron(secretForte, secretForte), false);
  });

  test("recusa token divergente com segurança de tempo constante", () => {
    assert.equal(autorizarCron(`Bearer ${"b".repeat(32)}`, secretForte), false);
  });

  test("autoriza com Bearer token exato e secret forte", () => {
    assert.equal(autorizarCron(`Bearer ${secretForte}`, secretForte), true);
  });
});

describe("lerDiasSincronizacao", () => {
  test("retorna 3 dias por padrão quando ausente", () => {
    assert.equal(lerDiasSincronizacao(null), 3);
  });

  test("converte inteiros válidos entre 1 e 15", () => {
    assert.equal(lerDiasSincronizacao("1"), 1);
    assert.equal(lerDiasSincronizacao("7"), 7);
    assert.equal(lerDiasSincronizacao("15"), 15);
  });

  test("rejeita valores fora da faixa ou não numéricos", () => {
    assert.throws(() => lerDiasSincronizacao("0"), /dias deve ser um inteiro entre 1 e 15/);
    assert.throws(() => lerDiasSincronizacao("16"), /dias deve ser um inteiro entre 1 e 15/);
    assert.throws(() => lerDiasSincronizacao("-5"), /dias deve ser um inteiro entre 1 e 15/);
    assert.throws(() => lerDiasSincronizacao("abc"), /dias deve ser um inteiro entre 1 e 15/);
    assert.throws(() => lerDiasSincronizacao("3.5"), /dias deve ser um inteiro entre 1 e 15/);
    assert.throws(() => lerDiasSincronizacao("NaN"), /dias deve ser um inteiro entre 1 e 15/);
  });
});
