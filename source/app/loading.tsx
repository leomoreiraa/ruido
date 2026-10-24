// app/loading.tsx
import React from "react";

export default function Loading() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] p-8 text-center">
      <div className="relative bg-paper-card border-4 border-ink p-8 shadow-[10px_10px_0_#101010] max-w-md w-full space-y-4 transform -rotate-1">
        <div className="scotch-tape" aria-hidden="true" />

        <div className="inline-block bg-punk-red text-white font-mono font-bold text-xs px-3 py-1 uppercase tracking-wider animate-pulse">
          AUDITORIA CÍVICA EM ANDAMENTO
        </div>

        <div className="font-heavy text-3xl sm:text-4xl uppercase tracking-tight text-ink">
          CARREGANDO DADOS...
        </div>

        <p className="font-mono text-xs text-ink/75 leading-relaxed">
          Consultando registros oficiais da Câmara dos Deputados, Senado Federal e TSE. Aguarde um instante.
        </p>

        {/* Punk progress bar */}
        <div className="w-full h-4 bg-ink/10 border-2 border-ink overflow-hidden p-0.5">
          <div className="h-full bg-punk-acid border-r-2 border-ink animate-[drift_2s_linear_infinite] w-full" />
        </div>
      </div>
    </div>
  );
}
