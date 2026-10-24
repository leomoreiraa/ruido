import test from "node:test";
import assert from "node:assert/strict";
import {
  avaliarCoberturaJornalistica, FONTES_INDEPENDENTES_MINIMAS,
  type AlegacaoVerificavel, type EvidenciaJornalistica,
} from "../lib/ai/noticiasQuatroFontes";

const trecho="A reportagem registra a presença do parlamentar em audiência pública sobre educação e registra o tema em debate.";
function evidence(
  url="https://g1.globo.com/politica/reportagem-1", id="origem-1",
): EvidenciaJornalistica {
  return {url,titulo:"Parlamentar participa de audiência sobre educação",
    publicadoEm:"2026-10-22T12:00:00Z",
    textoAcessado:("Reportagem original sobre o debate da educação. "+trecho+" ").repeat(5),
    excertoDaAfirmacao:trecho,parlamentarIdConfirmado:"politico-123",
    identidadeConfirmadaPorContexto:true,idReportagemOriginal:id,
    republicacaoOuAgencia:false};
}
const second=()=>({...evidence("https://www.estadao.com.br/politica/materia-2","origem-2"),
  textoAcessado:("O Estadão esteve na sessão e conversou com os participantes. "+trecho+" ").repeat(4)});
const third=()=>({...evidence("https://www.cnnbrasil.com.br/politica/materia-3","origem-3"),
  textoAcessado:("Reportagem da CNN relata os resultados do encontro. "+trecho+" ").repeat(4)});
function item(evidencias:EvidenciaJornalistica[],extra:Partial<AlegacaoVerificavel>={}):AlegacaoVerificavel {
  return {parlamentarId:"politico-123",eventoId:"evento-1",
    resumo:"Segundo o veículo original, o parlamentar participou de uma audiência pública sobre educação.",
    situacao:"NOTICIA",evidencias,...extra};
}
test("uma reportagem autêntica é publicada expressamente como FONTE_UNICA",()=>{
  const out=avaliarCoberturaJornalistica(item([evidence()]));
  assert.equal(FONTES_INDEPENDENTES_MINIMAS,2);
  assert.equal(out.publicavel,true);
  assert.equal(out.nivel,"FONTE_UNICA");
  assert.equal(out.fontesIndependentes,1);
});
test("duas reportagens de grupos diferentes são CORROBORADA",()=>{
  const out=avaliarCoberturaJornalistica(item([evidence(),second()]));
  assert.equal(out.publicavel,true);
  assert.equal(out.nivel,"CORROBORADA");
});
test("quatro links da mesma redação continuam sendo fonte única",()=>{
  const news=[evidence()];
  for(let i=0;i<3;i++)news.push(evidence("https://oglobo.globo.com/politica/nota-"+i,"globo-"+i));
  const out=avaliarCoberturaJornalistica(item(news));
  assert.equal(out.fontesIndependentes,1);
  assert.equal(out.nivel,"FONTE_UNICA");
});
test("republicações, mesmo texto ou origem não contam como confirmação",()=>{
  const e=second(); e.republicacaoOuAgencia=true;
  assert.equal(avaliarCoberturaJornalistica(item([e])).publicavel,false);
  const reused=second(); reused.idReportagemOriginal="origem-1";
  assert.equal(avaliarCoberturaJornalistica(item([evidence(),reused])).nivel,"FONTE_UNICA");
  const copied=second();copied.textoAcessado=evidence().textoAcessado;
  assert.equal(avaliarCoberturaJornalistica(item([evidence(),copied])).nivel,"FONTE_UNICA");
});
test("sem URL original HTTPS, excerto literal e artigo acessível não publica",()=>{
  for(const changes of [
    {url:"http://g1.globo.com/politica/noticia"},
    {url:"https://noticiario-desconhecido.invalid/materia"},
    {textoAcessado:"Apenas manchete"},
    {excertoDaAfirmacao:"Frase fabricada que nunca apareceu nesta reportagem original."},
  ]) {
    assert.equal(avaliarCoberturaJornalistica(item([{...evidence(),...changes}])).publicavel,false);
  }
});
test("homônimo e identidade sem confirmação contextual não publicam",()=>{
  assert.equal(avaliarCoberturaJornalistica(item([
    {...evidence(),parlamentarIdConfirmado:"outro-deputado"}])).publicavel,false);
  assert.equal(avaliarCoberturaJornalistica(item([
    {...evidence(),identidadeConfirmadaPorContexto:false}])).publicavel,false);
});
test("classificações processuais formais exigem documento do órgão competente",()=>{
  const candidate=item([evidence(),second(),third()],{situacao:"REU"});
  let verdict=avaliarCoberturaJornalistica(candidate);
  assert.equal(verdict.publicavel,false);
  assert.match(verdict.motivos.join(" "),/documento primário/i);
  verdict=avaliarCoberturaJornalistica({...candidate,documentoOficial:{
    url:"https://www.stf.jus.br/portal/processo/consulta.asp",
    numeroOuIdentificador:"0001/teste",situacaoComprovada:"REU",
    conferidoNoOriginal:true,parlamentarIdConfirmado:"politico-123",
    conferidoEm:"2026-10-22T13:00:00Z",
  }});
  assert.equal(verdict.publicavel,true);
  assert.equal(verdict.nivel,"DOCUMENTO_OFICIAL");
});
test("mera citação por uma redação não vira denúncia ou culpa",()=>{
  assert.equal(avaliarCoberturaJornalistica(item([evidence()],{situacao:"CITADO"})).nivel,"FONTE_UNICA");
  assert.equal(avaliarCoberturaJornalistica(item([evidence()],{situacao:"DENUNCIADO"})).publicavel,false);
});
