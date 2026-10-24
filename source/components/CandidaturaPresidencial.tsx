import type {CandidaturaPresidencial as Dados} from "@/lib/eleicoes/candidaturaPresidencial";

/** Aviso documental, não propaganda; o cargo parlamentar é preservado. */
export function CandidaturaPresidencial({dados}:{dados:Dados}){
  return <aside className="min-w-0 border-l-[7px] border-punk-acid bg-ink p-4 sm:p-5 text-paper font-mono"
    aria-label="Candidatura eleitoral registrada na Justiça Eleitoral">
    <div className="flex flex-wrap gap-2 items-center mb-2">
      <strong className="font-heavy text-xl sm:text-2xl uppercase text-punk-acid leading-tight">
        CANDIDATURA À PRESIDÊNCIA
      </strong>
      <span className="text-xs border border-punk-acid px-2 py-1">{dados.eleicao}</span>
    </div>
    <p className="text-sm leading-relaxed">
      {dados.nomeUrna} ({dados.partido}), número {dados.numero}.
      {dados.vice ? " Vice: "+dados.vice+"." : ""}
      {dados.turno===2 ? " Classificado para o segundo turno de 25/10/2026." : ""}
    </p>
    <p className="text-xs text-paper/75 mt-2">
      Registro eleitoral: {dados.situacaoRegistro}. Informação sobre candidatura
      não substitui o cargo parlamentar e não confirma eleição ou posse.
      Consulte a Justiça Eleitoral para resultados e atualizações.
    </p>
    <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-xs">
      <a className="underline underline-offset-4 break-words" href={dados.fonteRegistro}
        target="_blank" rel="noopener noreferrer">CADASTRO TSE ↗</a>
      {dados.fonteTurno&&<a className="underline underline-offset-4 break-words"
        href={dados.fonteTurno} target="_blank" rel="noopener noreferrer">SEGUNDO TURNO TSE ↗</a>}
      {dados.fontePropostas&&<a className="underline underline-offset-4 break-words"
        href={dados.fontePropostas} target="_blank" rel="noopener noreferrer">PROPOSTAS OFICIAIS ↗</a>}
    </div>
  </aside>;
}
