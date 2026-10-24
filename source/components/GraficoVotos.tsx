"use client";

import React, { useState } from "react";
import { frequenciaAuditadaPercentual, type CoberturaPresenca } from "@/lib/presencaMetric";

export interface GraficoVotosProps {
  votosSim: number;
  votosNao: number;
  votosAbstencao: number;
  votosObstrucao: number;
  votosArtigo17?: number;
  votosOutros?: number;
  outrosVotosDetalhados?: Array<{ opcao: string; total?: number; count?: number }>;
  frequenciaAuditada?: { sessoes: number; presentes: number; ausentes: number; justificadas: number };
  coberturaRecorte?: CoberturaPresenca;
  presencasPresente: number;
  presencasJustificado: number;
  presencasAusente: number;
  alinhamentoMaioriaPct?: number | null;
  totalVotacoesAlinhamentoElegiveis?: number;
  totalVotosAlinhados?: number;
}

export function GraficoVotos({
  votosSim,
  votosNao,
  votosAbstencao,
  votosObstrucao,
  votosArtigo17 = 0,
  votosOutros = 0,
  outrosVotosDetalhados = [],
  frequenciaAuditada,
  coberturaRecorte,
  presencasPresente,
  presencasJustificado,
  presencasAusente,
  alinhamentoMaioriaPct,
  totalVotacoesAlinhamentoElegiveis = 0,
  totalVotosAlinhados = 0,
}: GraficoVotosProps) {
  const [modoExibicao, setModoExibicao] = useState<"grafico" | "tabela">("grafico");

  const totalVotos =
    votosSim + votosNao + votosAbstencao + votosObstrucao + votosArtigo17 + votosOutros;
  const totalSessoesAuditadas =
    presencasPresente + presencasJustificado + presencasAusente;
  const percentualAuditoria=frequenciaAuditadaPercentual(frequenciaAuditada);
  const indicador=percentualAuditoria!==null?{
    percentual:percentualAuditoria,amostra:frequenciaAuditada!.sessoes,
    registros:frequenciaAuditada!.presentes,metodo:"SESSÕES AUDITADAS" as const,
  }:coberturaRecorte?{
    percentual:coberturaRecorte.percentual,amostra:coberturaRecorte.eventosMonitorados,
    registros:coberturaRecorte.eventosComRegistro,metodo:"EVENTOS COM REGISTRO" as const,
  }:null;

  const pctSim = totalVotos > 0 ? Math.round((votosSim / totalVotos) * 100) : 0;
  const pctNao = totalVotos > 0 ? Math.round((votosNao / totalVotos) * 100) : 0;
  const pctAbstencao = totalVotos > 0 ? Math.round((votosAbstencao / totalVotos) * 100) : 0;
  const pctObstrucao = totalVotos > 0 ? Math.round((votosObstrucao / totalVotos) * 100) : 0;


  return (
    <div className="relative ruido-paper-card bg-paper-card border-3 border-ink p-5 sm:p-6 my-6 shadow-[6px_6px_0_#101010]">
      {/* Scotch tape */}
      <div className="scotch-tape-corner" aria-hidden="true" />

      {/* Header & Mode Switcher */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-5 pb-4 border-b-2 border-dashed border-ink/30">
        <div>
          <div className="inline-block bg-ink text-punk-acid font-mono text-[10px] font-bold px-2 py-0.5 uppercase mb-1">
            ESTATÍSTICA NOMINAL
          </div>
          <h3 className="font-heavy text-2xl sm:text-3xl text-ink uppercase tracking-tight">
            COMPORTAMENTO LEGISLATIVO &amp; REGISTROS DE PRESENÇA
          </h3>
          <p className="font-mono text-xs text-ink/75">
            Distribuição dos votos conhecidos e contagem de registros oficiais; frequência total só poderá ser calculada após validar o universo de sessões exigíveis.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setModoExibicao("grafico")}
            className={`font-mono text-xs font-bold px-3 py-1.5 border-2 border-ink transition-all ${
              modoExibicao === "grafico"
                ? "bg-punk-acid text-ink shadow-[2px_2px_0_#101010]"
                : "bg-paper text-ink/70 hover:bg-white"
            }`}
          >
            GRÁFICOS
          </button>
          <button
            type="button"
            onClick={() => setModoExibicao("tabela")}
            className={`font-mono text-xs font-bold px-3 py-1.5 border-2 border-ink transition-all ${
              modoExibicao === "tabela"
                ? "bg-punk-acid text-ink shadow-[2px_2px_0_#101010]"
                : "bg-paper text-ink/70 hover:bg-white"
            }`}
          >
            TABELA
          </button>
        </div>
      </div>

      {/* Alignment with Majority callout */}
      {alinhamentoMaioriaPct !== null && alinhamentoMaioriaPct !== undefined && (
        <div className="bg-paper-light border-2 border-ink p-3 mb-6 shadow-[3px_3px_0_#101010] flex flex-wrap items-center justify-between gap-3 font-mono text-xs">
          <div>
            <strong className="text-ink uppercase">Alinhamento com a maioria do plenário:</strong>
            <span className="text-ink/70 ml-1">
              ({totalVotosAlinhados} de {totalVotacoesAlinhamentoElegiveis} votações conclusivas)
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="font-heavy text-2xl text-punk-red leading-none">
              {alinhamentoMaioriaPct}%
            </span>
            <span className="rubber-stamp rubber-stamp-red text-[10px]">
              {alinhamentoMaioriaPct > 60 ? "ALINHADO" : "INDEPENDENTE"}
            </span>
          </div>
        </div>
      )}

      {modoExibicao === "grafico" ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Votos */}
          <div className="ruido-paper-card bg-paper-light border-2 border-ink p-4 shadow-[4px_4px_0_#101010]">
            <div className="flex justify-between items-center mb-3 pb-2 border-b border-dashed border-ink/30">
              <h4 className="font-heavy text-lg tracking-wide uppercase text-ink">
                Distribuição de Votos
              </h4>
              <span className="font-mono text-xs font-bold bg-ink text-paper px-2 py-0.5">
                {totalVotos} VOTOS
              </span>
            </div>

            <div className="space-y-3 font-mono text-xs">
              <div>
                <div className="flex justify-between mb-1 font-bold">
                  <span className="text-green-800">VOTO SIM: {votosSim}</span>
                  <span>{pctSim}%</span>
                </div>
                <div className="w-full h-4 bg-ink/10 border-2 border-ink overflow-hidden">
                  <div
                    style={{ width: `${pctSim}%` }}
                    className="h-full bg-green-600 transition-all duration-500"
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between mb-1 font-bold">
                  <span className="text-punk-red">VOTO NÃO: {votosNao}</span>
                  <span>{pctNao}%</span>
                </div>
                <div className="w-full h-4 bg-ink/10 border-2 border-ink overflow-hidden">
                  <div
                    style={{ width: `${pctNao}%` }}
                    className="h-full bg-punk-red transition-all duration-500"
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between mb-1 font-bold">
                  <span className="text-ink/80">ABSTENÇÃO: {votosAbstencao}</span>
                  <span>{pctAbstencao}%</span>
                </div>
                <div className="w-full h-4 bg-ink/10 border-2 border-ink overflow-hidden">
                  <div
                    style={{ width: `${pctAbstencao}%` }}
                    className="h-full bg-ink/60 transition-all duration-500"
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between mb-1 font-bold">
                  <span className="text-yellow-700">OBSTRUÇÃO: {votosObstrucao}</span>
                  <span>{pctObstrucao}%</span>
                </div>
                <div className="w-full h-4 bg-ink/10 border-2 border-ink overflow-hidden">
                  <div
                    style={{ width: `${pctObstrucao}%` }}
                    className="h-full bg-yellow-500 transition-all duration-500"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Evidências de presença — sem percentual enganoso. A Câmara traz
              somente os PRESENTES dos eventos consultados; não podemos assumir
              que os outros parlamentares estavam obrigados a comparecer. */}
          <div className="ruido-paper-card bg-paper-light border-2 border-ink p-4 shadow-[4px_4px_0_#101010]">
            <div className="flex justify-between items-center mb-3 pb-2 border-b border-dashed border-ink/30">
              <h4 className="font-heavy text-lg tracking-wide uppercase text-ink">
                Registros de comparecimento
              </h4>
              <span className="font-mono text-xs font-bold bg-ink text-paper px-2 py-0.5">
                {totalSessoesAuditadas} REGISTROS
              </span>
            </div>
            <div className="bg-punk-acid border-l-4 border-ink p-3 font-mono text-xs mb-4">
              <strong>{frequenciaAuditada?.sessoes ? "COBERTURA DAS SESSÕES AUDITADAS" : "FREQUÊNCIA TOTAL: NÃO CALCULÁVEL"}</strong>
              <p className="mt-2">
                {frequenciaAuditada?.sessoes ? `Nas ${frequenciaAuditada.sessoes} sessões com frequência auditada oficialmente: ${frequenciaAuditada.presentes} presenças, ${frequenciaAuditada.ausentes} ausências e ${frequenciaAuditada.justificadas} justificativas. Isto não é taxa de assiduidade do mandato inteiro.` : "Para calcular presença total precisamos de todas as sessões exigíveis no período de exercício, incluindo dispensas e justificativas. A base atual registra somente evidências disponíveis."}
              </p>
            </div>
            {indicador && <div className="border-2 border-ink bg-paper p-3 mb-4 font-mono text-xs">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <strong>{indicador.metodo==="SESSÕES AUDITADAS"?
                  "PRESENÇA NAS SESSÕES AUDITADAS":"EVENTOS DO RECORTE COM PRESENÇA REGISTRADA"}</strong>
                <strong className="font-heavy text-3xl">{indicador.percentual.toLocaleString("pt-BR")}%</strong>
              </div>
              <p className="mt-1">{indicador.registros} registros em {indicador.amostra} eventos/sessões no recorte.</p>
              <p className="mt-2 text-ink/75">
                {indicador.metodo==="SESSÕES AUDITADAS"?
                  "Percentual calculado apenas sobre sessões com contagem oficial fechada; não é taxa de assiduidade do mandato inteiro.":
                  "Percentual descritivo de eventos presentes no arquivo durante o intervalo observado. Ausência de registro NÃO significa falta. Não é taxa de assiduidade."}
              </p>
              {coberturaRecorte&&indicador.metodo==="EVENTOS COM REGISTRO"&&
                <p className="mt-2">Período observado: {coberturaRecorte.inicioRecorte} a {coberturaRecorte.fimRecorte}.
                  <a className="underline ml-2" href={coberturaRecorte.fonte}
                    target="_blank" rel="noopener noreferrer">FONTE OFICIAL ↗</a>
                </p>}
            </div>}
            <div className="space-y-3 text-xs font-mono">
              <div className="flex justify-between border-b border-dashed border-ink/30 pb-2">
                <span className="text-green-800 font-bold">Presenças confirmadas</span>
                <strong>{presencasPresente}</strong>
              </div>
              <div className="flex justify-between border-b border-dashed border-ink/30 pb-2">
                <span>Ausências justificadas documentadas</span>
                <strong>{presencasJustificado}</strong>
              </div>
              <div className="flex justify-between border-b border-dashed border-ink/30 pb-2">
                <span className="text-punk-red">Ausências documentadas</span>
                <strong>{presencasAusente}</strong>
              </div>
              <div className="text-ink/70">
                Não registrados ≠ ausentes. 2 presenças, por exemplo, não equivalem a 100%.
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left font-mono text-xs">
            <thead>
              <tr>
                <th>CATEGORIA AUDITADA</th>
                <th>TOTAL REGISTRADO</th>
                <th>PERCENTUAL (%) NO RECORTE</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="font-bold text-green-800">Voto SIM</td>
                <td>{votosSim}</td>
                <td>{pctSim}%</td>
              </tr>
              <tr>
                <td className="font-bold text-punk-red">Voto NÃO</td>
                <td>{votosNao}</td>
                <td>{pctNao}%</td>
              </tr>
              <tr>
                <td>Abstenção em Votação</td>
                <td>{votosAbstencao}</td>
                <td>{pctAbstencao}%</td>
              </tr>
              <tr>
                <td>Obstrução Parlamentar</td>
                <td>{votosObstrucao}</td>
                <td>{pctObstrucao}%</td>
              </tr>
              <tr>
                <td className="font-bold text-green-800">Sessões com Presença</td>
                <td>{presencasPresente}</td>
                <td title="O percentual se refere apenas ao universo auditado ou à amostra documental. Não é assiduidade do mandato.">{indicador ? indicador.percentual.toLocaleString("pt-BR")+"%" : "N/D"}</td>
              </tr>
              <tr>
                <td>Ausência com Justificativa</td>
                <td>{percentualAuditoria!==null?frequenciaAuditada?.justificadas:presencasJustificado}</td>
                <td>{percentualAuditoria!==null?
                  (Math.round(1000*frequenciaAuditada!.justificadas/frequenciaAuditada!.sessoes)/10).toLocaleString("pt-BR")+"%" : "N/D"}</td>
              </tr>
              <tr>
                <td className="font-bold text-punk-red">Ausências documentadas</td>
                <td>{percentualAuditoria!==null?frequenciaAuditada?.ausentes:presencasAusente}</td>
                <td>{percentualAuditoria!==null?
                  (Math.round(1000*frequenciaAuditada!.ausentes/frequenciaAuditada!.sessoes)/10).toLocaleString("pt-BR")+"%" : "N/D"}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
