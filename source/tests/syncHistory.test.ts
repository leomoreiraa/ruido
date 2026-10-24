import test from "node:test";
import assert from "node:assert/strict";
import { criarJanelasHistoricas, executarHistorico, parseHistoryArgs, type HistoryDependencies } from "../lib/services/syncHistory";

const now = new Date("2026-03-03T12:00:00Z");
function harness() {
  const rows = new Map<string, any>();
  const calls: any[] = [];
  let released = 0;
  let acquired = 0;
  const deps: HistoryDependencies = {
    executions: {
      findUnique: async ({ where }: any) => rows.get(where.id) ?? null,
      upsert: async ({ where, create, update }: any) => { const row = rows.has(where.id) ? { ...rows.get(where.id), ...update } : create; rows.set(where.id, row); return row; },
      update: async ({ where, data }: any) => { const row = { ...rows.get(where.id), ...data }; rows.set(where.id, row); return row; },
    } as any,
    acquireLease: async () => { acquired++; return { leaseId: "GLOBAL_SYNC", holder: "test", heartbeat: async () => {}, release: async () => { released++; } }; },
    votacoes: async options => { calls.push(["votacoes", options]); return { votacoesSincronizadas: 2, votosSincronizados: 10 }; },
    presencas: async options => { calls.push(["presencas", options]); return 3; },
    now: () => now,
    log: () => {},
  };
  return { deps, rows, calls, released: () => released, acquired: () => acquired };
}

test("janelas inclusivas: bissexto, virada anual e mês atual até hoje UTC", () => {
  const windows = criarJanelasHistoricas(parseHistoryArgs(["--inicio=2024-02", "--fim=2024-03"], now), now);
  assert.equal(windows[0].dataFim, "2024-02-29");
  const current = criarJanelasHistoricas(parseHistoryArgs(["--inicio", "2025-12"], now), now);
  assert.deepEqual(current.map(w => w.mes), ["2025-12", "2026-01", "2026-02", "2026-03"]);
  assert.equal(current.at(-1)?.dataFim, "2026-03-03");
  assert.equal(current.at(-1)?.encerrada, false);
});

test("CLI rejeita inválidos antes de qualquer IO e aceita meses legados", () => {
  for (const args of [[], ["--inicio=2026-13"], ["--inicio=0000-01"], ["--inicio=2026-04"], ["--inicio=2026-02", "--fim=2026-01"], ["2026-01", "--lote=0"], ["2026-01", "--lote=13"], ["2026-01", "--wat=1"], ["2026-01", "--inicio=2026-01"], ["--dias=-1"], ["--dias=7", "--inicio=2026-01"]]) {
    assert.throws(() => parseHistoryArgs(args, now), Error, args.join(" "));
  }
  assert.deepEqual(parseHistoryArgs(["2026-02", "2026-01"], now).meses, ["2026-01", "2026-02"]);
});

test("incremental cruza meses sem amostragem e não encerra checkpoint mensal", async () => {
  const h = harness();
  const options = parseHistoryArgs(["--dias=7", "--reprocessar"], now);
  await executarHistorico(options, h.deps);
  assert.equal(h.calls.length, 4);
  assert.equal(h.calls[0][1].dataInicio, "2026-02-25");
  assert.equal(h.calls[2][1].dataFim, "2026-03-03");
  assert.ok([...h.rows.keys()].every(id => id.includes(":daily:")));
});

test("lote limitado, paginação integral e retomada apenas de janelas concluídas", async () => {
  const h = harness();
  const options = parseHistoryArgs(["--inicio=2026-01", "--fim=2026-02"], now);
  assert.deepEqual(await executarHistorico(options, h.deps), { concluidas: 1, ignoradas: 0, pendentes: 1 });
  assert.deepEqual(await executarHistorico(options, h.deps), { concluidas: 1, ignoradas: 1, pendentes: 0 });
  assert.deepEqual(await executarHistorico(options, h.deps), { concluidas: 0, ignoradas: 2, pendentes: 0 });
  assert.equal(h.calls.length, 4);
  assert.ok(h.calls.every(([, options]) => options.todasPaginas === true));
  assert.equal(h.calls[0][1].ordem, "ASC");
  assert.equal(h.released(), 3);
  assert.equal(h.acquired(), 3);
});

test("erro parcial não conclui janela, libera lock e repete votações na retomada", async () => {
  const h = harness();
  const options = parseHistoryArgs(["2026-01"], now);
  const presencas = h.deps.presencas;
  h.deps.presencas = async () => { throw new Error("API falhou"); };
  await assert.rejects(executarHistorico(options, h.deps), /API falhou/);
  assert.equal(h.rows.get("history:v1:camara:2026-01").status, "ERRO");
  assert.equal(h.released(), 1);
  h.deps.presencas = presencas;
  await executarHistorico(options, h.deps);
  assert.equal(h.calls.filter(([type]) => type === "votacoes").length, 2);
});

test("mês aberto sempre reconsultado e reprocessar ignora sucesso", async () => {
  const h = harness();
  const options = parseHistoryArgs(["2026-03"], now);
  await executarHistorico(options, h.deps);
  await executarHistorico(options, h.deps);
  assert.equal(h.calls.length, 4);
  const closed = parseHistoryArgs(["2026-01", "--reprocessar"], now);
  await executarHistorico(closed, h.deps);
  await executarHistorico(closed, h.deps);
  assert.equal(h.calls.length, 8);
});

test("checkpoint sem revisão ou de coletor antigo é reprocessado sem excluir registros", async () => {
  for (const revision of [undefined, 1]) {
    const h = harness();
    const options = parseHistoryArgs(["2026-01"], now);
    const window = criarJanelasHistoricas(options, now)[0];
    const id = "history:v1:camara:2026-01";
    h.rows.set(id, { id, status: "SUCESSO", parametros: JSON.stringify({ ...window, collectorRevision: revision }) });
    assert.deepEqual(await executarHistorico(options, h.deps), { concluidas: 1, ignoradas: 0, pendentes: 0 });
    assert.equal(h.rows.size, 1);
    assert.equal(JSON.parse(h.rows.get(id).parametros).collectorRevision, window.collectorRevision);
    assert.deepEqual(await executarHistorico(options, h.deps), { concluidas: 0, ignoradas: 1, pendentes: 0 });
    assert.equal(h.calls.length, 2);
  }
});

test("404 marca checkpoint como erro e não sucesso", async () => {
  const h = harness();
  h.deps.votacoes = async () => { throw new Error("HTTP 404"); };
  await assert.rejects(executarHistorico(parseHistoryArgs(["2026-01"], now), h.deps), /HTTP 404/);
  assert.equal(h.rows.get("history:v1:camara:2026-01").status, "ERRO");
  assert.equal(h.calls.length, 0);
  assert.equal(h.released(), 1);
});

test("lock indisponível impede qualquer coleta", async () => {
  const h = harness();
  h.deps.acquireLease = async () => { throw new Error("lock ativo"); };
  await assert.rejects(executarHistorico(parseHistoryArgs(["2026-01"], now), h.deps), /lock ativo/);
  assert.equal(h.rows.size, 0);
  assert.equal(h.calls.length, 0);
});

test("histórico mensal do Senado usa checkpoints independentes e resposta oficial", async () => {
  const h = harness();
  h.deps.senado = async (inicio, fim) => {
    h.calls.push(["senado", { inicio, fim }]);
    return { votacoesSincronizadas: 4, votosSincronizados: 30, presencasSincronizadas: 15 };
  };
  const options = parseHistoryArgs(["2026-01", "--fonte=senado"], now);
  await executarHistorico(options, h.deps);
  assert.equal(h.calls.length, 1);
  assert.ok(h.rows.has("history:v1:senado:2026-01"));
  assert.equal(h.rows.get("history:v1:senado:2026-01").status, "SUCESSO");
  assert.deepEqual(await executarHistorico(options, h.deps), { concluidas: 0, ignoradas: 1, pendentes: 0 });
});
