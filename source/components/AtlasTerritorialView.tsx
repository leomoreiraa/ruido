"use client";

import React,{useEffect,useMemo,useState} from "react";
type Cidade={codigoIBGE:string;nome:string;uf:string;populacaoCenso2022:number|null};
type Emendas={quantidadeEmendas:number;totalPago:number;totalEmpenhado:number;porAno:Record<string,{pago:number;quantidade:number}>};
type Parlamentar={id:string;nome:string;partido:string;uf:string;casa:string;urlFoto:string|null};
type Atlas={versao:1;municipios:Cidade[];emendasMunicipais:Record<string,Emendas>;representacaoPorUf:Record<string,Parlamentar[]>;cobertura:{municipios:number;emendasComMunicipioIdentificado:number;emendasSemMunicipioIdentificado:number};fonteEducacao:string;fonteSaneamento:string;fonteMunicipios:string;fonteEmendas:string};
const reais=(v:number)=>new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL",maximumFractionDigits:2}).format(v);
const numerico=(v:number)=>new Intl.NumberFormat("pt-BR").format(v);
export function AtlasTerritorialView({uf}:{uf:string}){
 const [atlas,setAtlas]=useState<Atlas|null>(null);
 const [busca,setBusca]=useState("");
 const [municipio,setMunicipio]=useState("");
 const [ano,setAno]=useState("todos");
 useEffect(()=>{
  let live=true;
  fetch("/data/atlas-territorial.json").then(r=>{if(!r.ok)throw new Error("Atlas indisponível");return r.json();}).then((a:Atlas)=>{
   if(live&&a.versao===1&&Array.isArray(a.municipios))setAtlas(a);
  }).catch(()=>{});
  return ()=>{live=false;};
 },[]);
 useEffect(()=>{setBusca("");setMunicipio("");setAno("todos");},[uf]);
 const filtradas=useMemo(()=>atlas?.municipios.filter(c=>c.uf===uf && c.nome.toLocaleLowerCase("pt-BR").normalize("NFD").replace(/[\u0300-\u036f]/g,"").includes(busca.toLocaleLowerCase("pt-BR").normalize("NFD").replace(/[\u0300-\u036f]/g,""))).slice(0,150)??[],[atlas,uf,busca]);
 const cidade=atlas?.municipios.find(c=>c.codigoIBGE===municipio);
 const emenda=cidade?atlas?.emendasMunicipais[cidade.codigoIBGE]:undefined;
 const anos=emenda?Object.keys(emenda.porAno).sort().reverse():[];
 const rep=atlas?.representacaoPorUf[uf]??[];
 const emendasDoAno=ano==="todos"?{pago:emenda?.totalPago??0,quantidade:emenda?.quantidadeEmendas??0}:emenda?.porAno[ano];
 return <section className="ruido-paper-card bg-paper-card border-4 border-ink p-4 sm:p-6 shadow-[8px_8px_0_#101010] space-y-4">
  <div className="border-b-4 border-ink pb-3">
   <p className="font-mono text-xs font-bold tracking-widest">// ATLAS CIDADÃO / ESTADO E MUNICÍPIO</p>
   <h2 className="font-heavy text-3xl sm:text-4xl uppercase">RAIO X <span className="text-punk-red">TERRITORIAL</span></h2>
   <p className="font-mono text-xs mt-2">Municípios reconhecidos pelo IBGE, valores oficiais identificáveis de emendas e representação parlamentar da UF selecionada.</p>
  </div>
  {!atlas||!atlas.municipios.length?<div className="border-2 border-dashed border-ink/40 p-4 font-mono text-sm">Catálogo municipal ainda não disponível neste build. A coleta ocorre fora do navegador, no GitHub Actions, sem inventar dados.</div>:<>
   <div className="grid lg:grid-cols-2 gap-3">
    <div>
     <label htmlFor="atlas-busca" className="block font-mono font-bold text-xs mb-2">PESQUISAR CIDADE DE {uf}</label>
     <input id="atlas-busca" value={busca} onChange={e=>{setBusca(e.target.value);setMunicipio("");setAno("todos");}} className="border-2 border-ink bg-white w-full p-3 text-ink" placeholder="Digite o nome do município..." />
    </div>
    <div>
     <label htmlFor="atlas-municipio" className="block font-mono font-bold text-xs mb-2">SELECIONAR MUNICÍPIO</label>
     <select id="atlas-municipio" value={municipio} onChange={e=>{setMunicipio(e.target.value);setAno("todos");}} className="border-2 border-ink bg-white w-full p-3 text-ink">
      <option value="">SELECIONE UMA CIDADE</option>
      {filtradas.map(c=><option key={c.codigoIBGE} value={c.codigoIBGE}>{c.nome}</option>)}
     </select>
     {filtradas.length===150&&<p className="font-mono text-[10px] mt-1">Primeiros 150 resultados. Digite parte do nome para filtrar.</p>}
    </div>
   </div>
   {cidade&&<div className="border-2 border-ink bg-white p-4">
    <h3 className="font-heavy text-2xl uppercase">{cidade.nome} / {cidade.uf}</h3>
    <p className="font-mono text-[11px] text-ink/70">Código IBGE: {cidade.codigoIBGE} • População: Censo 2022</p>
    <div className="grid sm:grid-cols-3 gap-3 mt-4">
     <div className="border-2 border-ink p-3"><p className="font-mono text-xs">HABITANTES (2022)</p><strong className="font-heavy text-xl">{cidade.populacaoCenso2022===null?"N/D":numerico(cidade.populacaoCenso2022)}</strong></div>
     <div className="border-2 border-ink p-3"><p className="font-mono text-xs">EMENDAS IDENTIFICADAS</p><strong className="font-heavy text-xl">{emendasDoAno?numerico(emendasDoAno.quantidade):"N/D"}</strong></div>
     <div className="border-2 border-ink p-3"><p className="font-mono text-xs">EMENDAS PAGAS</p><strong className="font-heavy text-lg text-punk-red break-words">{emendasDoAno?reais(emendasDoAno.pago):"N/D"}</strong></div>
    </div>
    {!!anos.length&&<div className="mt-3"><label htmlFor="atlas-ano" className="font-mono text-xs">PERÍODO DAS EMENDAS </label><select id="atlas-ano" value={ano} onChange={e=>setAno(e.target.value)} className="border-2 border-ink ml-2 bg-white p-2"><option value="todos">Todos os anos coletados</option>{anos.map(a=><option key={a} value={a}>{a}</option>)}</select></div>}
    <p className="font-mono text-[11px] text-ink/65 mt-3">Valores somam somente emendas com correspondência municipal identificável. Falta de registro significa cobertura incompleta, nunca prova de ausência de transferências. A população de 2022 não é usada para calcular taxas de anos diferentes.</p>
    <a className="underline font-mono text-sm text-punk-red" href="/emendas/">CONSULTAR REGISTROS DE EMENDAS →</a>
   </div>}
  </>}
  <div className="border-t-2 border-dashed border-ink/30 pt-4">
   <h3 className="font-heavy text-2xl uppercase">QUEM REPRESENTA {uf}?</h3>
   <p className="font-mono text-[11px] mb-3">Parlamentares ativos da UF cadastrados no RUÍDO. Não são vereadores nem representantes municipais; deputados e senadores têm atuação no Congresso Nacional.</p>
   {!atlas?<p className="font-mono text-xs">Dados em preparação.</p>:
    rep.length===0?<p className="font-mono text-xs">Sem parlamentares ativos associados à UF no snapshot.</p>:
    <><div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
      {rep.slice(0,18).map(p=><a href={"/parlamentares/"+encodeURIComponent(p.id)+"/"} key={p.id} className="block bg-white border-2 border-ink p-3 hover:bg-punk-acid">
       <p className="font-heavy text-base">{p.nome}</p>
       <p className="font-mono text-xs">{p.partido} • {p.casa==="CAMARA"?"CÂMARA":"SENADO"}</p>
      </a>)}
    </div><p className="font-mono text-[11px] mt-2">Mostrando {Math.min(18,rep.length)} de {rep.length} representantes da UF no snapshot. Consulte todos em Políticos.</p></>}
  </div>
  <div className="grid md:grid-cols-2 gap-3 border-t-2 border-dashed border-ink/30 pt-4">
   <div className="border-2 border-ink p-3 bg-white"><strong className="font-heavy text-xl">EDUCAÇÃO / IDEB 2025</strong><p className="font-mono text-xs my-2">Fonte INEP, por município e rede de ensino. A série municipal será exibida somente após sua importação validada.</p><a href="https://www.gov.br/inep/pt-br/areas-de-atuacao/pesquisas-estatisticas-e-indicadores/ideb/resultados/2005-2025" target="_blank" rel="noreferrer" className="font-mono text-xs underline text-punk-red">CONSULTAR RESULTADOS OFICIAIS ↗</a></div>
   <div className="border-2 border-ink p-3 bg-white"><strong className="font-heavy text-xl">ÁGUA / ESGOTO / SINISA</strong><p className="font-mono text-xs my-2">Fonte Ministério das Cidades, dados de referência 2024. Sem indicador para cidades ainda não importadas e verificadas.</p><a href="https://www.gov.br/cidades/pt-br/acesso-a-informacao/acoes-e-programas/saneamento/sinisa/resultados-sinisa/resultados-sinisa-2025" target="_blank" rel="noreferrer" className="font-mono text-xs underline text-punk-red">PLANILHAS E METODOLOGIA OFICIAIS ↗</a></div>
  </div>
 </section>;
}
