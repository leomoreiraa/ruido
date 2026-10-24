import { OpcaoVoto, StatusPresenca } from "@/lib/types";

export interface SenadoVotoItemContract {
  codigoParlamentar?: number | string | null;
  nomeParlamentar?: string | null;
  siglaPartidoParlamentar?: string | null;
  siglaUFParlamentar?: string | null;
  siglaVotoParlamentar?: string | null;
  descricaoVotoParlamentar?: string | null;
  sexoParlamentar?: string | null;
}

export interface SenadoVotacaoFlatContract {
  ano?: number | null;
  casaSessao?: string | null; // "SF" ou "CN"
  codigoMateria?: number | string | null;
  codigoSessao?: number | string | null;
  codigoSessaoVotacao: number | string;
  dataSessao?: string | null;
  descricaoVotacao?: string | null;
  ementa?: string | null;
  idProcesso?: number | string | null;
  identificacao?: string | null;
  numero?: string | number | null;
  resultadoVotacao?: string | null; // "A" | "R" | outros
  sigla?: string | null;
  totalVotosSim?: number | null;
  totalVotosNao?: number | null;
  totalVotosAbstencao?: number | null;
  votacaoSecreta?: string | boolean | null; // "S" | "N"
  votos?: SenadoVotoItemContract[] | null;
}

export function validarItemVotacaoSenado(item: unknown): asserts item is SenadoVotacaoFlatContract {
  if (!item || typeof item !== "object") {
    throw new Error("Formato inválido na resposta do Senado: item não é um objeto");
  }
  const obj = item as Record<string, unknown>;
  if (obj.codigoSessaoVotacao === undefined || obj.codigoSessaoVotacao === null) {
    throw new Error("Formato inválido na resposta do Senado: 'codigoSessaoVotacao' ausente");
  }
}

/**
 * Normaliza o voto do Senado preservando códigos originais não padronizados.
 * Nunca converte códigos desconhecidos para AUSENTE.
 * P-NRV: Presente - Não registrou voto (não ausência)
 * AP: Atividade parlamentar (justificado)
 * LS: Licença saúde (justificado)
 * MIS: Missão oficial (justificado)
 * Presidente (art. 51 RISF): Presidência (Artigo 17)
 */
export function normalizarVotoSenado(siglaBruta?: string | null): {
  opcaoNormalizada: OpcaoVoto;
  siglaOriginal: string | null;
} {
  if (!siglaBruta || siglaBruta.trim() === "") {
    return { opcaoNormalizada: "NAO_INFORMADO", siglaOriginal: null };
  }

  const trimmed = siglaBruta.trim();
  const normalizado = trimmed
    .toUpperCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");

  if (normalizado === "SIM" || normalizado === "YES") {
    return { opcaoNormalizada: OpcaoVoto.SIM, siglaOriginal: trimmed };
  }
  if (normalizado === "NAO" || normalizado === "NO") {
    return { opcaoNormalizada: OpcaoVoto.NAO, siglaOriginal: trimmed };
  }
  if (normalizado.includes("ABSTEN")) {
    return { opcaoNormalizada: OpcaoVoto.ABSTENCAO, siglaOriginal: trimmed };
  }
  if (normalizado.includes("OBSTRU")) {
    return { opcaoNormalizada: OpcaoVoto.OBSTRUCAO, siglaOriginal: trimmed };
  }
  if (normalizado.includes("PRESIDENTE") || normalizado.includes("ART")) {
    return { opcaoNormalizada: OpcaoVoto.ARTIGO_17, siglaOriginal: trimmed };
  }
  if (normalizado === "P-NRV" || normalizado.includes("NAO REGISTROU VOTO")) {
    return { opcaoNormalizada: "PRESENTE_SEM_VOTO", siglaOriginal: trimmed };
  }
  if (
    normalizado === "AP" ||
    normalizado === "LS" ||
    normalizado === "MIS" ||
    normalizado === "LP"
  ) {
    return { opcaoNormalizada: "LICENCA_OU_MISSAO", siglaOriginal: trimmed };
  }

  return { opcaoNormalizada: trimmed, siglaOriginal: trimmed };
}

/**
 * Deriva evidência de presença a partir do registro de votação do Senado.
 * No Senado, não existe endpoint público completo de chamada nominal para todas as sessões;
 * a presença é derivada a partir das votações nominais.
 * Se o parlamentar compareceu ou votou ou foi presidente ou P-NRV => PRESENTE.
 * Se teve AP, LS, MIS => JUSTIFICADO.
 * Se o nome sequer consta na votação => nenhuma inferência é feita (sem ausência inventada).
 */
export function classificarEvidenciaPresencaSenado(
  siglaVoto?: string | null,
  descricaoVoto?: string | null
): { status: StatusPresenca; justificativa: string | null } | null {
  if (!siglaVoto || siglaVoto.trim() === "") {
    return null;
  }

  const v = siglaVoto.trim().toUpperCase();
  const desc = descricaoVoto?.trim() || null;

  if (v.includes("PRESIDENTE") || v.includes("ART.")) {
    return { status: StatusPresenca.PRESENTE, justificativa: "Presidência da Sessão" };
  }

  if (v === "P-NRV" || v.includes("PRESENTE")) {
    return {
      status: StatusPresenca.PRESENTE,
      justificativa: desc ?? "Presente em plenário (não registrou voto)",
    };
  }

  if (
    v === "SIM" ||
    v === "NÃO" ||
    v === "NAO" ||
    v.includes("ABSTEN") ||
    v.includes("OBSTRU")
  ) {
    return { status: StatusPresenca.PRESENTE, justificativa: null };
  }

  if (v === "NCOM") {
    return { status: StatusPresenca.AUSENTE, justificativa: desc ?? "Não compareceu" };
  }

  if (v === "AP" || v === "LS" || v === "MIS" || v === "LP") {
    return {
      status: StatusPresenca.JUSTIFICADO,
      justificativa: desc ? `${desc} (${v})` : `Ausência autorizada (${v})`,
    };
  }

  return null;
}
