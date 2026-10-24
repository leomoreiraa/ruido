import test from "node:test";
import assert from "node:assert/strict";
import {frequenciaAuditadaPercentual} from "../lib/presencaMetric";
test("cálculo por sessões com denominador fechado",()=>{
  assert.equal(frequenciaAuditadaPercentual({sessoes:30,presentes:22,ausentes:5,justificadas:3}),73.3);
  assert.equal(frequenciaAuditadaPercentual({sessoes:30,presentes:22,ausentes:0,justificadas:0}),null);
});
test("não fabrica ausência nem porcentagem quando só há presenças positivas",()=>{
  assert.equal(frequenciaAuditadaPercentual(),null);
  assert.equal(frequenciaAuditadaPercentual({sessoes:0,presentes:0,ausentes:0,justificadas:0}),null);
  assert.equal(frequenciaAuditadaPercentual({sessoes:2,presentes:2,ausentes:1,justificadas:0}),null);
});
