"use client";

import React,{memo,useEffect,useMemo,useState} from "react";
import {
 buscarHistoricoCentral,calcularCenarioMatematico,mesclarHistorico,
 type ParcialHistorica
} from "@/lib/eleicoesHistorico";
import {
 backendEleitoralConfigurado,consultaAoVivoDisponivel,INTERVALO_LIVE_MS,
 type ResultadoTSEAoVivo
} from "@/lib/eleicoesTseAoVivo";

type Observacao={
 resultado:ResultadoTSEAoVivo;
 consultadoEm:number;
 estado:"atual"|"desatualizado";
};
const formatarNumero=new Intl.NumberFormat("pt-BR");
const formatarPct=new Intl.NumberFormat("pt-BR",{minimumFractionDigits:2,maximumFractionDigits:2});
const formatarHora=new Intl.DateTimeFormat("pt-BR",{hour:"2-digit",minute:"2-digit",timeZone:"America/Sao_Paulo"});
const corLula="#e42232";
const corFlavio="#348653";
function parcialValida(observacao:Observacao):ParcialHistorica|null {
 const r=observacao.resultado;
 if(observacao.estado!=="atual"||r.situacao==="aguardando"||
    !r.votosValidos||!Number.isFinite(observacao.consultadoEm)||
    !Number.isFinite(r.percentualSecoes))return null;
 const candidatos=r.candidatos.filter(c=>c.numero==="13"||c.numero==="22")
  .map(c=>({numero:c.numero,votos:c.votos,percentual:c.percentual}));
 if(candidatos.length!==2||candidatos.some(c=>c.percentual===null))return null;
 return {
  consultadoEm:observacao.consultadoEm,
  secoesTotalizadas:r.secoesTotalizadas,
  secoesPrevistas:r.secoesPrevistas,
  percentualSecoes:r.percentualSecoes!,
  votosValidos:r.votosValidos,
  candidatos
 };
}
function grafico(serie:ParcialHistorica[]){
 const largura=720,altura=248;
 const esquerda=54,direita=20,topo=18,base=34;
 const extraidos=serie.flatMap(p=>p.candidatos.map(c=>c.percentual??0));
 const menor=Math.min(50,...extraidos),maior=Math.max(50,...extraidos);
 const amplitude=Math.max(8,maior-menor+4);
 const media=(menor+maior)/2;
 let minimo=Math.max(0,media-amplitude/2);
 let maximo=Math.min(100,minimo+amplitude);
 minimo=Math.max(0,maximo-amplitude);
 const inicio=serie[0]?.consultadoEm??0;
 const fim=serie[serie.length-1]?.consultadoEm??inicio;
 const x=(p:ParcialHistorica,i:number)=>esquerda+
  (largura-esquerda-direita)*(fim>inicio?(p.consultadoEm-inicio)/(fim-inicio):i/Math.max(1,serie.length-1));
 const y=(percentual:number)=>topo+(altura-topo-base)*(maximo-percentual)/(maximo-minimo);
 const pontos=(numero:string)=>serie.map((p,i)=>{
  const percentual=p.candidatos.find(c=>c.numero===numero)?.percentual;
  return percentual===null||percentual===undefined?null:{x:x(p,i),y:y(percentual)};
 }).filter((p):p is {x:number;y:number}=>p!==null);
 const curva=(numero:string)=>pontos(numero).map((p,i)=>
  (i?"L":"M")+p.x.toFixed(2)+" "+p.y.toFixed(2)).join(" ");
 return {largura,altura,esquerda,direita,topo,base,minimo,maximo,y,pontos,curva};
}

export const RadarApuracaoEleitoral=memo(function RadarApuracaoEleitoral({observacaoAtual,estados,estadoDestaque}:{
 observacaoAtual?:Observacao;
 estados?:Record<string,{percentualSecoes:number|null;situacao:string}|null>;
 estadoDestaque?:{uf:string;percentualSecoes:number|null};
}){
 const [historico,setHistorico]=useState<ParcialHistorica[]>([]);
 const [falhaHistorico,setFalhaHistorico]=useState(false);
 const [novosVotos,setNovosVotos]=useState(1_000_000);

 useEffect(()=>{
  if(!observacaoAtual)return;
  const ponto=parcialValida(observacaoAtual);
  if(!ponto)return;
  setHistorico(anterior=>{
   const proximo=mesclarHistorico(anterior,[ponto]);
   return proximo.length===anterior.length &&
    proximo.every((p,i)=>p===anterior[i])?anterior:proximo;
  });
 },[observacaoAtual]);

 useEffect(()=>{
  if(!backendEleitoralConfigurado())return;
  const abort=new AbortController();
  let ativo=true;
  const atualizar=async()=>{
   if(!consultaAoVivoDisponivel()||document.visibilityState==="hidden")return;
   try{
    const pontos=await buscarHistoricoCentral(abort.signal);
    if(!ativo)return;
    setFalhaHistorico(false);
    setHistorico(anterior=>{
     const proximo=mesclarHistorico(anterior,pontos);
     return proximo.length===anterior.length &&
      proximo.every((p,i)=>p===anterior[i])?anterior:proximo;
    });
   }catch{if(ativo&&!abort.signal.aborted)setFalhaHistorico(true);}
  };
  void atualizar();
  const timer=setInterval(()=>void atualizar(),INTERVALO_LIVE_MS);
  const visibilidade=()=>{if(document.visibilityState==="visible")void atualizar();};
  document.addEventListener("visibilitychange",visibilidade);
  return ()=>{ativo=false;abort.abort();clearInterval(timer);document.removeEventListener("visibilitychange",visibilidade);};
 },[]);

 const progressoEstados=useMemo(()=>{
  const ufs="AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO".split(" ");
  return ufs.map(uf=>{
   const registro=estados?.[uf];
   const aoVivo=estadoDestaque?.uf===uf?estadoDestaque.percentualSecoes:null;
   const parcial=aoVivo??registro?.percentualSecoes??null;
   return {uf,parcial};
  });
 },[estados,estadoDestaque?.uf,estadoDestaque?.percentualSecoes]);
 const estadosComRegistro=progressoEstados.filter(item=>item.parcial!==null&&item.parcial>0).length;
 const desenho=useMemo(()=>historico.length?grafico(historico):null,[historico]);
 const ultimo=historico[historico.length-1];
 const lula=ultimo?.candidatos.find(c=>c.numero==="13");
 const flavio=ultimo?.candidatos.find(c=>c.numero==="22");
 const diferenca=lula&&flavio?Math.abs(lula.votos-flavio.votos):null;
 const cenario=lula&&flavio?calcularCenarioMatematico(lula.votos,flavio.votos,novosVotos):null;
 const observado=historico.length>=2;
 const legenda=ultimo?"Última parcial recebida às "+formatarHora.format(new Date(ultimo.consultadoEm)):
  "Sem parciais oficiais recebidas";

 return <section className="ruido-paper-card border-4 border-ink bg-paper-card p-4 sm:p-6 shadow-[6px_6px_0_#e42232]"
   aria-labelledby="radar-apuracao-titulo">
  <div className="flex flex-wrap items-start justify-between gap-3 border-b-2 border-dashed border-ink/30 pb-3">
   <div className="min-w-0">
    <p className="font-mono text-xs font-bold text-punk-red">RUÍDO // PAINEL DE ACOMPANHAMENTO</p>
    <h2 id="radar-apuracao-titulo" className="font-heavy text-2xl sm:text-4xl uppercase text-ink">TENDÊNCIA DA APURAÇÃO //</h2>
    <p className="font-mono text-xs text-ink/75 mt-2">Histórico nacional de parciais oficiais do 2º turno. As curvas representam votos já contabilizados, não projeções de resultado.</p>
   </div>
   <span className="border-2 border-ink bg-ink px-2 py-1 font-mono text-[11px] font-bold text-white">TSE / DADOS OBSERVADOS</span>
  </div>

  <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 my-5">
   <div className="border-2 border-ink bg-white p-3">
    <p className="font-mono text-xs font-bold">SEÇÕES TOTALIZADAS</p>
    <strong className="font-heavy text-2xl sm:text-3xl text-ink">{ultimo?formatarPct.format(ultimo.percentualSecoes)+"%":"N/D"}</strong>
   </div>
   <div className="border-2 border-ink bg-white p-3">
    <p className="font-mono text-xs font-bold">DIFERENÇA DE VOTOS OBSERVADA</p>
    <strong className="font-heavy text-2xl sm:text-3xl text-ink">{diferenca===null?"N/D":formatarNumero.format(diferenca)}</strong>
   </div>
   <div className="border-2 border-ink bg-white p-3 col-span-2 lg:col-span-1">
    <p className="font-mono text-xs font-bold">PARCIAIS DISTINTAS NO HISTÓRICO</p>
    <strong className="font-heavy text-2xl sm:text-3xl text-ink">{formatarNumero.format(historico.length)}</strong>
   </div>
  </div>

  <div className="border-2 border-ink bg-white p-3 sm:p-4">
   <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
    <strong className="font-heavy text-lg uppercase">Evolução dos votos válidos</strong>
    <div className="flex flex-wrap gap-3 font-mono text-xs font-bold">
     <span className="flex items-center gap-1"><i className="inline-block h-3 w-3" style={{backgroundColor:corLula}}/> Lula (13)</span>
     <span className="flex items-center gap-1"><i className="inline-block h-3 w-3" style={{backgroundColor:corFlavio}}/> Flávio (22)</span>
    </div>
   </div>
   {observado&&desenho?<>
    <svg viewBox="0 0 720 248" className="block h-auto w-full" role="img"
     aria-label={"Evolução observada do percentual de votos válidos para Lula e Flávio em "+historico.length+" parciais divulgadas"}>
     {[0,1,2,3,4].map(n=>{
      const valor=desenho.minimo+(desenho.maximo-desenho.minimo)*n/4;
      const y=desenho.y(valor);
      return <g key={n}>
       <line x1={desenho.esquerda} x2={720-desenho.direita} y1={y} y2={y} stroke="#101010" strokeOpacity=".15" strokeDasharray="4 4"/>
       <text x={desenho.esquerda-8} y={y+4} fontSize="11" textAnchor="end" fill="#101010">{valor.toFixed(1).replace(".",",")}%</text>
      </g>;
     })}
     {historico.map((p,i)=>i===0||i===historico.length-1?
      <text key={p.consultadoEm} x={i===0?desenho.esquerda:720-desenho.direita} y="242" textAnchor={i===0?"start":"end"} fontSize="12" fill="#101010">
       {formatarHora.format(new Date(p.consultadoEm))}
      </text>:null)}
     <path d={desenho.curva("13")} fill="none" stroke={corLula} strokeWidth="3.4" strokeLinejoin="round" strokeLinecap="round"/>
     <path d={desenho.curva("22")} fill="none" stroke={corFlavio} strokeWidth="3.4" strokeLinejoin="round" strokeLinecap="round"/>
     {(["13","22"] as const).map(numero=>{
      const pontos=desenho.pontos(numero),ultimoPonto=pontos[pontos.length-1];
      return ultimoPonto?<circle key={numero} cx={ultimoPonto.x} cy={ultimoPonto.y} r="4.5"
       fill={numero==="13"?corLula:corFlavio} stroke="#101010" strokeWidth="1"/>:null;
     })}
    </svg>
    <p className="font-mono text-[11px] text-ink/70 mt-2">Escala vertical ajustada aos valores observados. A inclinação das curvas não indica probabilidade de vitória.</p>
   </>:<div className="min-h-44 flex flex-col items-center justify-center text-center px-3 font-mono text-sm text-ink/75">
    <strong>{consultaAoVivoDisponivel()?"Aguardando novas parciais distintas":"A apuração do 2º turno começa a partir das 17h de Brasília"}</strong>
    <p className="mt-2 max-w-md">O histórico é montado exclusivamente a partir das atualizações oficiais recebidas; o gráfico aparece quando houver pelo menos duas observações distintas.</p>
   </div>}
   <p className="font-mono text-xs text-ink/75 mt-3">{legenda}{falhaHistorico?" · Nem todas as parciais anteriores estão disponíveis.":""}</p>
  </div>

  <div className="mt-5 border-l-4 border-ink bg-white p-3 sm:p-5">
   <h3 className="font-heavy text-xl uppercase">Cenário matemático hipotético //</h3>
   <p className="font-mono text-xs mt-2 text-ink/80">
    Escolha quantos <strong>novos votos válidos hipotéticos</strong> seriam contabilizados. O cálculo mostra a parcela necessária ao candidato atualmente atrás para superar a diferença já observada. Não estima votos restantes nem prevê vencedor.
   </p>
   <div className="grid gap-4 md:grid-cols-2 mt-4 items-center">
    <label className="block font-mono text-xs font-bold text-ink" htmlFor="radar-novos-votos">
     NOVOS VOTOS VÁLIDOS (HIPÓTESE): <strong className="block font-heavy text-xl mt-1">{formatarNumero.format(novosVotos)}</strong>
     <input id="radar-novos-votos" type="range" min={100_000} max={20_000_000} step={100_000}
      value={novosVotos} onChange={event=>setNovosVotos(Number(event.target.value))}
      className="mt-3 w-full accent-[#e42232]" />
     <span className="flex justify-between font-normal text-[10px]"><span>100 mil</span><span>20 milhões</span></span>
    </label>
    <div className="bg-paper-card border-2 border-ink p-3 font-mono text-xs">
     {!cenario?<span>O cálculo ficará disponível quando o TSE divulgar uma parcial com votos válidos.</span>:
      cenario.empateAtual?<span>A diferença observada é zero. Num cenário com {formatarNumero.format(novosVotos)} novos votos válidos, seriam necessários {formatarNumero.format(cenario.necessarios)} votos para um dos candidatos passar à frente.</span>:
      cenario.viavel?<span>Quem está atrás precisaria de <strong className="font-heavy text-lg">{formatarPct.format(cenario.percentual)}%</strong> desses novos votos ({formatarNumero.format(cenario.necessarios)} de {formatarNumero.format(novosVotos)}), mantendo o total hipotético de dois candidatos.</span>:
      <span>Com apenas {formatarNumero.format(novosVotos)} votos adicionais, <strong>não seria matematicamente possível inverter</strong> a diferença atual de {formatarNumero.format(cenario.diferenca)} votos, mesmo que todos fossem para quem está atrás.</span>}
    </div>
   </div>
   <p className="mt-3 font-mono text-[11px] text-ink/70">Simulação aritmética de dois candidatos; não considera padrões geográficos, abstenções, distribuição futura de votos ou previsão estatística.</p>
  </div>
  <details className="mt-5 border-2 border-ink bg-white">
   <summary className="cursor-pointer px-3 py-3 sm:px-4 font-heavy text-base uppercase text-ink select-none">
    APURAÇÃO POR ESTADO // {estadosComRegistro} DE 27 UFs COM SEÇÕES TOTALIZADAS
   </summary>
   <div className="border-t-2 border-ink p-3 sm:p-4">
    <p className="font-mono text-xs text-ink/80 mb-4">
     Progresso de cada estado com base nos dados oficiais mais recentes disponíveis. Algumas parciais podem ter horários diferentes. A ausência de resultado não representa 0% de apuração.
    </p>
    <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2">
     {progressoEstados.map(item=><div key={item.uf} className="border border-ink/30 bg-paper-card p-2">
      <div className="flex items-center justify-between font-mono text-xs font-bold text-ink">
       <strong>{item.uf}</strong>
       <span>{item.parcial===null?"N/D":formatarPct.format(item.parcial)+"%"}</span>
      </div>
      <div className="mt-2 h-2 border border-ink/40 bg-gray-200">
       <div className="h-full bg-punk-red" style={{width:Math.min(100,Math.max(0,item.parcial??0))+"%"}}/>
      </div>
     </div>)}
    </div>
   </div>
  </details>
  <a href="https://resultados.tse.jus.br/oficial/app/index.html" target="_blank" rel="noreferrer" className="font-mono text-xs font-bold underline inline-block mt-4 text-ink">CONFERIR PARCIAIS OFICIAIS NO TSE ↗</a>
 </section>;
});
