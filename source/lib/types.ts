// lib/types.ts

export const CasaLegislativa = {
  CAMARA: "CAMARA",
  SENADO: "SENADO",
} as const;

export type CasaLegislativa =
  (typeof CasaLegislativa)[keyof typeof CasaLegislativa];

export const OpcaoVoto = {
  SIM: "SIM",
  NAO: "NAO",
  ABSTENCAO: "ABSTENCAO",
  OBSTRUCAO: "OBSTRUCAO",
  AUSENTE: "AUSENTE",
  ARTIGO_17: "ARTIGO_17",
} as const;

// Códigos não reconhecidos são preservados literalmente, nunca convertidos em ausência.
export type OpcaoVoto = (typeof OpcaoVoto)[keyof typeof OpcaoVoto] | (string & {});

export const StatusPresenca = {
  PRESENTE: "PRESENTE",
  AUSENTE: "AUSENTE",
  JUSTIFICADO: "JUSTIFICADO",
} as const;

export type StatusPresenca =
  (typeof StatusPresenca)[keyof typeof StatusPresenca];

export const CoberturaVotacao = {
  NOMINAL_PUBLICA: "NOMINAL_PUBLICA",
  SECRETA_AGREGADA: "SECRETA_AGREGADA",
  SEM_VOTOS_NOMINAIS: "SEM_VOTOS_NOMINAIS",
  PLACAR_AGREGADO: "PLACAR_AGREGADO",
  DADOS_PARCIAIS: "DADOS_PARCIAIS",
  EM_IMPORTACAO: "EM_IMPORTACAO",
} as const;
export type CoberturaVotacao =
  (typeof CoberturaVotacao)[keyof typeof CoberturaVotacao];

export const OrigemPresenca = {
  EVENTO_CAMARA: "EVENTO_CAMARA",
  VOTO_SENADO: "VOTO_SENADO",
} as const;
export type OrigemPresenca =
  (typeof OrigemPresenca)[keyof typeof OrigemPresenca];

export const CoberturaPresenca = {
  EVIDENCIA_PARCIAL: "EVIDENCIA_PARCIAL",
  CHAMADA_OFICIAL: "CHAMADA_OFICIAL",
} as const;
export type CoberturaPresenca =
  (typeof CoberturaPresenca)[keyof typeof CoberturaPresenca];

export const StatusSync = {
  EM_ANDAMENTO: "EM_ANDAMENTO",
  SUCESSO: "SUCESSO",
  ERRO: "ERRO",
} as const;
export type StatusSync = (typeof StatusSync)[keyof typeof StatusSync];

export const TipoEmenda = {
  INDIVIDUAL: "INDIVIDUAL",
  BANCADA: "BANCADA",
  RELATOR: "RELATOR",
  TRANSFERENCIA_ESPECIAL: "TRANSFERENCIA_ESPECIAL",
} as const;
export type TipoEmenda = (typeof TipoEmenda)[keyof typeof TipoEmenda];

export const StatusEmenda = {
  PAGO: "PAGO",
  EMPENHADO: "EMPENHADO",
  LIQUIDADO: "LIQUIDADO",
  CANCELADO: "CANCELADO",
} as const;
export type StatusEmenda = (typeof StatusEmenda)[keyof typeof StatusEmenda];

export interface EmendaItem {
  id: string;
  parlamentarId: string | null;
  autorOriginal?: string | null;
  numeroEmenda?: string | null;
  localidadeOriginal?: string | null;
  codigoEmenda?: string | null;
  ano: number;
  tipo: TipoEmenda | string;
  descricao?: string | null;
  valorEmpenhado: number;
  valorPago: number;
  municipioBeneficiado?: string | null;
  ufBeneficiada?: string | null;
  funcao?: string | null;
  status: StatusEmenda | string;
  fonte: string;
  parlamentar?: {
    id: string;
    nome: string;
    partido: string;
    uf: string;
    casa: string;
    urlFoto: string | null;
  };
}

export interface BemDeclaradoItem {
  id: string;
  parlamentarId: string;
  anoEleicao: number;
  tipoBem: string;
  descricao?: string | null;
  valorDeclarado: number;
  totalPatrimonioAno?: number | null;
}

export interface DiscursoItem {
  id: string;
  parlamentarId: string;
  externalId?: string | null;
  dataHora: string | Date;
  faseEvento?: string | null;
  sumario?: string | null;
  transcricao: string;
  analisadoPorIA: boolean;
  urlAudio?: string | null;
  urlVideo?: string | null;
}

export interface ResumoIAItem {
  id: string;
  parlamentarId: string;
  keywords: string[]; // parsed from JSON array
  resumo: string;
  modeloUsado: string;
  geradoEm: string | Date;
}

export interface ParametrosSincronizacao {
  dataInicio: string; // YYYY-MM-DD
  dataFim: string; // YYYY-MM-DD
  limiteVotacoesCamara?: number;
  limiteEventosCamara?: number;
}

export interface RelatorioSincronizacao {
  iniciadoEm: string;
  finalizadoEm: string;
  periodo: { dataInicio: string; dataFim: string };
  camara: {
    parlamentares: number;
    votacoes: number;
    votos: number;
    presencas: number;
  };
  senado: {
    parlamentares: number;
    votacoes: number;
    votos: number;
    presencas: number;
  };
}

