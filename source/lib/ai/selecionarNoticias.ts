/** Filtra fila por sigla partidária e prioriza apenas identidades únicas. */
export type PessoaNoticia = {id:string;nome:string;nomeCivil:string|null;partido:string};
export const nomeNormal = (s:string) => s.normalize("NFKD").replace(/[\u0300-\u036f]/g,"")
  .toLowerCase().replace(/\s+/g," ").trim();
export function selecionarNoticias<T extends PessoaNoticia>(
  ativos:T[],partido:string,nomes:string[],cursorGeral:number,cursorPartido:number
){
  const sigla=partido.trim().toUpperCase();
  const focado=Boolean(sigla || nomes.length);
  const base=sigla?ativos.filter(p=>p.partido.trim().toUpperCase()===sigla):ativos;
  if(!base.length)throw Error("Nenhum parlamentar ativo encontrado para "+sigla);
  const prioridade:T[]=[];
  for(const pedido of nomes){
    const termos=nomeNormal(pedido).split(" ").filter(Boolean);
    if(termos.length<2)throw Error("Nome prioritário não específico: "+pedido);
    const candidaturas=base.filter(p=>[p.nome,p.nomeCivil].filter((n):n is string=>!!n).some(n=>{
      const tokens=nomeNormal(n).split(" ");
      return termos.every(t=>tokens.includes(t));
    }));
    if(candidaturas.length!==1)throw Error("Identidade prioritária não única na base oficial: "+pedido+
      " ("+candidaturas.length+" correspondências)");
    if(!prioridade.some(x=>x.id===candidaturas[0].id))prioridade.push(candidaturas[0]);
  }
  const ids=new Set(prioridade.map(p=>p.id));
  const outros=base.filter(p=>!ids.has(p.id));
  const from=focado?cursorPartido:cursorGeral;
  const offset=outros.length?Math.max(0,Math.trunc(from||0))%outros.length:0;
  return {fila:[...prioridade,...outros.slice(offset),...outros.slice(0,offset)],
    ids,focado,offset,totalOutros:outros.length,chave:sigla||"TODOS"};
}
