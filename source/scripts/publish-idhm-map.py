#!/usr/bin/env python3
"""Replace ONLY the old map page inside a verified Github Pages export with an
IDHM choropleth backed by the pinned, checked PNUD/FJP/IBGE Radar IDHM dataset.
Do not touch the rest of the published site or its historical legislative data.
"""
from pathlib import Path
import argparse
import json
import re
import html

OFFICIAL = "https://www.undp.org/pt/brazil/publications/radar-idhm-evolucao-do-idhm-e-de-seus-componentes-periodo-de-2012-2024"
STYLE = r"""
:root{--ink:#101010;--acid:#d8f53e;--red:#e42232;--paper:#eee8d9}
*{box-sizing:border-box}
body{margin:0;background:var(--paper);color:var(--ink);font-family:ui-monospace,SFMono-Regular,Consolas,monospace}
a{color:inherit}
nav{background:var(--ink);color:#fff;display:flex;gap:16px;align-items:center;flex-wrap:wrap;padding:19px max(22px,4vw);border-bottom:6px solid var(--red);font-weight:800}
nav a{text-decoration:none;letter-spacing:.04em} nav a:hover{color:var(--acid)}
nav .logo{font-size:32px;color:var(--acid);letter-spacing:-.07em;margin-right:auto}
main{max-width:1380px;margin:auto;padding:24px 18px 70px}
.intro{background:var(--ink);color:#fff;border:4px solid var(--ink);box-shadow:8px 8px 0 var(--red);padding:28px 30px;margin-bottom:36px}
.intro .eyebrow{letter-spacing:.2em;font-weight:700;color:var(--acid);font-size:12px}
h1,h2,h3{font-family:Impact,'Arial Black',sans-serif;line-height:1.08;letter-spacing:.01em;text-transform:uppercase}
h1{font-size:clamp(42px,8vw,100px);margin:10px 0}h1 em{font-style:normal;color:var(--red)}
.intro p{max-width:900px;line-height:1.7;font-size:14px;color:#ddd}
.controls{display:grid;grid-template-columns:1fr 1fr 1fr;gap:16px;border:4px solid var(--ink);background:#fff;padding:20px;margin-bottom:25px;box-shadow:6px 6px 0 var(--ink)}
label{font-weight:800;font-size:12px;display:block;margin:0 0 9px}
select{font:700 18px ui-monospace,monospace;width:100%;padding:13px;border:3px solid var(--ink);background:var(--acid)}
.grid{display:grid;grid-template-columns:minmax(0,1.25fr) minmax(285px,.75fr);gap:20px}
.panel{background:#fff;border:4px solid var(--ink);box-shadow:7px 7px 0 var(--ink);padding:23px;margin-bottom:22px}
.dark{background:#171b19;color:#fff}
.map-wrap{max-width:800px;margin:auto}
.meta{font-size:11px;letter-spacing:.1em;font-weight:800;color:var(--acid)}
.summary{display:flex;justify-content:space-between;align-items:center;gap:10px}
.uf{background:var(--ink);color:var(--acid);padding:8px 12px;font-size:26px;font-weight:900}
.big{font:900 clamp(35px,5vw,58px) Impact,'Arial Black',sans-serif;color:var(--red);margin:10px 0}
.delta{font-size:25px;font-weight:900}
.good{color:#286b40}.bad{color:#c32132}
.hint{font-size:12px;color:#777;line-height:1.5}
ol{list-style:none;padding:0;margin:0}
li button{width:100%;border:0;background:none;text-align:left;padding:11px 0;border-bottom:1px dashed #999;display:flex;justify-content:space-between;cursor:pointer;font:700 13px ui-monospace,monospace}
li button:hover{color:var(--red)}
.warning{border-left:7px solid var(--red);padding:14px;background:#fff;font-size:12px;line-height:1.7;margin:30px 0}
.legend{font-size:12px;color:#bbb;line-height:1.6}
.scale-legend{display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;margin:16px 0 8px;padding:13px 0;border-top:1px dashed #657361;font-size:11px;font-weight:800;letter-spacing:.04em}
.scale-colors{display:flex;align-items:center;gap:6px}
.scale-colors .swatch{display:inline-block;width:25px;height:14px;border:1px solid rgba(255,255,255,.3)}
.legend-keys{display:flex;flex-wrap:wrap;gap:14px;font-size:11px}
.legend-key{display:inline-flex;align-items:center;gap:7px}
.legend-key .swatch{display:inline-block;width:16px;height:14px;border:1px solid rgba(255,255,255,.35)}
footer{border-top:5px solid var(--ink);padding:24px 0;font-size:12px;line-height:1.7}
footer a{color:#a5121d;font-weight:700}
@media(max-width:850px){.grid{grid-template-columns:1fr}.controls{grid-template-columns:1fr 1fr}.controls .wide{grid-column:span 2}}

/* RUÍDO edition 02: the same original punk-collage system used elsewhere. */
body{background-image:linear-gradient(124deg,rgba(228,34,50,.07),transparent 44%),url('/assets/papel-fibra.jpg');background-size:auto,500px}
nav{position:relative;background-image:repeating-linear-gradient(145deg,transparent 0 19px,rgba(255,255,255,.045) 20px 22px);box-shadow:0 6px 0 #111}
nav .brand-skull{height:46px;width:43px;object-fit:contain;background:#111;border:2px solid var(--acid);transform:rotate(-6deg);box-shadow:3px 3px 0 var(--red)}
.intro{position:relative;background-image:radial-gradient(circle at 85% 18%,rgba(228,34,50,.24),transparent 35%),repeating-linear-gradient(150deg,transparent 0 40px,rgba(255,255,255,.05) 42px 44px)}
.intro::before,.controls::before{content:"";position:absolute;width:100px;height:16px;top:-12px;right:30px;background:rgba(240,223,172,.9);transform:rotate(8deg);border-left:1px dashed #222;border-right:1px dashed #222}
.controls{position:relative;background-image:linear-gradient(160deg,#fff,#eee8d9);box-shadow:6px 6px 0 var(--red)}
.panel:not(.dark){background-image:linear-gradient(130deg,#fff,rgba(238,232,217,.75))}
.collage-end{margin:36px 5px 38px;border:4px solid #111;transform:rotate(-.5deg);position:relative;box-shadow:7px 7px 0 var(--red)}
.collage-end img{width:100%;height:auto;display:block;aspect-ratio:3/1;object-fit:cover}
.collage-end::before{content:"";position:absolute;top:-12px;left:8%;width:93px;height:17px;background:rgba(240,223,172,.88);transform:rotate(-9deg)}
@media(max-width:520px){nav .brand-skull{width:35px;height:38px}.collage-end{border-width:2px;transform:none;box-shadow:3px 3px 0 var(--red)}}

@media(max-width:520px){nav{gap:11px}nav .logo{font-size:25px}.controls{grid-template-columns:1fr}.controls .wide{grid-column:span 1}main{padding:20px 12px}.panel{padding:13px}}
"""
SCRIPT=r"""
const f=(n)=>n===null||n===undefined?'N/D':n.toLocaleString('pt-BR',{minimumFractionDigits:3,maximumFractionDigits:3});
const ufs=document.getElementById('uf'),anos=document.getElementById('year'),met=document.getElementById('metric');
const box=document.getElementById('map'),summary=document.getElementById('summary');
const hist=document.getElementById('chart'),rank=document.getElementById('ranking');
const subtitle=document.getElementById('sub'),legend=document.getElementById('legend');
let geo=[],idhm={},selected='SP';
async function start(){
 const [g,i]=await Promise.all([fetch('/data/brasil-estados.json'),fetch('/data/idhm-ufs.json')]);
 if(!g.ok||!i.ok)throw Error('Não foi possível carregar os dados oficiais');
 const map=await g.json();const source=await i.json();
 if(map.estados?.length!==27||Object.keys(source.porUF||{}).length!==27||source.serieAte!==2024)throw Error('Dados estaduais incompletos');
 geo=map.estados;idhm=source.porUF;
 const years=Object.keys(idhm.SP).map(Number).sort((a,b)=>b-a);
 if(years[0]!==2024)throw Error('Último IDHM da série deve ser 2024');
 anos.replaceChildren(...years.map(y=>new Option(y,y)));
 ufs.replaceChildren(...geo.map(x=>new Option(x.nome,x.uf)));
 anos.value='2024';ufs.value=selected;
 for(const el of [ufs,anos,met])el.addEventListener('change',draw);
 draw();
}
function value(s,y,m){const v=idhm[s]?.[String(y)];if(!Number.isFinite(v))return null;if(m==='idhm')return v;const old=idhm[s]?.[String(y-1)];return Number.isFinite(old)?+(v-old).toFixed(4):null}
function display(v,m){return v===null?'N/D':m==='idhm'?f(v):(v>0?'+':'')+f(v)+' ponto(s)'}
function draw(){
 selected=ufs.value;const yr=+anos.value,m=met.value;
 const vals=geo.map(s=>({state:s,value:value(s.uf,yr,m)}));
 const ready=vals.filter(x=>x.value!==null);
 const max=Math.max(.001,...ready.map(v=>v.value));
 const min=Math.min(0,...ready.map(v=>v.value));
 box.replaceChildren(...vals.map(({state,value:v})=>{
   const el=document.createElementNS('http://www.w3.org/2000/svg','path');
   el.setAttribute('d',state.svgPath);
   const ratio=m==='idhm'?Math.max(0,(v??0)/Math.max(.001,max)):v!==null?Math.max(0,(v-min)/(max-min||1)):0;
   let fill=v===null?'#90958c':ratio>.85?'#d8f53e':ratio>.7?'#a5c65a':ratio>.5?'#7d965e':ratio>.3?'#5e775c':'#424b46';
   if(state.uf===selected)fill='#e42232';
   el.setAttribute('fill',fill);el.setAttribute('role','button');el.setAttribute('tabindex','0');
   el.setAttribute('aria-label',state.nome+': '+display(v,m));
   el.addEventListener('mouseenter',()=>el.setAttribute('stroke-width','3'));
   el.addEventListener('click',()=>{selected=state.uf;ufs.value=selected;draw()});
   el.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();selected=state.uf;ufs.value=selected;draw()}});
   const t=document.createElementNS('http://www.w3.org/2000/svg','title');t.textContent=state.nome+': '+display(v,m);el.append(t);
   return el;
 }));
 const state=geo.find(x=>x.uf===selected),current=value(selected,yr,'idhm'),prev=value(selected,yr-1,'idhm'),delta=value(selected,yr,'variacao');
 const chosen=value(selected,yr,m);
 summary.innerHTML='<div><h2>'+state.nome+'</h2><div class="hint">UF SELECIONADA • '+yr+'</div></div><b class="uf">'+selected+'</b>';
 document.getElementById('highlight').textContent=display(chosen,m);
 document.getElementById('delta').textContent=display(delta,'variacao');
 document.getElementById('delta').className='delta '+(delta===null?'':delta<0?'bad':'good');
 document.getElementById('prev').textContent='IDHM '+(yr-1)+': '+(prev===null?'não publicado':f(prev))+' • IDHM '+yr+': '+display(current,'idhm');
 subtitle.textContent=m==='idhm'?'IDHM anual • educação, renda e longevidade • índice de 0 a 1':'Diferença em pontos do IDHM contra o ano anterior • não é percentual';
 document.getElementById('scale-note').textContent=m==='idhm'
   ? 'ESCALA RELATIVA AO MAIOR IDHM • '+yr
   : 'ESCALA RELATIVA À VARIAÇÃO ANUAL • '+yr;
 document.getElementById('legend-low').textContent=m==='idhm'?'MENOR':'MENOR VARIAÇÃO';
 document.getElementById('legend-high').textContent=m==='idhm'?'MAIOR':'MAIOR VARIAÇÃO';
 legend.textContent=ready.length+'/27 UFs com dados oficiais em '+yr+'.';
 const years=Object.entries(idhm[selected]||{}).map(([y,v])=>[+y,v]).filter(([y])=>y<=yr).sort((a,b)=>b[0]-a[0]).slice(0,9);
 hist.replaceChildren(...years.map(([year,v])=>{const row=document.createElement('div');row.innerHTML='<div class="line"><span>'+year+'</span><span>'+f(v)+'</span></div><div class="track"><div class="bar" style="width:'+(v*100)+'%"></div></div>';return row}));
 const ranked=[...ready].sort((a,b)=>b.value-a.value);
 rank.replaceChildren(...ranked.map(({state,value:v},idx)=>{const li=document.createElement('li'),btn=document.createElement('button');btn.type='button';btn.textContent=(idx+1)+'. '+state.nome+' — '+display(v,m);btn.onclick=()=>{selected=state.uf;ufs.value=selected;draw()};li.append(btn);return li}));
}
start().catch(err=>{document.getElementById('loading').textContent='Não foi possível verificar o IDHM: '+err.message;console.error(err)});
"""
def patch(root):
    source=root/"data"/"idhm-ufs.json"
    geometry=root/"data"/"brasil-estados.json"
    old=root/"mapa"/"index.html"
    if not old.is_file() or not geometry.is_file() or not source.is_file():
        raise ValueError("Required verified export map and official sources are missing")
    g=json.loads(geometry.read_text())
    i=json.loads(source.read_text())
    if len(g.get("estados",[]))!=27 or i.get("serieAte")!=2024 or len(i.get("porUF",{}))!=27:
        raise ValueError("Map source or IDHM dataset incomplete")
    for uf,series in i["porUF"].items():
        if "2023" not in series or "2024" not in series:
            raise ValueError("Missing year-over-year observation: "+uf)
    original=old.read_text()
    styles=re.findall(r'<link\b[^>]*rel="stylesheet"[^>]*>',original)
    for tag in styles:
        hit=re.search(r'href="(/[^"]+)"',tag)
        if hit and not (root/hit.group(1).lstrip("/")).is_file():
            raise ValueError("Broken inherited CSS asset: "+hit.group(1))
    doc='''<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Brasil em Raio X — IDHM | RUÍDO</title><meta name="description" content="IDHM e evolução anual por estado: série pública PNUD/FJP/IBGE até 2024">
'''+"".join(styles)+"\n<style>"+STYLE+"</style></head><body>\n"+'''
<nav><img src="/assets/skull-xerox.svg" width="43" height="46" class="brand-skull" alt="Caveira, mascote do RUÍDO"><a class="logo" href="/">RUÍDO</a><a href="/">INÍCIO</a><a href="/parlamentares/">PARLAMENTARES</a><a href="/mapa/" aria-current="page">MAPA</a><a href="/cobertura/">COBERTURA</a></nav>
<main>
<header class="intro"><div class="eyebrow">ARQUIVO SOCIAL /// DADOS OFICIAIS</div><h1>BRASIL <em>EM RAIO X</em></h1>
<p>Como o desenvolvimento humano mudou no seu estado? Compare o Índice de Desenvolvimento Humano Municipal (IDHM), que reúne educação, renda e longevidade, e sua variação em relação ao ano anterior. Fonte: Radar IDHM 2012–2024 do PNUD, Fundação João Pinheiro e IBGE.</p>
<strong>27 UNIDADES FEDERATIVAS • ÚLTIMA REFERÊNCIA: 2024 • SEM PROJEÇÕES</strong></header>
<section class="controls" aria-label="Filtros do mapa"><div class="wide"><label for="metric">INDICADOR</label><select id="metric">
<option value="idhm">IDHM — DESENVOLVIMENTO HUMANO</option><option value="variacao">EVOLUÇÃO DO IDHM EM RELAÇÃO AO ANO ANTERIOR</option></select></div>
<div><label for="year">ANO DE REFERÊNCIA</label><select id="year"></select></div>
<div><label for="uf">UNIDADE DA FEDERAÇÃO</label><select id="uf"></select></div></section>
<p id="loading" role="status"></p>
<section class="grid">
<div><section class="panel dark"><div class="meta">/// TERRITÓRIO NACIONAL</div>
<div class="map-wrap"><svg id="map" viewBox="0 0 720 710" role="group" aria-label="Mapa interativo do IDHM nos estados brasileiros"></svg></div>
<div class="scale-legend" role="group" aria-label="Legenda de cores do mapa">
  <div class="scale-colors"><span id="legend-low">MENOR</span>
    <span class="swatch" style="background:#424b46" aria-hidden="true"></span>
    <span class="swatch" style="background:#5e775c" aria-hidden="true"></span>
    <span class="swatch" style="background:#7d965e" aria-hidden="true"></span>
    <span class="swatch" style="background:#a5c65a" aria-hidden="true"></span>
    <span class="swatch" style="background:#d8f53e" aria-hidden="true"></span>
    <span id="legend-high">MAIOR</span>
  </div>
  <span id="scale-note">ESCALA RELATIVA AO MAIOR VALOR</span>
</div>
<div class="legend-keys" aria-label="Outras cores do mapa">
  <span class="legend-key"><span class="swatch" style="background:#e42232" aria-hidden="true"></span>VERMELHO = UF SELECIONADA</span>
  <span class="legend-key"><span class="swatch" style="background:#90958c" aria-hidden="true"></span>CINZA = SEM DADO DISPONÍVEL</span>
</div>
<p class="legend" id="legend">Carregando dados oficiais...</p></section>
<section class="panel"><h2>CLASSIFICAÇÃO ESTADUAL</h2><p id="sub" class="hint"></p><ol id="ranking"></ol></section></div>
<div><section class="panel"><div id="summary" class="summary"></div>
<p class="hint">INDICADOR SELECIONADO</p><div class="big" id="highlight">N/D</div>
<hr><h3>EVOLUÇÃO EM RELAÇÃO AO ANO ANTERIOR</h3>
<div id="delta" class="delta">N/D</div><div id="prev" class="hint"></div></section>
<section class="panel"><h2>HISTÓRICO ANUAL DO IDHM</h2><div id="chart"></div></section>
</div></section>
<div class="warning"><b>COMO LER:</b> uma variação de +0,005 representa cinco milésimos a mais no índice, não crescimento de 0,5%. O IDHM estadual não é o IDH global da ONU. Faltas de dados são exibidas como N/D, nunca como zero. Os indicadores não provam causalidade entre emendas e desenvolvimento humano.</div>
<figure class="collage-end"><img src="/assets/ruido-proposito.webp" width="1200" height="400" loading="lazy" alt="Propósito do RUÍDO: transformar dados públicos em fiscalização acessível"></figure>
<footer><b>// FONTE E METODOLOGIA</b><p>Radar IDHM 2012–2024, PNUD, Fundação João Pinheiro e IBGE. Série anual agregada por UF a partir da PNAD Contínua. Último ano disponível nesta publicação: 2024.</p>
<p><a href="'''+html.escape(OFFICIAL,quote=True)+'''">PUBLICAÇÃO OFICIAL PNUD/FJP/IBGE ↗</a> · <a href="https://github.com/DemoPOP/indicadores-sinteticos">ESPELHO DA BASE / CEDEPLAR-UFMG ↗</a></p></footer></main>
<script src="/assets/idhm-live-map.js" defer></script></body></html>'''
    asset=root/"assets"/"idhm-live-map.js"
    asset.parent.mkdir(exist_ok=True)
    asset.write_text(SCRIPT,encoding="utf8")
    old.write_text(doc,encoding="utf8")
    if "MAPA TEMÁTICO" in doc or "PIB " in doc or "PIB POR" in doc:
        raise ValueError("Legacy map text present after patch")
    if not asset.is_file() or not any("stylesheet" in x for x in styles):
        raise ValueError("No stylesheets or map script")
    if 'aria-label="Legenda de cores do mapa"' not in doc or 'MENOR VARIAÇÃO' not in SCRIPT:
        raise ValueError("IDHM choropleth legend was lost")
    print("Deployed independent IDHM map page; 27 states and yearly series verified")
if __name__=="__main__":
    cli=argparse.ArgumentParser()
    cli.add_argument("--directory",type=Path,required=True)
    patch(cli.parse_args().directory)
