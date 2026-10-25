import {RUIDO_ELECTION_API_ORIGIN,backendEleitoralConfigurado} from "./eleicoesTseAoVivo";

export type ContagemMunicipal=[number,number,number,number,number];
export type MapaMunicipalAoVivo={
 versao:1;
 fonte:"https://resultados.tse.jus.br/oficial";
 turno:2;
 estado:"parcial"|"aguardando_resultados";
 atualizadoEm:number|null;
 ultimaConsultaEm:number|null;
 municipiosPrevistos:number;
 municipiosConsultadosNaVolta:number;
 municipiosComResultado:number;
 municipios:Record<string,ContagemMunicipal>;
};
const natural=(n:unknown):n is number=>typeof n==="number"&&Number.isSafeInteger(n)&&n>=0;
export function validarMapaMunicipalAoVivo(raw:unknown):MapaMunicipalAoVivo{
 if(!raw||typeof raw!=="object"||Array.isArray(raw))
  throw new Error("Mapa municipal oficial não disponível");
 const data=raw as Partial<MapaMunicipalAoVivo>;
 if(data.versao!==1||data.turno!==2||data.fonte!=="https://resultados.tse.jus.br/oficial"||
    !["parcial","aguardando_resultados"].includes(data.estado??"")||
    !natural(data.municipiosPrevistos)||data.municipiosPrevistos>5700||
    !natural(data.municipiosConsultadosNaVolta)||!natural(data.municipiosComResultado)||
    data.municipiosComResultado>data.municipiosPrevistos||
    (data.atualizadoEm!==null&&!natural(data.atualizadoEm))||
    (data.ultimaConsultaEm!==null&&!natural(data.ultimaConsultaEm))||
    !data.municipios||typeof data.municipios!=="object"||Array.isArray(data.municipios))
  throw new Error("Parcial municipal sem validação suficiente");
 const entries=Object.entries(data.municipios);
 if(entries.length!==data.municipiosComResultado)throw new Error("Cobertura municipal incompatível");
 for(const [ibge,votos] of entries){
  if(!/^[0-9]{7}$/.test(ibge)||!Array.isArray(votos)||votos.length!==5||
     !votos.every(natural)||votos[2]===0||votos[0]+votos[1]>votos[2]||
     votos[3]===0||votos[3]>votos[4])
   throw new Error("Resultado municipal oficial inconsistente");
 }
 return data as MapaMunicipalAoVivo;
}
export async function buscarMapaMunicipalCentral(signal:AbortSignal):Promise<MapaMunicipalAoVivo>{
 if(!backendEleitoralConfigurado())throw new Error("API eleitoral não configurada");
 const res=await fetch(RUIDO_ELECTION_API_ORIGIN+"/v1/apuracao/2026/municipios",{
  method:"GET",signal,cache:"no-store",mode:"cors"
 });
 if(!res.ok)throw new Error("Coleta municipal temporariamente indisponível");
 return validarMapaMunicipalAoVivo(await res.json());
}
