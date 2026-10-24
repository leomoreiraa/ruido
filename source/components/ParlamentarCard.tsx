import React from "react";
import Link from "next/link";
import { PoliticianPhoto } from "@/components/PoliticianPhoto";

export interface ParlamentarCardProps {
  id: string;
  nome: string;
  partido: string;
  uf: string;
  casa: string;
  urlFoto: string | null;
  ativo: boolean;
  totalVotos?: number;
  totalPresencas?: number;
  index?: number;
}

export function ParlamentarCard({
  id,
  nome,
  partido,
  uf,
  casa,
  urlFoto,
  ativo,
  totalVotos = 0,
  totalPresencas = 0,
}: ParlamentarCardProps) {
  const isCamara = casa === "CAMARA";

  const rotationClasses = [
    "transform -rotate-1.5 hover:rotate-0",
    "transform rotate-2 hover:rotate-0",
    "transform -rotate-2 hover:rotate-0",
    "transform rotate-1 hover:rotate-0",
    "transform -rotate-1 hover:rotate-0",
  ];
  const charSum = id.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0);
  const rotClass = rotationClasses[charSum % rotationClasses.length];

  return (
    <article className={`group relative ruido-paper-card ruido-parlamentar-folha bg-paper-card border-3 border-ink p-4 sm:p-5 shadow-[6px_6px_0_#101010] transition-all duration-200 hover:-translate-y-2 hover:shadow-[10px_10px_0_#e42232] flex flex-col justify-between ${rotClass}`}>
      
      <div
        className="ruido-card-tape absolute -top-3.5 right-4 pointer-events-none z-30"
        style={{ transform: `rotate(${((charSum % 14) - 7)}deg)` }}
      />

      <div>
        
        <div className="flex items-center justify-between gap-2 mb-3 pb-2 border-b-2 border-dashed border-ink/30 font-mono text-[11px]">
          <span className="font-bold text-ink">
            {isCamara ? (
              <span className="bg-ink text-paper px-2 py-0.5 font-mono shadow-[2px_2px_0_#e42232] inline-block transform -rotate-1">
                DEP. FEDERAL
              </span>
            ) : (
              <span className="bg-punk-red text-white px-2 py-0.5 font-mono shadow-[2px_2px_0_#101010] inline-block transform rotate-1">
                SENADOR(A)
              </span>
            )}
          </span>

          <span className="font-bold bg-punk-acid text-ink px-2 py-0.5 border-2 border-ink shadow-[2px_2px_0_#101010] transform rotate-2">
            {partido || "S/PART"} &bull; {uf}
          </span>
        </div>

        
        <div className="flex gap-3.5 items-start">
          
          <div className="relative flex-shrink-0 group/photo">
            <PoliticianPhoto
              urlFoto={urlFoto}
              nome={nome}
              width={84}
              height={105}
              className="w-20 h-26 sm:w-22 sm:h-28"
            />
            <span className="absolute -bottom-2 -left-1 bg-punk-red text-white text-[9px] font-mono font-bold px-1.5 py-0.2 border border-ink transform -rotate-3 z-30">
              REGISTRO
            </span>
          </div>

          <div className="flex-1 min-w-0">
            <h3 className="font-heavy text-lg sm:text-xl text-ink leading-tight tracking-tight uppercase group-hover:text-punk-red transition-colors">
              <Link className="ruido-unmasked-text-link" href={`/parlamentares/${id}`}>{nome}</Link>
            </h3>

            <div className="mt-1 font-mono text-xs text-ink/75">
              <span>Status: </span>
              <strong className={ativo ? "text-green-700 uppercase" : "text-punk-red uppercase"}>
                {ativo ? "Em exercício" : "Fora do exercício"}
              </strong>
            </div>

            
            <div className="mt-2.5 grid grid-cols-2 gap-2 font-mono text-[11px]">
              <div className="bg-paper border border-ink p-1 text-center shadow-[1px_1px_0_#101010]">
                <span className="block text-[9px] text-ink/60 uppercase font-bold">Votos</span>
                <strong className="text-ink text-sm font-heavy">{totalVotos}</strong>
              </div>
              <div className="bg-paper border border-ink p-1 text-center shadow-[1px_1px_0_#101010]">
                <span className="block text-[9px] text-ink/60 uppercase font-bold">Presenças</span>
                <strong className="text-ink text-sm font-heavy">{totalPresencas}</strong>
              </div>
            </div>
          </div>
        </div>
      </div>

      
      <div className="mt-3.5 pt-2 border-t border-dashed border-ink/20 flex justify-between items-center text-xs font-mono font-bold">
        <Link
          href={`/parlamentares/${id}`}
          className="text-punk-red group-hover:underline flex items-center gap-1 group-hover:translate-x-1 transition-transform"
        >
          <span>DOSSIÊ COMPLETO</span>
          <span aria-hidden="true">&rarr;</span>
        </Link>
        <span className="text-[10px] text-ink/40 uppercase font-mono tracking-widest">
          #AUDIT
        </span>
      </div>
    </article>
  );
}
