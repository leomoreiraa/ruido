// app/parlamentares/page.tsx

import React from "react";
import { prisma } from "@/lib/prisma";
import {
  ParlamentaresFilterView,
  ParlamentarListItem,
} from "@/components/ParlamentaresFilterView";

export default async function ParlamentaresPage() {
  const [parlamentaresRaw, partidosAgrupados] = await Promise.all([
    prisma.parlamentar.findMany({
      orderBy: [{ nome: "asc" }],
      include: {
        _count: {
          select: {
            votos: true,
            presencas: true,
          },
        },
      },
    }),
    prisma.parlamentar.groupBy({
      by: ["partido"],
      orderBy: { partido: "asc" },
    }),
  ]);

  const parlamentaresIniciais: ParlamentarListItem[] = parlamentaresRaw.map((p) => ({
    id: p.id,
    nome: p.nome,
    nomeCivil: p.nomeCivil,
    partido: p.partido,
    uf: p.uf,
    casa: p.casa,
    urlFoto: p.urlFoto,
    ativo: p.ativo,
    totalVotos: p._count.votos,
    totalPresencas: p._count.presencas,
  }));

  const partidosDisponiveis = partidosAgrupados
    .map((p) => p.partido)
    .filter(Boolean);

  return (
    <ParlamentaresFilterView
      parlamentaresIniciais={parlamentaresIniciais}
      partidosDisponiveis={partidosDisponiveis}
    />
  );
}
