import { prisma } from "../prisma";
import { acquireSyncLease } from "./syncLock";

const BASE = "https://api.portaldatransparencia.gov.br/api-de-dados/emendas";
const REVISION = 1;
export type PortalEmenda = {
  codigoEmenda?: string | number;
  ano?: number | string;
  tipoEmenda?: string;
  nomeAutor?: string;
  autor?: string;
  numeroEmenda?: string;
  localidadeDoGasto?: string;
  funcao?: string;
  subfuncao?: string;
  valorEmpenhado?: string | number;
  valorLiquidado?: string | number;
  valorPago?: string | number;
};

function stringValue(value: unknown): string {
  return typeof value === "string" ? value.trim() : value == null ? "" : String(value).trim();
}


export function lerValorReais(value: unknown): number {
  if (value == null || value === "") return 0;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error("Valor monetário não finito");
    return value;
  }
  if (typeof value !== "string") throw new Error("Valor monetário inválido");
  const raw = value.trim().replace(/^R\$\s*/, "").replace(/\s/g, "");
  if (!raw) return 0;
  let normalized: string;
  if (/^-?\d{1,3}(\.\d{3})+,\d{1,2}$/.test(raw) || /^-?\d+,\d{1,2}$/.test(raw)) {
    normalized = raw.replace(/\./g, "").replace(",", ".");
  } else if (/^-?\d{1,3}(\.\d{3})+$/.test(raw)) {
    normalized = raw.replace(/\./g, "");
  } else if (/^-?\d+(\.\d{1,2})?$/.test(raw)) {
    normalized = raw;
  } else {
    throw new Error("Formato monetário inesperado: " + raw.slice(0, 30));
  }
  const result = Number(normalized);
  if (!Number.isFinite(result)) throw new Error("Valor monetário fora do intervalo");
  return result;
}

export function classificarTipoEmenda(value: unknown): string {
  const tipo = stringValue(value).toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  if (/TRANSFERENCIA[S]? ESPECIA(IS|L)|EMENDA PIX/.test(tipo)) return "TRANSFERENCIA_ESPECIAL";
  if (/BANCADA/.test(tipo)) return "BANCADA";
  if (/COMISSAO/.test(tipo)) return "COMISSAO";
  if (/RELATOR/.test(tipo)) return "RELATOR";
  if (/INDIVIDUAL/.test(tipo)) return "INDIVIDUAL";
  return "NAO_CLASSIFICADA";
}

export function nomeNormalizado(value: unknown): string {
  return stringValue(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toUpperCase().replace(/^(DEPUTAD[OA](?: FEDERAL)?|SENADOR(?:A)?)\s+/, "")
    .replace(/[^A-Z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
}

export function extrairUF(localidade: unknown): string | null {
  const valor = stringValue(localidade).toUpperCase();
  const m = valor.match(/(?:^|\s|[-/(])([A-Z]{2})\)?$/);
  const uf = m?.[1] ?? (valor.length === 2 ? valor : "");
  return /^(AC|AL|AP|AM|BA|CE|DF|ES|GO|MA|MT|MS|MG|PA|PB|PR|PE|PI|RJ|RN|RS|RO|RR|SC|SP|SE|TO)$/.test(uf) ? uf : null;
}
export function municipioDaLocalidade(localidade: unknown): string | null {
  const raw = stringValue(localidade);
  const m = raw.match(/^(.+?)\s*(?:[-/(]\s*[A-Za-z]{2}\)?)$/);
  return m && m[1].trim() ? m[1].trim() : null;
}

async function paginaDaApi(ano: number, pagina: number, chave: string): Promise<PortalEmenda[]> {
  await new Promise(resolve => setTimeout(resolve, 1200));
  const url = new URL(BASE);
  url.searchParams.set("ano", String(ano));
  url.searchParams.set("pagina", String(pagina));
  for (let tent = 0; tent < 5; tent++) {
    const response = await fetch(url, {
      headers: { "chave-api-dados": chave, "Accept": "application/json" },
      signal: AbortSignal.timeout(45000),
      cache: "no-store",
    });
    if (response.ok) {
      const body: unknown = await response.json();
      if (!Array.isArray(body)) throw new Error("API de emendas retornou JSON que não é uma lista");
      if (body.some(x => !x || typeof x !== "object" || Array.isArray(x))) throw new Error("Emenda com formato inválido");
      return body as PortalEmenda[];
    }
    if ((response.status === 429 || response.status >= 500) && tent < 4) {
      const retry = Number(response.headers.get("Retry-After"));
      await new Promise(r => setTimeout(r, retry > 0 && retry <= 120 ? retry * 1000 : 1300 * (2 ** tent)));
      continue;
    }
    throw new Error("Portal da Transparência respondeu HTTP " + response.status + " na página " + pagina + "/" + ano);
  }
  throw new Error("Tentativas de consulta esgotadas");
}

export interface EmendasOptions {
  inicio: number;
  fim: number;
  paginas: number;
  reprocessar?: boolean;
}

export async function sincronizarEmendasOficiais(options: EmendasOptions) {
  const chave = process.env.PORTAL_TRANSPARENCIA_API_KEY;
  if (!chave) throw new Error("Defina PORTAL_TRANSPARENCIA_API_KEY (segredo do Actions); coleta de emendas não iniciada.");
  const anoAtual = new Date().getUTCFullYear();
  if (![options.inicio, options.fim, options.paginas].every(Number.isInteger) ||
      options.inicio < 2022 || options.fim > anoAtual || options.inicio > options.fim ||
      options.paginas < 1 || options.paginas > 500) throw new Error("Intervalo/quantidade de páginas inválido");

  const lease = await acquireSyncLease("GLOBAL_SYNC", 180000);
  let total = 0, vinculadas = 0, semVinculo = 0, paginasConsultadas = 0, anosCompletos = 0;
  try {
    const pessoas = await prisma.parlamentar.findMany({ select: { id: true, nome: true } });
    const porNome = new Map<string, string | null>();
    for (const p of pessoas) {
      const key = nomeNormalizado(p.nome);
      if (!key) continue;
      if (porNome.has(key)) porNome.set(key, null);
      else porNome.set(key, p.id);
    }

    for (let ano = options.inicio; ano <= options.fim && paginasConsultadas < options.paginas; ano++) {
      const prefix = "history:v1:emendas:" + ano + ":";
      const done = prefix + "complete";
      const complete = await prisma.syncExecution.findUnique({ where: { id: done } });
      if (ano === anoAtual && complete?.status === "SUCESSO" && !options.reprocessar) {
        await prisma.syncExecution.deleteMany({ where: { id: { startsWith: prefix } } });
      }
      if (complete?.status === "SUCESSO" && !options.reprocessar && ano !== anoAtual) {
        anosCompletos++;
        continue;
      }
      const checkpoints = options.reprocessar ? [] : await prisma.syncExecution.findMany({
        where: { id: { startsWith: prefix + "page:" }, status: "SUCESSO" },
        select: { id: true },
      });
      const completePages = new Set(checkpoints.map(c => Number(c.id.split(":").at(-1))));
      let page = options.reprocessar ? 1 : 1;
      while (completePages.has(page)) page++;
      for (; paginasConsultadas < options.paginas; page++) {
        await lease.heartbeat();
        const list = await paginaDaApi(ano, page, chave);
        paginasConsultadas++;
        if (!list.length) {
          await prisma.syncExecution.upsert({
            where: { id: done },
            create: { id: done, status: "SUCESSO", iniciadoEm: new Date(), finalizadoEm: new Date(),
              parametros: JSON.stringify({ tipo: "historico-v1", collectorRevision: REVISION, fonte: "emendas", ano }),
              resumo: JSON.stringify({ emendasSincronizadas: total, cobertura: "Ano consultado até a página vazia no Portal da Transparência" }) },
            update: { status: "SUCESSO", finalizadoEm: new Date(), erro: null },
          });
          anosCompletos++;
          console.log("Emendas: ano " + ano + " concluído na página " + page);
          break;
        }
        let imported = 0, assigned = 0, unknown = 0;
        for (const item of list) {
          const codigo = stringValue(item.codigoEmenda);
          if (!codigo || !/^[0-9A-Za-z._/-]{4,50}$/.test(codigo)) {
            throw new Error("Código de emenda ausente ou inválido; página não será marcada como concluída");
          }
          const itemAno = Number(item.ano);
          if (itemAno !== ano) throw new Error("Ano da emenda diverge do filtro da API");
          const autorOriginal = stringValue(item.nomeAutor || item.autor);
          const tipo = classificarTipoEmenda(item.tipoEmenda);
          const individual = tipo === "INDIVIDUAL" || tipo === "TRANSFERENCIA_ESPECIAL";
          const parlamentarId = individual ? (porNome.get(nomeNormalizado(autorOriginal)) ?? null) : null;
          const valorPago = lerValorReais(item.valorPago);
          const valorEmpenhado = lerValorReais(item.valorEmpenhado);
          const valorLiquidado = lerValorReais(item.valorLiquidado);
          if ([valorPago, valorEmpenhado, valorLiquidado].some(v => v < 0)) throw new Error("Valor negativo inesperado");
          const local = stringValue(item.localidadeDoGasto);
          const dados = {
            ano, tipo, autorOriginal: autorOriginal || null, localidadeOriginal: local || null,
            numeroEmenda: stringValue(item.numeroEmenda) || null,
            descricao: [stringValue(item.funcao), stringValue(item.subfuncao)].filter(Boolean).join(" / ") || null,
            valorPago, valorEmpenhado, municipioBeneficiado: municipioDaLocalidade(local),
            ufBeneficiada: extrairUF(local), funcao: stringValue(item.funcao) || null,
            status: valorPago > 0 ? "PAGO" : valorLiquidado > 0 ? "LIQUIDADO" : valorEmpenhado > 0 ? "EMPENHADO" : "SEM_EXECUCAO",
            fonte: "PORTAL_TRANSPARENCIA_CGU",
            parlamentarId,
          };
          await prisma.emendaParlamentar.upsert({
            where: { codigoEmenda: codigo },
            update: dados,
            create: { ...dados, codigoEmenda: codigo },
          });
          imported++;
          if (parlamentarId) assigned++; else unknown++;
        }
        total += imported; vinculadas += assigned; semVinculo += unknown;
        const id = prefix + "page:" + String(page).padStart(5, "0");
        await prisma.syncExecution.upsert({
          where: { id },
          create: { id, iniciadoEm: new Date(), finalizadoEm: new Date(), status: "SUCESSO",
            parametros: JSON.stringify({ tipo: "historico-v1", collectorRevision: REVISION, fonte: "emendas", ano, pagina: page }),
            resumo: JSON.stringify({ emendasSincronizadas: imported, associadas: assigned, semCorrespondencia: unknown }) },
          update: { status: "SUCESSO", finalizadoEm: new Date(), erro: null },
        });
        console.log("Emendas oficiais " + ano + " página " + page + ": " + imported + " consultadas, " + assigned + " associadas");
      }
    }
    return { paginasConsultadas, emendasSincronizadas: total, vinculadas, semVinculo, anosCompletos };
  } finally {
    await lease.release();
  }
}
