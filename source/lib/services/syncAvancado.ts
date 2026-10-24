import { prisma } from "@/lib/prisma";
import { camaraApiClient } from "@/lib/services/apiClient";
import { TipoEmenda, StatusEmenda } from "@/lib/types";
import { normalizarTexto } from "@/lib/utils";

export interface OpcoesSincronizacaoEmendas {
  ano?: number; anos?: number[]; apiKey?: string; limite?: number; mandatoCompleto?: boolean;
}
export interface OpcoesSincronizacaoDiscursos {
  limiteParlamentares?: number; dataInicio?: string; dataFim?: string; idsParlamentares?: string[];
}
export interface OpcoesSincronizacaoPatrimonio {
  anos?: number[]; idsParlamentares?: string[]; limite?: number;
}
export interface OpcoesSincronizacaoPresencasMandato {
  dataInicio?: string; dataFim?: string; idsParlamentares?: string[]; limiteSessoesPorAno?: number;
}
export function converterValorMonetario(valor: string | number | null | undefined): number {
  if (valor === null || valor === undefined) return 0;
  if (typeof valor === "number") return isNaN(valor) ? 0 : valor;
  const num = parseFloat(valor.toString().replace(/\./g, "").replace(",", ".").trim());
  return isNaN(num) ? 0 : num;
}
export function normalizarTipoEmenda(tipoBruto?: string | null): TipoEmenda {
  const t = normalizarTexto(tipoBruto || "");
  if (t.includes("especial") || t.includes("pix")) return TipoEmenda.TRANSFERENCIA_ESPECIAL;
  if (t.includes("bancada")) return TipoEmenda.BANCADA;
  if (t.includes("relator") || t.includes("rp9")) return TipoEmenda.RELATOR;
  return TipoEmenda.INDIVIDUAL;
}
export function normalizarStatusEmenda(statusBruto?: string | null): StatusEmenda {
  const s = normalizarTexto(statusBruto || "");
  if (s.includes("pago") || s.includes("concluid")) return StatusEmenda.PAGO;
  if (s.includes("liquid")) return StatusEmenda.LIQUIDADO;
  if (s.includes("cancel")) return StatusEmenda.CANCELADO;
  return StatusEmenda.EMPENHADO;
}

export async function sincronizarEmendas(_options: OpcoesSincronizacaoEmendas = {}): Promise<{ totalSincronizadas: number; fonteUtilizada: string }> {
  throw new Error("Emendas indisponíveis: importador oficial com identificação de autor e paginação ainda não implementado. Nenhum dado foi gerado.");
}
export async function sincronizarPatrimonioTSE(_options: OpcoesSincronizacaoPatrimonio = {}): Promise<{ totalBensRegistrados: number; totalParlamentares: number }> {
  throw new Error("Patrimônio indisponível: importação dos arquivos oficiais TSE e vínculo verificável ao candidato ainda não implementados. Nenhum dado foi gerado.");
}
export async function sincronizarPresencasMandato(_options: OpcoesSincronizacaoPresencasMandato = {}): Promise<{ totalSessoesCriadas: number; totalRegistrosPresenca: number }> {
  throw new Error("Histórico integral de presença indisponível. Use os importadores oficiais por intervalo; nunca inferir faltas ou justificativas.");
}

/** Bounded speech sample, not a complete historical archive. Only actual transcripts are stored. */
export async function sincronizarDiscursos(options: OpcoesSincronizacaoDiscursos = {}): Promise<{ totalColetados: number; totalParlamentares: number }> {
  const dataFim = options.dataFim || new Date().toISOString().slice(0, 10);
  const dataInicio = options.dataInicio || `${new Date().getFullYear()}-01-01`;
  const parlamentares = await prisma.parlamentar.findMany({
    where: { ativo: true, ...(options.idsParlamentares?.length ? { id: { in: options.idsParlamentares } } : {}) },
    select: { id: true, externalId: true, casa: true, nome: true },
    take: options.limiteParlamentares ?? 40,
  });
  let totalColetados = 0;
  for (const p of parlamentares) {
    try {
      if (p.casa !== "CAMARA") continue;
      const url = `/deputados/${p.externalId}/discursos?dataInicio=${dataInicio}&dataFim=${dataFim}&ordenarPor=dataHoraInicio&ordem=DESC&itens=20`;
      const res = await camaraApiClient.fetchJson<{ dados?: any[] }>(url);
      for (const item of res?.dados ?? []) {
        if (!item.dataHoraInicio || typeof item.transcricao !== "string" || !item.transcricao.trim()) continue;
        const dataHora = new Date(item.dataHoraInicio);
        if (!Number.isFinite(dataHora.getTime()) || dataHora.toISOString().slice(0,10) < dataInicio || dataHora.toISOString().slice(0,10) > dataFim) continue;
        const externalId = `CAMARA-${p.externalId}-${item.dataHoraInicio}`;
        if (await prisma.discurso.findFirst({ where: { parlamentarId: p.id, externalId } })) continue;
        await prisma.discurso.create({ data: {
          parlamentarId: p.id, externalId, dataHora,
          faseEvento: item.faseEvento?.titulo || item.tipoDiscurso || null,
          sumario: item.sumario || null, transcricao: item.transcricao,
          urlAudio: item.urlAudio || null, urlVideo: item.urlVideo || null, analisadoPorIA: false,
        } });
        totalColetados++;
      }
    } catch (err) {
      console.warn(`[SyncDiscursos] Falha para ${p.nome}:`, err instanceof Error ? err.message : err);
    }
  }
  return { totalColetados, totalParlamentares: parlamentares.length };
}
