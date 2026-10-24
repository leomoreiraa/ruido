import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {candidaturaPresidencialDoPerfil} from "../lib/eleicoes/candidaturaPresidencial";
const arquivo=JSON.parse(fs.readFileSync("public/data/dossies/candidaturas-presidenciais.json","utf8"));
test("senador com nome civil oficial recebe status presidencial sem mudar seu cargo",()=>{
  const result=candidaturaPresidencialDoPerfil(arquivo,{
    casa:"SENADO",externalId:"5894",nome:"Flávio Bolsonaro",
    nomeCivil:"FLAVIO NANTES BOLSONARO",
  });
  assert.equal(result?.eleicao,2026);
  assert.equal(result?.turno,2);
  assert.equal(result?.numero,"22");
  assert.equal(result?.fonteRegistro.startsWith("https://www.tse.jus.br/"),true);
});
test("não vincula por homônimo nem inventa status de eleição",()=>{
  assert.equal(candidaturaPresidencialDoPerfil(arquivo,{
    casa:"SENADO",externalId:"5894",nome:"Outra Pessoa",
    nomeCivil:"Outra Pessoa",
  }),null);
  assert.equal(candidaturaPresidencialDoPerfil(arquivo,{
    casa:"SENADO",externalId:"9999",nome:"Flávio Bolsonaro",
    nomeCivil:"FLAVIO NANTES BOLSONARO",
  }),null);
  const found=candidaturaPresidencialDoPerfil(arquivo,{
    casa:"SENADO",externalId:"5894",nome:"Flávio Bolsonaro",
    nomeCivil:"FLAVIO NANTES BOLSONARO",
  });
  assert.equal("eleito" in (found||{}),false);
});
test("somente fontes TSE HTTPS podem ser usadas",()=>{
  const changed=structuredClone(arquivo);
  changed.dados["SENADO:5894"].fonteTurno="https://example.com";
  assert.equal(candidaturaPresidencialDoPerfil(changed,{
    casa:"SENADO",externalId:"5894",nome:"Flávio Bolsonaro",
    nomeCivil:"FLAVIO NANTES BOLSONARO",
  }),null);
});
