"use client";

import React, {useEffect, useMemo, useState} from "react";

type Candidato = { numero:string; nome:string; partido:string; votos:number; percentual:number|null };
type Resultado = { situacao:"aguardando"|"parcial"|"concluida"; apuradoEm:string|null; secoesTotalizadas:number; secoesPrevistas:number; percentualSecoes:number|null; votosValidos:number|null; votosTotais:number|null; brancos:number|null; nulos:number|null; candidatos:Candidato[] };
type Cidade = {uf:string;codigoTSE:string;codigoIBGE:string;nome:string};
type Snapshot = {versao:number;fonte:string;coletadoEm:string;municipiosConsultados:number;municipiosPrevistos:number;falhasNaRodada:number;brasil:Resultado;estados:Record<string,Resultado|null>;municipios:Cidade[];resultadosMunicipais:Record<string,Resultado>};
type Estado = {uf:string;nome:string;svgPath:string};
const nomes = new Intl.NumberFormat("pt-BR");
const porcento=(n:number|null)=>n===null?"N/D":new Intl.NumberFormat("pt-BR",{maximumFractionDigits:2,minimumFractionDigits:2}).format(n)+"%";
const dataTSE="https://resultados.tse.jus.br/oficial/app/index.html";
export function Eleicoes2026View({malhas}:{malhas:Estado[]}){
 const [dados,setDados]=useState<Snapshot|null>(null);
 const [erro,setErro]=useState(false);
 const [uf,setUf]=useState("BR");
 const [cidade,setCidade]=useState("");
 const [busca,setBusca]=useState("");
 const [filtroComparar,setFiltroComparar]=useState("SP");
 const [atualizado,setAtualizado]=useState("");
 useEffect(()=>{
  let active=true;
  async function carregar(){
   try {
    const response=await fetch("/data/eleicoes-2026.json?t="+Math.floor(Date.now()/60000),{cache:"no-store"});
    if(!response.ok)throw new Error("Snapshot indisponivel");
    const raw=await response.json() as Snapshot;
    if(raw.versao!==1||raw.fonte!=="https://resultados.tse.jus.br/oficial"||!raw.brasil||!Array.isArray(raw.municipios))throw new Error("Snapshot invalido");
    if(active){setDados(raw);setErro(false);setAtualizado(new Date().toLocaleTimeString("pt-BR"));}
   } catch {if(active)setErro(true);}
  }
  void carregar();
  const timer=setInterval(()=>{void carregar();},90000);
  return ()=>{active=false;clearInterval(timer);};
 },[]);
 const municipio = cidade && uf!=="BR"?dados?.resultadosMunicipais[cidade]:undefined;
 const resultado=uf==="BR"?dados?.brasil:municipio??dados?.estados[uf];
 const escolhido=dados?.municipios.find(m=>m.codigoIBGE===cidade);
 const cidades=useMemo(()=>{
  const q=busca.trim().toLocaleLowerCase("pt-BR").normalize("NFD").replace(/[\u0300-\u036f]/g,"");
  return (dados?.municipios??[]).filter(c=>c.uf===uf&&(!q||c.nome.toLocaleLowerCase("pt-BR").normalize("NFD").replace(/[\u0300-\u036f]/g,"").includes(q))).slice(0,120);
 },[dados,uf,busca]);
 const comparar=uf==="BR"?dados?.estados[filtroComparar]:dados?.brasil;
 const started=resultado?.situacao!=="aguardando" && (resultado?.votosTotais??0)>0;
 function selecionarEstado(next:string){setUf(next);setCidade("");setBusca("");}
 return <div className="collage-page pb-12 space-y-7">
  <header className="ruido-ink-poster border-4 border-ink bg-ink text-paper p-5 sm:p-8 shadow-[8px_8px_0_#e42232]">
   <p className="font-mono text-xs text-punk-acid tracking-widest">TRANSPARÊNCIA ELEITORAL // TSE // 2º TURNO</p>
   <h1 className="font-heavy text-4xl sm:text-7xl mt-2">APURAÇÃO <span className="text-punk-red">2026</span></h1>
   <p className="font-mono text-sm mt-4 max-w-3xl">Acompanhamento dos votos oficiais para a Presidência em 25 de outubro de 2026. Brasil, estados e municípios, com percentuais sobre votos válidos e totalização das seções.</p>
   <div className="flex flex-wrap gap-2 mt-5 font-mono text-xs">
    <span className="bg-punk-acid text-ink px-2 py-1 font-bold">{!started?"AGUARDANDO TOTALIZAÇÃO":resultado?.situacao==="concluida"?"TOTALIZAÇÃO CONCLUÍDA":"DADOS PARCIAIS"}</span>
    <span className="border border-paper/50 px-2 py-1">FONTE: TRIBUNAL SUPERIOR ELEITORAL</span>
    <span className="border border-paper/50 px-2 py-1">Atualizado no navegador: {atualizado||"—"}</span>
   </div>
  </header>
  <section className="ruido-paper-card bg-paper-card border-4 border-ink p-4 sm:p-6 shadow-[6px_6px_0_#101010]">
   <h2 className="font-heavy text-2xl mb-3">ESCOLHA SEU TERRITÓRIO</h2>
   <div className="grid lg:grid-cols-[1.25fr_.75fr] gap-5">
    <div className="bg-[#424943] border-2 border-ink p-2 sm:p-4">
     <svg viewBox="0 0 720 710" className="w-full h-auto max-h-[530px]" aria-label="Mapa do Brasil: selecione um estado">
      {malhas.map(s=><path key={s.uf} d={s.svgPath} fill={uf===s.uf?"#e42232":dados?.estados[s.uf]?.situacao==="concluida"?"#d8f53e":"#8c9c84"} stroke="#101010" strokeWidth="1.2" role="button" tabIndex={0} aria-label={s.nome} aria-pressed={uf===s.uf}
       onClick={()=>selecionarEstado(s.uf)} onKeyDown={e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();selecionarEstado(s.uf);}}} style={{cursor:"pointer"}} />)}
     </svg>
     <p className="text-paper font-mono text-[11px] mt-2">Selecione uma UF no mapa ou use o seletor ao lado. A cor informa apenas a seleção ou conclusão da totalização.</p>
    </div>
    <div className="space-y-3">
     <label htmlFor="eleicao-uf" className="block font-mono text-xs font-bold">BRASIL / ESTADO</label>
     <select id="eleicao-uf" value={uf} onChange={e=>selecionarEstado(e.target.value)} className="w-full bg-white border-2 border-ink p-3 font-heavy text-lg text-ink">
      <option value="BR">BRASIL (TOTAL NACIONAL)</option>
      {malhas.map(s=><option key={s.uf} value={s.uf}>{s.nome} ({s.uf})</option>)}
     </select>
     {uf!=="BR"&&<>
      <label htmlFor="eleicao-busca" className="block font-mono text-xs font-bold">PESQUISAR MUNICÍPIO</label>
      <input id="eleicao-busca" value={busca} onChange={e=>{setBusca(e.target.value);setCidade("");}} placeholder="Digite parte do nome" className="w-full bg-white border-2 border-ink p-3 text-ink" />
      <label htmlFor="eleicao-cidade" className="block font-mono text-xs font-bold">MUNICÍPIO</label>
      <select id="eleicao-cidade" value={cidade} onChange={e=>setCidade(e.target.value)} className="w-full bg-white border-2 border-ink p-3 text-ink">
       <option value="">TODOS OS MUNICÍPIOS DA UF</option>
       {cidades.map(c=><option key={c.codigoIBGE} value={c.codigoIBGE}>{c.nome}</option>)}
      </select>
      {cidades.length===120&&<p className="font-mono text-[11px]">Mostrando 120 municípios. Digite o nome para localizar os demais.</p>}
     </>}
     <a href={dataTSE} target="_blank" rel="noreferrer" className="inline-block underline font-mono text-sm font-bold">CONFERIR DIRETAMENTE NO TSE ↗</a>
    </div>
   </div>
  </section>
  <section className="bg-white border-4 border-ink p-4 sm:p-6 shadow-[6px_6px_0_#e42232]">
   <h2 className="font-heavy text-2xl sm:text-4xl uppercase">{escolhido?.nome??(uf==="BR"?"BRASIL":malhas.find(m=>m.uf===uf)?.nome)} <span className="text-punk-red">/// VOTOS</span></h2>
   <p className="font-mono text-xs my-3">Data da eleição: 25/10/2026 • Cargo: Presidente • 2º turno</p>
   {!dados?<p className="font-mono border-2 border-dashed border-ink/40 p-5">{erro?"O arquivo oficial ainda não foi publicado pelo RUÍDO. Consulte os resultados diretamente no TSE.":"Preparando consulta aos dados oficiais..."}</p>:
   !resultado?<p className="font-mono border-2 border-dashed border-ink/40 p-5">Sem observação oficial disponível para este recorte. Não interpretamos ausência como zero. {uf!=="BR"&&cidade?"O município pode ainda não ter sido consultado ou atualizado.":""}</p>:
   <>
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 my-5">
     {[["SEÇÕES TOTALIZADAS",porcento(resultado.percentualSecoes)],["SEÇÕES",nomes.format(resultado.secoesTotalizadas)+" / "+nomes.format(resultado.secoesPrevistas)],["VOTOS VÁLIDOS",started?nomes.format(resultado.votosValidos??0):"N/D"],["TOTAL DE VOTOS",started?nomes.format(resultado.votosTotais??0):"N/D"]].map(([label,value])=><div key={label} className="bg-paper-card border-2 border-ink p-3"><p className="font-mono text-[10px]">{label}</p><p className="font-heavy text-xl sm:text-2xl mt-1 break-all">{value}</p></div>)}
    </div>
    <div className="h-3 border border-ink bg-gray-200"><div className="bg-punk-red h-full" style={{width:Math.max(0,Math.min(100,resultado.percentualSecoes??0))+"%"}}/></div>
    <div className="space-y-4 my-6">
     {resultado.candidatos.map(c=><div key={c.numero} className="border-b-2 border-dashed border-ink/20 pb-4">
      <div className="flex flex-wrap justify-between gap-2 items-baseline">
       <div><span className="font-heavy text-xl">{c.nome}</span> <span className="font-mono text-xs">#{c.numero} • {c.partido}</span></div>
       <strong className="font-heavy text-xl text-punk-red">{started?porcento(c.percentual):"N/D"}</strong>
      </div>
      <p className="font-mono text-xs my-2">{started?nomes.format(c.votos)+" votos contabilizados":"Apuração ainda não iniciada"}</p>
      <div className="h-4 bg-paper-card border border-ink"><div className="h-full bg-[#e42232]" style={{width:started?(Math.max(0,Math.min(c.percentual??0,100))+"%"):"0%"}}/></div>
     </div>)}
    </div>
    <p className="font-mono text-xs">Brancos: {started?nomes.format(resultado.brancos??0):"N/D"} • Nulos: {started?nomes.format(resultado.nulos??0):"N/D"} • Atualização registrada pelo TSE: {resultado.apuradoEm||"não informada"}.</p>
   </>}
  </section>
  <section className="ruido-paper-card bg-paper-card border-4 border-ink p-4 sm:p-6">
   <h2 className="font-heavy text-2xl">COMPARAÇÃO TERRITORIAL //</h2>
   {uf==="BR"&&<select value={filtroComparar} onChange={e=>setFiltroComparar(e.target.value)} aria-label="Estado para comparar" className="border-2 border-ink p-2 bg-white mt-3">{malhas.map(m=><option value={m.uf} key={m.uf}>{m.nome}</option>)}</select>}
   <div className="grid sm:grid-cols-2 gap-4 mt-4">
    {[{nome:escolhido?.nome??(uf==="BR"?"BRASIL":uf),rec:resultado},{nome:uf==="BR"?filtroComparar:"BRASIL",rec:comparar}].map(({nome,rec})=><div key={nome} className="bg-white border-2 border-ink p-3">
     <p className="font-heavy text-xl">{nome}</p>
     <p className="font-mono text-xs mb-2">Seções: {rec?porcento(rec.percentualSecoes):"N/D"}</p>
     {rec?.candidatos.map(c=><p key={c.numero} className="font-mono text-xs my-1">{c.nome}: <strong>{rec.situacao!=="aguardando"?porcento(c.percentual):"N/D"}</strong></p>)??<p className="font-mono text-xs">Sem dados disponíveis</p>}
    </div>)}
   </div>
  </section>
  <footer className="bg-ink text-paper p-5 border-l-8 border-punk-red font-mono text-xs space-y-2">
   <strong className="text-punk-acid">METODOLOGIA E LIMITAÇÕES</strong>
   <p>Fonte primária: arquivos JSON EA12/EA20 de resultados do Tribunal Superior Eleitoral, exclusivamente ambiente oficial. Percentuais dos candidatos usam votos válidos como denominador. Progresso das seções é uma medida diferente do percentual de votos de cada candidato. Resultados parciais podem mudar.</p>
   <p>Atualização de arquivo RUÍDO: {dados?.coletadoEm?new Date(dados.coletadoEm).toLocaleString("pt-BR"):"não disponível"}. Municípios com dados: {dados?nomes.format(dados.municipiosConsultados):"—"} de {dados?nomes.format(dados.municipiosPrevistos):"—"}. Falhas de consulta preservam a última observação validada; dados históricos podem estar desatualizados.</p>
   <a className="underline text-punk-acid" href="https://www.tse.jus.br/eleicoes/informacoes-tecnicas-sobre-a-divulgacao-de-resultados" target="_blank" rel="noreferrer">Documentação técnica do TSE ↗</a>
  </footer>
 </div>;
}
