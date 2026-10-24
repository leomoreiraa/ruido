export type CoberturaPresenca={
  casa:string;eventosMonitorados:number;eventosComRegistro:number;
  percentual:number;inicioRecorte:string;fimRecorte:string;
  criterio:"EVENTOS_COLETADOS_NAO_ASSIDUIDADE";fonte:string;
};
/** Percentual fechado: recusa somas diferentes do total de sessões auditadas. */
export function frequenciaAuditadaPercentual(item?:{
  sessoes:number;presentes:number;ausentes:number;justificadas:number;
}):number|null{
  if(!item||![item.sessoes,item.presentes,item.ausentes,item.justificadas].every(
    x=>Number.isInteger(x)&&x>=0))return null;
  if(item.sessoes<1||item.presentes+item.ausentes+item.justificadas!==item.sessoes)return null;
  return Math.round(1000*item.presentes/item.sessoes)/10;
}
