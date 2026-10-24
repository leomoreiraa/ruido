import React from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { fonteHash, explicacaoFielAoObjeto } from "@/lib/ai/explicacaoProjetos";
import { formatarDataBR, formatarDataHoraBR } from "@/lib/utils";
import { VotacaoVotosList } from "@/components/VotacaoVotosList";

interface PautaDetalhePageProps {
  params: {
    id: string;
  };
}

export async function generateStaticParams() {
  if (process.env.GITHUB_PAGES === "true") {
    const first = await prisma.proposicao.findFirst({ select: { id: true }, orderBy: { id: "asc" } });
    if (!first) throw new Error("Não há proposições oficiais para exportar");
    return [{ id: first.id }];
  }
  const proposicoes = await prisma.proposicao.findMany({
    select: { id: true },
  });
  return proposicoes.map((p) => ({ id: p.id }));
}

export default async function PautaDetalhePage({ params }: PautaDetalhePageProps) {
  const proposicao = await prisma.proposicao.findUnique({
    where: { id: params.id },
    include: {
      votacoes: {
        orderBy: { dataHora: "desc" },
        include: {
          votos: {
            orderBy: [{ opcao: "asc" }, { parlamentar: { nome: "asc" } }],
            include: {
              parlamentar: {
                select: {
                  id: true,
                  nome: true,
                  partido: true,
                  uf: true,
                  urlFoto: true,
                },
              },
            },
          },
        },
      },
    },
  });

  if (!proposicao) {
    notFound();
  }

  const isCamara = proposicao.casa === "CAMARA";
  const explicacaoValida = proposicao.resumoFonteHash ===
    fonteHash(proposicao, proposicao.resumoModelo ?? undefined) &&
    !!proposicao.tituloSimples && !!proposicao.resumoSimples && !!proposicao.explicacaoSimples &&
    explicacaoFielAoObjeto(proposicao.ementa, {
      titulo:proposicao.tituloSimples, resumo:proposicao.resumoSimples,
      explicacao:proposicao.explicacaoSimples,
    });

  const urlOficialProposicao =
    proposicao.urlInteiroTeor ||
    (isCamara
      ? `https://www.camara.leg.br/proposicoesWeb/fichadetramitacao?idProposicao=${proposicao.externalId}`
      : `https://www25.senado.leg.br/web/atividade/materias/-/materia/${proposicao.externalId}`);

  return (
    <div className="space-y-8">
      {/* Back button */}
      <div>
        <Link
          href="/pautas"
          className="btn-punk font-mono text-xs font-bold px-3 py-1.5 inline-flex items-center gap-1.5"
        >
          <span>&larr; VOLTAR ÀS PAUTAS LEGISLATIVAS</span>
        </Link>
      </div>

      {/* Detalhes da Proposição */}
      <div className="relative ruido-paper-card bg-paper-card border-4 border-ink p-6 sm:p-8 shadow-[10px_10px_0_#101010]">
        <div className="scotch-tape" aria-hidden="true" />

        <div className="flex flex-wrap items-center justify-between gap-2 mb-3 pb-3 border-b-2 border-dashed border-ink/20 font-mono text-xs">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold bg-ink text-paper px-2 py-0.5 text-[10px] uppercase">
              {isCamara ? "CÂMARA DOS DEPUTADOS" : "SENADO FEDERAL"}
            </span>
            <span className="font-heavy text-lg text-punk-red">
              {proposicao.siglaTipo} {proposicao.numero}/{proposicao.ano}
            </span>
          </div>

          {urlOficialProposicao && (
            <a
              href={urlOficialProposicao}
              target="_blank"
              rel="noopener noreferrer"
              className="text-punk-red font-bold hover:underline flex items-center gap-1"
            >
              <span>Texto Oficial no Congresso</span>
              <span aria-hidden="true">&rarr;</span>
            </a>
          )}
        </div>

        <h1 className="font-heavy text-2xl sm:text-4xl uppercase tracking-tight text-ink my-3 leading-tight">
          {explicacaoValida ? proposicao.tituloSimples : proposicao.ementa}
        </h1>

        <div className="flex flex-wrap items-center gap-3 font-mono text-xs text-ink/75 pt-3 border-t-2 border-dashed border-ink/20">
          {proposicao.autorNome && (
            <span>
              Autor/Relatoria: <strong className="text-ink">{proposicao.autorNome}</strong>
            </span>
          )}
          {proposicao.dataApresentacao && (
            <span>
              &bull; Apresentada em:{" "}
              <strong className="text-ink">{formatarDataBR(proposicao.dataApresentacao)}</strong>
            </span>
          )}
          <span>
            &bull; Código Oficial: <strong className="text-ink">#{proposicao.externalId}</strong>
          </span>
        </div>
      </div>

      <section aria-labelledby="cidadao-title" className="ruido-paper-card bg-paper-card border-4 border-ink p-5 sm:p-7 shadow-[7px_7px_0_#101010] space-y-4">
        <h2 id="cidadao-title" className="font-heavy text-2xl sm:text-3xl uppercase text-ink">
          RESUMO <span className="text-punk-red">DO PROJETO</span>
        </h2>
        {explicacaoValida ? (
          <>
            <p className="font-mono text-sm leading-relaxed font-bold text-ink">{proposicao.resumoSimples}</p>
            <p className="font-mono text-sm leading-relaxed text-ink/90">{proposicao.explicacaoSimples}</p>
            <p className="font-mono text-xs text-ink/65 border-l-4 border-punk-red pl-3">
              Resumo gerado com auxílio de IA a partir da ementa oficial; confira o texto integral na fonte. O resumo não verifica aprovação, vigência ou impacto real.
            </p>
          </>
        ) : (
          <p className="font-mono text-xs sm:text-sm text-ink/70">
            Ainda não há um resumo disponível para esta proposta.
            Leia a ementa oficial abaixo e consulte o texto completo na fonte do Congresso.
          </p>
        )}
      </section>

      <section aria-labelledby="juridico-title" className="ruido-paper-card bg-paper-light border-4 border-ink p-5 sm:p-7 shadow-[7px_7px_0_#101010] space-y-3">
        <h2 id="juridico-title" className="font-heavy text-2xl uppercase text-ink">EMENTA OFICIAL • TEXTO JURÍDICO</h2>
        <p className="font-mono text-sm text-ink/90 leading-relaxed">{proposicao.ementa}</p>
        <p className="font-mono text-xs text-ink/70">
          Este é o resumo jurídico publicado pela Casa Legislativa, preservado sem alterações pela IA.
          Para ler o documento integral, acesse a fonte oficial.
        </p>
        <a href={urlOficialProposicao} target="_blank" rel="noopener noreferrer"
          className="btn-punk inline-block font-mono font-bold text-xs px-3 py-2">
          ABRIR DOCUMENTO ORIGINAL NO CONGRESSO ↗
        </a>
      </section>

      <p className="font-mono text-xs border-l-4 border-punk-red pl-3 text-ink/75">
        As votações relacionadas podem ser de emendas, requerimentos ou pareceres, não necessariamente do texto principal da proposição.
      </p>

      {/* Histórico de Votações */}
      <div className="space-y-6">
        <div className="flex items-center gap-3 border-b-4 border-ink pb-2">
          <h2 className="font-heavy text-2xl sm:text-3xl uppercase tracking-wider text-white bg-punk-red px-3 py-1 shadow-[4px_4px_0_#101010] transform -rotate-1">
            VOTAÇÕES RELACIONADAS ({proposicao.votacoes.length})
          </h2>
        </div>

        {proposicao.votacoes.length === 0 && (
          <div className="ruido-paper-card bg-paper-card p-5 font-mono text-sm text-ink" role="status">
            Nenhuma votação foi vinculada a esta proposta no banco publicado até o momento.
            Isso não significa que a matéria nunca tenha sido votada. Consulte o histórico
            oficial pelo link acima enquanto os vínculos dos dados históricos são auditados.
          </div>
        )}

        {proposicao.votacoes.map((vot) => {
          const totalNominal =
            vot.placarSim + vot.placarNao + vot.placarAbstencao + vot.placarObstrucao + vot.placarOutros;

          return (
            <div
              key={vot.id}
              className="relative ruido-paper-card bg-paper-light border-3 border-ink p-6 shadow-[6px_6px_0_#101010] space-y-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b-2 border-dashed border-ink/20 font-mono text-xs">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold bg-ink text-punk-acid px-2 py-0.5">
                    {formatarDataHoraBR(vot.dataHora)}
                  </span>
                  {vot.orgao && (
                    <span className="text-ink/70">
                      Órgão: <strong>{vot.orgao}</strong>
                    </span>
                  )}
                </div>

                <div>
                  {vot.votacaoSecreta && (
                    <span className="rubber-stamp rubber-stamp-red text-[10px]">
                      VOTAÇÃO SECRETA
                    </span>
                  )}
                  {vot.aprovada === true && (
                    <span className="rubber-stamp rubber-stamp-green text-[10px]">
                      ✓ APROVADA
                    </span>
                  )}
                  {vot.aprovada === false && (
                    <span className="rubber-stamp rubber-stamp-red text-[10px]">
                      ✕ NÃO APROVADA
                    </span>
                  )}
                </div>
              </div>

              <h3 className="font-heavy text-xl sm:text-2xl uppercase tracking-tight text-ink">
                {vot.descricao}
              </h3>

              {vot.resumo && vot.resumo !== vot.descricao && (
                <p className="font-mono text-xs sm:text-sm text-ink/80 leading-relaxed border-l-3 border-punk-red pl-3">
                  {vot.resumo}
                </p>
              )}

              {totalNominal > 0 && (
                <div className="p-3 bg-paper-card border-2 border-ink font-mono text-xs flex justify-between items-center gap-2 flex-wrap">
                  <strong className="text-ink uppercase">
                    Contagem oficial de votos registrados:
                  </strong>
                  <div className="flex gap-2">
                    <span className="bg-green-100 border border-green-800 px-2 py-0.5 font-bold text-green-900">
                      SIM: {vot.placarSim}
                    </span>
                    <span className="bg-red-100 border border-red-800 px-2 py-0.5 font-bold text-red-900">
                      NÃO: {vot.placarNao}
                    </span>
                    <span className="bg-yellow-100 border border-yellow-800 px-2 py-0.5 font-bold text-yellow-900">
                      ABST: {vot.placarAbstencao}
                    </span>
                    <span className="bg-gray-100 border border-gray-800 px-2 py-0.5 font-bold text-gray-900">
                      OBST: {vot.placarObstrucao} • OUTROS: {vot.placarOutros}
                    </span>
                  </div>
                </div>
              )}

              <div className="mt-4 pt-3 border-t-2 border-dashed border-ink/20">
                <VotacaoVotosList
                  votos={vot.votos}
                  votacaoSecreta={vot.votacaoSecreta}
                  cobertura={vot.cobertura}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
