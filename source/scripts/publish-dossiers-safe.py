#!/usr/bin/env python3
"""Publish a verified dossier JSON delta on top of the LATEST main.

A job can start on an old commit while other collectors publish new data.
Never rebase a large generated JSON commit. Reconcile individual dossier
records against the checkout base and current main, then fast-forward push.
Overlapping evidence is reconciled only by a verifiable collection timestamp;
ambiguous conflicts fail closed instead of dropping either update.
"""
import argparse
import copy
from datetime import datetime
import json
import os
from pathlib import Path
import subprocess
import sys
import time

ALLOWED={
    "public/data/dossies/financeiro.json",
    "public/data/dossies/patrimonio.json",
    "public/data/dossies/processos-eleitorais.json",
    "public/data/dossies/analises-oficiais.json",
    "public/data/dossies/datajud.json",
}
MISSING=object()

def git(*args, check=True):
    return subprocess.run(["git",*args],text=True,capture_output=True,check=check)

def get_doc(raw, label):
    data=json.loads(raw)
    if not isinstance(data,dict) or data.get("version")!=1 or not isinstance(data.get("dados"),dict):
        raise ValueError("JSON incompleto ou inválido: "+label)
    if len(data["dados"])>30000:
        raise ValueError("Índice inesperadamente grande: "+label)
    return data

def git_doc(revision,path):
    result=git("show",f"{revision}:{path}",check=False)
    if result.returncode:
        return {"version":1,"dados":{}}
    return get_doc(result.stdout,path)

def when(item):
    if not isinstance(item,dict):return None
    for name in ("coletadoEm","conferidoEm","atualizadoEm"):
        stamp=item.get(name)
        if isinstance(stamp,str):
            try:return datetime.fromisoformat(stamp.replace("Z","+00:00")).timestamp()
            except ValueError:pass
    return None

def latest(a,b,path):
    ta,tb=when(a),when(b)
    if ta is None or tb is None or ta==tb:
        raise ValueError("Conflito sem data oficial desambiguadora: "+path)
    return copy.deepcopy(a if ta>tb else b)

def list_key(item):
    if not isinstance(item,dict):return None
    num=item.get("numeroProcesso")
    year=item.get("anoEleicao")
    if isinstance(num,str) and num.isdigit() and isinstance(year,int):
        return (num,year)
    return None

def merge_list(base,ours,theirs,path):
    if not all(isinstance(x,list) for x in (base,ours,theirs)):
        raise ValueError("Conflito entre formatos de lista: "+path)
    if not all(list_key(x) for ls in (base,ours,theirs) for x in ls):
        raise ValueError("Listas sem identificador de processo: "+path)
    old={list_key(x):x for x in base}
    out={list_key(x):x for x in theirs}
    for item in ours:
        key=list_key(item)
        before=old.get(key,MISSING)
        current=out.get(key,MISSING)
        out[key]=merge_value(before,item,current,path+"/"+str(key))
    result=sorted(out.values(),key=lambda item:item.get("conferidoEm",""),reverse=True)
    return result[:25]

def merge_value(base,ours,theirs,path):
    # Uma rotina parcial jamais apaga por omissão evidência já publicada.
    if ours is MISSING and theirs is MISSING:return MISSING
    if ours is MISSING:return copy.deepcopy(theirs)
    if theirs is MISSING:return copy.deepcopy(ours)
    if ours==base:return copy.deepcopy(theirs)
    if theirs==base:return copy.deepcopy(ours)
    if ours==theirs:return copy.deepcopy(ours)
    if ours is MISSING or theirs is MISSING:
        # Existing evidence should not disappear because one writer omitted it.
        return copy.deepcopy(theirs if ours is MISSING else ours)
    if isinstance(ours,dict) and isinstance(theirs,dict):
        # Atomic unit of evidence: changing a valuation or its source must not
        # mix fields from two collection versions.
        record_fields={"valor","totalDeclarado","texto","fonteHash",
                       "conferidoEm","coletadoEm","situacao"}
        if record_fields.intersection(ours)|record_fields.intersection(theirs):
            return latest(ours,theirs,path)
        if base is not MISSING and not isinstance(base,dict):
            raise ValueError("Conflito de formato: "+path)
        previous={} if base is MISSING else base
        return {key:merge_value(previous.get(key,MISSING),
                    ours.get(key,MISSING),theirs.get(key,MISSING),
                    path+"/"+str(key))
                for key in (previous.keys()|ours.keys()|theirs.keys())
                if not (ours.get(key,MISSING) is MISSING and
                        theirs.get(key,MISSING) is MISSING)}
    if isinstance(ours,list) and isinstance(theirs,list):
        return merge_list([] if base is MISSING else base,ours,theirs,path)
    return latest(ours,theirs,path)

def merge_document(base,ours,theirs):
    if any(d.get("version")!=1 or not isinstance(d.get("dados"),dict)
           for d in (base,ours,theirs)):
        raise ValueError("Versão/estrutura de dossiê incompatível")
    merged=copy.deepcopy(theirs)
    for pid in set(base["dados"])|set(ours["dados"])|set(theirs["dados"]):
        previous=base["dados"].get(pid,MISSING)
        local=ours["dados"].get(pid,MISSING)
        remote=theirs["dados"].get(pid,MISSING)
        entry=merge_value(previous,local,remote,"dados/"+pid)
        if entry is not MISSING:merged["dados"][pid]=entry
    own_time=when(ours)
    remote_time=when(theirs)
    if own_time and (not remote_time or own_time>=remote_time):
        # Metadata belongs to the newest completed collection; evidence is
        # merged independently so earlier records remain present.
        for k,v in ours.items():
            if k not in ("version","dados"):merged[k]=copy.deepcopy(v)
    return merged

def publish(paths,attempts=6):
    if not paths or len(set(paths))!=len(paths) or not set(paths)<=ALLOWED:
        raise ValueError("Arquivos fora da lista exclusiva dos dossiês")
    base=git("rev-parse","HEAD").stdout.strip()
    candidates={p:get_doc(Path(p).read_text(encoding="utf-8"),p) for p in paths}
    originals={p:git_doc(base,p) for p in paths}
    if not all(isinstance(item.get("dados"),dict) for item in candidates.values()):
        raise ValueError("Coleta sem dossiê válido")
    for attempt in range(1,attempts+1):
        git("fetch","origin","main")
        current=git("rev-parse","origin/main").stdout.strip()
        merged={}
        for p in paths:
            merged[p]=merge_document(originals[p],candidates[p],git_doc(current,p))
        # Candidate data is in memory. Resetting a runner checkout never
        # resets or force-pushes the remote branch.
        git("reset","--hard",current)
        for p,doc in merged.items():
            dest=Path(p)
            dest.parent.mkdir(parents=True,exist_ok=True)
            dest.write_text(json.dumps(doc,ensure_ascii=False,
                sort_keys=True,separators=(",",":"))+"\n",encoding="utf-8")
        git("add","--",*paths)
        if not git("diff","--cached","--quiet",check=False).returncode:
            print("Nenhuma alteração restante: a main já contém os dados")
            return False
        git("config","user.name","ruido-dossiers-bot")
        git("config","user.email","github-actions[bot]@users.noreply.github.com")
        git("commit","-m","data(dossies): conciliar coleta validada com a main [skip ci]")
        pushed=git("push","origin","HEAD:main",check=False)
        if pushed.returncode==0:
            print(f"Dossiês enviados com fast-forward, tentativa {attempt}")
            return True
        print(f"Main atualizada em paralelo; tentativa {attempt}/{attempts}",file=sys.stderr)
        time.sleep(min(attempt*2,12))
    raise RuntimeError("Não foi possível concluir push fast-forward; artefatos preservados")

def main():
    parser=argparse.ArgumentParser()
    parser.add_argument("paths",nargs="+")
    args=parser.parse_args()
    result=publish(args.paths)
    output=os.getenv("GITHUB_OUTPUT")
    if output:
        with open(output,"a",encoding="utf-8") as fp:
            fp.write("changed="+str(result).lower()+"\n")

if __name__=="__main__":main()
