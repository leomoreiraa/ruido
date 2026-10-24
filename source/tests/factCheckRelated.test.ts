import test from "node:test";
import assert from "node:assert/strict";
import { buscarChecagensExternas, checagemRealmenteRelacionada } from "../lib/ai/factCheckRelated";

test("checagem deve citar a pessoa e termos específicos do assunto",()=>{
  assert.equal(checagemRealmenteRelacionada(
    "João da Silva","Segundo o jornal, João da Silva debate merenda escolar",
    "João da Silva desviou merenda escolar?"),true);
  assert.equal(checagemRealmenteRelacionada(
    "João da Silva","Segundo o jornal, João da Silva debate merenda escolar",
    "Jornal publicou pesquisa de segurança pública"),false);
  assert.equal(checagemRealmenteRelacionada(
    "João da Silva","Segundo o jornal, João da Silva debate merenda escolar",
    "Outro João comenta merenda escolar"),false);
});
test("ausência de chave não faz rede e não bloqueia cobertura jornalística",async()=>{
  const r=await buscarChecagensExternas("João da Silva","Merenda escolar",undefined);
  assert.deepEqual(r,[]);
});
