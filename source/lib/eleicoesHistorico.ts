import {backendEleitoralConfigurado,RUIDO_ELECTION_API_ORIGIN} from "./eleicoesTseAoVivo";

export type ParcialHistorica={
 consultadoEm:number;
 secoesTotalizadas:number;
 secoesPrevistas:number;
 percentualSecoes:number;
 votosValidos:number;
 candidatos:Array<{numero:string;votos:number;percentual:number|null}>;
};
type RespostaHistorico={
 versao:number;fonte:string;turno:number;consultadoEm:number|null;pontos:ParcialHistorica[];
};
const MAX_PONTOS=720;
const seguro=(valor:unknown)=>typeof valor==="number"&&Number.isSafeInteger(valor)&&valor>=0;
const taxa=(valor:unknown)=>typeof valor==="number"&&Number.isFinite(valor)&&valor>=0&&valor<=100;

export function validarHistoricoCentral(input:unknown):ParcialHistorica[] {
 if(!input||typeof input!=="object")throw new Error("Histórico eleitoral inválido");
 const registro=input as Partial<RespostaHistorico>;
 if(registro.versao!==1||registro.turno!==2||
    registro.fonte!=="https://resultados.tse.jus.br/oficial"||
    !Array.isArray(registro.pontos)||registro.pontos.length>MAX_PONTOS)
  throw new Error("Fonte ou versão do histórico não reconhecida");
 let ultimoTempo=0;
 let ultimaSecao=0;
 return registro.pontos.map(item=>{
  if(!item||!seguro(item.consultadoEm)||!seguro(item.secoesTotalizadas)||
     !seguro(item.secoesPrevistas)||!seguro(item.votosValidos)||
     !taxa(item.percentualSecoes)||!Array.isArray(item.candidatos)||
     item.candidatos.length!==2||item.secoesTotalizadas>item.secoesPrevistas||
     item.secoesPrevistas===0||item.consultadoEm<=ultimoTempo||
     item.secoesTotalizadas<ultimaSecao)
    throw new Error("Histórico oficial inconsistente");
  const numeros=item.candidatos.map(c=>c.numero).sort();
  if(numeros[0]!=="13"||numeros[1]!=="22"||
     item.candidatos.some(c=>!seguro(c.votos)||!taxa(c.percentual)||c.votos>item.votosValidos)||
     item.candidatos.reduce((a,c)=>a+c.votos,0)>item.votosValidos)
    throw new Error("Votos históricos inconsistentes");
  ultimoTempo=item.consultadoEm;
  ultimaSecao=item.secoesTotalizadas;
  return item;
 });
}

export function mesclarHistorico(atual:ParcialHistorica[],recebido:ParcialHistorica[]):ParcialHistorica[] {
 const lista=[...atual,...recebido].sort((a,b)=>a.consultadoEm-b.consultadoEm);
 const chaves=new Set<string>();
 const saida:ParcialHistorica[]=[];
 for(const ponto of lista){
  const lula=ponto.candidatos.find(c=>c.numero==="13")?.votos;
  const flavio=ponto.candidatos.find(c=>c.numero==="22")?.votos;
  if(lula===undefined||flavio===undefined)continue;
  const chave=ponto.secoesTotalizadas+":"+lula+":"+flavio;
  if(chaves.has(chave))continue;
  chaves.add(chave);
  if(saida.length&&ponto.secoesTotalizadas<saida[saida.length-1].secoesTotalizadas)continue;
  saida.push(ponto);
 }
 return saida.slice(-MAX_PONTOS);
}

export function calcularCenarioMatematico(votosA:number,votosB:number,novosVotos:number){
 if(![votosA,votosB,novosVotos].every(seguro)||novosVotos<1)
  throw new Error("Contagem hipotética de votos inválida");
 const diferenca=Math.abs(votosA-votosB);
 if(diferenca===0)return {diferenca,novosVotos,necessarios:Math.floor(novosVotos/2)+1,
  percentual:100*(Math.floor(novosVotos/2)+1)/novosVotos,viavel:true,empateAtual:true};
 const necessarios=Math.floor((novosVotos+diferenca)/2)+1;
 return {diferenca,novosVotos,necessarios,percentual:100*necessarios/novosVotos,
  viavel:necessarios<=novosVotos,empateAtual:false};
}

export function urlHistoricoCentral():string{
 if(!backendEleitoralConfigurado())throw new Error("API dinâmica do RUÍDO não configurada");
 return RUIDO_ELECTION_API_ORIGIN+"/v1/apuracao/2026/historico";
}
export async function buscarHistoricoCentral(signal:AbortSignal):Promise<ParcialHistorica[]> {
 const resposta=await fetch(urlHistoricoCentral(),{method:"GET",mode:"cors",cache:"no-store",signal});
 if(!resposta.ok)throw new Error("Histórico temporariamente indisponível");
 return validarHistoricoCentral(await resposta.json());
}
