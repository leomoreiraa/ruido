import test from "node:test";
import assert from "node:assert/strict";
import { agruparReportagens, termosDeEvento } from "../lib/ai/agruparNoticias";

function article(group: string, title: string, day = "2026-10-20", id = group) {
  return {url:"https://example.org/"+id,title,group,published:day+"T12:00:00Z"};
}

test("quatro veículos independentes sobre mesmo acontecimento vão juntos à triagem",()=>{
  const reports=[
    article("globo","Deputado João da Silva participa de audiência sobre merenda escolar"),
    article("folha","Audiência sobre merenda escolar conta com João da Silva"),
    article("estado","Merenda escolar: João da Silva participa de audiência"),
    article("cnn","João da Silva fala em audiência sobre merenda escolar"),
    article("globo","João da Silva participa de evento de segurança pública","2026-10-20","outro"),
  ];
  const clusters=agruparReportagens(reports,"João da Silva");
  assert.ok(clusters.length>=1);
  assert.equal(new Set(clusters[0].map(r=>r.group)).size,4);
  assert.ok(!clusters[0].some(r=>r.url.endsWith("/outro")));
});
test("manchetes sobre dois fatos sem assunto comum não viram notícia conjunta",()=>{
  const reports=[
    article("globo","Deputado Maria Souza debate merenda escolar"),
    article("folha","Maria Souza anuncia encontro sobre transporte urbano"),
    article("estado","Maria Souza comenta reforma tributária"),
    article("cnn","Maria Souza apresenta debate sobre pesquisas científicas"),
  ];
  assert.deepEqual(agruparReportagens(reports,"Maria Souza"),[]);
});
test("quatro links do mesmo grupo editorial não são quatro fontes",()=>{
  const reports=Array.from({length:5},(_,i)=>
    article("globo","Deputado João da Silva debate merenda escolar","2026-10-20","r"+i));
  assert.equal(agruparReportagens(reports,"João da Silva").length,0);
});
test("matérias separadas por mais de 14 dias não formam mesmo acontecimento",()=>{
  const reports=[
    article("globo","João da Silva debate merenda escolar","2026-09-20"),
    article("folha","João da Silva debate merenda escolar"),
    article("estado","João da Silva debate merenda escolar"),
    article("cnn","João da Silva debate merenda escolar"),
  ];
  assert.equal(agruparReportagens(reports,"João da Silva").length,0);
});
test("palavras do nome e cargo não são evidência de um fato",()=>{
  const words=termosDeEvento("Deputado João da Silva discute merenda escolar","João da Silva");
  assert.ok(words.has("merenda"));
  assert.ok(words.has("escolar"));
  assert.ok(!words.has("deputado"));
  assert.ok(!words.has("silva"));
});
