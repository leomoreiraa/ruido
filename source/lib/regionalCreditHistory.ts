export type CreditoMeiObservacao = { data: string; milhoesReais: number; serie: number };
export type HistoricoCreditoMei = Record<string, CreditoMeiObservacao>;

function validarObservacao(ano: string, raw: unknown, serie: number): raw is CreditoMeiObservacao {
  if (!/^\d{4}$/.test(ano) || Number(ano) < 2022 || Number(ano) > new Date().getUTCFullYear()) return false;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return false;
  const obs = raw as Record<string, unknown>;
  if (obs.serie !== serie || typeof obs.milhoesReais !== "number" ||
      !Number.isFinite(obs.milhoesReais) || obs.milhoesReais < 0 || typeof obs.data !== "string") return false;
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(obs.data);
  if (!match || match[3] !== ano) return false;
  const dia = Number(match[1]);
  const mes = Number(match[2]);
  const anoNumero = Number(match[3]);
  const data = new Date(Date.UTC(anoNumero, mes - 1, dia));
  return data.getUTCFullYear() === anoNumero && data.getUTCMonth() === mes - 1 && data.getUTCDate() === dia;
}

function chaveData(data: string): string {
  return data.slice(6, 10) + data.slice(3, 5) + data.slice(0, 2);
}

export function mesclarHistoricoCreditoMei(serie: number, ...fontes: unknown[]): HistoricoCreditoMei {
  const resultado: HistoricoCreditoMei = {};
  for (const fonte of fontes) {
    if (!fonte || typeof fonte !== "object" || Array.isArray(fonte)) continue;
    for (const [ano, raw] of Object.entries(fonte)) {
      if (!validarObservacao(ano, raw, serie)) continue;
      const anterior = resultado[ano];
      if (!anterior || chaveData(raw.data) >= chaveData(anterior.data)) {
        resultado[ano] = { data: raw.data, milhoesReais: raw.milhoesReais, serie };
      }
    }
  }
  return resultado;
}
