import { createHash, timingSafeEqual } from "node:crypto";

export function autorizarCron(header: string | null, secret: string | undefined): boolean {
  if (!secret || secret.length < 32 || !header) return false;
  const hash = (value: string) => createHash("sha256").update(value).digest();
  return timingSafeEqual(hash(header), hash(`Bearer ${secret}`));
}

export function lerDiasSincronizacao(value: string | null): number {
  if (value === null) return 3;
  if (!/^[0-9]+$/.test(value)) throw new Error("dias deve ser um inteiro entre 1 e 15.");
  const dias = Number(value);
  if (!Number.isSafeInteger(dias) || dias < 1 || dias > 15) {
    throw new Error("dias deve ser um inteiro entre 1 e 15.");
  }
  return dias;
}
