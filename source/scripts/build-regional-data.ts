/**
 * Build-time-only ETL for the choropleth.
 * No API requests are made from visitor browsers; GitHub Actions materializes JSON.
 * Sources: IBGE SIDRA 5938/37 (PIB, R$ thousands), 6579/9324 (population);
 * IBGE geographic meshes v3; BCB SGS credit stock for MEI; persisted CGU amendments.
 */
import fs from "node:fs/promises";
import path from "node:path";
import { prisma } from "../lib/prisma";
import { UFS, SERIES_MEI, lerSidra, extrairPoligonos, coordenadasParaSVG,
  numeroOficial, type DadosMapa, type EstadoMapa, type AnoUF } from "../lib/mapaBrasil";
import { validarCacheMalhasIBGE, IBGE_MALHAS_SOURCE } from "../lib/malhasBrasil";

const DEST=path.join(process.cwd(),"public","data","brasil-estados.json");
const anoAtual=new Date().getUTCFullYear();
const anos=Array.from({length:anoAtual-2011},(_,i)=>2012+i);
const anosMacroeconomicos=anos.filter(ano=>ano>=2022);
const UFSIGLAS=new Set<string>(UFS.map(([,uf])=>uf));

async function obterJSON(url:string, timeout=23000, retries=2):Promise<unknown> {
  let lastError:unknown;
  for(let n=0;n<=retries;n++){
    try{
      const resp=await fetch(url,{headers:{"Accept":"application/json","User-Agent":"RadarCongresso/1.0 (public open-data explorer)"},signal:AbortSignal.timeout(timeout),cache:"no-store"});
      if(!resp.ok)throw new Error("HTTP "+resp.status+" em "+url);
      return await resp.json();
    }catch(error){
      lastError=error;
      if(n<retries)await new Promise(r=>setTimeout(r,600*(n+1)));
    }
  }
  throw lastError;
}
async function pool<T>(entries:readonly T[],limit:number,action:(item:T)=>Promise<void>){
  let index=0;
  await Promise.all(Array.from({length:limit},async()=>{
    while(index<entries.length){const item=entries[index++];await action(item);}
  }));
}
function parseBCB(raw: unknown,serie: number) {
  const history: Record<string,{ data:string; milhoesReais:number; serie:number }>={};
  if(!Array.isArray(raw))return history;
  for(const row of raw) {
    if(!row||typeof row!=="object")continue;
    const obj=row as {data?:string;valor?:string};
    if(!obj.data||!/^\d{2}\/\d{2}\/\d{4}$/.test(obj.data))continue;
    const val=numeroOficial(obj.valor);
    const year=obj.data.slice(-4);
    if(val===null||val<0||Number(year)<2022)continue;
    const old=history[year];
    const key=obj.data.slice(6)+obj.data.slice(3,5)+obj.data.slice(0,2);
    const oldKey=old?old.data.slice(6)+old.data.slice(3,5)+old.data.slice(0,2):"";
    if(key>=oldKey)history[year]={data:obj.data,milhoesReais:val,serie};
  }
  return history;
}
async function previous():Promise<DadosMapa|null>{
  try {
    const obj=JSON.parse(await fs.readFile(DEST,"utf8")) as DadosMapa;
    if(Array.isArray(obj.estados)&&obj.estados.length===27)return obj;
  }catch{}
  return null;
}
async function main(){
  const old=await previous();
  // Malhas geográficas são estáveis. A cópia verificada das 27 UFs é versionada
  // no GitHub, portanto indisponibilidade do IBGE não derruba a publicação.
  // Dados econômicos, IDHM e emendas continuam vindo de fontes oficiais atuais.
  const cachePath=path.join(process.cwd(),"data","ibge-ufs-geometry.json");
  const cachedShapes=validarCacheMalhasIBGE(JSON.parse(await fs.readFile(cachePath,"utf8")));
  const notices:string[]=[];
  const map=new Map<string,EstadoMapa>(UFS.map(([id,uf,nome])=>{
    const years:Record<string,AnoUF>={};
    for(const y of anos) years[String(y)]={
      pibMilReais:null,populacao:null,emendasPagas:null,emendasCount:0
    };
    return [uf,{id,uf,nome,svgPath:cachedShapes[uf],porAno:years,idhmPorAno:{},creditoMei:null}];
  }));

  // PNUD/FJP/IBGE Radar IDHM 2012-2024, downloaded with pinned provenance
  // by collect-idhm.py. Never extrapolate 2025/2026 or infer an annual rate.
  const IDHM_PATH=path.join(process.cwd(),"public","data","idhm-ufs.json");
  const idhm=JSON.parse(await fs.readFile(IDHM_PATH,"utf8")) as {
    serieAte:number;porUF:Record<string,Record<string,number>>
  };
  if(idhm.serieAte!==2024 || Object.keys(idhm.porUF).length!==27)
    throw new Error("IDHM source missing or incomplete");
  for(const [,uf] of UFS) {
    const values=idhm.porUF[uf];
    if(!values || ![2022,2023,2024].every(year=>typeof values[String(year)]==="number"))
      throw new Error("IDHM series not validated for "+uf);
    map.get(uf)!.idhmPorAno=values;
  }
  notices.push("IDHM oficial PNUD/FJP/IBGE disponível até 2024; 2025 e 2026 ainda não são publicados nesta série.");

  // Atualizar a malha é uma opção EXPLÍCITA para manutenção, nunca uma
  // dependência do deploy normal. Em caso de 404, timeout ou DNS, preserva
  // o SVG versionado e documenta qual UF ficou no cache.
  if(process.env.REFRESH_IBGE_MESHES==="1"){
    await pool(UFS,3,async ([id,uf])=>{
      try{
        const url="https://servicodados.ibge.gov.br/api/v3/malhas/estados/"+id+
          "?formato=application%2Fvnd.geo%2Bjson&qualidade=minima";
        const geo=await obterJSON(url,18000,1);
        const rings=extrairPoligonos(geo);
        const svg=coordenadasParaSVG(rings);
        if(svg.length<30||!/^M[0-9MLZ,.-]+Z$/.test(svg))throw new Error("GeoJSON sem geometria compatível");
        map.get(uf)!.svgPath=svg;
      }catch(err){
        notices.push("Malha "+uf+": IBGE indisponível, cache versionado mantido ("+String(err)+").");
      }
    });
  } else {
    console.log("Malhas IBGE: 27 UFs carregadas do cache oficial versionado; nenhuma requisição ao endpoint de malhas.");
  }
  if([...map.values()].some(s=>!s.svgPath))throw new Error("Mapa incompleto: faltam estados.");
  for(const [table,variable,key] of [
    [5938,37,"pibMilReais"],[6579,9324,"populacao"]
  ] as const){
    try{
      const url="https://apisidra.ibge.gov.br/values/t/"+table+"/n3/all/v/"+variable+"/p/last%2010";
      const values=lerSidra(await obterJSON(url,35000,2),2022,anoAtual);
      const nonEmpty=Object.values(values).reduce((count,states)=>count+Object.keys(states).length,0);
      if(nonEmpty<20)throw new Error("API SIDRA sem cobertura estadual suficiente");
      for(const [uf,byYear] of Object.entries(values)){
        const state=map.get(uf);
        if(!state)continue;
        for(const [year,value] of Object.entries(byYear)){
          if(state.porAno[year]&&Number.isFinite(value)&&value>=0)
            state.porAno[year][key]=value;
        }
      }
    }catch(error){
      notices.push("IBGE tabela "+table+" temporariamente indisponível: "+String(error));
      if(old)for(const state of map.values()){
        const last=old.estados.find(s=>s.uf===state.uf);
        for(const year of anos)if(last?.porAno[String(year)]?.[key]!==undefined)
          state.porAno[String(year)][key]=last.porAno[String(year)][key];
      }
    }
  }
  // 2022 was a census year, not an annual population estimate in SIDRA 6579.
  // Use the actual 2022 Census population rather than leaving the series empty.
  try {
    const raw=await obterJSON("https://apisidra.ibge.gov.br/values/t/4714/n3/all/v/93/p/2022",35000,2);
    const census=lerSidra(raw,2022,2022);
    const found=Object.keys(census).length;
    if(found<25)throw new Error("Censo 2022 sem cobertura estadual suficiente: "+found);
    for(const [uf,years]of Object.entries(census)){
      const record=map.get(uf)?.porAno["2022"];
      if(record&&record.populacao===null)record.populacao=years["2022"]??null;
    }
  }catch(error){
    notices.push("População do Censo 2022 não consultada: "+String(error));
  }
  // CGU amendment totals come from the SAME validated SQLite release as all other pages.
  // NULL signifies absent regionalized records, not proof of zero transfers.
  const emendas=await prisma.emendaParlamentar.groupBy({
    by:["ano","ufBeneficiada"],
    where:{ano:{gte:2022},ufBeneficiada:{not:null}},
    _sum:{valorPago:true},_count:{_all:true},
  });
  for(const item of emendas){
    if(!item.ufBeneficiada||!UFSIGLAS.has(item.ufBeneficiada))continue;
    const state=map.get(item.ufBeneficiada)!;
    const record=state.porAno[String(item.ano)];
    if(!record)continue;
    record.emendasPagas=(record.emendasPagas??0)+(item._sum.valorPago??0);
    record.emendasCount+=item._count._all;
  }
  // SGS may have slower publication than SIDRA: preserve actual reference date and never extrapolate.
  let bcok=0;
  await pool(UFS,5,async ([,uf])=>{
    const serie=SERIES_MEI[uf];
    if(!serie)return;
    try{
      const url="https://api.bcb.gov.br/dados/serie/bcdata.sgs."+serie+
        "/dados?formato=json&dataInicial=01%2F01%2F2022&dataFinal="+
        encodeURIComponent(new Date().toLocaleDateString("pt-BR",{timeZone:"UTC"}));
      const result=parseBCB(await obterJSON(url,22000,1),serie);
      const years=Object.keys(result).sort();
      if(years.length) {
        const state=map.get(uf)!;
        state.creditoMeiPorAno=result;
        state.creditoMei=result[years.at(-1)!];
        bcok++;
      }
    }catch(error){console.warn("BCB "+uf+": "+String(error));}
  });
  if(!bcok)notices.push("BCB/SGS indisponível ou sem observações estaduais recentes; não foram estimados valores.");
  const results:DadosMapa={
    atualizadoEm:new Date().toISOString(),anos,estados:[...map.values()],
    fontes:{
      malhas:IBGE_MALHAS_SOURCE,
      pib:"https://sidra.ibge.gov.br/tabela/5938",
      idhm:"https://www.undp.org/pt/brazil/publications/radar-idhm-evolucao-do-idhm-e-de-seus-componentes-periodo-de-2012-2024",
      populacao:"https://sidra.ibge.gov.br/tabela/6579",
      creditoMei:"https://dadosabertos.bcb.gov.br/dataset/27327-saldo-de-credito-por-estado---mei---acre",
      emendas:"https://portaldatransparencia.gov.br/emendas"
    },avisos:notices
  };
  await fs.mkdir(path.dirname(DEST),{recursive:true});
  const temp=DEST+".tmp";
  await fs.writeFile(temp,JSON.stringify(results),{encoding:"utf8"});
  await fs.rename(temp,DEST);
  console.log("Dados regionais: "+results.estados.length+" estados, "+emendas.length+
    " agregações de emendas/ano, "+bcok+" séries BCB disponíveis.");
  for(const year of anos) {
    console.log("Cobertura regional "+year+": "+
      ["pibMilReais","populacao","emendasPagas"].map(metric =>
        metric+"="+results.estados.filter(e => e.porAno[String(year)]?.[metric as keyof AnoUF] !== null).length+"/27"
      ).join(" "));
  }
  if(notices.length)console.warn(notices.join("\n"));
}
main().catch(e=>{console.error("Falha ETL Mapa Brasil:",e);process.exitCode=1})
  .finally(()=>prisma.$disconnect());
