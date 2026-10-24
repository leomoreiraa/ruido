import type {Metadata} from "next";
import fs from "node:fs/promises";
import path from "node:path";
import {Eleicoes2026View} from "@/components/Eleicoes2026View";
import {UFS} from "@/lib/mapaBrasil";
import {validarCacheMalhasIBGE} from "@/lib/malhasBrasil";

export const metadata:Metadata={title:"Apuração eleitoral 2026 | RUÍDO",description:"Resultados e porcentagens oficiais do primeiro e segundo turnos presidenciais por município, estado e Brasil, com mapa de votos. Fonte TSE."};
export default async function EleicoesPage(){
 const contents=await fs.readFile(path.join(process.cwd(),"data","ibge-ufs-geometry.json"),"utf8");
 const malhas=validarCacheMalhasIBGE(JSON.parse(contents));
 return <Eleicoes2026View malhas={UFS.map(([,uf,nome])=>({uf,nome,svgPath:malhas[uf]}))}/>;
}
