// app/emendas/page.tsx

import React from "react";
import { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import {
  EmendasTrackerView,
  RankingParlamentarEmenda,
  DistribuicaoUfEmenda,
} from "@/components/EmendasTrackerView";
import { EmendaItem } from "@/lib/types";

export const metadata: Metadata = {
  title: "Emendas Parlamentares | Radar Congresso",
  description:
    "Acompanhe o destino do dinheiro público: emendas individuais, de bancada e transferências especiais (PIX) enviadas por deputados e senadores para municípios brasileiros.",
};

export default async function EmendasPage() {
  const emendasRaw = await prisma.emendaParlamentar.findMany({
    orderBy: [{ valorPago: "desc" }, { ano: "desc" }],
    include: {
      parlamentar: {
        select: {
          id: true,
          nome: true,
          partido: true,
          uf: true,
          casa: true,
          urlFoto: true,
        },
      },
    },
  });

  // Agregações de KPIs
  let totalGeralEmpenhado = 0;
  let totalGeralPago = 0;
  let totalGeralPix = 0;
  const municipiosUnicos = new Set<string>();

  // Agregações por Parlamentar para o Ranking
  const mapaParlamentares = new Map<
    string,
    {
      id: string;
      nome: string;
      partido: string;
      uf: string;
      casa: string;
      urlFoto: string | null;
      totalEmpenhado: number;
      totalPago: number;
      totalPix: number;
      quantidadeEmendas: number;
    }
  >();

  // Agregações por UF
  const mapaUfs = new Map<string, { totalPago: number; quantidadeEmendas: number }>();

  // Agregações por Município
  const mapaMunicipios = new Map<string, { municipio: string; uf: string; totalPago: number }>();

  for (const em of emendasRaw) {
    totalGeralEmpenhado += em.valorEmpenhado;
    totalGeralPago += em.valorPago;

    if (em.tipo === "TRANSFERENCIA_ESPECIAL") {
      totalGeralPix += em.valorPago;
    }

    if (em.municipioBeneficiado) {
      municipiosUnicos.add(`${em.municipioBeneficiado}-${em.ufBeneficiada}`);

      const chaveMun = `${em.municipioBeneficiado}-${em.ufBeneficiada}`;
      const regMun = mapaMunicipios.get(chaveMun) || {
        municipio: em.municipioBeneficiado,
        uf: em.ufBeneficiada || "",
        totalPago: 0,
      };
      regMun.totalPago += em.valorPago;
      mapaMunicipios.set(chaveMun, regMun);
    }

    // Agrega UF
    if (em.ufBeneficiada) {
      const regUf = mapaUfs.get(em.ufBeneficiada) || { totalPago: 0, quantidadeEmendas: 0 };
      regUf.totalPago += em.valorPago;
      regUf.quantidadeEmendas += 1;
      mapaUfs.set(em.ufBeneficiada, regUf);
    }

    // Agrega Parlamentar
    if (em.parlamentar) {
      const p = em.parlamentar;
      const regP = mapaParlamentares.get(p.id) || {
        id: p.id,
        nome: p.nome,
        partido: p.partido,
        uf: p.uf,
        casa: p.casa,
        urlFoto: p.urlFoto,
        totalEmpenhado: 0,
        totalPago: 0,
        totalPix: 0,
        quantidadeEmendas: 0,
      };

      regP.totalEmpenhado += em.valorEmpenhado;
      regP.totalPago += em.valorPago;
      if (em.tipo === "TRANSFERENCIA_ESPECIAL") {
        regP.totalPix += em.valorPago;
      }
      regP.quantidadeEmendas += 1;
      mapaParlamentares.set(p.id, regP);
    }
  }

  // Ordena ranking de parlamentares (Top 10)
  const rankingParlamentares: RankingParlamentarEmenda[] = Array.from(
    mapaParlamentares.values()
  )
    .sort((a, b) => b.totalPago - a.totalPago)
    .slice(0, 10);

  // Ordena UFs
  const distribuicaoUfs: DistribuicaoUfEmenda[] = Array.from(mapaUfs.entries())
    .map(([uf, dados]) => ({
      uf,
      totalPago: dados.totalPago,
      quantidadeEmendas: dados.quantidadeEmendas,
    }))
    .sort((a, b) => b.totalPago - a.totalPago);

  // Top Municípios
  const topMunicipios = Array.from(mapaMunicipios.values())
    .sort((a, b) => b.totalPago - a.totalPago)
    .slice(0, 8);

  const emendasSerializadas: EmendaItem[] = emendasRaw.map((em) => ({
    id: em.id,
    parlamentarId: em.parlamentarId,
    autorOriginal: em.autorOriginal,
    numeroEmenda: em.numeroEmenda,
    localidadeOriginal: em.localidadeOriginal,
    codigoEmenda: em.codigoEmenda,
    ano: em.ano,
    tipo: em.tipo,
    descricao: em.descricao,
    valorEmpenhado: em.valorEmpenhado,
    valorPago: em.valorPago,
    municipioBeneficiado: em.municipioBeneficiado,
    ufBeneficiada: em.ufBeneficiada,
    funcao: em.funcao,
    status: em.status,
    fonte: em.fonte,
    parlamentar: em.parlamentar
      ? {
          id: em.parlamentar.id,
          nome: em.parlamentar.nome,
          partido: em.parlamentar.partido,
          uf: em.parlamentar.uf,
          casa: em.parlamentar.casa,
          urlFoto: em.parlamentar.urlFoto,
        }
      : undefined,
  }));

  return (
    <EmendasTrackerView
      emendasIniciais={emendasSerializadas.slice(0, 25)}
      totalRegistros={emendasSerializadas.length}
      anosDisponiveis={Array.from(new Set(emendasSerializadas.map(item => item.ano))).sort((a, b) => b - a)}
      rankingParlamentares={rankingParlamentares}
      distribuicaoUfs={distribuicaoUfs}
      topMunicipios={topMunicipios}
      totalGeralEmpenhado={totalGeralEmpenhado}
      totalGeralPago={totalGeralPago}
      totalGeralPix={totalGeralPix}
      totalMunicipiosAtendidos={municipiosUnicos.size}
    />
  );
}
