import test from "node:test";
import assert from "node:assert/strict";
import {
  normalizarVotoSenado,
  classificarEvidenciaPresencaSenado,
  validarItemVotacaoSenado,
} from "../lib/services/senadoNormalizer";
import { normalizarVotoCamara, validarRespostaEnvelopeCamara } from "../lib/services/camaraNormalizer";
import { OpcaoVoto, StatusPresenca } from "../lib/types";

test("Senado: normalização de votos preservando valores literais desconhecidos", () => {
  // Padrões
  assert.equal(normalizarVotoSenado("Sim").opcaoNormalizada, OpcaoVoto.SIM);
  assert.equal(normalizarVotoSenado("Não").opcaoNormalizada, OpcaoVoto.NAO);
  assert.equal(normalizarVotoSenado("Nao").opcaoNormalizada, OpcaoVoto.NAO);
  assert.equal(normalizarVotoSenado("Abstenção").opcaoNormalizada, OpcaoVoto.ABSTENCAO);
  assert.equal(normalizarVotoSenado("Obstrução").opcaoNormalizada, OpcaoVoto.OBSTRUCAO);
  assert.equal(normalizarVotoSenado("Presidente (art. 51 RISF)").opcaoNormalizada, OpcaoVoto.ARTIGO_17);

  // Sem voto ou licença
  assert.equal(normalizarVotoSenado("P-NRV").opcaoNormalizada, "PRESENTE_SEM_VOTO");
  assert.equal(normalizarVotoSenado("AP").opcaoNormalizada, "LICENCA_OU_MISSAO");
  assert.equal(normalizarVotoSenado("LS").opcaoNormalizada, "LICENCA_OU_MISSAO");
  assert.equal(normalizarVotoSenado("MIS").opcaoNormalizada, "LICENCA_OU_MISSAO");

  // Não inventa ausência para código desconhecido
  const desconhecido = normalizarVotoSenado("CODIGO_ESPECIAL_XYZ");
  assert.equal(desconhecido.opcaoNormalizada, "CODIGO_ESPECIAL_XYZ");
  assert.equal(desconhecido.siglaOriginal, "CODIGO_ESPECIAL_XYZ");

  // Voto sem código não pode ser interpretado como ausência
  assert.equal(normalizarVotoSenado("").opcaoNormalizada, "NAO_INFORMADO");
  assert.equal(normalizarVotoSenado(null).opcaoNormalizada, "NAO_INFORMADO");
});

test("Senado: classificação de evidência de presença (presença ganha e presidente presente)", () => {
  // Presidente presente
  const pres = classificarEvidenciaPresencaSenado("Presidente (art. 51 RISF)", null);
  assert.deepEqual(pres, { status: StatusPresenca.PRESENTE, justificativa: "Presidência da Sessão" });

  // P-NRV presente
  const pnrv = classificarEvidenciaPresencaSenado("P-NRV", "Presente – Não registrou voto");
  assert.equal(pnrv?.status, StatusPresenca.PRESENTE);

  // Voto sim/não presente
  const sim = classificarEvidenciaPresencaSenado("Sim", null);
  assert.equal(sim?.status, StatusPresenca.PRESENTE);

  // AP / LS justificados
  const ap = classificarEvidenciaPresencaSenado("AP", "Atividade parlamentar");
  assert.equal(ap?.status, StatusPresenca.JUSTIFICADO);

  const ls = classificarEvidenciaPresencaSenado("LS", "Licença saúde");
  assert.equal(ls?.status, StatusPresenca.JUSTIFICADO);

  // NCOM ausente explícito no registro
  const ncom = classificarEvidenciaPresencaSenado("NCOM", "Não compareceu");
  assert.equal(ncom?.status, StatusPresenca.AUSENTE);

  // Nulo se não houver siglaVoto (nunca inventa presença/ausência do nada)
  assert.equal(classificarEvidenciaPresencaSenado(null, null), null);
  assert.equal(classificarEvidenciaPresencaSenado("", null), null);
});

test("Senado: validação do contrato de votação plana", () => {
  assert.throws(
    () => validarItemVotacaoSenado(null),
    /Formato inválido na resposta do Senado: item não é um objeto/
  );

  assert.throws(
    () => validarItemVotacaoSenado({ ano: 2025 }),
    /Formato inválido na resposta do Senado: 'codigoSessaoVotacao' ausente/
  );

  // Item válido não lança exceção
  assert.doesNotThrow(() =>
    validarItemVotacaoSenado({
      codigoSessaoVotacao: 6921,
      casaSessao: "SF",
      dataSessao: "2025-03-18",
    })
  );
});

test("Câmara: normalização de votos preservando valores desconhecidos", () => {
  assert.equal(normalizarVotoCamara("Sim").opcaoNormalizada, OpcaoVoto.SIM);
  assert.equal(normalizarVotoCamara("Não").opcaoNormalizada, OpcaoVoto.NAO);
  assert.equal(normalizarVotoCamara("Abstenção").opcaoNormalizada, OpcaoVoto.ABSTENCAO);
  assert.equal(normalizarVotoCamara("Obstrução").opcaoNormalizada, OpcaoVoto.OBSTRUCAO);
  assert.equal(normalizarVotoCamara("Art. 17").opcaoNormalizada, OpcaoVoto.ARTIGO_17);

  // Desconhecido preservado literalmente
  assert.equal(normalizarVotoCamara("NOVO_PROCEDIMENTO").opcaoNormalizada, "NOVO_PROCEDIMENTO");
  assert.equal(normalizarVotoCamara("NOVO_PROCEDIMENTO").opcaoOriginal, "NOVO_PROCEDIMENTO");

  // Nulo
  assert.equal(normalizarVotoCamara(null).opcaoNormalizada, "NAO_INFORMADO");
});

test("Câmara: validação de resposta envelope com falha para formato corrompido", () => {
  assert.throws(
    () => validarRespostaEnvelopeCamara(null, "teste"),
    /Resposta inválida da API da Câmara/
  );

  assert.throws(
    () => validarRespostaEnvelopeCamara({ status: "ok" }, "teste"),
    /propriedade 'dados' ausente/
  );

  const envelopeValido = validarRespostaEnvelopeCamara<Array<{ id: number }>>({ dados: [{ id: 1 }] }, "teste");
  assert.equal(envelopeValido.dados.length, 1);
});
