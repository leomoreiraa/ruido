// components/VotacaoVotosList.tsx
"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { PoliticianPhoto } from "@/components/PoliticianPhoto";

export interface VotoNominalItem {
  id: string;
  opcao: string;
  opcaoOriginal: string | null;
  partidoNaEpoca: string | null;
  ufNaEpoca: string | null;
  parlamentar: {
    id: string;
    nome: string;
    partido: string;
    uf: string;
    urlFoto: string | null;
  };
}

interface VotacaoVotosListProps {
  votos: VotoNominalItem[];
  votacaoSecreta: boolean;
  cobertura?: string;
}

export function VotacaoVotosList({ votos, votacaoSecreta, cobertura }: VotacaoVotosListProps) {
  const [filtro, setFiltro] = useState<string>("");

  const votosFiltrados = useMemo(() => {
    if (!filtro) return votos;
    return votos.filter((v) => v.opcao === filtro);
  }, [votos, filtro]);

  if (votos.length === 0) {
    return (
      <div className="p-5 bg-paper-card border-2 border-ink font-mono text-xs text-center space-y-2">
        <div className="rubber-stamp rubber-stamp-red text-[10px] inline-block">
          {votacaoSecreta ? "Votação Secreta" : "Votos nominais indisponíveis"}
        </div>
        <p className="text-ink/75 max-w-lg mx-auto">
          {votacaoSecreta
            ? "Esta votação está identificada como secreta. Votos individuais indisponíveis nos registros consultados."
            : cobertura === "PLACAR_AGREGADO" ? "Contagens agregadas publicadas, sem lista individual de votos nesta consulta." : cobertura === "DADOS_PARCIAIS" ? "A API não disponibilizou o detalhe desta votação. A listagem oficial foi preservada." : "Não há lista individual de votos na fonte consultada; isso não permite atribuir voto a nenhum parlamentar."}
        </p>
      </div>
    );
  }

  const contagemSim = votos.filter((v) => v.opcao === "SIM").length;
  const contagemNao = votos.filter((v) => v.opcao === "NAO").length;
  const contagemAbstencao = votos.filter((v) => v.opcao === "ABSTENCAO").length;

  return (
    <div className="space-y-4">
      {/* Title & Filter buttons */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-3 border-b-2 border-dashed border-ink/20">
        <h4 className="font-heavy text-lg uppercase tracking-wider text-ink">
          VOTOS POR PARLAMENTAR ({votos.length})
        </h4>

        <div className="flex flex-wrap gap-1.5 font-mono text-xs">
          <button
            type="button"
            onClick={() => setFiltro("")}
            className={`px-3 py-1 font-bold border-2 border-ink transition-all ${
              filtro === ""
                ? "bg-ink text-paper shadow-[2px_2px_0_#e42232]"
                : "bg-paper text-ink hover:bg-white"
            }`}
          >
            TODOS ({votos.length})
          </button>
          <button
            type="button"
            onClick={() => setFiltro("SIM")}
            className={`px-3 py-1 font-bold border-2 border-ink transition-all ${
              filtro === "SIM"
                ? "bg-green-600 text-white shadow-[2px_2px_0_#101010]"
                : "bg-paper text-green-800 hover:bg-green-100"
            }`}
          >
            SIM ({contagemSim})
          </button>
          <button
            type="button"
            onClick={() => setFiltro("NAO")}
            className={`px-3 py-1 font-bold border-2 border-ink transition-all ${
              filtro === "NAO"
                ? "bg-punk-red text-white shadow-[2px_2px_0_#101010]"
                : "bg-paper text-punk-red hover:bg-red-100"
            }`}
          >
            NÃO ({contagemNao})
          </button>
          <button
            type="button"
            onClick={() => setFiltro("ABSTENCAO")}
            className={`px-3 py-1 font-bold border-2 border-ink transition-all ${
              filtro === "ABSTENCAO"
                ? "bg-punk-acid text-ink shadow-[2px_2px_0_#101010]"
                : "bg-paper text-ink/80 hover:bg-yellow-100"
            }`}
          >
            ABSTENÇÃO ({contagemAbstencao})
          </button>
        </div>
      </div>

      {/* Votes table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left font-mono text-xs">
          <thead>
            <tr>
              <th>PARLAMENTAR</th>
              <th>PARTIDO</th>
              <th>UF</th>
              <th>DECISÃO DO VOTO</th>
            </tr>
          </thead>
          <tbody>
            {votosFiltrados.map((v) => {
              const p = v.parlamentar;
              const isSim = v.opcao === "SIM";
              const isNao = v.opcao === "NAO";

              return (
                <tr key={v.id}>
                  <td className="font-bold">
                    <Link
                      href={`/parlamentares/${p.id}`}
                      className="flex items-center gap-2.5 hover:text-punk-red group"
                    >
                      <PoliticianPhoto
                        urlFoto={p.urlFoto}
                        nome={p.nome}
                        width={36}
                        height={44}
                        className="w-9 h-11 flex-shrink-0"
                      />
                      <span className="group-hover:underline">{p.nome}</span>
                    </Link>
                  </td>
                  <td>
                    <span className="font-bold bg-paper-dark px-1.5 py-0.5 border border-ink/40">
                      {v.partidoNaEpoca || p.partido}
                    </span>
                  </td>
                  <td>{v.ufNaEpoca || p.uf}</td>
                  <td>
                    <span
                      className={`font-heavy text-xs px-2.5 py-1 border-2 border-ink uppercase inline-block shadow-[1px_1px_0_#101010] ${
                        isSim
                          ? "bg-green-600 text-white"
                          : isNao
                          ? "bg-punk-red text-white"
                          : "bg-ink text-paper"
                      }`}
                    >
                      {v.opcaoOriginal || v.opcao}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
