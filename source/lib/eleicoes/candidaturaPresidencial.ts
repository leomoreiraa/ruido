/** Candidatura e cargo exercido são dimensões independentes. */
export type CandidaturaPresidencial={
  eleicao:number;cargo:"PRESIDENTE";candidato:string;nomeUrna:string;
  partido:string;numero:string;vice?:string;turno?:number;
  situacaoRegistro:string;fonteRegistro:string;fonteTurno?:string;
  fontePropostas?:string;origem:string;
};
export type ArquivoCandidaturas={
  version:1;atualizadoEm:string;dados:Record<string,CandidaturaPresidencial>;
};
const normalizar=(s:string)=>s.normalize("NFKD").replace(/[\u0300-\u036f]/g,"")
 .toUpperCase().replace(/[^A-Z0-9]+/g," ").trim();
const tse=(link:string)=>{try{
  const url=new URL(link);
  return url.protocol==="https:"&&url.hostname==="www.tse.jus.br"&&
    !url.username&&!url.password;
}catch{return false}};
export function candidaturaPresidencialDoPerfil(
  arquivo:unknown,p:{
    casa:string;externalId:string;nome:string;nomeCivil:string|null;
  },
):CandidaturaPresidencial|null{
  if(!arquivo||typeof arquivo!=="object")return null;
  const dados=(arquivo as Partial<ArquivoCandidaturas>).dados;
  if(!dados||typeof dados!=="object")return null;
  const c=dados[p.casa+":"+p.externalId];
  if(!c||c.cargo!=="PRESIDENTE"||!Number.isInteger(c.eleicao)||
     c.eleicao<2000||c.eleicao>2100||
     !tse(c.fonteRegistro)||!!c.fonteTurno&&!tse(c.fonteTurno)||
     !!c.fontePropostas&&!tse(c.fontePropostas)||
     !/^\d{1,2}$/.test(c.numero)||!/^[A-Z0-9-]{2,20}$/.test(c.partido))return null;
  // Nome civil completo do TSE, somente quando o perfil o contém;
  // caso contrário exige o nome de urna exato cadastrado no Parlamento.
  if(p.nomeCivil){
    if(normalizar(p.nomeCivil)!==normalizar(c.candidato))return null;
  }else if(normalizar(p.nome)!==normalizar(c.nomeUrna))return null;
  return c;
}
