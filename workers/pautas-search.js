/* RUÍDO: consulta do catálogo legislativo fora da thread do navegador.
 * Apenas os resultados da página atual (até 10 itens) cruzam postMessage.
 * Nunca executa código vindo de notícias, ementas ou das APIs externas.
 */
"use strict";

let catalogo = null;
let indice = null;
let carregando = null;
const MAX_RESULTADOS = 10;

function normalizar(valor) {
  return String(valor == null ? "" : valor)
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR").replace(/\s+/g, " ").trim();
}

function indiceTexto(pauta) {
  return normalizar([
    pauta.siglaTipo, pauta.numero, pauta.ano, pauta.ementa,
    pauta.tituloSimples, pauta.resumoSimples, pauta.autorNome,
  ].filter(x => x != null).join(" "));
}

async function inicializar() {
  if (catalogo) return catalogo.length;
  if (!carregando) {
    carregando = (async () => {
      const resposta = await fetch("/data/pautas-index.json", {cache:"force-cache"});
      if (!resposta.ok) throw new Error("Catálogo indisponível (HTTP " + resposta.status + ")");
      const dados = await resposta.json();
      if (!Array.isArray(dados) || dados.length < 20) throw new Error("Catálogo incompleto");
      catalogo = dados;
      // O custo da normalização e indexação fica SOMENTE no Worker.
      indice = dados.map(indiceTexto);
      return dados.length;
    })();
  }
  try { return await carregando; }
  catch (error) { carregando = null; throw error; }
}

function pesquisar({busca = "", casa = "", tipo = "", pagina = 1, limit = MAX_RESULTADOS}) {
  const termo = normalizar(busca);
  const porPagina = Math.max(1, Math.min(MAX_RESULTADOS, Number(limit) || MAX_RESULTADOS));
  const pag = Math.max(1, Number(pagina) || 1);
  const inicio = (pag - 1) * porPagina;
  const itens = [];
  let total = 0;
  for (let i = 0; i < catalogo.length; i++) {
    const item = catalogo[i];
    if (casa && item.casa !== casa) continue;
    if (tipo && item.siglaTipo !== tipo) continue;
    if (termo && !indice[i].includes(termo)) continue;
    if (total >= inicio && itens.length < porPagina) itens.push(item);
    total++;
  }
  return {itens, total, pagina:pag};
}

self.onmessage = async function(evento) {
  const dados = evento.data || {};
  if (dados.type === "init") {
    try {
      const total = await inicializar();
      self.postMessage({type:"ready",total});
    } catch (err) {
      self.postMessage({type:"error",message:err instanceof Error ? err.message : "Falha na leitura do catálogo"});
    }
    return;
  }
  if (dados.type === "filter") {
    try {
      await inicializar();
      const resultado = pesquisar(dados);
      self.postMessage({type:"result",requestId:dados.requestId,key:dados.key,...resultado});
    } catch (err) {
      self.postMessage({type:"error",requestId:dados.requestId,message:err instanceof Error ? err.message : "Falha na pesquisa"});
    }
  }
};
