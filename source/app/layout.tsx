import type { Metadata } from "next";
import "./globals.css";
import { Navbar } from "@/components/Navbar";
import Link from "next/link";
import { RuidoSupportFloating } from "@/components/RuidoSupportFloating";

export const metadata: Metadata = {
  title: "RUÍDO",
  description:
    "RUÍDO: auditoria independente de dados públicos do Congresso. Consulte votações, registros de presença, emendas e indicadores regionais com fontes verificáveis e linguagem clara.",
  icons: {
    icon: [{ url: "/icon.svg", type: "image/svg+xml" }, { url: "/favicon.svg", type: "image/svg+xml" }],
    shortcut: "/icon.svg",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR">
      <body className="collage-body min-h-screen flex flex-col bg-paper text-ink relative selection:bg-punk-red selection:text-white">
        {/* Grain overlay for photocopy/grime effect */}
        <div className="grain-overlay" aria-hidden="true" />

        {/* Link permanente para apoiar, com área segura em mobile. */}
        <RuidoSupportFloating />

        {/* Main Navigation */}
        <Navbar />

        {/* Faixa lambe-lambe, rolando sem JavaScript; duplicação apenas visual. */}
        <div className="ruido-status-strip ruido-marquee-band relative z-20" aria-label="RUÍDO — dados públicos, política sob lupa">
          <div className="ruido-marquee-track" aria-hidden="true">
            {[0, 1].map((indice) => (
              <div className="ruido-marquee-segment" key={indice}>
                <span>/// DADOS PÚBLICOS • CONGRESSO NACIONAL</span>
                <span>/// POLÍTICA SOB LUPA</span>
                <span>/// SEM MAQUIAGEM • FONTES OFICIAIS</span>
                <span>/// VOTOS, PRESENÇAS E EMENDAS</span>
              </div>
            ))}
          </div>
        </div>

        {/* Main Content Area */}
        <main className="ruido-site-content flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 relative z-10">
          {children}
        </main>

        {/* Decorative divider before footer */}
        <div className="spikes-strip mt-12 mb-0" aria-hidden="true" />

        {/* Punk Footer */}
        <footer className="bg-ink text-paper border-t-8 border-ink pt-12 pb-8 px-4 sm:px-8 relative overflow-hidden">
          {/* Halftone texture background in footer */}
          <div
            className="absolute inset-0 opacity-10 pointer-events-none"
            style={{
              backgroundImage: "radial-gradient(#ffffff 1px, transparent 1.5px)",
              backgroundSize: "8px 8px",
            }}
          />

          <div className="max-w-7xl mx-auto relative z-10">
            <div className="mb-9 flex flex-col sm:flex-row items-center sm:items-start gap-5 border-b-2 border-dashed border-paper/30 pb-7">
              <img src="/assets/skull-xerox.svg" className="collage-footer-mascot" width="92" height="102"
                alt="Caveira xerox — mascote do RUÍDO" loading="lazy" />
              <div>
                <div className="font-heavy uppercase text-3xl sm:text-4xl text-paper">RUÍDO <span className="text-punk-acid">///</span> DADOS ABERTOS</div>
                <p className="font-mono text-xs sm:text-sm text-paper/75 mt-2 max-w-3xl">
                  Votos, presenças e emendas com fontes verificáveis.
                </p>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-12 gap-8 mb-10 pb-8 border-b-2 border-dashed border-paper/30">
              {/* Brand and Manifesto Statement */}
              <div className="md:col-span-6 space-y-4">
                <div className="inline-block transform -rotate-3">
                  <span className="bg-punk-red text-white font-heavy text-3xl sm:text-5xl px-3 py-1 tracking-tight border-3 border-white shadow-[5px_5px_0_#d8f53e] inline-block">
                    RUÍDO
                  </span>
                </div>
                <p className="font-mono text-xs sm:text-sm text-paper-dark max-w-md leading-relaxed border-l-4 border-punk-acid pl-3">
                  Registros oficiais, sem inventar dados ausentes.
                </p>
                <div className="flex items-center gap-3 text-xs font-mono text-punk-acid">
                  <span className="inline-block w-2.5 h-2.5 bg-punk-acid" />
                  <span>CÂMARA • SENADO • FONTES PÚBLICAS</span>
                </div>
              </div>

              {/* Navigation Links */}
              <div className="md:col-span-3 space-y-2 font-mono text-sm">
                <h4 className="font-heavy text-lg tracking-wider text-punk-acid uppercase border-b border-punk-red/60 pb-1 mb-3">
                </h4>
                <ul className="space-y-1.5 text-xs text-paper-dark">
                  <li>
                    <Link href="/parlamentares" className="hover:text-punk-acid hover:translate-x-1 inline-block transition-transform">
                      &rarr; Parlamentares (Deputados &amp; Senadores)
                    </Link>
                  </li>
                  <li>
                    <Link href="/pautas" className="hover:text-punk-acid hover:translate-x-1 inline-block transition-transform">
                      &rarr; Pautas &amp; Votações em Plenário
                    </Link>
                  </li>
                  <li>
                    <Link href="/emendas" className="hover:text-punk-acid hover:translate-x-1 inline-block transition-transform">
                      &rarr; Rastreador de Emendas Parlamentares
                    </Link>
                  </li>
                  <li>
                    <Link href="/apoie" className="hover:text-punk-acid hover:translate-x-1 inline-block transition-transform">
                      &rarr; Apoiar o RUÍDO
                    </Link>
                  </li>
                  <li>
                    <Link href="/sobre" className="hover:text-punk-acid hover:translate-x-1 inline-block transition-transform">
                      &rarr; Manifesto &amp; Metodologia Aberta
                    </Link>
                  </li>
                </ul>
              </div>

              {/* Official Sources & Stamp */}
              <div className="md:col-span-3 space-y-3 font-mono text-xs">
                <h4 className="font-heavy text-lg tracking-wider text-punk-red uppercase border-b border-punk-acid/60 pb-1 mb-3">
                </h4>
                <p className="text-paper/80 leading-relaxed text-[11px]">
                  Consulte sempre o registro original.
                </p>
                <div className="space-y-1">
                  <a
                    href="https://dadosabertos.camara.leg.br"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block text-punk-acid hover:underline"
                  >
                    ↗ API Dados Abertos Câmara dos Deputados
                  </a>
                  <a
                    href="https://legis.senado.leg.br/dadosabertos"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block text-punk-acid hover:underline"
                  >
                    ↗ API Dados Abertos Senado Federal
                  </a>
                  <a
                    href="https://divulgacandcontas.tse.jus.br"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block text-punk-acid hover:underline"
                  >
                    ↗ DivulgaCandContas TSE (Patrimônio)
                  </a>
                </div>
              </div>
            </div>

            {/* Bottom bar */}
            <div className="flex flex-col sm:flex-row justify-between items-center gap-4 text-[10px] font-mono text-paper-dark uppercase">
              <div>
                © 2026 DESCONFIE DOS GOVERNANTES &bull;{" "}
                <a
                  href="https://github.com/leomoreiraa/ruido"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-bold underline underline-offset-4 hover:text-punk-acid"
                >
                  REPOSITÓRIO PÚBLICO ↗
                </a>
              </div>
              <div className="flex items-center gap-3">
                <span className="bg-punk-red text-white px-2 py-0.5 font-bold">100% CÍVICO</span>
                <span className="text-punk-acid font-bold">FONTES ABERTAS</span>
              </div>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
