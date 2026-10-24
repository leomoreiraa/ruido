import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {interpretarResultadoAoVivo,urlResultadoAoVivo,consultaAoVivoDisponivel,INICIO_APURACAO_UTC} from "../lib/eleicoesTseAoVivo";

const fake=()=>({
 ele:"6258",t:"2",dt:"25/10/2026",ht:"17:03:05",
 s:{st:"400",ts:"1000"},v:{vv:"100",tv:"110",vb:"4",vn:"6",vnt:"0"},
 carg:[{cd:"1",agr:[{par:[{sg:"A",cand:[{n:"13",nmu:"Candidato A",vap:"55"}]},{sg:"B",cand:[{n:"22",nmu:"Candidato B",vap:"45"}]}]}]}]
});
test("URLs EA20 utilizam codigo TSE e segundo turno correto",()=>{
 assert.equal(urlResultadoAoVivo("BR"),"https://resultados.tse.jus.br/oficial/ele2026/6258/dados/br/br-c0001-e006258-u.json");
 assert.equal(urlResultadoAoVivo("SP","71072"),"https://resultados.tse.jus.br/oficial/ele2026/6258/dados/sp/sp71072-c0001-e006258-u.json");
 assert.throws(()=>urlResultadoAoVivo("SP","3550308"));
 assert.throws(()=>urlResultadoAoVivo("XX"));
 assert.throws(()=>urlResultadoAoVivo("BR","01120"));
});
test("parser do TSE calcula votos e progresso e recusa turno trocado",()=>{
 const r=interpretarResultadoAoVivo(fake());
 assert.equal(r.situacao,"parcial");
 assert.equal(r.percentualSecoes,40);
 assert.equal(r.votosValidos,100);
 assert.equal(r.candidatos[0].percentual,55);
 assert.equal(r.candidatos[1].votos,45);
 assert.throws(()=>interpretarResultadoAoVivo({...fake(),ele:"6257"}));
 assert.throws(()=>interpretarResultadoAoVivo({...fake(),t:"1"}));
});
test("nao inventa votos antes da apuracao e rejeita totais incoerentes",()=>{
 const zero=fake();
 zero.s.st="0";zero.v.tv="0";zero.v.vv="0";zero.carg[0].agr[0].par[0].cand[0].vap="0";zero.carg[0].agr[0].par[1].cand[0].vap="0";
 const aguardando=interpretarResultadoAoVivo(zero);
 assert.equal(aguardando.situacao,"aguardando");
 assert.equal(aguardando.votosValidos,null);
 zero.s.st="1001";assert.throws(()=>interpretarResultadoAoVivo(zero));
});
test("inicio do segundo turno em horario de Brasilia",()=>{
 assert.equal(consultaAoVivoDisponivel(INICIO_APURACAO_UTC-1000),false);
 assert.equal(consultaAoVivoDisponivel(INICIO_APURACAO_UTC),true);
});
test("todos os tres mapas incluem zoom e atualizacao live nao depende de deploy",()=>{
 const zoom=readFileSync("components/MapaZoomArea.tsx","utf8");
 const national=readFileSync("components/MapaEleitoralMunicipalBrasil.tsx","utf8");
 const eleicoes=readFileSync("components/Eleicoes2026View.tsx","utf8");
 const mapa=readFileSync("components/MapaBrasilView.tsx","utf8");
 for(const txt of [national,eleicoes,mapa])assert.match(txt,/<MapaZoomArea/);
 for(const word of ["onPointerMove","touch-action","restaurar"]) {
  assert.match(word==="touch-action"?readFileSync("app/globals.css","utf8"):zoom,new RegExp(word));
 }
 assert.match(eleicoes,/INTERVALO_LIVE_MS/);
 assert.match(eleicoes,/buscarResultadoCentral/);
 assert.doesNotMatch(eleicoes,/buscarResultadoTSE|urlResultadoAoVivo/);
 assert.match(eleicoes,/backendEleitoralConfigurado/);
 assert.match(eleicoes,/sem redeploy/);
});

test("zoom do RUÍDO mantém geometria vetorial e legibilidade no fundo ácido",()=>{
 const zoom=readFileSync("components/MapaZoomArea.tsx","utf8");
 const css=readFileSync("app/globals.css","utf8");
 const national=readFileSync("components/MapaEleitoralMunicipalBrasil.tsx","utf8");
 const election=readFileSync("components/Eleicoes2026View.tsx","utf8");
 const atlas=readFileSync("components/MapaBrasilView.tsx","utf8");
 assert.match(zoom,/React\.cloneElement\(svg/);
 assert.match(zoom,/viewBox:/);
 assert.match(zoom,/shapeRendering:"geometricPrecision"/);
 assert.doesNotMatch(zoom,/translate3d|transformOrigin|scale\(/);
 assert.match(zoom,/onPointerMove/);
 assert.match(zoom,/zoomEm/);
 assert.match(css,/ruido-map-zoom__surface > svg/);
 assert.match(css,/transform: none !important/);
 assert.match(css,/ruido-map-zine__titlebar \.ruido-map-zine__headline/);
 assert.match(css,/color: #171512 !important/);
 assert.match(css,/ruido-text-on-acid-outline/);
 for (const code of [national,election,atlas]) assert.match(code,/vectorEffect="non-scaling-stroke"/);
});
