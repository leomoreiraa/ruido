import fs from "node:fs";
import path from "node:path";

type Linha = {
  sessoes: number;
  presentes: number;
  ausentes: number;
  justificadas: number;
  inicio: string;
  fim: string;
};
type Publicacao = {
  version: number;
  metodo: string;
  fonte: string;
  dados: Record<string, Linha>;
};

let cache: Publicacao | null = null;

export function frequenciaPlenarioOficial(parlamentarId: string, casa: string) {
  if (casa !== "CAMARA") return null;
  try {
    if (!cache) {
      const arquivo = path.join(process.cwd(), "public/data/dossies/frequencia-plenario-oficial.json");
      cache = JSON.parse(fs.readFileSync(arquivo, "utf8")) as Publicacao;
    }
    if (cache.version !== 1 || cache.metodo !== "DIAS_SESSAO_PLENARIO_CAMARA") return null;
    const linha = cache.dados?.[parlamentarId];
    if (!linha || linha.sessoes < 3 ||
      linha.presentes + linha.ausentes + linha.justificadas !== linha.sessoes ||
      !linha.inicio || !linha.fim) return null;
    return {
      sessoes: linha.sessoes,
      presentes: linha.presentes,
      ausentes: linha.ausentes,
      justificadas: linha.justificadas,
      inicio: linha.inicio,
      fim: linha.fim,
      fonte: cache.fonte,
    };
  } catch {
    return null;
  }
}
