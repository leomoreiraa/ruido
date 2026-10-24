import test from "node:test";
import assert from "node:assert/strict";
import {anosDeArquivo,consultaGoogleArquivo,confirmarIdentidadeArtigo}
  from "../lib/ai/coberturaHistoricaNoticias";
test("rotaciona anos de 2018 a 2025 em 2026",()=>{
  assert.deepEqual(anosDeArquivo(undefined,2,2026).anos,[2025,2024]);
  assert.deepEqual(anosDeArquivo(7,2,2026).anos,[2018,2025]);
});
test("consulta anual sem termos valorativos",()=>{
  assert.equal(consultaGoogleArquivo("Nikolas Ferreira",2024),
    '"Nikolas Ferreira" after:2024-01-01 before:2025-01-01');
});
test("identidade exata em manchete e corpo, mesmo sem cargo próximo",()=>{
  const p={nome:"Flávio Bolsonaro",nomeCivil:"Flávio Nantes Bolsonaro",casa:"SENADO"};
  assert.equal(confirmarIdentidadeArtigo(p,"Flávio Bolsonaro divulga comunicado",
    "Flávio Bolsonaro comentou o assunto. "+("Detalhes da reportagem. ").repeat(40)),true);
});
test("nome sem manchete exige contexto parlamentar próximo",()=>{
  const p={nome:"João Silva",nomeCivil:null,casa:"CAMARA"};
  assert.equal(confirmarIdentidadeArtigo(p,"Projetos em debate",
    "O deputado João Silva apresentou uma proposta."),true);
  assert.equal(confirmarIdentidadeArtigo(p,"Projetos em debate",
    "O empresário João Silva apresentou uma proposta."),false);
  assert.equal(confirmarIdentidadeArtigo(p,"João Silva discute o tema",
    "Outra pessoa participou do encontro."),false);
});
