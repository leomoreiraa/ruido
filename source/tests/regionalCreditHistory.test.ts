import test from "node:test";
import assert from "node:assert/strict";
import { mesclarHistoricoCreditoMei } from "../lib/regionalCreditHistory";

const serie = 26618;
const obs = (data: string, milhoesReais: number, codigo = serie) => ({ data, milhoesReais, serie: codigo });

test("indisponibilidade do BCB preserva anos anteriormente verificados sem criar valores", () => {
  const antigo = { "2022": obs("31/12/2022", 10), "2023": obs("31/12/2023", 20) };
  assert.deepEqual(mesclarHistoricoCreditoMei(serie, antigo, {}), antigo);
  assert.equal(mesclarHistoricoCreditoMei(serie, antigo, {})["2024"], undefined);
});

test("observação oficial mais recente prevalece, mantendo os demais anos", () => {
  const antigo = { "2022": obs("31/12/2022", 10), "2023": obs("01/03/2023", 20) };
  const novo = { "2023": obs("01/12/2023", 25), "2024": obs("01/02/2024", 30) };
  const mesclado = mesclarHistoricoCreditoMei(serie, antigo, novo);
  assert.deepEqual(Object.keys(mesclado).sort(), ["2022", "2023", "2024"]);
  assert.equal(mesclado["2023"].milhoesReais, 25);
  assert.equal(mesclado["2022"].milhoesReais, 10);
});

test("rejeita série trocada, datas inválidas, anos incompatíveis e números não oficiais", () => {
  const invalido = {
    "2022": obs("01/02/2022", 12, 99999),
    "2023": obs("31/02/2023", 15),
    "2024": obs("01/03/2023", 16),
    "2025": obs("01/03/2025", -1),
    "2026": obs("01/03/2026", Number.NaN),
    "2030": obs("01/03/2030", 100),
  };
  assert.deepEqual(mesclarHistoricoCreditoMei(serie, invalido), {});
});

test("ausência de cache e resposta não estruturada não produz dados", () => {
  assert.deepEqual(mesclarHistoricoCreditoMei(serie, null, [], "invalid", {}), {});
});
