// components/PoliticianPhoto.tsx
"use client";
import React, { useState } from "react";
import { cn } from "@/lib/utils";

interface PoliticianPhotoProps {
  urlFoto: string | null;
  nome: string;
  width?: number;
  height?: number;
  className?: string;
  imgClassName?: string;
  aspect?: string;
}

export function PoliticianPhoto({
  urlFoto,
  nome,
  width = 80,
  height = 96,
  className,
  imgClassName,
  aspect,
}: PoliticianPhotoProps) {
  const [quebrada, setQuebrada] = useState(false);
  const [efeitoAtivo, setEfeitoAtivo] = useState(false);
  return (
    <div
      className={cn(
        "politician-mugshot relative border-2 sm:border-3 border-ink shadow-[3px_3px_0_#101010] bg-ink cursor-pointer select-none",
        className
      )}
      role="button"
      tabIndex={0}
      aria-label={`Alternar efeito de cartaz na foto de ${nome}`}
      aria-pressed={efeitoAtivo}
      data-photo-active={efeitoAtivo ? "true" : "false"}
      onClick={(evento) => { evento.stopPropagation(); setEfeitoAtivo((atual) => !atual); }}
      onKeyDown={(evento) => {
        if (evento.key === "Enter" || evento.key === " ") {
          evento.preventDefault();
          setEfeitoAtivo((atual) => !atual);
        }
      }}
    >
      {urlFoto && !quebrada ? (
        <img
          src={urlFoto}
          onError={() => setQuebrada(true)}
          alt={nome}
          width={width}
          height={height}
          loading="lazy"
          className={cn(
            "w-full h-full object-cover xerox-img block transition-transform duration-300",
            imgClassName
          )}
        />
      ) : (
        <div className="w-full h-full min-h-[96px] bg-paper-dark flex items-center justify-center font-heavy text-ink/40 text-lg sm:text-xl">
          {urlFoto ? "FOTO INDISPONÍVEL" : "SEM FOTO"}
        </div>
      )}

      {/* Red Layer on Hover */}
      <div className="target-red-layer" aria-hidden="true" />

      {/* Punk Stencil Smiley Stamp from user upload on Hover */}
      <div className="target-stamp" aria-hidden="true">
        <img
          src="/assets/punk-target-white.png"
          alt=""
          className="w-full h-full object-contain filter drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]"
        />
      </div>
    </div>
  );
}
