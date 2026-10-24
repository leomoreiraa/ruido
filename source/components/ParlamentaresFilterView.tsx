// components/ParlamentaresFilterView.tsx
"use client";

import React, { useState, useMemo } from "react";
import { ParlamentarCard } from "@/components/ParlamentarCard";
import { normalizarTexto } from "@/lib/utils";

export interface ParlamentarItem {
  id: string;
  nome: string;
  partido: string;
  uf: string;
  casa: string;
  urlFoto: string | null;
  ativo: boolean;
  totalVotos?: number;
  totalPresencas?: number;
}

export type ParlamentarListItem = ParlamentarItem;

interface ParlamentaresFilterViewProps {
  parlamentaresIniciais: ParlamentarItem[];
  partidosDisponiveis: string[];
}

const ITENS_POR_PAGINA = 24;

const UFS_BRASIL = [
  "AC", "AL", "AM", "AP", "BA", "CE", "DF", "ES", "GO", "MA",
  "MG", "MS", "MT", "PA", "PB", "PE", "PI", "PR", "RJ", "RN",
  "RO", "RR", "RS", "SC", "SE", "SP", "TO"
];

export function ParlamentaresFilterView({
  parlamentaresIniciais,
  partidosDisponiveis,
}: ParlamentaresFilterViewProps) {
  const [busca, setBusca] = useState("");
  const [casa, setCasa] = useState("");
  const [partido, setPartido] = useState("");
  const [uf, setUf] = useState("");
  const [pagina, setPagina] = useState(1);

  const filtrados = useMemo(() => {
    const buscaNorm = normalizarTexto(busca.trim());

    return parlamentaresIniciais.filter((p) => {
      if (casa && p.casa !== casa) {
        return false;
      }

      if (partido && p.partido !== partido) {
        return false;
      }

      if (uf && p.uf !== uf) {
        return false;
      }

      if (buscaNorm) {
        const nomeNorm = normalizarTexto(p.nome);
        const partidoNorm = normalizarTexto(p.partido);
        const ufNorm = normalizarTexto(p.uf);

        const matchNome = nomeNorm.includes(buscaNorm);
        const matchPartido = partidoNorm.includes(buscaNorm);
        const matchUf = ufNorm.includes(buscaNorm);

        if (!matchNome && !matchPartido && !matchUf) {
          return false;
        }
      }

      return true;
    });
  }, [parlamentaresIniciais, busca, casa, partido, uf]);

  const totalPaginas = Math.max(1, Math.ceil(filtrados.length / ITENS_POR_PAGINA));
  const paginaSegura = Math.min(pagina, totalPaginas);

  const itensPaginados = useMemo(() => {
    const inicio = (paginaSegura - 1) * ITENS_POR_PAGINA;
    return filtrados.slice(inicio, inicio + ITENS_POR_PAGINA);
  }, [filtrados, paginaSegura]);

  function limparFiltros() {
    setBusca("");
    setCasa("");
    setPartido("");
    setUf("");
    setPagina(1);
  }

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="ruido-politicos-header border-b-4 border-ink pb-6">
        <div className="inline-flex items-center gap-2 font-mono text-xs font-bold tracking-widest bg-ink text-punk-acid px-3 py-1 mb-3 transform -rotate-1">
          <span>// ARQUIVO NOMINAL DOS PARLAMENTARES</span>
          <span className="text-punk-red">///</span>
        </div>
        <h1 className="ruido-politicos-headline font-heavy uppercase" aria-label="DOSSIÊ DOS PARLAMENTARES">
          {["DOSSIÊ", "DOS", "PARLAMENTARES"].map((palavra, indicePalavra, palavras) => {
            const offset = palavras.slice(0, indicePalavra).reduce((acc, atual) => acc + atual.length + 1, 0);
            return (
              <span className="ruido-politicos-palavra" aria-hidden="true" key={palavra}>
                {Array.from(palavra).map((letra, indiceLetra) => (
                  <span className="ruido-politicos-letra" data-cor={(offset + indiceLetra) % 3} key={indiceLetra}>
                    {letra}
                  </span>
                ))}
              </span>
            );
          })}
        </h1>
        <p className="ruido-politicos-subtitulo font-mono text-xs sm:text-sm mt-3 max-w-3xl">
          Consulte votações, presenças e os dados publicados de cada parlamentar.
        </p>
      </div>

      {/* Filter Box with Zine Styling */}
      <div className="ruido-filter-ink-panel relative ruido-paper-card bg-paper-card border-3 border-ink p-6 shadow-[8px_8px_0_#101010]">
        <div className="scotch-tape" aria-hidden="true" />

        <div className="ruido-filter-ink-header flex flex-wrap justify-between items-center gap-2 mb-4 pb-3 border-b-2 border-dashed border-ink/30 font-mono text-xs font-bold">
          <span className="text-ink uppercase tracking-wider">
            FILTROS DE AUDITORIA NOMINAL
          </span>
          <span className="bg-ink text-paper px-2 py-0.5">
            EXIBINDO {filtrados.length} DE {parlamentaresIniciais.length}
          </span>
        </div>

        <form onSubmit={(e) => e.preventDefault()} className="ruido-filter-ink-form space-y-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1">
              <label
                htmlFor="q"
                className="block font-mono text-xs font-bold text-ink mb-1 uppercase"
              >
                Buscar por Nome do Parlamentar:
              </label>
              <input
                id="q"
                type="text"
                value={busca}
                onChange={(e) => {
                  setBusca(e.target.value);
                  setPagina(1);
                }}
                placeholder="Ex: Nikolas, Tabata, Pacheco, Girão..."
                className="w-full font-mono text-sm px-3 py-2 bg-white text-ink border-2 sm:border-3 border-ink shadow-[2px_2px_0_#101010] focus:border-punk-red outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 font-mono text-xs">
            <div>
              <label
                htmlFor="casa"
                className="block font-bold text-ink mb-1 uppercase"
              >
                Casa Legislativa:
              </label>
              <select
                id="casa"
                value={casa}
                onChange={(e) => {
                  setCasa(e.target.value);
                  setPagina(1);
                }}
                className="w-full px-3 py-2 bg-white text-ink border-2 border-ink shadow-[2px_2px_0_#101010] outline-none"
              >
                <option value="">Todas as Casas</option>
                <option value="CAMARA">Câmara dos Deputados</option>
                <option value="SENADO">Senado Federal</option>
              </select>
            </div>

            <div>
              <label
                htmlFor="partido"
                className="block font-bold text-ink mb-1 uppercase"
              >
                Partido Político:
              </label>
              <select
                id="partido"
                value={partido}
                onChange={(e) => {
                  setPartido(e.target.value);
                  setPagina(1);
                }}
                className="w-full px-3 py-2 bg-white text-ink border-2 border-ink shadow-[2px_2px_0_#101010] outline-none"
              >
                <option value="">Todos os Partidos ({partidosDisponiveis.length})</option>
                {partidosDisponiveis.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="uf"
                className="block font-bold text-ink mb-1 uppercase"
              >
                Estado (UF):
              </label>
              <select
                id="uf"
                value={uf}
                onChange={(e) => {
                  setUf(e.target.value);
                  setPagina(1);
                }}
                className="w-full px-3 py-2 bg-white text-ink border-2 border-ink shadow-[2px_2px_0_#101010] outline-none"
              >
                <option value="">Todos os Estados (27)</option>
                {UFS_BRASIL.map((sigla) => (
                  <option key={sigla} value={sigla}>
                    {sigla}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-end">
              {(busca || casa || partido || uf) ? (
                <button
                  type="button"
                  onClick={limparFiltros}
                  className="w-full btn-punk font-bold text-xs py-2 px-3 bg-punk-red text-white hover:bg-ink"
                >
                  ✕ LIMPAR FILTROS
                </button>
              ) : (
                <div className="text-[11px] text-ink/50 py-2 italic font-mono">
                  Filtre por casa, sigla partidária ou estado.
                </div>
              )}
            </div>
          </div>
        </form>
      </div>

      {/* Grid of Results */}
      {itensPaginados.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
          {itensPaginados.map((p) => (
            <ParlamentarCard
              key={p.id}
              id={p.id}
              nome={p.nome}
              partido={p.partido}
              uf={p.uf}
              casa={p.casa}
              urlFoto={p.urlFoto}
              ativo={p.ativo}
              totalVotos={p.totalVotos}
              totalPresencas={p.totalPresencas}
            />
          ))}
        </div>
      ) : (
        <div className="ruido-paper-card bg-paper-card border-3 border-ink p-12 text-center font-mono space-y-4">
          <div className="font-heavy text-4xl text-punk-red">NENHUM REGISTRO ENCONTRADO</div>
          <p className="text-xs sm:text-sm text-ink/80 max-w-md mx-auto">
            Não encontramos nenhum parlamentar com os filtros selecionados. Tente limpar os critérios de busca.
          </p>
          <button
            type="button"
            onClick={limparFiltros}
            className="btn-punk font-bold text-xs px-4 py-2"
          >
            LIMPAR TODOS OS FILTROS
          </button>
        </div>
      )}

      {/* Pagination Bar */}
      {totalPaginas > 1 && (
        <div className="py-6 border-t-3 border-ink flex flex-wrap justify-between items-center gap-4 font-mono text-xs">
          <div className="font-bold text-ink">
            PÁGINA <span className="bg-ink text-punk-acid px-2 py-0.5">{paginaSegura}</span> DE {totalPaginas}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPagina((p) => Math.max(1, p - 1))}
              disabled={paginaSegura === 1}
              className="btn-punk px-3 py-1.5 disabled:opacity-40 disabled:pointer-events-none"
            >
              &larr; ANTERIOR
            </button>

            <button
              type="button"
              onClick={() => setPagina((p) => Math.min(totalPaginas, p + 1))}
              disabled={paginaSegura === totalPaginas}
              className="btn-punk px-3 py-1.5 disabled:opacity-40 disabled:pointer-events-none"
            >
              PRÓXIMA &rarr;
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
