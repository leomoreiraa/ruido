import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {validarExteriorAoVivo,validarMalhaMundi} from "../lib/eleicoesExterior";

const vazio=()=>({
 versao:1,fonte:"https://resultados.tse.jus.br/oficial",turno:2,
 estado:"aguardando_inicio",localidadesPrevistas:186,
 localidadesComResultado:0,atualizadoEm:null,paises:[]
});
test("exterior aguarda dados reais em vez de publicar votos simulados",()=>{
 assert.equal(validarExteriorAoVivo(vazio()).localidadesComResultado,0);
 assert.throws(()=>validarExteriorAoVivo({...vazio(),fonte:"fonte desconhecida"}));
 assert.throws(()=>validarExteriorAoVivo({...vazio(),localidadesPrevistas:150}));
 assert.throws(()=>validarExteriorAoVivo({...vazio(),turno:1}));
});
test("valida os totais auditáveis de cada país, incluindo cobertura local",()=>{
 const exemplo={iso:"JP",nome:"Japão",localidadesPrevistas:3,localidadesComResultado:1,
  secoesTotalizadas:5,secoesPrevistasConhecidas:10,lula:30,flavio:45,
  votosValidos:75,apuradoEm:Date.parse("2026-10-25T20:30:00Z")};
 const payload={...vazio(),estado:"parcial",localidadesComResultado:1,
  atualizadoEm:Date.parse("2026-10-25T20:31:00Z"),paises:[exemplo]};
 assert.equal(validarExteriorAoVivo(payload).paises[0].flavio,45);
 assert.throws(()=>validarExteriorAoVivo({...payload,paises:[{...exemplo,lula:130}]}));
 assert.throws(()=>validarExteriorAoVivo({...payload,paises:[{...exemplo,localidadesComResultado:4}]}));
 assert.throws(()=>validarExteriorAoVivo({...payload,localidadesComResultado:2}));
 assert.throws(()=>validarExteriorAoVivo({...payload,paises:[exemplo,exemplo]}));
});
test("a geometria mundial e o cadastro eleitoral são completos e permanecem vetoriais",()=>{
 const malha=JSON.parse(readFileSync("public/data/eleicoes-mapa-mundi-malha.json","utf8"));
 const cadastral=readFileSync("worker/exterior-localidades.mjs","utf8");
 const worker=readFileSync("worker/ruido-apuracao.mjs","utf8");
 const pagina=readFileSync("components/Eleicoes2026View.tsx","utf8");
 const mapa=readFileSync("components/MapaMundiApuracao.tsx","utf8");
 assert.ok(validarMalhaMundi(malha).paises.length>=170);
 assert.equal(new Set(malha.paises.map((p:{iso:string})=>p.iso)).size,malha.paises.length);
 assert.match(cadastral,/ABIDJÃ/);
 assert.match(cadastral,/TÓQUIO/);
 assert.match(worker,/EXTERIOR_BATCH=6/);
 assert.match(worker,/async alarm\(\)/);
 assert.match(worker,/exterior:2026:2/);
 assert.match(mapa,/<MapaZoomArea/);
 assert.match(mapa,/vectorEffect="non-scaling-stroke"/);
 assert.match(mapa,/sem resultado/i);
 assert.ok(pagina.indexOf("<MapaMundiApuracao")>pagina.indexOf("COMPARAÇÃO TERRITORIAL"));
 assert.ok(pagina.indexOf("<MapaMundiApuracao")<pagina.indexOf("FONTE, CRITÉRIOS E LIMITAÇÕES"));
 assert.doesNotMatch(pagina,/SEM SNAPSHOT PUBLICADO|Tentativas sem resposta nesta rodada/);
});
