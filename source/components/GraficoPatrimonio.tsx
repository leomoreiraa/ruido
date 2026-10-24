"use client";

import React, { useState } from "react";
import { formatarMoeda } from "@/lib/utils";
import { BemDeclaradoItem } from "@/lib/types";

export interface GraficoPatrimonioProps {
  bensDeclarados?: BemDeclaradoItem[];
  bens?: BemDeclaradoItem[];
  parlamentarNome?: string;
  totaisTse?: Array<{ ano: number; totalDeclarado: number; quantidadeBens: number; fonte: string }>;
}

export function GraficoPatrimonio({
  bensDeclarados,
  bens,
  parlamentarNome,
  totaisTse = [],
}: GraficoPatrimonioProps) {
  const listaBens = bensDeclarados || bens || [];
  const [modoVisualizacao, setModoVisualizacao] = useState<"grafico" | "detalhes">("grafico");

  if (listaBens.length === 0 && totaisTse.length > 0) {
    const maior = Math.max(1, ...totaisTse.map(x => x.totalDeclarado));
    return (
      <section className="ruido-paper-card bg-paper-card p-5 sm:p-6 space-y-4">
        <h3 className="font-heavy text-2xl uppercase text-ink">PATRIMÔNIO AUTODECLARADO AO TSE</h3>
        <p className="font-mono text-xs text-ink/80">Totais oficiais vinculados à candidatura por identidade verificada. A declaração não equivale a avaliação de mercado nem prova irregularidade.</p>
        {totaisTse.slice().sort((a,b) => a.ano - b.ano).map(x => (
          <div key={x.ano} className="bg-paper-light border-2 border-ink p-3 space-y-2">
            <div className="flex flex-wrap justify-between gap-2 font-mono text-sm text-ink"><strong>{x.ano} • {x.quantidadeBens} bens</strong><strong>{formatarMoeda(x.totalDeclarado)}</strong></div>
            <div className="h-4 bg-ink/10 border border-ink"><div className="h-full bg-punk-acid" style={{width: `${Math.max(1, x.totalDeclarado / maior * 100)}%`}} /></div>
            <a className="ruido-dossier-source" href={x.fonte} target="_blank" rel="noopener noreferrer">CONSULTAR ARQUIVO OFICIAL TSE ↗</a>
          </div>
        ))}
      </section>
    );
  }
  if (listaBens.length === 0) {
    return (
      <div className="bg-paper-card border-3 border-ink p-6 text-center font-mono space-y-2">
        <div className="rubber-stamp rubber-stamp-acid text-xs inline-block mb-1">
          DADOS NÃO ENCONTRADOS
        </div>
        <h4 className="font-heavy text-xl uppercase text-ink">
          Integração Patrimonial Não Concluída
        </h4>
        <p className="text-xs text-ink/75 max-w-md mx-auto">
          Não foi encontrada uma declaração com vínculo de identidade confirmado nos dados publicados. Isso não significa patrimônio zero nem ausência de declaração.
        </p>
      </div>
    );
  }

  const bensPorAno = listaBens.reduce<Record<number, BemDeclaradoItem[]>>((acc, item) => {
    if (!acc[item.anoEleicao]) {
      acc[item.anoEleicao] = [];
    }
    acc[item.anoEleicao].push(item);
    return acc;
  }, {});

  const anosDisponiveis = Object.keys(bensPorAno)
    .map(Number)
    .sort((a, b) => a - b);

  const totaisPorAno = anosDisponiveis.map((ano) => {
    const itensAno = bensPorAno[ano] || [];
    const soma = itensAno.reduce((total, b) => total + b.valorDeclarado, 0);
    return {
      ano,
      total: soma,
      itens: itensAno,
    };
  });

  const primeiroAno = totaisPorAno[0];
  const ultimoAno = totaisPorAno[totaisPorAno.length - 1];

  let variacaoPercentual: number | null = null;
  if (totaisPorAno.length >= 2 && primeiroAno && ultimoAno && primeiroAno.total > 0) {
    variacaoPercentual = ((ultimoAno.total - primeiroAno.total) / primeiroAno.total) * 100;
  }

  const maiorValor = Math.max(...totaisPorAno.map((t) => t.total), 1);

  return (
    <div className="relative bg-paper-card border-3 border-ink p-5 sm:p-6 my-6 shadow-[6px_6px_0_#101010]">
      
      <div className="scotch-tape-corner" aria-hidden="true" />

      
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-5 pb-4 border-b-2 border-dashed border-ink/30">
        <div>
          <div className="inline-block bg-punk-red text-white font-mono text-[10px] font-bold px-2 py-0.5 uppercase mb-1">
            AUDITORIA PATRIMONIAL // TSE
          </div>
          <h3 className="font-heavy text-2xl sm:text-3xl text-ink uppercase tracking-tight">
            EVOLUÇÃO PATRIMONIAL DECLARADA
          </h3>
          <p className="font-mono text-xs text-ink/75">
            Bens e ativos informados à Justiça Eleitoral em disputas de mandato
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setModoVisualizacao("grafico")}
            className={`font-mono text-xs font-bold px-3 py-1.5 border-2 border-ink transition-all ${
              modoVisualizacao === "grafico"
                ? "bg-punk-acid text-ink shadow-[2px_2px_0_#101010]"
                : "bg-paper text-ink/70 hover:bg-white"
            }`}
          >
            GRÁFICO
          </button>
          <button
            type="button"
            onClick={() => setModoVisualizacao("detalhes")}
            className={`font-mono text-xs font-bold px-3 py-1.5 border-2 border-ink transition-all ${
              modoVisualizacao === "detalhes"
                ? "bg-punk-acid text-ink shadow-[2px_2px_0_#101010]"
                : "bg-paper text-ink/70 hover:bg-white"
            }`}
          >
            DETALHAMENTO
          </button>
        </div>
      </div>

      
      {variacaoPercentual !== null && (
        <div className="bg-paper-light border-2 border-ink p-3 mb-6 shadow-[3px_3px_0_#101010] flex flex-wrap items-center justify-between gap-3 font-mono text-xs">
          <div>
            <strong className="text-ink uppercase">Variação Total Declarada:</strong>
            <span className="text-ink/70 ml-1">
              De {primeiroAno.ano} ({formatarMoeda(primeiroAno.total)}) até {ultimoAno.ano} ({formatarMoeda(ultimoAno.total)})
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span
              className={`font-heavy text-2xl leading-none ${
                variacaoPercentual > 50
                  ? "text-punk-red"
                  : variacaoPercentual >= 0
                  ? "text-green-700"
                  : "text-ink"
              }`}
            >
              {variacaoPercentual >= 0 ? "+" : ""}
              {variacaoPercentual.toFixed(1)}%
            </span>
            {variacaoPercentual > 100 && (
              <span className="rubber-stamp rubber-stamp-red text-[10px]">
                ALTA EXPRESSIVA
              </span>
            )}
          </div>
        </div>
      )}

      {modoVisualizacao === "grafico" ? (
        <div className="space-y-4">
          {totaisPorAno.map((dado) => {
            const larguraRelativa = Math.max(8, Math.round((dado.total / maiorValor) * 100));
            return (
              <div
                key={dado.ano}
                className="bg-paper-light border-2 border-ink p-3 shadow-[3px_3px_0_#101010]"
              >
                <div className="flex justify-between items-center mb-1.5 font-mono text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-heavy text-lg bg-ink text-paper px-2 py-0.5">
                      {dado.ano}
                    </span>
                    <span className="text-ink/70">
                      ({dado.itens.length} bens declarados)
                    </span>
                  </div>
                  <strong className="font-heavy text-lg text-ink">
                    {formatarMoeda(dado.total)}
                  </strong>
                </div>

                <div className="w-full h-5 bg-ink/10 border-2 border-ink overflow-hidden">
                  <div
                    style={{ width: `${larguraRelativa}%` }}
                    className="h-full bg-punk-acid border-r-2 border-ink transition-all duration-500"
                  />
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="space-y-6">
          {totaisPorAno.map((dado) => (
            <div
              key={dado.ano}
              className="bg-paper-light border-2 border-ink p-4 shadow-[4px_4px_0_#101010]"
            >
              <div className="flex justify-between items-center mb-3 pb-2 border-b-2 border-dashed border-ink/30">
                <h4 className="font-heavy text-xl uppercase text-ink">
                  Ano Eleitoral {dado.ano}
                </h4>
                <span className="font-heavy text-xl text-punk-red">
                  TOTAL: {formatarMoeda(dado.total)}
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left font-mono text-xs">
                  <thead>
                    <tr>
                      <th>TIPO DE BEM</th>
                      <th>DESCRIÇÃO DO ATIVO</th>
                      <th>VALOR DECLARADO</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dado.itens.map((b, i) => (
                      <tr key={i}>
                        <td className="font-bold text-ink whitespace-nowrap">
                          {b.tipoBem}
                        </td>
                        <td className="text-ink/80">{b.descricao}</td>
                        <td className="font-bold whitespace-nowrap text-ink">
                          {formatarMoeda(b.valorDeclarado)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
