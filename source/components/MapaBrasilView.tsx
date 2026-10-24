"use client";

import React, { useMemo, useState } from "react";
import type { DadosMapa, EstadoMapa, Medida } from "@/lib/mapaBrasil";
import { valorIndicador } from "@/lib/mapaBrasil";
import { AtlasTerritorialView } from "@/components/AtlasTerritorialView";

type VisibleMedida = Medida;
const LABELS: Record<VisibleMedida,{titulo:string;resumo:string;unidade:string}> = {
  idhm:{titulo:"IDHM • DESENVOLVIMENTO HUMANO",resumo:"Índice de Desenvolvimento Humano Municipal agregado por UF (PNUD/FJP/IBGE). Considera educação, renda e longevidade; índice de 0 a 1. Série oficial 2012–2024.",unidade:"índice (0–1)"},
  idhmVariacao:{titulo:"EVOLUÇÃO ANUAL DO IDHM",resumo:"Diferença em pontos do índice desde o ano anterior, não porcentagem nem crescimento causado por emendas. Só anos com dois registros oficiais são comparados.",unidade:"pontos do índice"},
  pib:{titulo:"PIB ESTADUAL",resumo:"Produto Interno Bruto publicado pelo IBGE. Compare apenas anos com observações disponíveis.",unidade:"R$"},
  pibPerCapita:{titulo:"PIB POR HABITANTE",resumo:"PIB anual dividido pela população do mesmo ano. É uma média econômica, não a renda individual dos moradores.",unidade:"R$ / hab."},
  populacao:{titulo:"POPULAÇÃO ESTIMADA",resumo:"Estimativa de habitantes na UF, conforme ano de referência do IBGE.",unidade:"pessoas"},
  emendasPagas:{titulo:"EMENDAS PAGAS",resumo:"Montante pago com regionalização identificável na CGU; não são todos os investimentos.",unidade:"R$"},
  emendasPerCapita:{titulo:"EMENDAS POR HABITANTE",resumo:"Emendas pagas regionalizadas divididas pela população do mesmo ano.",unidade:"R$ / hab."},
  creditoMei:{titulo:"CRÉDITO AO MEI (BCB)",resumo:"Saldo de crédito à pessoa jurídica MEI, em milhões de reais. Não representa gasto público.",unidade:"R$"},
};
const metricas=Object.keys(LABELS) as VisibleMedida[];
const brl=(v:number,compact=false)=>new Intl.NumberFormat("pt-BR",{
  style:"currency",currency:"BRL",maximumFractionDigits:compact?1:2,
  ...(compact?{notation:"compact" as const}:{}),
}).format(v);
const numero=(v:number)=>new Intl.NumberFormat("pt-BR",{maximumFractionDigits:0}).format(v);
function representacao(v:number|null,medida:Medida):string{
  if(v===null||!Number.isFinite(v))return "N/D";
  if(medida==="idhm")return v.toFixed(3).replace(".",",");
  if(medida==="idhmVariacao")return (v>0?"+":"")+v.toFixed(3).replace(".",",")+" ponto(s)";
  return medida==="populacao"?numero(v):brl(v,v>1e6);
}
function getLatestYear(data:DadosMapa):number{
  for(const year of [...data.anos].reverse()){
    if(data.estados.filter(e=>valorIndicador(e,year,"idhm")!==null).length>=20)return year;
  }
  return data.anos.at(-1)??2022;
}
export function MapaBrasilView({data}:{data:DadosMapa|null}){
  const [metric,setMetric]=useState<VisibleMedida>("idhm");
  const [year,setYear]=useState(()=>data?getLatestYear(data):2022);
  const [uf,setUf]=useState("SP");
  const [hover,setHover]=useState<string|null>(null);
  const [compararCom,setCompararCom]=useState<string>("RJ");
  const states=data?.estados??[];
  const active=states.find(e=>e.uf===uf)??states[0];
  const hovered=states.find(e=>e.uf===hover);
  const chosen=hovered??active;
  const values=useMemo(()=>states.map(e=>({state:e,value:valorIndicador(e,year,metric)})),[states,year,metric]);
  const visible=values.filter((x):x is {state:EstadoMapa;value:number}=>x.value!==null&&Number.isFinite(x.value));
  const max=Math.max(0,...visible.map(v=>v.value));
  const maxAbsoluto=Math.max(0,...visible.map(v=>Math.abs(v.value)));
  const ordered=[...visible].sort((a,b)=>b.value-a.value).slice(0,9);
  const yearsAvailable=(data?.anos??[]).filter(y=>
    states.some(s=>valorIndicador(s,y,metric)!==null));
  const idhmTimeline=chosen
    ? Object.entries(chosen.idhmPorAno??{})
      .map(([ano,valor])=>({ano:Number(ano),valor}))
      .filter(row=>row.ano<=year && Number.isFinite(row.valor))
      .sort((a,b)=>a.ano-b.ano).slice(-8)
    : [];
  const idhmCurrent=chosen?valorIndicador(chosen,year,"idhm"):null;
  const idhmPrev=chosen?valorIndicador(chosen,year-1,"idhm"):null;
  const delta=chosen?valorIndicador(chosen,year,"idhmVariacao"):null;

  function fill(s:EstadoMapa){
    if(s.uf===uf)return "#e42232";
    const v=valorIndicador(s,year,metric);
    if(v===null||!max)return "#999891";
    if(metric==="idhmVariacao")return v>0.004?"#d8f53e":v>0?"#829e6b":v<0?"#b73c4c":"#6a706d";
    const ratio=v/max;
    if(ratio>=0.75)return "#d8f53e";
    if(ratio>=0.50)return "#c4d74f";
    if(ratio>=0.25)return "#949e57";
    if(ratio>=0.09)return "#657361";
    return "#424b46";
  }

  return <div className="mapa-brasil collage-page space-y-8 pb-12">
    <header className="ruido-ink-poster border-4 border-ink bg-ink text-paper p-5 sm:p-8 shadow-[10px_10px_0_#e42232] collage-stage relative overflow-hidden">
      <div className="absolute right-3 top-3 border-2 border-punk-red px-3 py-1 font-heavy text-punk-red text-sm -rotate-6 hidden sm:block">DOCUMENTO PÚBLICO // #027</div>
      <span className="font-mono text-xs text-punk-acid tracking-[.25em]">ARQUIVO CIDADÃO /// DESENVOLVIMENTO HUMANO</span>
      <h1 className="font-heavy text-5xl sm:text-7xl leading-tight mt-3 uppercase">BRASIL <span className="text-punk-red">EM RAIO X</span></h1>
      <p className="font-mono text-xs sm:text-sm text-paper/80 max-w-3xl mt-4 border-l-4 border-punk-acid pl-4">
        Compare o desenvolvimento humano dos estados e a sua evolução em relação ao ano anterior.
        IDHM do PNUD/FJP/IBGE, população, emendas da CGU e indicadores selecionados do Banco Central.
        O último IDHM publicado nesta série refere-se a 2024.
      </p>
      <div className="mt-5 flex flex-wrap gap-3 text-[10px] font-mono uppercase">
        <span className="bg-punk-acid text-ink px-2 py-1 font-bold">27 unidades federativas</span>
        <span className="border border-paper/40 px-2 py-1">PNUD + IBGE + BCB + CGU</span>
        <span className="border border-paper/40 px-2 py-1">{data?("Atualização: "+new Date(data.atualizadoEm).toLocaleDateString("pt-BR")):"Dados em preparação"}</span>
      </div>
    </header>

    {!data||!states.length?<section className="border-4 border-ink bg-paper-card p-8 font-mono">
      <strong className="font-heavy text-3xl block text-punk-red">MALHA EM PREPARAÇÃO</strong>
      <p className="mt-3 text-sm">Ainda não existe um arquivo estadual validado para este deploy.
        A geração será realizada pelo GitHub Actions usando as APIs oficiais — números fictícios não são exibidos.</p>
    </section>:<>
      <section className="ruido-filter-ink-panel ruido-paper-card bg-paper-card border-4 border-ink shadow-[8px_8px_0_#101010] p-4 sm:p-6">
        <div className="ruido-filter-ink-form flex flex-col lg:flex-row lg:items-end gap-4 lg:gap-6 justify-between">
          <div className="min-w-0 flex-1">
            <label htmlFor="map-metric" className="font-mono text-[10px] font-bold uppercase tracking-widest block mb-2">// CAMADA DE INFORMAÇÃO</label>
            <select id="map-metric" value={metric} onChange={e=>{
                const next=e.target.value as VisibleMedida;
                setMetric(next);
                const found=[...(data?.anos??[])].reverse().find(y=>
                  states.filter(s=>valorIndicador(s,y,next)!==null).length>=20);
                if(found!==undefined)setYear(found);
              }}
              className="w-full bg-punk-acid border-3 border-ink font-heavy text-lg sm:text-2xl px-3 py-2 text-ink">
              {metricas.map(m=><option key={m} value={m}>{LABELS[m].titulo}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="map-year" className="font-mono text-[10px] font-bold uppercase tracking-widest block mb-2">// ANO DE REFERÊNCIA</label>
            <select id="map-year" value={year} onChange={e=>setYear(Number(e.target.value))}
              className="bg-white border-3 border-ink font-heavy text-xl px-5 py-2 w-full lg:w-auto">
              {(yearsAvailable.length?yearsAvailable:data.anos).map(a=><option value={a} key={a}>{a}</option>)}
            </select>
          </div>
          <div className="font-mono text-xs bg-ink text-paper px-4 py-3 border-l-4 border-punk-red max-w-xs">
            <strong className="text-punk-acid">{visible.length} / 27</strong> estados com valor neste ano.
            <br/><span className="text-paper/70">Cinza = não disponível, não significa zero.</span>
          </div>
        </div>
        <p className="mt-4 text-xs font-mono border-t-2 border-dashed border-ink/20 pt-3">{LABELS[metric].resumo}</p>
      </section>
      <section className="grid lg:grid-cols-[minmax(0,1.25fr)_minmax(300px,.75fr)] gap-5">
        <div className="ruido-map-frame bg-[#424943] border-4 border-ink shadow-[9px_9px_0_#101010] relative p-3 sm:p-5 text-paper">
          <div className="flex items-center justify-between font-mono text-[10px] text-punk-acid tracking-wider">
            <span>/// TERRITÓRIO NACIONAL</span>
          </div>
          <div className="ruido-map-canvas border border-dashed border-paper/20 mt-2 relative overflow-hidden"
            style={{backgroundImage:"radial-gradient(#747a73 1px,transparent 1px)",backgroundSize:"17px 17px"}}>
            <svg viewBox="0 0 720 710" role="group" aria-label="Mapa interativo das unidades federativas do Brasil" className="w-full h-auto max-h-[670px]">
              {states.map(s=><path key={s.uf} d={s.svgPath}
                fill={fill(s)}
                stroke={s.uf===uf?"#fff":"#111512"}
                strokeWidth={s.uf===uf?2.8:1.05}
                fillRule="evenodd"
                role="button" tabIndex={0}
                aria-label={s.nome+": "+representacao(valorIndicador(s,year,metric),metric)}
                aria-pressed={s.uf===uf}
                style={{cursor:"pointer",outline:"none",transition:"fill .18s,stroke-width .18s"}}
                onMouseEnter={()=>setHover(s.uf)} onMouseLeave={()=>setHover(null)}
                onFocus={()=>setHover(s.uf)} onBlur={()=>setHover(null)}
                onClick={()=>setUf(s.uf)}
                onKeyDown={e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();setUf(s.uf);}}}
              />)}
            </svg>
          </div>
          <div className="flex flex-wrap gap-4 justify-between items-center mt-4 font-mono text-[10px] uppercase">
            <div className="flex flex-wrap gap-2 items-center">
              <span>MENOR</span>{["#424b46","#657361","#949e57","#c4d74f","#d8f53e"].map(c=><span key={c} style={{background:c}} className="h-3 w-5 border border-white/20"/>)}
              <span>MAIOR</span>
            </div>
            <span className="text-paper/60">ESCALA RELATIVA AO MAIOR VALOR • UF VERMELHA = SELECIONADA</span>
          </div>
        </div>
        <div className="flex flex-col gap-5">
          <div className="ruido-paper-card bg-paper-card border-4 border-ink shadow-[8px_8px_0_#e42232] p-6 relative">
            <div className="absolute -top-3 right-5 bg-punk-acid border-2 border-ink px-3 py-1 rotate-3 font-mono font-bold text-[10px]">UF / DOSSIÊ</div>
            <div className="font-mono text-xs border-b-2 border-dashed border-ink pb-2">// SELECIONADO NO MAPA</div>
            <div className="flex justify-between items-center gap-3 mt-5">
              <h2 className="font-heavy text-2xl sm:text-3xl">{chosen?.nome??"—"}</h2>
              <span className="font-heavy bg-ink text-punk-acid text-3xl px-3 py-1 border-2 border-punk-red -rotate-3">{chosen?.uf??"BR"}</span>
            </div>
            <p className="text-[10px] font-mono text-ink/65 mt-4">VALOR EM DESTAQUE • {LABELS[metric].unidade} • {year}</p>
            <div className="font-heavy text-3xl sm:text-4xl text-punk-red break-words">
              {chosen?representacao(valorIndicador(chosen,year,metric),metric):"N/D"}
            </div>
            <div className="mt-4 border-2 border-ink p-3 bg-white font-mono text-xs">
              <div className="text-ink/65">EVOLUÇÃO EM RELAÇÃO A {year-1}</div>
              <div className={`font-heavy text-2xl ${delta!==null&&delta>0?"text-green-700":delta!==null&&delta<0?"text-punk-red":"text-ink"}`}>
                {representacao(delta,"idhmVariacao")}
              </div>
              <div className="text-[10px] text-ink/60">
                {idhmPrev!==null?`IDHM de ${year-1}: ${representacao(idhmPrev,"idhm")}`:"Ano anterior não disponível"}
              </div>
            </div>
            <div className="mt-5 grid grid-cols-2 gap-3 font-mono text-[11px]">
              <div className="border-2 border-ink/30 p-2">
                <span className="text-ink/60 block">IDHM ({year})</span>
                <b>{representacao(idhmCurrent,"idhm")}</b>
              </div>
              <div className="border-2 border-ink/30 p-2">
                <span className="text-ink/60 block">EMENDAS PAGAS ({year})</span>
                <b>{chosen?representacao(valorIndicador(chosen,year,"emendasPagas"),"emendasPagas"):"N/D"}</b>
              </div>
              <div className="border-2 border-ink/30 p-2 col-span-2">
                <span className="text-ink/60 block">CRÉDITO MEI • BCB</span>
                <b>{chosen&&valorIndicador(chosen,year,"creditoMei")!==null?brl(valorIndicador(chosen,year,"creditoMei")!,true):"N/D"}</b>
                <span className="block text-ink/60">{chosen?.creditoMeiPorAno?.[String(year)]?"Referência: "+chosen.creditoMeiPorAno[String(year)].data:"Sem observação estadual neste ano"}</span>
              </div>
            </div>
          </div>
          <div className="bg-ink text-paper border-4 border-punk-red p-4 sm:p-5">
            <h3 className="font-heavy text-2xl text-punk-acid">LEITURA DOS DADOS //</h3>
            <p className="mt-3 font-mono text-xs leading-relaxed text-paper/80">
              IDHM mede educação, renda e longevidade. A variação anual é calculada em pontos
              do índice e não estima a influência de políticas ou emendas específicas.
              Emendas representam apenas despesas públicas identificadas na CGU.
            </p>
            <p className="mt-3 border-t border-paper/30 pt-3 font-mono text-[10px] text-paper/60">
              Comparar indicadores não demonstra que uma emenda causou crescimento econômico.
            </p>
          </div>
        </div>
      </section>

      <section className="bg-ink text-paper border-4 border-punk-red p-4 sm:p-6 space-y-3">
        <h2 className="font-heavy text-2xl text-punk-acid">COMPARAR TERRITÓRIOS //</h2>
        <p className="font-mono text-xs text-paper/80">Compare o mesmo indicador e ano entre duas UFs; N/D significa ausência de observação.</p>
        <select value={compararCom} onChange={e=>setCompararCom(e.target.value)} aria-label="Selecionar outra UF" className="bg-white text-ink border-2 border-punk-acid p-2 font-mono">
          {states.map(s=><option key={s.uf} value={s.uf}>{s.nome}</option>)}
        </select>
        <div className="grid grid-cols-2 gap-3 font-mono text-sm">
          {[active,states.find(s=>s.uf===compararCom)].filter((x):x is EstadoMapa=>Boolean(x)).map(s=><div key={s.uf} className="border-2 border-paper/40 p-3"><strong className="text-punk-acid">{s.nome}</strong><p className="font-heavy text-xl mt-2 break-words">{representacao(valorIndicador(s,year,metric),metric)}</p></div>)}
        </div>
        <a href="/eleicoes/" className="inline-block text-punk-acid underline font-mono text-sm">ACOMPANHAR APURAÇÃO ELEITORAL DE 25/10/2026 →</a>
      </section>
      <AtlasTerritorialView uf={uf} />
      <section className="grid lg:grid-cols-2 gap-6">
        <div className="bg-white border-4 border-ink shadow-[8px_8px_0_#101010] p-5">
          <h2 className="font-heavy text-2xl sm:text-3xl uppercase border-b-4 border-ink pb-3">CLASSIFICAÇÃO <span className="text-punk-red">/// {year}</span></h2>
          <p className="font-mono text-[11px] mt-2 mb-5 text-ink/70">Maior valor de {LABELS[metric].titulo.toLowerCase()} entre os estados com informação disponível.</p>
          {!ordered.length?<p className="font-mono text-sm">Sem observações publicadas para este recorte.</p>:
          <ol className="space-y-2">{ordered.map((entry,i)=><li key={entry.state.uf}>
            <button type="button" onClick={()=>{setUf(entry.state.uf);setHover(null)}} className="w-full text-left group">
              <div className="flex justify-between items-center text-xs font-mono gap-3">
                <span><strong className="bg-ink text-paper px-2 py-1 mr-2">{String(i+1).padStart(2,"0")}</strong>{entry.state.nome}</span>
                <b className="whitespace-nowrap group-hover:text-punk-red">{representacao(entry.value,metric)}</b>
              </div>
              <div className="mt-2 h-2 bg-paper-card border border-ink/30">
                <div className="h-full bg-punk-red" style={{width:(maxAbsoluto>0?(100*Math.abs(entry.value)/maxAbsoluto):0)+"%",background:entry.value<0?"#555":"#e42232"}}/>
              </div>
            </button>
          </li>)}</ol>}
        </div>

        <div className="ruido-paper-card bg-paper-card border-4 border-ink shadow-[8px_8px_0_#101010] p-5">
          <h2 className="font-heavy text-2xl sm:text-3xl uppercase border-b-4 border-ink pb-3">
            EVOLUÇÃO <span className="text-punk-red">DO IDHM</span>
          </h2>
          <p className="font-mono text-[11px] mt-2 mb-4">
            {chosen?.nome??"UF selecionada"} • índice anual do PNUD/FJP/IBGE (valores de 0 a 1).
          </p>
          {!idhmTimeline.length?<p className="py-12 font-mono text-sm border-2 border-dashed border-ink/30 px-5">
            Nenhuma observação oficial do IDHM até {year} para esta UF.
          </p>:<div className="space-y-3">
            {idhmTimeline.map(item=><div key={item.ano} className="font-mono text-xs">
              <div className="flex justify-between gap-2 font-bold mb-1">
                <span>{item.ano}</span>
                <span>{representacao(item.valor,"idhm")}</span>
              </div>
              <div className="w-full bg-white border-2 border-ink/40 h-4">
                <div className="h-full bg-punk-red" style={{width:(item.valor*100)+"%"}}/>
              </div>
            </div>)}
            <p className="text-[11px] text-ink/70 pt-3 border-t border-dashed border-ink/40">
              A evolução mostra valores anuais publicados, sem projeções para 2025 ou 2026.
            </p>
          </div>}
        </div>
      </section>

      <footer className="bg-ink border-l-8 border-punk-red text-paper p-5 sm:p-7 font-mono text-xs space-y-3">
        <h2 className="text-punk-acid font-heavy text-2xl">// FONTES E CRITÉRIOS</h2>
        <p>IDHM: Radar IDHM 2012–2024 do PNUD/FJP/IBGE, com base na PNAD Contínua; nenhum IDHM de 2025/2026 foi estimado. A variação é uma diferença entre anos consecutivos, em pontos. Ausência de dados aparece como N/D. Crédito MEI é mostrado apenas no ano efetivamente observado pelo BCB.</p>
        <div className="flex flex-wrap gap-x-5 gap-y-2 text-punk-acid underline">
          <a href={data.fontes.idhm??"https://www.undp.org/pt/brazil/desenvolvimento-humano/painel-idhm"} target="_blank" rel="noopener noreferrer">PNUD/FJP/IBGE • IDHM</a>
          <a href={data.fontes.populacao} target="_blank" rel="noopener noreferrer">IBGE • População</a>
          <a href={data.fontes.creditoMei} target="_blank" rel="noopener noreferrer">BCB • Crédito MEI</a>
          <a href={data.fontes.emendas} target="_blank" rel="noopener noreferrer">CGU • Emendas</a>
        </div>
        {data.avisos.length>0&&<ul className="list-disc pl-5 text-paper/75">{data.avisos.map((item,i)=><li key={i}>{item}</li>)}</ul>}
      </footer>
    </>}
  </div>;
}
