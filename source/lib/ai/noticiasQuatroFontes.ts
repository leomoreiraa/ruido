/**
 * Política editorial do RUÍDO — validação conservadora de notícias sobre
 * parlamentares. Função PURA usada como última barreira antes de publicar.
 *
 * O coletor precisa obter textos diretamente das páginas acessadas. A IA
 * pode propor eventos e passagens, mas nunca desativar esta verificação.
 * Não persistir o texto integral das reportagens no HTML/JSON exportado.
 */
import { createHash } from "node:crypto";

export const FONTES_INDEPENDENTES_MINIMAS = 2 as const;
export type NivelEvidencia = "FONTE_UNICA" | "CORROBORADA" | "DOCUMENTO_OFICIAL";
export type SituacaoDocumentada =
  | "NOTICIA" | "CITADO" | "INVESTIGADO" | "DENUNCIADO"
  | "REU" | "CONDENADO" | "ABSOLVIDO" | "ARQUIVADO";

/** Sem grupo editorial conhecido, o candidato é mantido na triagem,
 * nunca considerado automaticamente uma fonte independente. */
const GRUPOS_VERIFICADOS: Readonly<Record<string, string>> = Object.freeze({
  "g1.globo.com": "grupo-globo",
  "oglobo.globo.com": "grupo-globo",
  "valor.globo.com": "grupo-globo",
  "globonews.globo.com": "grupo-globo",
  "folha.uol.com.br": "grupo-folha",
  "uol.com.br": "grupo-folha",
  "noticias.uol.com.br": "grupo-folha",
  "estadao.com.br": "grupo-estado",
  "www.estadao.com.br": "grupo-estado",
  "cnnbrasil.com.br": "cnn-brasil",
  "metropoles.com": "metropoles",
  "poder360.com.br": "poder360",
  "cartacapital.com.br": "carta-capital",
  "brasildefato.com.br": "brasil-de-fato",
  "veja.abril.com.br": "grupo-abril",
  "bbc.com": "bbc",
  "www.bbc.com": "bbc",
  "reuters.com": "reuters",
  "www.reuters.com": "reuters",
  "apnews.com": "associated-press",
  "www.apnews.com": "associated-press",
  "correiobraziliense.com.br": "diarios-associados",
  "gazetadopovo.com.br": "gazeta-povo",
  "www.gazetadopovo.com.br": "gazeta-povo",
  "oantagonista.com.br": "antagonista",
  "www.oantagonista.com.br": "antagonista",
  "r7.com": "record",
  "noticias.r7.com": "record",
});

/** Dados transitórios de auditoria: textoAcessado NÃO é persistido. */
export interface EvidenciaJornalistica {
  url: string;
  titulo: string;
  publicadoEm: string;
  textoAcessado: string;
  excertoDaAfirmacao: string; // cópia fiel de trecho que sustenta a afirmação
  parlamentarIdConfirmado: string;
  identidadeConfirmadaPorContexto: boolean; // não basta homônimo
  idReportagemOriginal: string; // id/URL da matéria originária
  republicacaoOuAgencia: boolean;
}
export interface DocumentoPrimario {
  url: string;
  numeroOuIdentificador: string;
  situacaoComprovada: SituacaoDocumentada;
  conferidoNoOriginal: boolean;
  parlamentarIdConfirmado: string;
  conferidoEm: string;
}
export interface AlegacaoVerificavel {
  parlamentarId: string;
  eventoId: string;
  resumo: string;
  situacao: SituacaoDocumentada;
  evidencias: EvidenciaJornalistica[];
  documentoOficial?: DocumentoPrimario;
}
export interface FonteAprovada {
  url: string;
  titulo: string;
  publicadoEm: string;
  grupoEditorial: string;
  idReportagemOriginal: string;
}
export interface AvaliacaoNoticias {
  publicavel: boolean;
  fontesIndependentes: number;
  minimoExigido: 1;
  nivel: NivelEvidencia | null;
  fontesAprovadas: FonteAprovada[];
  motivos: string[];
}
function normalizar(valor: string): string {
  return valor.normalize("NFKC").replace(/\s+/g, " ").trim().toLocaleLowerCase("pt-BR");
}
function urlSegura(url: string): URL | null {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" && !parsed.username && !parsed.password ? parsed : null;
  } catch { return null; }
}
function grupoConhecido(url: URL): string | undefined {
  const host = url.hostname.toLowerCase().replace(/\.$/, "");
  return GRUPOS_VERIFICADOS[host] ?? GRUPOS_VERIFICADOS[host.replace(/^www\./, "")];
}
function hashTexto(texto: string): string {
  return createHash("sha256").update(normalizar(texto)).digest("hex");
}
function exigeDocumentoPrimario(situacao: SituacaoDocumentada): boolean {
  return situacao !== "NOTICIA" && situacao !== "CITADO";
}
function documentoValido(doc: DocumentoPrimario | undefined, item: AlegacaoVerificavel): boolean {
  if (!doc || !doc.conferidoNoOriginal || doc.parlamentarIdConfirmado !== item.parlamentarId ||
      doc.situacaoComprovada !== item.situacao || !doc.numeroOuIdentificador.trim() ||
      !Number.isFinite(Date.parse(doc.conferidoEm))) return false;
  const url = urlSegura(doc.url);
  if (!url) return false;
  const host = url.hostname.toLowerCase();
  // Notícias não comprovam sozinhas o status formal de investigado/réu/condenado.
  return host.endsWith(".jus.br") || host.endsWith(".mp.br") ||
    host === "stf.jus.br" || host === "mpf.mp.br";
}

/** Aprovação técnica da evidência, não juízo de culpa.
 * Alterações, decisões posteriores e direito de resposta precisam ser
 * investigados na etapa de coleta/reverificação antes da publicação. */
export function avaliarCoberturaJornalistica(item: AlegacaoVerificavel): AvaliacaoNoticias {
  const motivos: string[] = [];
  const fontesAprovadas: FonteAprovada[] = [];
  if (!item.parlamentarId.trim() || !item.eventoId.trim() || normalizar(item.resumo).length < 45)
    motivos.push("Evento, identidade e resumo verificável são obrigatórios.");
  const estados: SituacaoDocumentada[] = ["NOTICIA","CITADO","INVESTIGADO","DENUNCIADO","REU","CONDENADO","ABSOLVIDO","ARQUIVADO"];
  if (!estados.includes(item.situacao)) motivos.push("Situação jurídica não reconhecida.");

  const grupos = new Set<string>(), urls = new Set<string>(), origens = new Set<string>(), textos = new Set<string>();
  for (const ev of item.evidencias) {
    const parsed = urlSegura(ev.url);
    if (!parsed || !Number.isFinite(Date.parse(ev.publicadoEm))) continue;
    const grupo = grupoConhecido(parsed);
    if (!grupo || grupos.has(grupo) || ev.republicacaoOuAgencia ||
        !ev.identidadeConfirmadaPorContexto || ev.parlamentarIdConfirmado !== item.parlamentarId) continue;
    const origem = normalizar(ev.idReportagemOriginal);
    const artigo = normalizar(ev.textoAcessado);
    const prova = normalizar(ev.excertoDaAfirmacao);
    const urlCanonica = parsed.origin + parsed.pathname.replace(/\/$/, "");
    if (!origem || prova.length < 30 || artigo.length < 150 ||
        !artigo.includes(prova) || !ev.titulo.trim()) continue;
    const fingerprint = hashTexto(artigo);
    if (urls.has(urlCanonica) || origens.has(origem) || textos.has(fingerprint)) continue;
    grupos.add(grupo); urls.add(urlCanonica); origens.add(origem); textos.add(fingerprint);
    fontesAprovadas.push({
      url: urlCanonica, titulo: ev.titulo.trim(), publicadoEm: ev.publicadoEm,
      grupoEditorial: grupo, idReportagemOriginal: ev.idReportagemOriginal,
    });
  }
  if (!fontesAprovadas.length)
    motivos.push("É exigida ao menos uma reportagem original acessada, com identidade contextual e excerto conferível.");
  if (exigeDocumentoPrimario(item.situacao) && !documentoValido(item.documentoOficial, item))
    motivos.push("Situação processual formal exige documento primário do órgão competente conferido na origem.");
  const nivel: NivelEvidencia | null = motivos.length ? null :
    exigeDocumentoPrimario(item.situacao) ? "DOCUMENTO_OFICIAL" :
    fontesAprovadas.length >= FONTES_INDEPENDENTES_MINIMAS ? "CORROBORADA" : "FONTE_UNICA";
  return {
    publicavel: motivos.length === 0,
    fontesIndependentes: fontesAprovadas.length,
    minimoExigido: 1, nivel,
    fontesAprovadas, motivos,
  };
}

/** Compatibilidade com importadores antigos; a classificação agora é graduada. */
export const avaliarNoticiasQuatroFontes = avaliarCoberturaJornalistica;
