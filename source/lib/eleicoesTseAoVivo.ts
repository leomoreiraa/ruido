export type CandidatoTSEAoVivo={numero:string;nome:string;partido:string;votos:number;percentual:number|null};
export type ResultadoTSEAoVivo={
 situacao:"aguardando"|"parcial"|"concluida";apuradoEm:string|null;
 secoesTotalizadas:number;secoesPrevistas:number;percentualSecoes:number|null;
 votosValidos:number|null;votosTotais:number|null;brancos:number|null;nulos:number|null;
 candidatos:CandidatoTSEAoVivo[];
};
const BASE="https://resultados.tse.jus.br/oficial/ele2026/6258/dados";
const UFS=new Set("AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO".split(" "));
export const INICIO_APURACAO_UTC=Date.parse("2026-10-25T20:00:00.000Z");
export const INTERVALO_LIVE_MS=30_000;

export function consultaAoVivoDisponivel(agora=Date.now()):boolean{return agora>=INICIO_APURACAO_UTC;}

export function urlResultadoAoVivo(uf="BR",municipioTSE?:string):string {
 const codigo=uf.toUpperCase();
 if(codigo!=="BR"&&!UFS.has(codigo))throw new Error("UF nao reconhecida");
 if(municipioTSE!==undefined&&(codigo==="BR"||!/^[0-9]{5}$/.test(municipioTSE)))
  throw new Error("Codigo TSE de municipio invalido");
 const lower=codigo.toLowerCase();
 const stem=lower+(municipioTSE??"");
 return BASE+"/"+lower+"/"+stem+"-c0001-e006258-u.json";
}
function inteiro(v:unknown):number|null {
 if(typeof v!=="string"&&typeof v!=="number")return null;
 const s=String(v);
 if(!/^[0-9]+$/.test(s))return null;
 const n=Number(s);
 return Number.isSafeInteger(n)?n:null;
}
function obj(v:unknown):Record<string,unknown>|null {
 return typeof v==="object"&&v!==null&&!Array.isArray(v)?v as Record<string,unknown>:null;
}
function lista(v:unknown):unknown[]{return Array.isArray(v)?v:[];}

export function interpretarResultadoAoVivo(raw:unknown):ResultadoTSEAoVivo {
 const data=obj(raw);
 if(!data||String(data.ele)!=="6258"||String(data.t)!=="2")
  throw new Error("TSE: resposta nao corresponde ao 2º turno presidencial");
 const v=obj(data.v),s=obj(data.s);
 if(!v||!s)throw new Error("TSE: totais nao informados");
 const validos=inteiro(v.vv),total=inteiro(v.tv);
 const totalizadas=inteiro(s.st),previstas=inteiro(s.ts);
 if(validos===null||total===null||totalizadas===null||previstas===null||
  validos>total||totalizadas>previstas||previstas<1)
  throw new Error("TSE: totais inconsistentes");
 const cargos=lista(data.carg).map(obj).filter((x):x is Record<string,unknown>=>x!==null);
 const presidente=cargos.find(c=>String(c.cd)==="1");
 if(!presidente)throw new Error("TSE: cargo de presidente nao encontrado");
 const candidatos:CandidatoTSEAoVivo[]=[];
 const numeros=new Set<string>();
 for(const agr of lista(presidente.agr)){
  for(const par of lista(obj(agr)?.par)){
   const partido=obj(par);
   for(const item of lista(partido?.cand)){
    const c=obj(item);
    if(!c)continue;
    const numero=String(c.n??"");
    const votos=inteiro(c.vap);
    const nome=String(c.nmu??c.nm??"").trim();
    if(!/^[0-9]{1,3}$/.test(numero)||votos===null||!nome||numeros.has(numero))
     throw new Error("TSE: candidato ou votos invalidos");
    numeros.add(numero);
    candidatos.push({
     numero,nome,partido:String(partido?.sg??""),votos,
     percentual:validos>0?Math.round(1_000_000*votos/validos)/10_000:null
    });
   }
  }
 }
 if(candidatos.length<2||candidatos.reduce((a,c)=>a+c.votos,0)>validos)
  throw new Error("TSE: votacao inconsistente entre candidatos");
 candidatos.sort((a,b)=>b.votos-a.votos);
 const iniciado=totalizadas>0&&total>0;
 return {
  situacao:iniciado?(totalizadas===previstas?"concluida":"parcial"):"aguardando",
  apuradoEm:[data.dt,data.ht].filter(x=>typeof x==="string"&&x).join(" ")||null,
  secoesTotalizadas:totalizadas,secoesPrevistas:previstas,
  percentualSecoes:previstas>0?Math.round(100_000*totalizadas/previstas)/1_000:null,
  votosValidos:iniciado?validos:null,votosTotais:iniciado?total:null,
  brancos:iniciado?inteiro(v.vb):null,
  nulos:iniciado?(inteiro(v.vn)??0)+(inteiro(v.vnt)??0):null,
  candidatos,
 };
}
export async function buscarResultadoTSE(url:string,signal:AbortSignal):Promise<ResultadoTSEAoVivo> {
 if(!url.startsWith(BASE+"/"))throw new Error("URL fora da origem oficial");
 const resposta=await fetch(url,{method:"GET",cache:"no-store",mode:"cors",signal});
 if(resposta.status===429||resposta.status===403)
  throw new Error("O TSE limitou temporariamente as consultas.");
 if(!resposta.ok)throw new Error("Fonte TSE indisponivel: HTTP "+resposta.status);
 return interpretarResultadoAoVivo(await resposta.json());
}
