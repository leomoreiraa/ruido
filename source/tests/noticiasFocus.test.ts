import test from "node:test";
import assert from "node:assert/strict";
import {selecionarNoticias} from "../lib/ai/selecionarNoticias";
const membros=[
  {id:"1",nome:"Flávio Bolsonaro",nomeCivil:"Flávio Nantes Bolsonaro",partido:"PL"},
  {id:"2",nome:"Nikolas Ferreira",nomeCivil:"Nikolas Ferreira de Oliveira",partido:"PL"},
  {id:"3",nome:"Outro PL",nomeCivil:null,partido:"PL"},
  {id:"4",nome:"Outro Parlamentar",nomeCivil:null,partido:"PT"},
];
test("foco PL com prioridades exatas não processa outras legendas",()=>{
  const r=selecionarNoticias(membros,"PL",["Flavio Bolsonaro","Nikolas Ferreira"],0,0);
  assert.deepEqual(r.fila.map(x=>x.id),["1","2","3"]);
  assert.deepEqual([...r.ids],["1","2"]);
});
test("homônimo e nome ausente impedem atribuições incertas",()=>{
  assert.throws(()=>selecionarNoticias([...membros,
    {id:"5",nome:"Flavio Bolsonaro",nomeCivil:null,partido:"PL"}],
    "PL",["Flavio Bolsonaro"],0,0),/não única/);
  assert.throws(()=>selecionarNoticias(membros,"PL",["Pessoa inexistente"],0,0),/não única/);
});
test("cursor independente conserva seleção geral",()=>{
  const geral=selecionarNoticias(membros,"",[],2,0);
  assert.deepEqual(geral.fila.map(x=>x.id),["3","4","1","2"]);
  const focado=selecionarNoticias(membros,"PL",["Nikolas Ferreira"],0,1);
  assert.deepEqual(focado.fila.map(x=>x.id),["2","3","1"]);
});
