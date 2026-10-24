import type { Metadata } from "next";
import fs from "node:fs/promises";
import path from "node:path";
import { MapaBrasilView } from "@/components/MapaBrasilView";
import type { DadosMapa } from "@/lib/mapaBrasil";

export const metadata: Metadata = {
  title: "Brasil em Raio X | RUÍDO",
  description: "Mapa das 27 unidades federativas com IDHM anual PNUD/FJP/IBGE, evolução do desenvolvimento humano e fontes oficiais atualizadas automaticamente.",
};

export default async function MapaPage() {
  let dados: DadosMapa | null = null;
  try {
    const filename = path.join(process.cwd(), "public", "data", "brasil-estados.json");
    const contents = await fs.readFile(filename, "utf8");
    const raw: unknown = JSON.parse(contents);
    if (raw && typeof raw === "object" && "estados" in raw && Array.isArray(raw.estados)
        && raw.estados.length === 27) dados = raw as DadosMapa;
  } catch (error) {
    console.warn("Mapa sem JSON validado: execute npm run build:regional no ambiente com APIs oficiais", error);
  }
  return <MapaBrasilView data={dados} />;
}
