import { sincronizarEmendasOficiais } from "../lib/services/emendasPortal";
import { prisma } from "../lib/prisma";

async function main() {
  const args = new Map<string, string>();
  let reprocessar = false;
  for (const arg of process.argv.slice(2)) {
    if (arg === "--reprocessar") { reprocessar = true; continue; }
    const match = arg.match(/^--(inicio|fim|paginas)=(\d+)$/);
    if (!match || args.has(match[1])) throw new Error("Uso: npx tsx scripts/sync-emendas.ts --inicio=2022 --fim=2026 --paginas=80");
    args.set(match[1], match[2]);
  }
  const report = await sincronizarEmendasOficiais({
    inicio: Number(args.get("inicio") ?? 2022),
    fim: Number(args.get("fim") ?? new Date().getUTCFullYear()),
    paginas: Number(args.get("paginas") ?? 80),
    reprocessar,
  });
  console.log(JSON.stringify(report, null, 2));
}
main().catch(error => {
  console.error("Erro na sincronização oficial de emendas:", error);
  process.exitCode = 1;
}).finally(() => prisma.$disconnect());
