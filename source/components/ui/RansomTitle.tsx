// components/ui/RansomTitle.tsx
import React from "react";
import { cn } from "@/lib/utils";

interface RansomTitleProps {
  text: string;
  className?: string;
  subtitle?: string;
  tag?: string;
  stamp?: string;
}

export function RansomTitle({
  text,
  className,
  subtitle,
  tag,
  stamp,
}: RansomTitleProps) {
  const words = text.split(" ");

  // Alternating styles for ransom cut-out feel
  const cutStyles = [
    "cut-black",
    "cut-red",
    "cut-white",
    "cut-acid",
  ];

  return (
    <div className={cn("relative my-6", className)}>
      {tag && (
        <div className="inline-flex items-center gap-2 font-mono text-[11px] font-bold tracking-widest bg-ink text-punk-acid px-3 py-1 mb-3 border-2 border-punk-red shadow-[3px_3px_0_#101010] transform -rotate-1">
          <span className="w-2 h-2 bg-punk-acid inline-block" />
          <span>{tag}</span>
          <span className="text-punk-red">///</span>
        </div>
      )}

      {stamp && (
        <span className="absolute -top-3 right-2 sm:right-6 rubber-stamp rubber-stamp-red font-heavy text-xs sm:text-sm z-10 pointer-events-none opacity-90">
          {stamp}
        </span>
      )}

      <h1 className="font-heavy text-3xl sm:text-5xl md:text-6xl tracking-tight leading-none uppercase flex flex-wrap gap-2 items-center">
        {words.map((word, idx) => {
          const style = cutStyles[idx % cutStyles.length];
          return (
            <span key={idx} className={style}>
              {word}
            </span>
          );
        })}
      </h1>

      {subtitle && (
        <p className="font-mono text-xs sm:text-sm text-ink/80 max-w-2xl mt-4 border-l-4 border-punk-red pl-3 py-0.5 leading-relaxed">
          {subtitle}
        </p>
      )}
    </div>
  );
}
