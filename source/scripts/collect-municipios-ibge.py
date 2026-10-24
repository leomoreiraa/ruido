#!/usr/bin/env python3
"""Catálogo municipal com código IBGE via IBGE ou snapshot eleitoral oficial TSE."""
import json
from pathlib import Path
import re
from urllib.request import Request,urlopen

LOCALIDADES="https://servicodados.ibge.gov.br/api/v1/localidades/municipios"
CENSO="https://apisidra.ibge.gov.br/values/t/4714/n6/all/v/93/p/2022"
DEST=Path("public/data/municipios-brasil.json")
SNAPSHOT_TSE=Path("public/data/eleicoes-2026-1.json")
TSE_MUNICIPIOS="https://resultados.tse.jus.br/oficial/ele2026/6257/config/mun-e006257-cm.json"

def baixar(url):
    req=Request(url,headers={"User-Agent":"RUÍDO/1.0 (dados municipais oficiais)","Accept":"application/json"})
    with urlopen(req,timeout=12) as res:
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

def preparar_tse(snapshot):
    if not isinstance(snapshot,dict) or snapshot.get("fonte")!="https://resultados.tse.jus.br/oficial" or snapshot.get("eleicao")!="6257" or snapshot.get("turno")!=1:
        raise ValueError("Snapshot eleitoral não validado")
    raw=snapshot.get("municipios",[])
    if not isinstance(raw,list) or len(raw)<5500:
        raise ValueError("Snapshot eleitoral sem cobertura municipal")
    result=[]
    for item in raw:
        code=str(item.get("codigoIBGE",""))
        uf=str(item.get("uf","")).upper()
        name=str(item.get("nome","")).strip()
        if not re.fullmatch(r"\d{7}",code) or not re.fullmatch(r"[A-Z]{2}",uf) or not name:
            raise ValueError("Código municipal inválido no TSE")
        if not code.startswith({"RO":"11","AC":"12","AM":"13","RR":"14","PA":"15","AP":"16","TO":"17","MA":"21","PI":"22","CE":"23","RN":"24","PB":"25","PE":"26","AL":"27","SE":"28","BA":"29","MG":"31","ES":"32","RJ":"33","SP":"35","PR":"41","SC":"42","RS":"43","MS":"50","MT":"51","GO":"52","DF":"53"}[uf]):
            raise ValueError("Código IBGE não corresponde à UF")
        result.append({"codigoIBGE":code,"uf":uf,"nome":name,"populacaoCenso2022":None})
    if len({m["codigoIBGE"] for m in result})!=len(result) or len({m["uf"] for m in result})!=27:
        raise ValueError("Municípios TSE duplicados ou UFs faltando")
    result.sort(key=lambda m:(m["uf"],m["nome"]))
    return {"versao":1,"fontes":{"municipios":TSE_MUNICIPIOS,"populacao":CENSO},
            "populacaoCompleta":False,"municipios":result}

def main():
    try:
        localidades=baixar(LOCALIDADES)
        try:
            censo=baixar(CENSO)
        except Exception as err:
            censo=None
            print("Aviso: Censo municipal indisponível:",type(err).__name__)
        resultado=preparar(localidades,censo)
    except Exception as err:
        print("IBGE indisponível, usando códigos IBGE do snapshot TSE oficial:",type(err).__name__)
        if not SNAPSHOT_TSE.is_file():
            raise RuntimeError("Tanto IBGE quanto snapshot TSE indisponíveis") from err
        resultado=preparar_tse(json.loads(SNAPSHOT_TSE.read_text(encoding="utf-8")))
    DEST.parent.mkdir(parents=True,exist_ok=True)
    tmp=DEST.with_suffix(".tmp")
    tmp.write_text(json.dumps(resultado,ensure_ascii=False,separators=(",",":")),encoding="utf8")
    tmp.replace(DEST)
    print("Municípios validados:",len(resultado["municipios"]),"Origem:",resultado["fontes"]["municipios"],"Censo:",resultado["populacaoCompleta"])

if __name__=="__main__":main()
