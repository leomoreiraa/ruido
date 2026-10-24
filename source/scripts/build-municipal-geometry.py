#!/usr/bin/env python3
"""Publica malhas municipais simplificadas e indexadas por codigo IBGE, isoladas por UF."""
import json
import math
import re
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from urllib.request import Request, urlopen

UF_IDS = {"RO":"11","AC":"12","AM":"13","RR":"14","PA":"15","AP":"16","TO":"17","MA":"21","PI":"22","CE":"23","RN":"24","PB":"25","PE":"26","AL":"27","SE":"28","BA":"29","MG":"31","ES":"32","RJ":"33","SP":"35","PR":"41","SC":"42","RS":"43","MS":"50","MT":"51","GO":"52","DF":"53"}
BASE="https://raw.githubusercontent.com/tbrugz/geodata-br/master/geojson/geojs-{}-mun.json"
OUTPUT=Path("public/data/municipios-malhas")

def baixar(url):
    for i in range(3):
        try:
            req=Request(url,headers={"User-Agent":"RUÍDO atlas municipal (contornos derivados do IBGE)","Accept":"application/json"})
            with urlopen(req,timeout=55) as r:
                raw=r.read(18_000_000)
            return json.loads(raw)
        except Exception:
            if i==2:raise
            time.sleep((i+1)*2)

def anel_em_pontos(coords):
    if not isinstance(coords,list):
        return []
    result=[]
    for item in coords:
        if not isinstance(item,(list,tuple)) or len(item)<2:continue
        try:
            x,y=float(item[0]),float(item[1])
        except (TypeError,ValueError):continue
        if not math.isfinite(x) or not math.isfinite(y) or not -75<=x<=-28 or not -35<=y<=6:
            continue
        result.append((x,y))
    return result

def extrair(raw):
    if not isinstance(raw,dict) or raw.get("type")!="FeatureCollection" or not isinstance(raw.get("features"),list):
        raise ValueError("Fonte nao e um GeoJSON FeatureCollection")
    municipios={}
    for ft in raw["features"]:
        if not isinstance(ft,dict):continue
        props=ft.get("properties") or {}
        codigo=str(props.get("id") or ft.get("id") or "")
        if not re.fullmatch(r"\d{7}",codigo) or codigo in municipios:
            raise ValueError("Codigo IBGE ausente/duplicado: "+codigo)
        geom=ft.get("geometry") or {}
        tipo=geom.get("type")
        rawpoly=geom.get("coordinates")
        if tipo=="Polygon":polys=[rawpoly]
        elif tipo=="MultiPolygon":polys=rawpoly
        else:raise ValueError("Geometria municipal inesperada")
        rings=[]
        for poly in polys:
            for ring in poly:
                p=anel_em_pontos(ring)
                if len(p)>=4:rings.append(p)
        if not rings:raise ValueError("Municipio sem poligonos: "+codigo)
        municipios[codigo]=rings
    return municipios

def ponto_segmento(p,a,b):
    dx=b[0]-a[0];dy=b[1]-a[1];d=dx*dx+dy*dy
    if not d:return math.hypot(p[0]-a[0],p[1]-a[1])
    t=max(0,min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/d))
    return math.hypot(p[0]-(a[0]+t*dx),p[1]-(a[1]+t*dy))

def simplificar(pontos,tol=0.55):
    if len(pontos)<=4:return pontos
    keep={0,len(pontos)-1}
    stack=[(0,len(pontos)-1)]
    while stack:
        a,b=stack.pop()
        if b-a<2:continue
        best=-1;indice=None
        for i in range(a+1,b):
            dist=ponto_segmento(pontos[i],pontos[a],pontos[b])
            if dist>best:best=dist;indice=i
        if best>tol and indice is not None:
            keep.add(indice);stack.extend([(a,indice),(indice,b)])
    return [pontos[i] for i in sorted(keep)]

def exportar(raw,uf,esperados=None):
    municipios=extrair(raw)
    if any(not c.startswith(UF_IDS[uf]) for c in municipios):
        raise ValueError("Codigo IBGE nao corresponde a UF: "+uf)
    if esperados is not None:
        matched=set(municipios)&set(esperados)
        if len(matched)<len(esperados)*.96:
            raise ValueError("Cobertura cartografica insuficiente para "+uf)
    pts=[point for rings in municipios.values() for ring in rings for point in ring]
    west=min(x for x,y in pts);east=max(x for x,y in pts);south=min(y for x,y in pts);north=max(y for x,y in pts)
    spanx=max(east-west,1e-6);spany=max(north-south,1e-6)
    scale=min(760/spanx,570/spany)
    ox=(800-spanx*scale)/2;oy=(610-spany*scale)/2
    features=[]
    for code,rings in sorted(municipios.items()):
        paths=[]
        for ring in rings:
            projected=[(ox+(lon-west)*scale,oy+(north-lat)*scale) for lon,lat in ring]
            reduced=simplificar(projected)
            if len(reduced)<3:continue
            d="".join(("M" if i==0 else "L")+format(x,".1f")+","+format(y,".1f") for i,(x,y) in enumerate(reduced))+"Z"
            paths.append(d)
        if paths:features.append({"id":code,"d":"".join(paths)})
    if esperados is not None and len({f["id"] for f in features}&set(esperados))<len(esperados)*.96:
        raise ValueError("Renderizacao omitiu municipios")
    return {"versao":1,"uf":uf,"fonte":BASE.format(UF_IDS[uf]),"origem":"Geodata BR, geometria derivada IBGE (CC0)","viewBox":"0 0 800 610","municipios":features}

def coletar(catalogo,uf):
    url=BASE.format(UF_IDS[uf])
    result=exportar(baixar(url),uf,catalogo[uf])
    return uf,result

def main():
    try:
        existing=json.loads(Path("public/data/municipios-brasil.json").read_text(encoding="utf-8"))
        catalogo={uf:set() for uf in UF_IDS}
        for city in existing["municipios"]:
            if city["uf"] in catalogo:catalogo[city["uf"]].add(city["codigoIBGE"])
    except (FileNotFoundError,ValueError,KeyError):
        raise RuntimeError("Primeiro execute collect-municipios-ibge.py para auditar os codigos IBGE")
    if any(not catalogo[uf] for uf in catalogo):
        raise ValueError("Catalogo sem cobertura de 27 UFs")
    updates={}
    with ThreadPoolExecutor(max_workers=4) as pool:
        tasks={pool.submit(coletar,catalogo,uf):uf for uf in UF_IDS}
        for done in as_completed(tasks):
            uf,info=done.result()
            updates[uf]=info
            print(uf,len(info["municipios"]))
    if len(updates)!=27:raise ValueError("Coleta incompleta")
    OUTPUT.mkdir(parents=True,exist_ok=True)
    for uf,item in updates.items():
        temp=OUTPUT/(uf+".json.tmp")
        temp.write_text(json.dumps(item,ensure_ascii=False,separators=(",",":")),encoding="utf-8")
        temp.replace(OUTPUT/(uf+".json"))
    print("Malhas municipais geradas: 27 UFs")

if __name__=="__main__":main()
