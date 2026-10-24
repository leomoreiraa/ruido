
export type Clipping={
  url:string; titulo:string; publicadoEm:string; grupoEditorial:string;
  ultimaConferencia:string;
};
export type ArtigoLido={
  url:string; title:string; published:string; group:string; republicacao:boolean;
};
export function mesclarClipagem(anteriores:Clipping[],artigos:ArtigoLido[],
  dataConferencia:string,limite=80):Clipping[]{
  const porUrl=new Map<string,Clipping>();
  for(const antigo of anteriores){
    if(antigo&&typeof antigo.url==="string"&&antigo.url.startsWith("https://")&&
       Number.isFinite(Date.parse(antigo.publicadoEm)))porUrl.set(antigo.url,antigo);
  }
  for(const artigo of artigos){
    if(artigo.republicacao||!artigo.url.startsWith("https://")||
      !artigo.group||!Number.isFinite(Date.parse(artigo.published))||
      artigo.title.trim().length<12)continue;
    porUrl.set(artigo.url,{
      url:artigo.url,titulo:artigo.title.slice(0,220),publicadoEm:artigo.published,
      grupoEditorial:artigo.group,ultimaConferencia:dataConferencia,
    });
  }
  return [...porUrl.values()].sort((a,b)=>Date.parse(b.publicadoEm)-Date.parse(a.publicadoEm))
    .slice(0,Math.max(0,Math.min(100,limite)));
}
