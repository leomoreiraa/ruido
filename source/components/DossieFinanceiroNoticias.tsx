/** Seção estática gerada no build; o navegador nunca recebe chave de API. */
import fs from "node:fs";
import path from "node:path";

type FinanceYear = { tipo: "CEAP" | "CEAPS"; valor: number; fonte: string; coletadoEm: string; casa: string };
type Entry = {
  id: string; resumo: string; situacao: "NOTICIA" | "CITADO";
  atualizadoEm: string; ultimaConferencia: string;
  nivel?: "FONTE_UNICA" | "CORROBORADA" | "DOCUMENTO_OFICIAL";
  checagens?: { url:string; titulo:string; veiculo:string; avaliacao:string; afirmacao:string }[];
  fontes: { url: string; titulo: string; publicadoEm: string; grupoEditorial: string }[];
};
type FinancialStore = { version: number; atualizadoEm: string|null; dados: Record<string,Record<string,FinanceYear>> };
type PatrimonyYear = { totalDeclarado:number; quantidadeBens:number; tipo:string; fonte:string; coletadoEm:string; carater:string };
type PatrimonyStore = { version:number; atualizadoEm:string|null; dados:Record<string,Record<string,PatrimonyYear>> };
type Clipagem={url:string;titulo:string;publicadoEm:string;grupoEditorial:string;ultimaConferencia:string};
type NewsStore = { version: number; atualizadoEm: string|null; dados: Record<string,Entry[]>;
  clippings?:Record<string,Clipagem[]> };
type OfficialAiEntry = { texto:string; atualizadoEm:string; fonteHash:string; modelo:string; fontes:string[] };
type OfficialAiStore = { version:number; atualizadoEm:string|null; dados:Record<string,OfficialAiEntry> };
type ProcessoEleitoral = {
  numeroProcesso: string; anoEleicao:number; papel:string;
  situacao:"PARTE_PROCESSUAL_ELEITORAL"; fonte:string; conferidoEm:string; aviso:string;
};
type ElectoralStore = {version:number; atualizadoEm:string|null; dados:Record<string,ProcessoEleitoral[]>};
type JudicialMetadata = { numeroProcesso:string; tribunal:string; classe:string|null; dataAjuizamento:string|null; ultimoMovimentoEm:string|null; conferidoEm:string; fonte:string; aviso:string };
type JudicialStore = {version:number; atualizadoEm:string|null; dados:Record<string,Record<string,JudicialMetadata>>};

function load<T>(file: string, fallback: T): T {
  try {
    const source = fs.readFileSync(path.join(process.cwd(), "public", "data", "dossies", file), "utf8");
    return JSON.parse(source) as T;
  } catch { return fallback; }
}
const expenses = load<FinancialStore>("financeiro.json", {version:1,atualizadoEm:null,dados:{}});
const patrimony = load<PatrimonyStore>("patrimonio.json", {version:1,atualizadoEm:null,dados:{}});
const articles = load<NewsStore>("noticias.json", {version:1,atualizadoEm:null,dados:{}});
const officialAi = load<OfficialAiStore>("analises-oficiais.json", {version:1,atualizadoEm:null,dados:{}});
const electoral = load<ElectoralStore>("processos-eleitorais.json", {version:1,atualizadoEm:null,dados:{}});
const judicial = load<JudicialStore>("datajud.json", {version:1,atualizadoEm:null,dados:{}});
const money = new Intl.NumberFormat("pt-BR", {style:"currency",currency:"BRL"});
const resumoSemDuplicacao = (s:string) => s.replace(
  /^Segundo\s+[^,]{1,100},\s*(?=Segundo\s+)/i,""
);
const brDate = (s:string|null|undefined) =>
  s && Number.isFinite(Date.parse(s)) ? new Intl.DateTimeFormat("pt-BR",{dateStyle:"short",timeZone:"America/Sao_Paulo"}).format(new Date(s)) : "sem data";

export function DossieFinanceiroNoticias({
  parlamentarId, nome, casa,
}: { parlamentarId:string; nome:string; casa:string }) {
  const gastos = expenses.dados[parlamentarId] || {};
  const processosEleitorais = (electoral.dados[parlamentarId] || []).filter(p =>
    p.situacao === "PARTE_PROCESSUAL_ELEITORAL" &&
    p.numeroProcesso.length >= 12 && p.numeroProcesso.length <= 25 &&
    p.fonte.startsWith("https://cdn.tse.jus.br/") &&
    Number.isFinite(Date.parse(p.conferidoEm)) &&
    Date.now()-Date.parse(p.conferidoEm) <= 120*24*60*60*1000
  );
  const cnjPorNumero = judicial.dados[parlamentarId] || {};
  const sintese = officialAi.dados[parlamentarId];
  const sinteseValida = !!sintese && sintese.texto.length >= 90 && sintese.texto.length <= 440 &&
    !/<[^>]+>|https?:|www\\./.test(sintese.texto) &&
    sintese.fontes?.length > 0 &&
    sintese.fontes.every(link => typeof link === "string" && link.startsWith("https://"));
  const bens = patrimony.dados[parlamentarId] || {};
  const anosBens = Object.entries(bens)
    .filter(([,v])=>Number.isFinite(v.totalDeclarado) && v.totalDeclarado >= 0 &&
      v.quantidadeBens > 0 && v.fonte.startsWith("https://cdn.tse.jus.br/"))
    .sort(([a],[b])=>Number(b)-Number(a));
  const validade = 180 * 24 * 60 * 60 * 1000;
  const avisoReconferencia = 45 * 24 * 60 * 60 * 1000;
  const noticias = (articles.dados[parlamentarId] || []).filter(x =>
    ["NOTICIA","CITADO"].includes(x.situacao) &&
    x.resumo?.length >= 45 &&
    x.fontes?.length >= 1 &&
    new Set(x.fontes.map(y => y.grupoEditorial)).size === x.fontes.length &&
    (x.nivel === "FONTE_UNICA" ? x.fontes.length===1 :
     x.nivel === "CORROBORADA" || x.nivel === "DOCUMENTO_OFICIAL" ?
       x.fontes.length>=2 : x.fontes.length>=4) &&
    x.fontes.every(f => f.url?.startsWith("https://") && !!f.titulo?.trim() &&
      Number.isFinite(Date.parse(f.publicadoEm))) &&
    Number.isFinite(Date.parse(x.ultimaConferencia)) &&
    Date.now() - Date.parse(x.ultimaConferencia) <= validade
  );
  const clipagens=(articles.clippings?.[parlamentarId]||[]).filter(c=>
    c.url?.startsWith("https://") && !!c.titulo?.trim() &&
    !!c.grupoEditorial?.trim() && Number.isFinite(Date.parse(c.publicadoEm)) &&
    Number.isFinite(Date.parse(c.ultimaConferencia)) &&
    Date.now()-Date.parse(c.ultimaConferencia)<=validade
  ).sort((a,b)=>Date.parse(b.publicadoEm)-Date.parse(a.publicadoEm));
  const urlsResumidas=new Set(noticias.flatMap(x=>x.fontes.map(s=>s.url)));
  const manchetesExtras=clipagens.filter(c=>!urlsResumidas.has(c.url));
  const anos = Object.entries(gastos).filter(([, v])=>
    Number.isFinite(v.valor) && v.valor >= 0 && v.fonte?.startsWith("https://")
  ).sort(([a],[b])=>Number(b)-Number(a));
  return (
    <section className="space-y-5 sm:space-y-6 min-w-0 w-full" aria-labelledby="dossie-civico-heading">
      <div className="border-l-[7px] border-punk-acid bg-ink px-4 sm:px-5 py-4 text-paper min-w-0">
        <h2 id="dossie-civico-heading" className="font-heavy text-3xl sm:text-4xl uppercase">
          DOSSIÊ DE FONTES PÚBLICAS
        </h2>
        <p className="font-mono text-xs sm:text-sm leading-relaxed text-paper/90">
          Despesas oficiais e cobertura jornalística atribuída a fontes de {nome}. Cobertura parcial; os registros
          não indicam, por si, irregularidade ou responsabilidade criminal.
        </p>
      </div>
      {sinteseValida && (
        <article className="ruido-dossie-section border-l-[7px] border-punk-acid p-5 sm:p-6">
          <div className="font-mono text-xs font-bold text-punk-red mb-2">SÍNTESE ASSISTIDA POR IA • FONTES PRIMÁRIAS</div>
          <h3 className="font-heavy text-xl sm:text-2xl uppercase text-ink mb-3">LEITURA DOS REGISTROS OFICIAIS</h3>
          <p className="font-mono text-sm text-ink leading-relaxed">{sintese.texto}</p>
          <p className="font-mono text-xs text-ink/70 mt-3">
            Modelo: {sintese.modelo}. Gerado em {brDate(sintese.atualizadoEm)}.
            Análise limitada à documentação disponível; não verifica irregularidades, processos ou culpa.
          </p>
          <div className="flex flex-wrap gap-2 mt-3">
            {sintese.fontes.slice(0,4).map((fonte,i)=>(
              <a key={fonte} href={fonte} target="_blank" rel="noopener noreferrer"
                className="ruido-dossier-source">DADO OFICIAL {i+1} ↗</a>
            ))}
          </div>
        </article>
      )}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 min-w-0">
        <article className="ruido-dossie-section p-4 sm:p-6 min-w-0" aria-label="Despesas institucionais verificadas">
          <h3 className="font-heavy text-2xl uppercase text-ink">GASTOS COM VERBA PÚBLICA</h3>
          <p className="font-mono text-xs text-ink/80 mb-4">
            {casa === "CAMARA" ? "Cota para Exercício da Atividade Parlamentar (CEAP)" :
              "Cota para Exercício da Atividade Parlamentar (CEAPS)"}. Não equivale a renda pessoal.
          </p>
          {anos.length ? (
            <ul className="space-y-3">
              {anos.map(([ano, v])=>(
                <li key={ano} className="ruido-dossie-row border-l-4 border-punk-red px-3 py-3 font-mono text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <strong className="text-ink">{ano}</strong>
                    <strong className="text-ink">{money.format(v.valor)}</strong>
                  </div>
                  <div className="mt-2 text-xs text-ink/70">
                    Origem: {v.tipo}. Conferido em {brDate(v.coletadoEm)}.
                  </div>
                  <a className="ruido-dossier-source" href={v.fonte} target="_blank" rel="noopener noreferrer">
                    CONFERIR VALORES NA FONTE ↗
                  </a>
                </li>
              ))}
            </ul>
          ) : (
            <p className="ruido-empty-inline text-ink font-mono text-sm">
              Não há valores consolidados verificados na cobertura atual para este perfil.
              Isso não significa ausência de despesas.
            </p>
          )}
          <p className="mt-4 border-t border-ink/20 pt-2 text-xs font-mono text-ink/75">
            Patrimônio pessoal e bens eleitorais declarados são informações distintas
            da verba pública de gabinete.
          </p>
        </article>
        <article className="ruido-dossie-section p-4 sm:p-6 min-w-0" aria-label="Patrimônio declarado à Justiça Eleitoral">
          <h3 className="font-heavy text-2xl uppercase text-ink">PATRIMÔNIO DECLARADO AO TSE</h3>
          <p className="font-mono text-xs text-ink/80 mb-4">
            Bens declarados nas candidaturas eleitorais, quando a identidade é vinculada
            sem ambiguidade. Valores autodeclarados, não avaliações de mercado.
          </p>
          {anosBens.length ? (
            <ul className="space-y-3">
              {anosBens.map(([ano, v])=>(
                <li className="ruido-dossie-row border-l-4 border-punk-acid px-3 py-3 font-mono text-sm" key={ano}>
                  <div className="flex flex-wrap justify-between gap-2">
                    <strong>{ano} • {v.quantidadeBens} bens declarados</strong>
                    <strong>{money.format(v.totalDeclarado)}</strong>
                  </div>
                  <p className="my-2 text-xs text-ink/70">
                    Fonte TSE, coletada em {brDate(v.coletadoEm)}. Não indica renda anual ou irregularidade.
                  </p>
                  <a className="ruido-dossier-source" href={v.fonte} rel="noopener noreferrer" target="_blank">
                    CONSULTAR ARQUIVO OFICIAL ↗
                  </a>
                </li>
              ))}
            </ul>
          ) : (
            <p className="ruido-empty-inline font-mono text-sm text-ink">
              Ainda não há declaração vinculada a este perfil com identidade única.
              Ausência de correspondência não significa patrimônio zero.
            </p>
          )}
        </article>
        <article className="ruido-dossie-section p-6 lg:col-span-2" aria-label="Cobertura jornalística e níveis de evidência">
          <h3 className="font-heavy text-2xl uppercase text-ink">COBERTURA JORNALÍSTICA</h3>
          <p className="font-mono text-xs text-ink/80 mb-4">
            Fonte única significa relato atribuído a um veículo, não confirmação independente.
            Fontes de redações diferentes podem corroborar a mesma notícia, mas não atestam situação judicial.
            Registros sem reconferência há mais de 45 dias recebem aviso de
            histórico. Após 180 dias sem reconferência, deixam de aparecer.
          </p>
          {noticias.length ? (
            <ul className="space-y-5">
              {noticias.map(n=>(
                <li key={n.id} className="ruido-dossie-row border-l-4 border-punk-red px-3 py-3">
                  <span className="inline-block bg-ink text-paper px-2 py-1 text-xs font-mono uppercase">
                    {n.nivel === "FONTE_UNICA" ? "FONTE ÚNICA" :
                     n.nivel === "DOCUMENTO_OFICIAL" ? "DOCUMENTO OFICIAL" :
                     "CORROBORADA"}
                  </span>
                  <p className="my-2 text-ink font-mono text-sm leading-relaxed break-words">{resumoSemDuplicacao(n.resumo)}</p>
                  {Date.now()-Date.parse(n.ultimaConferencia)>avisoReconferencia && (
                    <p className="text-xs font-mono text-ink/80 mt-2">
                      REGISTRO HISTÓRICO SEM RECONFERÊNCIA RECENTE. Consulte a fonte
                      original para verificar correções, atualizações e desdobramentos.
                    </p>
                  )}
                  <div className="font-mono text-xs text-ink/75">Fonte consultada em {brDate(n.ultimaConferencia)}.{" "}
                    {n.fontes.length} {n.fontes.length === 1 ? "reportagem original" : "reportagens originais"}
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {n.fontes.map((fonte,i)=>(
                      <a key={fonte.url} className="ruido-dossier-source"
                        href={fonte.url} target="_blank" rel="noopener noreferrer"
                        aria-label={"Abrir fonte " + (i+1) + ": " + fonte.titulo}>
                        {fonte.grupoEditorial.toUpperCase()} ↗
                      </a>
                    ))}
                  </div>
                  {n.checagens?.length ? (
                    <div className="mt-3 border-l-2 border-punk-acid pl-3 font-mono text-xs text-ink/80">
                      <p>Checagens externas possivelmente relacionadas — não significam validação automática desta reportagem.</p>
                      {n.checagens.map(checagem=>(
                        <a key={checagem.url} className="ruido-dossier-source mr-2"
                          href={checagem.url} target="_blank" rel="noopener noreferrer"
                          title={checagem.afirmacao}>
                          CHECAGEM DE {checagem.veiculo.toUpperCase()} ↗
                        </a>
                      ))}
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : (
            <p className="bg-paper-light px-3 py-3 font-mono text-sm text-ink">
              Ainda não há reportagens originais com identidade e trechos conferidos na cobertura disponível.
              Isso não significa ausência de notícias, processos ou investigações.
            </p>
          )}
        </article>
      </div>
      {manchetesExtras.length>0 && (
        <article className="ruido-dossie-section p-4 sm:p-6 min-w-0"
          aria-label="Índice de reportagens originais vinculadas ao perfil">
          <h3 className="font-heavy text-2xl uppercase text-ink">ARQUIVO DE REPORTAGENS</h3>
          <p className="font-mono text-xs text-ink/80 mb-4">
            Links de reportagens originais cujo texto e identidade foram conferidos
            pelo coletor. Os títulos são atribuídos aos veículos e não representam
            confirmação independente das alegações, nem situação judicial atual.
            Consulte o artigo e eventuais correções antes de tirar conclusões.
          </p>
          <ul className="space-y-3">
            {manchetesExtras.map(c=>(
              <li className="ruido-dossie-row py-3 font-mono text-sm text-ink min-w-0" key={c.url}>
                <a href={c.url} target="_blank" rel="noopener noreferrer"
                  className="ruido-dossier-source font-semibold break-words">
                  {c.titulo} ↗
                </a>
                <p className="text-xs text-ink/70 mt-1">
                  Fonte: {c.grupoEditorial.toUpperCase()}. Publicada em {brDate(c.publicadoEm)}.
                  Conferida em {brDate(c.ultimaConferencia)}.
                </p>
                {Date.now()-Date.parse(c.ultimaConferencia)>avisoReconferencia && (
                  <p className="text-xs text-ink/75 mt-1">
                    ARQUIVO NÃO RECONFERIDO RECENTEMENTE. Verifique atualizações na fonte.
                  </p>
                )}
              </li>
            ))}
          </ul>
        </article>
      )}
      <article className="ruido-dossie-section p-4 sm:p-6 min-w-0" aria-label="Processos eleitorais oficiais com correspondência confirmada">
        <h3 className="font-heavy text-2xl uppercase text-ink">REGISTROS PROCESSUAIS ELEITORAIS</h3>
        <p className="font-mono text-xs text-ink/80 mb-4">
          Processos públicos da Justiça Eleitoral vinculados com identificador de candidatura,
          nome civil, UF e cargo. Constar como parte não implica acusação, irregularidade ou condenação.
        </p>
        {processosEleitorais.length ? (
          <ul className="space-y-3">
            {processosEleitorais.map(p=>(
              <li key={p.numeroProcesso+"-"+p.anoEleicao} className="ruido-dossie-row border-l-4 border-ink p-3 font-mono text-xs text-ink">
                <div className="font-bold text-sm break-all">PROCESSO {p.numeroProcesso}</div>
                <p className="my-2">Pleito {p.anoEleicao} • papel registrado: {p.papel}.</p>
                <p className="text-ink/80">
                  Confirmado no TSE em {brDate(p.conferidoEm)}. Este registro não classifica
                  a pessoa como ré, investigada ou condenada.
                </p>
                {cnjPorNumero[p.numeroProcesso] && (
                  <div className="my-2 border-l-4 border-punk-acid p-3 text-ink">
                    <strong>METADADOS CNJ / {cnjPorNumero[p.numeroProcesso].tribunal}</strong>
                    <p>Classe cadastrada: {cnjPorNumero[p.numeroProcesso].classe || "não informada"}.</p>
                    <p>Última movimentação registrada: {brDate(cnjPorNumero[p.numeroProcesso].ultimoMovimentoEm)}.</p>
                    <p className="text-[11px]">Conferido em {brDate(cnjPorNumero[p.numeroProcesso].conferidoEm)}. Metadados não comprovam culpa ou condição processual individual.</p>
                    <a className="ruido-dossier-source" href={cnjPorNumero[p.numeroProcesso].fonte}
                      target="_blank" rel="noopener noreferrer">API PÚBLICA CNJ ↗</a>
                  </div>
                )}
                <a className="ruido-dossier-source" href={p.fonte}
                  target="_blank" rel="noopener noreferrer">VER CONJUNTO OFICIAL TSE ↗</a>
              </li>
            ))}
          </ul>
        ) : (
          <p className="ruido-empty-inline font-mono text-sm text-ink">
            Nenhum vínculo processual eleitoral foi identificado com os critérios exigidos
            nos arquivos disponíveis. Isso não significa ausência de processos.
          </p>
        )}
      </article>
      <aside className="ruido-dossie-note text-paper font-mono text-xs leading-relaxed">
        <strong>PROCESSOS JUDICIAIS E ASSOCIAÇÕES:</strong> nenhuma classificação como investigado,
        réu ou condenado é publicada sem documento original do órgão competente.
        Ser citado ao lado de outra pessoa, em uma foto ou reportagem, não constitui acusação.
        Confira sempre o andamento atual do processo na fonte oficial.
      </aside>
    </section>
  );
}
