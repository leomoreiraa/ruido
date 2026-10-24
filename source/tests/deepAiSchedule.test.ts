import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const read=(p:string)=>fs.readFileSync(p,"utf8");

test("janelas incrementais mantidas, com quarta janela exclusiva das IAs",()=>{
  const coordinator=read(".github/workflows/ciclos-dados-ia.yml");
  assert.ok(coordinator.includes("cron: '17 7,15,23 * * *'"));
  assert.ok(coordinator.includes("cron: '47 3 * * *'"));
  assert.ok(coordinator.includes('[ "$SCHEDULE_CRON" != "47 3 * * *" ]'));
  for(const workflow of ["news-enrichment.yml","atualizar-dossies.yml","ai-enrichment.yml"]){
    assert.ok(coordinator.includes('dispatch '+workflow+' -f mode="$ai_mode"'),
      workflow+" não recebe modo de execução");
  }
  assert.match(coordinator,/gh run list/);
  assert.match(coordinator,/secrets.randbelow\(601\)/);
});

test("jobs de IA profunda: timeout de 180 minutos com margem para publicar",()=>{
  for(const p of [
    ".github/workflows/news-enrichment.yml",
    ".github/workflows/ai-enrichment.yml",
    ".github/workflows/atualizar-dossies.yml"
  ]){
    const text=read(p);
    assert.match(text,/workflow_dispatch:\s*\n\s*inputs:/);
    assert.match(text,/options: \[normal, deep\]/);
    assert.match(text,/timeout-minutes: \$\{\{ inputs.mode == 'deep' && 180 \|\|/);
    assert.match(text,/AI_RUN_MODE: \$\{\{ inputs.mode == 'deep'/);
    assert.match(text,/if: always\(\)/);
  }
});

test("modo profundo eleva limites internos e encerra ao atingir orçamento",()=>{
  const news=read("scripts/refresh-dossiers-news.ts");
  assert.match(news,/DEEP_MODE \? 300 : 80/);
  assert.match(news,/DEEP_MODE \? 140 : 24/);
  assert.match(news,/DEEP_MODE\?155:21/);
  assert.match(news,/DEEP_MODE && aiCalls>=MAX_AI/);
  assert.match(news,/Gemini HTTP \(401\|403\|404\|429/);
  const projects=read("scripts/generate-project-explanations.ts");
  assert.match(projects,/deepMode\?200:30/);
  assert.match(projects,/Date.now\(\)-startedAt<budgetMs/);
  const dossiers=read("scripts/refresh-dossiers-official-ai.ts");
  assert.match(dossiers,/deepMode\?140:8/);
  assert.match(dossiers,/Date.now\(\)-begun>=budgetMs/);
  assert.match(dossiers,/fs\.renameSync\(out\+"\.tmp",out\)/);
  assert.match(dossiers,/previous\.cursor=\(start\+regulares\)%people\.length;\s*persist\(\)/);
});

test("análise profunda não expõe Gemini ao site nem dispensa verificação",()=>{
  const newsWorkflow=read(".github/workflows/news-enrichment.yml");
  const dossierWorkflow=read(".github/workflows/atualizar-dossies.yml");
  assert.match(newsWorkflow,/scripts\/validate-news-export.py/);
  assert.match(newsWorkflow,/publish-collector-safe.py news/);
  assert.match(dossierWorkflow,/publish-dossiers-safe.py/);
  const code=read("scripts/generate-project-explanations.ts");
  assert.match(code,/explicacaoFielAoObjeto/);
  assert.match(code,/prisma.proposicao.update/);
});
