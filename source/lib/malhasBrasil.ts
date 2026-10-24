/**
 * Cache estático das malhas geradas a partir do IBGE por publicação anterior do RUÍDO.
 * A geometria muda muito raramente: não deve depender da rede em todos os deploys.
 * A aplicação NÃO usa este arquivo como fonte de PIB, IDHM, emendas ou população.
 */
import { UFS } from "./mapaBrasil";

export const IBGE_MALHAS_SOURCE =
  "https://servicodados.ibge.gov.br/api/v3/malhas/estados/{id}?formato=application%2Fvnd.geo%2Bjson&qualidade=minima";

export function validarCacheMalhasIBGE(raw: unknown): Record<string, string> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error("Cache de malhas IBGE inválido: documento ausente");
  }
  const data = raw as {
    version?: unknown;
    source?: unknown;
    estados?: unknown;
  };
  if (data.version !== 1 || data.source !== IBGE_MALHAS_SOURCE ||
      !Array.isArray(data.estados) || data.estados.length !== UFS.length) {
    throw new Error("Cache de malhas IBGE inválido: versão, origem ou cobertura");
  }

  const expected = new Map<string, string>(UFS.map(([id, uf]) => [uf, id]));
  const geometry: Record<string, string> = Object.create(null);

  for (const state of data.estados) {
    if (!state || typeof state !== "object" || Array.isArray(state)) {
      throw new Error("Cache de malhas IBGE: UF malformada");
    }
    const s = state as { id?: unknown; uf?: unknown; svgPath?: unknown };
    if (typeof s.uf !== "string" || expected.get(s.uf) !== s.id ||
        Object.hasOwn(geometry, s.uf) || typeof s.svgPath !== "string" ||
        s.svgPath.length < 30 || s.svgPath.length > 200_000 ||
        !/^M[0-9MLZ,.-]+Z$/.test(s.svgPath)) {
      throw new Error("Cache de malhas IBGE: estado, código ou SVG inválido: " + String(s.uf));
    }
    geometry[s.uf] = s.svgPath;
  }
  if (Object.keys(geometry).length !== UFS.length) {
    throw new Error("Cache de malhas IBGE incompleto");
  }
  return geometry;
}
