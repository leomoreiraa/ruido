import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const read=(p:string)=>fs.readFileSync(p,"utf8");
test("três janelas diárias com jitter de até dez minutos",()=>{
  const s=read(".github/workflows/ciclos-dados-ia.yml");
  assert.match(s,/cron: '17 7,15,23 \* \* \*'/);
  assert.match(s,/cron: '47 3 \* \* \*'/);
  assert.match(s,/dispatch news-enrichment\.yml -f mode="\$ai_mode"/);
  assert.match(s,/dispatch ai-enrichment\.yml -f mode="\$ai_mode"/);
  assert.match(s,/dispatch atualizar-dossies\.yml -f mode="\$ai_mode"/);
  assert.match(s,/secrets.randbelow\(601\)/);
  assert.match(s,/sleep "\$delay"/);
  for(const w of ["sync-legislativo-recente.yml","news-enrichment.yml",
    "enriquecer-datajud.yml","atualizar-dossies.yml",
    "financial-links.yml","ai-enrichment.yml"]){
    assert.ok(s.includes("dispatch "+w),"fluxo ausente: "+w);
  }
  assert.match(s,/gh run list/);
  assert.match(s,/mode=recent/);
  assert.match(s,/mode=full/);
});
test("os coletores são executados pelo coordenador, sem cron duplicado",()=>{
  for(const p of [
    ".github/workflows/ai-enrichment.yml",
    ".github/workflows/news-enrichment.yml",
    ".github/workflows/atualizar-dossies.yml",
    ".github/workflows/enriquecer-datajud.yml",
    ".github/workflows/financial-links.yml"
  ]) assert.doesNotMatch(read(p),/^\s*schedule:/m);
  assert.match(read(".github/workflows/cron-sync.yml"),/^\s*schedule:/m);
});
test("sync recente audita SQLite sem repetir histórico integral",()=>{
  const p=read(".github/workflows/sync-legislativo-recente.yml");
  assert.match(p,/npm run sync -- 7/);
  assert.match(p,/--dias=7 --reprocessar --fonte=camara/);
  assert.match(p,/--dias=7 --reprocessar --fonte=senado/);
  assert.match(p,/sqlite-snapshot.py create/);
  assert.match(p,/release-snapshot.py publish/);
  assert.doesNotMatch(p,/--inicio=2022/);
});
