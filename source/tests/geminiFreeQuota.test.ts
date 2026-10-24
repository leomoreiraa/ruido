import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { retryAfterMilliseconds } from "../lib/ai/geminiFree";

test("Retry-After: segundos, HTTP date e invalido",()=>{
  assert.equal(retryAfterMilliseconds("2"),2000);
  assert.equal(retryAfterMilliseconds("0.5"),500);
  assert.equal(retryAfterMilliseconds("Mon, 26 Oct 2026 12:00:00 GMT",Date.parse("2026-10-26T11:59:30Z")),30000);
  assert.equal(retryAfterMilliseconds("invalid"),null);
});
test("Gemini free serializa as tres IAs e preserva exclusao do SQLite",()=>{
  for(const p of ["news-enrichment.yml","atualizar-dossies.yml","ai-enrichment.yml"]){
    const yml=fs.readFileSync(".github/workflows/"+p,"utf8");
    assert.match(yml,/group: ruido-gemini-free/);
    assert.match(yml,/queue: max/);
    assert.doesNotMatch(yml,/\n  push:/);
    assert.match(yml,/GEMINI_FREE_MIN_INTERVAL_MS: '35000'/);
    assert.match(yml,/'3' \|\| '2'/);
  }
  assert.match(fs.readFileSync(".github/workflows/ai-enrichment.yml","utf8"),/group: clean-v2-pages/);
  assert.match(fs.readFileSync(".github/workflows/deploy-gh-pages.yml","utf8"),/RUN_AI_IN_HISTORICAL/);
  assert.doesNotMatch(fs.readFileSync(".github/workflows/ciclos-dados-ia.yml","utf8"),/\n  push:/);
});
test("Sincronizacao recente aguarda escrita anterior; CNJ retoma numeros",()=>{
  const yml=fs.readFileSync(".github/workflows/sync-legislativo-recente.yml","utf8");
  assert.match(yml,/queue: max/);
  const datajud=fs.readFileSync("scripts/refresh-dossiers-datajud.py","utf8");
  assert.match(datajud,/proximoNumero/);
  assert.match(datajud,/time.sleep\(1.25\)/);
});
