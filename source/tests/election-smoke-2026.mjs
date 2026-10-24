import assert from "node:assert/strict";

const site=(process.env.RUIDO_SMOKE_SITE||"https://ruido.runs-at.dev").replace(/\/+$/,"");
const api=(process.env.RUIDO_SMOKE_API||"https://ruido-apuracao.leonardo-moreira6854.workers.dev").replace(/\/+$/,"");
const abertura=Date.parse("2026-10-25T20:00:00.000Z");
const inicio=Date.now();

async function consultar(url,{origin=false}={}){
 let ultimoErro;
 for(let tentativa=1;tentativa<=3;tentativa++){
  try{
   const response=await fetch(url,{headers:origin?{Origin:site}:{},signal:AbortSignal.timeout(25000),cache:"no-store"});
   if(response.status>=500&&tentativa<3)throw new Error("HTTP "+response.status);
   return response;
  }catch(e){
   ultimoErro=e;
   if(tentativa<3)await new Promise(resolve=>setTimeout(resolve,tentativa*1500));
  }
 }
 throw new Error(url+": "+String(ultimoErro));
}
async function json(url,{origin=false}={}){
 const response=await consultar(url,{origin});
 assert.equal(response.status,200,"HTTP inesperado "+response.status+" em "+url);
 return {data:await response.json(),response};
}
function validarResultado(resultado,rotulo){
 assert.ok(resultado&&typeof resultado==="object",rotulo+": resultado ausente");
 assert.ok(["aguardando","parcial","concluida"].includes(resultado.situacao),rotulo+": situação");
 assert.ok(Number.isInteger(resultado.secoesTotalizadas)&&resultado.secoesTotalizadas>=0,rotulo+": seções totalizadas");
 assert.ok(Number.isInteger(resultado.secoesPrevistas)&&resultado.secoesPrevistas>=resultado.secoesTotalizadas,rotulo+": seções previstas");
 assert.ok(Array.isArray(resultado.candidatos),rotulo+": candidatos");
 const numeros=new Set;
 for(const c of resultado.candidatos){
  assert.match(c.numero,/^[0-9]{1,3}$/,rotulo+": número eleitoral");
  assert.ok(!numeros.has(c.numero),rotulo+": candidato duplicado");
  numeros.add(c.numero);
  assert.ok(Number.isSafeInteger(c.votos)&&c.votos>=0,rotulo+": votos inválidos");
  assert.ok(c.percentual===null||(c.percentual>=0&&c.percentual<=100),rotulo+": porcentagem inválida");
 }
 if(resultado.situacao!=="aguardando"){
  assert.ok(resultado.votosValidos>=0,rotulo+": votos válidos");
  assert.ok(resultado.candidatos.reduce((sum,c)=>sum+c.votos,0)<=resultado.votosValidos,rotulo+": soma inconsistente");
 }
}
function sucesso(nome,detalhe=""){console.log("OK "+nome+(detalhe?" | "+detalhe:""));}

const {data:health,response:healthResponse}=await json(api+"/health",{origin:true});
assert.equal(health.ok,true);
assert.equal(health.modo,"centralizado");
assert.equal(healthResponse.headers.get("access-control-allow-origin"),site);
assert.equal(health.janelaAberta,Date.now()>=abertura);
sucesso("Worker publicado, health e CORS",JSON.stringify(health));

const erroUF=await consultar(api+"/v1/apuracao/2026/presidente?uf=XX",{origin:true});
assert.equal(erroUF.status,400);
assert.equal((await erroUF.json()).erro,"UF inválida");
sucesso("Proteção contra UF incorreta");

const {data:resposta}=await json(api+"/v1/apuracao/2026/presidente?uf=BR",{origin:true});
assert.equal(resposta.versao,1);
assert.equal(resposta.fonte,"https://resultados.tse.jus.br/oficial");
if(Date.now()<abertura){
 assert.equal(resposta.estado,"aguardando_inicio");
 assert.equal(resposta.resultado,null);
 sucesso("Consulta antecipada protegida");
}else{
 assert.ok(["atual","desatualizado"].includes(resposta.estado),"API eleitoral não entregou resultado validado");
 assert.ok(Number.isSafeInteger(resposta.consultadoEm));
 validarResultado(resposta.resultado,"API BR");
 sucesso("Resultado nacional em tempo real",resposta.estado);
}

const {data:first}=await json(site+"/data/eleicoes-2026-1.json");
assert.equal(first.versao,1);
assert.equal(first.fonte,"https://resultados.tse.jus.br/oficial");
assert.equal(first.eleicao,"6257");
assert.equal(first.turno,1);
assert.equal(Object.keys(first.estados).length,27);
assert.ok(first.municipios.length>=5500);
assert.ok(first.municipiosConsultados>=Math.floor(first.municipiosPrevistos*.95));
validarResultado(first.brasil,"Primeiro turno BR");
const unique=new Set(first.municipios.map(c=>c.codigoIBGE));
assert.equal(unique.size,first.municipios.length);
for(const [uf,resultado] of Object.entries(first.estados))if(resultado)validarResultado(resultado,"UF "+uf);
sucesso("Snapshot do primeiro turno",first.municipios.length+" municípios / "+first.municipiosConsultados+" consultas");

const {data:malhas}=await json(site+"/data/municipios-brasil-malhas.json");
assert.equal(malhas.versao,1);
assert.equal(malhas.ufs.length,27);
assert.ok(malhas.totalMunicipios>=5400);
assert.equal(malhas.ufs.reduce((n,grupo)=>n+grupo.municipios.length,0),malhas.totalMunicipios);
sucesso("SVG municipal nacional",malhas.totalMunicipios+" geometrias / 27 UFs");

const {data:sp}=await json(site+"/data/municipios-malhas/SP.json");
assert.equal(sp.versao,1);
assert.equal(sp.uf,"SP");
assert.ok(sp.municipios.length>=600);
sucesso("SVG municipal de São Paulo",sp.municipios.length+" geometrias");

const {data:build}=await json(site+"/build-info.json");
assert.match(String(build.commit),/^[a-f0-9]{40}$/);
assert.match(String(build.run),/^[0-9]+$/);
sucesso("Identificação de deploy público",build.commit.slice(0,12)+" / "+build.run);

const html=await consultar(site+"/eleicoes/");
assert.equal(html.status,200);
const page=await html.text();
assert.ok(page.includes("ELEIÇÕES")&&page.includes("MAPA DE VOTOS"));
sucesso("HTML da página eleitoral");

console.log("PRÉ-VOO CONCLUÍDO: "+((Date.now()-inicio)/1000).toFixed(1)+" segundos");
