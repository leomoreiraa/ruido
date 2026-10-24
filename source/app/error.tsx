// app/error.tsx
"use client";

import React, { useEffect } from "react";
import Link from "next/link";

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Erro capturado no frontend:", error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] items-center justify-center p-4">
      <div className="relative max-w-lg w-full bg-paper-card border-4 border-punk-red p-8 shadow-[12px_12px_0_#101010] text-center space-y-5 transform rotate-1">
        <div className="scotch-tape" aria-hidden="true" />

        <div className="inline-block bg-punk-red text-white font-heavy text-xs px-3 py-1 uppercase tracking-widest">
          ⚠ ALERTA DE SISTEMA // FALHA TÉCNICA
        </div>

        <h1 className="font-heavy text-4xl sm:text-5xl uppercase tracking-tight text-ink leading-tight">
          O SISTEMA <span className="text-punk-red">FALHOU.</span>
        </h1>

        <p className="font-mono text-xs sm:text-sm text-ink/80 max-w-md mx-auto leading-relaxed border-l-4 border-punk-red pl-3 text-left">
          Não foi possível consultar os registros legislativos oficiais neste momento. O servidor ou a API externa pode estar instável.
        </p>

        {error.message && (
          <div className="border-2 border-ink bg-white p-3 text-left font-mono text-[11px] text-punk-red overflow-auto max-h-24">
            {error.message}
          </div>
        )}

        <div className="pt-2 flex flex-col sm:flex-row gap-3 justify-center">
          <button
            type="button"
            onClick={() => reset()}
            className="btn-punk font-heavy tracking-wider text-xs px-5 py-2.5"
          >
            TENTAR NOVAMENTE ↺
          </button>
          <Link
            href="/"
            className="btn-punk-dark font-heavy tracking-wider text-xs px-5 py-2.5"
          >
            &larr; VOLTAR AO INÍCIO
          </Link>
        </div>
      </div>
    </div>
  );
}
