/** Protege GDELT contra rajadas de consultas em runners compartilhados. */
export type EstadoGdelt = {
  tentativas: number;
  ultimaTentativa: number; // Unix ms
  pausadoAte: number; // Unix ms
};
export const GDELT_MAX_REQUESTS = 6;
export const GDELT_MIN_INTERVAL_MS = 12_000;
export const GDELT_BACKOFF_MS = 20 * 60_000;

export function planejarConsultaGdelt(
  estado: EstadoGdelt, agora: number,
): {permitida:boolean; esperaMs:number} {
  if (estado.tentativas>=GDELT_MAX_REQUESTS || agora<estado.pausadoAte)
    return {permitida:false,esperaMs:0};
  const esperaMs=estado.tentativas===0 ? 0 :
    Math.max(0,estado.ultimaTentativa+GDELT_MIN_INTERVAL_MS-agora);
  return {permitida:true,esperaMs};
}
export function marcarTentativaGdelt(
  estado: EstadoGdelt, agora: number,
): EstadoGdelt {
  return {...estado,tentativas:estado.tentativas+1,ultimaTentativa:agora};
}
export function registrarLimiteGdelt(
  estado: EstadoGdelt, agora:number, retryAfter: string | null,
): EstadoGdelt {
  let ms = GDELT_BACKOFF_MS;
  if (retryAfter) {
    const parsed=/^\d+$/.test(retryAfter) ? Number(retryAfter)*1000 :
      Date.parse(retryAfter)-agora;
    if (Number.isFinite(parsed)) ms=Math.max(ms,Math.min(parsed,60*60_000));
  }
  return {...estado,pausadoAte:agora+ms};
}
