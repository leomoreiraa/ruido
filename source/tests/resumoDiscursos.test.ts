import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { extrairResumoAlgoritmico } from "../lib/ai/resumoDiscursos";

describe("resumoDiscursos: extração determinística de tópicos e keywords", () => {
  test("extrai exatamente 5 palavras-chave em caixa alta a partir de transcrições", () => {
    const discursosExemplo = [
      {
        sumario: "Defesa enfática da reforma tributária e da responsabilidade fiscal dos municípios.",
        transcricao: "Sr. Presidente, precisamos aprovar a reforma tributária com responsabilidade fiscal e transparência nos gastos com saúde e educação pública.",
      },
      {
        sumario: "Cobrança de investimentos em saúde e hospitais regionais.",
        transcricao: "A saúde pública e os hospitais municipais necessitam de recursos do orçamento federal urgentemente.",
      },
    ];

    const resultado = extrairResumoAlgoritmico(discursosExemplo);

    assert.equal(resultado.keywords.length, 5);
    for (const kw of resultado.keywords) {
      assert.equal(typeof kw, "string");
      assert.equal(kw, kw.toUpperCase());
    }
  });

  test("produz resumo em exatamente 3 linhas estruturadas", () => {
    const discursosExemplo = [
      {
        sumario: "Pronunciamento sobre fiscalização de obras de transporte.",
        transcricao: "Fiscalização severa nas obras de transporte e rodovias federais.",
      },
    ];

    const resultado = extrairResumoAlgoritmico(discursosExemplo);
    const linhas = resultado.resumo.split("\n");

    assert.equal(linhas.length, 3);
    assert.ok(linhas[0].length > 15);
    assert.ok(linhas[1].length > 15);
    assert.ok(linhas[2].length > 15);
  });

  test("preenche com keywords institucionais caso a lista seja curta", () => {
    const resultado = extrairResumoAlgoritmico([]);
    assert.equal(resultado.keywords.length, 5);
    assert.ok(resultado.keywords.includes("ORÇAMENTO"));
    assert.ok(resultado.keywords.includes("TRANSPARÊNCIA"));
    assert.equal(resultado.modeloUsado, "extrativo-tematico-v1");
  });
});
