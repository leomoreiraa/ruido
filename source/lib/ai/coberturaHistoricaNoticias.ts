/** Janela histórica e identidade documental: descoberta NÃO atesta veracidade. */
export function anosDeArquivo(cursor:number|undefined,quantidade:number,anoAtual:number,
  primeiroAno=2018):{anos:number[];proximoCursor:number}{
  const final=anoAtual-1;
  if(!Number.isInteger(final)||final<primeiroAno)return {anos:[],proximoCursor:0};
  const total=final-primeiroAno+1;
  const indice=typeof cursor==="number"&&Number.isInteger(cursor)&&cursor>=0?cursor%total:0;
  const size=Math.max(0,Math.min(total,Math.trunc(quantidade)));
  return {anos:Array.from({length:size},(_,i)=>final-(indice+i)%total),
    proximoCursor:(indice+size)%total};
}
export function consultaGoogleArquivo(nome:string,ano:number):string{
  const safe=nome.replace(/["<>]/g,"").trim();
  if(!safe||!Number.isInteger(ano)||ano<2000||ano>2100)throw Error("Parâmetro histórico inválido");
  return '"' + safe + '" after:'+ano+'-01-01 before:'+(ano+1)+'-01-01';
}
export type PessoaJornalistica={nome:string;nomeCivil:string|null;casa:string};
export function confirmarIdentidadeArtigo(p:PessoaJornalistica,titulo:string,artigo:string):boolean{
  const norm=(v:string)=>v.normalize("NFKD").replace(/[\u0300-\u036f]/g,"")
    .toLowerCase().replace(/[^a-z0-9]+/g," ").trim().replace(/\s+/g," ");
  const headline=" "+norm(titulo)+" ", body=" "+norm(artigo)+" ";
  const role=p.casa==="SENADO"?/\bsenador(?:a)?\b/:/\bdeputad[oa]\b/;
  const names=[p.nome,p.nomeCivil].filter((x):x is string=>!!x&&x.trim().length>=8).map(norm);
  for(const name of names){
    const needle=" "+name+" ";
    if(!body.includes(needle))continue;
    const terms=name.split(" ").filter(Boolean);
    if(terms.length>=2&&name.length>=14&&headline.includes(needle))return true;
    const pos=body.indexOf(needle);
    if(pos>=0&&role.test(body.slice(Math.max(0,pos-650),Math.min(body.length,pos+650))))
      return true;
  }
  return false;
}
