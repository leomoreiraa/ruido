"use client";

import React, { useState, useMemo, useDeferredValue, useCallback, useRef } from "react";
import Link from "next/link";
import { formatarDataBR, normalizarTexto } from "@/lib/utils";

export interface PautaListItem {
  id: string;
  externalId: string;
  autorNome: string | null;
  dataApresentacao: string | null;
  casa: string;
  siglaTipo: string;
  numero: number;
  ano: number;
  ementa: string;
  tituloSimples: string | null;
  resumoSimples: string | null;
  totalVotacoes: number;
  ultimaVotacao?: {
    id: string;
    descricao: string;
    dataHora: string;
    aprovada: boolean | null;
    placarSim: number;
    placarNao: number;
  } | null;
}

interface PautasFilterViewProps {
  pautasIniciais: PautaListItem[];
  tiposDisponiveis: string[];
  totalRegistros?: number;
}

export function PautasFilterView({
  pautasIniciais,
  tiposDisponiveis,
  totalRegistros = pautasIniciais.length,
}: PautasFilterViewProps) {
  const [busca, setBusca] = useState("");
  const [casa, setCasa] = useState("");
  const [tipo, setTipo] = useState("");
  const [pagina, setPagina] = useState(1);
  const buscaAdiada = useDeferredValue(busca);
  const [workerSolicitado, setWorkerSolicitado] = useState(false);
  const [workerPronto, setWorkerPronto] = useState(false);
  const [carregandoCatalogo, setCarregandoCatalogo] = useState(false);
  const [erroCatalogo, setErroCatalogo] = useState(false);
  const [resultado, setResultado] = useState<{
    key: string; itens: PautaListItem[]; total: number; pagina: number;
  } | null>(null);
  const workerRef = useRef<Worker | null>(null);
  const sequenciaRef = useRef(0);
  const ITENS_POR_PAGINA = 10;
  const catalogoCompleto = totalRegistros > pautasIniciais.length;
  const filtroAtivo = !!(busca.trim() || casa || tipo || pagina > 1);
  const chaveAtual = JSON.stringify([buscaAdiada.trim(), casa, tipo, pagina]);
  const resultadoAtual =
    busca === buscaAdiada && resultado?.key === chaveAtual ? resultado : null;

  const carregarCatalogo = useCallback(() => {
    if (!catalogoCompleto) return;
    setErroCatalogo(false);
    setWorkerSolicitado(true);
  }, [catalogoCompleto]);

  React.useEffect(() => {
    if (!workerSolicitado || !catalogoCompleto) return;
    if (typeof Worker === "undefined") {
      setErroCatalogo(true);
      setCarregandoCatalogo(false);
      return;
    }
    const worker = new Worker("/workers/pautas-search.js");
    workerRef.current = worker;
    worker.onmessage = (evento: MessageEvent) => {
      const data = evento.data as {
        type: string; requestId?: number; key?: string;
        itens?: PautaListItem[]; total?: number; pagina?: number;
      };
      if (data.type === "ready") {
        setWorkerPronto(true);
        setCarregandoCatalogo(false);
      } else if (data.type === "result" && data.requestId === sequenciaRef.current &&
                 typeof data.key === "string" && Array.isArray(data.itens) &&
                 typeof data.total === "number") {
        setResultado({
          key: data.key, itens: data.itens,
          total: data.total, pagina: data.pagina ?? 1,
        });
        setCarregandoCatalogo(false);
      } else if (data.type === "error") {
        setErroCatalogo(true);
        setCarregandoCatalogo(false);
      }
    };
    worker.onerror = () => {
      setErroCatalogo(true);
      setCarregandoCatalogo(false);
    };
    setCarregandoCatalogo(true);
    worker.postMessage({type: "init"});
    return () => { worker.terminate(); workerRef.current = null; };
  }, [workerSolicitado, catalogoCompleto]);

  React.useEffect(() => {
    if (!catalogoCompleto || !workerPronto || !filtroAtivo || !workerRef.current) return;
    const timer = window.setTimeout(() => {
      const requestId = ++sequenciaRef.current;
      setCarregandoCatalogo(true);
      workerRef.current?.postMessage({
        type: "filter", requestId, key: chaveAtual,
        busca: buscaAdiada.trim(), casa, tipo, pagina, limit: ITENS_POR_PAGINA,
      });
    }, 220);
    return () => window.clearTimeout(timer);
  }, [catalogoCompleto, workerPronto, filtroAtivo, chaveAtual, buscaAdiada, casa, tipo, pagina]);

  const dadosLocais = useMemo(() => {
    if (catalogoCompleto) return pautasIniciais;
    const termo = normalizarTexto(buscaAdiada.trim());
    return pautasIniciais.filter(p =>
      (!casa || p.casa === casa) && (!tipo || p.siglaTipo === tipo) &&
      (!termo || normalizarTexto([
        p.siglaTipo, p.numero, p.ano, p.ementa, p.tituloSimples,
        p.resumoSimples, p.autorNome,
      ].filter(x => x != null).join(" ")).includes(termo))
    );
  }, [pautasIniciais, catalogoCompleto, buscaAdiada, casa, tipo]);

  const esperando = catalogoCompleto && filtroAtivo &&
    (!resultadoAtual || carregandoCatalogo || !workerPronto);
  const quantidadeExibida = catalogoCompleto
    ? (filtroAtivo ? (resultadoAtual?.total ?? 0) : totalRegistros)
    : dadosLocais.length;
  const totalPaginas = Math.max(1, Math.ceil(quantidadeExibida / ITENS_POR_PAGINA));
  const paginaSegura = Math.min(pagina, totalPaginas);
  const pautasPaginadas = catalogoCompleto
    ? (filtroAtivo ? (esperando ? [] : resultadoAtual?.itens ?? []) :
       pautasIniciais.slice(0, ITENS_POR_PAGINA))
    : dadosLocais.slice((paginaSegura - 1) * ITENS_POR_PAGINA,
        paginaSegura * ITENS_POR_PAGINA);

  return (
    <div className="collage-page ruido-pautas-page space-y-8">
      
      <div className="collage-paper collage-rail border-b-4 border-ink pb-6 px-4 py-5">
        <div className="inline-flex items-center gap-2 font-mono text-xs font-bold tracking-widest bg-ink text-punk-acid px-3 py-1 mb-3 transform -rotate-1">
          <span>
          <span className="text-punk-red">
        </div>
        <h1 className="font-heavy text-4xl sm:text-6xl uppercase tracking-tight text-ink">
          PAUTAS &amp; <span className="text-punk-red">VOTAÇÕES</span>
        </h1>
        <p className="font-mono text-xs sm:text-sm text-ink/80 mt-2 max-w-2xl border-l-4 border-punk-red pl-3">
          Acompanhe os Projetos de Lei, Medidas Provisórias e Emendas Constitucionais que alteram seus direitos, tributos e liberdades no Congresso Nacional.
        </p>
      </div>

      
      <div className="ruido-filter-ink-panel relative ruido-paper-card bg-paper-card border-3 border-ink p-6 shadow-[8px_8px_0_#101010]">
        <div className="scotch-tape" aria-hidden="true" />
        <div className="ruido-filter-ink-header flex flex-wrap justify-between items-center gap-2 mb-4 pb-3 border-b-2 border-dashed border-ink/30 font-mono text-xs font-bold">
          <span className="text-ink uppercase tracking-wider">
            FILTROS DE PAUTAS LEGISLATIVAS
          </span>
          <span className="bg-ink text-paper px-2 py-0.5">
            EXIBINDO {quantidadeExibida} DE {totalRegistros}
          </span>
        </div>

        <form onSubmit={(e) => e.preventDefault()} className="ruido-filter-ink-form space-y-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1">
              <label
                htmlFor="q"
                className="block font-mono text-xs font-bold text-ink mb-1 uppercase"
              >
                Buscar por termo, ementa ou número:
              </label>
              <input
                id="q"
                type="text"
                value={busca}
                onFocus={carregarCatalogo}
                onChange={(e) => { setBusca(e.target.value); setPagina(1); carregarCatalogo(); }}
                placeholder="Ex: PL 2630, PEC 45, tributária, inteligência artificial..."
                className="w-full font-mono text-sm px-3 py-2 bg-white text-ink border-2 sm:border-3 border-ink shadow-[2px_2px_0_#101010] focus:border-punk-red outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 font-mono text-xs">
            <div>
              <label htmlFor="casa-select" className="block font-bold text-ink mb-1 uppercase">
                Casa Legislativa:
              </label>
              <select
                id="casa-select"
                value={casa}
                onChange={(e) => { setCasa(e.target.value); setPagina(1); carregarCatalogo(); }}
                className="w-full px-3 py-2 bg-white text-ink border-2 border-ink shadow-[2px_2px_0_#101010] outline-none"
              >
                <option value="">Todas as Casas</option>
                <option value="CAMARA">Câmara dos Deputados</option>
                <option value="SENADO">Senado Federal</option>
              </select>
            </div>

            <div>
              <label htmlFor="tipo-select" className="block font-bold text-ink mb-1 uppercase">
                Tipo de Proposição:
              </label>
              <select
                id="tipo-select"
                value={tipo}
                onChange={(e) => { setTipo(e.target.value); setPagina(1); carregarCatalogo(); }}
                className="w-full px-3 py-2 bg-white text-ink border-2 border-ink shadow-[2px_2px_0_#101010] outline-none"
              >
                <option value="">Todos os Tipos ({tiposDisponiveis.length})</option>
                {tiposDisponiveis.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-end">
              {(busca || casa || tipo) ? (
                <button
                  type="button"
                  onClick={() => {
                    setBusca("");
                    setCasa("");
                    setTipo("");
                    setPagina(1);
                  }}
                  className="w-full btn-punk font-bold text-xs py-2 px-3 bg-punk-red text-white hover:bg-ink"
                >
                  ✕ LIMPAR FILTROS
                </button>
              ) : (
                <div className="text-[11px] text-ink/50 py-2 italic font-mono">
                  Filtre por proposição específica ou casa.
                </div>
              )}
            </div>
          </div>
        </form>
      </div>

      {erroCatalogo && (
        <div role="alert" className="ruido-paper-card bg-paper-card font-mono text-xs p-4">
          O catálogo completo não carregou. <button type="button" onClick={() => void carregarCatalogo()} className="btn-punk px-3 py-1">TENTAR NOVAMENTE</button>
        </div>
      )}
      
      {(pautasPaginadas.length > 0 || esperando || carregandoCatalogo) ? (
        <>
        <div className="ruido-pauta-list space-y-4">
          {(carregandoCatalogo || esperando) && <div role="status" className="font-mono text-xs text-paper p-4">PESQUISANDO PAUTAS SEM TRAVAR A PÁGINA…</div>}
          {pautasPaginadas.map((p) => {
            const isCamara = p.casa === "CAMARA";
            const uv = p.ultimaVotacao;

            return (
              <article
                key={p.id}
                className="relative ruido-paper-card bg-paper-light border-3 border-ink p-5 sm:p-6 shadow-[5px_5px_0_#101010] transition-all hover:shadow-[8px_8px_0_#e42232]"
              >
                
                <div className="flex flex-wrap items-center justify-between gap-2 mb-3 pb-2 border-b-2 border-dashed border-ink/20 font-mono text-xs">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold bg-ink text-paper px-2 py-0.5 text-[10px]">
                      {isCamara ? "CÂMARA DOS DEPUTADOS" : "SENADO FEDERAL"}
                    </span>
                    <span className="font-heavy text-base text-punk-red">
                      {p.siglaTipo} {p.numero}/{p.ano}
                    </span>
                    {p.dataApresentacao && (
                      <span className="text-ink/60 text-[11px]">
                        (Apresentada em {formatarDataBR(p.dataApresentacao)})
                      </span>
                    )}
                  </div>

                  {uv && (
                    <div>
                      {uv.aprovada === true && (
                        <span className="rubber-stamp rubber-stamp-green text-[10px]">
                          ✓ APROVADA
                        </span>
                      )}
                      {uv.aprovada === false && (
                        <span className="rubber-stamp rubber-stamp-red text-[10px]">
                          ✕ NÃO APROVADA
                        </span>
                      )}
                      {uv.aprovada === null && (
                        <span className="rubber-stamp rubber-stamp-acid text-[10px]">
                          RESULTADO NÃO INFORMADO
                        </span>
                      )}
                    </div>
                  )}
                </div>

                
                <h3 className="ruido-legible-prop-title font-heavy text-xl sm:text-2xl uppercase tracking-tight my-2">
                  <Link className="ruido-proposition-text-link" href={`/pautas/detalhe?id=${p.id}`}>{p.tituloSimples || (p.ementa.length > 340 ? p.ementa.slice(0, 340).trimEnd() + "…" : p.ementa)}</Link>
                </h3>

                {p.resumoSimples && (
                  <div className="my-3 border-l-4 border-ink bg-white/80 px-3 py-3 space-y-2">
                    <span className="font-mono text-[10px] font-bold uppercase text-punk-red">
                      ✦ RESUMO • GERADO COM AUXÍLIO DE IA
                    </span>
                    <p className="font-mono text-xs sm:text-sm leading-relaxed text-ink">{p.resumoSimples.length > 700 ? p.resumoSimples.slice(0, 700).trimEnd() + "…" : p.resumoSimples}</p>
                    <p className="font-mono text-[10px] text-ink/70">
                      Confira a ementa oficial e o texto jurídico ao abrir o projeto.
                    </p>
                  </div>
                )}

                {p.autorNome && (
                  <p className="font-mono text-xs text-ink/75 my-2">
                    Autoria / Relatoria oficial:{" "}
                    <strong className="text-ink">{p.autorNome}</strong>
                  </p>
                )}

                
                {uv && (uv.placarSim > 0 || uv.placarNao > 0) && (
                  <div className="my-3 p-2.5 bg-paper-card border border-ink font-mono text-xs flex justify-between items-center gap-3">
                    <span className="text-ink/80 truncate">
                      Última votação: {uv.descricao}
                    </span>
                    <span className="font-heavy text-xs whitespace-nowrap bg-ink text-paper px-2 py-0.5">
                      SIM: {uv.placarSim} | NÃO: {uv.placarNao}
                    </span>
                  </div>
                )}

                
                <div className="mt-4 pt-3 border-t border-dashed border-ink/20 flex justify-between items-center font-mono text-xs">
                  <span className="text-ink/60 font-bold">
                    {p.totalVotacoes} {p.totalVotacoes === 1 ? "votação registrada" : "votações registradas"}
                  </span>
                  <Link
                    href={`/pautas/detalhe?id=${p.id}`}
                    className="btn-punk font-bold text-xs py-1.5 px-3"
                  >
                    AUDITAR VOTOS DESTA MATÉRIA &rarr;
                  </Link>
                </div>
              </article>
            );
          })}
        </div>
        {totalPaginas > 1 && (
          <nav className="flex flex-wrap justify-between gap-4 items-center pt-6 border-t-2 border-punk-acid" aria-label="Paginação das pautas">
            <span className="font-mono text-xs font-bold text-paper">PÁGINA {paginaSegura} / {totalPaginas} — {quantidadeExibida} PAUTAS</span>
            <div className="flex flex-wrap gap-3">
              <button type="button" disabled={paginaSegura === 1 || esperando} onClick={() => setPagina(n => Math.max(1, n - 1))} className="btn-punk px-4 py-2 text-xs disabled:opacity-40">← ANTERIOR</button>
              <button type="button" disabled={paginaSegura >= totalPaginas || esperando} onClick={() => { if (catalogoCompleto) carregarCatalogo(); setPagina(n => Math.min(totalPaginas, n + 1)); }} className="btn-punk px-4 py-2 text-xs disabled:opacity-40">PRÓXIMA →</button>
            </div>
          </nav>
        )}
        </>
      ) : (
        <div className="bg-paper-card border-3 border-ink p-12 text-center font-mono space-y-4">
          <div className="font-heavy text-4xl text-punk-red">NENHUMA PAUTA ENCONTRADA</div>
          <p className="text-xs sm:text-sm text-ink/80 max-w-md mx-auto">
            Não encontramos proposições com os termos pesquisados.
          </p>
        </div>
      )}
    </div>
  );
}
