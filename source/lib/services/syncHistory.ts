import type { PrismaClient } from "@prisma/client";
import type { SyncLeaseHandle } from "./syncLock";

export const HISTORY_HELP = `Uso: npx tsx scripts/sync-camara-history.ts --inicio=AAAA-MM --fim=AAAA-MM [--fonte=camara] [--lote=1]
Incremental sem amostragem: --dias=7 --reprocessar [--fonte=camara] (lote padrão 12).
Alternativa compatível: AAAA-MM [AAAA-MM ...]
--fim padrão: mês atual (UTC); --lote: 1 a 12 janelas pendentes por execução.
Repita o comando para retomar. Meses encerrados concluídos são ignorados; o mês atual é reconsultado.
Senado: coleta por intervalos mensais usando o endpoint oficial de votações; registros disponíveis podem ser parciais.
Cobertura: registros publicados nos endpoints, não todo o histórico legislativo.
Presenças são evidências positivas; não são inferidas faltas. Upserts não significam novos registros.`;

export interface HistoryOptions {
  inicio: string;
  fim: string;
  fonte: "camara" | "senado";
  lote: number;
  meses?: string[];
  dias?: number;
  reprocessar?: boolean;
}
export const CAMARA_COLLECTOR_REVISION = 3;

export interface HistoryWindow {
  tipo: "historico-v1";
  collectorRevision: number;
  fonte: "camara" | "senado";
  mes: string;
  dataInicio: string;
  dataFim: string;
  encerrada: boolean;
}
export interface HistoryDependencies {
  executions: Pick<PrismaClient["syncExecution"], "findUnique" | "upsert" | "update">;
  acquireLease: () => Promise<SyncLeaseHandle>;
  votacoes: (options: { dataInicio: string; dataFim: string; ordem: "ASC"; todasPaginas: true }) => Promise<{ votacoesSincronizadas: number; votosSincronizados: number }>;
  presencas: (options: { dataInicio: string; dataFim: string; todasPaginas: true }) => Promise<number>;
  senado?: (inicio: string, fim: string) => Promise<{ votacoesSincronizadas: number; votosSincronizados: number; presencasSincronizadas: number }>;
  now: () => Date;
  log: (event: Record<string, unknown>) => void;
}

function validarMes(mes: string): void {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(mes) || Number(mes.slice(0, 4)) < 1) {
    throw new Error(`Mês inválido: ${mes}; use AAAA-MM`);
  }
}

export function criarJanelasHistoricas(options: HistoryOptions, now = new Date()): HistoryWindow[] {

  if (!Number.isSafeInteger(options.lote) || options.lote < 1 || options.lote > 12) throw new Error("--lote deve ser inteiro entre 1 e 12");
  validarMes(options.inicio);
  validarMes(options.fim);
  const hoje = now.toISOString().slice(0, 10);
  const atual = hoje.slice(0, 7);
  if (options.inicio > options.fim || options.fim > atual) throw new Error("Intervalo inválido ou futuro");
  const meses: string[] = [];
  if (options.meses) {
    for (const mes of options.meses) {
      validarMes(mes);
      if (mes < options.inicio || mes > options.fim) throw new Error("Mês fora do intervalo");
    }
    meses.push(...new Set(options.meses));
    meses.sort();
  } else {
    let mes = options.inicio;
    while (mes <= options.fim) {
      meses.push(mes);
      const [ano, numero] = mes.split("-").map(Number);
      mes = numero === 12 ? `${String(ano + 1).padStart(4, "0")}-01` : `${String(ano).padStart(4, "0")}-${String(numero + 1).padStart(2, "0")}`;
    }
  }
  if (options.dias !== undefined && (!Number.isSafeInteger(options.dias) || options.dias < 1 || options.dias > 366)) throw new Error("--dias deve ser inteiro entre 1 e 366");
  const inicioDiario = options.dias ? new Date(Date.parse(`${hoje}T00:00:00Z`) - (options.dias - 1) * 86400000).toISOString().slice(0, 10) : undefined;
  return meses.map(mes => {
    const [ano, numero] = mes.split("-").map(Number);
    const fim = new Date(0);
    fim.setUTCFullYear(ano, numero, 0);
    return { tipo: "historico-v1" as const, collectorRevision: CAMARA_COLLECTOR_REVISION, fonte: options.fonte, mes, dataInicio: inicioDiario && inicioDiario > `${mes}-01` ? inicioDiario : `${mes}-01`, dataFim: mes === atual ? hoje : fim.toISOString().slice(0, 10), encerrada: mes < atual && !options.dias };
  });
}

export function parseHistoryArgs(args: string[], now = new Date()): HistoryOptions {
  const flags = new Map<string, string>();
  const meses: string[] = [];
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (!arg.startsWith("--")) {
      validarMes(arg);
      meses.push(arg);
      continue;
    }
    const [key, ...parts] = arg.slice(2).split("=");
    if (!["inicio", "fim", "fonte", "lote", "dias", "reprocessar"].includes(key) || flags.has(key)) throw new Error(`Opção inválida ou duplicada: --${key}`);
    if (key === "reprocessar") {
      if (parts.length) throw new Error("--reprocessar não recebe valor");
      flags.set(key, "true");
      continue;
    }
    const value = parts.length ? parts.join("=") : args[++i];
    if (!value || value.startsWith("--")) throw new Error(`Valor ausente: --${key}`);
    flags.set(key, value);
  }
  if (meses.length && (flags.has("inicio") || flags.has("fim"))) throw new Error("Não misture meses posicionais com --inicio/--fim");
  meses.sort();
  const diasRaw = flags.get("dias");
  const dias = diasRaw === undefined ? undefined : Number(diasRaw);
  if (diasRaw !== undefined && (!/^\d+$/.test(diasRaw) || !Number.isSafeInteger(dias) || dias! < 1 || dias! > 366)) throw new Error("--dias deve ser inteiro entre 1 e 366");
  if (dias && (meses.length || flags.has("inicio") || flags.has("fim"))) throw new Error("Não misture --dias com meses ou intervalo");
  const inicio = dias ? new Date(Date.parse(`${now.toISOString().slice(0, 10)}T00:00:00Z`) - (dias - 1) * 86400000).toISOString().slice(0, 7) : meses[0] ?? flags.get("inicio");
  if (!inicio) throw new Error("Informe --inicio=AAAA-MM (ou meses explícitos); use --help");
  const fonte = flags.get("fonte") ?? "camara";
  if (fonte !== "camara" && fonte !== "senado") throw new Error("Fonte inválida; use camara ou senado");
  const lote = flags.get("lote") ?? "1";
  if (!/^\d+$/.test(lote)) throw new Error("--lote deve ser inteiro entre 1 e 12");
  const options: HistoryOptions = {
    inicio, fim: meses.at(-1) ?? flags.get("fim") ?? now.toISOString().slice(0, 7), fonte, lote: flags.has("lote") ? Number(lote) : dias ? 12 : 1, dias, reprocessar: flags.has("reprocessar"),
    ...(meses.length ? { meses } : {}),
  };
  criarJanelasHistoricas(options, now);
  return options;
}

async function defaultDependencies(options: HistoryOptions): Promise<HistoryDependencies> {
  const [{ prisma }, { acquireSyncLease }, camara] = await Promise.all([
    import("../prisma"), import("./syncLock"), import("./syncCamaraService"),
  ]);
  return {
    executions: prisma.syncExecution,
    acquireLease: () => acquireSyncLease(`HISTORY_${options.fonte.toUpperCase()}`),
    votacoes: camara.sincronizarVotacoesCamara,
    presencas: camara.sincronizarPresencasCamara,
    senado: (inicio, fim) => import("./syncSenadoService").then(m => m.sincronizarVotacoesEPresencasSenado(inicio, fim)),
    now: () => new Date(),
    log: event => console.log(JSON.stringify(event)),
  };
}


export async function executarHistorico(options: HistoryOptions, injected?: HistoryDependencies) {
  const windows = criarJanelasHistoricas(options, injected?.now() ?? new Date());
  const deps = injected ?? await defaultDependencies(options);
  const lease = await deps.acquireLease();
  let concluidas = 0;
  let ignoradas = 0;
  let pendentes = 0;
  const startedAt = Date.now();
  const budgetMs = Number(process.env.HISTORY_BUDGET_MS ?? 0);
  const deadlineMs = Number(process.env.HISTORY_DEADLINE_MS ?? 0);
  try {
    for (const window of windows) {
      if ((budgetMs > 0 && Date.now() - startedAt >= budgetMs) || (deadlineMs > 0 && Date.now() >= deadlineMs)) {
        deps.log({ estado: "pausa_programada", fonte: options.fonte, motivo: "orçamento de tempo atingido", concluidas, ignoradas });
        break;
      }
      await lease.heartbeat();
      const id = options.dias ? `history:v1:${options.fonte}:daily:${window.dataInicio}:${window.dataFim}` : `history:v1:${options.fonte}:${window.mes}`;
      const previous = await deps.executions.findUnique({ where: { id } });
      let checkpoint: Partial<HistoryWindow> = {};
      try { checkpoint = JSON.parse(previous?.parametros ?? "{}") ?? {}; } catch 
      if (!options.reprocessar && window.encerrada && previous?.status === "SUCESSO" && Object.entries(window).every(([key, value]) => checkpoint[key as keyof HistoryWindow] === value)) {
        ignoradas++;
        continue;
      }
      if (concluidas >= options.lote) { pendentes++; continue; }
      await deps.executions.upsert({
        where: { id },
        create: { id, status: "EM_ANDAMENTO", parametros: JSON.stringify(window), iniciadoEm: deps.now() },
        update: { status: "EM_ANDAMENTO", parametros: JSON.stringify(window), iniciadoEm: deps.now(), finalizadoEm: null, erro: null, resumo: null },
      });
      try {
        deps.log({ estado: "iniciado", ...window });
        const params = { dataInicio: window.dataInicio, dataFim: window.dataFim, todasPaginas: true as const };
        let votacoes: { votacoesSincronizadas: number; votosSincronizados: number };
        let presencas: number;
        if (options.fonte === "senado") {
          if (!deps.senado) throw new Error("Coletor mensal do Senado indisponível");
          const result = await deps.senado(params.dataInicio, params.dataFim);
          votacoes = { votacoesSincronizadas: result.votacoesSincronizadas, votosSincronizados: result.votosSincronizados };
          presencas = result.presencasSincronizadas;
        } else {
          votacoes = await deps.votacoes({ ...params, ordem: "ASC" });
          await lease.heartbeat();
          presencas = await deps.presencas(params);
        }
        await lease.heartbeat();
        const resumo = { ...votacoes, presencas, cobertura: "Registros publicados; presença positiva, sem inferência de faltas; upserts não são necessariamente novos registros." };
        await deps.executions.update({ where: { id }, data: { status: "SUCESSO", finalizadoEm: deps.now(), resumo: JSON.stringify(resumo) } });
        concluidas++;
        deps.log({ estado: "janela_concluida", ...window, ...resumo });
      } catch (error) {
        await deps.executions.update({ where: { id }, data: { status: "ERRO", finalizadoEm: deps.now(), erro: error instanceof Error ? error.message : String(error) } });
        throw error;
      }
    }
    const report = { concluidas, ignoradas, pendentes };
    deps.log({ estado: "lote_concluido", ...report });
    return report;
  } finally {
    await lease.release();
  }
}
