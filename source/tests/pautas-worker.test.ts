import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";

type WorkerMessage = {type: string; requestId?: number; key?: string; total?: number; itens?: Array<{id:string;ementa:string}>};
const codigo = readFileSync("public/workers/pautas-search.js", "utf8");
const view = readFileSync("components/PautasFilterView.tsx","utf8");
const navbar = readFileSync("components/Navbar.tsx","utf8");
const css = readFileSync("app/globals.css","utf8");

function mockWorker() {
  const itens = Array.from({length:50_000}, (_,i) => ({
    id: "pauta-"+i, casa: i%2?"SENADO":"CAMARA", siglaTipo:i%3?"PL":"PEC",
    numero:i,ano:2026, ementa:i%500===1?"Lei de ciência e tecnologia":"Regras orçamentárias gerais",
    autorNome:"Parlamentar "+i, tituloSimples:null, resumoSimples:null,
  }));
  const enviados: WorkerMessage[] = [];
  let leituras = 0;
  const self = {postMessage(x:WorkerMessage){enviados.push(x)}, onmessage: null as null|((e:{data:unknown})=>Promise<void>)};
  const fetch = async () => {leituras++;return {ok:true,json:async()=>itens}};
  runInNewContext(codigo,{self,fetch,URL,console,Promise,Error,String,Number,Array,Map}, {timeout:5000});
  assert.ok(self.onmessage);
  return {self,enviados,leituras:()=>leituras};
}

test("50 mil proposições são filtradas dentro do Worker, devolvendo só 10 cards",async()=>{
  const worker=mockWorker();
  await worker.self.onmessage!({data:{type:"init"}});
  assert.equal(worker.enviados.at(-1)?.type,"ready");
  await worker.self.onmessage!({data:{type:"filter",requestId:3,key:"ciencia",busca:"CIÊNCIA",pagina:1,limit:10}});
  const result=worker.enviados.at(-1)!;
  assert.equal(result.type,"result");
  assert.equal(result.total,100);
  assert.equal(result.itens?.length,10);
  assert.equal(result.itens?.[0].id,"pauta-1");
  await worker.self.onmessage!({data:{type:"filter",requestId:4,key:"next",busca:"ciência",pagina:2,limit:10}});
  assert.equal(worker.enviados.at(-1)?.itens?.[0].id,"pauta-5001");
  assert.equal(worker.leituras(),1,"catalogo não deve ser baixado novamente a cada busca");
});

test("o cliente não importa todo o catálogo na thread principal",()=>{
  assert.match(view,/new Worker\("\/workers\/pautas-search\.js"\)/);
  assert.doesNotMatch(view,/await resposta\.json\(\)/);
  assert.doesNotMatch(view,/setCatalogo\(dados/);
  assert.match(view,/ITENS_POR_PAGINA = 10/);
  assert.match(view,/window\.setTimeout\(\(\) =>/);
  assert.match(view,/ruido-pauta-list/);
  assert.match(view,/ementa\.length > 340/);
  assert.match(css,/content-visibility: auto/);
});

test("a tinta da navbar fica ABAIXO do texto, sem menu de PC",()=>{
  assert.match(navbar,/<span className="ruido-nav-label">\{link\.label\}<\/span>/);
  assert.match(navbar,/\{ href: "\/sobre", label: "MANIFESTO" \}/);
  const scope=css.slice(css.indexOf(".ruido-nav a.ruido-nav-brush::before"));
  assert.match(scope,/\.ruido-nav a\.ruido-nav-brush::before\s*\{/);
  assert.match(scope,/z-index: 0 !important/);
  assert.match(scope,/\.ruido-nav a\.ruido-nav-brush > \.ruido-nav-label/);
  assert.match(scope,/z-index: 1 !important/);
  assert.match(scope,/\.ruido-nav button\.ruido-nav-toggle,/);
  assert.match(scope,/display: none !important/);
});
