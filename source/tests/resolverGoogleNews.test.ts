import test from "node:test";
import assert from "node:assert/strict";
import { extrairUrlGoogleNews, resolverUrlGoogleNews } from "../lib/ai/resolverGoogleNews";
test("feed não pode contar link intermediário como fonte", async()=>{
  assert.equal(await resolverUrlGoogleNews("https://example.com/abc"),null);
  assert.equal(await resolverUrlGoogleNews("http://news.google.com/rss/articles/ABC"),null);
  assert.equal(await resolverUrlGoogleNews("https://news.google.com/other?q=x"),null);
});
test("resultados de resolução só aceitam URL HTTPS externa",()=>{
  const frame=(url:string)=>[["wrb.fr","Fbv4je",JSON.stringify(["garturlres",url])]];
  assert.equal(extrairUrlGoogleNews(frame("https://www.cnnbrasil.com.br/politica/noticia")),"https://www.cnnbrasil.com.br/politica/noticia");
  assert.equal(extrairUrlGoogleNews(frame("http://www.cnnbrasil.com.br/noticia")),null);
  assert.equal(extrairUrlGoogleNews(frame("https://news.google.com/rss/articles/id")),null);
  assert.equal(extrairUrlGoogleNews(frame("https://news.google.com.evil.test/id")), "https://news.google.com.evil.test/id");
  assert.equal(extrairUrlGoogleNews([["wrb.fr","Fbv4je",null]]),null);
  assert.equal(extrairUrlGoogleNews(null),null);
});
