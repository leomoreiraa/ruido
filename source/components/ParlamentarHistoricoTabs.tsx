"use client";

import React, { useState } from "react";
import Link from "next/link";
import { formatarDataBR, formatarDataHoraBR, formatarMoeda } from "@/lib/utils";
import { EmendaItem, BemDeclaradoItem } from "@/lib/types";
import { GraficoPatrimonio } from "@/components/GraficoPatrimonio";

export interface VotoHistoricoItem {
  id: string;
  opcao: string;
  opcaoOriginal: string | null;
  registradoEm: string | null;
  partidoNaEpoca: string | null;
  ufNaEpoca: string | null;
  votacao: {
    id: string;
    descricao: string;
    dataHora: string;
    aprovada: boolean | null;
    placarSim: number;
    placarNao: number;
    proposicao: {
      id: string;
      siglaTipo: string;
      numero: number;
      ano: number;
      ementa: string;
    } | null;
  };
}

export interface PresencaHistoricoItem {
  id: string;
  sessaoExternalId: string;
  dataSessao: string;
  tituloSessao: string;
  status: string;
  justificativa: string | null;
  fonteUrl: string | null;
  origem: string;
  cobertura: string;
}

export interface ParlamentarHistoricoTabsProps {
  votos: VotoHistoricoItem[];
  presencas: PresencaHistoricoItem[];
  parlamentarId?: string;
  totalVotos?: number;
  totalPresencas?: number;
  emendas?: EmendaItem[];
  bensDeclarados?: BemDeclaradoItem[];
  parlamentarNome: string;
  totaisTse?: Array<{ ano: number; totalDeclarado: number; quantidadeBens: number; fonte: string }>;
}

type TabType = "votos" | "presencas" | "emendas" | "patrimonio";

export function ParlamentarHistoricoTabs({
  votos: votosIniciais,
  presencas: presencasIniciais,
  parlamentarId = "",
  totalVotos = votosIniciais.length,
  totalPresencas = presencasIniciais.length,
  emendas = [],
  bensDeclarados = [],
  parlamentarNome,
  totaisTse = [],
}: ParlamentarHistoricoTabsProps) {
  const [abaAtiva, setAbaAtiva] = useState<TabType>("votos");
  const [historico, setHistorico] = useState({ votos: votosIniciais, presencas: presencasIniciais });
  const [carregando, setCarregando] = useState(false);
  const [erroHistorico, setErroHistorico] = useState("");
  const [completo, setCompleto] = useState(false);
  const { votos, presencas } = historico;
  const carregarHistorico = async () => {
    if (completo || carregando) return;
    setCarregando(true);
    setErroHistorico("");
    try {
      if (!("DecompressionStream" in globalThis)) throw new Error("Navegador sem suporte à descompactação");
      const response = await fetch("/data/historico/" + encodeURIComponent(parlamentarId) + ".json.gz", { cache: "force-cache" });
      if (!response.ok || !response.body) throw new Error("Arquivo histórico indisponível");
      const stream = response.body.pipeThrough(new DecompressionStream("gzip"));
      const data = JSON.parse(await new Response(stream).text()) as {
        version?: number; id?: string; votos?: VotoHistoricoItem[]; presencas?: PresencaHistoricoItem[]
      };
      if (data.version !== 1 || data.id !== parlamentarId ||
          !Array.isArray(data.votos) || !Array.isArray(data.presencas) ||
          data.votos.length !== totalVotos || data.presencas.length !== totalPresencas) {
        throw new Error("Arquivo de histórico incompatível com os totais do perfil");
      }
      setHistorico({ votos: data.votos, presencas: data.presencas });
      setCompleto(true);
    } catch (error) {
      setErroHistorico(error instanceof Error ? error.message : "Não foi possível carregar o histórico");
    } finally { setCarregando(false); }
  };
  const [paginaVotos, setPaginaVotos] = useState(1);
  const [paginaPresencas, setPaginaPresencas] = useState(1);
  const [paginaEmendas, setPaginaEmendas] = useState(1);

  const itensPorPagina = 12;

  const totalPaginasVotos = Math.max(1, Math.ceil(votos.length / itensPorPagina));
  const votosPaginados = votos.slice(
    (paginaVotos - 1) * itensPorPagina,
    paginaVotos * itensPorPagina
  );

  const totalPaginasPresencas = Math.max(1, Math.ceil(presencas.length / itensPorPagina));
  const presencasPaginadas = presencas.slice(
    (paginaPresencas - 1) * itensPorPagina,
    paginaPresencas * itensPorPagina
  );

  const totalPaginasEmendas = Math.max(1, Math.ceil(emendas.length / itensPorPagina));
  const emendasPaginadas = emendas.slice(
    (paginaEmendas - 1) * itensPorPagina,
    paginaEmendas * itensPorPagina
  );

  return (
    <div className="my-8 space-y-6">
      
      <div className="flex gap-2 sm:gap-3 flex-wrap border-b-4 border-ink pb-2">
        <button
          type="button"
          onClick={() => setAbaAtiva("votos")}
          className={`font-heavy text-xs sm:text-sm tracking-wider uppercase px-4 py-2.5 border-2 border-ink transition-all ${
            abaAtiva === "votos"
              ? "bg-punk-red text-white shadow-[4px_4px_0_#101010] transform -rotate-1"
              : "bg-paper-card text-ink hover:bg-white"
          }`}
        >
          [01] VOTOS NOMINAIS ({totalVotos})
        </button>

        <button
          type="button"
          onClick={() => setAbaAtiva("presencas")}
          className={`font-heavy text-xs sm:text-sm tracking-wider uppercase px-4 py-2.5 border-2 border-ink transition-all ${
            abaAtiva === "presencas"
              ? "bg-punk-acid text-ink shadow-[4px_4px_0_#101010] transform rotate-1"
              : "bg-paper-card text-ink hover:bg-white"
          }`}
        >
          [02] REGISTROS DE PRESENÇA ({totalPresencas})
        </button>

        <button
          type="button"
          onClick={() => setAbaAtiva("emendas")}
          className={`font-heavy text-xs sm:text-sm tracking-wider uppercase px-4 py-2.5 border-2 border-ink transition-all ${
            abaAtiva === "emendas"
              ? "bg-ink text-paper shadow-[4px_4px_0_#e42232] transform -rotate-1"
              : "bg-paper-card text-ink hover:bg-white"
          }`}
        >
          [03] EMENDAS R$ ({emendas.length})
        </button>

        <button
          type="button"
          onClick={() => setAbaAtiva("patrimonio")}
          className={`font-heavy text-xs sm:text-sm tracking-wider uppercase px-4 py-2.5 border-2 border-ink transition-all ${
            abaAtiva === "patrimonio"
              ? "bg-white text-punk-red border-punk-red shadow-[4px_4px_0_#101010] transform rotate-1"
              : "bg-paper-card text-ink hover:bg-white"
          }`}
        >
          [04] PATRIMÔNIO TSE ({bensDeclarados.length || totaisTse.length})
        </button>
      </div>

      {(totalVotos > votos.length || totalPresencas > presencas.length) && !completo && (
        <div className="border-2 border-ink bg-paper-card p-4 font-mono text-xs space-y-2">
          <p>Mostrando {votos.length} de {totalVotos} votos e {presencas.length} de {totalPresencas} presenças recentes.</p>
          <p>O histórico completo permanece disponível em arquivo comprimido, sem carregar milhares de registros ao abrir a página.</p>
          <button type="button" onClick={carregarHistorico} disabled={carregando}
            className="btn-punk px-4 py-2 disabled:opacity-50">
            {carregando ? "CARREGANDO ARQUIVO..." : "CARREGAR HISTÓRICO COMPLETO"}
          </button>
          {erroHistorico && <p role="alert" className="text-punk-red">Falha: {erroHistorico}</p>}
        </div>
      )}
      
      {abaAtiva === "votos" && (
        <div className="space-y-4">
          {votosPaginados.length > 0 ? (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {votosPaginados.map((v) => {
                  const prop = v.votacao.proposicao;
                  const vot = v.votacao;
                  const opcao = (v.opcaoOriginal || v.opcao).toUpperCase();
                  const isSim = opcao === "SIM";
                  const isNao = opcao === "NAO";

                  return (
                    <div
                      key={v.id}
                      className="ruido-paper-card bg-paper-light border-2 border-ink p-4 shadow-[4px_4px_0_#101010] flex flex-col justify-between transition-all hover:shadow-[6px_6px_0_#e42232]"
                    >
                      <div>
                        
                        <div className="flex justify-between items-start gap-2 mb-2 pb-2 border-b border-dashed border-ink/20 font-mono text-xs">
                          <span className="text-ink/70">
                            {formatarDataHoraBR(vot.dataHora)}
                          </span>

                          <span
                            className={`font-heavy text-xs px-2.5 py-0.5 border-2 border-ink shadow-[2px_2px_0_#101010] uppercase ${
                              isSim
                                ? "bg-green-600 text-white"
                                : isNao
                                ? "bg-punk-red text-white"
                                : "bg-ink text-paper"
                            }`}
                          >
                            VOTOU: {opcao}
                          </span>
                        </div>

                        {prop && (
                          <h4 className="font-heavy text-xl uppercase tracking-tight text-ink hover:text-punk-red transition-colors my-1">
                            <Link href={`/pautas/detalhe?id=${prop.id}`}>
                              {prop.siglaTipo} {prop.numero}/{prop.ano}
                            </Link>
                          </h4>
                        )}

                        <p className="font-mono text-xs text-ink/80 leading-relaxed my-2 line-clamp-3">
                          {prop?.ementa || vot.descricao}
                        </p>
                      </div>

                      <div className="mt-3 pt-2 border-t border-dashed border-ink/20 flex justify-between items-center font-mono text-[11px] text-ink/70">
                        <span>
                          Placar: SIM {vot.placarSim} &bull; NÃO {vot.placarNao}
                        </span>
                        {prop && (
                          <Link
                            href={`/pautas/detalhe?id=${prop.id}`}
                            className="font-bold text-punk-red hover:underline"
                          >
                            Ver Matéria &rarr;
                          </Link>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              
              {totalPaginasVotos > 1 && (
                <div className="py-4 border-t-2 border-ink flex justify-between items-center font-mono text-xs">
                  <span>
                    Página <strong>{paginaVotos}</strong> de {totalPaginasVotos}
                  </span>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={paginaVotos <= 1}
                      onClick={() => setPaginaVotos((p) => Math.max(1, p - 1))}
                      className="btn-punk px-3 py-1 disabled:opacity-40 disabled:pointer-events-none"
                    >
                      &larr; Anterior
                    </button>
                    <button
                      type="button"
                      disabled={paginaVotos >= totalPaginasVotos}
                      onClick={() => setPaginaVotos((p) => Math.min(totalPaginasVotos, p + 1))}
                      className="btn-punk px-3 py-1 disabled:opacity-40 disabled:pointer-events-none"
                    >
                      Próxima &rarr;
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-paper-card border-2 border-ink p-6 font-mono text-center text-xs">
              Não há votos disponíveis para este parlamentar nos registros consultados. Isso não indica falta à sessão.
            </div>
          )}
        </div>
      )}

      
      {abaAtiva === "presencas" && (
        <div className="space-y-4">
          {presencasPaginadas.length > 0 ? (
            <div>
              <div className="overflow-x-auto">
                <table className="w-full text-left font-mono text-xs">
                  <thead>
                    <tr>
                      <th>DATA SESSÃO</th>
                      <th>SESSÃO PLENÁRIA</th>
                      <th>STATUS REGISTRADO</th>
                      <th>JUSTIFICATIVA APRESENTADA</th>
                    </tr>
                  </thead>
                  <tbody>
                    {presencasPaginadas.map((pres) => {
                      const isPresente = pres.status === "PRESENTE";
                      return (
                        <tr key={pres.id}>
                          <td className="whitespace-nowrap font-bold">
                            {formatarDataBR(pres.dataSessao)}
                          </td>
                          <td>
                            {pres.tituloSessao}{" "}
                            <span className="text-[10px] text-ink/60">
                              (#{pres.sessaoExternalId})
                            </span>
                          </td>
                          <td>
                            <span
                              className={`font-heavy text-xs px-2 py-0.5 border ${
                                isPresente
                                  ? "bg-green-100 text-green-900 border-green-800"
                                  : "bg-red-100 text-red-900 border-red-800"
                              }`}
                            >
                              {pres.status}
                            </span>
                          </td>
                          <td className="text-ink/80">{pres.justificativa || "-"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              
              {totalPaginasPresencas > 1 && (
                <div className="py-4 border-t-2 border-ink flex justify-between items-center font-mono text-xs">
                  <span>
                    Página <strong>{paginaPresencas}</strong> de {totalPaginasPresencas}
                  </span>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={paginaPresencas <= 1}
                      onClick={() => setPaginaPresencas((p) => Math.max(1, p - 1))}
                      className="btn-punk px-3 py-1 disabled:opacity-40 disabled:pointer-events-none"
                    >
                      &larr; Anterior
                    </button>
                    <button
                      type="button"
                      disabled={paginaPresencas >= totalPaginasPresencas}
                      onClick={() => setPaginaPresencas((p) => Math.min(totalPaginasPresencas, p + 1))}
                      className="btn-punk px-3 py-1 disabled:opacity-40 disabled:pointer-events-none"
                    >
                      Próxima &rarr;
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-paper-card border-2 border-ink p-6 font-mono text-center text-xs">
              Não constam registros de presença disponíveis para este parlamentar nos registros consultados.
            </div>
          )}
        </div>
      )}

      
      {abaAtiva === "emendas" && (
        <div className="space-y-4">
          {emendasPaginadas.length > 0 ? (
            <div>
              <div className="overflow-x-auto">
                <table className="w-full text-left font-mono text-xs">
                  <thead>
                    <tr>
                      <th>ANO</th>
                      <th>CÓDIGO</th>
                      <th>MODALIDADE</th>
                      <th>DESTINO</th>
                      <th>VALOR EMPENHADO</th>
                      <th>VALOR PAGO R$</th>
                    </tr>
                  </thead>
                  <tbody>
                    {emendasPaginadas.map((em) => (
                      <tr key={em.id}>
                        <td className="font-bold">{em.ano}</td>
                        <td className="font-mono text-punk-red">{em.codigoEmenda}</td>
                        <td>{em.tipo}</td>
                        <td>
                          {em.municipioBeneficiado || "-"}/{em.ufBeneficiada || "-"}
                        </td>
                        <td className="whitespace-nowrap">
                          {formatarMoeda(em.valorEmpenhado)}
                        </td>
                        <td className="whitespace-nowrap font-bold text-green-700">
                          {formatarMoeda(em.valorPago)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              
              {totalPaginasEmendas > 1 && (
                <div className="py-4 border-t-2 border-ink flex justify-between items-center font-mono text-xs">
                  <span>
                    Página <strong>{paginaEmendas}</strong> de {totalPaginasEmendas}
                  </span>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={paginaEmendas <= 1}
                      onClick={() => setPaginaEmendas((p) => Math.max(1, p - 1))}
                      className="btn-punk px-3 py-1 disabled:opacity-40 disabled:pointer-events-none"
                    >
                      &larr; Anterior
                    </button>
                    <button
                      type="button"
                      disabled={paginaEmendas >= totalPaginasEmendas}
                      onClick={() => setPaginaEmendas((p) => Math.min(totalPaginasEmendas, p + 1))}
                      className="btn-punk px-3 py-1 disabled:opacity-40 disabled:pointer-events-none"
                    >
                      Próxima &rarr;
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-paper-card border-2 border-ink p-6 font-mono text-center text-xs">
              Nenhuma emenda vinculada por identidade confirmada na parte já sincronizada do Portal da Transparência. A ausência de vínculo não comprova ausência de autoria.
            </div>
          )}
        </div>
      )}

      
      {abaAtiva === "patrimonio" && (
        <div className="space-y-4">
          <GraficoPatrimonio
            bensDeclarados={bensDeclarados}
            totaisTse={totaisTse}
            parlamentarNome={parlamentarNome}
          />
        </div>
      )}
    </div>
  );
}
