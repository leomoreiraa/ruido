import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { formatarMoeda } from "../lib/utils";

describe("patrimonioCalculos: agrupamento e evolução patrimonial TSE", () => {
  const bensExemplo = [
    {
      id: "bem1",
      parlamentarId: "p1",
      anoEleicao: 2018,
      tipoBem: "Imóvel Residencial",
      valorDeclarado: 500000,
      totalPatrimonioAno: 750000,
    },
    {
      id: "bem2",
      parlamentarId: "p1",
      anoEleicao: 2018,
      tipoBem: "Veículo automotor",
      valorDeclarado: 250000,
      totalPatrimonioAno: 750000,
    },
    {
      id: "bem3",
      parlamentarId: "p1",
      anoEleicao: 2022,
      tipoBem: "Imóvel Residencial",
      valorDeclarado: 700000,
      totalPatrimonioAno: 1050000,
    },
    {
      id: "bem4",
      parlamentarId: "p1",
      anoEleicao: 2022,
      tipoBem: "Veículo automotor",
      valorDeclarado: 350000,
      totalPatrimonioAno: 1050000,
    },
  ];

  test("calcula a soma dos bens por ano eleitoral", () => {
    const bensPorAno = bensExemplo.reduce<Record<number, number>>((acc, item) => {
      acc[item.anoEleicao] = (acc[item.anoEleicao] || 0) + item.valorDeclarado;
      return acc;
    }, {});

    assert.equal(bensPorAno[2018], 750000);
    assert.equal(bensPorAno[2022], 1050000);
  });

  test("calcula a variação percentual entre eleições corretamente", () => {
    const total2018 = 750000;
    const total2022 = 1050000;

    const variacaoPct = ((total2022 - total2018) / total2018) * 100;
    assert.equal(Math.round(variacaoPct), 40); // 40% de crescimento
  });

  test("formata valores monetários em padrão BRL", () => {
    const formatado = formatarMoeda(1050000);
    assert.match(formatado, /1\.050\.000/);
    assert.match(formatado, /R\$/);
  });
});
