import test from "node:test";
import assert from "node:assert/strict";
import { calcularPeriodoPadrao } from "../lib/services/syncLegislativo";

test("calcularPeriodoPadrao: retorna datas ISO consistentes de acordo com intervalo", () => {
  const p1 = calcularPeriodoPadrao(0);
  assert.equal(p1.dataInicio, p1.dataFim);

  const p5 = calcularPeriodoPadrao(5);
  const regex = /^\d{4}-\d{2}-\d{2}$/;
  assert.match(p5.dataInicio, regex);
  assert.match(p5.dataFim, regex);
  assert.ok(p5.dataInicio <= p5.dataFim);
});
