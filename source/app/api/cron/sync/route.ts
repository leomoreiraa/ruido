import { NextRequest, NextResponse } from "next/server";
import { autorizarCron, lerDiasSincronizacao } from "@/lib/cron-auth";
import {
  executarSincronizacaoCompleta,
  SyncLockError,
} from "@/lib/services/syncLegislativo";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(request: NextRequest) {
  if (!autorizarCron(request.headers.get("authorization"), process.env.CRON_SECRET)) {
    return NextResponse.json(
      { ok: false, error: "Não autorizado." },
      { status: 401 }
    );
  }

  let diasRetroativos: number;
  try {
    diasRetroativos = lerDiasSincronizacao(request.nextUrl.searchParams.get("dias"));
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Parâmetro inválido." },
      { status: 400 }
    );
  }

  try {
    const relatorio = await executarSincronizacaoCompleta(diasRetroativos);
    return NextResponse.json(
      {
        ok: true,
        mensagem: "Sincronização legislativa concluída com sucesso.",
        relatorio,
      },
      { status: 200 }
    );
  } catch (error) {
    if (error instanceof SyncLockError) {
      return NextResponse.json(
        { ok: false, error: "Sincronização já está em andamento ou bloqueada por outra execução." },
        { status: 409 }
      );
    }

    console.error("[CRON SYNC ERROR]:", error);
    return NextResponse.json(
      { ok: false, error: "Falha ao executar a sincronização legislativa." },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  return POST(request);
}
