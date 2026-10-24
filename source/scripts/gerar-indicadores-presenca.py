#!/usr/bin/env python3
"""Percentual de REGISTROS no recorte: NÃO é taxa de assiduidade de mandato.

A base Presenca é evidência positiva parcial em eventos de Câmara e votos
do Senado. Não atribui AUSENTE a evento sem nome do parlamentar. A taxa
representa somente eventos documentados entre a primeira e última evidência
pessoal, e é apresentada com ressalva explícita e fonte. Um denominador
fechado de sessões oficiais é exigido para mostrar assiduidade real.
"""
import json
import sqlite3
import sys
from bisect import bisect_left, bisect_right
from collections import defaultdict
from datetime import datetime, timezone
import re
from pathlib import Path

def to_date(value):
    if isinstance(value, (int,float)) or (isinstance(value,str) and re.fullmatch(r"\d{11,17}",value)):
        seconds=float(value)/(1000 if float(value)>1e11 else 1)
        return datetime.fromtimestamp(seconds,timezone.utc).date().isoformat()
    return str(value or "")[:10]

def gerar(db):
    db.row_factory=sqlite3.Row
    records=db.execute("""SELECT parlamentarId,casa,sessaoExternalId,dataSessao,
        origem,cobertura,status,fonteUrl FROM Presenca
        WHERE sessaoExternalId IS NOT NULL AND dataSessao IS NOT NULL""").fetchall()
    population=defaultdict(dict)
    by_member=defaultdict(dict)
    for r in records:
        casa=r["casa"]
        source=r["origem"]
        coverage=r["cobertura"]
        if casa=="CAMARA" and (source!="EVENTO_CAMARA" or coverage!="CHAMADA_OFICIAL"):
            continue
        if casa=="SENADO" and source!="VOTO_SENADO":
            continue
        if r["status"]!="PRESENTE":
            continue
        key=str(r["sessaoExternalId"])
        day=to_date(r["dataSessao"])
        if not key or not day[:4].isdigit():
            continue
        population[casa][key]=day
        by_member[(casa,r["parlamentarId"])][key]=day
    out={}
    for (casa,pid),person in by_member.items():
        # Apenas intervalos com algum número significativo de registros.
        personal=sorted(set(person.values()))
        if not personal:
            continue
        begin,end=personal[0],personal[-1]
        universe=[key for key,day in population[casa].items() if begin<=day<=end]
        count=sum(1 for key in universe if key in person)
        if len(universe)<10 or count<3 or count>len(universe):
            continue
        out[pid]={
            "casa":casa,"eventosMonitorados":len(universe),"eventosComRegistro":count,
            "percentual":round(100*count/len(universe),1),
            "inicioRecorte":begin,"fimRecorte":end,
            "criterio":"EVENTOS_COLETADOS_NAO_ASSIDUIDADE",
            "fonte":"https://dadosabertos.camara.leg.br/api/v2/eventos"
              if casa=="CAMARA" else "https://www12.senado.leg.br/dados-abertos/legislativo/plenario",
        }
    return out

def main():
    dbfile=Path(sys.argv[1] if len(sys.argv)>1 else "prisma/dev.db")
    target=Path(sys.argv[2] if len(sys.argv)>2 else "public/data/dossies/presenca-cobertura.json")
    if not dbfile.exists():raise RuntimeError("Snapshot oficial não disponível")
    db=sqlite3.connect(str(dbfile))
    try:
        out=gerar(db)
    finally:
        db.close()
    target.parent.mkdir(parents=True,exist_ok=True)
    target.write_text(json.dumps({"version":1,"atualizadoEm":datetime.now(timezone.utc).isoformat(),
        "dados":out,"aviso":"Percentual de eventos com presença registrada na amostra do RUÍDO; não é taxa de assiduidade nem indicador de faltas."},
        ensure_ascii=False,separators=(",",":"))+"\n")
    print(f"Indicadores descritivos de registro: {len(out)} perfis; ausências não inferidas.")
if __name__=="__main__":main()
