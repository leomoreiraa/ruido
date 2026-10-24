#!/usr/bin/env python3
"""Lightweight official-API refresh of an existing validated GitHub Pages map.

This is independent from the multi-hour Congressional SQLite reconstruction.
Only newly validated population/credit observations are merged; official
IDHM snapshots are refreshed by collect-idhm.py, never extrapolated.
"""
import argparse
import datetime as dt
import json
from pathlib import Path
import re
import time
from urllib.request import Request, urlopen

SIDRA="https://apisidra.ibge.gov.br/values/t/6579/n3/all/v/9324/p/last%2010"
BCB="https://api.bcb.gov.br/dados/serie/bcdata.sgs.{}/dados?formato=json&dataInicial=01%2F01%2F2022&dataFinal={}"
MEI={
"AC":27327,"AL":27328,"AM":27329,"AP":27330,"BA":27331,"CE":27332,
"DF":27333,"ES":27334,"GO":27335,"MA":27336,"MG":27337,"MS":27338,
"MT":27339,"PA":27340,"PB":27341,"PE":27342,"PI":27343,"PR":26610,
"RJ":26611,"RN":26612,"RO":26613,"RR":26614,"RS":26615,"SC":26616,
"SE":26617,"SP":26618,"TO":26619}
CODE={"11":"RO","12":"AC","13":"AM","14":"RR","15":"PA","16":"AP",
"17":"TO","21":"MA","22":"PI","23":"CE","24":"RN","25":"PB",
"26":"PE","27":"AL","28":"SE","29":"BA","31":"MG","32":"ES",
"33":"RJ","35":"SP","41":"PR","42":"SC","43":"RS","50":"MS",
"51":"MT","52":"GO","53":"DF"}

def official_json(url,timeout=25,retries=2):
    for n in range(retries+1):
        try:
            with urlopen(Request(url,headers={"User-Agent":"RUIDO/1.0 open-data map","Accept":"application/json"}),timeout=timeout) as response:
                if response.status!=200: raise RuntimeError("HTTP "+str(response.status))
                return json.loads(response.read(6000000))
        except Exception:
            if n==retries: raise
            time.sleep(2*(n+1))

def numeric(x):
    if x is None or str(x).strip() in ("","-","..","...","X"):return None
    value=str(x).strip()
    try:
        n=float(value.replace(".","").replace(",",".")) if "," in value else float(value)
        return n if n>=0 and n!=float("inf") else None
    except ValueError: return None

def parse_sidra(data):
    result={}
    if not isinstance(data,list):return result
    for line in data:
        if not isinstance(line,dict):continue
        pop=numeric(line.get("V"))
        values=[str(v) for k,v in line.items() if re.fullmatch(r"D\d+C",k)]
        uf=next((CODE[x] for x in values if x in CODE),None)
        year=next((x for x in values if re.fullmatch(r"20\d\d",x) and 2022<=int(x)<=dt.date.today().year),None)
        if uf and year and pop is not None and pop>10000:result[(uf,year)]=int(pop)
    return result

def apply_population(states,values):
    count=0
    for state in states:
        for (uf,year),value in values.items():
            if state.get("uf")!=uf:continue
            rec=state.get("porAno",{}).setdefault(year,{
                "pibMilReais":None,"populacao":None,"emendasPagas":None,"emendasCount":0})
            if rec.get("populacao")!=value:
                rec["populacao"]=value
                count+=1
    return count

def apply_credit(state,rows,serie):
    if not isinstance(rows,list):return False
    history=state.setdefault("creditoMeiPorAno",{})
    for row in rows:
        if not isinstance(row,dict):continue
        date=row.get("data")
        if not isinstance(date,str) or not re.fullmatch(r"\d\d/\d\d/20\d\d",date):continue
        year=date[-4:]
        if int(year)<2022:continue
        val=numeric(row.get("valor"))
        if val is None:continue
        current=history.get(year)
        if not current or date[-4:]+date[3:5]+date[:2] >= current["data"][-4:]+current["data"][3:5]+current["data"][:2]:
            history[year]={"data":date,"milhoesReais":val,"serie":serie}
    if history:
        state["creditoMei"]=history[max(history,key=lambda y:history[y]["data"][-4:]+history[y]["data"][3:5]+history[y]["data"][:2])]
        return True
    return False

def main():
    parser=argparse.ArgumentParser()
    parser.add_argument("--directory",type=Path,required=True)
    args=parser.parse_args()
    folder=args.directory/"data"
    statepath=folder/"brasil-estados.json"
    idhmpath=folder/"idhm-ufs.json"
    states=json.loads(statepath.read_text(encoding="utf8"))
    idhm=json.loads(idhmpath.read_text(encoding="utf8"))
    if len(states.get("estados",[]))!=27 or len(idhm.get("porUF",{}))!=27:
        raise ValueError("Cannot refresh incomplete map: 27 UFs required")
    indexed={e["uf"]:e for e in states["estados"]}
    if set(indexed)!=set(MEI):raise ValueError("Unknown or missing state in official map")
    messages=[]
    changed=0
    try:
        values=parse_sidra(official_json(SIDRA))
        if len({uf for uf,year in values if year==str(dt.date.today().year)})<20 and len({uf for uf,year in values})<25:
            raise ValueError("IBGE returned insufficient UF coverage")
        changed=apply_population(states["estados"],values)
        messages.append("IBGE/SIDRA population refreshed from 6579/9324; "+str(changed)+" updated observations")
    except Exception as err:
        messages.append("IBGE unavailable; keeping previously verified observations ("+type(err).__name__+")")
    credits=0
    today=dt.datetime.now(dt.timezone.utc).strftime("%d%%2F%m%%2F%Y")
    for uf,serie in MEI.items():
        time.sleep(.25)
        try:
            if apply_credit(indexed[uf],official_json(BCB.format(serie,today),timeout=18,retries=0),serie):
                credits+=1
        except Exception:
            continue
    if credits:messages.append("BCB SGS latest annual MEI reference in "+str(credits)+" UFs")
    else:messages.append("BCB SGS unavailable; prior observations retained")
    states["atualizadoEm"]=dt.datetime.now(dt.timezone.utc).isoformat()
    states["avisos"]=[a for a in states.get("avisos",[]) if not a.startswith("Atualização leve")] + [
        "Atualização leve: "+msg for msg in messages]
    states["fonteApiVerificadaEm"]=dt.datetime.now(dt.timezone.utc).isoformat()
    states["fontes"]["populacao"]="https://sidra.ibge.gov.br/tabela/6579"
    states["fontes"]["creditoMei"]="https://dadosabertos.bcb.gov.br/"
    statepath.write_text(json.dumps(states,ensure_ascii=False,separators=(",",":")),encoding="utf8")
    print(json.dumps({"tipo":"mapa_oficial","estados":27,"idhm_ate":idhm["serieAte"],
        "populacao_observacoes_atualizadas":changed,"series_mei":credits,
        "avisos":messages},ensure_ascii=False))

if __name__=="__main__":
    main()
