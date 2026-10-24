#!/usr/bin/env python3
"""Catálogo oficial de municípios (IBGE), com população do Censo 2022 quando validada."""
import json
from pathlib import Path
import re
from urllib.request import Request,urlopen

LOCALIDADES="https://servicodados.ibge.gov.br/api/v1/localidades/municipios"
CENSO="https://apisidra.ibge.gov.br/values/t/4714/n6/all/v/93/p/2022"
DEST=Path("public/data/municipios-brasil.json")

def baixar(url):
    req=Request(url,headers={"User-Agent":"RUÍDO/1.0 (dados municipais oficiais)","Accept":"application/json"})
    with urlopen(req,timeout=65) as res:
        if res.status!=200:raise RuntimeError("HTTP "+str(res.status))
        return json.loads(res.read(12000000))

def uf_do_ibge(row):
    uf=((row.get("microrregiao") or {}).get("mesorregiao") or {}).get("UF")
    if not uf:
        uf=((row.get("regiao-imediata") or {}).get("regiao-intermediaria") or {}).get("UF")
    return str((uf or {}).get("sigla") or "")

def preparar(localidades,censo=None):
    if not isinstance(localidades,list):raise ValueError("IBGE localidades sem lista")
    municipios=[]
    for item in localidades:
        if not isinstance(item,dict):continue
        cod=str(item.get("id",""))
        uf=uf_do_ibge(item)
        nome=str(item.get("nome") or "").strip()
        if not re.fullmatch(r"\d{7}",cod) or not re.fullmatch(r"[A-Z]{2}",uf) or not nome:continue
        municipios.append({"codigoIBGE":cod,"nome":nome,"uf":uf,"populacaoCenso2022":None})
    municipios.sort(key=lambda x:(x["uf"],x["nome"]))
    if len(municipios)<5500 or len(set(m["codigoIBGE"] for m in municipios))!=len(municipios) or len(set(m["uf"] for m in municipios))!=27:
        raise ValueError("Catalogo municipal IBGE incompleto, recusado")
    census={}
    if isinstance(censo,list):
        for row in censo:
            if not isinstance(row,dict):continue
            codes=[str(v) for k,v in row.items() if re.fullmatch(r"D\d+C",k)]
            ibge=next((v for v in codes if re.fullmatch(r"\d{7}",v)),None)
            year=next((v for v in codes if v=="2022"),None)
            raw=str(row.get("V") or "")
            if ibge and year and re.fullmatch(r"\d+",raw):
                census[ibge]=int(raw)
    if len(census)>=5500:
        for city in municipios:
            city["populacaoCenso2022"]=census.get(city["codigoIBGE"])
    return {"versao":1,"fontes":{"municipios":LOCALIDADES,"populacao":CENSO},"populacaoCompleta":len(census)>=5500,"municipios":municipios}

def main():
    localidades=baixar(LOCALIDADES)
    try:
        censo=baixar(CENSO)
    except Exception as err:
        censo=None
        print("Aviso: Censo municipal indisponivel:",type(err).__name__)
    resultado=preparar(localidades,censo)
    DEST.parent.mkdir(parents=True,exist_ok=True)
    tmp=DEST.with_suffix(".tmp")
    tmp.write_text(json.dumps(resultado,ensure_ascii=False,separators=(",",":")),encoding="utf8")
    tmp.replace(DEST)
    print("Municipios IBGE verificados:",len(resultado["municipios"]),"Censo:",resultado["populacaoCompleta"])

if __name__=="__main__":main()
