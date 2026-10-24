import React from "react";
import fs from "node:fs";
import path from "node:path";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { GraficoVotos } from "@/components/GraficoVotos";
import { coberturaPresenca } from "@/lib/presencaCoverage";
import { formatarDataBR } from "@/lib/utils";
import {
  ParlamentarHistoricoTabs,
  VotoHistoricoItem,
  PresencaHistoricoItem,
} from "@/components/ParlamentarHistoricoTabs";
import { PerfilIADiscursos } from "@/components/PerfilIADiscursos";
import { DossieFinanceiroNoticias } from "@/components/DossieFinanceiroNoticias";
import { DossieRedeFinanceira } from "@/components/DossieRedeFinanceira";
import { PoliticianPhoto } from "@/components/PoliticianPhoto";
import { CandidaturaPresidencial } from "@/components/CandidaturaPresidencial";
import { candidaturaPresidencialDoPerfil } from "@/lib/eleicoes/candidaturaPresidencial";
import { EmendaItem, BemDeclaradoItem } from "@/lib/types";

interface PerfilParlamentarPageProps {
  params: {
    id: string;
  };
}

export async function generateStaticParams() {
  const parlamentares = await prisma.parlamentar.findMany({
    select: { id: true },
  });
  return parlamentares.map((p) => ({ id: p.id }));
}

export default async function PerfilParlamentarPage({ params }: PerfilParlamentarPageProps) {
  const [
    parlamentar,
    totalVotosParlamentar,
    totalPresencasParlamentar,
    votosRaw,
    presencasRaw,
    contagemPorOpcao,
    contagemPorPresenca,
    votosDecisao,
    emendasRaw,
    bensRaw,
    resumoIARaw,
    totalDiscursos,
    frequenciaOficial,
  ] = await Promise.all([
    prisma.parlamentar.findUnique({
      where: { id: params.id },
    }),
    prisma.voto.count({
      where: { parlamentarId: params.id },
    }),
    prisma.presenca.count({
      where: { parlamentarId: params.id },
    }),
    prisma.voto.findMany({
      where: { parlamentarId: params.id },
      orderBy: [{ votacao: { dataHora: "desc" } }, { id: "asc" }],
      take: 120,
      include: {
        votacao: {
          include: {
            proposicao: true,
          },
        },
      },
    }),
    prisma.presenca.findMany({
      where: { parlamentarId: params.id },
      orderBy: [{ dataSessao: "desc" }, { id: "asc" }],
      take: 120,
    }),
    prisma.voto.groupBy({
      by: ["opcao"],
      where: { parlamentarId: params.id },
      _count: { _all: true },
    }),
    prisma.presenca.groupBy({
      by: ["status"],
      where: { parlamentarId: params.id },
      _count: { _all: true },
    }),
    prisma.voto.findMany({
      where: {
        parlamentarId: params.id,
        opcao: { in: ["SIM", "NAO"] },
      },
      select: {
        opcao: true,
        votacao: {
          select: {
            placarSim: true,
            placarNao: true,
          },
        },
      },
    }),
    prisma.emendaParlamentar.findMany({
      where: { parlamentarId: params.id },
      orderBy: [{ ano: "desc" }, { valorPago: "desc" }],
    }),
    prisma.bemDeclarado.findMany({
      where: { parlamentarId: params.id },
      orderBy: [{ anoEleicao: "desc" }, { valorDeclarado: "desc" }],
    }),
    prisma.resumoIA.findFirst({
      where: { parlamentarId: params.id },
      orderBy: { geradoEm: "desc" },
    }),
    prisma.discurso.count({
      where: { parlamentarId: params.id },
    }),
    prisma.frequenciaPlenario.aggregate({
      where: { parlamentarId: params.id },
      _sum: { sessoesAuditadas: true, presentes: true, ausentes: true, justificadas: true },
      _count: { _all: true },
    }),
  ]);

  if (!parlamentar) {
    notFound();
  }

  const mapaVotos: Record<string, number> = {};
  for (const c of contagemPorOpcao) {
    mapaVotos[c.opcao] = c._count._all;
  }

  const opcoesPadrao = new Set(["SIM", "NAO", "ABSTENCAO", "OBSTRUCAO", "ARTIGO_17"]);
  let contagemOutrosTotal = 0;
  const outrosVotosDetalhados: Array<{ opcao: string; total: number }> = [];

  for (const c of contagemPorOpcao) {
    if (!opcoesPadrao.has(c.opcao)) {
      contagemOutrosTotal += c._count._all;
      outrosVotosDetalhados.push({
        opcao: c.opcao,
        total: c._count._all,
      });
    }
  }

  const mapaPresencas: Record<string, number> = {};
  for (const c of contagemPorPresenca) {
    mapaPresencas[c.status] = c._count._all;
  }

  let votacoesAlinhamentoElegiveis = 0;
  let votosAlinhados = 0;

  for (const v of votosDecisao) {
    const { placarSim, placarNao } = v.votacao;
    if (placarSim === placarNao) {
      continue;
    }
    votacoesAlinhamentoElegiveis++;
    const maioriaPlenario = placarSim > placarNao ? "SIM" : "NAO";
    if (v.opcao === maioriaPlenario) {
      votosAlinhados++;
    }
  }

  const alinhamentoMaioriaPct =
    votacoesAlinhamentoElegiveis > 0
      ? Math.round((votosAlinhados / votacoesAlinhamentoElegiveis) * 100)
      : null;

  let totaisTse: Array<{ano:number;totalDeclarado:number;quantidadeBens:number;fonte:string}> = [];
  try {
    const file = path.join(process.cwd(), "public/data/dossies/patrimonio.json");
    const store = JSON.parse(fs.readFileSync(file, "utf8")) as {
      dados?: Record<string, Record<string, {
        totalDeclarado:number; quantidadeBens:number; fonte:string
      }>>;
    };
    totaisTse = Object.entries(store.dados?.[parlamentar.id] ?? {})
      .filter(([ano,v]) => /^\\d{4}$/.test(ano) && Number.isFinite(v.totalDeclarado) &&
        v.totalDeclarado >= 0 && v.quantidadeBens > 0 &&
        v.fonte.startsWith("https://cdn.tse.jus.br/"))
      .map(([ano,v])=>({ano:Number(ano),...v}));
  } catch {
  }

  let candidatura=null;
  try{
    const registro=JSON.parse(fs.readFileSync(path.join(process.cwd(),
      "public/data/dossies/candidaturas-presidenciais.json"),"utf8"));
    candidatura=candidaturaPresidencialDoPerfil(registro,parlamentar);
  }catch{
  }
  const isCamara = parlamentar.casa === "CAMARA";

  const votosSerializados: VotoHistoricoItem[] = votosRaw.map((v: any) => ({
    id: v.id,
    opcao: v.opcao,
    opcaoOriginal: v.opcaoOriginal,
    registradoEm: v.registradoEm?.toISOString() || null,
    partidoNaEpoca: v.partidoNaEpoca,
    ufNaEpoca: v.ufNaEpoca,
    votacao: {
      id: v.votacao.id,
      descricao: v.votacao.descricao,
      dataHora: v.votacao.dataHora.toISOString(),
      aprovada: v.votacao.aprovada,
      placarSim: v.votacao.placarSim,
      placarNao: v.votacao.placarNao,
      proposicao: v.votacao.proposicao
        ? {
            id: v.votacao.proposicao.id,
            siglaTipo: v.votacao.proposicao.siglaTipo,
            numero: v.votacao.proposicao.numero,
            ano: v.votacao.proposicao.ano,
            ementa: v.votacao.proposicao.ementa,
          }
        : null,
    },
  }));

  const presencasSerializadas: PresencaHistoricoItem[] = presencasRaw.map((p: any) => ({
    id: p.id,
    sessaoExternalId: p.sessaoExternalId,
    dataSessao: p.dataSessao.toISOString(),
    tituloSessao: p.tituloSessao,
    status: p.status,
    justificativa: p.justificativa,
    fonteUrl: p.fonteUrl,
    origem: p.origem,
    cobertura: p.cobertura,
  }));

  const emendasSerializadas: EmendaItem[] = emendasRaw.map((e: any) => ({
    id: e.id,
    parlamentarId: e.parlamentarId,
    codigoEmenda: e.codigoEmenda,
    ano: e.ano,
    tipo: e.tipo,
    descricao: e.descricao,
    valorEmpenhado: e.valorEmpenhado,
    valorPago: e.valorPago,
    municipioBeneficiado: e.municipioBeneficiado,
    ufBeneficiada: e.ufBeneficiada,
    funcao: e.funcao,
    status: e.status,
    fonte: e.fonte,
  }));

  const bensSerializados: BemDeclaradoItem[] = bensRaw.map((b: any) => ({
    id: b.id,
    parlamentarId: b.parlamentarId,
    anoEleicao: b.anoEleicao,
    tipoBem: b.tipoBem,
    descricao: b.descricao,
    valorDeclarado: b.valorDeclarado,
    totalPatrimonioAno: b.totalPatrimonioAno,
  }));

  let keywordsIA: string[] = [];
  if (resumoIARaw?.keywords) {
    try {
      keywordsIA = JSON.parse(resumoIARaw.keywords);
    } catch {
      keywordsIA = resumoIARaw.keywords.split(",").map((k: string) => k.trim());
    }
  }

  return (
    <div className="space-y-8">
      {/* Back button */}
      <div>
        <Link
          href="/parlamentares"
          className="btn-punk font-mono text-xs font-bold px-3 py-1.5 inline-flex items-center gap-1.5"
        >
          <span>&larr; VOLTAR AO ARQUIVO DE PARLAMENTARES</span>
        </Link>
      </div>

      {/* Main Dossier File Folder */}
      <div className="relative ruido-paper-card bg-paper-card border-4 border-ink p-6 sm:p-8 shadow-[12px_12px_0_#101010] transform -rotate-0.5">
        {/* Scotch Tape & Stamp */}
        <div className="scotch-tape transform -rotate-3" aria-hidden="true" />
        <img
          src="/assets/stamp-confidencial.svg"
          alt="Selo Confidencial"
          className="absolute top-4 right-4 w-32 sm:w-44 pointer-events-none opacity-85 select-none transform rotate-3"
        />
        <div className="relative z-10 flex flex-col md:flex-row gap-6 items-start">
          {/* Mugshot frame with interactive target on hover */}
          <div className="relative flex-shrink-0 mx-auto md:mx-0 group/photo">
            <PoliticianPhoto
              urlFoto={parlamentar.urlFoto}
              nome={parlamentar.nome}
              width={160}
              height={208}
              className="w-36 h-48 sm:w-44 sm:h-56"
            />
            <div className="bg-ink text-punk-acid font-mono text-[10px] font-bold text-center py-0.5 border-t-2 border-punk-red mt-1 shadow-[2px_2px_0_#e42232]">
              REGISTRO #{parlamentar.externalId}
            </div>
          </div>

          {/* Dossier Metadata */}
          <div className="flex-1 min-w-0 space-y-3 font-mono">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-heavy text-xs px-2.5 py-0.5 bg-ink text-punk-acid uppercase">
                {isCamara ? "CÂMARA DOS DEPUTADOS" : "SENADO FEDERAL"}
              </span>
              <span className="font-bold text-xs bg-punk-acid text-ink px-2.5 py-0.5 border border-ink">
                {parlamentar.partido || "SEM PARTIDO"} &bull; {parlamentar.uf}
              </span>
              <span
                className={`font-bold text-xs px-2 py-0.5 border ${
                  parlamentar.ativo
                    ? "bg-green-100 text-green-900 border-green-800"
                    : "bg-red-100 text-red-900 border-red-800"
                }`}
              >
                {parlamentar.ativo ? "EM EXERCÍCIO" : "FORA DO EXERCÍCIO"}
              </span>
            </div>

            <h1 className="font-heavy text-3xl sm:text-5xl uppercase tracking-tight text-ink leading-tight">
              {parlamentar.nome}
            </h1>

            {parlamentar.nomeCivil && parlamentar.nomeCivil !== parlamentar.nome && (
              <p className="text-xs text-ink/70">
                <strong>Nome de registro civil:</strong> {parlamentar.nomeCivil}
              </p>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs pt-2 border-t-2 border-dashed border-ink/20">
              {parlamentar.email && (
                <div>
                  <span className="text-ink/60 uppercase">E-mail funcional:</span>
                  <div className="font-bold text-punk-red truncate">
                    <a href={`mailto:${parlamentar.email}`}>{parlamentar.email}</a>
                  </div>
                </div>
              )}
              <div>
                <span className="text-ink/60 uppercase">Matrícula no Congresso:</span>
                <div className="font-bold text-ink">#{parlamentar.externalId}</div>
              </div>
              {parlamentar.cadastroAtualizadoEm && (
                <div className="sm:col-span-2">
                  <span className="text-ink/60 uppercase">Cadastro atualizado em:</span>{" "}
                  <strong className="text-ink">{formatarDataBR(parlamentar.cadastroAtualizadoEm)}</strong>
                </div>
              )}
            </div>

            {/* Barcode bottom line */}
            <div className="pt-3 border-t-2 border-dashed border-ink/20 flex justify-between items-center text-[10px] text-ink/60">
              <img
                src="/assets/barcode.svg"
                alt="Código de barras"
                className="h-6 w-auto opacity-75"
              />
              <span className="font-bold">AUDITORIA CÍVICA DESCENTRALIZADA</span>
            </div>
          </div>
        </div>
      </div>

      {/* Resumo de Discursos por IA se houver */}
      {resumoIARaw && (
        <PerfilIADiscursos
          parlamentarNome={parlamentar.nome}
          keywords={keywordsIA}
          resumo={resumoIARaw.resumo}
          modeloUsado={resumoIARaw.modeloUsado}
          geradoEm={resumoIARaw.geradoEm}
          totalDiscursos={totalDiscursos}
        />
      )}

      {/* Fontes de gasto oficial; notícias exibem nível FONTE_UNICA ou CORROBORADA. */}
      <DossieFinanceiroNoticias
        parlamentarId={parlamentar.id}
        nome={parlamentar.nome}
        casa={parlamentar.casa}
      />

      {candidatura && <CandidaturaPresidencial dados={candidatura} />}

      {/* Fase 1: doações, emendas e fornecedores, com cruzamentos por CNPJ exato. */}
      <DossieRedeFinanceira parlamentarId={parlamentar.id} casa={parlamentar.casa} />

      {/* Votos conhecidos e registros positivos / justificados — não taxa de assiduidade */}
      <GraficoVotos
        coberturaRecorte={coberturaPresenca(parlamentar.id,parlamentar.casa)}
        frequenciaAuditada={frequenciaOficial._count._all > 0 ? {
          sessoes: frequenciaOficial._sum.sessoesAuditadas || 0,
          presentes: frequenciaOficial._sum.presentes || 0,
          ausentes: frequenciaOficial._sum.ausentes || 0,
          justificadas: frequenciaOficial._sum.justificadas || 0,
        } : undefined}
        presencasPresente={mapaPresencas["PRESENTE"] || 0}
        presencasAusente={mapaPresencas["AUSENTE"] || 0}
        presencasJustificado={mapaPresencas["JUSTIFICADO"] || 0}
        votosSim={mapaVotos["SIM"] || 0}
        votosNao={mapaVotos["NAO"] || 0}
        votosAbstencao={mapaVotos["ABSTENCAO"] || 0}
        votosObstrucao={mapaVotos["OBSTRUCAO"] || 0}
        votosArtigo17={mapaVotos["ARTIGO_17"] || 0}
        votosOutros={contagemOutrosTotal}
        outrosVotosDetalhados={outrosVotosDetalhados}
        alinhamentoMaioriaPct={alinhamentoMaioriaPct}
        totalVotacoesAlinhamentoElegiveis={votacoesAlinhamentoElegiveis}
        totalVotosAlinhados={votosAlinhados}
      />

      {/* Histórico: Votos, Presenças, Emendas, Patrimônio */}
      <ParlamentarHistoricoTabs
        votos={votosSerializados}
        presencas={presencasSerializadas}
        parlamentarId={parlamentar.id}
        totalVotos={totalVotosParlamentar}
        totalPresencas={totalPresencasParlamentar}
        emendas={emendasSerializadas}
        bensDeclarados={bensSerializados}
        totaisTse={totaisTse}
        parlamentarNome={parlamentar.nome}
      />

      {/* Official Sources Notice */}
      <div className="bg-paper border-2 border-dashed border-ink/40 p-4 font-mono text-xs text-ink/70">
        Os registros legislativos e financeiros vêm de fontes oficiais, quando disponíveis.
        Notícias são identificadas como fonte única ou corroboradas conforme as
        reportagens originais verificadas; isso não comprova situação judicial.
        Ausência de dados não significa ausência de fatos nem irregularidade.
      </div>
    </div>
  );
}
