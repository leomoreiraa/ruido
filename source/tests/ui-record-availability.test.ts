import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { VotacaoItem } from "../components/VotacaoItem";
import { VotacaoVotosList } from "../components/VotacaoVotosList";
import { EmendasTrackerView, EmendasTrackerViewProps } from "../components/EmendasTrackerView";
import { ParlamentarHistoricoTabs } from "../components/ParlamentarHistoricoTabs";

const vote = {
  id: "v1", externalId: "1", casa: "CAMARA", dataHora: "2024-01-01T12:00:00Z",
  descricao: "Votação de teste", placarSim: 0, placarNao: 0, placarAbstencao: 0,
};
const unsupported = /simbólica|consenso|acordo|concluído/i;

test("empty voting scores preserve known outcomes without inferring procedure", () => {
  for (const aprovada of [true, false, null, undefined]) {
    const html = renderToStaticMarkup(React.createElement(VotacaoItem, { ...vote, aprovada }));
    assert.match(html, /Contagem de votos não publicada/);
    assert.doesNotMatch(html, unsupported);
    assert.match(html, aprovada === true ? /APROVADO/ : aprovada === false ? /NÃO APROVADO/ : /RESULTADO NÃO INFORMADO/);
  }
});

test("empty nominal lists distinguish secret records without inventing outcomes", () => {
  for (const votacaoSecreta of [false, true]) {
    const html = renderToStaticMarkup(React.createElement(VotacaoVotosList, { votos: [], votacaoSecreta }));
    assert.match(html, votacaoSecreta ? /Votos individuais indisponíveis/ : /Não há lista individual de votos/);
    assert.doesNotMatch(html, unsupported);
    if (votacaoSecreta) assert.match(html, /Votação Secreta/);
  }
  const secret = renderToStaticMarkup(React.createElement(VotacaoItem, { ...vote, votacaoSecreta: true }));
  assert.match(secret, /SECRETA/);
});

test("populated voting scores and nominal lists remain visible", () => {
  const html = renderToStaticMarkup(React.createElement(VotacaoItem, { ...vote, placarSim: 12, placarNao: 3, aprovada: true }));
  assert.match(html, /15 registros contabilizados/);
  assert.doesNotMatch(html, /Contagem de votos não publicada/);
  const list = renderToStaticMarkup(React.createElement(VotacaoVotosList, {
    votacaoSecreta: false,
    votos: [{ id: "1", opcao: "SIM", opcaoOriginal: null, partidoNaEpoca: null, ufNaEpoca: null,
      parlamentar: { id: "p1", nome: "Nome de teste", partido: "P", uf: "SP", urlFoto: null } }],
  }));
  assert.match(list, /Nome de teste/);
  assert.match(list, /VOTOS POR PARLAMENTAR/);
});

const emptyEmendas: EmendasTrackerViewProps = {
  emendasIniciais: [], rankingParlamentares: [], distribuicaoUfs: [], topMunicipios: [],
  totalGeralEmpenhado: 0, totalGeralPago: 0, totalGeralPix: 0, totalMunicipiosAtendidos: 0,
};

test("empty emendas show implementation limits rather than financial or coverage claims", () => {
  const html = renderToStaticMarkup(React.createElement(EmendasTrackerView, emptyEmendas));
  assert.match(html, /coleta utiliza a API oficial da CGU/);
  assert.match(html, /não significa ausência de emendas/);
  assert.doesNotMatch(html, /5\.570|100%|Aguardando|EM INTEGRAÇÃO|R\$|<table|<input/);
});

test("populated emendas retain table and amounts", () => {
  const html = renderToStaticMarkup(React.createElement(EmendasTrackerView, {
    ...emptyEmendas, totalGeralPago: 123, totalGeralEmpenhado: 456, totalMunicipiosAtendidos: 1,
    emendasIniciais: [{ id: "e1", parlamentarId: "p1", ano: 2024, tipo: "INDIVIDUAL", descricao: "Objeto de teste", valorEmpenhado: 456, valorPago: 123, status: "PAGO", fonte: "TESTE" }],
  }));
  assert.match(html, /<table/);
  assert.match(html, /Objeto de teste/);
  assert.match(html, /R\$\s*123/);
  assert.doesNotMatch(html, /importador de emendas ainda/);
});

test("empty parliamentary voting history does not imply absence", () => {
  const html = renderToStaticMarkup(React.createElement(ParlamentarHistoricoTabs, { votos: [], presencas: [], parlamentarNome: "Teste" }));
  assert.match(html, /nos registros consultados/);
  assert.match(html, /não indica falta à sessão/);
});
