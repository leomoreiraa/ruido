import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {
 validarHistoricoCentral,mesclarHistorico,calcularCenarioMatematico,
 type ParcialHistorica
} from "../lib/eleicoesHistorico";

const ponto=(secoes:number,tempo:number,votos13=55,votos22=45):ParcialHistorica=>({
 consultadoEm:tempo,secoesTotalizadas:secoes,secoesPrevistas:100,
 percentualSecoes:secoes,votosValidos:100,
 candidatos:[{numero:"13",votos:votos13,percentual:votos13},
 {numero:"22",votos:votos22,percentual:votos22}]
});
const envelope=(pontos:ParcialHistorica[])=>({
 versao:1,fonte:"https://resultados.tse.jus.br/oficial",turno:2,
 consultadoEm:pontos.at(-1)?.consultadoEm??null,pontos
});

test("histórico aceita somente parciais nacionais oficiais verificáveis e ordenadas",()=>{
 const primeiro=ponto(10,1000),segundo=ponto(25,2000,48,52);
 assert.deepEqual(validarHistoricoCentral(envelope([primeiro,segundo])),[primeiro,segundo]);
 assert.throws(()=>validarHistoricoCentral({...envelope([]),fonte:"desconhecida"}));
 assert.throws(()=>validarHistoricoCentral({...envelope([]),turno:1}));
 assert.throws(()=>validarHistoricoCentral(envelope([segundo,primeiro])));
 assert.throws(()=>validarHistoricoCentral(envelope([primeiro,primeiro])));
 assert.throws(()=>validarHistoricoCentral(envelope([{...primeiro,candidatos:[
  {numero:"13",votos:95,percentual:95},{numero:"22",votos:45,percentual:45}
 ]}])));
});

test("histórico mescla cache central e observação atual sem duplicar resultados",()=>{
 const primeiro=ponto(10,1000),segundo=ponto(20,2000),atual=ponto(30,3000,57,43);
 assert.deepEqual(mesclarHistorico([primeiro,atual],[primeiro,segundo]),[primeiro,segundo,atual]);
 assert.equal(mesclarHistorico([primeiro],[ponto(10,4000)]).length,1);
 assert.deepEqual(mesclarHistorico([atual],[primeiro]),[primeiro,atual]);
});

test("cenários calculam votos adicionais necessários, sem projetar resultado eleitoral",()=>{
 const exemplo=calcularCenarioMatematico(55,45,100);
 assert.equal(exemplo.diferenca,10);
 assert.equal(exemplo.necessarios,56);
 assert.equal(exemplo.percentual,56);
 assert.equal(exemplo.viavel,true);
 assert.equal(calcularCenarioMatematico(125,25,50).viavel,false);
 assert.equal(calcularCenarioMatematico(10,10,100).necessarios,51);
 assert.throws(()=>calcularCenarioMatematico(-1,10,100));
});

test("painel permanece abaixo do mapa e o indicador fica no canto esquerdo sobre o SVG",()=>{
 const codigo=readFileSync("components/Eleicoes2026View.tsx","utf8");
 const radar=readFileSync("components/RadarApuracaoEleitoral.tsx","utf8");
 assert.match(codigo,/ruido-map-zine__canvas--national relative/);
 assert.match(codigo,/absolute left-2 top-2/);
 assert.match(codigo,/SEÇÕES TOTALIZADAS/);
 assert.ok(codigo.indexOf("<RadarApuracaoEleitoral")>codigo.indexOf('ruido-map-zine__tagline'));
 assert.match(radar,/buscarHistoricoCentral/);
 assert.match(radar,/TENDÊNCIA DA APURAÇÃO/);
 assert.match(radar,/não projeções de resultado/);
});
