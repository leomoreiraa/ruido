#!/usr/bin/env python3
"""Enriquecimento DataJud, executado EXCLUSIVAMENTE pelo GitHub Actions.
Processos vieram do TSE e já foram vinculados por SQ_CANDIDATO, UF, cargo e
nome civil; nunca identificar partes usando busca por nome no DataJud.
O código numérico J.TR do CNJ determina qual tribunal consultar.
Os metadados não comprovam acusações, culpabilidade, resultado ou identidade.
"""
import json
from html import unescape
import os
import re
import time
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

SOURCE = Path("public/data/dossies/processos-eleitorais.json")
TARGET = Path("public/data/dossies/datajud.json")
ROOT = "https://api-publica.datajud.cnj.jus.br"
ACCESS = "https://datajud-wiki.cnj.jus.br/api-publica/acesso/"
TRIBUNAIS = {
    "00":"tse", "01":"tre-ac", "02":"tre-al", "03":"tre-ap",
    "04":"tre-am", "05":"tre-ba", "06":"tre-ce", "07":"tre-dft",
    "08":"tre-es", "09":"tre-go", "10":"tre-ma", "11":"tre-mt",
    "12":"tre-ms", "13":"tre-mg", "14":"tre-pa", "15":"tre-pb",
    "16":"tre-pr", "17":"tre-pe", "18":"tre-pi", "19":"tre-rj",
    "20":"tre-rn", "21":"tre-rs", "22":"tre-ro", "23":"tre-rr",
    "24":"tre-sc", "25":"tre-se", "26":"tre-sp", "27":"tre-to",
}
PUBLIC_WIKI_KEY = "cDZHYzlZa0JadVREZDJCendQbXY6SkJlTzNjLV9TRENyQk1RdnFKZGRQdw=="
MAX_REQUESTS = min(80,max(1,int(os.environ.get("DATAJUD_MAX_REQUESTS","32"))))
MAX_SECONDS = min(900,max(60,int(os.environ.get("DATAJUD_MAX_SECONDS","510"))))

def tribunal_do_processo(numero):
    numero=re.sub(r"\D","",str(numero))
    if len(numero)!=20 or numero[13]!="6": return None
    return TRIBUNAIS.get(numero[14:16])

def obter_chave():
    supplied=os.getenv("DATAJUD_API_KEY","").strip()
    if supplied: return supplied.removeprefix("APIKey ").strip()
    req=urllib.request.Request(ACCESS,headers={"User-Agent":"RUÍDO/1.0 observatorio civico"})
    with urllib.request.urlopen(req,timeout=20) as response:
        if not response.geturl().startswith(ACCESS): raise ValueError("Origem de credencial não autorizada")
        html=response.read(500_000).decode("utf-8","replace")
    match=re.search(r"Authorization:\s*APIKey\s+([A-Za-z0-9+/=]{30,})",html,re.I)
    if not match: match=re.search(r"APIKey\s+([A-Za-z0-9+/=]{30,})",html,re.I)
    if not match:
        plain=unescape(re.sub(r"<[^>]+>", " ", html))
        plain=" ".join(plain.split())
        match=re.search(r"APIKey\s+([A-Za-z0-9+/=]{30,})",plain,re.I)
    return match.group(1) if match else PUBLIC_WIKI_KEY

def consultar(numero,tribunal,chave):
    endpoint=f"{ROOT}/api_publica_{tribunal}/_search"
    body=json.dumps({"size":3,"query":{"match":{"numeroProcesso":numero}}}).encode()
    request=urllib.request.Request(endpoint,data=body,method="POST",headers={
       "Authorization":"APIKey "+chave,"Content-Type":"application/json",
       "User-Agent":"RUÍDO/1.0 (dados publicos; github.com/leomoreiraa/ruido)"})
    with urllib.request.urlopen(request,timeout=14) as response:
        if response.geturl()!=endpoint: raise ValueError("Redirecionamento de API não autorizado")
        payload=response.read(900_000)
    data=json.loads(payload)
    if not isinstance(data.get("hits",{}).get("hits"),list): raise ValueError("Resposta inesperada do DataJud")
    return [item.get("_source",{}) for item in data["hits"]["hits"]]

def main():
    if not SOURCE.is_file():raise RuntimeError("A coleta judicial TSE ainda não foi concluída")
    source=json.loads(SOURCE.read_text())
    if not isinstance(source.get("dados"),dict):raise RuntimeError("TSE com dados inválidos")
    previous=json.loads(TARGET.read_text()) if TARGET.exists() else {"version":1,"dados":{}}
    stored=previous.get("dados",{})
    if not isinstance(stored,dict):stored={}
    retries=previous.get("pendentes",{})
    if not isinstance(retries,dict):retries={}
    key=None
    try:key=obter_chave()
    except (urllib.error.URLError,ValueError,TimeoutError) as exc:
        print("DataJud: credencial oficial indisponível:",type(exc).__name__)
        key=PUBLIC_WIKI_KEY

    unique={}
    for pid,records in sorted(source["dados"].items()):
        if not isinstance(records,list):continue
        for record in records:
            number=re.sub(r"\D","",str(record.get("numeroProcesso","")))
            tribunal=tribunal_do_processo(number)
            if not tribunal or record.get("situacao")!="PARTE_PROCESSUAL_ELEITORAL":continue
            if not str(record.get("fonte","")).startswith("https://cdn.tse.jus.br/"):continue
            if not isinstance(record.get("conferidoEm"),str):continue
            if number in stored.get(pid,{}):continue
            unique.setdefault(number,{"tribunal":tribunal,"pids":set()})["pids"].add(pid)

    pending={number:item for number,item in retries.items()
             if number in unique and isinstance(item,dict)}
    now=datetime.now(timezone.utc)
    current_iso=now.isoformat()
    available=sorted(unique)
    anchor=str(previous.get("proximoNumero") or "")
    from bisect import bisect_left
    index=bisect_left(available,anchor) if anchor else 0
    ordered=available[index:]+available[:index]
    due=[num for num in available if num in pending
         and str(pending[num].get("proximaTentativaEm",""))<=current_iso]
    queue=list(dict.fromkeys(due+[num for num in ordered if num not in pending]))
    total=len(available)
    updated=checked=not_found=errors=0
    begun=time.monotonic()
    interrupted=None
    next_number=anchor

    def save():
        estado="PARCIAL" if interrupted or errors or len(queue)>checked else "CONCLUIDA"
        coverage={"processosTseElegiveis":total,"consultas":checked,
           "correspondenciasNovas":updated,"semRetorno":not_found,
           "erros":errors,"pendentes":len(pending),
           "naFilaNestaRodada":max(0,len(queue)-checked),"estado":estado,
           "restricao":interrupted,
           "metodo":"Consulta por número CNJ J.TR após vínculo TSE; retomada por número estável"}
        output={"version":1,"atualizadoEm":datetime.now(timezone.utc).isoformat(),
                "proximoNumero":next_number,"dados":stored,"pendentes":pending,
                "cobertura":coverage}
        TARGET.parent.mkdir(parents=True,exist_ok=True)
        tmp=TARGET.with_suffix(".json.tmp")
        tmp.write_text(json.dumps(output,ensure_ascii=False,sort_keys=True,separators=(",",":"))+"\n")
        tmp.replace(TARGET)
        return coverage

    if not key:
        interrupted="Credencial CNJ indisponível"
        print(json.dumps(save(),ensure_ascii=False))
        return

    for number in queue:
        if checked>=MAX_REQUESTS or time.monotonic()-begun>=MAX_SECONDS:break
        checked+=1
        info=unique[number]
        successful=False
        try:
            result=consultar(number,info["tribunal"],key)
            found=next((m for m in result if re.sub(r"\D","",str(m.get("numeroProcesso","")))==number),None)
            if found is None:
                not_found+=1
                raise LookupError("CNJ sem registro correspondente na resposta")
            movimentos=found.get("movimentos")
            latest=max((m.get("dataHora","") for m in (
                movimentos if isinstance(movimentos,list) else [])
                if isinstance(m,dict) and isinstance(m.get("dataHora"),str)),default="")
            classe=found.get("classe")
            item={"numeroProcesso":number,"tribunal":info["tribunal"].upper(),
                "classe":classe.get("nome") if isinstance(classe,dict) else None,
                "dataAjuizamento":found.get("dataAjuizamento"),
                "ultimoMovimentoEm":latest or None,
                "conferidoEm":datetime.now(timezone.utc).isoformat(),
                "fonte":f"{ROOT}/api_publica_{info['tribunal']}/_search",
                "aviso":"Metadados CNJ não comprovam acusação, culpa ou situação judicial."}
            for pid in info["pids"]:
                stored.setdefault(pid,{})[number]=item
                updated+=1
            successful=True
        except (urllib.error.HTTPError,urllib.error.URLError,TimeoutError,ValueError,
                LookupError,OSError) as exc:
            errors+=1
            attempt=min(20,int(pending.get(number,{}).get("tentativas",0))+1)
            delay=86400 if isinstance(exc,LookupError) else min(43200,60*2**min(attempt,9))
            retry_at=datetime.fromtimestamp(time.time()+delay,timezone.utc).isoformat()
            pending[number]={"tentativas":attempt,"proximaTentativaEm":retry_at,
                             "ultimoErro":type(exc).__name__}
            if isinstance(exc,urllib.error.HTTPError) and exc.code in (401,403,429):
                interrupted=f"CNJ HTTP {exc.code}: retomada futura sem perda do item"
            print(f"DataJud pendente {info['tribunal']}: {type(exc).__name__}")
        if successful:
            pending.pop(number,None)
        if successful:
            from bisect import bisect_right
            pos=bisect_right(available,number)
            next_number=available[pos%len(available)] if available else ""
        coverage=save()   
        if interrupted:break
        time.sleep(1.25)  
    coverage=save()
    print("DataJud CNJ: "+json.dumps(coverage,ensure_ascii=False))

if __name__=="__main__":
    main()
