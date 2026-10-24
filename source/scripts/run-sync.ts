import { prisma } from "../lib/prisma";
import { calcularPeriodoPadrao, executarSincronizacaoCompleta } from "../lib/services/syncLegislativo";
import { sincronizarDiscursos } from "../lib/services/syncAvancado";
import { gerarResumosIAParlamentares } from "../lib/ai/resumoDiscursos";

async function main() {
  const args = process.argv.slice(2);
  if (args.includes('--help') || args.includes('-h')) {
    console.log(`Uso: npx tsx scripts/run-sync.ts [dias] [--inicio=AAAA-MM-DD] [--fim=AAAA-MM-DD]
  --limite-votacoes=N --limite-eventos=N: amostra limitada, não histórico integral
  --discursos --limite-discursos=N: amostra de transcrições oficiais da Câmara
  --ia --limite-ia=N: resumos de IA, somente por opção explícita
Histórico mensal: npx tsx scripts/sync-camara-history.ts AAAA-MM [AAAA-MM ...]
Indisponíveis: emendas, patrimônio TSE, presença integral e opções --tudo/--historico-maximo.
Não são gerados dados substitutos.`);
    return;
  }
  const unavailable = ['--data-mais-antiga', '--historico-maximo', '--desde-o-inicio', '--desde-sempre', '--mandato-completo', '--presencas-mandato', '--emendas', '--patrimonio', '--tudo', '--todos'];
  if (args.some(arg => unavailable.includes(arg) || arg.startsWith('--ano-emendas='))) throw new Error('Integração indisponível. Use --help; nenhum dado sintético será gerado.');
  const value = (key: string) => args.find(arg => arg.startsWith(`${key}=`))?.slice(key.length + 1);
  const positive = (key: string, fallback: number) => {
    const n = Number(value(key) ?? fallback);
    if (!Number.isInteger(n) || n < 1) throw new Error(`Valor inválido: ${key}`);
    return n;
  };
  const days = args.find(arg => /^\d+$/.test(arg));
  const defaults = calcularPeriodoPadrao(days ? Number(days) : 5);
  const dataInicio = value('--inicio') ?? defaults.dataInicio;
  const dataFim = value('--fim') ?? defaults.dataFim;
  if (![dataInicio, dataFim].every(d => /^\d{4}-\d{2}-\d{2}$/.test(d) && Number.isFinite(Date.parse(d))) || dataInicio > dataFim) throw new Error('Intervalo inválido');
  if (args.includes('--discursos')) {
    console.log(await sincronizarDiscursos({ dataInicio, dataFim, limiteParlamentares: positive('--limite-discursos', 40) }));
  }
  if (args.includes('--ia')) {
    console.log(await gerarResumosIAParlamentares({ limite: positive('--limite-ia', 30) }));
  }
  if (!args.includes('--discursos') && !args.includes('--ia')) {
    console.log('Consulta limitada ao período, sem garantia de cobertura integral:', dataInicio, dataFim);
    const report = await executarSincronizacaoCompleta({ dataInicio, dataFim, limiteVotacoesCamara: positive('--limite-votacoes', 40), limiteEventosCamara: positive('--limite-eventos', 15) });
    console.log(JSON.stringify(report, null, 2));
  }
}
main().catch(err => { console.error(err); process.exitCode = 1; }).finally(() => prisma.$disconnect());
