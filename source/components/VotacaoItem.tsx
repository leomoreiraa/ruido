// components/VotacaoItem.tsx

import React from "react";
import Link from "next/link";
import { formatarDataHoraBR } from "@/lib/utils";

interface ProposicaoRef {
  id: string;
  siglaTipo: string;
  numero: number;
  ano: number;
  ementa: string;
}

interface VotacaoItemProps {
  id: string;
  externalId: string;
  casa: string;
  dataHora: string;
  descricao: string;
  resumo?: string | null;
  aprovada?: boolean | null;
  placarSim: number;
  placarNao: number;
  placarAbstencao: number;
  placarOutros?: number;
  placarObstrucao?: number;
  cobertura?: string;
  votacaoSecreta?: boolean;
  proposicao?: ProposicaoRef | null;
  fonteUrl?: string | null;
}

export function VotacaoItem({
  id,
  externalId,
  casa,
  dataHora,
  descricao,
  resumo,
  aprovada,
  placarSim,
  placarNao,
  placarAbstencao,
  placarOutros = 0,
  placarObstrucao = 0,
  cobertura,
  votacaoSecreta = false,
  proposicao,
  fonteUrl,
}: VotacaoItemProps) {
  const isCamara = casa === "CAMARA";
  const totalNominal =
    placarSim + placarNao + placarAbstencao + placarOutros + placarObstrucao;

  const urlOficial = fonteUrl || (isCamara
    ? "https://dadosabertos.camara.leg.br/api/v2/votacoes/" + encodeURIComponent(externalId)
    : "https://legis.senado.leg.br/dadosabertos/votacao");

  return (
    <article className="relative ruido-paper-card ruido-votacao-folha bg-paper-light border-2 sm:border-3 border-ink p-5 sm:p-6 my-4 shadow-[6px_6px_0_#101010] transition-all hover:shadow-[9px_9px_0_#e42232]">
      {/* Scotch tape on top right corner */}
      <div className="absolute -top-2.5 right-6 w-24 h-5 bg-[#fdf0b0]/85 border-x-2 border-dashed border-[#cbb35a] shadow-sm transform -rotate-2 pointer-events-none z-10" />

      {/* Header Info Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3 pb-3 border-b-2 border-dashed border-ink/20 font-mono text-xs">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-bold bg-ink text-punk-acid px-2 py-0.5 uppercase tracking-wider text-[10px]">
            {isCamara ? "CÂMARA DOS DEPUTADOS" : "SENADO FEDERAL"}
          </span>
          <span className="text-ink/60 font-semibold">
            {formatarDataHoraBR(dataHora)}
          </span>
        </div>

        {/* Rubber Stamp for Outcome */}
        <div>
          {votacaoSecreta ? (
            <span className="rubber-stamp rubber-stamp-red text-[11px]">
              VOTAÇÃO SECRETA
            </span>
          ) : aprovada === true ? (
            <span className="rubber-stamp rubber-stamp-green text-[11px]">
              ✓ APROVADO
            </span>
          ) : aprovada === false ? (
            <span className="rubber-stamp rubber-stamp-red text-[11px]">
              ✕ NÃO APROVADO
            </span>
          ) : (
            <span className="rubber-stamp rubber-stamp-acid text-[11px]">
              RESULTADO NÃO INFORMADO
            </span>
          )}
        </div>
      </div>

      {/* Proposition Title if attached */}
      {proposicao && (
        <h3 className="ruido-legible-vote-title font-heavy text-2xl sm:text-3xl tracking-tight uppercase my-2">
          <Link className="ruido-proposition-text-link" href={`/pautas/detalhe?id=${proposicao.id}`}>
            {proposicao.siglaTipo} {proposicao.numero}/{proposicao.ano}
          </Link>
        </h3>
      )}

      {/* Description / Summary */}
      <p className="font-mono text-xs sm:text-sm text-ink/85 leading-relaxed my-3 border-l-3 border-punk-red pl-3">
        {resumo || descricao}
      </p>

      {/* Placar Box */}
      {totalNominal > 0 ? (
        <div className="my-4 p-3 bg-paper-card border-2 border-ink shadow-[3px_3px_0_#101010]">
          <div className="flex justify-between items-center mb-2 font-mono text-[11px] font-bold text-ink border-b border-dashed border-ink/30 pb-1">
            <span>CONTAGENS DE VOTOS PUBLICADAS</span>
            <span className="bg-ink text-paper px-1.5 py-0.2">
              {totalNominal} registros contabilizados
            </span>
          </div>

          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 text-center font-mono">
            <div className="bg-green-100 border border-green-800 p-1.5 shadow-[1px_1px_0_#101010]">
              <span className="block text-[10px] text-green-900 font-bold uppercase">
                SIM
              </span>
              <strong className="font-heavy text-xl text-green-900">
                {placarSim}
              </strong>
            </div>

            <div className="bg-red-100 border border-red-800 p-1.5 shadow-[1px_1px_0_#101010]">
              <span className="block text-[10px] text-red-900 font-bold uppercase">
                NÃO
              </span>
              <strong className="font-heavy text-xl text-red-900">
                {placarNao}
              </strong>
            </div>

            <div className="bg-yellow-100 border border-yellow-800 p-1.5 shadow-[1px_1px_0_#101010]">
              <span className="block text-[10px] text-yellow-900 font-bold uppercase">
                ABSTENÇÃO
              </span>
              <strong className="font-heavy text-xl text-yellow-900">
                {placarAbstencao}
              </strong>
            </div>

            <div className="bg-gray-100 border border-gray-800 p-1.5 shadow-[1px_1px_0_#101010] col-span-3 sm:col-span-1">
              <span className="block text-[10px] text-gray-900 font-bold uppercase">
                OBST./OUTROS
              </span>
              <strong className="font-heavy text-xl text-gray-900">
                {placarOutros + placarObstrucao}
              </strong>
            </div>
          </div>
        </div>
      ) : (
        <div className="my-3 p-3 bg-paper-card border border-ink/40 font-mono text-xs text-ink/75 italic">
          {votacaoSecreta
            ? "Votação secreta: contagem não publicada na fonte consultada."
            : cobertura === "DADOS_PARCIAIS" ? "Detalhe oficial pendente; resumo da votação preservado." : "Contagem de votos não publicada nesta votação. Consulte a decisão na fonte oficial."}
        </div>
      )}

      {/* Footer links */}
      <div className="mt-4 pt-3 border-t-2 border-dashed border-ink/20 flex flex-wrap justify-between items-center gap-2 font-mono text-xs font-bold">
        {proposicao ? (
          <Link
            href={`/pautas/detalhe?id=${proposicao.id}`}
            className="text-punk-red hover:underline flex items-center gap-1"
          >
            <span>AUDITAR VOTOS DESTA PAUTA</span>
            <span aria-hidden="true">&rarr;</span>
          </Link>
        ) : (
          <span className="text-ink/50 text-[11px]">MATÉRIA ADMINISTRATIVA</span>
        )}

        <a
          href={urlOficial}
          target="_blank"
          rel="noopener noreferrer"
          className="text-ink/70 hover:text-ink text-[11px] underline underline-offset-2 flex items-center gap-1"
        >
          <span>REGISTRO NA FONTE OFICIAL</span>
          <span aria-hidden="true">↗</span>
        </a>
      </div>
    </article>
  );
}
