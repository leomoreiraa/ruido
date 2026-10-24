import test from "node:test";
import assert from "node:assert/strict";
import {mesclarClipagem} from "../lib/ai/clipagemNoticias";
const now="2026-10-23T12:00:00Z";
const artigo=(url:string)=>({url,title:"Reportagem sobre atuação legislativa",
  published:"2024-06-12T10:00:00Z",group:"bbc",republicacao:false});
test("mantém múltiplas matérias originais do mesmo veículo e datas de publicação",()=>{
  const out=mesclarClipagem([],[artigo("https://www.bbc.com/a"),artigo("https://www.bbc.com/b")],now);
  assert.equal(out.length,2);
  assert.equal(out[0].publicadoEm,"2024-06-12T10:00:00Z");
});
test("duplicata revalida mesma URL sem criar registro extra",()=>{
  const one=mesclarClipagem([],[artigo("https://www.bbc.com/a")],now);
  const two=mesclarClipagem(one,[artigo("https://www.bbc.com/a")],"2026-10-24T12:00:00Z");
  assert.equal(two.length,1);
  assert.equal(two[0].ultimaConferencia,"2026-10-24T12:00:00Z");
});
test("não inclui republicações, HTTP nem títulos sem conteúdo",()=>{
  const bad=[{...artigo("http://www.bbc.com/a")},
    {...artigo("https://www.bbc.com/b"),republicacao:true},
    {...artigo("https://www.bbc.com/c"),title:"curto"}];
  assert.deepEqual(mesclarClipagem([],bad,now),[]);
});
