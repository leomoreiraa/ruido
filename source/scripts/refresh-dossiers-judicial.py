#!/usr/bin/env python3
"""Registros PROCESSUAIS ELEITORAIS públicos do TSE, sem inferência penal.
Somente há vínculo se identificador SQ_CANDIDATO corresponde à candidatura
única (nome civil, UF e cargo) do parlamentar. Nome de parte sozinho NÃO
basta; status processuais são registrados como papel/participação, jamais
como réu, condenado ou investigado. Caso o layout não permita a correlação
segura, o resultado será vazio, com motivo e cobertura declarados.
"""
import csv
import io
import json
import os
import re
import sqlite3
import unicodedata
import urllib.request
import zipfile
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path

DB = Path(os.environ.get("DOSSIER_DB", "prisma/dev.db"))
OUTPUT = Path("public/data/dossies/processos-eleitorais.json")
YEARS = (2022, 2026)
ROOT = "https://cdn.tse.jus.br/estatistica/sead/odsele/"
ZIP_PARTES = ROOT + "processual/processos_eleitorais_partes_{ano}.zip"
ZIP_CAND = ROOT + "consulta_cand/consulta_cand_{ano}.zip"
MAX_ZIP = 75_000_000
# CSVs do TSE podem ultrapassar 130 MB. Leitura em fluxo, teto de 600 MB.
MAX_CSV = 600_000_000
PER_PROFILE = 25

def normal(value):
    return " ".join("".join(c for c in unicodedata.normalize("NFKD", str(value or ""))
                   if not unicodedata.combining(c)).upper().split())

def key(text):
    return re.sub(r"[^A-Z0-9]", "", normal(text))

def get(row, *options):
    for k in options:
        if row.get(k):
            return str(row[k]).strip()
    return ""

def clean_number(value):
    return re.sub(r"[^0-9]", "", str(value or ""))

def download(url):
    req = urllib.request.Request(url,headers={"User-Agent":"RUÍDO fiscalizacao civica; github.com/leomoreiraa/ruido"})
    with urllib.request.urlopen(req,timeout=65) as response:
        if not response.geturl().startswith(ROOT):
            raise ValueError("Redirecionamento para fora do TSE")
        data = response.read(MAX_ZIP+1)
        if len(data)>MAX_ZIP:
            raise ValueError("Arquivo excedeu limite de segurança")
        return data

def iterate_zip(payload, required):
    with zipfile.ZipFile(io.BytesIO(payload)) as archive:
        for member in archive.infolist():
            if not member.filename.lower().endswith(".csv") or member.is_dir():
                continue
            if member.file_size > MAX_CSV:
                raise ValueError("CSV excessivamente grande")
            with archive.open(member) as reader:
                first=reader.readline().decode("latin-1").strip()
                sep=";" if first.count(";")>=first.count(",") else ","
                cols={key(c) for c in next(csv.reader([first], delimiter=sep))}
                if not any(required_name in cols for required_name in required):
                    continue
                # Streaming: cabeçalho já consumido pela checagem das colunas.
                from itertools import chain
                lines=io.TextIOWrapper(reader,encoding="latin-1",errors="replace",newline="")
                for raw in csv.DictReader(chain([first+"\n"],lines),delimiter=sep):
                    yield {key(k):v for k,v in raw.items() if k is not None}

def main():
    if not DB.exists():
        raise RuntimeError("Banco oficial não foi restaurado")
    db=sqlite3.connect(str(DB))
    db.row_factory=sqlite3.Row
    persons=[dict(x) for x in db.execute("SELECT id,nome,nomeCivil,uf,casa FROM Parlamentar")]
    if len(persons)<150:
        raise RuntimeError("Snapshot parlamentar incompleto")
    person_by_id={p["id"]:p for p in persons}
    previous=json.loads(OUTPUT.read_text()) if OUTPUT.exists() else {"version":1,"dados":{}}
    data=previous.get("dados",{})
    now=datetime.now(timezone.utc).isoformat()
    accepted={}
    report={}
    # Arquivo de PARTES pode oferecer SQ_CANDIDATO ou não; sem SQ
    # o nome isolado não constitui prova suficiente de identidade.
    for year in YEARS:
        try:
            candidates=defaultdict(set)
            for p in persons:
                full=normal(p["nomeCivil"] or p["nome"])
                office="SENADOR" if p["casa"]=="SENADO" else "DEPUTADO FEDERAL"
                candidates[(normal(p["uf"]),office,full)].add(p["id"])
            candidate_codes=defaultdict(set)
            cand_raw=download(ZIP_CAND.format(ano=year))
            for row in iterate_zip(cand_raw,{"SQCANDIDATO"}):
                seq=get(row,"SQCANDIDATO")
                name=normal(get(row,"NMCANDIDATO"))
                uf=normal(get(row,"SGUF"))
                office=normal(get(row,"DSCARGO"))
                match=candidates.get((uf,office,name),set())
                if len(match)==1 and seq.isdigit():
                    candidate_codes[(uf,seq)].update(match)
            ids={k:next(iter(v)) for k,v in candidate_codes.items() if len(v)==1}
            parts_raw=download(ZIP_PARTES.format(ano=year))
            seen=set()
            count=0
            columns_reported=set()
            for row in iterate_zip(parts_raw,{"NRPROCESSO","NUMEROPROCESSO"}):
                if not columns_reported:
                    columns_reported=set(row.keys())
                seq=get(row,"SQCANDIDATO")
                uf=normal(get(row,"SGUF","SGUFTRIBUNAL","UF"))
                proc=clean_number(get(row,"NRPROCESSO","NUMEROPROCESSO","NRPROCESSOJUDICIAL"))
                role=get(row,"DSPOLO","TPPARTE","DSTIPOPARTE","DSQUALIFICACAO")
                name=normal(get(row,"NMPARTE","NOMEPARTE","NMCANDIDATO"))
                if not (seq and uf and proc and role and name and
                        re.fullmatch(r"\d{12,25}",proc) and (uf,seq) in ids):
                    continue
                pid=ids[(uf,seq)]
                profile=person_by_id.get(pid)
                if not profile or name!=normal(profile["nomeCivil"] or profile["nome"]):
                    continue
                identifying=(pid,proc,year)
                if identifying in seen: continue
                seen.add(identifying)
                # Registra mera qualidade de parte; não inferir ilícito.
                accepted.setdefault(pid,[]).append({
                    "numeroProcesso": proc,
                    "anoEleicao": year,
                    "papel": role[:75],
                    "situacao": "PARTE_PROCESSUAL_ELEITORAL",
                    "fonte": ZIP_PARTES.format(ano=year),
                    "conferidoEm": now,
                    "aviso": "Constar como parte não significa ser acusado de crime, investigado ou condenado."
                })
                count+=1
            report[str(year)]={"registrosVinculados":count,
                "colunasDisponiveis":sorted(columns_reported)[:40]}
        except Exception as exc:
            report[str(year)]={"erro":str(exc)[:190],"registrosVinculados":0}
    for pid,items in accepted.items():
        by_key={(x["numeroProcesso"],x["anoEleicao"]):x for x in data.get(pid,[])}
        for item in items:
            by_key[(item["numeroProcesso"],item["anoEleicao"])]=item
        data[pid]=sorted(by_key.values(),key=lambda x:x["conferidoEm"],reverse=True)[:PER_PROFILE]
    OUTPUT.parent.mkdir(parents=True,exist_ok=True)
    OUTPUT.write_text(json.dumps({
        "version":1,"atualizadoEm":now,"dados":data,"cobertura":report,
        "criterio":"Exige SQ_CANDIDATO, cargo, UF e nome civil da candidatura, todos compatíveis. Sem esses campos não publica.",
        "limitacoes":"Apenas processos eleitorais abertos do TSE; inclusão como parte não é acusação ou condenação."
    },ensure_ascii=False,sort_keys=True,separators=(",",":"))+"\n")
    print(json.dumps({"processos_eleitorais":{y:v.get("registrosVinculados",0) for y,v in report.items()},
                      "falhas":{y:v.get("erro") for y,v in report.items() if "erro" in v},
                      "colunasProcessuais":{y:v.get("colunasDisponiveis",[]) for y,v in report.items()}},
                     ensure_ascii=False))
if __name__=="__main__": main()
