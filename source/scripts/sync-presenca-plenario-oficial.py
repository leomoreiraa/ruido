#!/usr/bin/env python3
import argparse
import json
import re
import sqlite3
import time
import unicodedata
import xml.etree.ElementTree as ET
from collections import defaultdict
from datetime import date, datetime, timedelta, timezone
from io import StringIO
from pathlib import Path
from urllib.parse import urlencode
from urllib.request import Request, urlopen
import csv

BASE = "https://www.camara.leg.br/SitCamaraWS"
EVENTOS = "https://dadosabertos.camara.leg.br/arquivos/eventos/csv/eventos-{}.csv"
SERVICO = BASE + "/sessoesreunioes.asmx/ListarPresencasDia"
DEPUTADOS = BASE + "/Deputados.asmx/ObterDeputados"
FONTE = "https://www2.camara.leg.br/transparencia/dados-abertos/dados-abertos-legislativo/webservices/sessoesreunioes-2/listarpresencasdia"

def obter(url, timeout=50):
    req = Request(url, headers={"User-Agent": "RUIDO/1.0 (transparencia legislativa)", "Accept": "text/xml,text/csv,*/*"})
    for tentativa in range(3):
        try:
            with urlopen(req, timeout=timeout) as response:
                if response.status != 200:
                    raise ValueError("HTTP inesperado")
                data = response.read(55_000_000)
                if not data:
                    raise ValueError("Resposta vazia")
                return data
        except Exception:
            if tentativa == 2:
                raise
            time.sleep((tentativa + 1) * 1.5)

def local(tag):
    return str(tag).rsplit("}", 1)[-1].lower()

def filhos(no, nome):
    return [item for item in no.iter() if local(item.tag) == nome.lower()]

def campo(no, nome):
    for item in no.iter():
        if local(item.tag) == nome.lower():
            return (item.text or "").strip()
    return ""

def nome_chave(value):
    text = unicodedata.normalize("NFKD", value or "")
    return re.sub(r"[^a-z0-9]+", " ", "".join(c for c in text if not unicodedata.combining(c)).lower()).strip()

def datas_sessoes(inicio, fim):
    datas = set()
    for ano in range(inicio.year, fim.year + 1):
        raw = obter(EVENTOS.format(ano), timeout=90).decode("utf-8-sig")
        leitor = csv.DictReader(StringIO(raw), delimiter=";")
        necessarios = {"descricaoTipo", "localCamara.nome", "situacao", "dataHoraInicio"}
        if not necessarios.issubset(leitor.fieldnames or []):
            raise ValueError("CSV oficial de eventos sem colunas obrigatorias: " + str(ano))
        for linha in leitor:
            tipo = (linha.get("descricaoTipo") or "").strip()
            localizacao = (linha.get("localCamara.nome") or "").strip()
            situacao = (linha.get("situacao") or "").strip()
            dt = (linha.get("dataHoraInicio") or "")[:10]
            if (tipo == "Sessão Deliberativa" or tipo.startswith("Sessão Preparatória")) and localizacao == "Plenário da Câmara dos Deputados" and situacao.startswith("Encerrada"):
                try:
                    d = date.fromisoformat(dt)
                except ValueError:
                    continue
                if inicio <= d <= fim:
                    datas.add(d)
    return sorted(datas, reverse=True)

def registros_dia(dia):
    url = SERVICO + "?" + urlencode({"data": dia.strftime("%d/%m/%Y"),
        "numMatriculaParlamentar": "", "siglaPartido": "", "siglaUF": ""})
    raiz = ET.fromstring(obter(url))
    qtd_raw = campo(raiz, "qtdeSessoesDia")
    try:
        qtd = int(qtd_raw)
    except (TypeError, ValueError):
        raise ValueError("Quantidade oficial de sessoes ausente")
    if qtd < 1:
        return []
    registros = []
    for p in filhos(raiz, "parlamentar"):
        matricula = campo(p, "carteiraParlamentar")
        nome = campo(p, "nomeParlamentar")
        uf = campo(p, "siglaUF")
        status = re.sub(r"\s*\(~\)$", "", campo(p, "descricaoFrequenciaDia")).strip()
        classe = {"Presença": "P", "Ausência": "A", "Ausência justificada": "J"}.get(status)
        if matricula.isdecimal() and classe:
            registros.append((matricula, nome.rsplit("-", 1)[0].strip(), uf, classe))
    if len(registros) < 250:
        raise ValueError("Lista de presenca incompleta (" + str(len(registros)) + " registros)")
    if len(set(r[0] for r in registros)) != len(registros):
        raise ValueError("Matriculas duplicadas na resposta oficial")
    return registros

def matriculas_atual():
    raiz = ET.fromstring(obter(DEPUTADOS))
    resultado = {}
    for dep in filhos(raiz, "deputado"):
        matricula = campo(dep, "matricula")
        external_id = campo(dep, "ideCadastro")
        if matricula.isdecimal() and external_id.isdecimal():
            resultado[matricula] = external_id
    if len(resultado) < 400:
        raise ValueError("Cadastro de matriculas da Camara incompleto")
    return resultado

def preparar_mapeamento(db):
    rows = db.execute('SELECT id, externalId, nome, uf FROM Parlamentar WHERE casa = "CAMARA"').fetchall()
    por_id = {str(r["externalId"]): r["id"] for r in rows}
    por_nome = defaultdict(set)
    for r in rows:
        por_nome[(nome_chave(r["nome"]), (r["uf"] or "").upper())].add(r["id"])
    return por_id, por_nome

def exportar(db, output):
    rows = db.execute('''SELECT parlamentarId,dia,presentes,ausentes,justificadas,sessoesAuditadas
        FROM FrequenciaPlenario WHERE casa = 'CAMARA' AND fonteUrl LIKE ?
        AND sessoesAuditadas = 1 AND presentes + ausentes + justificadas = 1''',
        ("%/ListarPresencasDia?%",)).fetchall()
    resultado = defaultdict(lambda: {"sessoes": 0, "presentes": 0, "ausentes": 0, "justificadas": 0, "inicio": "", "fim": ""})
    for r in rows:
        item = resultado[r["parlamentarId"]]
        item["sessoes"] += 1
        item["presentes"] += r["presentes"]
        item["ausentes"] += r["ausentes"]
        item["justificadas"] += r["justificadas"]
        if not item["inicio"] or r["dia"] < item["inicio"]:
            item["inicio"] = r["dia"]
        if r["dia"] > item["fim"]:
            item["fim"] = r["dia"]
    dados = {id_: info for id_, info in resultado.items() if info["sessoes"] >= 3}
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps({"version": 1, "atualizadoEm": datetime.now(timezone.utc).isoformat(),
        "metodo": "DIAS_SESSAO_PLENARIO_CAMARA", "fonte": FONTE, "dados": dados},
        ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
    return len(dados)

def executar(db, inicio, fim, max_dias, output):
    db.row_factory = sqlite3.Row
    dias = datas_sessoes(inicio, fim)
    matriculas = matriculas_atual()
    por_id, por_nome = preparar_mapeamento(db)
    anteriores = set(row["dia"] for row in db.execute('''SELECT DISTINCT dia FROM FrequenciaPlenario
        WHERE casa = 'CAMARA' AND fonteUrl LIKE ? AND sessoesAuditadas = 1''',
        ("%/ListarPresencasDia?%",)))
    hoje = date.today()
    recentes = hoje - timedelta(days=30)
    pendentes = [d for d in dias if d.isoformat() not in anteriores or d >= recentes][:max_dias]
    gravados = 0
    falhas = []
    nao_relacionados = 0
    for dia in pendentes:
        try:
            registros = registros_dia(dia)
            itens = []
            for matricula, nome, uf, status in registros:
                parlamentar_id = por_id.get(matriculas.get(matricula, ""))
                if not parlamentar_id:
                    encontrados = por_nome.get((nome_chave(nome), uf.upper()), set())
                    if len(encontrados) == 1:
                        parlamentar_id = next(iter(encontrados))
                if not parlamentar_id:
                    nao_relacionados += 1
                    continue
                itens.append((f"camara-dia-{parlamentar_id}-{dia.isoformat()}", parlamentar_id,
                    dia.isoformat(), "CAMARA", 1, int(status == "P"), int(status == "A"),
                    int(status == "J"), SERVICO + "?" + urlencode({"data": dia.strftime("%d/%m/%Y")})))
            if len(itens) < 200:
                raise ValueError("Numero insuficiente de deputados associados ao cadastro local")
            with db:
                db.executemany('''INSERT INTO FrequenciaPlenario
                    (id, parlamentarId, dia, casa, sessoesAuditadas, presentes, ausentes, justificadas, fonteUrl)
                    VALUES (?,?,?,?,?,?,?,?,?)
                    ON CONFLICT(parlamentarId, dia) DO UPDATE SET
                    sessoesAuditadas=excluded.sessoesAuditadas,
                    presentes=excluded.presentes, ausentes=excluded.ausentes,
                    justificadas=excluded.justificadas, fonteUrl=excluded.fonteUrl''', itens)
            gravados += 1
            time.sleep(0.15)
        except Exception as error:
            falhas.append(f"{dia.isoformat()}: {type(error).__name__}: {error}")
    perfis = exportar(db, output)
    print(json.dumps({"dias_oficiais_no_periodo": len(dias), "dias_consultados": len(pendentes),
        "dias_gravados": gravados, "perfis_exportados": perfis,
        "registros_sem_vinculo": nao_relacionados, "falhas": falhas[:12]}, ensure_ascii=False))
    if falhas and gravados == 0 and perfis == 0:
        raise RuntimeError("Nenhum dado verificavel de presenca; servico oficial indisponivel")

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--database", default="prisma/dev.db")
    parser.add_argument("--output", default="public/data/dossies/frequencia-plenario-oficial.json")
    parser.add_argument("--since", default="2026-01-01")
    parser.add_argument("--max-days", type=int, default=90)
    args = parser.parse_args()
    inicio = date.fromisoformat(args.since)
    fim = date.today() - timedelta(days=1)
    if inicio > fim or not 1 <= args.max_days <= 400:
        raise ValueError("Intervalo ou limite invalido")
    dbpath = Path(args.database)
    if not dbpath.is_file():
        raise FileNotFoundError(dbpath)
    db = sqlite3.connect(dbpath)
    try:
        executar(db, inicio, fim, args.max_days, Path(args.output))
    finally:
        db.close()

if __name__ == "__main__":
    main()
