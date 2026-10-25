import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

function source(path: string): string {
  return readFileSync(join(process.cwd(), path), "utf8");
}

test("sincronização legislativa semanal mantém lock de escrita e não publica o Pages", () => {
  const schedule = source(".github/workflows/cron-sync.yml");
  const collector = source(".github/workflows/deploy-gh-pages.yml");
  const pages = source(".github/workflows/deploy-visual-fast.yml");
  assert.match(schedule, /cron:\s*'37 5 \* \* 0'/);
  assert.match(schedule, /uses: \.\/\.github\/workflows\/deploy-gh-pages\.yml/);
  assert.match(collector, /group:\s*clean-v2-pages/);
  assert.match(collector, /cancel-in-progress:\s*false/);
  assert.doesNotMatch(collector, /actions\/deploy-pages@/);
  assert.equal((pages.match(/actions\/deploy-pages@v4/g) || []).length, 0);
  assert.equal((pages.match(/actions\/(?:upload|download)-artifact@/g) || []).length, 0);
  assert.match(pages, /git -C "\$dest" push origin HEAD:main/);
});

test("checkpoint verificável precede auditoria e export; publicação só no workflow visual", () => {
  const collector = source(".github/workflows/deploy-gh-pages.yml");
  const pages = source(".github/workflows/deploy-visual-fast.yml");
  const candidate = collector.indexOf("Criar candidato sanitizado");
  const checkpoint = collector.indexOf("Salvar checkpoint recuperável antes de compilar");
  const publicationGate = collector.indexOf("Bloquear base reconstruída");
  const staticExport = collector.indexOf("Gerar export a partir do candidato");
  assert.ok(candidate > 0 && checkpoint > candidate);
  assert.ok(publicationGate > checkpoint);
  assert.ok(staticExport > publicationGate);
  assert.doesNotMatch(collector, /actions\/deploy-pages@/);
  assert.doesNotMatch(pages, /actions\/(?:upload|download)-artifact@/);
  assert.match(pages, /build-public-source\.py verify out\/source/);
  assert.match(pages, /scripts\/audit-public-export\.py out/);
  assert.doesNotMatch(pages, /actions\/deploy-pages@/);
  assert.ok(pages.indexOf("Verificar sequência monotônica de publicação")
    < pages.indexOf("Sincronizar site auditado no repositório público"));
  assert.equal((collector.match(/scripts\/release-snapshot\.py publish/g) ?? []).length, 1);
});

test("data recovery is isolated to rebuilt-v2, never legacy SQLite or LFS", () => {
  const deploy = source(".github/workflows/deploy-gh-pages.yml");
  const release = source("scripts/release-snapshot.py");
  const verify = source("scripts/verify-rebuilt.py");
  assert.doesNotMatch(deploy, /merge-lfs-history|lfs:\s*true/);
  assert.match(release, /CLEAN_TAG\.fullmatch\(r\['tag_name'\]\)/);
  assert.match(verify, /--checkpoint-only/);
  assert.match(deploy, /--checkpoint-only/);
});

test("pipeline deixa margem para checkpoints antes do limite de 3 horas", () => {
  const deploy = source(".github/workflows/deploy-gh-pages.yml");
  assert.match(deploy, /timeout-minutes:\s*170/);
  assert.match(deploy, /timeout-minutes:\s*95/);
  assert.match(deploy, /timeout-minutes:\s*23/);
  assert.match(deploy, /timeout-minutes:\s*18/);
  assert.match(deploy, /--stage final --baseline-tag/);
  assert.match(deploy, /--stage camara --baseline-tag/);
  assert.match(deploy, /--stage senado --baseline-tag/);
  assert.doesNotMatch(deploy, /actions\/upload-artifact@/);
  assert.match(deploy, /scripts\/sqlite-snapshot\.py restore/);
  assert.match(deploy, /if: \$\{\{ success\(\) \|\| failure\(\) \}\}/);
});

test("o cron repassa credenciais para o workflow reutilizável", () => {
  const cron = source(".github/workflows/cron-sync.yml");
  const deploy = source(".github/workflows/deploy-gh-pages.yml");
  assert.match(cron, /secrets:\s*inherit/);
  assert.match(deploy, /PORTAL_TRANSPARENCIA_API_KEY:\s*/);
  assert.match(deploy, /GEMINI_API_KEY:\s*/);
  assert.match(deploy, /Conferir acesso às credenciais sem revelar valores/);
});

test("recuperação prefere artifact mais recente que a Release sem sobrescrever antes da validação", () => {
  const deploy = source(".github/workflows/deploy-gh-pages.yml");
  const release = source("scripts/release-snapshot.py");
  assert.match(deploy, /RELEASE_PUBLISHED_AT:/);
  assert.match(deploy, /\.created_at > \$release/);
  assert.match(deploy, /recovered-checkpoint\/restored\.sqlite/);
  assert.match(deploy, /mv -f .*restored\.sqlite/);
  assert.match(release, /previous_published_at/);
});


test("deploy visual só recupera Release íntegra e impede publicar commit obsoleto", () => {
  const fast = source(".github/workflows/deploy-visual-fast.yml");
  assert.match(fast, /sqlite-snapshot\.py restore/);
  assert.match(fast, /gh release download/);
  assert.match(fast, /Nenhuma Release rebuilt-v2 íntegra/);
  assert.match(fast, /if: steps\.freshness\.outputs\.current == 'true'/);
  assert.match(fast, /published_run=0/);
  assert.match(fast, /GITHUB_RUN_ID > published_run/);
  assert.match(fast, /build-info\.json\?ref=main/);
  assert.match(fast, /out\/data\/brasil-estados\.json/);
  assert.match(fast, /out\/data\/idhm-ufs\.json/);
  assert.match(fast, /npm run build:regional/);
  assert.match(fast, /if grep -q 'ruido-hero\.webp'/);
});

test("IA mantém checkpoint recuperável em Release sem consumir quota de artifacts", () => {
  const ai = source(".github/workflows/ai-enrichment.yml");
  assert.doesNotMatch(ai, /actions\/(?:upload|download)-artifact@/);
  assert.match(ai, /ruido-ai-projects-partial-\$GITHUB_RUN_ID-\$GITHUB_RUN_ATTEMPT/);
  assert.match(ai, /gh release create "\$tag"/);
  assert.match(ai, /--prerelease --title/);
  assert.match(ai, /sqlite-snapshot\.py restore/);
  assert.match(ai, /\.base_sha256/);
  assert.match(ai, /\.base_schema_sha256/);
  assert.match(ai, /steps\.recovery_release\.outputs\.recovered/);
  assert.match(ai, /if: failure\(\) && \(steps\.generation\.outcome == 'failure' \|\| steps\.publish\.outcome == 'failure'\)/);
  assert.ok(ai.indexOf("Persistir o snapshot antes de republicar o site") <
    ai.indexOf("Salvar contingência de IA em Release"));
  assert.ok(ai.indexOf("Retomar checkpoint parcial de Release") <
    ai.indexOf("Gerar explicações com Gemini"));
});

test("coleta semanal usa Releases preliminares verificadas e recupera progresso sem promover dados incompletos", () => {
  const deploy = source(".github/workflows/deploy-gh-pages.yml");
  const progress = source("scripts/historical-checkpoint.py");
  const canonical = source("scripts/release-snapshot.py");
  assert.match(deploy, /scripts\/historical-checkpoint\.py restore/);
  assert.match(deploy, /scripts\/historical-checkpoint\.py publish/);
  assert.match(deploy, /scripts\/historical-checkpoint\.py cleanup/);
  assert.match(deploy, /ARTIFACT_CREATED_AT:/);
  assert.match(deploy, /checkpoint_created_at=\$artifact_created_at/);
  assert.match(deploy, /--since "\$since"/);
  assert.doesNotMatch(deploy, /actions\/upload-artifact@/);
  assert.match(progress, /--checkpoint-only/);
  assert.match(progress, /preserve_history\(verified, args\.destination\)/);
  assert.match(progress, /--draft=false", "--prerelease"/);
  assert.match(progress, /module\.assert_baseline\(args\.repository, args\.baseline_tag\)/);
  assert.match(progress, /if not canonical:/);
  assert.match(canonical, /CLEAN_TAG\.fullmatch\(r\['tag_name'\]\)/);
  assert.doesNotMatch(canonical, /rebuilt-v2-progress/);
});
