import test from "node:test";
import { readFileSync } from "node:fs";
import { validarCacheMalhasIBGE, IBGE_MALHAS_SOURCE } from "../lib/malhasBrasil";
import assert from "node:assert/strict";
import { UFS, SERIES_MEI, lerSidra, extrairPoligonos, coordenadasParaSVG,
  numeroOficial, valorIndicador, type EstadoMapa } from "../lib/mapaBrasil";

test("mapa usa as 27 UFs oficiais e 27 séries estaduais distintas do BCB",()=>{
  assert.equal(UFS.length,27);
  assert.equal(new Set(UFS.map(x=>x[0])).size,27);
  assert.equal(new Set(UFS.map(x=>x[1])).size,27);
  assert.equal(new Set(Object.values(SERIES_MEI)).size,27);
});
test("SIDRA relaciona ano e UF pelas dimensões sem inventar valores ausentes",()=>{
  const response=[
    {D1C:"Ano (Código)",D2C:"Unidade da Federação (Código)",V:"Valor"},
    {D1C:"2022",D2C:"35",V:"123456"},
    {D1C:"2023",D2C:"12",V:"-"},
    {D1C:"2024",D2C:"33",V:"1,7"},
    {D1C:"2025",D2C:"99",V:"500"},
  ];
  const rows=lerSidra(response,2022,2026);
  assert.deepEqual(rows.SP,{"2022":123456});
  assert.deepEqual(rows.RJ,{"2024":1.7});
  assert.equal(rows.AC,undefined);
  assert.equal(rows.BR,undefined);
  assert.equal(numeroOficial("..."),null);
});
test("GeoJSON de MultiPolygon vira SVG e mantém buracos e regiões",()=>{
  const shape={type:"FeatureCollection",features:[{type:"Feature",geometry:{
    type:"MultiPolygon",coordinates:[
      [[[-50,-20],[-49,-20],[-49,-19],[-50,-20]]],
      [[[-48,-20],[-47,-20],[-47,-19],[-48,-20]]],
    ],
  }}]};
  const polys=extrairPoligonos(shape);
  assert.equal(polys.length,2);
  const svg=coordenadasParaSVG(polys);
  assert.equal((svg.match(/M/g)||[]).length,2);
  assert.ok(svg.includes("Z"));
});
test("PIB por habitante usa população do MESMO ano e omite data ausente",()=>{
  const e:EstadoMapa={
    id:"35",uf:"SP",nome:"São Paulo",svgPath:"M1,1L1,2L2,2Z",
    porAno:{"2022":{pibMilReais:2500,populacao:1000,emendasPagas:1500,emendasCount:2},
      "2023":{pibMilReais:3000,populacao:null,emendasPagas:null,emendasCount:0}},
    creditoMei:{milhoesReais:10,data:"01/04/2023",serie:26618},
  };
  assert.equal(valorIndicador(e,2022,"pibPerCapita"),2500);
  assert.equal(valorIndicador(e,2022,"emendasPerCapita"),1.5);
  assert.equal(valorIndicador(e,2023,"pibPerCapita"),null);
  assert.equal(valorIndicador(e,2022,"creditoMei"),null);
  assert.equal(valorIndicador(e,2023,"creditoMei"),10000000);
});

test("IDHM anual e evolução não usam PIB nem inventam 2025",()=>{
  const estado:EstadoMapa={id:"35",uf:"SP",nome:"São Paulo",svgPath:"M1,1L2,2Z",
    porAno:{"2024":{pibMilReais:null,populacao:null,emendasPagas:null,emendasCount:0}},
    idhmPorAno:{"2022":0.828,"2023":0.836,"2024":0.838},creditoMei:null};
  assert.equal(valorIndicador(estado,2024,"idhm"),0.838);
  assert.equal(valorIndicador(estado,2024,"idhmVariacao"),0.002);
  assert.equal(valorIndicador(estado,2023,"idhmVariacao"),0.008);
  assert.equal(valorIndicador(estado,2025,"idhm"),null);
  assert.equal(valorIndicador(estado,2022,"idhmVariacao"),null);
});

test("cache versionado guarda os contornos geográficos oficiais de todas as 27 UFs", () => {
  const raw=JSON.parse(readFileSync("data/ibge-ufs-geometry.json","utf8"));
  assert.equal(raw.version,1);
  assert.equal(raw.source,IBGE_MALHAS_SOURCE);
  const geometry=validarCacheMalhasIBGE(raw);
  assert.deepEqual(Object.keys(geometry).sort(),UFS.map(([,uf])=>uf).sort());
  for(const svg of Object.values(geometry)){
    assert.ok(svg.length>=30);
    assert.match(svg,/^M[0-9MLZ,.-]+Z$/);
    assert.ok(svg.includes("L"),"A malha não pode ser um ponto");
  }
});

test("cache de malhas não aceita estado trocado, incompleto nem SVG de HTML", () => {
  const base=JSON.parse(readFileSync("data/ibge-ufs-geometry.json","utf8"));
  const mutated=()=>JSON.parse(JSON.stringify(base));
  const without=mutated();without.estados.pop();
  assert.throws(()=>validarCacheMalhasIBGE(without),/inválido|incompleto/);
  const id=mutated();id.estados[0].id="99";
  assert.throws(()=>validarCacheMalhasIBGE(id),/inválido/);
  const malicious=mutated();malicious.estados[0].svgPath='<script>alert(1)</script>';
  assert.throws(()=>validarCacheMalhasIBGE(malicious),/inválido/);
});

test("build regional não precisa consultar a API de malhas em seu fluxo padrão", () => {
  const code=readFileSync("scripts/build-regional-data.ts","utf8");
  assert.ok(code.includes("validarCacheMalhasIBGE"));
  assert.ok(code.includes('process.env.REFRESH_IBGE_MESHES==="1"'));
  assert.ok(code.includes("cachedShapes[uf]"));
});
