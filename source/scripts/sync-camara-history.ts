import { executarHistorico, HISTORY_HELP, parseHistoryArgs } from "../lib/services/syncHistory";

async function run() {
  const args = process.argv.slice(2);
  if (args.includes("--help") || args.includes("-h")) {
    console.log(HISTORY_HELP);
    return;
  }
  const options = parseHistoryArgs(args);
  const { prisma } = await import("../lib/prisma");
  try {
    await executarHistorico(options);
  } finally {
    await prisma.$disconnect();
  }
}

run().catch(error => {
  console.error("Importação interrompida; janela atual pode estar parcial:", error);
  process.exitCode = 1;
});
