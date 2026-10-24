import test from "node:test";
import assert from "node:assert/strict";
import {
  planejarConsultaGdelt,marcarTentativaGdelt,registrarLimiteGdelt,
  GDELT_MAX_REQUESTS,GDELT_MIN_INTERVAL_MS,
} from "../lib/ai/gdeltThrottle";
test("primeira consulta permitida; segunda respeita intervalo",()=>{
  let state={tentativas:0,ultimaTentativa:0,pausadoAte:0};
  assert.deepEqual(planejarConsultaGdelt(state,100_000),{permitida:true,esperaMs:0});
  state=marcarTentativaGdelt(state,100_000);
  assert.equal(planejarConsultaGdelt(state,101_000).esperaMs,GDELT_MIN_INTERVAL_MS-1000);
  assert.equal(planejarConsultaGdelt(state,112_000).esperaMs,0);
});
test("429 bloqueia chamadas futuras sem prejudicar fontes de descoberta alternativas",()=>{
  const start=200_000;
  const state=registrarLimiteGdelt({tentativas:1,ultimaTentativa:start,pausadoAte:0},start,"60");
  assert.equal(planejarConsultaGdelt(state,start+10_000).permitida,false);
  assert.ok(state.pausadoAte >= start+20*60_000);
});
test("respeita limite de consultas por execução",()=>{
  const state={tentativas:GDELT_MAX_REQUESTS,ultimaTentativa:1000,pausadoAte:0};
  assert.equal(planejarConsultaGdelt(state,999_999).permitida,false);
});
