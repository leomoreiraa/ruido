import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  normalizarVotoCamara,
  validarRespostaEnvelopeCamara,
} from "../lib/services/camaraNormalizer";
import {
  normalizarVotoSenado,
  classificarEvidenciaPresencaSenado,
  validarItemVotacaoSenado,
} from "../lib/services/senadoNormalizer";
import { OpcaoVoto, StatusPresenca } from "../lib/types";

describe("normalizarVotoCamara", () => {
  test("normaliza Sim, Não, Abstenção, Obstrução e Artigo 17", () => {
    assert.deepEqual(normalizarVotoCamara("Sim"), {
      opcaoNormalizada: OpcaoVoto.SIM,
      opcaoOriginal: "Sim",
    });
    assert.deepEqual(normalizarVotoCamara("Não"), {
      opcaoNormalizada: OpcaoVoto.NAO,
      opcaoOriginal: "Não",
    });
    assert.deepEqual(normalizarVotoCamara("NAO"), {
      opcaoNormalizada: OpcaoVoto.NAO,
      opcaoOriginal: "NAO",
    });
    assert.deepEqual(normalizarVotoCamara("Abstenção"), {
      opcaoNormalizada: OpcaoVoto.ABSTENCAO,
      opcaoOriginal: "Abstenção",
    });
    assert.deepEqual(normalizarVotoCamara("Obstrução"), {
      opcaoNormalizada: OpcaoVoto.OBSTRUCAO,
      opcaoOriginal: "Obstrução",
    });
    assert.deepEqual(normalizarVotoCamara("Art. 17"), {
      opcaoNormalizada: OpcaoVoto.ARTIGO_17,
      opcaoOriginal: "Art. 17",
    });
  });

  test("não inventa ausência para voto vazio ou nulo", () => {
    assert.deepEqual(normalizarVotoCamara(null), {
      opcaoNormalizada: "NAO_INFORMADO",
      opcaoOriginal: null,
    });
    assert.deepEqual(normalizarVotoCamara(""), {
      opcaoNormalizada: "NAO_INFORMADO",
      opcaoOriginal: null,
    });
  });

  test("preserva códigos não previstos literalmente sem converter em ausência", () => {
    assert.deepEqual(normalizarVotoCamara("VOTO_ESPECIAL_REGIMENTAL"), {
      opcaoNormalizada: "VOTO_ESPECIAL_REGIMENTAL",
      opcaoOriginal: "VOTO_ESPECIAL_REGIMENTAL",
    });
  });
});

describe("normalizarVotoSenado", () => {
  test("normaliza Sim, Não, Abstenção e Obstrução", () => {
    assert.deepEqual(normalizarVotoSenado("Sim"), {
      opcaoNormalizada: OpcaoVoto.SIM,
      siglaOriginal: "Sim",
    });
    assert.deepEqual(normalizarVotoSenado("Não"), {
      opcaoNormalizada: OpcaoVoto.NAO,
      siglaOriginal: "Não",
    });
    assert.deepEqual(normalizarVotoSenado("Abstenção"), {
      opcaoNormalizada: OpcaoVoto.ABSTENCAO,
      siglaOriginal: "Abstenção",
    });
  });

  test("distingue Presidente, P-NRV (presente sem voto) e licenças", () => {
    assert.deepEqual(normalizarVotoSenado("Presidente (art. 51 RISF)"), {
      opcaoNormalizada: OpcaoVoto.ARTIGO_17,
      siglaOriginal: "Presidente (art. 51 RISF)",
    });
    assert.deepEqual(normalizarVotoSenado("P-NRV"), {
      opcaoNormalizada: "PRESENTE_SEM_VOTO",
      siglaOriginal: "P-NRV",
    });
    assert.deepEqual(normalizarVotoSenado("AP"), {
      opcaoNormalizada: "LICENCA_OU_MISSAO",
      siglaOriginal: "AP",
    });
    assert.deepEqual(normalizarVotoSenado("LS"), {
      opcaoNormalizada: "LICENCA_OU_MISSAO",
      siglaOriginal: "LS",
    });
  });

  test("preserva votos desconhecidos", () => {
    assert.deepEqual(normalizarVotoSenado("NOVO_CODIGO_2026"), {
      opcaoNormalizada: "NOVO_CODIGO_2026",
      siglaOriginal: "NOVO_CODIGO_2026",
    });
  });
});

describe("classificarEvidenciaPresencaSenado", () => {
  test("classifica votos emitidos e P-NRV como PRESENTE", () => {
    assert.deepEqual(classificarEvidenciaPresencaSenado("Sim"), {
      status: StatusPresenca.PRESENTE,
      justificativa: null,
    });
    assert.deepEqual(classificarEvidenciaPresencaSenado("Não"), {
      status: StatusPresenca.PRESENTE,
      justificativa: null,
    });
    assert.equal(classificarEvidenciaPresencaSenado("P-NRV")?.status, StatusPresenca.PRESENTE);
    assert.equal(
      classificarEvidenciaPresencaSenado("Presidente (art. 51 RISF)")?.status,
      StatusPresenca.PRESENTE
    );
  });

  test("classifica justificativas e licenças como JUSTIFICADO", () => {
    const ap = classificarEvidenciaPresencaSenado("AP", "Atividade parlamentar");
    assert.equal(ap?.status, StatusPresenca.JUSTIFICADO);
    assert.match(ap?.justificativa ?? "", /Atividade parlamentar/);

    const ls = classificarEvidenciaPresencaSenado("LS", "Licença saúde");
    assert.equal(ls?.status, StatusPresenca.JUSTIFICADO);
  });

  test("classifica NCOM como AUSENTE", () => {
    const ncom = classificarEvidenciaPresencaSenado("NCOM", "Não compareceu");
    assert.equal(ncom?.status, StatusPresenca.AUSENTE);
  });

  test("retorna null para registros vazios ou códigos desconhecidos (sem inferência fictícia)", () => {
    assert.equal(classificarEvidenciaPresencaSenado(null), null);
    assert.equal(classificarEvidenciaPresencaSenado(""), null);
    assert.equal(classificarEvidenciaPresencaSenado("CODIGO_AINDA_NAO_DOCUMENTADO"), null);
  });
});

describe("validadores de contratos das APIs", () => {
  test("validarItemVotacaoSenado aceita objeto com codigoSessaoVotacao", () => {
    assert.doesNotThrow(() => {
      validarItemVotacaoSenado({
        codigoSessaoVotacao: 6921,
        identificacao: "PLP 192/2023",
      });
    });
  });

  test("validarItemVotacaoSenado rejeita objeto inválido", () => {
    assert.throws(() => validarItemVotacaoSenado(null), /não é um objeto/);
    assert.throws(() => validarItemVotacaoSenado({}), /codigoSessaoVotacao/);
  });

  test("validarRespostaEnvelopeCamara valida envelope", () => {
    const envelope = validarRespostaEnvelopeCamara({ dados: [{ id: 1 }] }, "teste");
    assert.deepEqual(envelope.dados, [{ id: 1 }]);
    assert.throws(() => validarRespostaEnvelopeCamara({}, "teste"), /propriedade 'dados' ausente/);
  });
});
