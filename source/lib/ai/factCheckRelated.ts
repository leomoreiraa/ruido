
export type ChecagemExterna = {
  url:string; titulo:string; veiculo:string; avaliacao:string; afirmacao:string;
};
const clean=(s:string)=>s.normalize("NFD").replace(/[\u0300-\u036f]/g,"")
  .toLowerCase().replace(/\s+/g," ").trim();
const STOP=new Set(["sobre","segundo","deputado","deputada","senador","senadora",
  "parlamentar","publica","noticia","reportagem","ainda","partido","pela","pelos",
  "entre","para","afirma","mesmo","tambem","aquela","aquele","quais","politica"]);
export function checagemRealmenteRelacionada(
  nome:string,resumo:string,afirmacao:string,
):boolean {
  const normalizedClaim=clean(afirmacao);
  const person=clean(nome).split(" ").filter(w=>w.length>=4);
  if(!person.length || !normalizedClaim.includes(clean(nome)))return false;
  const terms=new Set((clean(resumo).match(/[a-z]{5,}/g)||[]).filter(w=>
    !STOP.has(w)&&!person.includes(w)));
  const shared=[...terms].filter(w=>normalizedClaim.includes(w)).length;
  return shared>=2;
}
export async function buscarChecagensExternas(
  nome:string,resumo:string,key:string|undefined,
):Promise<ChecagemExterna[]> {
  if(!key)return [];
  const query=nome+" "+resumo.slice(0,100);
  const endpoint=new URL("https://factchecktools.googleapis.com/v1alpha1/claims:search");
  endpoint.searchParams.set("query",query);
  endpoint.searchParams.set("languageCode","pt");
  endpoint.searchParams.set("pageSize","5");
  endpoint.searchParams.set("key",key);
  try {
    const r=await fetch(endpoint,{signal:AbortSignal.timeout(7000)});
    if(!r.ok)return [];
    const data=await r.json() as {claims?:{text?:string;claimReview?:{
      url?:string;title?:string;textualRating?:string;publisher?:{name?:string}
    }[]}[]};
    const out:ChecagemExterna[]=[];
    for(const claim of (data.claims||[]).slice(0,5)){
      if(typeof claim.text!=="string" || !checagemRealmenteRelacionada(nome,resumo,claim.text))continue;
      for(const review of claim.claimReview||[]){
        try{
          const url=new URL(review.url||"");
          if(url.protocol!=="https:"||url.username||url.password)continue;
          if(!review.publisher?.name || !review.title)continue;
          out.push({url:url.href,titulo:review.title.slice(0,180),
            veiculo:review.publisher.name.slice(0,90),
            avaliacao:(review.textualRating||"Avaliação na fonte").slice(0,90),
            afirmacao:claim.text.slice(0,220)});
        }catch{continue}
      }
    }
    return out.slice(0,2);
  }catch{return []}
}
