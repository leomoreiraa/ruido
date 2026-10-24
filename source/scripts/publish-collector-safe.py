#!/usr/bin/env python3
"""Publica notícias e finanças sem rebase dos JSONs gerados.

Três versões: checkout-base, coleta validada local e main atual. Une somente
registros identificados por chaves oficiais/URLs; conflitos sobre o MESMO
registro usam data de verificação explícita e nunca combinam campos de duas
versões. Mantém a evidência remota se a coleta parcial omiti-la.

A publicação é fast-forward, com retry caso outra coleta avance a main.
"""
import argparse
import copy
from datetime import datetime
import importlib.util
import json
import os
from pathlib import Path
import subprocess
import sys
import time

ROOT=Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location("safe_dossies",ROOT/"publish-dossiers-safe.py")
base_module=importlib.util.module_from_spec(spec)
spec.loader.exec_module(base_module)

FIN="public/data/dossies/redes-financeiras.json"
PRES="public/data/dossies/candidaturas-presidenciais.json"
NEWS="public/data/dossies/noticias.json"
KINDS={"news":(NEWS,), "finance":(FIN,PRES)}
ABSENT=object()
FIELDS={
    "campanhas":("ano",),
    "fornecedoresGabinete":("ano","cnpj","nome"),
    "fornecedoresSenado":("ano","cnpj","nome"),
    "cotasSenado":("ano",),
    "emendas":("ano","codigo"),
    "coincidencias":("anoCampanha","anoGabinete","cnpj","nomeFornecedor",
                     "valorContratadoCampanha","valorCEAP","fonteCEAP"),
}

def stamp(value):
    if not isinstance(value,str):return None
    try:
        result=datetime.fromisoformat(value.replace("Z","+00:00"))
        return result.timestamp()
    except (ValueError,OverflowError,TypeError):
        return None

def timestamp(obj,*fields):
    if not isinstance(obj,dict):return None
    for name in fields:
        value=stamp(obj.get(name))
        if value is not None:return value
    return None

def choose(old,local,remote,local_time,remote_time,where):
    """Resolve o mesmo registro; não reescreve sem prova de qual é mais novo."""
    if local is ABSENT:return copy.deepcopy(remote)
    if remote is ABSENT:return copy.deepcopy(local)
    if local==old:return copy.deepcopy(remote)
    if remote==old:return copy.deepcopy(local)
    if local==remote:return copy.deepcopy(local)
    a=timestamp(local,"ultimaConferencia","conferidoEm","coletadoEm","atualizadoEm")
    b=timestamp(remote,"ultimaConferencia","conferidoEm","coletadoEm","atualizadoEm")
    if a is None:a=local_time
    if b is None:b=remote_time
    if a is None or b is None or a==b:
        raise ValueError("Conflito ambíguo, retenção do artifact obrigatória: "+where)
    return copy.deepcopy(local if a>b else remote)

def keyed(items,key_fields,where):
    if items is ABSENT:return {}
    if not isinstance(items,list):
        raise ValueError("Lista inválida: "+where)
    result={}
    for item in items:
        if not isinstance(item,dict):raise ValueError("Item sem evidência: "+where)
        values=tuple(item.get(field) for field in key_fields)
        if any(v is None or v=="" or isinstance(v,(list,dict)) for v in values):
            raise ValueError("Registro sem chave documental: "+where)
        if values in result and result[values]!=item:
            raise ValueError("Duas versões da mesma chave na coleta: "+where)
        result[values]=item
    return result

def union_records(old,local,remote,fields,local_time,remote_time,where,limit=None,sort_key=None):
    b=keyed(old,fields,where);a=keyed(local,fields,where);z=keyed(remote,fields,where)
    merged={}
    for k in set(b)|set(a)|set(z):
        item=choose(b.get(k,ABSENT),a.get(k,ABSENT),
                    z.get(k,ABSENT),local_time,remote_time,where+"/"+repr(k))
        if item is not ABSENT:merged[k]=item
    result=list(merged.values())
    if sort_key:result.sort(key=sort_key,reverse=True)
    if limit:result=result[:limit]
    return result

def newer_metadata(old,local,remote):
    """O recorte mais novo controla cursor e diagnóstico, não as evidências."""
    if local==old:return copy.deepcopy(remote)
    if remote==old:return copy.deepcopy(local)
    if local==remote:return copy.deepcopy(local)
    t1=timestamp(local,"atualizadoEm")
    t2=timestamp(remote,"atualizadoEm")
    if t1 is None or t2 is None:return copy.deepcopy(remote)
    return copy.deepcopy(local if t1>t2 else remote)

def mix_news(base,local,remote):
    b,a,z=(base.get("dados",{}),local["dados"],remote["dados"])
    lt=timestamp(local,"atualizadoEm")
    rt=timestamp(remote,"atualizadoEm")
    output=newer_metadata(base,local,remote)
    output["version"]=1
    output["dados"]={}
    for pid in set(b)|set(a)|set(z):
        items=union_records(b.get(pid,[]),a.get(pid,[]),z.get(pid,[]),
            ("id",),lt,rt,"noticias/"+pid)
        items.sort(key=lambda x:timestamp(x,"atualizadoEm","ultimaConferencia") or 0,
                   reverse=True)
        if items:output["dados"][pid]=items[:80]
    output["clippings"]={}
    bclips=base.get("clippings",{});aclips=local.get("clippings",{});zclips=remote.get("clippings",{})
    for pid in set(bclips)|set(aclips)|set(zclips):
        items=union_records(bclips.get(pid,[]),aclips.get(pid,[]),zclips.get(pid,[]),
            ("url",),lt,rt,"clippings/"+pid)
        items.sort(key=lambda x:timestamp(x,"publicadoEm") or 0,reverse=True)
        if items:output["clippings"][pid]=items[:80]
    pending=output.get("pendentes",{})
    if not isinstance(pending,dict):pending={}
    output["pendentes"]=pending
    return output

def mix_finance(base,local,remote):
    lt=timestamp(local,"atualizadoEm")
    rt=timestamp(remote,"atualizadoEm")
    out=newer_metadata(base,local,remote)
    out["version"]=1
    out["dados"]={}
    b,a,z=(base.get("dados",{}),local["dados"],remote["dados"])
    for pid in set(b)|set(a)|set(z):
        old=b.get(pid,{})
        current=a.get(pid,{})
        published=z.get(pid,{})
        if not all(isinstance(i,dict) for i in (old,current,published)):
            raise ValueError("Estrutura financeira inválida: "+pid)
        entry={}
        for field in FIELDS:
            merged=union_records(old.get(field,[]),current.get(field,[]),
                published.get(field,[]),FIELDS[field],lt,rt,pid+"/"+field,
                sort_key=lambda i:i.get("ano",i.get("anoCampanha",0)) or 0)
            if merged:entry[field]=merged
        for field in set(old)|set(current)|set(published):
            if field in FIELDS:continue
            merged=choose(old.get(field,ABSENT),current.get(field,ABSENT),
                          published.get(field,ABSENT),lt,rt,pid+"/"+field)
            if merged is not ABSENT:entry[field]=merged
        if entry.get("coincidencias"):
            ceap={(x.get("cnpj"),x.get("ano")) for x in
                  entry.get("fornecedoresGabinete",[])+entry.get("fornecedoresSenado",[])}
            campaigns={(x.get("cnpj"),c.get("ano")) for c in entry.get("campanhas",[])
                        for x in c.get("fornecedores",[])}
            entry["coincidencias"]=[x for x in entry["coincidencias"]
                if (x.get("cnpj"),x.get("anoCampanha")) in campaigns
                and (x.get("cnpj"),x.get("anoGabinete")) in ceap]
        if entry:out["dados"][pid]=entry
    return out

def mix_presidency(base,local,remote):
    out=newer_metadata(base,local,remote)
    out["version"]=1
    out["dados"]={}
    lt=timestamp(local,"atualizadoEm");rt=timestamp(remote,"atualizadoEm")
    for pid in set(base.get("dados",{}))|set(local["dados"])|set(remote["dados"]):
        old=base.get("dados",{}).get(pid,ABSENT)
        a=local["dados"].get(pid,ABSENT)
        z=remote["dados"].get(pid,ABSENT)
        for item in (a,z):
            if item is ABSENT:continue
            if not isinstance(item,dict) or item.get("cargo")!="PRESIDENTE":
                raise ValueError("Candidatura não presidencial: "+pid)
        if isinstance(a,dict) and isinstance(z,dict):
            keys=("eleicao","numero","candidato","nomeUrna","partido")
            if any(a.get(k)!=z.get(k) for k in keys):
                raise ValueError("Identidades TSE divergentes: "+pid)
        picked=choose(old,a,z,lt,rt,"presidencial/"+pid)
        if picked is ABSENT:continue
        for evidence in ("fonteTurno","turno","fontePropostas","vice"):
            if isinstance(a,dict) and isinstance(z,dict):
                left=a.get(evidence);right=z.get(evidence)
                if left and right and left!=right:
                    raise ValueError("Fontes eleitorais divergentes: "+pid+"/"+evidence)
                if not picked.get(evidence):picked[evidence]=left or right
        out["dados"][pid]=picked
    return out

def publish(kind,attempts=6):
    paths=KINDS[kind]
    base_commit=base_module.git("rev-parse","HEAD").stdout.strip()
    originals={p:base_module.git_doc(base_commit,p) for p in paths}
    candidates={p:base_module.get_doc(Path(p).read_text(encoding="utf-8"),p) for p in paths}
    for attempt in range(1,attempts+1):
        base_module.git("fetch","origin","main")
        latest=base_module.git("rev-parse","origin/main").stdout.strip()
        changes={}
        for path in paths:
            older=originals[path]
            collected=candidates[path]
            active=base_module.git_doc(latest,path)
            if path==NEWS:
                changes[path]=mix_news(older,collected,active)
            elif path==FIN:
                changes[path]=mix_finance(older,collected,active)
            elif path==PRES:
                changes[path]=mix_presidency(older,collected,active)
        base_module.git("reset","--hard",latest)
        for path,document in changes.items():
            target=Path(path)
            target.parent.mkdir(parents=True,exist_ok=True)
            target.write_text(json.dumps(document,ensure_ascii=False,separators=(",",":"),
                sort_keys=True)+"\n",encoding="utf-8")
        base_module.git("add","--",*paths)
        if base_module.git("diff","--cached","--quiet",check=False).returncode==0:
            print("Sem alterações adicionais: dados já estão na main")
            return False
        base_module.git("config","user.name","ruido-"+kind+"-bot")
        base_module.git("config","user.email","github-actions[bot]@users.noreply.github.com")
        base_module.git("commit","-m","data("+kind+"): conciliar dados oficiais verificados [skip ci]")
        pushed=base_module.git("push","origin","HEAD:main",check=False)
        if pushed.returncode==0:
            print("Coleta conciliada com fast-forward:",kind,"tentativa",attempt)
            return True
        print("Nova atualização concorrente; reconciliando novamente",attempt, file=sys.stderr)
        time.sleep(min(2*attempt,12))
    raise RuntimeError("Tentativas de publicação esgotadas; checkpoint preservado")

def main():
    parser=argparse.ArgumentParser()
    parser.add_argument("kind",choices=sorted(KINDS))
    kind=parser.parse_args().kind
    result=publish(kind)
    if os.getenv("GITHUB_OUTPUT"):
        with open(os.environ["GITHUB_OUTPUT"],"a",encoding="utf-8") as f:
            f.write("changed="+str(result).lower()+"\n")

if __name__=="__main__":main()
