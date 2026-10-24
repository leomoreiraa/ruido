
export const UFS = [
  ["11","RO","Rondônia"],["12","AC","Acre"],["13","AM","Amazonas"],["14","RR","Roraima"],
  ["15","PA","Pará"],["16","AP","Amapá"],["17","TO","Tocantins"],["21","MA","Maranhão"],
  ["22","PI","Piauí"],["23","CE","Ceará"],["24","RN","Rio Grande do Norte"],
  ["25","PB","Paraíba"],["26","PE","Pernambuco"],["27","AL","Alagoas"],
  ["28","SE","Sergipe"],["29","BA","Bahia"],["31","MG","Minas Gerais"],
  ["32","ES","Espírito Santo"],["33","RJ","Rio de Janeiro"],["35","SP","São Paulo"],
  ["41","PR","Paraná"],["42","SC","Santa Catarina"],["43","RS","Rio Grande do Sul"],
  ["50","MS","Mato Grosso do Sul"],["51","MT","Mato Grosso"],["52","GO","Goiás"],
  ["53","DF","Distrito Federal"],
] as const;

export type Medida = "idhm"|"idhmVariacao"|"pib"|"pibPerCapita"|"populacao"|"emendasPagas"|"emendasPerCapita"|"creditoMei";
export type AnoUF = { pibMilReais: number|null; populacao: number|null; emendasPagas: number|null; emendasCount: number };
export type EstadoMapa = {
  id: string; uf: string; nome: string; svgPath: string;
  porAno: Record<string,AnoUF>;
  idhmPorAno?: Record<string,number>;
  creditoMei: { data: string; milhoesReais: number; serie: number } | null;
  creditoMeiPorAno?: Record<string,{ data: string; milhoesReais: number; serie: number }>;
};
export type DadosMapa = {
  atualizadoEm: string; anos: number[]; estados: EstadoMapa[];
  fontes: { pib: string; populacao: string; creditoMei: string; emendas: string; idhm?: string; malhas?: string };
  avisos: string[];
};

export const SERIES_MEI: Record<string,number> = {
  AC:27327, AL:27328, AM:27329, AP:27330, BA:27331, CE:27332, DF:27333,
  ES:27334, GO:27335, MA:27336, MG:27337, MS:27338, MT:27339, PA:27340,
  PB:27341, PE:27342, PI:27343, PR:26610, RJ:26611, RN:26612, RO:26613,
  RR:26614, RS:26615, SC:26616, SE:26617, SP:26618, TO:26619,
};
export function numeroOficial(value: unknown): number|null {
  if(typeof value==="number") return Number.isFinite(value)?value:null;
  if(typeof value!=="string") return null;
  const raw=value.trim();
  if(!raw || ["-","..","...","X","x","…"].includes(raw)) return null;
  const n=Number(raw.includes(",")?raw.replace(/\./g,"").replace(",","."):raw);
  return Number.isFinite(n)?n:null;
}
const codigos=new Map<string,string>(UFS.map(([id,uf])=>[id,uf]));
export function lerSidra(response: unknown,start=2022,end=new Date().getUTCFullYear()) {
  const result:Record<string,Record<string,number>>={};
  if(!Array.isArray(response))return result;
  for(const entry of response) {
    if(!entry||typeof entry!=="object"||Array.isArray(entry))continue;
    const row=entry as Record<string,unknown>;
    const valor=numeroOficial(row.V);
    if(valor===null)continue;
    const dims=Object.entries(row).filter(([k])=>/^D\d+C$/.test(k)).map(([,v])=>String(v));
    const id=dims.find(v=>codigos.has(v));
    const year=dims.find(v=>/^\d{4}$/.test(v)&&Number(v)>=start&&Number(v)<=end);
    if(!id||!year)continue;
    const uf=codigos.get(id)!;
    (result[uf]??={})[year]=valor;
  }
  return result;
}
export function extrairPoligonos(input: unknown): number[][][][] {
  const all:number[][][][]=[];
  function geometry(g:any) {
    if(!g||typeof g!=="object")return;
    if(g.type==="FeatureCollection"){for(const f of g.features??[])geometry(f);return;}
    if(g.type==="Feature"){geometry(g.geometry);return;}
    if(g.type==="GeometryCollection"){for(const x of g.geometries??[])geometry(x);return;}
    if(g.type==="Polygon"){all.push(g.coordinates);return;}
    if(g.type==="MultiPolygon"){for(const x of g.coordinates??[])all.push(x);}
  }
  geometry(input);
  return all.filter(p=>Array.isArray(p)&&p.some(r=>Array.isArray(r)&&r.length>=4));
}
export function coordenadasParaSVG(polygons:number[][][][]) {
  const X=(lon:number)=>48+(lon+74.2)*620/41.4;
  const Y=(lat:number)=>37+(5.5-lat)*636/39.8;
  const result:string[]=[];
  for(const poly of polygons)for(const ring of poly){
    if(!Array.isArray(ring)||ring.length<4)continue;
    const points=ring.filter(p=>Array.isArray(p)&&Number.isFinite(p[0])&&Number.isFinite(p[1]));
    if(points.length<4)continue;
    const compact=points.filter((p,i)=>i===0||i===points.length-1||Math.hypot(X(p[0])-X(points[i-1][0]),Y(p[1])-Y(points[i-1][1]))>0.6);
    if(compact.length<3)continue;
    result.push(compact.map((p,i)=>(i?"L":"M")+X(p[0]).toFixed(1)+","+Y(p[1]).toFixed(1)).join("")+"Z");
  }
  return result.join("");
}
export function valorIndicador(e:EstadoMapa,ano:number,m:Medida):number|null {
  if(m==="idhm" || m==="idhmVariacao") {
    const current=e.idhmPorAno?.[String(ano)];
    if(current===undefined || !Number.isFinite(current))return null;
    if(m==="idhm")return current;
    const previous=e.idhmPorAno?.[String(ano-1)];
    return previous===undefined || !Number.isFinite(previous)?null:Number((current-previous).toFixed(4));
  }
  if(m==="creditoMei"){
    const obs=e.creditoMeiPorAno?.[String(ano)] ?? (e.creditoMei&&Number(e.creditoMei.data.slice(6,10))===ano?e.creditoMei:null);
    return obs ? obs.milhoesReais*1e6 : null;
  }
  const r=e.porAno[String(ano)];
  if(!r)return null;
  if(m==="populacao")return r.populacao;
  if(m==="pib")return r.pibMilReais===null?null:r.pibMilReais*1000;
  if(m==="pibPerCapita")return r.pibMilReais===null||!r.populacao?null:r.pibMilReais*1000/r.populacao;
  if(m==="emendasPagas")return r.emendasPagas;
  if(m==="emendasPerCapita")return r.emendasPagas===null||!r.populacao?null:r.emendasPagas/r.populacao;
  return null;
}
