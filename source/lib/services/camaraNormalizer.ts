// lib/services/camaraNormalizer.ts
import { OpcaoVoto } from "@/lib/types";

export interface CamaraDeputadoContract {
  id: number;
  uri?: string;
  nome: string;
  siglaPartido?: string;
  uriPartido?: string;
  siglaUf?: string;
  idLegislatura?: number;
  urlFoto?: string;
  email?: string;
}

export interface CamaraVotacaoResumoContract {
  id: string;
  uri?: string;
  data: string;
  dataHoraRegistro?: string;
  siglaOrgao?: string;
  uriOrgao?: string;
  uriEvento?: string;
  proposicaoObjeto?: unknown;
  descricao: string;
  aprovacao?: number | null;
  votosSim?: number | null;
  votosNao?: number | null;
  votosOutros?: number | null;
}

export interface CamaraProposicaoRefContract {
  id: number;
  uri?: string;
  siglaTipo: string;
  numero: number;
  ano: number;
  ementa?: string;
  dataApresentacao?: string;
}

export interface CamaraVotacaoDetalheContract {
  id: string;
  data: string;
  dataHoraRegistro?: string;
  siglaOrgao?: string;
  descricao: string;
  aprovacao?: number | null;
  votosSim?: number | null;
  votosNao?: number | null;
  votosOutros?: number | null;
  uriEvento?: string;
  idEvento?: number;
  ultimaApresentacaoProposicao?: {
    descricao?: string;
    uriProposicaoCitada?: string;
  };
  proposicoesAfetadas?: CamaraProposicaoRefContract[];
  objetosPossiveis?: CamaraProposicaoRefContract[];
}

export interface CamaraVotoNominalContract {
  tipoVoto?: string | null;
  dataRegistroVoto?: string | null;
  deputado_?: {
    id: number;
    nome: string;
    siglaPartido?: string;
    siglaUf?: string;
    urlFoto?: string;
    email?: string;
  };
}

export interface CamaraEventoContract {
  id: number;
  uri?: string;
  dataHoraInicio: string;
  dataHoraFim?: string;
  situacao?: string;
  descricaoTipo?: string;
  descricao?: string;
  urlRegistro?: string;
}

export function validarRespostaEnvelopeCamara<T>(
  json: unknown,
  contexto: string
): { dados: T; links?: Array<{ rel: string; href: string }> } {
  if (!json || typeof json !== "object" || !("dados" in json)) {
    throw new Error(
      `Resposta inválida da API da Câmara (${contexto}): propriedade 'dados' ausente.`
    );
  }
  const envelope = json as { dados: T; links?: Array<{ rel: string; href: string }> };
  return envelope;
}

/**
 * Normaliza o voto nominal da Câmara mantendo valores não mapeados de forma literal.
 * Nunca converte códigos desconhecidos para AUSENTE.
 */
export function normalizarVotoCamara(tipoVoto?: string | null): {
  opcaoNormalizada: OpcaoVoto;
  opcaoOriginal: string | null;
} {
  if (!tipoVoto || tipoVoto.trim() === "") {
    return { opcaoNormalizada: "NAO_INFORMADO", opcaoOriginal: null };
  }

  const trimmed = tipoVoto.trim();
  const normalizado = trimmed
    .toUpperCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");

  if (normalizado === "SIM") {
    return { opcaoNormalizada: OpcaoVoto.SIM, opcaoOriginal: trimmed };
  }
  if (normalizado === "NAO") {
    return { opcaoNormalizada: OpcaoVoto.NAO, opcaoOriginal: trimmed };
  }
  if (normalizado.includes("ABSTEN")) {
    return { opcaoNormalizada: OpcaoVoto.ABSTENCAO, opcaoOriginal: trimmed };
  }
  if (normalizado.includes("OBSTRU")) {
    return { opcaoNormalizada: OpcaoVoto.OBSTRUCAO, opcaoOriginal: trimmed };
  }
  if (normalizado.includes("ART") || normalizado.includes("PRESIDENTE")) {
    return { opcaoNormalizada: OpcaoVoto.ARTIGO_17, opcaoOriginal: trimmed };
  }

  // Preserva valor original
  return { opcaoNormalizada: trimmed, opcaoOriginal: trimmed };
}

/** Counts published by the Câmara are aggregate registered votes, not a roll-call of every deputy. */
export function obterContagensCamara(
  resumo: CamaraVotacaoResumoContract, detalhe: CamaraVotacaoDetalheContract | null,
  votos: CamaraVotoNominalContract[]
) {
  const count = (v: unknown): number | null =>
    typeof v === "number" && Number.isSafeInteger(v) && v >= 0 ? v : null;
  let sim = 0, nao = 0, abstencao = 0, obstrucao = 0, outros = 0;
  for (const v of votos) {
    if (!v.tipoVoto || !v.deputado_?.id) continue;
    const option = normalizarVotoCamara(v.tipoVoto).opcaoNormalizada;
    if (option === OpcaoVoto.SIM) sim++;
    else if (option === OpcaoVoto.NAO) nao++;
    else if (option === OpcaoVoto.ABSTENCAO) abstencao++;
    else if (option === OpcaoVoto.OBSTRUCAO) obstrucao++;
    else outros++;
  }
  const officialSim = count(detalhe?.votosSim) ?? count(resumo.votosSim);
  const officialNao = count(detalhe?.votosNao) ?? count(resumo.votosNao);
  const officialOutros = count(detalhe?.votosOutros) ?? count(resumo.votosOutros);
  return {
    sim: officialSim ?? sim, nao: officialNao ?? nao,
    abstencao, obstrucao,
    outros: officialOutros === null ? outros : Math.max(0, officialOutros - abstencao - obstrucao),
    agregado: officialSim !== null || officialNao !== null || officialOutros !== null,
  };
}
