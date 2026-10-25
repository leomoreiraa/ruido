import {RUIDO_ELECTION_API_ORIGIN,backendEleitoralConfigurado} from "@/lib/eleicoesTseAoVivo";

export type PaisExterior={
 iso:string;nome:string;
 localidadesPrevistas:number;localidadesComResultado:number;
 secoesTotalizadas:number;secoesPrevistasConhecidas:number;
 lula:number;flavio:number;votosValidos:number;apuradoEm:number|null;
};
export type ExteriorAoVivo={
 versao:1;fonte:"https://resultados.tse.jus.br/oficial";turno:2;
 estado:"aguardando_inicio"|"aguardando_resultados"|"parcial"|"completo";
 localidadesPrevistas:number;localidadesComResultado:number;
 atualizadoEm:number|null;paises:PaisExterior[];
};
export type MalhaMundi={
 versao:1;viewBox:string;fonteGeografica:string;fonteUrl:string;
 paises:Array<{iso:string;nome:string;d:string}>;
 marcadores:Array<{iso:string;nome:string;x:number;y:number}>;
};
const inteiro=(v:unknown)=>Number.isSafeInteger(v)&&typeof v==="number"&&v>=0;

export function validarExteriorAoVivo(raw:unknown):ExteriorAoVivo{
 if(!raw||typeof raw!=="object")throw new Error("Apuração no exterior: resposta inválida");
 const item=raw as Partial<ExteriorAoVivo>;
 if(item.versao!==1||item.turno!==2||item.fonte!=="https://resultados.tse.jus.br/oficial"||
    !["aguardando_inicio","aguardando_resultados","parcial","completo"].includes(item.estado||"")||
    !inteiro(item.localidadesPrevistas)||!inteiro(item.localidadesComResultado)||
    item.localidadesPrevistas!==186||item.localidadesComResultado!>item.localidadesPrevistas||
    !Array.isArray(item.paises)||item.paises.length>200||
    (item.atualizadoEm!==null&&!inteiro(item.atualizadoEm)))
  throw new Error("Apuração no exterior: metadados inconsistentes");
 const seen=new Set<string>();
 let contagem=0;
 for(const p of item.paises){
  if(!p||typeof p.nome!=="string"||!p.nome||typeof p.iso!=="string"||
     !/^[A-Z]{2}$/.test(p.iso)||seen.has(p.iso))throw new Error("País inválido ou duplicado");
  seen.add(p.iso);
  if([p.localidadesPrevistas,p.localidadesComResultado,p.secoesTotalizadas,
    p.secoesPrevistasConhecidas,p.lula,p.flavio,p.votosValidos].some(v=>!inteiro(v))||
    p.localidadesComResultado>p.localidadesPrevistas||
    p.lula+p.flavio>p.votosValidos||
    p.secoesTotalizadas>p.secoesPrevistasConhecidas||
    (p.apuradoEm!==null&&!inteiro(p.apuradoEm)))
    throw new Error("Totais eleitorais por país inconsistentes");
  contagem+=p.localidadesComResultado;
 }
 if(contagem!==item.localidadesComResultado&&item.estado!=="aguardando_inicio")
  throw new Error("Cobertura de localidades do exterior não confere");
 return item as ExteriorAoVivo;
}

export function validarMalhaMundi(raw:unknown):MalhaMundi{
 if(!raw||typeof raw!=="object")throw new Error("Malha mundi indisponível");
 const item=raw as Partial<MalhaMundi>;
 if(item.versao!==1||item.viewBox!=="0 0 900 450"||!Array.isArray(item.paises)||
    item.paises.length<170||item.paises.some(p=>!p.d||!/^[A-Z]{2}$/.test(p.iso))||
    !Array.isArray(item.marcadores))throw new Error("Malha mundi incompleta");
 return item as MalhaMundi;
}
export async function buscarExteriorAoVivo(signal:AbortSignal):Promise<ExteriorAoVivo>{
 if(!backendEleitoralConfigurado())throw new Error("Serviço de apuração indisponível");
 const resposta=await fetch(RUIDO_ELECTION_API_ORIGIN+"/v1/apuracao/2026/exterior",{
  method:"GET",cache:"no-store",mode:"cors",signal
 });
 if(!resposta.ok)throw new Error("Consulta ao exterior indisponível");
 return validarExteriorAoVivo(await resposta.json());
}
