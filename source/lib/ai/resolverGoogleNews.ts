/**
 * Resolução opcional, limitada e sem credenciais de links do RSS do Google
 * Notícias. O endereço do agregador NÃO serve como evidência. A API RPC é
 * não documentada e pode falhar: tratar 429/consentimento como indisponibilidade.
 */
export function extrairUrlGoogleNews(value: unknown): string | null {
  if (!Array.isArray(value)) return null;
  const frame=value.find(x=>Array.isArray(x) && x[0]==="wrb.fr" && x[1]==="Fbv4je");
  if (!frame || typeof frame[2]!=="string") return null;
  try {
    const decoded:unknown=JSON.parse(frame[2]);
    if(!Array.isArray(decoded)||decoded[0]!=="garturlres"||
      typeof decoded[1]!=="string")return null;
    const url=new URL(decoded[1]);
    if(url.protocol!=="https:"||url.username||url.password||
      url.hostname==="news.google.com"||url.hostname.endsWith(".google.com"))
      return null;
    return url.toString();
  }catch{return null}
}
let unavailable=false, requests=0;
const BUDGET=72;
export async function resolverUrlGoogleNews(input:string):Promise<string|null> {
  if(unavailable||requests>=BUDGET)return null;
  let link:URL;
  try {link=new URL(input)}catch{return null}
  if(link.protocol!=="https:"||link.hostname!=="news.google.com"||
     !/^\/(?:rss\/)?articles\/[A-Za-z0-9_-]+\/?$/.test(link.pathname))return null;
  const id=link.pathname.split("/").filter(Boolean).at(-1)!;
  requests++;
  try {
    const page=await fetch(link,{signal:AbortSignal.timeout(6000),
      headers:{Accept:"text/html"}});
    if(page.status===429||page.status===403){unavailable=true;return null}
    if(!page.ok)return null;
    const html=(await page.text()).slice(0,800000);
    const signature=/data-n-a-sg=["']([^"']+)["']/.exec(html)?.[1];
    const ts=/data-n-a-ts=["'](\d+)["']/.exec(html)?.[1];
    if(!signature||!ts)return null;
    const inner=JSON.stringify([
      "garturlreq",
      [["X","X",["X","X"],null,null,1,1,"BR:pt-419",null,1,null,null,null,null,null,0,1],
        "X","X",1,[1,1,1],1,1,null,0,0,null,0],
      id,Number(ts),signature
    ]);
    const req=new URLSearchParams({"f.req":JSON.stringify([[["Fbv4je",inner]]])});
    const endpoint="https://news.google.com/_/DotsSplashUi/data/batchexecute";
    const res=await fetch(endpoint,{method:"POST",signal:AbortSignal.timeout(6000),
      headers:{"Content-Type":"application/x-www-form-urlencoded;charset=UTF-8",
        Origin:"https://news.google.com",Referer:"https://news.google.com/",
        "X-Same-Domain":"1"},body:req.toString()});
    if(res.status===429||res.status===403){unavailable=true;return null}
    if(!res.ok)return null;
    const raw=(await res.text()).slice(0,100000);
    const index=raw.indexOf("\n\n");
    if(index<0)return null;
    const frames:unknown=JSON.parse(raw.slice(index+2));
    return extrairUrlGoogleNews(frames);
  }catch{return null}
}
