
import fs from "node:fs";
import path from "node:path";

type FundingOrigin={nome:string;origem:string;tipo:string;cnpj:string|null;valor:number};
type Supplier={cnpj:string;nome:string;valor:number;ano?:number;fonte?:string};
type Campaign={ano:number;fonte:string;arrecadacaoRegistrada:number;
  origens:FundingOrigin[];fornecedores:Supplier[]};
type Amendment={codigo:string;numero:string|null;ano:number;autor:string;tipo:string;
  valorEmpenhado:number;valorPago:number;localidade:string|null;fonte:string;origem:string};
type Intersection={cnpj:string;nomeFornecedor:string;anoCampanha:number;anoGabinete:number;
  valorContratadoCampanha:number;valorCEAP:number;fonteCampanha:string;fonteCEAP:string;tipo:string};
type SenateQuota={ano:number;valorCEAPS:number;fonte:string;origem:"SENADO_CODIGO_OFICIAL";coletadoEm:string};
type FinancialNetwork={campanhas?:Campaign[];fornecedoresGabinete?:Supplier[];
  fornecedoresSenado?:Supplier[];emendas?:Amendment[];
  coincidencias?:Intersection[];cotasSenado?:SenateQuota[]};
type Store={version:number;atualizadoEm:string;dados:Record<string,FinancialNetwork>;
  cobertura:Record<string,unknown>;avisos:string[]};
const empty:Store={version:1,atualizadoEm:"",dados:{},cobertura:{},avisos:[]};
function read():Store{
  try{
    const location=path.join(process.cwd(),"public/data/dossies/redes-financeiras.json");
    const value=JSON.parse(fs.readFileSync(location,"utf8")) as Store;
    return value?.version===1 && value.dados ? value : empty;
  }catch{return empty}
}
const data=read();
const money=new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"});
const real=(v:number)=>Number.isFinite(v)&&v>=0?money.format(v):"não informado";
const source=(u:string)=> {
  try{
    const url=new URL(u);
    return url.protocol==="https:" && (url.hostname==="cdn.tse.jus.br" ||
      url.hostname==="www.camara.leg.br" ||
      url.hostname==="portaldatransparencia.gov.br" ||
      url.hostname==="adm.senado.gov.br") ? url.href:null;
  }catch{return null}
};
const company=(x:string)=>/^\d{14}$/.test(x||"");
function Source({url,label}:{url:string;label:string}){
  const href=source(url);
  return href ? <a href={href} className="ruido-dossier-source"
    target="_blank" rel="noopener noreferrer">{label} ↗</a>:null;
}

export function DossieRedeFinanceira({parlamentarId,casa}:{parlamentarId:string;casa:string}){
  const stored=data.dados[parlamentarId]||{};
  const campanhas=(stored.campanhas||[]).filter(c=>
    c.ano>=2018&&c.ano<=2030&&!!source(c.fonte) &&
    Number.isFinite(c.arrecadacaoRegistrada)&&c.arrecadacaoRegistrada>=0);
  const fornecedores=(stored.fornecedoresGabinete||[]).filter(v=>
    company(v.cnpj)&&!!source(v.fonte||"")&&Number.isFinite(v.valor)&&v.valor>=0);
  const fornecedoresSenado=(stored.fornecedoresSenado||[]).filter(v=>
    company(v.cnpj)&&!!source(v.fonte||"")&&
    Number.isFinite(v.valor)&&v.valor>=0);
  const todosFornecedores=[...fornecedores,...fornecedoresSenado];
  const cotasSenado=(stored.cotasSenado||[]).filter(e=>
    e.origem==="SENADO_CODIGO_OFICIAL" && e.ano>=2025 && e.ano<=2026 &&
    !!source(e.fonte)&&new URL(e.fonte).hostname==="adm.senado.gov.br" &&
    Number.isFinite(e.valorCEAPS)&&e.valorCEAPS>=0)
    .sort((a,b)=>b.ano-a.ano);
  const emendas=(stored.emendas||[]).filter(e=>
    !!source(e.fonte)&&e.codigo?.length>=5&&Number.isInteger(e.ano)&&
    Number.isFinite(e.valorPago)&&e.valorPago>=0 &&
    Number.isFinite(e.valorEmpenhado)&&e.valorEmpenhado>=0);
  const coincidencias=(stored.coincidencias||[]).filter(e=>
    e.tipo==="MESMO_CNPJ_FORNECEDOR_CAMPANHA_E_CEAP"&&company(e.cnpj)&&
    !!source(e.fonteCampanha)&&!!source(e.fonteCEAP)&&
    campanhas.some(c=>c.ano===e.anoCampanha&&c.fornecedores.some(f=>f.cnpj===e.cnpj))&&
    todosFornecedores.some(f=>f.cnpj===e.cnpj&&f.ano===e.anoGabinete));
  const campaignSuppliers=campanhas.flatMap(c=>c.fornecedores.map(x=>({...x,ano:c.ano,fonte:c.fonte})))
    .filter(v=>company(v.cnpj)&&!!source(v.fonte||""));
  if (!campanhas.length && !todosFornecedores.length && !emendas.length && !cotasSenado.length) {
    return <section aria-label="Rastreabilidade financeira" className="ruido-dossie-section p-4 sm:p-6 min-w-0">
      <h2 className="font-heavy text-2xl uppercase text-ink">RASTREABILIDADE FINANCEIRA</h2>
      <p className="font-mono text-sm text-ink/80 mt-3">
        A coleta de financiamento eleitoral, fornecedores e emendas ainda não publicou
        registros vinculados de forma inequívoca a este parlamentar.
        A falta de registros no recorte não comprova ausência de movimentações.
      </p>
      <p className="font-mono text-xs text-ink/70 mt-3">
        Fontes previstas: TSE, Câmara e Portal da Transparência. Sem inferências por nome.
      </p>
    </section>;
  }
  return <section className="space-y-5 sm:space-y-6 min-w-0 w-full" aria-labelledby="rede-financeira-heading">
    <div className="border-l-[7px] border-punk-acid bg-ink px-4 sm:px-5 py-4 text-paper min-w-0">
      <h2 id="rede-financeira-heading" className="font-heavy text-3xl sm:text-4xl uppercase">
        RASTREABILIDADE FINANCEIRA
      </h2>
      <p className="font-mono text-xs sm:text-sm leading-relaxed text-paper/90">
        Campanhas e fornecedores cruzados por registros oficiais. CNPJ igual significa
        apenas identificação da mesma empresa nos dois conjuntos de dados, não favorecimento.
        Valores de campanha, cotas parlamentares e emendas não são somados entre si.
      </p>
    </div>
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 min-w-0">
      <article className="ruido-dossie-section p-4 sm:p-6 min-w-0">
        <h3 className="font-heavy text-2xl uppercase text-ink">FINANCIAMENTO ELEITORAL</h3>
        <p className="font-mono text-xs text-ink/80 mb-4">
          Dados oficiais do TSE (2018, 2022 e 2026). Receitas vinculadas por nome civil
          ou nome de urna exato (quando não houver nome civil oficial), UF,
          cargo e número sequencial únicos.
          Doadores pessoais nunca têm CPF exibido. Os maiores registros não somam
          necessariamente a arrecadação total.
        </p>
        {campanhas.length ? campanhas.map(c=><div className="ruido-dossie-row py-3 font-mono text-xs text-ink" key={c.ano}>
          <div className="flex flex-wrap gap-2 justify-between">
            <strong>{c.ano}</strong>
            <strong>{real(c.arrecadacaoRegistrada)}</strong>
          </div>
          <p className="mt-2 text-ink/70">Origens de recursos publicadas pelo TSE:</p>
          <ul className="space-y-1 my-2">
            {c.origens.slice(0,6).map((v,i)=><li key={i} className="flex flex-wrap justify-between gap-2">
              <span className="min-w-0 break-words">{v.nome}</span><b>{real(v.valor)}</b>
            </li>)}
          </ul>
          <Source url={c.fonte} label={"ABRIR DADOS OFICIAIS TSE "+c.ano}/>
        </div>) :
          <p className="ruido-empty-inline font-mono text-sm text-ink">
            Nenhuma candidatura vinculada com identidade única e contas disponíveis.
            Não significa ausência de arrecadação.
          </p>}
      </article>
      {casa==="SENADO" && <article className="ruido-dossie-section p-4 sm:p-6 min-w-0">
        <h3 className="font-heavy text-2xl uppercase text-ink">COTAS DO SENADO</h3>
        <p className="font-mono text-xs text-ink/80 mb-4">
          Despesas oficiais com a Cota para Exercício da Atividade Parlamentar
          dos Senadores (CEAPS), consultadas pelo código do senador, nome, UF e ano.
          Não incluem outros gastos do Senado nem constituem renda pessoal.
        </p>
        {cotasSenado.length ? <ul className="space-y-2">
          {cotasSenado.map(c=><li className="ruido-dossie-row py-3 font-mono text-sm text-ink"
            key={c.ano}>
            <div className="flex flex-wrap gap-2 justify-between">
              <strong>{c.ano}</strong><strong>{real(c.valorCEAPS)}</strong>
            </div>
            <Source url={c.fonte} label="CONSULTAR RELATÓRIO DO SENADO"/>
          </li>)}
        </ul>:<p className="ruido-empty-inline font-mono text-sm text-ink">
          Nenhuma cota do Senado validada neste recorte. Para deputados, a CEAP
          e seus fornecedores aparecem nas demais seções.
        </p>}
      </article>}
      <article className="ruido-dossie-section p-4 sm:p-6 min-w-0">
        <h3 className="font-heavy text-2xl uppercase text-ink">EMENDAS PARLAMENTARES</h3>
        <p className="font-mono text-xs text-ink/80 mb-4">
          Valores empenhados e pagos registrados em fontes legislativas ou na CGU.
          Autoria coletiva e apoiamentos não são atribuídos individualmente sem identificação oficial.
          O pagamento não deve ser confundido com autorização ou indicação.
        </p>
        {emendas.length ? <ul className="space-y-2">
          {emendas.slice(0,10).map((e,i)=><li className="ruido-dossie-row py-3 font-mono text-xs text-ink" key={e.codigo+"-"+i}>
            <b>{e.ano} • {e.numero||e.codigo} • {e.tipo}</b>
            <p className="my-1">Autor informado: {e.autor}</p>
            {e.localidade?<p className="my-1 text-ink/70">Destino/localidade: {e.localidade}</p>:null}
            <div className="flex flex-wrap gap-2 justify-between">
              <span>Empenhado: {real(e.valorEmpenhado)}</span><span>Pago: {real(e.valorPago)}</span>
            </div>
            <Source url={e.fonte} label="CONFERIR EMENDA"/>
          </li>)}
        </ul>:
          <p className="ruido-empty-inline font-mono text-sm text-ink">
            Sem emenda individual atribuída e validada neste recorte. Dados de bancada,
            comissão ou apoio podem não estar incluídos.
          </p>}
      </article>
      <article className="ruido-dossie-section p-4 sm:p-6 min-w-0">
        <h3 className="font-heavy text-2xl uppercase text-ink">FORNECEDORES DOCUMENTADOS</h3>
        <p className="font-mono text-xs text-ink/80 mb-4">
          Empresas com CNPJ validado nos registros oficiais da CEAP da Câmara,
          CEAPS do Senado ou despesas contratadas de campanha do TSE.
          Pessoas físicas são omitidas. Valores não significam irregularidade.
          São mostrados os maiores registros disponíveis.
        </p>
        {todosFornecedores.length||campaignSuppliers.length ? <>
          {fornecedores.slice(0,8).map((f,i)=><div className="ruido-dossie-row py-2 font-mono text-xs text-ink" key={"g"+i}>
            <strong>{f.nome}</strong><p>CEAP {f.ano} • CNPJ {f.cnpj} • {real(f.valor)}</p>
            <Source url={f.fonte||""} label="FONTE CÂMARA"/>
          </div>)}
          {fornecedoresSenado.slice(0,8).map((f,i)=><div
            className="ruido-dossie-row py-2 font-mono text-xs text-ink" key={"s"+i}>
            <strong>{f.nome}</strong>
            <p>CEAPS {f.ano}: {real(f.valor)}</p>
            <p>CNPJ {f.cnpj}</p>
            <Source url={f.fonte||""} label="FONTE SENADO"/>
          </div>)}
          {campaignSuppliers.slice(0,8).map((f,i)=><div className="ruido-dossie-row py-2 font-mono text-xs text-ink" key={"c"+i}>
            <strong>{f.nome}</strong><p>Campanha {f.ano} • CNPJ {f.cnpj} • {real(f.valor)}</p>
            <Source url={f.fonte||""} label="FONTE TSE"/>
          </div>)}
        </>:
          <p className="ruido-empty-inline font-mono text-sm text-ink">
            Nenhuma despesa de fornecedor PJ foi identificada e validada nos arquivos cobertos.
            Isso não significa inexistência de despesas.
          </p>}
      </article>
      <article className="ruido-dossie-section p-4 sm:p-6 min-w-0">
        <h3 className="font-heavy text-2xl uppercase text-ink">COINCIDÊNCIAS POR CNPJ</h3>
        <p className="font-mono text-xs text-ink/80 mb-4">
          Mesmo CNPJ aparece como fornecedor de campanha e de CEAP ou CEAPS. Trata-se de
          coincidência documental, nunca indicação automática de conflito de interesses.
        </p>
        {coincidencias.length ? coincidencias.map((c,i)=><div className="ruido-dossie-row py-3 font-mono text-xs text-ink" key={c.cnpj+"-"+i}>
          <strong className="break-words">{c.nomeFornecedor}</strong><p>CNPJ {c.cnpj}</p>
          <p className="my-1">Campanha {c.anoCampanha}: {real(c.valorContratadoCampanha)}</p>
          <p>CEAP/CEAPS {c.anoGabinete}: {real(c.valorCEAP)}</p>
          <div className="flex flex-wrap gap-2">
            <Source url={c.fonteCampanha} label="VER TSE"/>
            <Source url={c.fonteCEAP} label="VER CÂMARA"/>
          </div>
        </div>):
          <p className="ruido-empty-inline font-mono text-sm text-ink">
            Nenhuma coincidência entre CNPJs verificados no recorte disponível.
            Isso não constitui certidão de ausência de vínculos.
          </p>}
      </article>
    </div>
    <p className="ruido-dossie-note font-mono text-xs text-paper">
      Dados provenientes do TSE, Câmara, Senado e registros de emendas. Cobertura parcial e sujeita
      a atualizações, retificações e limites de acesso. A coincidência de fornecedores
      não demonstra irregularidade, benefício pessoal nem crime.
      {data.atualizadoEm ? " Atualizado em "+data.atualizadoEm.slice(0,10)+"." : " Novas informações serão exibidas quando estiverem disponíveis."}
    </p>
  </section>
}
