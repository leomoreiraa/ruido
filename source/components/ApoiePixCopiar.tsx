"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

export function ApoiePixCopiar({ chave, copiaECola }: { chave: string; copiaECola: string }) {
  const [copiado, setCopiado] = useState<"codigo" | "chave" | "erro" | null>(null);

  async function copiar(valor: string, tipo: "codigo" | "chave") {
    try {
      if (!navigator.clipboard?.writeText) throw new Error("Clipboard indisponível");
      await navigator.clipboard.writeText(valor);
      setCopiado(tipo);
    } catch {
      // Compatibilidade com navegadores móveis sem acesso à API assíncrona.
      try {
        const campo = document.createElement("textarea");
        campo.value = valor;
        campo.readOnly = true;
        campo.style.position = "fixed";
        campo.style.opacity = "0";
        document.body.appendChild(campo);
        campo.select();
        const ok = document.execCommand("copy");
        campo.remove();
        if (!ok) throw new Error("Falha ao copiar");
        setCopiado(tipo);
      } catch {
        setCopiado("erro");
      }
    }
  }

  return (
    <div className="w-full min-w-0 space-y-3">
      <button
        type="button"
        onClick={() => copiar(copiaECola, "codigo")}
        className="flex min-h-12 w-full items-center justify-center gap-2 border-[3px] border-ink bg-punk-acid px-3 py-3 font-heavy text-xs uppercase tracking-wide text-ink shadow-[4px_4px_0_#111] transition-transform hover:-translate-y-1 focus-visible:outline focus-visible:outline-4 focus-visible:outline-punk-red sm:text-sm"
      >
        {copiado === "codigo" ? <Check size={19} aria-hidden="true" /> : <Copy size={19} aria-hidden="true" />}
        {copiado === "codigo" ? "CÓDIGO COPIADO!" : "COPIAR PIX COPIA E COLA"}
      </button>
      <button
        type="button"
        onClick={() => copiar(chave, "chave")}
        className="flex min-h-11 w-full items-center justify-center gap-2 border-[3px] border-ink bg-paper-light px-3 py-2 font-heavy text-xs uppercase text-ink hover:bg-paper sm:text-sm"
      >
        {copiado === "chave" ? <Check size={16} aria-hidden="true" /> : <Copy size={16} aria-hidden="true" />}
        {copiado === "chave" ? "CHAVE COPIADA!" : "COPIAR SÓ A CHAVE"}
      </button>
      <label htmlFor="chave-pix-ruido" className="block font-mono text-[11px] font-bold uppercase text-ink">
        Chave Pix pública
      </label>
      <input
        id="chave-pix-ruido"
        readOnly
        value={chave}
        onFocus={event => event.target.select()}
        className="w-full min-w-0 border-2 border-ink bg-white p-3 font-mono text-xs text-ink selection:bg-punk-acid"
      />
      <details className="border border-ink/40 bg-paper-light p-3 text-xs text-ink">
        <summary className="cursor-pointer font-bold">Ver código Pix completo</summary>
        <p className="mt-2 break-all font-mono text-[11px] leading-relaxed">{copiaECola}</p>
      </details>
      <p role="status" aria-live="polite" className="min-h-4 font-mono text-xs text-ink">
        {copiado === "erro"
          ? "Não foi possível copiar automaticamente. Selecione a chave acima e copie manualmente."
          : copiado === "codigo"
            ? "Pix Copia e Cola copiado. Abra o aplicativo do banco para pagar."
            : copiado === "chave"
              ? "Chave Pix copiada para a área de transferência."
              : "Escolha um botão para copiar instantaneamente."}
      </p>
    </div>
  );
}
