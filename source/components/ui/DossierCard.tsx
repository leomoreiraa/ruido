import React from "react";
import { cn } from "@/lib/utils";

export interface DossierCardProps extends React.HTMLAttributes<HTMLDivElement> {
  tape?: boolean;
  tapeText?: string;
  pin?: boolean;
  clip?: boolean;
  stamp?: string;
  stampVariant?: "red" | "acid" | "green";
  barcode?: boolean;
  rotation?: "left" | "right" | "none";
  children: React.ReactNode;
}

export function DossierCard({
  tape = true,
  tapeText,
  pin,
  clip,
  stamp,
  stampVariant = "red",
  barcode = false,
  rotation = "none",
  className,
  children,
  ...props
}: DossierCardProps) {
  const rotationClass =
    rotation === "left"
      ? "transform -rotate-1 hover:rotate-0"
      : rotation === "right"
      ? "transform rotate-1 hover:rotate-0"
      : "";

  return (
    <div
      className={cn(
        "relative ruido-paper-card bg-paper-card border-3 border-ink p-5 sm:p-6 shadow-[6px_6px_0_#101010] transition-all hover:shadow-[10px_10px_0_#e42232]",
        rotationClass,
        className
      )}
      {...props}
    >
      
      {tape && (
        <div className="scotch-tape flex items-center justify-center font-mono text-[9px] font-bold tracking-wider text-ink/70">
          {tapeText || "EVIDÊNCIA // AUDITORIA"}
        </div>
      )}

      
      {pin && (
        <img
          src="/assets/safety-pin.svg"
          alt=""
          aria-hidden="true"
          className="absolute -top-3 -left-3 w-12 h-6 z-20 pointer-events-none drop-shadow"
        />
      )}

      
      {clip && (
        <img
          src="/assets/paperclip.svg"
          alt=""
          aria-hidden="true"
          className="absolute -top-4 right-6 w-5 h-12 z-20 pointer-events-none drop-shadow"
        />
      )}

      
      {stamp && (
        <div
          className={cn(
            "absolute bottom-4 right-4 z-10 pointer-events-none opacity-85 select-none",
            stampVariant === "red"
              ? "rubber-stamp rubber-stamp-red text-xs sm:text-sm"
              : stampVariant === "acid"
              ? "rubber-stamp rubber-stamp-acid text-xs sm:text-sm"
              : "rubber-stamp rubber-stamp-green text-xs sm:text-sm"
          )}
        >
          {stamp}
        </div>
      )}

      
      <div className="relative z-10">{children}</div>

      
      {barcode && (
        <div className="mt-4 pt-3 border-t-2 border-dashed border-ink/30 flex justify-between items-center text-[10px] font-mono text-ink/60">
          <img
            src="/assets/barcode.svg"
            alt="Código de barras"
            className="h-7 w-auto opacity-80"
          />
          <span className="font-bold">PROCESSO AUDITADO 2026</span>
        </div>
      )}
    </div>
  );
}
