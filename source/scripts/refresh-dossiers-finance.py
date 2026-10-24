#!/usr/bin/env python3
"""Cotas CEAP (Câmara) e CEAPS (Senado), exclusivamente fontes oficiais.
Executar somente no GitHub Actions, depois de restaurar o SQLite validado.
Uma fonte indisponível NÃO vira R$ 0 e não apaga a última coleta válida.
"""
import csv
import io
import json
import os
import re
import sqlite3
import sys
import time
import urllib.request
import zipfile
from datetime import datetime, timezone
from html import unescape
from html.parser import HTMLParser
from pathlib import Path

DB = os.environ.get("DOSSIER_DB", "prisma/dev.db")
DEST = Path("public/data/dossies/financeiro.json")
YEARS = sorted({datetime.now(timezone.utc).year, datetime.now(timezone.utc).year - 1})
SIZE_LIMIT = 45_000_000
CAMARA = "https://www.camara.leg.br/cotas/Ano-{ano}.csv.zip"
SENADO = "https://www6g.senado.gov.br/transparencia/sen/{id}/?ano={ano}"

def download(url, maximum=SIZE_LIMIT):
    req = urllib.request.Request(url, headers={
        "User-Agent": "RUÍDO observatório cívico; contato via GitHub leomoreiraa/ruido",
        "Accept": "text/html,text/csv,application/zip,application/octet-stream,*/*",
    })
    with urllib.request.urlopen(req, timeout=35) as response:
        final = response.geturl()
        if not final.startswith("https://"):
            raise ValueError("Redirecionamento inseguro")
        data = response.read(maximum + 1)
        if len(data) > maximum:
            raise ValueError("Resposta excede limite")
        return data

def inteiro_decimal(value):
    """Converte número monetário em centavos; nunca estimar valor ausente."""
    if value is None or not str(value).strip():
        raise ValueError("Valor não publicado")
    s = str(value).replace("R$", "").replace("\u00a0", "").replace(" ", "").strip()
    if "," in s:
        s = s.replace(".", "").replace(",", ".")
    if not re.fullmatch(r"-?\d+(\.\d{1,2})?", s):
        raise ValueError("Valor ilegível: " + s[:20])
    from decimal import Decimal
    return int(Decimal(s) * 100)

def abrir_csv_zip(dados):
    with zipfile.ZipFile(io.BytesIO(dados)) as pacote:
        nomes = [x for x in pacote.namelist() if x.lower().endswith(".csv") and ".." not in x]
        if len(nomes) != 1:
            raise ValueError("Arquivo oficial sem CSV único")
        bruto = pacote.read(nomes[0])
        texto = None
        for cod in ("utf-8-sig", "iso-8859-1"):
            try:
                texto = bruto.decode(cod)
                break
            except UnicodeDecodeError:
                continue
        if texto is None:
            raise ValueError("Codificação de CSV inválida")
        return csv.DictReader(io.StringIO(texto), delimiter=";")

class Textos(HTMLParser):
    def __init__(self):
        super().__init__()
        self.partes = []
        self.esconder = 0
    def handle_starttag(self, tag, attrs):
        if tag in ("script", "style", "svg"):
            self.esconder += 1
        elif not self.esconder and tag in ("td", "th", "tr", "div", "p", "h1", "h2"):
            self.partes.append("\n")
    def handle_endtag(self, tag):
        if tag in ("script", "style", "svg") and self.esconder:
            self.esconder -= 1
        elif not self.esconder and tag in ("td", "tr", "p", "div"):
            self.partes.append("\n")
    def handle_data(self, data):
        if not self.esconder:
            self.partes.append(data)
    def content(self):
        return re.sub(r"[ \t]+", " ", unescape("".join(self.partes)))

def total_senado(html):
    parser = Textos()
    parser.feed(html.decode("utf-8", errors="replace"))
    texto = parser.content()
    inicio = re.search(r"Cotas para Exercício da Atividade Parlamentar", texto, flags=re.I)
    fim = re.search(r"Gastos não inclusos nas Cotas", texto, flags=re.I)
    if not inicio or not fim or fim.start() <= inicio.end():
        raise ValueError("Bloco CEAPS não encontrado; não publicar número")
    trecho = texto[inicio.end():fim.start()]
    valores = re.findall(r"\bTotal\b\s*\n?\s*(?:R\$\s*)?([\d.]+,\d{2})\b", trecho, re.I)
    if len(valores) != 1:
        raise ValueError("Total CEAPS ambíguo")
    return inteiro_decimal(valores[0])


def nome_chave(nome):
    import unicodedata
    return " ".join("".join(ch for ch in unicodedata.normalize("NFKD", str(nome or ""))
                    if not unicodedata.combining(ch)).upper().split())

def senador_csv_ano(dados_csv, ano, senators):
    """Usa endpoint /despesas_ceaps/{ano}/csv, documentado no Swagger oficial.
    Só agrega quando NOME COMPLETO vincula unicamente ao cadastro do Senado.
    Retorna tuplas (id, centavos), sem estimar montantes ausentes."""
    bruto = None
    for encoding in ("utf-8-sig", "iso-8859-1"):
        try:
            bruto = dados_csv.decode(encoding)
            break
        except UnicodeDecodeError:
            continue
    if bruto is None:
        raise ValueError("CSV CEAPS sem codificação legível")
    linha_cabecalho = bruto.splitlines()[0] if bruto.splitlines() else ""
    delim = ";" if linha_cabecalho.count(";") >= linha_cabecalho.count(",") else ","
    leitor = csv.DictReader(io.StringIO(bruto), delimiter=delim)
    def cols(row):
        return {re.sub(r"[^A-Z0-9]", "", nome_chave(k)): v for k, v in row.items() if k is not None}
    nomes = {}
    for sen in senators:
        nomes.setdefault(nome_chave(sen["nome"]), []).append(sen["id"])
    totais = {}
    linhas_validas = 0
    for raw in leitor:
        row = cols(raw)
        name = next((row.get(k) for k in
            ("SENADOR", "NOMESENADOR", "NOMEPARLAMENTAR", "PARLAMENTAR")
            if row.get(k)), None)
        amount = next((row.get(k) for k in
            ("VALORREEMBOLSADO", "VALORRESSARCIDO", "VALORLIQUIDO", "VALORPAGO")
            if row.get(k)), None)
        if not name or amount is None:
            continue
        match = nomes.get(nome_chave(name), [])
        if len(match) != 1:
            continue
        try:
            cents = inteiro_decimal(amount)
        except ValueError:
            continue
        if cents < 0:
            continue
        chave = match[0]
        totais[chave] = totais.get(chave, 0) + cents
        linhas_validas += 1
    if linhas_validas < 100 or len(totais) < 20:
        raise ValueError("Cobertura CSV CEAPS baixa ou colunas desconhecidas; não publicar")
    return totais

def main():
    if not Path(DB).is_file():
        raise RuntimeError("SQLite não restaurado; abortar")
    db = sqlite3.connect(DB)
    db.row_factory = sqlite3.Row
    parlamentares = [dict(r) for r in db.execute(
        'SELECT id, externalId, casa, nome, ativo FROM Parlamentar'
    )]
    if len(parlamentares) < 150:
        raise RuntimeError("Snapshot suspeito: lista de parlamentares pequena")
    DEST.parent.mkdir(parents=True, exist_ok=True)
    antigo = json.loads(DEST.read_text()) if DEST.exists() else {"version": 1, "dados": {}}
    dados = antigo.get("dados", {})
    now = datetime.now(timezone.utc).isoformat()
    cadastros_camara = {p["externalId"]: p["id"] for p in parlamentares if p["casa"] == "CAMARA"}
    senadores = [p for p in parlamentares if p["casa"] == "SENADO" and p["ativo"]]
    erros = []
    atualizados = 0

    for ano in YEARS:
        url = CAMARA.format(ano=ano)
        try:
            agregado = {}
            linhas = abrir_csv_zip(download(url))
            columns = linhas.fieldnames or []
            if "ideCadastro" not in columns or "vlrLiquido" not in columns:
                raise ValueError("CSV da Câmara mudou de formato")
            for linha in linhas:
                cid = str(linha.get("ideCadastro") or "").strip()
                if cid not in cadastros_camara:
                    continue
                try:
                    centavos = inteiro_decimal(linha.get("vlrLiquido"))
                except ValueError:
                    continue
                agregado[cid] = agregado.get(cid, 0) + centavos
            if len(agregado) < 30:
                raise ValueError("CSV com cobertura inesperadamente baixa")
            for external_id, cents in agregado.items():
                pid = cadastros_camara[external_id]
                dados.setdefault(pid, {})[str(ano)] = {
                    "tipo": "CEAP", "valor": round(cents / 100, 2),
                    "fonte": url, "coletadoEm": now, "casa": "CAMARA",
                }
                atualizados += 1
            print("Câmara", ano, "deputados:", len(agregado))
        except Exception as exc:
            erros.append(f"CEAP {ano}: {str(exc)[:170]}")

    for ano in YEARS:
        fonte_senado = (
            f"https://adm.senado.gov.br/adm-dadosabertos/api/v1/"
            f"senadores/despesas_ceaps/{ano}/csv"
        )
        try:
            vals = senador_csv_ano(download(fonte_senado), ano,
                                 [p for p in parlamentares if p["casa"] == "SENADO"])
            for pid, cents in vals.items():
                dados.setdefault(pid, {})[str(ano)] = {
                    "tipo": "CEAPS", "valor": round(cents / 100, 2),
                    "fonte": fonte_senado, "coletadoEm": now, "casa": "SENADO",
                }
                atualizados += 1
            print("Senado CEAPS", ano, "senadores:", len(vals))
        except Exception as exc:
            erros.append(f"Senado CEAPS csv {ano}: {str(exc)[:170]}")
    if not atualizados and not antigo.get("dados"):
        raise RuntimeError("Nenhum valor oficial coletado; recusando gerar financeiro vazio.")
    saida = {"version": 1, "atualizadoEm": now, "anos": YEARS, "dados": dados,
             "cobertura": {"perfisNaBase": len(parlamentares), "valoresAtualizados": atualizados},
             "limites": "Apenas CEAP/CEAPS oficiais. Não é renda pessoal, patrimônio, nem prova de irregularidade."}
    DEST.write_text(json.dumps(saida, ensure_ascii=False, separators=(",", ":"), sort_keys=True) + "\n")
    print(json.dumps({"financeiro": len(dados), "atualizados": atualizados, "avisos": erros[:12]}, ensure_ascii=False))
if __name__ == "__main__":
    main()
