"use client";

import React,{useEffect,useMemo,useState,useCallback} from "react";
import {MapaZoomArea} from "@/components/MapaZoomArea";
import {backendEleitoralConfigurado,INTERVALO_LIVE_MS,consultaAoVivoDisponivel} from "@/lib/eleicoesTseAoVivo";
import {buscarExteriorAoVivo,validarMalhaMundi,type ExteriorAoVivo,type MalhaMundi,type PaisExterior} from "@/lib/eleicoesExterior";

const formatoNumero=new Intl.NumberFormat("pt-BR");
const formatoPercentual=new Intl.NumberFormat("pt-BR",{maximumFractionDigits:2,minimumFractionDigits:2});
const vermelho="#e42232",verde="#43ba70",amarelo="#e2bf54",cinza="#a7b0ac";
function cor(p?:PaisExterior):string{
 if(!p||!p.localidadesComResultado||!p.votosValidos)return cinza;
 if(p.lula>p.flavio)return vermelho;
 if(p.flavio>p.lula)return verde;
 return amarelo;
}
function legenda(p?:PaisExterior):string{
 if(!p||!p.localidadesComResultado)return "Sem resultado validado neste país";
 if(p.lula===p.flavio)return "Empate entre os dois candidatos";
 return p.lula>p.flavio?"Lula tem mais votos contabilizados":"Flávio tem mais votos contabilizados";
}

export function MapaMundiApuracao(){
 const [malha,setMalha]=useState<MalhaMundi|null>(null);
 const [erroMalha,setErroMalha]=useState(false);
 const [dados,setDados]=useState<ExteriorAoVivo|null>(null);
 const [erroDados,setErroDados]=useState(false);
 const [selecionado,setSelecionado]=useState("");
 const [destacado,setDestacado]=useState("");

 useEffect(()=>{
  let ativo=true;
  const abort=new AbortController();
  void fetch("/data/eleicoes-mapa-mundi-malha.json",{signal:abort.signal,cache:"force-cache"})
   .then(async r=>{if(!r.ok)throw Error("Mapa indisponível");return validarMalhaMundi(await r.json());})
   .then(v=>{if(ativo)setMalha(v);})
   .catch(()=>{if(ativo&&!abort.signal.aborted)setErroMalha(true);});
  return ()=>{ativo=false;abort.abort();};
 },[]);

 useEffect(()=>{
  if(!backendEleitoralConfigurado())return;
  let ativo=true,rodando=false;
  const abort=new AbortController();
  async function atualizar(){
   if(!ativo||rodando||!consultaAoVivoDisponivel()||document.visibilityState==="hidden")return;
   rodando=true;
   try{
    const resultado=await buscarExteriorAoVivo(abort.signal);
    if(ativo){setDados(resultado);setErroDados(false);}
   }catch{if(ativo&&!abort.signal.aborted)setErroDados(true);}
   finally{rodando=false;}
  }
  void atualizar();
  const timer=setInterval(()=>void atualizar(),INTERVALO_LIVE_MS);
  const quandoVoltar=()=>{if(document.visibilityState==="visible")void atualizar();};
  document.addEventListener("visibilitychange",quandoVoltar);
  return ()=>{ativo=false;abort.abort();clearInterval(timer);document.removeEventListener("visibilitychange",quandoVoltar);};
 },[]);

 const porIso=useMemo(()=>new Map((dados?.paises??[]).map(p=>[p.iso,p])),[dados]);
 const opcoes=useMemo(()=>[...(dados?.paises??[])].sort((a,b)=>a.nome.localeCompare(b.nome,"pt-BR")),[dados]);
 const paisSelecionado=porIso.get(destacado)||porIso.get(selecionado);
 const nomeSelecionado=paisSelecionado?.nome??malha?.paises.find(p=>p.iso===selecionado)?.nome??
  malha?.marcadores.find(p=>p.iso===selecionado)?.nome??"Selecione um país";
 const somatorio=useMemo(()=>{
  const paises=dados?.paises??[];
  return paises.reduce((out,p)=>{
   out.lula+=p.lula;out.flavio+=p.flavio;out.validos+=p.votosValidos;
   if(p.localidadesComResultado)out.paises++;
   return out;
  },{lula:0,flavio:0,validos:0,paises:0});
 },[dados]);
 const aoMover=useCallback((event:React.PointerEvent<SVGSVGElement>)=>{
  if(event.pointerType!=="mouse"&&event.pointerType!=="pen")return;
  const iso=(event.target as Element).getAttribute("data-iso");
  setDestacado(atual=>atual===(iso??"")?atual:iso??"");
 },[]);
 const aoEscolher=useCallback((event:React.MouseEvent<SVGSVGElement>)=>{
  const iso=(event.target as Element).getAttribute("data-iso");
  if(iso)setSelecionado(iso);
 },[]);
 const aoTeclado=useCallback((event:React.KeyboardEvent<SVGSVGElement>)=>{
  if(event.key!=="Enter"&&event.key!==" ")return;
  const iso=(event.target as Element).getAttribute("data-iso");
  if(!iso)return;
  event.preventDefault();
  setSelecionado(iso);
 },[]);
 const atualizadoEm=dados?.atualizadoEm?new Date(dados.atualizadoEm):null;
 const desatualizado=atualizadoEm&&Date.now()-atualizadoEm.getTime()>20*60_000;
 const comVotos=!!dados?.localidadesComResultado;

 return <section className="ruido-paper-card border-4 border-ink bg-paper-card p-4 sm:p-6 shadow-[6px_6px_0_#e42232]"
  aria-labelledby="eleicoes-exterior-titulo">
  <header className="border-b-2 border-dashed border-ink/35 pb-4">
   <p className="font-mono text-xs font-bold text-punk-red">RUÍDO // O BRASIL VOTA NO MUNDO</p>
   <h2 id="eleicoes-exterior-titulo" className="font-heavy text-2xl sm:text-4xl uppercase text-ink">MAPA-MÚNDI DA APURAÇÃO //</h2>
   <p className="font-mono text-xs sm:text-sm mt-2 text-ink/80">
    2º turno presidencial · votação de brasileiras e brasileiros no exterior. Países coloridos representam exclusivamente votos oficiais já recebidos para Lula (13) e Flávio (22).
   </p>
  </header>

  <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-5 mb-4">
   <div className="border-2 border-ink bg-white p-3">
    <p className="font-mono text-[11px] font-bold">LOCALIDADES COM RESULTADO</p>
    <strong className="block mt-1 font-heavy text-2xl text-ink">{dados?formatoNumero.format(dados.localidadesComResultado):"—"} <span className="text-sm">/ 186</span></strong>
   </div>
   <div className="border-2 border-ink bg-white p-3">
    <p className="font-mono text-[11px] font-bold">PAÍSES COM PARCIAIS</p>
    <strong className="block mt-1 font-heavy text-2xl text-ink">{dados?formatoNumero.format(somatorio.paises):"—"}</strong>
   </div>
   <div className="border-2 border-ink bg-white p-3">
    <p className="font-mono text-[11px] font-bold">LULA (13) · EXTERIOR</p>
    <strong className="block mt-1 font-heavy text-2xl text-[#bc1c2a]">{comVotos?formatoNumero.format(somatorio.lula):"—"}</strong>
   </div>
   <div className="border-2 border-ink bg-white p-3">
    <p className="font-mono text-[11px] font-bold">FLÁVIO (22) · EXTERIOR</p>
    <strong className="block mt-1 font-heavy text-2xl text-[#226940]">{comVotos?formatoNumero.format(somatorio.flavio):"—"}</strong>
   </div>
  </div>

  <div className="flex flex-wrap items-center gap-3 font-mono text-xs font-bold my-3 text-ink">
   <span className="flex items-center gap-2"><i className="h-3 w-3 inline-block" style={{background:vermelho}}/> Lula à frente</span>
   <span className="flex items-center gap-2"><i className="h-3 w-3 inline-block" style={{background:verde}}/> Flávio à frente</span>
   <span className="flex items-center gap-2"><i className="h-3 w-3 inline-block" style={{background:amarelo}}/> Empate</span>
   <span className="flex items-center gap-2"><i className="h-3 w-3 inline-block" style={{background:cinza}}/> Sem resultado validado</span>
  </div>

  <div className="min-w-0 border-2 border-ink bg-[#d9ded9]">
   {malha?<MapaZoomArea rotulo="Mapa-múndi eleitoral com votos no exterior" className="ruido-eleicoes-mapa-mundi">
    <svg viewBox={malha.viewBox} role="group"
     aria-label="Mapa-múndi eleitoral. Selecione um país para consultar os votos oficiais contabilizados no exterior."
     className="block h-auto w-full"
     onPointerMove={aoMover} onPointerLeave={()=>setDestacado("")}
     onClick={aoEscolher} onKeyDown={aoTeclado}
     style={{touchAction:"none"}}>
     <rect width="900" height="450" fill="#d9ded9"/>
     {malha.paises.map(p=>{
      const info=porIso.get(p.iso),ativo=(selecionado===p.iso||destacado===p.iso);
      return <path key={p.iso} data-iso={p.iso} d={p.d} fill={cor(info)}
       fillRule="evenodd" stroke={ativo?"#111111":"#222d29"} strokeWidth={ativo?1.55:.35}
       strokeOpacity={ativo?1:.68} vectorEffect="non-scaling-stroke"
       role="button" tabIndex={0} aria-pressed={selecionado===p.iso}
       aria-label={p.nome+": "+legenda(info)}
       style={{cursor:"pointer"}}/>;
     })}
     {malha.marcadores.map(p=>{
      const info=porIso.get(p.iso),ativo=selecionado===p.iso||destacado===p.iso;
      return <circle key={p.iso} data-iso={p.iso} cx={p.x} cy={p.y} r={ativo?5:3.5}
       fill={cor(info)} stroke="#111111" strokeWidth={ativo?2:1.1}
       vectorEffect="non-scaling-stroke" role="button" tabIndex={0}
       aria-label={p.nome+": "+legenda(info)} aria-pressed={selecionado===p.iso}
       style={{cursor:"pointer"}}/>;
     })}
    </svg>
   </MapaZoomArea>:<div className="flex min-h-48 items-center justify-center p-5 font-mono text-center text-sm text-ink">
    {erroMalha?"Não foi possível carregar o mapa-múndi. A tabela de países permanece disponível.":"Carregando mapa-múndi..."}
   </div>}
  </div>

  <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] mt-4">
   <div className="border-2 border-ink bg-white p-4">
    <label htmlFor="eleicoes-pais-exterior" className="font-mono font-bold text-xs text-ink">ESCOLHA UM PAÍS OU TOQUE NO MAPA</label>
    <select id="eleicoes-pais-exterior" value={selecionado} onChange={e=>{setSelecionado(e.target.value);setDestacado("");}}
     className="mt-2 w-full max-w-full border-2 border-ink bg-paper-card p-2 font-mono text-sm text-ink">
     <option value="">Selecione um país / território</option>
     {opcoes.map(p=><option key={p.iso} value={p.iso}>{p.nome} · {p.localidadesComResultado?p.lula+p.flavio+" votos dos dois candidatos":"sem resultado"}</option>)}
    </select>
    <p className="mt-3 font-mono text-xs text-ink/80">
     {comVotos?"O mapa reúne os dados de cada localidade eleitoral do exterior consultada pelo RUÍDO.":"As cores serão atualizadas conforme as localidades do exterior tiverem resultados oficiais disponíveis."}
    </p>
    <p className="mt-2 font-mono text-xs text-ink/80">
     {atualizadoEm?"Última coleta validada: "+atualizadoEm.toLocaleString("pt-BR",{timeZone:"America/Sao_Paulo"}):
      consultaAoVivoDisponivel()?"Aguardando dados oficiais para o exterior.":"Resultados do segundo turno disponibilizados após o início da apuração."}
     {desatualizado?" Dados podem estar desatualizados.":""}
     {erroDados?" Atualização temporariamente indisponível.":""}
    </p>
   </div>
   <div className="border-2 border-ink bg-white p-4" aria-live="polite">
    <h3 className="font-heavy text-xl sm:text-2xl text-ink uppercase">{nomeSelecionado}</h3>
    <p className="font-mono text-xs text-ink/75 mt-1">{legenda(paisSelecionado)}</p>
    {paisSelecionado?.localidadesComResultado?<div className="grid grid-cols-2 gap-3 mt-3">
     {[{numero:"13",rotulo:"LULA",votos:paisSelecionado.lula,cor:vermelho},
       {numero:"22",rotulo:"FLÁVIO",votos:paisSelecionado.flavio,cor:verde}].map(c=>{
       const valor=paisSelecionado.votosValidos?100*c.votos/paisSelecionado.votosValidos:0;
       return <div key={c.numero} className="min-w-0 border border-ink/25 bg-paper-card p-3">
        <p className="font-mono text-xs font-bold text-ink">{c.rotulo} ({c.numero})</p>
        <strong className="font-heavy text-xl text-ink">{formatoNumero.format(c.votos)}</strong>
        <p className="font-mono text-xs text-ink">{formatoPercentual.format(valor)}% dos votos válidos coletados</p>
        <div className="mt-2 h-2 bg-gray-200 border border-ink/40">
         <div className="h-full" style={{width:Math.min(100,valor)+"%",backgroundColor:c.cor}}/>
        </div>
       </div>;
      })}
     <p className="col-span-2 font-mono text-xs text-ink/80">
      Localidades com resultado: <strong>{paisSelecionado.localidadesComResultado}/{paisSelecionado.localidadesPrevistas}</strong>.
      Seções totalizadas nos locais consultados: <strong>{formatoNumero.format(paisSelecionado.secoesTotalizadas)} / {formatoNumero.format(paisSelecionado.secoesPrevistasConhecidas)}</strong>.
      {paisSelecionado.localidadesComResultado<paisSelecionado.localidadesPrevistas?" Apuração deste país ainda com cobertura parcial.":""}
     </p>
    </div>:<p className="font-mono text-xs mt-4 text-ink/80">
     Nenhum voto oficial disponível para este país até a última consulta. Isso não indica ausência de eleitores ou votação.
    </p>}
   </div>
  </div>

  {dados?.paises?.length?<details className="mt-4 border-2 border-ink bg-white">
   <summary className="cursor-pointer p-3 font-heavy text-base uppercase text-ink">CONSULTAR TODOS OS PAÍSES // {dados.paises.length} localidades geográficas agrupadas</summary>
   <div className="max-h-80 overflow-auto border-t border-ink p-2 sm:p-3">
    <table className="w-full text-left font-mono text-xs text-ink">
     <thead><tr><th className="p-2">País</th><th className="p-2 text-right">Lula</th><th className="p-2 text-right">Flávio</th><th className="p-2 text-right">Cidades</th></tr></thead>
     <tbody>{opcoes.map(p=><tr key={p.iso} className="border-t border-ink/20">
      <td className="p-2"><button type="button" onClick={()=>{setSelecionado(p.iso);setDestacado("");}} className="underline text-left">{p.nome}</button></td>
      <td className="p-2 text-right">{p.localidadesComResultado?formatoNumero.format(p.lula):"—"}</td>
      <td className="p-2 text-right">{p.localidadesComResultado?formatoNumero.format(p.flavio):"—"}</td>
      <td className="p-2 text-right">{p.localidadesComResultado}/{p.localidadesPrevistas}</td>
     </tr>)}</tbody>
    </table>
   </div>
  </details>:null}

  <p className="mt-4 font-mono text-[11px] text-ink/75 leading-relaxed">
   Fonte eleitoral: TSE, arquivos oficiais EA20 de localidades da Zona Eleitoral do Exterior (ZZ).
   As contagens nacionais do Brasil já incluem votos no exterior: não some os números deste mapa à apuração nacional.
   Valores por país são somatórios das localidades consultadas, eventualmente em instantes diferentes, e não substituem o total oficial ZZ.
   Limites geográficos: Natural Earth 110m (domínio público); países pequenos são representados por marcadores.
  </p>
  <a href="https://resultados.tse.jus.br/oficial/app/index.html" target="_blank" rel="noopener noreferrer" className="inline-block mt-3 font-mono text-xs font-bold underline text-ink">
   CONFERIR RESULTADOS NO TSE ↗
  </a>
 </section>;
}
