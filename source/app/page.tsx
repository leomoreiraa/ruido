import React from "react";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { VotacaoItem } from "@/components/VotacaoItem";
import { ParlamentarCard } from "@/components/ParlamentarCard";
import { HomeInstantSearch } from "@/components/HomeInstantSearch";
import { formatarDataHoraBR } from "@/lib/utils";

export default async function DashboardPage() {
  const agora = new Date();
  const seteDiasAtras = new Date(agora.getTime() - 7 * 24 * 60 * 60 * 1000);
  const ultimaDataRegistrada = await prisma.votacao.findFirst({
    orderBy: { dataHora: "desc" },
    select: { dataHora: true },
  });
  const periodoSemAtividade = !!ultimaDataRegistrada && ultimaDataRegistrada.dataHora < seteDiasAtras;
  const fimPeriodo = periodoSemAtividade ? ultimaDataRegistrada!.dataHora : agora;
  const inicioPeriodo = new Date(fimPeriodo.getTime() - 7 * 24 * 60 * 60 * 1000);

  const [
    totalParlamentares,
    totalCamara,
    totalSenado,
    totalPautas,
    totalVotacoes,
    aprovadasCount,
    rejeitadasCount,
    totalVotos,
    votacoesSemana,
    votosSemana,
    aprovadasSemana,
    rejeitadasSemana,
    totalEmendas,
    ultimasCincoVotacoes,
    parlamentaresRecentes,
    ultimaExecucaoSync,
    maisRecenteVotacao,
    parlamentaresParaBusca,
  ] = await Promise.all([
    prisma.parlamentar.count({ where: { ativo: true } }),
    prisma.parlamentar.count({ where: { casa: "CAMARA", ativo: true } }),
    prisma.parlamentar.count({ where: { casa: "SENADO", ativo: true } }),
    prisma.proposicao.count(),
    prisma.votacao.count(),
    prisma.votacao.count({ where: { aprovada: true } }),
    prisma.votacao.count({ where: { aprovada: false } }),
    prisma.voto.count(),
    prisma.votacao.count({ where: { dataHora: { gte: inicioPeriodo, lte: fimPeriodo } } }),
    prisma.voto.count({ where: { votacao: { dataHora: { gte: inicioPeriodo, lte: fimPeriodo } } } }),
    prisma.votacao.count({
      where: { dataHora: { gte: inicioPeriodo, lte: fimPeriodo }, aprovada: true },
    }),
    prisma.votacao.count({
      where: { dataHora: { gte: inicioPeriodo, lte: fimPeriodo }, aprovada: false },
    }),
    prisma.emendaParlamentar.count(),
    prisma.votacao.findMany({
      where: {
        OR: [
          { placarSim: { gt: 0 } },
          { placarNao: { gt: 0 } },
          { placarAbstencao: { gt: 0 } },
          { placarObstrucao: { gt: 0 } },
          { placarOutros: { gt: 0 } },
          { votos: { some: {} } },
        ],
      },
      take: 5,
      orderBy: [{ dataHora: "desc" }],
      include: {
        proposicao: {
          select: {
            id: true,
            siglaTipo: true,
            numero: true,
            ano: true,
            ementa: true,
          },
        },
      },
    }),
    prisma.parlamentar.findMany({
      where: { ativo: true },
      take: 6,
      orderBy: [{ votos: { _count: "desc" } }, { nome: "asc" }],
      include: {
        _count: {
          select: {
            votos: true,
            presencas: true,
          },
        },
      },
    }),
    prisma.syncExecution.findFirst({
      where: { status: "SUCESSO", finalizadoEm: { not: null } },
      orderBy: { finalizadoEm: "desc" },
    }),
    prisma.votacao.findFirst({
      orderBy: { dataHora: "desc" },
      select: { dataHora: true },
    }),
    prisma.parlamentar.findMany({
      where: { ativo: true },
      select: {
        id: true,
        nome: true,
        partido: true,
        uf: true,
        casa: true,
        urlFoto: true,
        ativo: true,
      },
      orderBy: { nome: "asc" },
    }),
  ]);

  return (
    <div className="ruido-home-stage space-y-10">
      {/* Entrada direta: dado público, busca e três caminhos principais. */}
      <section className="ruido-hero-wall ruido-home-hero collage-paper relative bg-paper-card border-4 border-ink px-6 py-8 sm:px-9 sm:py-10">
        <div className="relative z-10 grid grid-cols-1 items-center gap-6 lg:grid-cols-[minmax(0,1fr)_260px] lg:gap-9">
          <div className="min-w-0 space-y-5">
            <div className="ruido-eyebrow">OBSERVATÓRIO CÍVICO / BRASIL</div>
            <h1 className="ruido-home-title font-heavy uppercase leading-none tracking-tight">
              <span className="block">RUÍDO.</span>
              <span className="ruido-home-subtitle block">POLÍTICA SOB LUPA.</span>
            </h1>
            <p className="ruido-home-intro max-w-xl font-mono text-sm sm:text-base">
              Votos, parlamentares e emendas. Consulte os registros oficiais.
            </p>
            <HomeInstantSearch parlamentares={parlamentaresParaBusca} />
            <div className="ruido-hero-links flex flex-wrap gap-2.5">
              <Link className="ruido-action ruido-action-primary" href="/pautas">VOTAÇÕES ↗</Link>
              <Link className="ruido-action ruido-action-dark" href="/parlamentares">POLÍTICOS ↗</Link>
              <Link className="ruido-action ruido-action-light" href="/emendas">EMENDAS ({totalEmendas}) ↗</Link>
            </div>
            {ultimaExecucaoSync && (
              <p className="ruido-home-sync font-mono text-[11px]">
                DADOS SINCRONIZADOS: {formatarDataHoraBR(ultimaExecucaoSync.finalizadoEm!)}
              </p>
            )}
          </div>
          <div className="ruido-home-art ruido-skull-paper hidden lg:block" aria-hidden="true">
            <div className="ruido-home-art-header">DADOS PÚBLICOS / #001</div>
            <div className="ruido-skull-cutout"><img src="/assets/skull-xerox.svg" alt="" width="240" height="270" className="mx-auto w-full max-w-[240px]" /></div>
            <div className="ruido-home-art-footer">CONSULTE A FONTE ↗</div>
          </div>
        </div>
      </section>

      {/* STATS OVERVIEW — The 4 Brutalist Crooked Cards with Scotch Tape */}
      <section className="space-y-4">
        <div className="flex items-center gap-3">
          <span className="font-heavy text-2xl sm:text-3xl uppercase tracking-wider text-ink bg-punk-acid px-3 py-1 border-2 border-ink shadow-[4px_4px_0_#101010] transform -rotate-1">
          </span>
          <div className="flex-1 border-b-2 border-ink border-dashed hidden sm:block" />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 pt-2">
          {/* Card 1: Políticos */}
          <div className="relative ruido-paper-card bg-paper-card border-3 border-ink p-5 shadow-[7px_7px_0_#101010] transform -rotate-2 hover:rotate-0 hover:-translate-y-2 hover:shadow-[10px_10px_0_#e42232] transition-all">
            <div className="scotch-tape-corner transform rotate-45" aria-hidden="true" />
            <span className="font-mono text-[10px] font-bold text-ink/70 uppercase tracking-wider block mb-1">
              [ 01 ] BANCO DE DADOS
            </span>
            <div className="font-heavy text-4xl sm:text-5xl text-ink leading-none my-2">
              {totalParlamentares}
            </div>
            <h3 className="font-heavy text-lg tracking-wide uppercase text-punk-red">
              Parlamentares
            </h3>
            <p className="font-mono text-xs text-ink/75 mt-2 pt-2 border-t-2 border-dashed border-ink/20">
              Câmara: {totalCamara} &bull; Senado: {totalSenado}.
            </p>
          </div>

          {/* Card 2: Votações */}
          <div className="relative ruido-paper-card bg-paper-card border-3 border-ink p-5 shadow-[7px_7px_0_#101010] transform rotate-2.5 hover:rotate-0 hover:-translate-y-2 hover:shadow-[10px_10px_0_#e42232] transition-all -translate-y-1">
            <div className="scotch-tape-corner transform -rotate-45" aria-hidden="true" />
            <span className="font-mono text-[10px] font-bold text-ink/70 uppercase tracking-wider block mb-1">
              [ 02 ] DELIBERAÇÕES
            </span>
            <div className="font-heavy text-4xl sm:text-5xl text-ink leading-none my-2">
              {totalVotacoes}
            </div>
            <h3 className="font-heavy text-lg tracking-wide uppercase text-punk-red">
              Votações
            </h3>
            <p className="font-mono text-xs text-ink/75 mt-2 pt-2 border-t-2 border-dashed border-ink/20">
              <strong className="text-green-700">{aprovadasCount}</strong> aprovadas &bull;{" "}
              <strong className="text-punk-red">{rejeitadasCount}</strong> não aprovadas.
            </p>
          </div>

          {/* Card 3: Votos Nominais */}
          <div className="relative ruido-paper-card bg-paper-card border-3 border-ink p-5 shadow-[7px_7px_0_#101010] transform -rotate-1.5 hover:rotate-0 hover:-translate-y-2 hover:shadow-[10px_10px_0_#e42232] transition-all translate-y-1">
            <div className="scotch-tape-corner transform rotate-30" aria-hidden="true" />
            <span className="font-mono text-[10px] font-bold text-ink/70 uppercase tracking-wider block mb-1">
              [ 03 ] NOMINAL / INDIVIDUAL
            </span>
            <div className="font-heavy text-4xl sm:text-5xl text-ink leading-none my-2">
              {totalVotos.toLocaleString("pt-BR")}
            </div>
            <h3 className="font-heavy text-lg tracking-wide uppercase text-punk-red">
              Votos nominais
            </h3>
            <p className="font-mono text-xs text-ink/75 mt-2 pt-2 border-t-2 border-dashed border-ink/20">
              Registros nominais disponíveis.
            </p>
          </div>

          {/* Card 4: Matérias */}
          <div className="relative ruido-paper-card bg-paper-card border-3 border-ink p-5 shadow-[7px_7px_0_#101010] transform rotate-2 hover:rotate-0 hover:-translate-y-2 hover:shadow-[10px_10px_0_#e42232] transition-all -translate-y-1">
            <div className="scotch-tape-corner transform -rotate-30" aria-hidden="true" />
            <span className="font-mono text-[10px] font-bold text-ink/70 uppercase tracking-wider block mb-1">
              [ 04 ] PROPOSIÇÕES
            </span>
            <div className="font-heavy text-4xl sm:text-5xl text-ink leading-none my-2">
              {totalPautas}
            </div>
            <h3 className="font-heavy text-lg tracking-wide uppercase text-punk-red">
              Proposições
            </h3>
            <p className="font-mono text-xs text-ink/75 mt-2 pt-2 border-t-2 border-dashed border-ink/20">
              Matérias legislativas registradas.
            </p>
          </div>
        </div>
      </section>

      {/* 7 DAYS RECENT ACTIVITY — Hazard Style Box */}
      <section className="ruido-ink-poster bg-ink text-paper p-6 sm:p-8 border-4 border-punk-red shadow-[8px_8px_0_#101010] relative">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 pb-4 border-b-2 border-dashed border-paper/30">
          <div>
            <div className="inline-block bg-punk-red text-white font-heavy text-xs px-2 py-0.5 tracking-wider uppercase mb-1">
              ATIVIDADE RECENTE
            </div>
            <h2 className="font-heavy text-3xl sm:text-4xl uppercase tracking-tight text-paper">
              {periodoSemAtividade ? "ÚLTIMA SEMANA COM REGISTROS" : "ÚLTIMOS 7 DIAS"}
            </h2>
          </div>
          {periodoSemAtividade && (
            <p className="mt-2 font-mono text-xs text-paper">Sem votações registradas nos últimos 7 dias. Indicadores abaixo se referem ao último período com dados oficiais.</p>
          )}
          {maisRecenteVotacao?.dataHora && (
            <span className="font-mono text-xs text-punk-acid border border-punk-acid px-3 py-1">
              Última votação: {formatarDataHoraBR(maisRecenteVotacao.dataHora)}
            </span>
          )}
        </div>

        <p className="mb-4 font-mono text-xs text-paper/85">PERÍODO CONSULTADO: {inicioPeriodo.toLocaleDateString("pt-BR", { timeZone: "UTC" })} A {fimPeriodo.toLocaleDateString("pt-BR", { timeZone: "UTC" })} • VOTOS NOMINAIS CONTADOS PELA DATA DA VOTAÇÃO, NÃO PELA DATA DA IMPORTAÇÃO.</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 font-mono text-center">
          <div className="bg-ink-light border-2 border-paper/30 p-4">
            <span className="text-xs text-paper-dark block">VOTAÇÕES DELIBERADAS</span>
            <strong className="font-heavy text-3xl sm:text-4xl text-punk-acid">
              {votacoesSemana}
            </strong>
          </div>
          <div className="bg-ink-light border-2 border-paper/30 p-4">
            <span className="text-xs text-paper-dark block">APROVADAS</span>
            <strong className="font-heavy text-3xl sm:text-4xl text-green-400">
              {aprovadasSemana}
            </strong>
          </div>
          <div className="bg-ink-light border-2 border-paper/30 p-4">
            <span className="text-xs text-paper-dark block">REJEITADAS</span>
            <strong className="font-heavy text-3xl sm:text-4xl text-punk-red">
              {rejeitadasSemana}
            </strong>
          </div>
          <div className="bg-ink-light border-2 border-paper/30 p-4">
            <span className="text-xs text-paper-dark block">VOTOS REGISTRADOS</span>
            <strong className="font-heavy text-3xl sm:text-4xl text-white">
              {votosSemana.toLocaleString("pt-BR")}
            </strong>
          </div>
        </div>
      </section>

      {/* SECTION: LATEST VOTES IN CONGRESS */}
      <section className="space-y-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 pb-2 border-b-4 border-ink">
          <div className="flex items-center gap-3">
            <span className="font-heavy text-2xl sm:text-4xl uppercase tracking-wider text-white bg-punk-red px-3 py-1 shadow-[4px_4px_0_#101010] transform -rotate-1">
            </span>
          </div>
          <Link
            href="/pautas"
            className="btn-punk font-mono text-xs font-bold py-2 px-4 whitespace-nowrap"
          >
            VER VOTAÇÕES &rarr;
          </Link>
        </div>

        {ultimasCincoVotacoes.length > 0 ? (
          <div className="space-y-4">
            {ultimasCincoVotacoes.map((votacao) => (
              <VotacaoItem
                key={votacao.id}
                id={votacao.id}
                externalId={votacao.externalId}
                casa={votacao.casa}
                dataHora={votacao.dataHora.toISOString()}
                descricao={votacao.descricao}
                resumo={votacao.resumo}
                aprovada={votacao.aprovada}
                placarSim={votacao.placarSim}
                placarNao={votacao.placarNao}
                placarAbstencao={votacao.placarAbstencao}
                placarObstrucao={votacao.placarObstrucao}
                placarOutros={votacao.placarOutros}
                cobertura={votacao.cobertura}
                fonteUrl={votacao.fonteUrl}
                votacaoSecreta={votacao.votacaoSecreta}
                proposicao={votacao.proposicao}
              />
            ))}
          </div>
        ) : (
          <div className="bg-paper-card border-2 border-ink p-6 font-mono text-center">
            Nenhuma votação registrada até o momento no banco de dados.
          </div>
        )}
      </section>

      {/* SECTION: MOST ACTIVE POLITICIANS */}
      <section className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 pb-2 border-b-4 border-ink">
          <div className="flex items-center gap-3">
            <span className="font-heavy text-2xl sm:text-4xl uppercase tracking-wider text-ink bg-punk-acid px-3 py-1 border-2 border-ink shadow-[4px_4px_0_#101010] transform rotate-1">
            </span>
          </div>
          <Link
            href="/parlamentares"
            className="btn-punk font-mono text-xs font-bold py-2 px-4 whitespace-nowrap"
          >
            VER PARLAMENTARES &rarr;
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {parlamentaresRecentes.map((p) => (
            <ParlamentarCard
              key={p.id}
              id={p.id}
              nome={p.nome}
              partido={p.partido}
              uf={p.uf}
              casa={p.casa}
              urlFoto={p.urlFoto}
              ativo={p.ativo}
              totalVotos={p._count.votos}
              totalPresencas={p._count.presencas}
            />
          ))}
        </div>
      </section>

      <section className="ruido-home-manifesto flex flex-col items-start justify-between gap-5 border-4 border-ink bg-punk-red px-6 py-7 text-paper sm:flex-row sm:items-center sm:px-9">
        <div>
          <h2 className="font-heavy text-3xl uppercase leading-tight sm:text-4xl">DADOS PÚBLICOS. OLHOS ABERTOS.</h2>
          <p className="mt-2 max-w-xl font-mono text-sm">Informação verificável, com links para as fontes.</p>
        </div>
        <Link href="/sobre" className="ruido-action ruido-action-primary shrink-0">COMO FUNCIONA ↗</Link>
      </section>
    </div>
  );
}
