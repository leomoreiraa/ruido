"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { normalizarTexto } from "@/lib/utils";
import { PoliticianPhoto } from "@/components/PoliticianPhoto";

interface ParlamentarBusca {
  id: string;
  nome: string;
  partido: string;
  uf: string;
  casa: string;
  urlFoto: string | null;
  ativo: boolean;
}

interface HomeInstantSearchProps {
  parlamentares: ParlamentarBusca[];
}

export function HomeInstantSearch({ parlamentares }: HomeInstantSearchProps) {
  const [termo, setTermo] = useState("");
  const router = useRouter();

  const resultados = useMemo(() => {
    const q = normalizarTexto(termo.trim());
    if (!q || q.length < 2) return [];

    return parlamentares
      .filter((p) => {
        const nomeNorm = normalizarTexto(p.nome);
        const partidoNorm = normalizarTexto(p.partido);
        const ufNorm = normalizarTexto(p.uf);
        return (
          nomeNorm.includes(q) ||
          partidoNorm.includes(q) ||
          ufNorm.includes(q)
        );
      })
      .slice(0, 6);
  }, [termo, parlamentares]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (termo.trim()) {
      router.push(`/parlamentares?q=${encodeURIComponent(termo.trim())}`);
    }
  }

  return (
    <div className="ruido-home-search relative my-4">
      <form onSubmit={handleSubmit} className="relative z-10">
        <label
          htmlFor="search-input"
          className="block font-heavy text-lg sm:text-xl uppercase tracking-wider text-ink mb-2"
        >
          BUSQUE UM PARLAMENTAR
        </label>

        <div className="flex flex-col sm:flex-row gap-2">
          <input
            id="search-input"
            type="text"
            value={termo}
            onChange={(e) => setTermo(e.target.value)}
            placeholder="Nome, partido ou UF"
            className="ruido-flat-input min-w-0 flex-1 font-mono text-sm"
          />
          <button
            type="submit"
            className="ruido-action ruido-action-primary whitespace-nowrap"
          >
            BUSCAR ↗
          </button>
        </div>
      </form>

      
      {termo.trim().length >= 2 && (
        <div className="ruido-search-results relative z-20 mt-3 p-3 sm:p-4">
          <div className="flex justify-between items-center mb-3 pb-2 border-b-2 border-dashed border-ink/30 font-mono text-xs font-bold">
            <span className="text-ink">
              RESULTADOS ({resultados.length})
            </span>
            <span className="text-punk-red text-[10px] uppercase">
              ENTER PARA VER TODOS
            </span>
          </div>

          {resultados.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
              {resultados.map((p) => {
                const isCamara = p.casa === "CAMARA";
                return (
                  <Link
                    key={p.id}
                    href={`/parlamentares/${p.id}`}
                    className="ruido-search-result group flex items-center gap-2.5 p-2"
                  >
                    <PoliticianPhoto
                      urlFoto={p.urlFoto}
                      nome={p.nome}
                      width={40}
                      height={48}
                      className="w-10 h-12 flex-shrink-0"
                    />
                    <div className="min-w-0 flex-1 font-mono">
                      <strong className="block text-xs text-ink truncate group-hover:text-punk-red">
                        {p.nome}
                      </strong>
                      <span className="block text-[10px] text-ink/70">
                        {isCamara ? "Dep." : "Sen."} &bull; {p.partido}-{p.uf}
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>
          ) : (
            <p className="font-mono text-xs text-punk-red py-2">
              Nenhum parlamentar encontrado para &quot;{termo}&quot;. Verifique a grafia ou tente buscar pelo partido/estado.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
