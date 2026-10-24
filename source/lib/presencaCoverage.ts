import fs from "node:fs";
import path from "node:path";
import type {CoberturaPresenca} from "./presencaMetric";
type Registry={version:number;dados:Record<string,CoberturaPresenca>};
let saved:Registry|null=null;
export function coberturaPresenca(parlamentarId:string,casa:string):CoberturaPresenca|undefined{
  try{
    if(!saved){
      const file=path.join(process.cwd(),"public/data/dossies/presenca-cobertura.json");
      saved=JSON.parse(fs.readFileSync(file,"utf8")) as Registry;
    }
    const p=saved?.version===1?saved.dados?.[parlamentarId]:undefined;
    if(p&&p.casa===casa&&p.criterio==="EVENTOS_COLETADOS_NAO_ASSIDUIDADE"&&
      Number.isFinite(p.percentual)&&p.percentual>=0&&p.percentual<=100&&
      p.eventosMonitorados>=10&&p.eventosComRegistro<=p.eventosMonitorados)return p;
  }catch {/* Snapshot sem amostra utilizável; nunca substituir por 0%. */}
}
