import React from "react";
import Link from "next/link";

export const metadata = {
  title: "Manifesto & Metodologia | RUÍDO",
  description:
    "Metodologia e transparência: entenda como o Radar Congresso coleta, processa e audita os dados públicos de votações nominais e presenças de Deputados e Senadores.",
};

export default function SobrePage() {
  return (
    <div className="ruido-manifesto-page space-y-12">
      {/* Back button */}
      <div>
        <Link
          href="/"
          className="btn-punk font-mono text-xs font-bold px-3 py-1.5 inline-flex items-center gap-1.5"
        >
          <span>&larr; VOLTAR AO INÍCIO</span>
        </Link>
      </div>

      <div className="border-2 border-ink bg-punk-acid p-3 text-sm font-mono font-bold">
        O QUE O PROJETO JÁ TEM, E O QUE FALTA? <Link href="/cobertura" className="underline ml-2 text-punk-red">VER RELATÓRIO PÚBLICO ↗</Link>
      </div>



      {/* PUNK MANIFESTO POSTER HERO */}
      <section className="ruido-red-poster ruido-manifesto-poster relative bg-punk-red text-paper p-8 sm:p-14 border-4 border-ink shadow-[12px_12px_0_#101010] overflow-hidden">
        {/* Grime overlay */}
        <div
          className="absolute inset-0 opacity-25 pointer-events-none"
          style={{
            backgroundImage: "url('/assets/grime.png')",
            backgroundSize: "500px 500px",
          }}
        />

        <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          <div className="ruido-manifesto-copy lg:col-span-7 space-y-4">
            <div className="inline-block bg-ink text-punk-acid font-mono font-bold text-xs px-3 py-1 tracking-widest uppercase transform -rotate-1">
              DECLARAÇÃO NÃO OFICIAL // 2026 // ED. 001
            </div>

            <h1 className="font-heavy text-4xl sm:text-6xl md:text-7xl uppercase tracking-tight text-white leading-none">
              AUDITE <span className="bg-ink text-paper px-3 py-1 inline-block transform -rotate-2">TUDO.</span>
              <br />
              NÃO CONFIE EM
              <br />
              <span className="bg-punk-acid text-ink px-3 py-1 inline-block transform rotate-1">
                GOVERNANTES<span className="text-punk-red">!</span>
              </span>
            </h1>

            <p className="font-mono text-sm sm:text-base text-paper-light max-w-xl leading-relaxed border-l-4 border-punk-acid pl-4">
              A democracia não sobrevive de discursos ensaiados nem de marquetagem digital.
              Este espaço foi construído com uma única missão: <strong>despir a retórica dos políticos e expor os números brutos</strong> de quem decide as regras do jogo.
            </p>
          </div>

          <div className="lg:col-span-5 relative flex justify-center">
            {/* Manifesto Paper Card */}
            <div className="relative ruido-paper-card bg-paper-card text-ink border-4 border-ink p-6 shadow-[10px_10px_0_#101010] transform rotate-2 hover:rotate-0 transition-transform max-w-md">
              <div className="scotch-tape" aria-hidden="true" />
              <div className="flex justify-between items-center border-b-2 border-dashed border-ink/40 pb-2 mb-3 font-mono text-[11px] font-bold">
                <span>ESTATUTO ANTI-PROPAGANDA</span>
                <span className="text-punk-red">☒ AUDITADO</span>
              </div>
              <h2 className="font-heavy text-2xl uppercase tracking-tight text-ink mb-2">
                BELEZA TAMBÉM É CONFRONTO
              </h2>
              <p className="font-mono text-xs text-ink/80 leading-relaxed mb-3">
                Não usamos filtros corporativos, nem eufemismos partidários. Dados públicos também têm lacunas. O voto individual só aparece quando registrado e disponível.
              </p>
              <div className="font-heavy text-xl uppercase bg-punk-red text-white p-2 text-center transform -rotate-1">
                FISCALIZE SEM INTERMEDIÁRIOS
              </div>
              <div className="font-marker text-right text-sm text-punk-red mt-3">
                ass.: os desconfiados ↗
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* METODOLOGIA & PRINCÍPIOS */}
      <section className="space-y-6">
        <div className="border-b-4 border-ink pb-3 flex items-center gap-3">
          <span className="font-heavy text-2xl sm:text-4xl uppercase tracking-wider text-ink bg-punk-acid px-3 py-1 border-2 border-ink shadow-[4px_4px_0_#101010]">
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Card 1 */}
          <div className="ruido-paper-card bg-paper-card border-3 border-ink p-6 shadow-[6px_6px_0_#101010] relative transform -rotate-1 hover:rotate-0 transition-all">
            <div className="scotch-tape-corner" aria-hidden="true" />
            <div className="flex justify-between items-center mb-3 pb-2 border-b-2 border-dashed border-ink/30">
              <span className="font-heavy text-xl text-punk-red">[ 01 ]</span>
              <span className="rubber-stamp rubber-stamp-green text-[10px]">FONTES OFICIAIS</span>
            </div>
            <h3 className="font-heavy text-xl sm:text-2xl uppercase tracking-tight text-ink mb-2">
              Fontes Oficiais e Cobertura Verificável
            </h3>
            <p className="font-mono text-xs sm:text-sm text-ink/80 leading-relaxed">
              Todos os registros são extraídos diretamente das APIs públicas oficiais da Câmara dos Deputados (<code>dadosabertos.camara.leg.br</code>) e do Senado Federal (<code>legis.senado.leg.br</code>), e do Portal da Transparência da Controladoria-Geral da União (CGU) para emendas. Patrimônio do TSE não possui importador ativo neste momento; a ausência de dados não indica patrimônio inexistente.
            </p>
          </div>

          {/* Card 2 */}
          <div className="ruido-paper-card bg-paper-card border-3 border-ink p-6 shadow-[6px_6px_0_#101010] relative transform rotate-1 hover:rotate-0 transition-all">
            <div className="scotch-tape-corner" aria-hidden="true" />
            <div className="flex justify-between items-center mb-3 pb-2 border-b-2 border-dashed border-ink/30">
              <span className="font-heavy text-xl text-punk-red">[ 02 ]</span>
              <span className="rubber-stamp rubber-stamp-acid text-[10px]">SEM ILUSÃO</span>
            </div>
            <h3 className="font-heavy text-xl sm:text-2xl uppercase tracking-tight text-ink mb-2">
              Votos Nominais Sem Inferências
            </h3>
            <p className="font-mono text-xs sm:text-sm text-ink/80 leading-relaxed">
              Votações com quórum nominal têm cada voto computado estritamente como registrado em ata oficial: SIM, NÃO, ABSTENÇÃO ou OBSTRUÇÃO. Votações sem lista nominal disponível ou sob segredo de votação são explicitamente demarcadas como tal.
            </p>
          </div>

          {/* Card 3 */}
          <div className="ruido-paper-card bg-paper-card border-3 border-ink p-6 shadow-[6px_6px_0_#101010] relative transform -rotate-1 hover:rotate-0 transition-all">
            <div className="scotch-tape-corner" aria-hidden="true" />
            <div className="flex justify-between items-center mb-3 pb-2 border-b-2 border-dashed border-ink/30">
              <span className="font-heavy text-xl text-punk-red">[ 03 ]</span>
              <span className="rubber-stamp rubber-stamp-red text-[10px]">ZERO PARTIDO</span>
            </div>
            <h3 className="font-heavy text-xl sm:text-2xl uppercase tracking-tight text-ink mb-2">
              Sem Intermediação Partidária
            </h3>
            <p className="font-mono text-xs sm:text-sm text-ink/80 leading-relaxed">
              O sistema não possui afiliação partidária nem financiamento público ou corporativo. As métricas exibidas refletem operações matemáticas e agregações diretas dos registros brutos oficiais da República.
            </p>
          </div>

          {/* Card 4 */}
          <div className="ruido-paper-card bg-paper-card border-3 border-ink p-6 shadow-[6px_6px_0_#101010] relative transform rotate-1 hover:rotate-0 transition-all">
            <div className="scotch-tape-corner" aria-hidden="true" />
            <div className="flex justify-between items-center mb-3 pb-2 border-b-2 border-dashed border-ink/30">
              <span className="font-heavy text-xl text-punk-red">[ 04 ]</span>
              <span className="rubber-stamp rubber-stamp-green text-[10px]">AUDITÁVEL</span>
            </div>
            <h3 className="font-heavy text-xl sm:text-2xl uppercase tracking-tight text-ink mb-2">
              Código Aberto e Auditável
            </h3>
            <p className="font-mono text-xs sm:text-sm text-ink/80 leading-relaxed">
              O código fonte, esquemas de dados e rotinas de sincronização são públicos para permitir que qualquer cidadão, jornalista independente ou pesquisador verifique e audite o processamento das informações.
            </p>
          </div>
        </div>
      </section>

      {/* FONTES DE DADOS */}
      <section className="space-y-4">
        <div className="border-b-4 border-ink pb-3">
          <span className="font-heavy text-2xl sm:text-3xl uppercase tracking-wider text-white bg-punk-red px-3 py-1 shadow-[4px_4px_0_#101010] transform rotate-1 inline-block">
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 font-mono text-xs">
          <a
            href="https://dadosabertos.camara.leg.br"
            target="_blank"
            rel="noopener noreferrer"
            className="p-4 bg-paper-light border-2 border-ink shadow-[4px_4px_0_#101010] hover:bg-punk-acid transition-all group"
          >
            <strong className="block text-sm text-ink group-hover:text-ink">
              ↗ Dados Abertos da Câmara dos Deputados
            </strong>
            <span className="text-ink/70">
              API REST oficial com proposições, votações nominais e presença de Deputados Federais.
            </span>
          </a>

          <a
            href="https://legis.senado.leg.br/dadosabertos"
            target="_blank"
            rel="noopener noreferrer"
            className="p-4 bg-paper-light border-2 border-ink shadow-[4px_4px_0_#101010] hover:bg-punk-acid transition-all group"
          >
            <strong className="block text-sm text-ink group-hover:text-ink">
              ↗ Dados Abertos do Senado Federal
            </strong>
            <span className="text-ink/70">
              API REST oficial com atividade legislativa e votações do plenário do Senado.
            </span>
          </a>

          <a
            href="https://divulgacandcontas.tse.jus.br"
            target="_blank"
            rel="noopener noreferrer"
            className="p-4 bg-paper-light border-2 border-ink shadow-[4px_4px_0_#101010] hover:bg-punk-acid transition-all group"
          >
            <strong className="block text-sm text-ink group-hover:text-ink">
              ↗ DivulgaCandContas (TSE)
            </strong>
            <span className="text-ink/70">
              Declarações de patrimônio e bens apresentadas à Justiça Eleitoral nas eleições.
            </span>
          </a>

          <a
            href="https://portaldatransparencia.gov.br"
            target="_blank"
            rel="noopener noreferrer"
            className="p-4 bg-paper-light border-2 border-ink shadow-[4px_4px_0_#101010] hover:bg-punk-acid transition-all group"
          >
            <strong className="block text-sm text-ink group-hover:text-ink">
              ↗ Portal da Transparência da CGU
            </strong>
            <span className="text-ink/70">
              Execução orçamentária federal, empenhos e pagamentos de emendas parlamentares.
            </span>
          </a>
        </div>
      </section>
    </div>
  );
}
