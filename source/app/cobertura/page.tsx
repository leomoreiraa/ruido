import Link from "next/link";
import { prisma } from "@/lib/prisma";

export const metadata = {
  title: "Cobertura dos Dados | RUÍDO",
  description: "Relatório público do acervo legislativo e das lacunas de cobertura.",
};

export default async function CoberturaPage() {
  const now=new Date();
  const elapsed=(now.getUTCFullYear()-2022)*12+now.getUTCMonth()+1;
  const [votos,presencas,emendas,bens,pautasSemVotacoes,semPlacar,semVinculo,status,checkpoints]=await Promise.all([
    prisma.votacao.groupBy({by:["casa","cobertura"],_count:{_all:true}}),
    prisma.presenca.groupBy({by:["casa","cobertura"],_count:{_all:true}}),
    prisma.emendaParlamentar.groupBy({by:["ano"],_count:{_all:true},_sum:{valorPago:true}}),
    prisma.bemDeclarado.count(),
    prisma.proposicao.count({where:{votacoes:{none:{}}}}),
    prisma.votacao.count({where:{placarSim:0,placarNao:0,placarAbstencao:0,placarObstrucao:0,placarOutros:0}}),
    prisma.emendaParlamentar.count({where:{parlamentarId:null}}),
    prisma.syncExecution.findMany({where:{id:{startsWith:"history:v1:"},status:"SUCESSO"},select:{id:true,parametros:true}}),
    prisma.voto.count(),
  ]);
  const completed=new Set(status.filter(r=>{
    if(!/^history:v1:(camara|senado):\d{4}-\d{2}$/.test(r.id))return false;
    try{return JSON.parse(r.parametros||"{}").encerrada===true;}catch{return false;}
  }).map(r=>r.id));
  function closed(house:string) {
    let total=0;
    for(let i=0;i<elapsed;i++){
      const month=(2022+Math.floor(i/12))+"-"+String(i%12+1).padStart(2,"0");
      if(completed.has("history:v1:"+house+":"+month))total++;
    }
    return total;
  }
  const totalVotacoes=votos.reduce((s,r)=>s+r._count._all,0);
  const totalPresencas=presencas.reduce((s,r)=>s+r._count._all,0);
  const totalEmendas=emendas.reduce((s,r)=>s+r._count._all,0);
  const title:Record<string,string>={
    NOMINAL_PUBLICA:"Lista nominal disponível",
    PLACAR_AGREGADO:"Somente contagem agregada",
    SEM_VOTOS_NOMINAIS:"Sem lista individual na fonte",
    DADOS_PARCIAIS:"Detalhe não publicado pela API",
    SECRETA_AGREGADA:"Votação secreta agregada",
    EM_IMPORTACAO:"Importação parcial",
    NAO_VERIFICADA:"Cobertura não verificada",
  };
  return <div className="space-y-8 font-mono pb-12">
    <header className="ruido-ink-poster bg-ink text-paper border-4 border-ink shadow-[10px_10px_0_#e42232] p-6 sm:p-10">
      <span className="text-xs text-punk-acid tracking-widest">
      <h1 className="font-heavy text-5xl sm:text-7xl mt-3">SEM DADOS <span className="text-punk-red">FALSOS.</span></h1>
      <p className="max-w-3xl mt-4 text-sm text-paper/80">Relatório do SQLite utilizado para publicar este site.
        Os números medem o que foi coletado, não tudo o que ocorreu no Congresso.
        Sem registro não equivale a ausência de voto, emenda, presença ou patrimônio.</p>
      <p className="mt-4 text-xs text-punk-acid">Snapshot consultado na compilação: {now.toLocaleDateString("pt-BR",{timeZone:"UTC"})}</p>
    </header>
    
    <section className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {[
        ["VOTAÇÕES",totalVotacoes],["VOTOS INDIVIDUAIS",checkpoints],
        ["PRESENÇAS/REGISTROS",totalPresencas],["EMENDAS",totalEmendas],
      ].map(([label,n])=><div key={String(label)} className="ruido-paper-card border-3 border-ink bg-paper-card p-5 shadow-[5px_5px_0_#101010]">
        <div className="text-xs font-bold">{label}</div>
        <strong className="block font-heavy text-punk-red text-4xl mt-2">{Number(n).toLocaleString("pt-BR")}</strong>
        <small className="block text-ink/60 mt-2">Linhas publicadas, não cobertura integral</small>
      </div>)}
    </section>
    <section className="grid lg:grid-cols-2 gap-5">
      {(["camara","senado"] as const).map(house=><div key={house}
        className="ruido-paper-card border-4 border-ink bg-paper-card shadow-[7px_7px_0_#101010] p-5">
        <h2 className="font-heavy text-3xl border-b-4 border-punk-red pb-2">{house==="camara"?"CÂMARA":"SENADO"}</h2>
        <div className="bg-punk-acid border-2 border-ink p-4 mt-4">
          <span className="block text-xs font-bold">MESES HISTÓRICOS ENCERRADOS</span>
          <strong className="font-heavy text-3xl">{closed(house)} / {elapsed}</strong>
          <p className="mt-2 text-xs">Janeiro de 2022 até o mês atual. Meses em aberto são reconsultados.
            Um checkpoint de sucesso significa que a consulta terminou, não que a fonte tem todo o histórico.</p>
        </div>
        <div className="mt-4 space-y-2">
          {votos.filter(r=>r.casa===house.toUpperCase()).map(row=><div key={row.cobertura}
            className="flex justify-between gap-3 border-b border-dashed border-ink/40 pb-2 text-xs">
            <span>{title[row.cobertura]??row.cobertura}</span><b>{row._count._all.toLocaleString("pt-BR")}</b>
          </div>)}
        </div>
      </div>)}
    </section>
    <section className="ruido-paper-card border-4 border-ink bg-paper-light shadow-[7px_7px_0_#101010] p-6">
      <h2 className="font-heavy text-3xl border-b-4 border-ink pb-3">LACUNAS DECLARADAS 
      <div className="grid md:grid-cols-2 gap-4 mt-5">
        {[
          ["Votações sem contagem numérica",semPlacar,"Pode incluir decisões simbólicas e votações sem placar na fonte oficial."],
          ["Proposições sem votação relacionada nesta base",pautasSemVotacoes,"Não comprova que essas proposições nunca foram votadas."],
          ["Emendas sem associação nominal segura",semVinculo,"Inclui emendas coletivas, autorias não identificadas e ainda não conciliadas."],
          ["Declarações patrimoniais importadas do TSE",bens,"Importador TSE ainda indisponível. Zero linhas não significa patrimônio zero."],
        ].map(([label,n,description])=><article key={String(label)} className="ruido-paper-card p-4 bg-paper-card border-2 border-ink">
          <b className="font-heavy block text-punk-red text-3xl">{Number(n).toLocaleString("pt-BR")}</b>
          <h3 className="text-sm font-bold">{label}</h3>
          <p className="text-xs mt-2 text-ink/70">{description}</p>
        </article>)}
      </div>
      <h3 className="font-heavy text-2xl mt-7">EMENDAS POR ANO 
      <div className="flex flex-wrap gap-3 mt-2">
        {emendas.map(row=><div key={row.ano} className="border-2 border-ink p-3 bg-punk-acid">
          <b className="font-heavy text-xl">{row.ano}</b>
          <span className="block text-xs">{row._count._all.toLocaleString("pt-BR")} emendas importadas</span>
        </div>)}
      </div>
    </section>
    <footer className="ruido-ink-poster bg-ink border-l-8 border-punk-red text-paper p-6 text-sm space-y-4">
      <h2 className="font-heavy text-2xl text-punk-acid">O QUE OS NÚMEROS NÃO DIZEM 
      <p>Registros de presença não representam todas as sessões da legislatura. Votos nominais só existem quando
        identificados oficialmente. Emendas são coletadas em lotes desde 2022. No <Link href="/mapa" className="underline text-punk-acid">Mapa BR</Link>,
        PIB e população dependem do calendário do IBGE, e crédito ao MEI do Banco Central.</p>
      <Link href="/sobre" className="underline text-punk-acid">LER METODOLOGIA ↗</Link>
    </footer>
  </div>;
}
