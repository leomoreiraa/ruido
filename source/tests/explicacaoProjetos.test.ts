import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { AI_MODEL, fonteHash, validarExplicacao, explicacaoFielAoObjeto } from "../lib/ai/explicacaoProjetos";

const original={casa:"CAMARA",externalId:"1234",ementa:"Dispõe sobre incentivo à formação profissional de trabalhadores."};

test("resumos invalidados quando documento, modelo ou identidade mudam",()=>{
  const hash=fonteHash(original);
  assert.match(hash,/^[0-9a-f]{64}$/);
  assert.equal(hash,fonteHash(original));
  assert.notEqual(hash,fonteHash({...original,ementa:original.ementa+" Alterada."}));
  assert.notEqual(hash,fonteHash({...original,externalId:"1235"}));
  assert.notEqual(hash,fonteHash(original,"gemini-other"));
  assert.match(AI_MODEL,/^gemini-/);
});

test("validação recusa HTML, URLs, chaves, formatos inválidos e textos vazios",()=>{
  const valid={
    titulo:"Apoio à qualificação profissional de trabalhadores",
    resumo:"A proposta pretende incentivar a formação profissional de trabalhadores. Os critérios ainda precisam ser definidos no texto da lei.",
    explicacao:"O projeto sugere criar condições para ampliar a formação profissional. A ementa não detalha valores, beneficiários ou quando isso começaria. É necessário consultar o texto original."};
  assert.deepEqual(validarExplicacao(valid),valid);
  assert.throws(()=>validarExplicacao({...valid,titulo:"<script>alert(1)</script>"}));
  assert.throws(()=>validarExplicacao({...valid,resumo:"https://example.com "+valid.resumo}));
  assert.throws(()=>validarExplicacao({...valid,resumo:"GEMINI_API_KEY "+valid.resumo}));
  assert.throws(()=>validarExplicacao({...valid,explicacao:""}));
});

test("a chave só entra no runner e nunca nas interfaces ou arquivos estáticos",()=>{
  const workflow=readFileSync(".github/workflows/deploy-gh-pages.yml","utf8");
  const generator=readFileSync("scripts/generate-project-explanations.ts","utf8");
  const listing=readFileSync("components/PautasFilterView.tsx","utf8");
  const details=readFileSync("app/pautas/[id]/page.tsx","utf8");
  assert.ok(workflow.includes("GEMINI_API_KEY: " + "$" + "{{ secrets.GEMINI_API_KEY }}"));
  assert.ok(workflow.includes("npm run ai:projetos"));
  assert.ok(generator.includes("process.env.GEMINI_API_KEY"));
  assert.doesNotMatch(listing+details,/GEMINI_API_KEY|generativelanguage\.googleapis\.com|NEXT_PUBLIC_GEMINI/);
  assert.match(details,/EMENTA OFICIAL/);
  assert.match(listing,/p\.tituloSimples \|\| \(p\.ementa\.length > 340/);
});


test("IA não substitui o conteúdo de um projeto por uma votação de urgência",()=>{
  const ementa="Altera a legislação sobre inclusão de pessoas autistas no trabalho, saúde mental e prevenção do suicídio.";
  const valido={
    titulo:"Medidas de apoio às pessoas autistas",
    resumo:"A proposta trata da inclusão de pessoas autistas no trabalho e de ações para saúde mental e prevenção do suicídio.",
    explicacao:"O texto discute apoio à inclusão de pessoas autistas e mudanças relativas ao trabalho. O detalhe precisa ser consultado na fonte oficial, pois a ementa não especifica todas as obrigações."
  };
  assert.equal(explicacaoFielAoObjeto(ementa,valido),true);
  assert.equal(explicacaoFielAoObjeto(ementa,{...valido,
    resumo:"Aprovado, por unanimidade, o Requerimento de Urgência (Art. 155 do RICO)."}),false);
  assert.equal(explicacaoFielAoObjeto(ementa,{...valido,
    resumo:"A proposta foi aprovada no plenário e agora já está em vigor."}),false);
  assert.equal(explicacaoFielAoObjeto(ementa,{...valido,
    titulo:ementa+" "+ementa}),false);
});
