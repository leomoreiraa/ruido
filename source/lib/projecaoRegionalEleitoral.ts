import {backendEleitoralConfigurado,RUIDO_ELECTION_API_ORIGIN} from "./eleicoesTseAoVivo";

export type EstimativaRegiao={
 regiao:string;
 parciais:number;
 ufs:number;
 secoesTotalizadas:number;
 secoesPrevistas:number;
 observados:number;
 estimados:number;
 lulaProjetados:number;
 flavioProjetados:number;
 percentualApurado:number;
 lulaPercentual:number|null;
};
export type EstimativaUf={
 uf:string;regiao:string;percentualApurado:number;
 votosContados:number;estimativaVotosValidos:number;
 estimativaLula:number;estimativaFlavio:number;
 proporcaoLulaEsperada:number;
};
export type EstimativaEleitoral={
 lula:number;flavio:number;votosValidos:number;
 lulaPercentual:number;flavioPercentual:number;
 faixaLula:[number,number];faixaFlavio:[number,number];
 votosJaContabilizados:number;votosLulaJaContabilizados:number;
 votosFlavioJaContabilizados:number;votosRestantesEstimados:number;
 tipoFaixa:"sensibilidade_nao_calibrada";
 macrorregioes:EstimativaRegiao[];
 estados:EstimativaUf[];
};
export type ProjecaoRegional={
 versao:1;metodo:"regressao-estratificada-uf-primeiro-turno-2026";
 estado:"insuficiente"|"projecao";
 motivo:string|null;
 observadoEm:number|null;
 atualizadoEm:number|null;
 coberturaPercentual:number;ufsComResultado:number;ufsComBase:number;
 regioesComAmostra:number;
 estimativa:EstimativaEleitoral|null;
 fontes:string[];
 aviso:string;
};
const int=(v:unknown)=>typeof v==="number"&&Number.isSafeInteger(v)&&v>=0;
const pct=(v:unknown)=>typeof v==="number"&&Number.isFinite(v)&&v>=0&&v<=100;
function intervalo(v:unknown):v is [number,number]{
 return Array.isArray(v)&&v.length===2&&pct(v[0])&&pct(v[1])&&v[0]<=v[1];
}
export function validarProjecaoRegional(raw:unknown):ProjecaoRegional{
 if(!raw||typeof raw!=="object")throw new Error("Resposta de projeção indisponível");
 const r=raw as Partial<ProjecaoRegional>;
 if(r.versao!==1||r.metodo!=="regressao-estratificada-uf-primeiro-turno-2026"||
  !["insuficiente","projecao"].includes(r.estado??"")||
  !pct(r.coberturaPercentual)||!int(r.ufsComResultado)||!int(r.ufsComBase)||
  !int(r.regioesComAmostra)||r.ufsComBase!>27||r.ufsComResultado!>27||
  r.regioesComAmostra!>5||
  (r.observadoEm!==null&&!int(r.observadoEm))||
  (r.atualizadoEm!==null&&!int(r.atualizadoEm))||
  !Array.isArray(r.fontes)||!r.fontes.includes("https://resultados.tse.jus.br/oficial/ele2026/6257")||
  !r.fontes.includes("https://resultados.tse.jus.br/oficial/ele2026/6258"))
  throw new Error("Metadados de projeção não verificáveis");
 if(r.estado==="insuficiente"){
  if(r.estimativa!==null||typeof r.motivo!=="string"||!r.motivo)
   throw new Error("Dados insuficientes inconsistentes");
  return r as ProjecaoRegional;
 }
 const e=r.estimativa;
 if(!e||r.motivo!==null||e.tipoFaixa!=="sensibilidade_nao_calibrada"||
  !pct(e.lulaPercentual)||!pct(e.flavioPercentual)||
  !intervalo(e.faixaLula)||!intervalo(e.faixaFlavio)||
  ![e.lula,e.flavio,e.votosValidos,e.votosJaContabilizados,
    e.votosLulaJaContabilizados,e.votosFlavioJaContabilizados,
    e.votosRestantesEstimados].every(int)||
  Math.abs(e.lulaPercentual+e.flavioPercentual-100)>.021||
  e.lula+e.flavio>e.votosValidos+2||
  e.votosLulaJaContabilizados+e.votosFlavioJaContabilizados>e.votosJaContabilizados||
  !Array.isArray(e.macrorregioes)||e.macrorregioes.length!==5||
  !Array.isArray(e.estados)||e.estados.length!==27)
  throw new Error("Estimativa regional inconsistente");
 const regioes=new Set<string>();
 for(const reg of e.macrorregioes){
  if(!reg||typeof reg.regiao!=="string"||regioes.has(reg.regiao)||
    !pct(reg.percentualApurado)||
    (reg.lulaPercentual!==null&&!pct(reg.lulaPercentual))||
    !int(reg.observados)||!int(reg.estimados)||!int(reg.secoesTotalizadas)||
    !int(reg.secoesPrevistas)||reg.secoesTotalizadas>reg.secoesPrevistas)
   throw new Error("Região não verificável");
  regioes.add(reg.regiao);
 }
 const ufs=new Set<string>();
 for(const estado of e.estados){
  if(!estado||typeof estado.uf!=="string"||!/^[A-Z]{2}$/.test(estado.uf)||
    ufs.has(estado.uf)||!regioes.has(estado.regiao)||
    !pct(estado.percentualApurado)||!pct(estado.proporcaoLulaEsperada)||
    !int(estado.votosContados)||!int(estado.estimativaVotosValidos)||
    !int(estado.estimativaLula)||!int(estado.estimativaFlavio))
   throw new Error("Estado não verificável");
  ufs.add(estado.uf);
 }
 return r as ProjecaoRegional;
}
export async function consultarProjecaoRegional(signal:AbortSignal):Promise<ProjecaoRegional>{
 if(!backendEleitoralConfigurado())throw new Error("API oficial indisponível");
 const response=await fetch(RUIDO_ELECTION_API_ORIGIN+"/v1/apuracao/2026/projecao",{
  method:"GET",cache:"no-store",mode:"cors",signal
 });
 if(!response.ok)throw new Error("Projeção temporariamente indisponível");
 return validarProjecaoRegional(await response.json());
}
