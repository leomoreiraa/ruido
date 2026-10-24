import React from "react";

export interface PerfilIADiscursosProps {
  parlamentarNome: string;
  keywords: string[];
  resumo: string;
  modeloUsado?: string;
  geradoEm?: string | Date;
  totalDiscursos?: number;
}

export function PerfilIADiscursos({
  parlamentarNome,
  keywords,
  resumo,
  modeloUsado = "gpt-4o-mini",
  geradoEm,
  totalDiscursos,
}: PerfilIADiscursosProps) {
  const dataFormatada = geradoEm
    ? new Date(geradoEm).toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      })
    : null;

  return (
    <div className="relative ruido-paper-card bg-paper-card border-3 border-ink p-5 sm:p-6 my-6 shadow-[6px_6px_0_#101010]">
      
      <div className="scotch-tape" aria-hidden="true" />

      
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-4 pb-3 border-b-2 border-dashed border-ink/30">
        <div>
          <div className="inline-block bg-ink text-punk-acid font-mono text-[10px] font-bold px-2 py-0.5 uppercase mb-1">
            ANÁLISE DE DISCURSOS EM PLENÁRIO
          </div>
          <h3 className="font-heavy text-2xl sm:text-3xl text-ink uppercase tracking-tight">
            PERFIL TEMÁTICO &amp; PAUTAS RECORRENTES
          </h3>
          <p className="font-mono text-xs text-ink/75">
            Síntese automatizada, sujeita a imprecisões, de transcrições disponíveis sobre {parlamentarNome}
          </p>
        </div>

        <div className="rubber-stamp rubber-stamp-red text-[11px] whitespace-nowrap">
          SÍNTESE IA
        </div>
      </div>

      
      <div className="flex flex-wrap items-center gap-3 font-mono text-xs text-ink/70 mb-4 bg-paper-light border border-ink/30 p-2">
        <span>
          Modelo: <strong>{modeloUsado}</strong>
        </span>
        {dataFormatada && (
          <span>
            &bull; Gerado em: <strong>{dataFormatada}</strong>
          </span>
        )}
        {totalDiscursos !== undefined && totalDiscursos > 0 && (
          <span>
            &bull; Acervo: <strong>{totalDiscursos} discursos registrados (não necessariamente usados na síntese)</strong>
          </span>
        )}
      </div>

      
      <div className="my-4">
        <span className="block font-mono text-xs font-bold uppercase text-ink mb-2">
        </span>
        {keywords.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {keywords.map((kw, idx) => {
              const styles = [
                "bg-ink text-punk-acid border-ink",
                "bg-punk-red text-white border-ink",
                "bg-white text-ink border-ink",
                "bg-punk-acid text-ink border-ink",
              ];
              const tagStyle = styles[idx % styles.length];
              return (
                <span
                  key={idx}
                  className={`font-mono text-xs font-bold px-2.5 py-1 border-2 shadow-[2px_2px_0_#101010] transform ${
                    idx % 2 === 0 ? "-rotate-1" : "rotate-1"
                  } ${tagStyle}`}
                >
                  #{kw}
                </span>
              );
            })}
          </div>
        ) : (
          <p className="font-mono text-xs text-ink/60">
            Nenhuma palavra-chave identificada na amostra.
          </p>
        )}
      </div>

      
      <div className="mt-4 p-4 bg-white border-2 border-ink shadow-[3px_3px_0_#101010] relative">
        <div className="absolute top-2 right-3 font-mono text-[9px] text-ink/40 uppercase">
          [ TRANSCRIÇÃO SINTETIZADA ]
        </div>
        <p className="font-mono text-xs sm:text-sm text-ink/90 leading-relaxed whitespace-pre-line pt-2">
          {resumo}
        </p>
      </div>
    </div>
  );
}
