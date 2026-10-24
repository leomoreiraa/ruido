// app/pautas/page.tsx

import React from "react";
import { prisma } from "@/lib/prisma";
import { PautasFilterView, PautaListItem } from "@/components/PautasFilterView";
import { fonteHash } from "@/lib/ai/explicacaoProjetos";

export default async function PautasPage() {
  const [proposicoesRaw, tiposAgrupados] = await Promise.all([
    prisma.proposicao.findMany({
      orderBy: [{ ano: "desc" }, { numero: "desc" }],
      include: {
        votacoes: {
          orderBy: { dataHora: "desc" },
          take: 1,
        },
        _count: {
          select: { votacoes: true },
        },
      },
    }),
    prisma.proposicao.groupBy({
      by: ["siglaTipo"],
      orderBy: { siglaTipo: "asc" },
    }),
  ]);

  const pautasIniciais: PautaListItem[] = proposicoesRaw.map((prop) => {
    const uv = prop.votacoes[0];
    const fonte = fonteHash(prop, prop.resumoModelo ?? undefined);
    const iaValida = prop.resumoFonteHash === fonte && !!prop.tituloSimples &&
      !!prop.resumoSimples && !!prop.explicacaoSimples;
    return {
      id: prop.id,
      externalId: prop.externalId,
      autorNome: prop.autorNome,
      dataApresentacao: prop.dataApresentacao?.toISOString() ?? null,
      casa: prop.casa,
      siglaTipo: prop.siglaTipo,
      numero: prop.numero,
      ano: prop.ano,
      ementa: prop.ementa,
      tituloSimples: iaValida ? prop.tituloSimples : null,
      resumoSimples: iaValida ? prop.resumoSimples : null,
      totalVotacoes: prop._count.votacoes,
      ultimaVotacao: uv
        ? {
            id: uv.id,
            descricao: uv.descricao,
            dataHora: uv.dataHora.toISOString(),
            aprovada: uv.aprovada,
            placarSim: uv.placarSim,
            placarNao: uv.placarNao,
          }
        : null,
    };
  });

  const tiposDisponiveis = tiposAgrupados
    .map((t) => t.siglaTipo)
    .filter(Boolean);

  return (
    <PautasFilterView
      pautasIniciais={pautasIniciais.slice(0, 20)}
      totalRegistros={pautasIniciais.length}
      tiposDisponiveis={tiposDisponiveis}
    />
  );
}
