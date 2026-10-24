#!/usr/bin/env python3
"""Recupera o JSON parcial mais recente produzido por um workflow confiável.

Apenas artefatos deste repositório na branch main; não aceita caminhos
fornecidos pelo artefato, links externos nem sobrescreve dados mais novos.
Nunca transforma um JSON parcial em informação oficialmente validada.
"""
import argparse
import json
import os
from pathlib import Path
import subprocess
import tempfile
from datetime import datetime

FILES={
    "news":"public/data/dossies/noticias.json",
    "datajud":"public/data/dossies/datajud.json",
    "finance":"public/data/dossies/redes-financeiras.json",
    "official-ai":"public/data/dossies/analises-oficiais.json",
}
PREFIX="ruido-checkpoint-v1-"

def validate(path):
    p=Path(path)
    if p.stat().st_size>75_000_000:
        raise ValueError("Checkpoint excedeu o limite de 75 MB")
    data=json.loads(p.read_text(encoding="utf-8"))
    if not isinstance(data,dict) or data.get("version")!=1 or not isinstance(data.get("dados"),dict):
        raise ValueError("Estrutura incompatível com o coletor")
    if len(data["dados"])>35000:
        raise ValueError("Quantidade de entradas incoerente")
    updated=data.get("atualizadoEm")
    if not isinstance(updated,str):
        raise ValueError("Timestamp ausente")
    stamp=datetime.fromisoformat(updated.replace("Z","+00:00")).timestamp()
    if stamp<1_500_000_000 or stamp>4_102_444_800:
        raise ValueError("Timestamp inválido")
    return stamp

def restore(kind, repository, current_run):
    target=Path(FILES[kind])
    committed=validate(target) if target.exists() else 0
    if not repository or not os.getenv("GH_TOKEN"):
        print("Sem sessão autenticada; mantendo versão do repositório")
        return False
    payload=subprocess.check_output(
        ["gh","api",f"repos/{repository}/actions/artifacts?per_page=100"],
        text=True,timeout=35)
    candidates=json.loads(payload).get("artifacts",[])
    matches=[
        a for a in candidates if a.get("name","").startswith(PREFIX+kind+"-")
        and not a.get("expired")
        and a.get("workflow_run",{}).get("head_branch")=="main"
        and str(a.get("workflow_run",{}).get("id"))!=str(current_run)
    ]
    for artifact in sorted(matches,key=lambda a:a.get("created_at",""),reverse=True)[:6]:
        with tempfile.TemporaryDirectory(prefix="ruido-cp-") as directory:
            try:
                subprocess.run(
                    ["gh","run","download",str(artifact["workflow_run"]["id"]),
                     "--repo",repository,"--name",artifact["name"],"--dir",directory],
                    check=True,stdout=subprocess.DEVNULL,timeout=110)
                candidate=Path(directory)/target.name
                if not candidate.is_file():
                    continue
                stamp=validate(candidate)
                if stamp<=committed:
                    continue
                target.parent.mkdir(parents=True,exist_ok=True)
                temporary=target.with_suffix(".json.recovery-tmp")
                temporary.write_bytes(candidate.read_bytes())
                temporary.replace(target)
                print("Retomado checkpoint validado:",kind,"run",
                      artifact["workflow_run"]["id"])
                return True
            except (OSError,ValueError,KeyError,subprocess.SubprocessError) as exc:
                print("Artefato de recuperação recusado:",type(exc).__name__)
    print("Nenhum checkpoint mais recente para:",kind)
    return False

if __name__=="__main__":
    p=argparse.ArgumentParser()
    p.add_argument("operation",choices=["restore","verify"])
    p.add_argument("kind",choices=sorted(FILES))
    options=p.parse_args()
    if options.operation=="verify":
        path=Path(FILES[options.kind])
        if path.exists():
            validate(path)
        print("Checkpoint válido:",options.kind)
    else:
        restore(options.kind,os.getenv("GITHUB_REPOSITORY",""),os.getenv("GITHUB_RUN_ID",""))
