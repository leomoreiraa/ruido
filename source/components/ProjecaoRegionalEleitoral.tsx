"use client";

import React,{useEffect,useMemo,useState} from "react";
import {INTERVALO_LIVE_MS,backendEleitoralConfigurado} from "@/lib/eleicoesTseAoVivo";
import {
 consultarProjecaoRegional,
 type ProjecaoRegional,
 type EstimativaRegiao
} from "@/lib/projecaoRegionalEleitoral";

const numero=new Intl.NumberFormat("pt-BR");
const porcentagem=new Intl.NumberFormat("pt-BR",{minimumFractionDigits:2,maximumFractionDigits:2});
const vermelho="#e42232",verde="#348653";
const pct=(v:number)=>porcentagem.format(v)+"%";
const fmt=(v:number)=>numero.format(v);
const dataHora=(timestamp:number)=>new Date(timestamp).toLocaleString("pt-BR",{
 timeZone:"America/Sao_Paulo",day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"
});
const SIGLA_REGIAO:Record<string,string>={
 "Norte":"N","Nordeste":"NE","Centro-Oeste":"CO","Sudeste":"SE","Sul":"S"
};

function BarraRegional({regiao}:{regiao:EstimativaRegiao}){
 const lula=regiao.lulaPercentual;
 const cobertura=regiao.percentualApurado;
 return <div className="border border-ink/30 bg-paper-card p-3">
  <div className="flex items-center justify-between gap-2 font-mono text-xs">
   <strong className="text-ink">{regiao.regiao}</strong>
   <span className="text-ink">{lula===null?"N/D":pct(lula)+" Lula / "+pct(100-lula)+" Flávio"}</span>
  </div>
  <div className="mt-2 flex h-2.5 overflow-hidden border border-ink/50 bg-gray-200" aria-hidden="true">
   {lula!==null&&<>
    <div style={{width:lula+"%",backgroundColor:vermelho}}/>
    <div style={{width:(100-lula)+"%",backgroundColor:verde}}/>
   </>}
  </div>
  <p className="mt-2 font-mono text-[11px] text-ink/80">
   {pct(cobertura)} das seções totalizadas • {regiao.parciais} UFs com amostra
  </p>
 </div>;
}

export function ProjecaoRegionalEleitoral(){
 const [dados,setDados]=useState<ProjecaoRegional|null>(null);
 const [carregando,setCarregando]=useState(true);
 const [falhou,setFalhou]=useState(false);
 useEffect(()=>{
  if(!backendEleitoralConfigurado()){setCarregando(false);setFalhou(true);return;}
  let ativo=true;
  let ocupada=false;
  const controller=new AbortController();
  const atualizar=async()=>{
   if(!ativo||ocupada||document.visibilityState==="hidden")return;
   ocupada=true;
   try{
    const resposta=await consultarProjecaoRegional(controller.signal);
    if(ativo){setDados(resposta);setFalhou(false);}
   }catch{if(ativo&&!controller.signal.aborted)setFalhou(true);}
   finally{ocupada=false;if(ativo)setCarregando(false);}
  };
  void atualizar();
  const timer=setInterval(()=>void atualizar(),INTERVALO_LIVE_MS);
  const visibilidade=()=>{if(document.visibilityState==="visible")void atualizar();};
  document.addEventListener("visibilitychange",visibilidade);
  return ()=>{ativo=false;controller.abort();clearInterval(timer);
   document.removeEventListener("visibilitychange",visibilidade);};
 },[]);

 const e=dados?.estado==="projecao"?dados.estimativa:null;
 const regiao=useMemo(()=>e?.macrorregioes??[],[e]);
 const id="ruido-projecao-regional-2026";
 const projeçãoDesatualizada=!!dados?.observadoEm&&Date.now()-dados.observadoEm>12*60_000;
 const incompleta=!!dados?.atualizadoEm&&Date.now()-dados.atualizadoEm>12*60_000;

 return <section className="mt-5 border-2 border-ink bg-white p-3 sm:p-5"
   aria-labelledby={id}>
  <div className="flex flex-wrap items-start justify-between gap-3">
   <div>
    <p className="font-mono text-[11px] font-bold text-punk-red">MODELO ESTATÍSTICO // POR REGIÃO</p>
    <h3 id={id} className="font-heavy text-xl sm:text-2xl uppercase text-ink">
     Projeção nacional do 2º turno
    </h3>
   </div>
   <span className="border-2 border-ink px-2 py-1 font-mono text-[10px] font-bold text-ink">
    ESTIMATIVA · NÃO É RESULTADO OFICIAL
   </span>
  </div>
  <p className="mt-2 font-mono text-xs text-ink/80">
   Calculada usando os votos oficiais do 1º turno em cada UF e as parciais do 2º turno,
   com ajuste por estado, macrorregião, seções restantes e participação observada.
   A amostragem das seções não é aleatória.
  </p>

  {e&&!projeçãoDesatualizada&&!incompleta?<div className="mt-4 space-y-4">
   <div className="grid grid-cols-2 gap-3">
    {[{numero:"13",rotulo:"LULA",votos:e.lula,percentual:e.lulaPercentual,
       faixa:e.faixaLula,cor:vermelho},
      {numero:"22",rotulo:"FLÁVIO",votos:e.flavio,percentual:e.flavioPercentual,
       faixa:e.faixaFlavio,cor:verde}].map(c=>
     <div key={c.numero} className="min-w-0 border-2 border-ink bg-paper-card p-3">
      <p className="font-mono text-xs font-bold text-ink">{c.rotulo} ({c.numero})</p>
      <strong className="mt-1 block font-heavy text-2xl sm:text-4xl leading-none text-ink">
       {pct(c.percentual)}
      </strong>
      <div className="mt-2 h-3 border border-ink/40 bg-gray-200">
       <div className="h-full" style={{width:c.percentual+"%",backgroundColor:c.cor}}/>
      </div>
      <p className="mt-2 font-mono text-[11px] sm:text-xs text-ink">
       {fmt(c.votos)} votos estimados
      </p>
      <p className="mt-2 font-mono text-[11px] text-ink/80">
       Faixa de sensibilidade: <strong>{pct(c.faixa[0])} a {pct(c.faixa[1])}</strong>
      </p>
     </div>)}
   </div>

   <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
    <div className="border border-ink/30 p-3">
     <p className="font-mono text-[11px] font-bold text-ink">Seções apuradas</p>
     <strong className="font-heavy text-lg text-ink">{pct(dados!.coberturaPercentual)}</strong>
    </div>
    <div className="border border-ink/30 p-3">
     <p className="font-mono text-[11px] font-bold text-ink">Votos válidos restantes (estimativa)</p>
     <strong className="font-heavy text-lg text-ink">{fmt(e.votosRestantesEstimados)}</strong>
    </div>
    <div className="col-span-2 border border-ink/30 p-3 sm:col-span-1">
     <p className="font-mono text-[11px] font-bold text-ink">Cobertura territorial</p>
     <strong className="font-heavy text-lg text-ink">{dados!.ufsComResultado} UFs / {dados!.regioesComAmostra} regiões</strong>
    </div>
   </div>

   <details className="border border-ink/40 bg-white">
    <summary className="cursor-pointer px-3 py-3 font-heavy text-lg uppercase text-ink">
     Composição regional da estimativa
    </summary>
    <div className="grid grid-cols-1 gap-2 border-t border-ink/30 p-3 sm:grid-cols-2">
     {regiao.map(r=><BarraRegional key={r.regiao} regiao={r}/>)}
    </div>
    <div className="overflow-x-auto px-3 pb-3">
     <table className="w-full min-w-[450px] text-left font-mono text-xs text-ink">
      <thead><tr className="border-b border-ink/30">
       <th className="p-2">UF</th><th className="p-2">Região</th>
       <th className="p-2 text-right">Seções</th>
       <th className="p-2 text-right">Lula estimado</th>
       <th className="p-2 text-right">Flávio estimado</th>
      </tr></thead>
      <tbody>{e.estados.map(item=><tr key={item.uf} className="border-b border-ink/10">
       <td className="p-2 font-bold">{item.uf}</td>
       <td className="p-2">{SIGLA_REGIAO[item.regiao]??item.regiao}</td>
       <td className="p-2 text-right">{pct(item.percentualApurado)}</td>
       <td className="p-2 text-right">{fmt(item.estimativaLula)}</td>
       <td className="p-2 text-right">{fmt(item.estimativaFlavio)}</td>
      </tr>)}</tbody>
     </table>
    </div>
   </details>
  </div>:<div className="mt-4 border-l-4 border-ink bg-paper-card p-3 font-mono text-sm text-ink" role="status">
   <strong>{carregando?"Consultando as parciais oficiais…":
    projeçãoDesatualizada||incompleta?"Projeção indisponível: as parciais regionais precisam ser atualizadas.":
    dados?.motivo??"A projeção ainda não está disponível."}</strong>
   {dados&&<p className="mt-2 text-xs">
    Cobertura: {pct(dados.coberturaPercentual)} das seções,
    {dados.ufsComResultado} UFs e {dados.regioesComAmostra} macrorregiões com amostras.
    Os percentuais estimados aparecerão após uma cobertura territorial suficiente.
   </p>}
  </div>}

  <p className="mt-3 font-mono text-[11px] text-ink/70">
   {dados?.observadoEm?"Parciais consideradas: "+dataHora(dados.observadoEm)+". ":""}
   {falhou?"Atualização temporariamente indisponível. ":""}
   A faixa mostrada é uma <strong>análise de sensibilidade conservadora, não um intervalo de confiança estatístico calibrado</strong>.
   O modelo não estima probabilidade de vitória e não deve ser interpretado como resultado antecipado.
  </p>
 </section>;
}
