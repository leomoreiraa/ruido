#!/usr/bin/env python3
"""Declarações de bens TSE: vínculo com parlamentar APENAS por nome único,
UF e cargo na eleição. Jamais exportar CPF, endereço ou descrição de bens.
Não inferir enriquecimento ilícito a partir de patrimônio autodeclarado.
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
from decimal import Decimal, InvalidOperation
from pathlib import Path

DB = Path(os.environ.get("DOSSIER_DB", "prisma/dev.db"))
OUT = Path("public/data/dossies/patrimonio.json")
ANOS = [2018, 2022, 2026]
URLS = {
    "candidatos": "https://cdn.tse.jus.br/estatistica/sead/odsele/consulta_cand/consulta_cand_{ano}.zip",
    "bens": "https://cdn.tse.jus.br/estatistica/sead/odsele/bem_candidato/bem_candidato_{ano}.zip",
}

def normalizar(v):
    return " ".join("".join(ch for ch in unicodedata.normalize("NFKD", str(v or "")) if not unicodedata.combining(ch)).upper().split())

def fetch(url):
    req = urllib.request.Request(url, headers={"User-Agent": "RUÍDO observatório cívico; GitHub leomoreiraa/ruido"})
    with urllib.request.urlopen(req, timeout=70) as r:
        if not r.geturl().startswith("https://cdn.tse.jus.br/"):
            raise ValueError("Redirecionamento fora do portal oficial TSE")
        raw = r.read(50_000_001)
        if len(raw) > 50_000_000:
            raise ValueError("ZIP muito grande para coleta segura")
        return raw

def tabelas_zip(raw, colunas):
    with zipfile.ZipFile(io.BytesIO(raw)) as archive:
        for info in archive.infolist():
            if info.filename.lower().endswith(".csv") and not info.is_dir():
                if info.file_size > 55_000_000:
                    raise ValueError("CSV muito grande")
                data = archive.read(info.filename)
                texto = None
                for enc in ["utf-8-sig", "latin-1"]:
                    try:
                        texto = data.decode(enc)
                        break
                    except UnicodeDecodeError:
                        continue
                if texto is None:
                    continue
                reader = csv.DictReader(io.StringIO(texto), delimiter=";", quotechar='"')
                if not colunas.issubset(set(reader.fieldnames or [])):
                    continue
                yield from reader

def centavos(s):
    valor = str(s or "").strip().replace(".", "").replace(",", ".")
    if not re.fullmatch(r"-?\d+(?:\.\d{1,2})?", valor):
        raise ValueError("valor inválido")
    try:
        return int(Decimal(valor) * 100)
    except InvalidOperation as ex:
        raise ValueError("valor inválido") from ex

def executar():
    if not DB.exists():
        raise RuntimeError("SQLite parlamentar indisponível")
    db = sqlite3.connect(str(DB))
    db.row_factory = sqlite3.Row
    politicos = [dict(row) for row in db.execute('SELECT id, nome, nomeCivil, uf, casa FROM Parlamentar')]
    if len(politicos) < 150:
        raise RuntimeError("Lista parlamentar suspeita")
    OLD = json.loads(OUT.read_text()) if OUT.exists() else {"version":1,"dados":{}}
    dados = OLD.get("dados", {})
    now = datetime.now(timezone.utc).isoformat()
    resultados = {}
    erros = []

    for ano in ANOS:
        try:
            candidatos_raw = fetch(URLS["candidatos"].format(ano=ano))
            bens_raw = fetch(URLS["bens"].format(ano=ano))
            candidatos = defaultdict(list)
            for row in tabelas_zip(candidatos_raw, {"SQ_CANDIDATO","SG_UF","DS_CARGO","NM_CANDIDATO"}):
                cargo = normalizar(row["DS_CARGO"])
                if cargo not in ("DEPUTADO FEDERAL", "SENADOR"):
                    continue
                nome = normalizar(row["NM_CANDIDATO"])
                if not nome or not row["SQ_CANDIDATO"].isdigit():
                    continue
                candidatos[(normalizar(row["SG_UF"]), cargo, nome)].append(row["SQ_CANDIDATO"])
            totais = defaultdict(lambda: [0, 0])
            for row in tabelas_zip(bens_raw, {"SQ_CANDIDATO","SG_UF","VR_BEM_CANDIDATO"}):
                identificador = (normalizar(row["SG_UF"]), row["SQ_CANDIDATO"].strip())
                try:
                    valor = centavos(row["VR_BEM_CANDIDATO"])
                except ValueError:
                    continue
                if valor < 0:
                    continue
                totais[identificador][0] += valor
                totais[identificador][1] += 1
            fonte = URLS["bens"].format(ano=ano)
            encontrados = 0
            for p in politicos:
                cargo = "DEPUTADO FEDERAL" if p["casa"] == "CAMARA" else "SENADOR"
                nome = normalizar(p["nomeCivil"] or p["nome"])
                ids = set(candidatos.get((p["uf"], cargo, nome), []))
                if len(ids) != 1:
                    continue
                val = totais.get((p["uf"], next(iter(ids))))
                if not val or val[1] == 0:
                    continue 
                dados.setdefault(p["id"], {})[str(ano)] = {
                    "totalDeclarado": round(val[0] / 100, 2),
                    "quantidadeBens": val[1],
                    "tipo": "DECLARACAO_ELEITORAL",
                    "fonte": fonte,
                    "coletadoEm": now,
                    "carater": "Autodeclarado, sujeito a retificações; não é avaliação de mercado",
                }
                encontrados += 1
            resultados[ano] = encontrados
        except Exception as error:
            erros.append(f"{ano}: {str(error)[:130]}")
    OUT.parent.mkdir(parents=True, exist_ok=True)
    if not resultados and not dados:
        print("⚠️ Patrimônio não obtido: " + str(erros))
        return
    OUT.write_text(json.dumps({
        "version":1,"atualizadoEm":now,"dados":dados,
        "anos":ANOS,"cobertura":{"perfísNaBase":len(politicos),"atualizadosPorAno":resultados},
        "limites":"Patrimônio autodeclarado na eleição. Sem CPF, sem endereço, sem inferência de irregularidade.",
    },ensure_ascii=False,separators=(",",":"),sort_keys=True)+"\n")
    print(json.dumps({"tse":resultados,"erros":erros},ensure_ascii=False))

if __name__ == "__main__":
    executar()
