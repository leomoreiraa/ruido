import { createHash } from "node:crypto";

export const AI_MODEL = "gemini-3.5-flash-lite";
export const AI_PROMPT_VERSION = "ruido-cidadao-v1";
export type ExplicacaoCidada = { titulo: string; resumo: string; explicacao: string };

export function fonteHash(p: { casa: string; externalId: string; ementa: string }, modelo = AI_MODEL) {
  return createHash("sha256").update(JSON.stringify({
    versao: AI_PROMPT_VERSION, modelo,
    casa: p.casa, id: p.externalId, ementa: p.ementa,
  })).digest("hex");
}

export function validarExplicacao(valor: unknown): ExplicacaoCidada {
  if (!valor || typeof valor !== "object" || Array.isArray(valor))
    throw new Error("Resposta da IA fora do formato esperado");
  const data = valor as Record<string, unknown>;
  const fields = [["titulo", 15, 150], ["resumo", 40, 440], ["explicacao", 70, 2000]] as const;
  const safe: Record<string, string> = {};
  for (const [campo, min, max] of fields) {
    if (typeof data[campo] !== "string") throw new Error("Campo de IA ausente: " + campo);
    const value = (data[campo] as string).trim().replace(/\s+/g, " ");
    if (value.length < min || value.length > max)
      throw new Error("Tamanho de texto inválido: " + campo);
    if (/<[^>]+>|https?:\/\/|www\.|[\u0060]{3}|GEMINI_API_KEY/i.test(value))
      throw new Error("Conteúdo potencialmente inseguro no campo: " + campo);
    safe[campo] = value;
  }
  return safe as ExplicacaoCidada;
}


/** Segunda barreira, também aplicada aos resumos históricos antes do export.
 * Um andamento/voto sobre a proposta não é a ementa do projeto.
 * Heurística conservadora: na dúvida preserva-se o texto oficial. */
export function explicacaoFielAoObjeto(ementa: string, valor: ExplicacaoCidada | null | undefined): boolean {
  if (!valor || !ementa || valor.titulo.length > 110 ||
      valor.resumo.length > 350 || valor.explicacao.length > 1200) return false;
  const norm = (s: string) => s.normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const source = norm(ementa);
  const summary = norm(valor.resumo);
  const explanation = norm(valor.explicacao);
  const unsupported = ["aprovad", "rejeitad", "sancionad", "promulgad",
    "unanimid", "urgencia", "condenad", "absolvid", "entrou em vigor"];
  if (unsupported.some(word =>
    (summary.includes(word) || explanation.includes(word)) && !source.includes(word))) return false;
  const stop = new Set(["sobre","dispõe","dispoe","altera","cria","institui",
    "projeto","proposta","federal","nacional","outras","providencias","paragrafo",
    "artigo","artigos","redacao","determinadas","estabelece","forma","desta",
    "deste","dessa","desse","para","pela","pelas","pelos","entre","todos",
    "todas","nova","novas","novos","aplicacao","medidas","politica","lei"]);
  const words = (s: string) => new Set((norm(s).match(/[a-z]{5,}/g) || [])
    .filter(w => !stop.has(w)));
  const subject = words(ementa);
  if (subject.size < 2) return false;
  const result = words(valor.resumo);
  const shared = [...subject].filter(w => result.has(w)).length;
  return shared >= 2;
}
