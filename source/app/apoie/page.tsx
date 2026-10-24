import Link from "next/link";
import { ExternalLink, HandCoins, ShieldCheck, HeartHandshake } from "lucide-react";
import { ApoiePixCopiar } from "@/components/ApoiePixCopiar";
import { RUIDO_PIX_KEY, RUIDO_PIX_COPIA_E_COLA } from "@/lib/pix-brcode";
import { RuidoPixQr } from "@/components/RuidoPixQr";

export const metadata = {
  title: "Apoie o RUÍDO | Transparência política independente",
  description: "Apoie o RUÍDO com Pix direto ou colabore com o projeto de código aberto, sem plataformas de arrecadação.",
};

const repo = "https://github.com/leomoreiraa/ruido";

export default function ApoiePage() {
  return (
    <div className="mx-auto max-w-5xl space-y-10 font-mono">
      <header className="relative overflow-hidden border-[5px] border-ink bg-paper-card p-6 shadow-[9px_9px_0_#101010] sm:p-10">
        <span className="inline-block -rotate-2 bg-punk-red px-4 py-2 font-heavy text-xs uppercase tracking-widest text-white">
          
        </span>
        <h1 className="mt-7 max-w-4xl font-heavy text-5xl uppercase leading-[0.92] text-ink sm:text-7xl">
          INFORMAÇÃO <span className="text-punk-red">NÃO SE CALA.</span>
        </h1>
        <p className="mt-6 max-w-3xl border-l-[5px] border-punk-acid pl-4 text-sm leading-relaxed text-ink sm:text-base">
          O RUÍDO transforma dados públicos sobre políticos e votações em informação acessível.
          Você pode ajudar a manter o projeto sem intermediários: contribua diretamente por Pix
          ou participe da construção do código aberto.
        </p>
        <div className="mt-7 flex flex-wrap items-center gap-2 text-[11px] font-bold uppercase tracking-wide">
          <span className="border-2 border-ink bg-punk-acid px-3 py-1 text-ink">INDEPENDENTE</span>
          <span className="border-2 border-ink bg-paper-light px-3 py-1 text-ink">CÓDIGO ABERTO</span>
          <span className="border-2 border-ink bg-paper-light px-3 py-1 text-ink">FONTES VERIFICÁVEIS</span>
        </div>
      </header>

      <section aria-labelledby="apoie-opcoes" className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="apoie-opcoes" className="font-heavy text-3xl uppercase text-ink sm:text-4xl">
          </h2>
          <span className="font-mono text-xs font-bold uppercase text-ink/75">
            Toda contribuição é voluntária.
          </span>
        </div>
        <div className="grid gap-5 md:grid-cols-5">
          <article id="pix" className="scroll-mt-8 border-4 border-ink bg-paper-card p-6 shadow-[6px_6px_0_#e42232] sm:p-8 md:col-span-3">
            <div className="flex items-center justify-between gap-3">
              <span className="bg-punk-red px-3 py-1 font-heavy text-sm uppercase text-white">
                01 / CONTRIBUIÇÃO FINANCEIRA
              </span>
              <HandCoins size={26} aria-hidden="true" />
            </div>
            <h3 className="mt-5 font-heavy text-3xl uppercase leading-none text-ink sm:text-4xl">
              PIX DIRETO.
            </h3>
            <p className="mt-4 text-sm leading-relaxed text-ink">
              Envie qualquer valor diretamente para o responsável pelo RUÍDO.
              Sem cadastro no site, sem assinatura e sem empresa intermediando a contribuição.
              O pagamento é feito no aplicativo do seu banco.
            </p>
            <div className="mt-6 grid items-start gap-5 sm:grid-cols-2">
              <div className="w-full min-w-0 border-[3px] border-ink bg-white p-3 shadow-[4px_4px_0_#101010]">
                <RuidoPixQr />
                <p className="mt-3 text-center font-mono text-[11px] font-bold uppercase text-ink">
                  Escaneie com seu banco
                </p>
              </div>
              <ApoiePixCopiar chave={RUIDO_PIX_KEY} copiaECola={RUIDO_PIX_COPIA_E_COLA} />
            </div>
            <p className="mt-4 text-xs leading-relaxed text-ink/80">
              Confira sempre o nome do titular apresentado pelo banco antes de confirmar.
              Uma chave aleatória não oculta o nome do recebedor.
            </p>
          </article>

          <article className="flex flex-col border-4 border-ink bg-paper-card p-6 shadow-[6px_6px_0_#101010] sm:p-8 md:col-span-2">
            <div className="flex items-center justify-between gap-3">
              <span className="bg-ink px-3 py-1 font-heavy text-sm uppercase text-punk-acid">
                02 / SEM DINHEIRO
              </span>
              <HeartHandshake size={26} aria-hidden="true" />
            </div>
            <h3 className="mt-5 font-heavy text-3xl uppercase leading-none text-ink">
              FAÇA PARTE.
            </h3>
            <p className="mt-4 flex-1 text-sm leading-relaxed text-ink">
              Você também pode sugerir funcionalidades, revisar fontes, relatar
              erros e contribuir com código. Essas contribuições ajudam a manter
              o projeto transparente e aberto.
            </p>
            <a
              href={repo}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-6 inline-flex min-h-12 items-center justify-between gap-3 border-[3px] border-ink bg-punk-acid px-5 py-3 font-heavy text-sm uppercase text-ink shadow-[4px_4px_0_#111] transition-transform hover:-translate-y-1"
            >
              VER CÓDIGO NO GITHUB <ExternalLink size={18} aria-hidden="true" />
            </a>
          </article>
        </div>
      </section>

      <section className="grid gap-5 md:grid-cols-2">
        <div className="border-[3px] border-ink bg-paper-light p-6 sm:p-8">
          <h2 className="flex items-center gap-3 font-heavy text-2xl uppercase text-ink">
            <ShieldCheck size={28} aria-hidden="true" /> NÃO COMPRAMOS SILÊNCIO
          </h2>
          <p className="mt-4 text-sm leading-relaxed text-ink">
            Apoiar o RUÍDO não dá direito a escolher quem será analisado, retirar notícias,
            mudar dados ou influenciar avaliações. Correções devem ser fundamentadas
            em documentos e seguir os mesmos critérios para todos.
          </p>
        </div>
        <div className="border-[3px] border-ink bg-paper-light p-6 sm:p-8">
          <h2 className="font-heavy text-2xl uppercase text-ink">
          <p className="mt-4 text-sm leading-relaxed text-ink">
            Divulgaremos informações agregadas e verificáveis sobre receitas e despesas
            do projeto à medida que houver movimentação. Dados pessoais de
            apoiadores não serão publicados sem consentimento.
          </p>
          <p className="mt-3 text-xs font-bold uppercase text-ink/75">
            Nenhum valor arrecadado é apresentado sem comprovação.
          </p>
        </div>
      </section>

      <p className="border-t-2 border-dashed border-ink/50 pt-5 text-xs leading-relaxed text-ink/80">
        O RUÍDO é um projeto independente, não um órgão público. Contribuições recebidas
        por pessoa física podem ter implicações tributárias.{" "}
        <Link href="/sobre" className="font-bold text-punk-red underline">
          Conheça o manifesto e a metodologia.
        </Link>
      </p>
    </div>
  );
}
