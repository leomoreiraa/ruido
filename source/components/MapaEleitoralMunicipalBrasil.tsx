"use client";

import React, { memo, useCallback, useEffect, useMemo, useState } from "react";

type Candidato = { numero: string; nome: string; votos: number; percentual: number | null };
type Resultado = { situacao: "aguardando" | "parcial" | "concluida"; votosValidos: number | null; candidatos: Candidato[] };
type Cidade = { uf: string; codigoIBGE: string; nome: string };
type Grupo = { uf: string; fonte: string; municipios: Array<{ id: string; d: string }> };
type Malhas = { versao: 1; viewBox: string; totalMunicipios: number; ufs: Grupo[] };
type Props = {
  resultados?: Record<string, Resultado>;
  municipios?: Cidade[];
  estados: Array<{ uf: string; nome: string; svgPath: string }>;
  onSelectCidade: (uf: string, codigoIBGE: string) => void;
};

const BRANCO = "#f5f1e8";
const VERMELHO = "#e42232";
const VERDE = "#43ba70";
const EMPATE = "#d9b85a";
const AUSENTE = "#a8aba5";
const numberFormat = new Intl.NumberFormat("pt-BR");
const percentFormat = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2, minimumFractionDigits: 2 });

function classificar(resultado?: Resultado): "lula" | "flavio" | "empate" | "ausente" {
  if (!resultado || resultado.situacao === "aguardando" || !resultado.votosValidos) return "ausente";
  const lula = resultado.candidatos.find(c => c.numero === "13");
  const flavio = resultado.candidatos.find(c => c.numero === "22");
  if (!lula || !flavio) return "ausente";
  return lula.votos > flavio.votos ? "lula" : flavio.votos > lula.votos ? "flavio" : "empate";
}

function corDoMunicipio(resultado?: Resultado): string {
  const tipo = classificar(resultado);
  return tipo === "lula" ? VERMELHO : tipo === "flavio" ? VERDE : tipo === "empate" ? EMPATE : AUSENTE;
}

const GrupoMunicipal = memo(function GrupoMunicipal({ grupo, resultados }: { grupo: Grupo; resultados?: Record<string, Resultado> }) {
  return <g data-uf={grupo.uf}>
    {grupo.municipios.map(m => <path
      key={m.id}
      data-city={m.id}
      d={m.d}
      fill={corDoMunicipio(resultados?.[m.id])}
      fillRule="evenodd"
      stroke={BRANCO}
      strokeOpacity={0.28}
      strokeWidth={0.18}
      strokeLinejoin="round"
    />)}
  </g>;
});

export function MapaEleitoralMunicipalBrasil({ resultados, municipios, estados, onSelectCidade }: Props) {
  const [malha, setMalha] = useState<Malhas | null>(null);
  const [falhou, setFalhou] = useState(false);
  const [destacado, setDestacado] = useState<string | null>(null);

  useEffect(() => {
    let ativo = true;
    const carregar = async () => {
      try {
        const resposta = await fetch("/data/municipios-brasil-malhas.json");
        if (!resposta.ok) throw new Error("Mapa municipal nacional não publicado");
        const parsed = await resposta.json() as Malhas;
        if (parsed.versao !== 1 || parsed.viewBox !== "0 0 720 710" || parsed.ufs?.length !== 27 ||
          parsed.totalMunicipios < 5400 || parsed.ufs.reduce((n, uf) => n + uf.municipios.length, 0) !== parsed.totalMunicipios)
          throw new Error("Mapa nacional incompleto ou inválido");
        if (ativo) { setMalha(parsed); setFalhou(false); }
      } catch {
        if (ativo) setFalhou(true);
      }
    };
    void carregar();
    return () => { ativo = false; };
  }, []);

  const cidadesPorCodigo = useMemo(() => new Map((municipios ?? []).map(m => [m.codigoIBGE, m])), [municipios]);
  const nomesUF = useMemo(() => new Map(estados.map(e => [e.uf, e.nome])), [estados]);

  const aoMover = useCallback((event: React.PointerEvent<SVGSVGElement>) => {
    const codigo = (event.target as Element).getAttribute("data-city");
    setDestacado(old => old === codigo ? old : codigo);
  }, []);
  const aoClicar = useCallback((event: React.MouseEvent<SVGSVGElement>) => {
    const codigo = (event.target as Element).getAttribute("data-city");
    const cidade = codigo ? cidadesPorCodigo.get(codigo) : undefined;
    if (cidade) onSelectCidade(cidade.uf, codigo!);
  }, [cidadesPorCodigo, onSelectCidade]);

  const focado = destacado ? cidadesPorCodigo.get(destacado) : undefined;
  const resultadoFoco = destacado ? resultados?.[destacado] : undefined;
  const lula = resultadoFoco?.candidatos.find(c => c.numero === "13");
  const flavio = resultadoFoco?.candidatos.find(c => c.numero === "22");

  const estatisticas = useMemo(() => {
    const total = { lula: 0, flavio: 0, empate: 0, ausente: 0 };
    if (malha) for (const grupo of malha.ufs)
      for (const cidade of grupo.municipios) total[classificar(resultados?.[cidade.id])]++;
    return total;
  }, [malha, resultados]);

  if (!malha) return <div className="min-h-[360px] flex items-center justify-center bg-[#e8e4db] border border-ink/20 px-5 text-center font-mono text-sm text-ink" aria-live="polite">
    {falhou ? "A malha municipal nacional não está disponível nesta publicação. Os números oficiais seguem acessíveis na pesquisa por cidade." : "Carregando mosaico dos municípios brasileiros..."}
  </div>;

  return <div className="space-y-3">
    <div className="bg-[#e8e4db] border border-ink/25 relative overflow-hidden rounded-sm">
      <svg
        viewBox={malha.viewBox}
        className="block w-full max-h-[700px]"
        role="group"
        aria-label="Mapa dos municípios do Brasil: verde para maior votação de Flávio; vermelho para maior votação de Lula; selecione uma cidade ou pesquise pelo nome."
        onPointerMove={aoMover}
        onPointerLeave={() => setDestacado(null)}
        onClick={aoClicar}
        style={{ cursor: "crosshair", touchAction: "manipulation" }}
      >
        {malha.ufs.map(grupo => <GrupoMunicipal key={grupo.uf} grupo={grupo} resultados={resultados} />)}
        {estados.map(e => <path
          key={e.uf}
          d={e.svgPath}
          fill="none"
          stroke="#2b3532"
          strokeOpacity={0.46}
          strokeWidth={0.7}
          strokeLinejoin="round"
          pointerEvents="none"
        />)}
      </svg>
    </div>
    <div className="grid gap-3 sm:grid-cols-[1fr_auto] items-start">
      <div className="min-h-[65px] bg-white/70 border-l-[3px] border-ink/70 px-3 py-2 font-mono text-xs" aria-live="polite">
        {focado ? <>
          <strong className="block text-sm">{focado.nome} / {nomesUF.get(focado.uf) ?? focado.uf}</strong>
          <p>Lula: {lula && resultadoFoco?.votosValidos ? numberFormat.format(lula.votos)+" votos ("+percentFormat.format(lula.percentual ?? 0)+"%)" : "sem dados"} · Flávio: {flavio && resultadoFoco?.votosValidos ? numberFormat.format(flavio.votos)+" votos ("+percentFormat.format(flavio.percentual ?? 0)+"%)" : "sem dados"}</p>
          <p className="text-ink/70">Clique para abrir a cidade e os dados completos.</p>
        </> : <>
          <strong className="block text-sm">Distribuição municipal do voto</strong>
          <p>Passe o cursor sobre um município ou toque para consultar seus resultados. As linhas estaduais servem somente como referência geográfica.</p>
        </>}
      </div>
      <div className="text-[11px] font-mono grid grid-cols-2 gap-x-4 gap-y-1 text-ink">
        <span><span style={{ color: VERMELHO }}>■</span> Lula: {numberFormat.format(estatisticas.lula)}</span>
        <span><span style={{ color: VERDE }}>■</span> Flávio: {numberFormat.format(estatisticas.flavio)}</span>
        <span><span style={{ color: EMPATE }}>■</span> Empates: {numberFormat.format(estatisticas.empate)}</span>
        <span><span style={{ color: AUSENTE }}>■</span> Sem dados: {numberFormat.format(estatisticas.ausente)}</span>
      </div>
    </div>
    <p className="font-mono text-[11px] text-ink/70">
      {numberFormat.format(malha.totalMunicipios)} contornos municipais. A cor é calculada individualmente para cada cidade, nunca pelo total do estado. A superfície colorida representa área geográfica, não quantidade de eleitores.
    </p>
  </div>;
}
