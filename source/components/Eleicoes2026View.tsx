"use client";

import React,{useCallback,useEffect,useMemo,useState} from "react";
import {MapaZoomArea} from "@/components/MapaZoomArea";
import {buscarResultadoTSE,consultaAoVivoDisponivel,urlResultadoAoVivo,INTERVALO_LIVE_MS} from "@/lib/eleicoesTseAoVivo";
import {MapaEleitoralMunicipalBrasil} from "@/components/MapaEleitoralMunicipalBrasil";

type Candidato={numero:string;nome:string;partido:string;votos:number;percentual:number|null};
type Resultado={situacao:"aguardando"|"parcial"|"concluida";apuradoEm:string|null;secoesTotalizadas:number;secoesPrevistas:number;percentualSecoes:number|null;votosValidos:number|null;votosTotais:number|null;brancos:number|null;nulos:number|null;candidatos:Candidato[]};
type Cidade={uf:string;codigoTSE:string;codigoIBGE:string;nome:string};
type Snapshot={versao:number;fonte:string;turno:number;coletadoEm:string;municipiosConsultados:number;municipiosPrevistos:number;falhasNaRodada:number;brasil:Resultado;estados:Record<string,Resultado|null>;municipios:Cidade[];resultadosMunicipais:Record<string,Resultado>};
type Estado={uf:string;nome:string;svgPath:string};
type MalhaMunicipal={versao:number;uf:string;viewBox:string;fonte:string;municipios:Array<{id:string;d:string}>};
const nf=new Intl.NumberFormat("pt-BR");
const pf=new Intl.NumberFormat("pt-BR",{minimumFractionDigits:2,maximumFractionDigits:2});
const pct=(n:number|null|undefined)=>n==null?"N/D":pf.format(n)+"%";
const SITE_TSE="https://resultados.tse.jus.br/oficial/app/index.html";
const filename=(turno:1|2)=>"/data/eleicoes-2026"+(turno===1?"-1":"")+".json";
const VERDE="#43ba70";
const VERMELHO="#e42232";
const EMPATE="#e2bf54";
const SEM_DADOS="#8d9290";

function votosComparados(rec:Resultado|null|undefined):"lula"|"flavio"|"empate"|"indisponivel"{
 if(!rec||rec.situacao==="aguardando"||!rec.votosValidos)return "indisponivel";
 const lula=rec.candidatos.find(c=>c.numero==="13");
 const flavio=rec.candidatos.find(c=>c.numero==="22");
 if(!lula||!flavio)return "indisponivel";
 return lula.votos>flavio.votos?"lula":flavio.votos>lula.votos?"flavio":"empate";
}
function cor(rec:Resultado|null|undefined){
 const resultado=votosComparados(rec);
 if(resultado==="empate")return EMPATE;
 if(resultado==="indisponivel")return SEM_DADOS;
 const lula=rec?.candidatos.find(c=>c.numero==="13")?.votos ?? 0;
 const flavio=rec?.candidatos.find(c=>c.numero==="22")?.votos ?? 0;
 const margem=rec?.votosValidos ? 100*Math.abs(lula-flavio)/rec.votosValidos : 0;
 if(resultado==="lula")return margem<5?"#f6c8c8":margem<15?"#f18b90":margem<30?"#eb555e":VERMELHO;
 return margem<5?"#c0e3cd":margem<15?"#90d1a6":margem<30?"#5cbe86":VERDE;
}
function titulos(rec:Resultado|null|undefined):string{
 const v=votosComparados(rec);
 return v==="lula"?"Lula recebeu mais votos que Flávio":v==="flavio"?"Flávio recebeu mais votos que Lula":v==="empate"?"Empate entre Lula e Flávio":"Sem resultado para comparação";
}

export function Eleicoes2026View({malhas}:{malhas:Estado[]}){
 const [turno,setTurno]=useState<1|2>(1);
 const [dadosPorTurno,setDadosPorTurno]=useState<Partial<Record<1|2,Snapshot>>>({});
 const [erroPorTurno,setErroPorTurno]=useState<Partial<Record<1|2,boolean>>>({});
 const [malhasUf,setMalhasUf]=useState<MalhaMunicipal|null>(null);
 const [erroMalha,setErroMalha]=useState(false);
 const [uf,setUf]=useState("BR");
 const [cidade,setCidade]=useState("");
 const [busca,setBusca]=useState("");
 const [filtroComparar,setFiltroComparar]=useState("SP");
 const [lidoEm,setLidoEm]=useState<string>("");
 const [dadosLive,setDadosLive]=useState<Record<string,{resultado:Resultado;consultadoEm:number}>>({});
 const [erroLive,setErroLive]=useState<string|null>(null);
 const [consultaLive,setConsultaLive]=useState(0);

 useEffect(()=>{
  let ativo=true;
  async function atualizar(){
   try{
    const url=filename(turno)+"?v="+Math.floor(Date.now()/60000);
    const response=await fetch(url,{cache:"no-store"});
    if(!response.ok)throw new Error("Arquivo ainda nao publicado");
    const next=await response.json() as Snapshot;
    if(next.versao!==1||next.turno!==turno||next.fonte!=="https://resultados.tse.jus.br/oficial"||!next.brasil||!Array.isArray(next.municipios))
     throw new Error("Arquivo eleitoral nao validado");
    if(ativo){setDadosPorTurno(old=>({...old,[turno]:next}));setErroPorTurno(old=>({...old,[turno]:false}));setLidoEm(new Date().toLocaleTimeString("pt-BR"));}
   }catch{if(ativo)setErroPorTurno(old=>({...old,[turno]:true}));}
  }
  void atualizar();
  const timer=setInterval(()=>void atualizar(),90000);
  return ()=>{ativo=false;clearInterval(timer);};
 },[turno]);

 useEffect(()=>{
  let ativo=true;
  if(uf==="BR"){setMalhasUf(null);setErroMalha(false);return;}
  setMalhasUf(null);setErroMalha(false);
  async function carregar(){
   try{
    const r=await fetch("/data/municipios-malhas/"+uf+".json");
    if(!r.ok)throw new Error("Sem malha municipal para UF");
    const raw=await r.json() as MalhaMunicipal;
    if(raw.versao!==1||raw.uf!==uf||!Array.isArray(raw.municipios)||raw.municipios.length<1)
     throw new Error("Malha municipal invalida");
    if(ativo)setMalhasUf(raw);
   }catch{if(ativo)setErroMalha(true);}
  }
  void carregar();
  return ()=>{ativo=false;};
 },[uf]);

 const dados=dadosPorTurno[turno];
 const catalogoMunicipios=dados?.municipios??dadosPorTurno[1]?.municipios??[];
 const mapaMunicipios=useMemo(()=>new Map(catalogoMunicipios.map(c=>[c.codigoIBGE,c])),[catalogoMunicipios]);
 const codigoTSE=cidade?mapaMunicipios.get(cidade)?.codigoTSE:undefined;
 const chaveLive=uf==="BR"?"BR":codigoTSE?uf+":"+codigoTSE:uf;
 const liveAtivo=turno===2&&consultaAoVivoDisponivel();
 const resultadoLive=liveAtivo?dadosLive[chaveLive]?.resultado:null;
 const consultadoEmLive=liveAtivo?dadosLive[chaveLive]?.consultadoEm:null;

 useEffect(()=>{
  if(turno!==2)return;
  let ativo=true;
  const abort=new AbortController();
  let rodando=false;
  let ultimaConsulta=0;
  async function atualizar(){
   if(!ativo||rodando||!consultaAoVivoDisponivel()||document.visibilityState==="hidden")return;
   if(Date.now()-ultimaConsulta<INTERVALO_LIVE_MS-1000)return;
   ultimaConsulta=Date.now();rodando=true;
   const alvos:[string,string][]=[["BR",urlResultadoAoVivo("BR")]];
   if(uf!=="BR"){
    if(cidade&&codigoTSE)alvos.push([uf+":"+codigoTSE,urlResultadoAoVivo(uf,codigoTSE)]);
    else if(!cidade)alvos.push([uf,urlResultadoAoVivo(uf)]);
   }
   const results=await Promise.allSettled(alvos.map(async ([chave,url])=>{
    const result=await buscarResultadoTSE(url,abort.signal);
    return {chave,resultado:result,consultadoEm:Date.now()};
   }));
   if(ativo){
    const aprovados=results.filter((x):x is PromiseFulfilledResult<{chave:string;resultado:Resultado;consultadoEm:number}>=>x.status==="fulfilled");
    if(aprovados.length){
     setDadosLive(anterior=>{
      const atualizado={...anterior};
      for(const r of aprovados)atualizado[r.value.chave]={resultado:r.value.resultado,consultadoEm:r.value.consultadoEm};
      return atualizado;
     });
     setConsultaLive(Date.now());
    }
    const problema=results.find(x=>x.status==="rejected");
    setErroLive(problema?"Consulta direta ao TSE indisponível neste navegador. Exibindo última observação válida quando houver.":null);
   }
   rodando=false;
  }
  void atualizar();
  const timer=setInterval(()=>void atualizar(),INTERVALO_LIVE_MS);
  const visibility=()=>{if(document.visibilityState==="visible")void atualizar();};
  document.addEventListener("visibilitychange",visibility);
  return ()=>{ativo=false;abort.abort();clearInterval(timer);document.removeEventListener("visibilitychange",visibility);};
 },[turno,uf,cidade,codigoTSE]);
 const selecionada=cidade?mapaMunicipios.get(cidade):undefined;
 const resultado:Resultado|null|undefined=resultadoLive??(uf==="BR"?dados?.brasil:cidade?dados?.resultadosMunicipais[cidade]??null:dados?.estados[uf]);
 const comparado=uf==="BR"?dados?.estados[filtroComparar]:dadosLive.BR?.resultado??dados?.brasil;
 const iniciado=!!resultado&&resultado.situacao!=="aguardando"&&resultado.votosValidos!==null;
 const municipios=useMemo(()=>{
  const q=busca.trim().toLocaleLowerCase("pt-BR").normalize("NFD").replace(/[\u0300-\u036f]/g,"");
  if(uf==="BR" && q.length<2)return [];
  return catalogoMunicipios.filter(c=>(uf==="BR"||c.uf===uf)&&(!q||c.nome.toLocaleLowerCase("pt-BR").normalize("NFD").replace(/[\u0300-\u036f]/g,"").includes(q))).slice(0,120);
 },[catalogoMunicipios,uf,busca]);
 const nomesUf=new Map(malhas.map(m=>[m.uf,m.nome]));
 const stats=useMemo(()=>{
  const cityCodes=new Set((malhasUf?.municipios??[]).map(m=>m.id));
  let vermelho=0,verde=0,empate=0,indisponivel=0;
  for(const code of cityCodes){
   const tipo=votosComparados(dados?.resultadosMunicipais[code]);
   if(tipo==="lula")vermelho++;else if(tipo==="flavio")verde++;else if(tipo==="empate")empate++;else indisponivel++;
  }
  return {vermelho,verde,empate,indisponivel};
 },[malhasUf,dados]);

 function selecionarEstado(next:string){setUf(next);setCidade("");setBusca("");}
 function selecionarMunicipio(codigo:string){setCidade(codigo);setBusca("");}
 const selecionarCidadeBrasil=useCallback((nextUf:string,codigoIBGE:string)=>{setUf(nextUf);setCidade(codigoIBGE);setBusca("");},[]);
 const legendas=[
  {nome:"Lula recebeu mais votos",cor:VERMELHO,escala:["#f6c8c8","#f18b90","#eb555e",VERMELHO]},
  {nome:"Flávio recebeu mais votos",cor:VERDE,escala:["#c0e3cd","#90d1a6","#5cbe86",VERDE]},
 ];

 return <div className="ruido-eleicoes-page collage-page pb-12 space-y-7">
  <header className="ruido-ink-poster border-4 border-ink bg-ink text-paper p-5 sm:p-8 shadow-[8px_8px_0_#e42232]">
   <p className="font-mono text-xs text-punk-acid tracking-widest">ARQUIVO ELEITORAL // FONTE: TRIBUNAL SUPERIOR ELEITORAL</p>
   <h1 className="font-heavy text-4xl sm:text-7xl mt-2">ELEIÇÕES <span className="text-punk-red">2026</span></h1>
   <p className="font-mono text-sm mt-4 max-w-3xl">Votos para Presidente no Brasil, nos estados e nos municípios. Alterne entre os resultados de 4 de outubro e a apuração de 25 de outubro.</p>
   <div className="flex flex-wrap gap-2 mt-5 font-mono text-xs">
    <span className="bg-punk-acid text-ink px-2 py-1 font-bold">{turno}º TURNO — {turno===1?"04/10/2026":"25/10/2026"}</span>
    <span className="border border-paper/50 px-2 py-1">{!dados?"SEM SNAPSHOT PUBLICADO":!iniciado?"AGUARDANDO RESULTADOS":resultado?.situacao==="concluida"?"TOTALIZAÇÃO CONCLUÍDA":"RESULTADOS PARCIAIS / NÃO FINALIZADOS"}</span>
    <span className="border border-paper/50 px-2 py-1">Consulta: {lidoEm||"—"}</span>
    {turno===2&&<span className="border border-punk-acid px-2 py-1 text-punk-acid">{!consultaAoVivoDisponivel()?"LIVE DISPONÍVEL APÓS 17H DE 25/10":consultadoEmLive?"TSE DIRETO • "+new Date(consultadoEmLive).toLocaleTimeString("pt-BR"):"TSE DIRETO • TENTANDO CONEXÃO"}</span>}
   </div>
  </header>

  <section className="ruido-paper-card bg-paper-card border-4 border-ink p-4 sm:p-6 shadow-[6px_6px_0_#101010]">
   <h2 className="font-heavy text-2xl uppercase mb-3">SELECIONE O TURNO //</h2>
   <div className="grid grid-cols-2 gap-3 max-w-2xl">
    {([1,2] as const).map(t=><button key={t} type="button" aria-pressed={turno===t} onClick={()=>setTurno(t)} className={"border-3 border-ink px-3 py-3 font-heavy text-lg sm:text-2xl "+(turno===t?"bg-punk-red text-white shadow-[4px_4px_0_#101010]":"bg-white text-ink")}>
     {t}º TURNO <span className="block font-mono text-xs mt-1">{t===1?"04 OUT 2026":"25 OUT 2026"}</span>
    </button>)}
   </div>
   <p className="font-mono text-xs mt-4 text-ink/70">As porcentagens são calculadas sobre votos válidos. A cor compara somente Lula (13) e Flávio (22), e a intensidade indica a margem entre eles; no 1º turno, outros candidatos também disputaram a eleição.</p>
  </section>

  <section className="ruido-map-zine ruido-map-zine--electoral">
   <span className="ruido-map-zine__tape" aria-hidden="true" />
   <span className="ruido-map-zine__corner" aria-hidden="true">✕</span>
   <div className="ruido-map-zine__masthead">
    <span className="ruido-map-zine__eyebrow">RUÍDO // ATLAS ELEITORAL</span>
    <span className="ruido-map-zine__serial">ARQUIVO 2026 / TURNO {String(turno).padStart(2,"0")}</span>
   </div>
   <div className="ruido-map-zine__titlebar">
    <div className="min-w-0">
     <div className="ruido-map-zine__micro">VOTOS POR MUNICÍPIO · FONTE TSE</div>
     <h2 className="ruido-map-zine__headline">MAPA DE VOTOS <em>// {uf==="BR"?"BRASIL":nomesUf.get(uf)}</em></h2>
    </div>
    {uf!=="BR"?<button type="button" onClick={()=>selecionarEstado("BR")} className="ruido-map-zine__back">← VOLTAR AO BRASIL</button>:<span className="ruido-map-zine__stamp" aria-hidden="true">MAPA<br />NACIONAL<br />///</span>}
   </div>
   <aside className="ruido-map-zine__guide" aria-label="Legenda do mapa de votos">
    <div className="ruido-map-zine__guide-head">
     <div><span className="ruido-map-zine__guide-kicker">LEGENDA / GUIA DE LEITURA</span><h3>O QUE CADA COR SIGNIFICA?</h3></div>
     <span className="ruido-map-zine__guide-seal">TSE<br/>2026</span>
    </div>
    <div className="ruido-map-zine__guide-grid">
     {legendas.map(l=><div className="ruido-map-zine__guide-party" key={l.nome}>
      <div className="ruido-map-zine__guide-party-name"><span className="ruido-map-zine__guide-dot" style={{backgroundColor:l.cor}}/>{l.nome}</div>
      <div className="ruido-map-zine__guide-swatches" aria-hidden="true">{l.escala.map((color,i)=><span key={i} style={{backgroundColor:color}} />)}</div>
     </div>)}
     <div className="ruido-map-zine__guide-special">
      <span><i style={{backgroundColor:EMPATE}}/> Empate entre os dois</span>
      <span><i style={{backgroundColor:SEM_DADOS}}/> Sem resultado disponível</span>
     </div>
    </div>
    <div className="ruido-map-zine__guide-scale">
     <strong>INTENSIDADE DA COR = DIFERENÇA DE VOTOS</strong>
     <div className="ruido-map-zine__guide-range"><span>Menos de 5 p.p.</span><span>5 a menos de 15 p.p.</span><span>15 a menos de 30 p.p.</span><span>30 p.p. ou mais</span></div>
     <p>Em cada município, comparamos somente os votos de Lula e Flávio. O tom representa a diferença entre seus percentuais de votos válidos. No 1º turno, outros candidatos também participaram.</p>
     {turno===2&&<p><strong>APURAÇÃO AO VIVO:</strong> Brasil e território selecionado consultam diretamente o TSE a cada 30 segundos, se o navegador permitir. A coloração do mapa nacional completo representa o último snapshot municipal publicado, não atualização simultânea das 5.571 cidades.</p>}
     {turno===2&&erroLive&&<p role="status">{erroLive}</p>}
    </div>
   </aside>
   <div className={uf==="BR"?"space-y-4":"grid lg:grid-cols-[1.35fr_.65fr] gap-5"}>
    <div className="ruido-map-zine__window">
     <div className="ruido-map-zine__window-bar" aria-hidden="true"><span>LEITURA / {turno}º TURNO</span><span>ESTADO / MUNICÍPIO</span></div>
     <div className={uf==="BR"?"ruido-map-zine__canvas ruido-map-zine__canvas--national":"ruido-map-zine__canvas ruido-map-zine__canvas--state"}>
     {uf==="BR"?<MapaEleitoralMunicipalBrasil resultados={dados?.resultadosMunicipais} municipios={dados?.municipios} estados={malhas} onSelectCidade={selecionarCidadeBrasil}/>:malhasUf?<div>
      <MapaZoomArea key={uf} rotulo={"Mapa dos municípios de "+nomesUf.get(uf)}>
      <svg viewBox={malhasUf.viewBox} className="w-full h-auto max-h-[580px]" aria-label={"Mapa municipal de "+nomesUf.get(uf)+" com comparativo de votos"} role="group">
       {malhasUf.municipios.map(m=>{
        const registro=dados?.resultadosMunicipais[m.id];
        const nome=mapaMunicipios.get(m.id)?.nome??m.id;
        const selecionado=cidade===m.id;
        return <path key={m.id} d={m.d} fill={cor(registro)} fillRule="evenodd" stroke={selecionado?"#101010":"#f5f1e8"} strokeOpacity={selecionado?1:.32} strokeWidth={selecionado?1.35:.23} style={{cursor:"pointer",outline:"none"}} role="button" tabIndex={0} aria-pressed={selecionado} aria-label={nome+": "+titulos(registro)} onClick={()=>selecionarMunicipio(m.id)} onKeyDown={e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();selecionarMunicipio(m.id);}}}/>;
       })}
      </svg>
      </MapaZoomArea>
      <p className="text-ink font-mono text-[11px] mt-2">Clique em uma cidade para consultar seus números. Malhas geográficas aproximadas, derivadas do IBGE, com possíveis diferenças históricas.</p>
     </div>:<div className="min-h-[280px] flex items-center justify-center text-ink font-mono text-sm p-6 text-center">
      {erroMalha?"A malha municipal desta UF não está disponível neste deploy. Use o seletor municipal para consultar os votos.":"Carregando os limites municipais..."}
     </div>}
     </div>
    </div>
    <div className={"ruido-map-zine__controls "+(uf==="BR"?"grid sm:grid-cols-2 gap-3 items-end":"space-y-3")}>
     <div><label htmlFor="eleicao-uf" className="block font-mono text-xs font-bold">BRASIL / ESTADO</label>
     <select id="eleicao-uf" value={uf} onChange={e=>selecionarEstado(e.target.value)} className="w-full bg-white border-2 border-ink p-3 font-heavy text-base text-ink">
      <option value="BR">BRASIL — TODAS AS UFs</option>
      {malhas.map(s=><option key={s.uf} value={s.uf}>{s.nome} ({s.uf})</option>)}
     </select></div>
     {uf==="BR"&&<div className="space-y-2"><label htmlFor="eleicao-busca-br" className="block font-mono text-xs font-bold">BUSCAR CIDADE NO BRASIL</label><input id="eleicao-busca-br" value={busca} onChange={e=>setBusca(e.target.value)} placeholder="Digite ao menos 2 letras" className="w-full bg-white border-2 border-ink p-3 text-ink"/>{municipios.length>0&&<select aria-label="Selecionar município do Brasil" value="" onChange={e=>{const c=mapaMunicipios.get(e.target.value);if(c)selecionarCidadeBrasil(c.uf,c.codigoIBGE);}} className="w-full border-2 border-ink bg-white p-2 text-ink"><option value="">Selecione uma cidade encontrada</option>{municipios.map(c=><option key={c.codigoIBGE} value={c.codigoIBGE}>{c.nome} / {c.uf}</option>)}</select>}</div>}
     {uf!=="BR"&&<>
      <label htmlFor="eleicao-busca" className="block font-mono text-xs font-bold">LOCALIZAR MUNICÍPIO</label>
      <input id="eleicao-busca" value={busca} onChange={e=>{setBusca(e.target.value);setCidade("");}} placeholder="Pesquisar por nome" className="w-full bg-white border-2 border-ink p-3 text-ink" />
      <label htmlFor="eleicao-cidade" className="block font-mono text-xs font-bold">CIDADE</label>
      <select id="eleicao-cidade" value={cidade} onChange={e=>setCidade(e.target.value)} className="w-full bg-white border-2 border-ink p-3 text-ink">
       <option value="">TOTAL DO ESTADO</option>
       {municipios.map(c=><option key={c.codigoIBGE} value={c.codigoIBGE}>{c.nome}</option>)}
       {cidade&&!municipios.some(m=>m.codigoIBGE===cidade)&&selecionada&&<option value={cidade}>{selecionada.nome}</option>}
      </select>
      {municipios.length===120&&<p className="font-mono text-[11px] text-ink/70">Exibindo 120 opções; digite o nome para localizar as demais.</p>}
      {malhasUf&&<div className="bg-white border-2 border-ink p-3 font-mono text-xs space-y-1">
       <strong className="block mb-2">MUNICÍPIOS NO MAPA: {nf.format(malhasUf.municipios.length)}</strong>
       <p><span style={{color:VERMELHO}}>■</span> Lula: {nf.format(stats.vermelho)}</p>
       <p><span style={{color:VERDE}}>■</span> Flávio: {nf.format(stats.verde)}</p>
       <p><span style={{color:EMPATE}}>■</span> Empates: {nf.format(stats.empate)}</p>
       <p><span style={{color:SEM_DADOS}}>■</span> Sem dados: {nf.format(stats.indisponivel)}</p>
       <p className="text-ink/65">Contagem apenas de cidades representadas na malha; não inclui localidades sem contorno correspondente.</p>
      </div>}
     </>}
     <a href={SITE_TSE} target="_blank" rel="noreferrer" className="inline-block underline font-mono text-sm font-bold">CONFERIR NO TSE ↗</a>
    </div>
   </div>
   <div className="ruido-map-zine__tagline" aria-hidden="true"><span>OBSERVE // COMPARE // INVESTIGUE</span><span>RUÍDO — INFORMAÇÃO É TERRITÓRIO</span></div>
  </section>

  <section className="bg-white border-4 border-ink p-4 sm:p-6 shadow-[6px_6px_0_#e42232]">
   <h2 className="font-heavy text-2xl sm:text-4xl uppercase">{selecionada?.nome??(uf==="BR"?"BRASIL":nomesUf.get(uf))} <span className="text-punk-red">/// RESULTADOS</span></h2>
   <p className="font-mono text-xs my-3">Presidência • {turno}º turno • {turno===1?"04/10/2026":"25/10/2026"} • Fonte TSE</p>
   {turno===2&&<p className="font-mono text-xs mb-3" role="status">{consultadoEmLive?"Última consulta direta ao TSE: "+new Date(consultadoEmLive).toLocaleTimeString("pt-BR")+". Atualização automática a cada 30 segundos, sem redeploy.":consultaAoVivoDisponivel()?"Aguardando consulta ao TSE; informações disponíveis podem ser do snapshot estático.":"A totalização começa a partir das 17h de Brasília."}</p>}
   {!dados&&!resultado?<p className="font-mono border-2 border-dashed border-ink/40 p-5">{erroPorTurno[turno]?"Os dados deste turno ainda não estão disponíveis no RUÍDO. Consulte o TSE.":"Carregando o snapshot oficial..."}</p>:
   !resultado?<p className="font-mono border-2 border-dashed border-ink/40 p-5">Não há resultados verificados para este recorte no snapshot. Não mostramos os resultados estaduais como se fossem municipais.</p>:
   <>
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 my-5">
     {[["SEÇÕES TOTALIZADAS",pct(resultado.percentualSecoes)],["SEÇÕES",nf.format(resultado.secoesTotalizadas)+" / "+nf.format(resultado.secoesPrevistas)],["VOTOS VÁLIDOS",iniciado?nf.format(resultado.votosValidos??0):"N/D"],["VOTOS TOTAIS",iniciado?nf.format(resultado.votosTotais??0):"N/D"]].map(([label,value])=><div key={label} className="bg-paper-card border-2 border-ink p-3"><p className="font-mono text-[10px]">{label}</p><p className="font-heavy text-xl sm:text-2xl mt-1 break-all">{value}</p></div>)}
    </div>
    <div className="h-3 border border-ink bg-gray-200"><div className="bg-punk-red h-full" style={{width:Math.min(100,Math.max(0,resultado.percentualSecoes??0))+"%"}}/></div>
    <p className="font-mono text-xs mt-3">Comparação Lula x Flávio: <strong>{titulos(resultado)}</strong>. Isso não determina o primeiro colocado entre todos os candidatos do 1º turno.</p>
    <div className="space-y-4 my-6">
     {resultado.candidatos.map(c=><div key={c.numero} className="border-b-2 border-dashed border-ink/20 pb-4">
      <div className="flex flex-wrap justify-between gap-2 items-baseline">
       <div><span className="font-heavy text-xl">{c.nome}</span> <span className="font-mono text-xs">#{c.numero} • {c.partido}</span></div>
       <strong className="font-heavy text-xl">{iniciado?pct(c.percentual):"N/D"}</strong>
      </div>
      <p className="font-mono text-xs my-2">{iniciado?nf.format(c.votos)+" votos contabilizados":"Apuração não iniciada"}</p>
      <div className="h-3 bg-paper-card border border-ink"><div className="h-full" style={{backgroundColor:c.numero==="13"?VERMELHO:c.numero==="22"?VERDE:"#6c726f",width:iniciado?Math.max(0,Math.min(100,c.percentual??0))+"%":"0%"}}/></div>
     </div>)}
    </div>
    <p className="font-mono text-xs">Brancos: {iniciado?nf.format(resultado.brancos??0):"N/D"} • Nulos: {iniciado?nf.format(resultado.nulos??0):"N/D"} • Arquivo TSE: {resultado.apuradoEm||"horário não informado"}.</p>
   </>}
  </section>

  <section className="ruido-paper-card bg-paper-card border-4 border-ink p-4 sm:p-6">
   <h2 className="font-heavy text-2xl">COMPARAÇÃO TERRITORIAL //</h2>
   {uf==="BR"&&<select value={filtroComparar} onChange={e=>setFiltroComparar(e.target.value)} aria-label="Estado para comparar" className="border-2 border-ink p-2 bg-white mt-3">{malhas.map(m=><option value={m.uf} key={m.uf}>{m.nome}</option>)}</select>}
   <div className="grid sm:grid-cols-2 gap-4 mt-4">
    {[{nome:selecionada?.nome??(uf==="BR"?"BRASIL":nomesUf.get(uf)),rec:resultado},{nome:uf==="BR"?filtroComparar:"BRASIL",rec:comparado}].map(({nome,rec},i)=><div key={i} className="bg-white border-2 border-ink p-3">
     <p className="font-heavy text-xl">{nome}</p>
     <p className="font-mono text-xs mb-2">Seções: {rec?pct(rec.percentualSecoes):"N/D"}</p>
     {rec?.candidatos.map(c=><p key={c.numero} className="font-mono text-xs my-1">{c.nome}: <strong>{rec.situacao!=="aguardando"?pct(c.percentual):"N/D"}</strong></p>)??<p className="font-mono text-xs">Sem dados disponíveis</p>}
    </div>)}
   </div>
  </section>

  <footer className="bg-ink text-paper p-5 border-l-8 border-punk-red font-mono text-xs space-y-2">
   <strong className="text-punk-acid">FONTE, CRITÉRIOS E LIMITAÇÕES</strong>
   <p>Resultados: arquivos EA12/EA20 do TSE. Votos dos candidatos divididos por votos válidos; não use o percentual de seções totalizadas como percentual de votos. As cores representam uma comparação específica entre Lula (13) e Flávio (22). Empates aparecem em amarelo; áreas indisponíveis em cinza.</p>
   <p>Malhas: Geodata BR, reprodução de contornos do IBGE sob CC0. Podem diferir das divisões atuais e algumas cidades podem não ter geometria; a ausência de dados nunca recebe cor de candidato. Resultado parcial está sujeito a mudanças.</p>
   <p>Snapshot do {turno}º turno: {dados?.coletadoEm?new Date(dados.coletadoEm).toLocaleString("pt-BR"):"não publicado"} • Municípios com observações: {dados?nf.format(dados.municipiosConsultados):"—"} de {dados?nf.format(dados.municipiosPrevistos):"—"} • Tentativas sem resposta nesta rodada: {dados?nf.format(dados.falhasNaRodada):"—"}.</p>
   <a className="underline text-punk-acid" href="https://www.tse.jus.br/eleicoes/informacoes-tecnicas-sobre-a-divulgacao-de-resultados" target="_blank" rel="noreferrer">DOCUMENTAÇÃO DO TSE ↗</a>
  </footer>
 </div>;
}
