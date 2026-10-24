import { camaraApiClient, senadoApiClient } from "../lib/services/apiClient";

async function testApis() {
  console.log("Testando API Câmara votações 2023-02-01...");
  try {
    const resCamara2023 = await camaraApiClient.fetchJson<{ dados?: any[] }>(
      "https://dadosabertos.camara.leg.br/api/v2/votacoes?dataInicio=2023-02-01&dataFim=2023-02-28&ordem=ASC&ordenarPor=dataHoraRegistro&itens=5"
    );
    console.log("Camara 2023 votacoes:", resCamara2023?.dados?.length, resCamara2023?.dados?.[0]?.dataHoraRegistro);
  } catch (e: any) {
    console.error("Camara 2023 erro:", e.message);
  }

  console.log("Testando API Câmara votações 2019-02-01 (56ª legislatura)...");
  try {
    const resCamara2019 = await camaraApiClient.fetchJson<{ dados?: any[] }>(
      "https://dadosabertos.camara.leg.br/api/v2/votacoes?dataInicio=2019-02-01&dataFim=2019-02-28&ordem=ASC&ordenarPor=dataHoraRegistro&itens=5"
    );
    console.log("Camara 2019 votacoes:", resCamara2019?.dados?.length, resCamara2019?.dados?.[0]?.dataHoraRegistro);
  } catch (e: any) {
    console.error("Camara 2019 erro:", e.message);
  }

  console.log("Testando API Senado votações 2023-02-01...");
  try {
    const resSenado2023 = await senadoApiClient.fetchJson<any>(
      "https://legis.senado.leg.br/dadosabertos/votacao?dataInicio=2023-02-01&dataFim=2023-02-28"
    );
    console.log("Senado 2023 votacoes:", Array.isArray(resSenado2023) ? resSenado2023.length : typeof resSenado2023);
  } catch (e: any) {
    console.error("Senado 2023 erro:", e.message);
  }

  console.log("Testando API Senado votações 2019-02-01...");
  try {
    const resSenado2019 = await senadoApiClient.fetchJson<any>(
      "https://legis.senado.leg.br/dadosabertos/votacao?dataInicio=2019-02-01&dataFim=2019-02-28"
    );
    console.log("Senado 2019 votacoes:", Array.isArray(resSenado2019) ? resSenado2019.length : typeof resSenado2019);
  } catch (e: any) {
    console.error("Senado 2019 erro:", e.message);
  }
}

testApis();
