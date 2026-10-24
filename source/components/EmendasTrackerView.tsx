"use client";

import React, { useState, useMemo, useDeferredValue, useCallback, useRef } from "react";
import Link from "next/link";
import { formatarMoeda, normalizarTexto } from "@/lib/utils";
import { EmendaItem } from "@/lib/types";

export interface RankingParlamentarEmenda {
  id: string;
  nome: string;
  partido: string;
  uf: string;
  casa: string;
  urlFoto: string | null;
  totalEmpenhado: number;
  totalPago: number;
  totalPix: number;
  quantidadeEmendas: number;
}

export interface DistribuicaoUfEmenda {
  uf: string;
  totalPago: number;
  quantidadeEmendas: number;
}

export interface EmendasTrackerViewProps {
  emendasIniciais: EmendaItem[];
  totalRegistros?: number;
  anosDisponiveis?: number[];
  totalGeralEmpenhado: number;
  totalGeralPago: number;
  totalGeralPix: number;
  totalMunicipiosAtendidos: number;
  rankingParlamentares: RankingParlamentarEmenda[];
  distribuicaoUfs: DistribuicaoUfEmenda[];
  topMunicipios?: any[];
}

const ITENS_POR_PAGINA = 25;

const UFS_BRASIL = [
  "AC", "AL", "AM", "AP", "BA", "CE", "DF", "ES", "GO", "MA",
  "MG", "MS", "MT", "PA", "PB", "PE", "PI", "PR", "RJ", "RN",
  "RO", "RR", "RS", "SC", "SE", "SP", "TO"
];

export function EmendasTrackerView({
  emendasIniciais,
  totalRegistros = emendasIniciais.length,
  anosDisponiveis = [],
  totalGeralEmpenhado,
  totalGeralPago,
  totalGeralPix,
  totalMunicipiosAtendidos,
  rankingParlamentares,
  distribuicaoUfs,
}: EmendasTrackerViewProps) {
  const [busca, setBusca] = useState("");
  const [tipoFiltro, setTipoFiltro] = useState("");
  const [ufFiltro, setUfFiltro] = useState("");
  const [anoFiltro, setAnoFiltro] = useState("");
  const [abaVisao, setAbaVisao] = useState<"tabela" | "ranking" | "mapa">("tabela");
  const [pagina, setPagina] = useState(1);
  const buscaAdiada = useDeferredValue(busca);
  const [catalogo, setCatalogo] = useState<EmendaItem[] | null>(null);
  const [carregandoCatalogo, setCarregandoCatalogo] = useState(false);
  const [erroCatalogo, setErroCatalogo] = useState(false);
  const buscaEmAndamento = useRef<Promise<void> | null>(null);
  const carregarCatalogo = useCallback((): Promise<void> => {
    if (catalogo || totalRegistros <= emendasIniciais.length) return Promise.resolve();
    if (buscaEmAndamento.current) return buscaEmAndamento.current;
    setCarregandoCatalogo(true);
    setErroCatalogo(false);
    const requisicao = (async () => {
      try {
        const resposta = await fetch("/data/emendas-index.json");
        if (!resposta.ok) throw new Error("Não foi possível carregar as emendas");
        const dados: unknown = await resposta.json();
        if (!Array.isArray(dados) || dados.length < emendasIniciais.length)
          throw new Error("Catálogo incompleto");
        setCatalogo(dados as EmendaItem[]);
      } catch {
        setErroCatalogo(true);
      } finally {
        setCarregandoCatalogo(false);
        buscaEmAndamento.current = null;
      }
    })();
    buscaEmAndamento.current = requisicao;
    return requisicao;
  }, [catalogo, totalRegistros, emendasIniciais]);
  const todasEmendas = catalogo ?? emendasIniciais;
  const indiceBusca = useMemo(() => new Map(
    todasEmendas.map(item => [item.id, normalizarTexto([
      item.parlamentar?.nome, item.autorOriginal, item.municipioBeneficiado,
      item.descricao, item.codigoEmenda
    ].filter(Boolean).join(" "))])
  ), [todasEmendas]);

  const filtrados = useMemo(() => {
    const q = normalizarTexto(buscaAdiada.trim());

    return todasEmendas.filter((item) => {
      if (tipoFiltro && item.tipo !== tipoFiltro) {
        return false;
      }

      if (anoFiltro && String(item.ano) !== anoFiltro) return false;
      if (ufFiltro && item.ufBeneficiada !== ufFiltro) {
        return false;
      }

      if (q) {
        if (!indiceBusca.get(item.id)?.includes(q)) {
          return false;
        }
      }

      return true;
    });
  }, [todasEmendas, indiceBusca, buscaAdiada, tipoFiltro, ufFiltro, anoFiltro]);
  const quantidadeExibida = catalogo || busca || tipoFiltro || ufFiltro || anoFiltro ? filtrados.length : totalRegistros;

  const totalPaginas = Math.max(1, Math.ceil(quantidadeExibida / ITENS_POR_PAGINA));
  const paginaSegura = Math.min(pagina, totalPaginas);

  const emendasPaginadas = useMemo(() => {
    const inicio = (paginaSegura - 1) * ITENS_POR_PAGINA;
    return filtrados.slice(inicio, inicio + ITENS_POR_PAGINA);
  }, [filtrados, paginaSegura]);

  function limparFiltros() {
    setBusca("");
    setTipoFiltro("");
    setUfFiltro("");
    setAnoFiltro("");
    setPagina(1);
  }

  if (totalRegistros === 0) {
    return (
      <section className="ruido-paper-card bg-paper-card border-4 border-ink p-8 shadow-[8px_8px_0_#101010] text-center font-mono space-y-4">
        <div className="rubber-stamp rubber-stamp-red text-sm inline-block">
          DADOS DE EMENDAS INDISPONÍVEIS
        </div>
        <h2 className="font-heavy text-3xl uppercase text-ink">
          Rastreador de Emendas Parlamentares
        </h2>
        <p className="text-xs sm:text-sm text-ink/80 max-w-lg mx-auto">
          Ainda não há registros de emendas sincronizados. A coleta utiliza a API oficial da CGU
          e exige uma chave configurada no GitHub Actions. Zero registros não significa ausência de emendas.
        </p>
        <div>
          <a
            href="https://portaldatransparencia.gov.br/emendas"
            target="_blank"
            rel="noopener noreferrer"
            className="btn-punk px-4 py-2 text-xs"
          >
            PORTAL DA TRANSPARÊNCIA &rarr;
          </a>
        </div>
      </section>
    );
  }

  return (
    <div className="space-y-8">
      
      <div className="border-b-4 border-ink pb-6">
        <div className="inline-flex items-center gap-2 font-mono text-xs font-bold tracking-widest bg-ink text-punk-acid px-3 py-1 mb-3 transform -rotate-1">
          <span>
          <span className="text-punk-red">
        </div>
        <h1 className="font-heavy text-4xl sm:text-6xl uppercase tracking-tight text-ink">
          RASTREADOR DE <span className="text-punk-red">EMENDAS R$</span>
        </h1>
        <p className="font-mono text-xs sm:text-sm text-ink/80 mt-2 max-w-2xl border-l-4 border-punk-red pl-3">
          Consulte emendas registradas na CGU desde 2022. Valores são consolidados por código de emenda;
          autoria coletiva não é atribuída artificialmente a um parlamentar. O histórico é preenchido de forma progressiva.
        </p>
      </div>

      
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <div className="ruido-paper-card bg-paper-card border-3 border-ink p-5 shadow-[5px_5px_0_#101010] relative transform -rotate-1 hover:rotate-0 transition-all">
          <div className="scotch-tape-corner" aria-hidden="true" />
          <span className="font-mono text-[10px] font-bold text-ink/60 uppercase tracking-wider block">
            DESTINADO NO ORÇAMENTO
          </span>
          <div className="font-heavy text-2xl sm:text-3xl text-ink leading-none my-2">
            {formatarMoeda(totalGeralEmpenhado)}
          </div>
          <span className="text-[11px] font-mono text-ink/75">
            Valor empenhado informado pela CGU
          </span>
        </div>

        <div className="ruido-paper-card bg-paper-card border-3 border-ink p-5 shadow-[5px_5px_0_#101010] relative transform rotate-1 hover:rotate-0 transition-all">
          <div className="scotch-tape-corner" aria-hidden="true" />
          <span className="font-mono text-[10px] font-bold text-ink/60 uppercase tracking-wider block">
            TOTAL EFETIVAMENTE PAGO
          </span>
          <div className="font-heavy text-2xl sm:text-3xl text-green-700 leading-none my-2">
            {formatarMoeda(totalGeralPago)}
          </div>
          <span className="text-[11px] font-mono text-ink/75">
            Pagamento registrado na fonte oficial
          </span>
        </div>

        <div className="ruido-paper-card bg-paper-card border-3 border-ink p-5 shadow-[5px_5px_0_#101010] relative transform -rotate-1 hover:rotate-0 transition-all">
          <div className="scotch-tape-corner" aria-hidden="true" />
          <span className="font-mono text-[10px] font-bold text-ink/60 uppercase tracking-wider block">
            TOTAL EM EMENDAS PIX
          </span>
          <div className="font-heavy text-2xl sm:text-3xl text-punk-red leading-none my-2">
            {formatarMoeda(totalGeralPix)}
          </div>
          <span className="text-[11px] font-mono text-ink/75">
            Sem vinculação a projeto prévio
          </span>
        </div>

        <div className="ruido-paper-card bg-paper-card border-3 border-ink p-5 shadow-[5px_5px_0_#101010] relative transform rotate-1 hover:rotate-0 transition-all">
          <div className="scotch-tape-corner" aria-hidden="true" />
          <span className="font-mono text-[10px] font-bold text-ink/60 uppercase tracking-wider block">
            MUNICÍPIOS BENEFICIADOS
          </span>
          <div className="font-heavy text-3xl sm:text-4xl text-ink leading-none my-2">
            {totalMunicipiosAtendidos}
          </div>
          <span className="text-[11px] font-mono text-ink/75">
            Cidades com recursos destinados
          </span>
        </div>
      </div>

      
      <div className="flex gap-2 sm:gap-3 flex-wrap border-b-4 border-ink pb-2">
        <button
          type="button"
          onClick={() => setAbaVisao("tabela")}
          className={`font-heavy text-xs sm:text-sm tracking-wider uppercase px-4 py-2.5 border-2 border-ink transition-all ${
            abaVisao === "tabela"
              ? "bg-punk-acid text-ink shadow-[4px_4px_0_#101010] transform -rotate-1"
              : "bg-paper-card text-ink hover:bg-white"
          }`}
        >
          [01] TABELA DE REPASSES ({quantidadeExibida})
        </button>

        <button
          type="button"
          onClick={() => setAbaVisao("ranking")}
          className={`font-heavy text-xs sm:text-sm tracking-wider uppercase px-4 py-2.5 border-2 border-ink transition-all ${
            abaVisao === "ranking"
              ? "bg-punk-red text-white shadow-[4px_4px_0_#101010] transform rotate-1"
              : "bg-paper-card text-ink hover:bg-white"
          }`}
        >
          [02] RANKING TOP 10 PARLAMENTARES
        </button>

        <button
          type="button"
          onClick={() => setAbaVisao("mapa")}
          className={`font-heavy text-xs sm:text-sm tracking-wider uppercase px-4 py-2.5 border-2 border-ink transition-all ${
            abaVisao === "mapa"
              ? "bg-ink text-paper shadow-[4px_4px_0_#e42232] transform -rotate-1"
              : "bg-paper-card text-ink hover:bg-white"
          }`}
        >
          [03] DISTRIBUIÇÃO POR ESTADO
        </button>
      </div>

      
      {abaVisao === "tabela" && (
        <div className="space-y-6">
          
          <div className="ruido-filter-ink-panel relative ruido-paper-card bg-paper-card border-3 border-ink p-5 shadow-[6px_6px_0_#101010]">
            <div className="ruido-filter-ink-form flex flex-wrap items-center gap-3 font-mono text-xs">
              <div className="flex-1 min-w-[200px]">
                <label htmlFor="busca-emenda" className="block font-bold text-ink mb-1 uppercase">
                  Buscar Emenda:
                </label>
                <input
                  id="busca-emenda"
                  type="text"
                  value={busca}
                  onFocus={() => { void carregarCatalogo(); }}
                  onChange={(e) => {
                    setBusca(e.target.value);
                    setPagina(1);
                    void carregarCatalogo();
                  }}
                  placeholder="Parlamentar, município, objeto ou código..."
                  className="w-full px-3 py-2 bg-white text-ink border-2 border-ink shadow-[2px_2px_0_#101010] outline-none"
                />
              </div>

              <div>
                <label htmlFor="tipo-emenda" className="block font-bold text-ink mb-1 uppercase">
                  Modalidade:
                </label>
                <select
                  id="tipo-emenda"
                  value={tipoFiltro}
                  onChange={(e) => {
                    setTipoFiltro(e.target.value);
                    setPagina(1);
                    void carregarCatalogo();
                  }}
                  className="px-3 py-2 bg-white text-ink border-2 border-ink shadow-[2px_2px_0_#101010] outline-none"
                >
                  <option value="">Todas as Modalidades</option>
                  <option value="INDIVIDUAL">Individual</option>
                  <option value="BANCADA">Bancada</option>
                  <option value="COMISSAO">Comissão</option>
                  <option value="TRANSFERENCIA_ESPECIAL">PIX (Transferência Especial)</option>
                </select>
              </div>

              <div>
                <label htmlFor="ano-emenda" className="block font-bold text-ink mb-1 uppercase">
                  Ano da Emenda:
                </label>
                <select
                  id="ano-emenda"
                  value={anoFiltro}
                  onChange={(e) => {
                    setAnoFiltro(e.target.value);
                    setPagina(1);
                    void carregarCatalogo();
                  }}
                  className="px-3 py-2 bg-white text-ink border-2 border-ink shadow-[2px_2px_0_#101010] outline-none"
                >
                  <option value="">Todos os Anos</option>
                  {(anosDisponiveis.length ? anosDisponiveis : Array.from(new Set(emendasIniciais.map(item => item.ano))))
                    .sort((a, b) => b - a)
                    .map(ano => <option key={ano} value={ano}>{ano}</option>)}
                </select>
              </div>
              <div>
                <label htmlFor="uf-emenda" className="block font-bold text-ink mb-1 uppercase">
                  UF Beneficiada:
                </label>
                <select
                  id="uf-emenda"
                  value={ufFiltro}
                  onChange={(e) => {
                    setUfFiltro(e.target.value);
                    setPagina(1);
                    void carregarCatalogo();
                  }}
                  className="px-3 py-2 bg-white text-ink border-2 border-ink shadow-[2px_2px_0_#101010] outline-none"
                >
                  <option value="">Todas as UFs</option>
                  {UFS_BRASIL.map((uf) => (
                    <option key={uf} value={uf}>
                      {uf}
                    </option>
                  ))}
                </select>
              </div>

              {(busca || tipoFiltro || ufFiltro || anoFiltro) && (
                <div className="flex items-end">
                  <button
                    type="button"
                    onClick={limparFiltros}
                    className="btn-punk font-bold text-xs py-2 px-3 bg-punk-red text-white hover:bg-ink"
                  >
                    ✕ LIMPAR
                  </button>
                </div>
              )}
            </div>
          </div>

          {carregandoCatalogo && (
            <p role="status" className="ruido-paper-card bg-paper-card px-4 py-3 font-mono text-xs">
              CARREGANDO TODOS OS REGISTROS PARA FILTRAR…
            </p>
          )}
          {erroCatalogo && (
            <div role="alert" className="ruido-paper-card bg-paper-card px-4 py-3 font-mono text-xs">
              Não foi possível carregar o catálogo completo.
              <button type="button" onClick={() => void carregarCatalogo()} className="btn-punk px-3 py-1 ml-2">
                TENTAR NOVAMENTE
              </button>
            </div>
          )}
          
          {emendasPaginadas.length > 0 ? (
            <div className="space-y-4">
              <div className="overflow-x-auto">
                <table className="w-full text-left font-mono text-xs">
                  <thead>
                    <tr>
                      <th>ANO</th>
                      <th>PARLAMENTAR AUTOR</th>
                      <th>MODALIDADE</th>
                      <th>DESTINO</th>
                      <th>OBJETO / DESCRIÇÃO</th>
                      <th>VALOR PAGO R$</th>
                      <th>SITUAÇÃO</th>
                    </tr>
                  </thead>
                  <tbody>
                    {emendasPaginadas.map((em) => (
                      <tr key={em.id}>
                        <td className="font-bold">{em.ano}</td>
                        <td>
                          {em.parlamentar ? (
                            <Link
                              href={`/parlamentares/${em.parlamentar.id}`}
                              className="font-bold text-ink hover:text-punk-red underline"
                            >
                              {em.parlamentar.nome}
                            </Link>
                          ) : (
                            <span className="text-ink/80" title="Autoria informada pela fonte; vínculo individual não verificado">{em.autorOriginal || "Autor não identificado"}</span>
                          )}
                        </td>
                        <td>
                          <span
                            className={`px-2 py-0.5 text-[10px] font-bold border ${
                              em.tipo === "TRANSFERENCIA_ESPECIAL"
                                ? "bg-red-100 text-punk-red border-punk-red"
                                : "bg-paper-dark text-ink border-ink/40"
                            }`}
                          >
                            {em.tipo}
                          </span>
                        </td>
                        <td className="whitespace-nowrap">
                          {em.municipioBeneficiado || "-"}/{em.ufBeneficiada || "-"}
                        </td>
                        <td className="text-ink/80 max-w-xs">{em.descricao}</td>
                        <td className="whitespace-nowrap font-heavy text-sm text-green-700">
                          {formatarMoeda(em.valorPago)}
                        </td>
                        <td>
                          <span className="text-[10px] font-bold uppercase bg-ink text-paper px-1.5 py-0.2">
                            {em.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              
              {totalPaginas > 1 && (
                <div className="py-4 border-t-3 border-ink flex flex-wrap justify-between items-center gap-4 font-mono text-xs">
                  <span>
                    Página <strong>{paginaSegura}</strong> de {totalPaginas} ({quantidadeExibida} emendas)
                  </span>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={paginaSegura <= 1}
                      onClick={() => setPagina((p) => Math.max(1, p - 1))}
                      className="btn-punk px-3 py-1.5 disabled:opacity-40 disabled:pointer-events-none"
                    >
                      &larr; Anterior
                    </button>
                    <button
                      type="button"
                      disabled={paginaSegura >= totalPaginas}
                      onClick={() => { if (!catalogo) void carregarCatalogo(); setPagina((p) => Math.min(totalPaginas, p + 1)); }}
                      className="btn-punk px-3 py-1.5 disabled:opacity-40 disabled:pointer-events-none"
                    >
                      Próxima &rarr;
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-paper-card border-3 border-ink p-8 text-center font-mono">
              Nenhuma emenda encontrada com os filtros selecionados.
            </div>
          )}
        </div>
      )}

      
      {abaVisao === "ranking" && (
        <div className="space-y-4">
          <div className="flex justify-between items-center border-b-2 border-dashed border-ink/30 pb-2">
            <h2 className="font-heavy text-2xl uppercase tracking-wider text-ink">
              TOP 10 PARLAMENTARES POR RECURSOS EFETIVAMENTE PAGOS
            </h2>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left font-mono text-xs">
              <thead>
                <tr>
                  <th>RANK</th>
                  <th>PARLAMENTAR</th>
                  <th>PARTIDO / UF</th>
                  <th>TOTAL PAGO R$</th>
                  <th>EMENDAS PIX R$</th>
                  <th>QTD. EMENDAS</th>
                </tr>
              </thead>
              <tbody>
                {rankingParlamentares.map((p, idx) => (
                  <tr key={p.id}>
                    <td className="font-heavy text-lg text-punk-red">#{idx + 1}</td>
                    <td className="font-bold">
                      <Link
                        href={`/parlamentares/${p.id}`}
                        className="hover:text-punk-red underline"
                      >
                        {p.nome}
                      </Link>
                    </td>
                    <td>
                      {p.partido}/{p.uf}
                    </td>
                    <td className="font-heavy text-sm text-green-700 whitespace-nowrap">
                      {formatarMoeda(p.totalPago)}
                    </td>
                    <td className="text-punk-red font-bold whitespace-nowrap">
                      {formatarMoeda(p.totalPix)}
                    </td>
                    <td>{p.quantidadeEmendas}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      
      {abaVisao === "mapa" && (
        <div className="space-y-4">
          <div className="flex justify-between items-center border-b-2 border-dashed border-ink/30 pb-2">
            <h2 className="font-heavy text-2xl uppercase tracking-wider text-ink">
              DISTRIBUIÇÃO DE RECURSOS POR ESTADO (UF)
            </h2>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left font-mono text-xs">
              <thead>
                <tr>
                  <th>ESTADO (UF)</th>
                  <th>TOTAL PAGO R$</th>
                  <th>QUANTIDADE DE EMENDAS</th>
                </tr>
              </thead>
              <tbody>
                {distribuicaoUfs.map((item) => (
                  <tr key={item.uf}>
                    <td className="font-heavy text-base text-ink">{item.uf}</td>
                    <td className="font-heavy text-sm text-green-700">
                      {formatarMoeda(item.totalPago)}
                    </td>
                    <td>{item.quantidadeEmendas}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
