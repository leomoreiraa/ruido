
const configured=Number(process.env.GEMINI_FREE_MIN_INTERVAL_MS || "35000");
const intervalMs=Math.max(30000,Math.min(120000,Number.isFinite(configured)?configured:35000));
const sleep=(ms:number)=>new Promise<void>(resolve=>setTimeout(resolve,ms));
let nextRequestAt=0;
export function retryAfterMilliseconds(value:string|null,now=Date.now()):number|null{
  if(!value)return null;
  const seconds=Number(value.trim());
  if(Number.isFinite(seconds) && seconds>=0)return Math.ceil(seconds*1000);
  const date=Date.parse(value);
  return Number.isFinite(date)?Math.max(0,date-now):null;
}
export async function geminiFreeFetch(url:string,key:string,body:unknown,timeoutMs=50000):Promise<Response>{
  for(let attempt=0;attempt<3;attempt++){
    const wait=Math.max(0,nextRequestAt-Date.now());
    if(wait)await sleep(wait);
    nextRequestAt=Date.now()+intervalMs;
    let response:Response;
    try{
      response=await fetch(url,{
        method:"POST",signal:AbortSignal.timeout(timeoutMs),
        headers:{"Content-Type":"application/json","x-goog-api-key":key},
        body:JSON.stringify(body)
      });
    }catch(error){
      if(attempt<2){await sleep((attempt+1)*3000);continue;}
      throw error;
    }
    if(response.ok)return response;
    if(response.status===429){
      const info=(await response.text()).slice(0,3000);
      const daily=/GenerateRequestsPerDay|RequestsPerDay|requests_per_day|quota[^\n]{0,80}day|RPD|free_tier_requests/i.test(info);
      const retry=retryAfterMilliseconds(response.headers.get("retry-after"));
      if(daily || retry===null || retry>45000 || attempt>=1)
        throw new Error("Gemini HTTP 429: cota gratuita atingida; checkpoint preservado");
      await sleep(Math.max(1000,retry));
      continue;
    }
    if([408,500,502,503,504].includes(response.status)&&attempt<2){
      await sleep(5000*2**attempt+Math.floor(Math.random()*3000));
      continue;
    }
    throw new Error("Gemini HTTP "+response.status);
  }
  throw new Error("Gemini: tentativas temporarias esgotadas");
}
