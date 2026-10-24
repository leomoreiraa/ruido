#!/usr/bin/env python3
"""RUÍDO fase 1: vínculos financeiros documentados, coletados EXCLUSIVAMENTE de fontes oficiais.
TSE: receitas e despesas contratadas da candidatura com SQ+UF+cargo+nome civil único.
Câmara: fornecedores PJ da CEAP com ID oficial do deputado (não exportar CPF).
CGU: emendas individuais por autor via API autenticada; alternativa: SQLite verificado.
Uma coincidência de CNPJ NÃO indica irregularidade, vínculo pessoal nem favorecimento.
"""
import csv
import hashlib
import html
import io
import bisect
import json
import os
import re
import sqlite3
import tempfile
import time
import unicodedata
from html.parser import HTMLParser
import urllib.parse
import urllib.request
import urllib.error
import zipfile
from collections import defaultdict
from datetime import datetime, timezone
from decimal import Decimal, InvalidOperation
from pathlib import Path

DB=Path(os.getenv("DOSSIER_DB","prisma/dev.db"))
OUT=Path("public/data/dossies/redes-financeiras.json")
CAND_PATH=Path("public/data/dossies/candidaturas-presidenciais.json")
TSE_BASE="https://cdn.tse.jus.br/estatistica/sead/odsele/"
CAMARA="https://www.camara.leg.br/cotas/Ano-{ano}.csv.zip"
SENADO="https://adm.senado.gov.br/adm-dadosabertos/api/v1/senadores/{id}/recursos-utilizados"
CGU="https://api.portaldatransparencia.gov.br/api-de-dados/emendas"
ANOS_TSE=(2018,2022,2026)
ANOS_CEAP=(2025,2026)
LIMIT_BYTES=550_000_000

def norm(s):
    return " ".join("".join(c for c in unicodedata.normalize("NFKD",str(s or ""))
                    if not unicodedata.combining(c)).upper().split())

def identifier(value):
    return re.sub(r"\D","",str(value or ""))

def cnpj(value):
    digits=identifier(value)
    if len(digits)!=14 or len(set(digits))==1:
        return None
    # Dígitos verificadores da Receita; impede associações por números malformados.
    for length,weights in ((12,[5,4,3,2,9,8,7,6,5,4,3,2]),
                           (13,[6,5,4,3,2,9,8,7,6,5,4,3,2])):
        rem=sum(int(a)*b for a,b in zip(digits[:length],weights))%11
        check=0 if rem<2 else 11-rem
        if check!=int(digits[length]): return None
    return digits

def cents(v):
    if v is None: return None
    s=str(v).replace("R$","").replace("\u00a0","").replace(" ","").strip()
    if not s:return None
    if "," in s:s=s.replace(".","").replace(",",".")
    if not re.fullmatch(r"-?\d+(?:\.\d{1,2})?",s):return None
    try:return int(Decimal(s)*100)
    except InvalidOperation:return None

def reais(x):return round(x/100,2)

def official_download(url,maxsize=LIMIT_BYTES):
    host=urllib.parse.urlsplit(url).hostname
    if host not in ("cdn.tse.jus.br","www.camara.leg.br"):
        raise ValueError("Host oficial não reconhecido")
    req=urllib.request.Request(url,headers={"User-Agent":"RUÍDO-observatorio-publico/1.0","Accept":"application/zip,*/*"})
    temp=tempfile.TemporaryFile()
    size=0
    try:
        with urllib.request.urlopen(req,timeout=85) as r:
            final=urllib.parse.urlsplit(r.geturl())
            if final.scheme!="https" or final.hostname not in ("cdn.tse.jus.br","www.camara.leg.br"):
                raise ValueError("Redirect fora da fonte oficial")
            while True:
                chunk=r.read(1024*1024)
                if not chunk:break
                size+=len(chunk)
                if size>maxsize:raise ValueError("ZIP oficial excede limite de segurança")
                temp.write(chunk)
        temp.seek(0)
        return temp
    except Exception:
        temp.close()
        raise

def csv_in_zip(handle,filename_fragment,required):
    with zipfile.ZipFile(handle) as z:
        names=[x for x in z.namelist() if x.lower().endswith(".csv") and
               filename_fragment.lower() in Path(x).name.lower() and ".." not in Path(x).parts]
        if len(names)!=1:raise ValueError("Tabela CSV esperada ausente ou ambígua: "+filename_fragment)
        if z.getinfo(names[0]).file_size>1_500_000_000:raise ValueError("Arquivo CSV acima do permitido")
        with z.open(names[0]) as stream:
            # Conteúdo oficial TSE e CEAP é tipicamente ISO-8859-1.
            sample=stream.read(4096)
            stream2=io.TextIOWrapper(io.BufferedReader(_Prefix(sample,stream)),encoding="latin-1",newline="")
            try:
                head=sample.split(b"\n",1)[0].decode("latin-1")
                delimiter=";" if head.count(";")>=head.count(",") else ","
                reader=csv.DictReader(stream2,delimiter=delimiter)
                if not set(required).issubset(set(reader.fieldnames or [])):
                    raise ValueError("Esquema inesperado no CSV "+filename_fragment)
                for row in reader:yield row
            finally:stream2.detach()

class _Prefix(io.RawIOBase):
    def __init__(self,prefix,stream):self.prefix=io.BytesIO(prefix);self.stream=stream
    def readable(self):return True
    def readinto(self,b):
        first=self.prefix.read(len(b))
        if first:
            b[:len(first)]=first;return len(first)
        part=self.stream.read(len(b))
        b[:len(part)]=part
        return len(part)

def candidatos_verificados(rows,people):
    # Importante: identidade por nome CIVIL completo + UF + cargo, candidato único.
    by_name=defaultdict(set)
    by_ballot=defaultdict(set)
    official_civil={}
    for r in rows:
        name=norm(r.get("NM_CANDIDATO"))
        ballot=norm(r.get("NM_URNA_CANDIDATO"))
        uf=norm(r.get("SG_UF"))
        cargo=norm(r.get("DS_CARGO"))
        sq=identifier(r.get("SQ_CANDIDATO"))
        if name and uf and sq and cargo in ("DEPUTADO FEDERAL","SENADOR"):
            by_name[(uf,cargo,name)].add(sq)
            official_civil[(uf,cargo,sq)]=name
            if ballot:
                by_ballot[(uf,cargo,ballot)].add(sq)
    by_sq={}
    ambiguous=0
    for p in people:
        cargo="DEPUTADO FEDERAL" if p["casa"]=="CAMARA" else "SENADOR"
        names=by_name.get((norm(p["uf"]),cargo,norm(p["nomeCivil"] or p["nome"])),set())
        # A Câmara não disponibiliza nome civil para muitos perfis. Nesse caso,
        # aceita-se SOMENTE nome de urna igual ao nome oficial parlamentar,
        # mesma UF e mesmo cargo. Se duas candidaturas concorrem, recusar ambas.
        # Se o nome civil veio abreviado/divergente entre as duas bases,
        # permitir somente o nome de urna EXATO presente no cadastro do
        # parlamentar, UF e cargo coincidentes e SQ candidato único.
        # Um match civil válido nunca é substituído por outro SQ.
        if not names:
            ballot_name=norm(p["nome"])
            choices=by_ballot.get((norm(p["uf"]),cargo,ballot_name),set())
            if p["nomeCivil"]:
                # Nome civil do cadastro parlamentar pode estar abreviado.
                # Só aceitar a urna quando cada token do nome civil constar
                # também no nome civil completo do TSE (não aceitar divergências).
                tokens=norm(p["nomeCivil"]).split()
                if len(tokens)<2 or len(ballot_name.split())<2:
                    choices=set()
                else:
                    choices={sq for sq in choices if
                        set(tokens).issubset(set(official_civil.get((norm(p["uf"]),cargo,sq),"").split()))}
            names=choices
        elif not p["nomeCivil"]:
            names=names | by_ballot.get((norm(p["uf"]),cargo,norm(p["nome"])),set())
        if len(names)==1:
            sq=next(iter(names))
            key=(norm(p["uf"]),sq)
            if key in by_sq:
                ambiguous+=1;by_sq[key]=None
            else:by_sq[key]=p["id"]
    return {k:v for k,v in by_sq.items() if v},ambiguous

def presidenciais_parlamentares(rows, people):
    """Vincula apenas candidatura presidencial TSE com nome civil+urna exatos e únicos."""
    by_profile=defaultdict(list)
    for row in rows:
        if norm(row.get("DS_CARGO"))!="PRESIDENTE" or norm(row.get("SG_UF"))!="BR":
            continue
        civil=norm(row.get("NM_CANDIDATO"))
        urna=norm(row.get("NM_URNA_CANDIDATO"))
        party=norm(row.get("SG_PARTIDO"))
        number=identifier(row.get("NR_CANDIDATO"))
        sq=identifier(row.get("SQ_CANDIDATO"))
        if not civil or not urna or not party or not number or not sq:
            continue
        found=[p for p in people if
            (norm(p.get("nomeCivil"))==civil if p.get("nomeCivil")
             else norm(p["nome"])==urna)
            and norm(p["nome"])==urna
            and identifier(p["externalId"])]
        if len(found)!=1:continue
        key=found[0]["casa"]+":"+str(found[0]["externalId"])
        by_profile[key].append({
            "eleicao":2026,"cargo":"PRESIDENTE","candidato":civil,
            "nomeUrna":urna,"partido":party,"numero":number,
            "situacaoRegistro":norm(row.get("DS_SITUACAO_CANDIDATURA") or "NAO INFORMADO"),
            "fonteRegistro":"https://www.tse.jus.br/comunicacao/noticias/2026/Setembro/eleicoes-2026-tem-12-candidaturas-na-disputa-pela-presidencia-da-republica",
            "origem":"TSE_CSV_IDENTIDADE_UNICA","_sq":sq,
        })
    result={}
    for key,items in by_profile.items():
        if len(items)==1:
            item=dict(items[0]);item.pop("_sq")
            result[key]=item
    return result


def campaign_collect(year,people,presidenciais=None):
    cand_url=TSE_BASE+f"consulta_cand/consulta_cand_{year}.zip"
    account_url=TSE_BASE+f"prestacao_contas/prestacao_de_contas_eleitorais_candidatos_{year}.zip"
    handle=official_download(cand_url,140_000_000)
    try:
        matches,ambiguous=candidatos_verificados(csv_in_zip(
            handle,f"consulta_cand_{year}_BRASIL",["SQ_CANDIDATO","SG_UF","DS_CARGO","NM_CANDIDATO","NM_URNA_CANDIDATO"]),people)
        if year==2026 and presidenciais is not None:
            presidenciais.update(presidenciais_parlamentares(csv_in_zip(
                handle,f"consulta_cand_{year}_BRASIL",
                ["SQ_CANDIDATO","SG_UF","DS_CARGO","NM_CANDIDATO","NM_URNA_CANDIDATO",
                 "SG_PARTIDO","NR_CANDIDATO"]),people))
    finally:handle.close()
    if len(matches)<20:raise ValueError(f"Poucas candidaturas vinculadas inequivocamente em {year}: {len(matches)}")
    results=defaultdict(lambda:{"arrecadacaoCentavos":0,"origens":defaultdict(int),
        "fornecedores":defaultdict(int)})
    handle=official_download(account_url)
    try:
        for row in csv_in_zip(handle,f"receitas_candidatos_{year}_BRASIL",
                              ["SQ_CANDIDATO","SG_UF","VR_RECEITA","NM_DOADOR"]):
            pid=matches.get((norm(row.get("SG_UF")),identifier(row.get("SQ_CANDIDATO"))))
            if not pid:continue
            val=cents(row.get("VR_RECEITA"))
            if val is None or val<=0:continue
            name=" ".join(str(row.get("NM_DOADOR") or "").split())[:120]
            origin=norm(row.get("DS_ORIGEM_RECEITA"))[:85]
            if not name:continue
            results[pid]["arrecadacaoCentavos"]+=val
            # Não armazenar CPF; CNPJ só pode ser publicado para pessoa jurídica.
            company=cnpj(row.get("NR_CPF_CNPJ_DOADOR"))
            kind="PESSOA_JURIDICA_OU_PARTIDO" if company else "SEM_CNPJ_PUBLICADO"
            results[pid]["origens"][(name,origin,kind,company or "")]+=val
        for row in csv_in_zip(handle,f"despesas_contratadas_candidatos_{year}_BRASIL",
                              ["SQ_CANDIDATO","SG_UF","VR_DESPESA_CONTRATADA",
                               "NR_CPF_CNPJ_FORNECEDOR","NM_FORNECEDOR"]):
            pid=matches.get((norm(row.get("SG_UF")),identifier(row.get("SQ_CANDIDATO"))))
            if not pid:continue
            company=cnpj(row.get("NR_CPF_CNPJ_FORNECEDOR"))
            val=cents(row.get("VR_DESPESA_CONTRATADA"))
            if not company or val is None or val<=0:continue
            name=" ".join(str(row.get("NM_FORNECEDOR") or "").split())[:120]
            if name:results[pid]["fornecedores"][(company,name)]+=val
    finally:handle.close()
    output={}
    for pid,r in results.items():
        suppliers=sorted(r["fornecedores"].items(),key=lambda x:-x[1])[:12]
        origins=sorted(r["origens"].items(),key=lambda x:-x[1])[:12]
        output[pid]={
          "ano":year,"fonte":account_url,"arrecadacaoRegistrada":reais(r["arrecadacaoCentavos"]),
          "origens":[{"nome":k[0],"origem":k[1],"tipo":k[2],"cnpj":k[3] or None,
                      "valor":reais(v)} for k,v in origins],
          "fornecedores":[{"cnpj":k[0],"nome":k[1],"valor":reais(v)} for k,v in suppliers],
        }
    return output,{"candidaturasUnicas":len(matches),"ambiguidade":ambiguous,
                   "perfisComRegistros":len(output)}

def gabinete_collect(year,people):
    url=CAMARA.format(ano=year)
    deputy_by_id={str(p["externalId"]):p["id"] for p in people if p["casa"]=="CAMARA"}
    suppliers=defaultdict(lambda:defaultdict(int))
    handle=official_download(url,90_000_000)
    try:
        # CSV único distribuído pela Câmara; não confundir CPF com CNPJ.
        for row in csv_in_zip(handle,f"Ano-{year}",["ideCadastro","txtCNPJCPF","txtFornecedor","vlrLiquido"]):
            pid=deputy_by_id.get(str(row.get("ideCadastro") or "").strip())
            company=cnpj(row.get("txtCNPJCPF"))
            val=cents(row.get("vlrLiquido"))
            if not pid or not company or val is None or val<=0:continue
            name=" ".join(str(row.get("txtFornecedor") or "").split())[:120]
            if name:suppliers[pid][(company,name)]+=val
    finally:handle.close()
    return {pid:[{"ano":year,"cnpj":k[0],"nome":k[1],
                  "valor":reais(v),"fonte":url} for k,v in
                 sorted(items.items(),key=lambda x:-x[1])[:16]]
            for pid,items in suppliers.items()}


class _SenadoText(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.parts=[]
    def handle_data(self,part):
        self.parts.append(part)


def parse_senado_ceaps(page, senator, year):
    """Aceita apenas relatório com código solicitado e identificação explícita."""
    parser=_SenadoText()
    parser.feed(page)
    text=" ".join(" ".join(parser.parts).split())
    displayed=re.search(r"\bSenador:\s*(.*?)\s+Partido:\s*",text,re.I)
    uf=re.search(r"\bUF:\s*([A-Z]{2})\b",text,re.I)
    year_found=re.search(r"\bAno:\s*(20\d{2})\b",text,re.I)
    if (not displayed or norm(displayed.group(1)) not in
        {norm(senator["nome"]),norm(senator.get("nomeCivil"))} or
        not uf or norm(uf.group(1))!=norm(senator["uf"]) or
        not year_found or int(year_found.group(1))!=int(year)):
        raise ValueError("Identidade do senador, UF ou ano divergente no relatório oficial")
    total=re.search(r"\bTOTAL COTAS\s+R\$\s*([\d.,]+)",text,re.I)
    if not total:
        raise ValueError("TOTAL COTAS indisponível no relatório oficial do Senado")
    money=cents(total.group(1))
    if money is None or money<0:
        raise ValueError("Valor CEAPS inválido no relatório oficial")
    return reais(money)


def senado_ceaps(people, limit=18, cursor=0, priority_ids=()):
    """Consulta somente o código de senador do cadastro; nunca vincula por homônimo."""
    senators=sorted((p for p in people if p["casa"]=="SENADO" and p["ativo"] and
                     identifier(p["externalId"])),key=lambda p:int(identifier(p["externalId"])))
    if not senators:
        return {},{"estado":"SEM_SENADORES","consultas":0},cursor
    start=max(0,int(cursor))%len(senators)
    chosen=(senators[start:]+senators[:start])[:min(max(1,int(limit)),len(senators))]
    prioritized=[p for p in senators if identifier(p["externalId"]) in
                 {identifier(v) for v in priority_ids}]
    # Consultas pontuais pedidas pelo usuário não retiram senadores da fila regular.
    selected={p["id"]:p for p in prioritized+chosen}
    data=defaultdict(list)
    ok=0
    fail=0
    for p in selected.values():
        code=identifier(p["externalId"])
        for year in (2025,2026):
            url=SENADO.format(id=code)+"?"+urllib.parse.urlencode({"ano":year,"formato":"html"})
            request=urllib.request.Request(url,headers={
                "User-Agent":"RUIDO-observatorio-civico/1.0","Accept":"text/html"})
            try:
                with urllib.request.urlopen(request,timeout=17) as response:
                    dst=urllib.parse.urlsplit(response.geturl())
                    if dst.scheme!="https" or dst.hostname!="adm.senado.gov.br":
                        raise ValueError("Redirecionamento fora da fonte oficial do Senado")
                    raw=response.read(1_000_001)
                if len(raw)>1_000_000:
                    raise ValueError("Relatório Senado excedeu 1MB")
                htmlpage=raw.decode("utf-8","replace")
                amount=parse_senado_ceaps(htmlpage,p,year)
                data[p["id"]].append({
                    "ano":year,"valorCEAPS":amount,"fonte":url,
                    "origem":"SENADO_CODIGO_OFICIAL","coletadoEm":datetime.now(timezone.utc).isoformat(),
                })
                ok+=1
            except Exception as exc:
                fail+=1
                print("CEAPS Senado não validada: "+type(exc).__name__+
                      " (código "+code+", ano "+str(year)+")",flush=True)
    new_cursor=(start+len(chosen))%len(senators)
    return data,{"estado":"CONSULTADA" if ok else "INDISPONIVEL",
                 "consultas":ok+fail,"validas":ok,"falhas":fail,
                 "senadoresElegiveis":len(senators),"proximoCursor":new_cursor,
                 "criterio":"Código único oficial do Senado, nome e UF no relatório."},new_cursor



def extract_senado_ceaps(raw, people, year, source_url):
    """Só vincula despesa ao código oficial do Senado, CNPJ válido e valor explícito.

    JSON anual da API administrativa: array ou envelope data. CPF é recusado.
    Origem oficial é preservada em cada registro. Ausência de dados não é zero.
    """
    if isinstance(raw, dict):
        raw=raw.get("data")
    if not isinstance(raw, list) or len(raw)<50:
        raise ValueError("Tabela anual CEAPS vazia ou esquema divergente")
    senators={identifier(p["externalId"]):p["id"] for p in people if
              p["casa"]=="SENADO" and identifier(p["externalId"])}
    items=defaultdict(lambda:defaultdict(int))
    valid_schema=0
    for row in raw:
        if not isinstance(row,dict):
            continue
        code=identifier(row.get("codSenador"))
        raw_value=row.get("valorReembolsado")
        if code and raw_value is not None and "fornecedor" in row:
            valid_schema+=1
        pid=senators.get(code)
        if not pid:
            continue
        # Campo observado na API oficial e aliases antigos mantidos para compatibilidade.
        company=cnpj(row.get("cpfCnpj") or row.get("cnpjCpf") or row.get("cnpjCPF"))
        amount=cents(raw_value)
        name=" ".join(str(row.get("fornecedor") or "").split())[:120]
        if not company or amount is None or amount<=0 or not name:
            continue
        items[pid][(company,name)]+=amount
    if valid_schema<20:
        raise ValueError("CEAPS anual sem campos esperados: código, fornecedor, valor")
    return {pid:[{"ano":year,"cnpj":cn,"nome":name,"valor":reais(val),
                  "fonte":source_url,"origem":"SENADO_CEAPS_CODIGO_CNPJ"}
                 for (cn,name),val in sorted(suppliers.items(),key=lambda x:-x[1])[:16]]
            for pid,suppliers in items.items()}


def senado_fornecedores_collect(year, people):
    url=f"https://adm.senado.gov.br/adm-dadosabertos/api/v1/senadores/despesas_ceaps/{year}"
    request=urllib.request.Request(url,headers={
        "User-Agent":"RUIDO-observatorio-publico/1.0","Accept":"application/json"})
    with urllib.request.urlopen(request,timeout=85) as response:
        target=urllib.parse.urlsplit(response.geturl())
        if target.scheme!="https" or target.hostname!="adm.senado.gov.br":
            raise ValueError("Fonte CEAPS redirecionada para host não oficial")
        raw=response.read(20_000_001)
    if len(raw)>20_000_000:
        raise ValueError("CEAPS JSON acima de 20 MB")
    return extract_senado_ceaps(json.loads(raw),people,year,url)


def emendas_db(db,people):
    ids={p["id"] for p in people}
    out=defaultdict(list)
    for row in db.execute("""SELECT parlamentarId,codigoEmenda,numeroEmenda,ano,
      autorOriginal,tipo,valorEmpenhado,valorPago,localidadeOriginal,fonte
      FROM EmendaParlamentar WHERE parlamentarId IS NOT NULL AND codigoEmenda IS NOT NULL
      ORDER BY ano DESC,valorPago DESC"""):
        pid=row["parlamentarId"]
        if pid not in ids or len(out[pid])>=12:continue
        code=str(row["codigoEmenda"] or "").strip()
        if not re.fullmatch(r"[A-Za-z0-9-]{5,40}",code):continue
        empenho=row["valorEmpenhado"]
        pago=row["valorPago"]
        if empenho is None or pago is None or empenho<0 or pago<0:continue
        out[pid].append({"codigo":code,"numero":row["numeroEmenda"],"ano":row["ano"],
          "autor":row["autorOriginal"] or "Autor não discriminado",
          "tipo":row["tipo"],"valorEmpenhado":round(empenho,2),
          "valorPago":round(pago,2),"localidade":row["localidadeOriginal"],
          "fonte":"https://portaldatransparencia.gov.br/emendas",
          "origem":"BASE_LEGISLATIVA_VERIFICADA"})
    return out

def cgu_get_page(name, year, page, key, pace):
    """Consulta paginada com limitação de taxa, backoff e host HTTPS fixo.

    pace é compartilhado entre todas as consultas desta execução, não por autor.
    Nunca inclui a chave no log, no URL nem nos arquivos publicados.
    """
    interval = max(1.25, min(float(os.getenv("EMENDAS_INTERVAL_SECONDS", "1.5")), 10.0))
    query = urllib.parse.urlencode({"nomeAutor": name, "ano": year, "pagina": page})
    request = urllib.request.Request(CGU + "?" + query, headers={
        "chave-api-dados": key, "User-Agent": "RUIDO-observatorio-civico/1.0",
        "Accept": "application/json",
    })
    for attempt in range(3):
        since = time.monotonic() - pace["last"]
        if since < interval:
            time.sleep(interval - since)
        pace["last"] = time.monotonic()
        try:
            with urllib.request.urlopen(request, timeout=25) as response:
                target = urllib.parse.urlsplit(response.geturl())
                if target.scheme != "https" or target.hostname != "api.portaldatransparencia.gov.br":
                    raise ValueError("CGU redirecionou para origem inesperada")
                raw = response.read(2_000_001)
                if len(raw) > 2_000_000:
                    raise ValueError("Resposta CGU excedeu 2MB")
            items = json.loads(raw)
            if not isinstance(items, list) or any(not isinstance(x, dict) for x in items):
                raise ValueError("Esquema CGU inesperado")
            if items and not all("nomeAutor" in x and "codigoEmenda" in x for x in items):
                raise ValueError("Campos essenciais ausentes na resposta CGU")
            return items
        except urllib.error.HTTPError as exc:
            if exc.code not in (429, 500, 502, 503, 504) or attempt == 2:
                raise
            retry = exc.headers.get("Retry-After", "") if exc.headers else ""
            backoff = int(retry) if retry.isdigit() else 2 ** (attempt + 1)
            time.sleep(min(45, max(2, backoff)))
        except (TimeoutError, urllib.error.URLError):
            if attempt == 2:
                raise
            time.sleep(2 ** (attempt + 1))
    raise RuntimeError("CGU: tentativas encerradas")


def emendas_api(people, key, limit=48, cursor=0, checkpoint=None,
                max_queries=160, years=(2025, 2026), on_page=None):
    """Percorre autores/anos/páginas em ordem, sem pular consultas com erro.

    O ponto de retomada inclui autor, ano e próxima página. Uma página concluída
    avança; HTTP 429, erro ou limite de consultas preserva a posição pendente.
    """
    if not key:
        return {}, {"estado": "CREDENCIAL_NAO_CONFIGURADA", "consultas": 0}, checkpoint, cursor
    by_name = defaultdict(list)
    for p in people:
        if p["ativo"]:
            by_name[norm(p["nomeCivil"] or p["nome"])].append(p["id"])
    authors = sorted((name, ids[0]) for name, ids in by_name.items() if name and len(ids) == 1)
    if not authors:
        return {}, {"estado": "SEM_AUTORES_INEQUIVOCOS", "consultas": 0}, checkpoint, cursor
    names = [name for name, _ in authors]
    years = tuple(sorted(set(int(year) for year in years)))
    if not years or any(year < 2010 or year > datetime.now(timezone.utc).year for year in years):
        raise ValueError("Anos da CGU inválidos")
    limit = max(1, min(int(limit), len(authors), 160))
    max_queries = max(1, min(int(max_queries), 320))
    saved = checkpoint if isinstance(checkpoint, dict) else {}
    anchor = norm(saved.get("autor", ""))
    if anchor:
        start = bisect.bisect_left(names, anchor) % len(names)
    else:
        start = max(0, int(cursor)) % len(names)
    same_anchor = bool(anchor and names[start] == anchor)
    first_year = saved.get("ano") if same_anchor else None
    if first_year not in years:
        first_year = years[0]
    first_page = saved.get("pagina", 1) if same_anchor else 1
    if not isinstance(first_page, int) or not (1 <= first_page <= 10000):
        first_page = 1
    pace = {"last": 0.0}
    records = defaultdict(list)
    queries = 0
    completed = 0
    failed = 0
    rejected = 0
    status = "CONSULTADA"
    reason = None
    next_index = start
    next_point = {"autor": names[start], "ano": first_year, "pagina": first_page}
    if same_anchor and saved.get("ultimaAssinatura"):
        next_point["ultimaAssinatura"] = str(saved["ultimaAssinatura"])[:64]

    for offset in range(limit):
        index = (start + offset) % len(authors)
        name, pid = authors[index]
        begin_year = first_year if offset == 0 else years[0]
        for year in years[years.index(begin_year):]:
            page = first_page if offset == 0 and year == begin_year else 1
            signature_before = next_point.get("ultimaAssinatura") if (
                next_point.get("autor") == name and next_point.get("ano") == year
            ) else None
            while True:
                next_point = {"autor": name, "ano": year, "pagina": page}
                if signature_before:
                    next_point["ultimaAssinatura"] = signature_before
                if queries >= max_queries:
                    status, reason = "PARCIAL_LIMITE", "Orçamento de consultas alcançado"
                    break
                queries += 1
                try:
                    items = cgu_get_page(name, year, page, key, pace)
                except (ValueError, urllib.error.HTTPError, urllib.error.URLError,
                        TimeoutError, OSError) as exc:
                    failed += 1
                    status = "PAUSADA_FONTE"
                    reason = ("HTTP " + str(exc.code)) if isinstance(exc, urllib.error.HTTPError) else type(exc).__name__
                    print("CGU pausada sem avançar cursor: " + reason, flush=True)
                    break
                if not items:
                    signature_before = None
                    break
                signature = hashlib.sha256(json.dumps(items, sort_keys=True, ensure_ascii=True).encode("utf8")).hexdigest()
                if signature == signature_before:
                    status, reason = "PAUSADA_PAGINACAO", "API repetiu a página anterior"
                    print("CGU: paginação inconsistente; cursor mantido", flush=True)
                    break
                signature_before = signature
                for row in items:
                    if norm(row.get("nomeAutor")) != name or str(row.get("ano")) != str(year):
                        rejected += 1
                        continue
                    code = str(row.get("codigoEmenda") or "")
                    if not re.fullmatch(r"[A-Za-z0-9-]{5,40}", code):
                        rejected += 1
                        continue
                    val_emp = cents(row.get("valorEmpenhado"))
                    val_pago = cents(row.get("valorPago"))
                    if val_emp is None or val_pago is None or min(val_emp, val_pago) < 0:
                        rejected += 1
                        continue
                    records[pid].append({
                        "codigo": code, "numero": row.get("numeroEmenda"),
                        "ano": year, "autor": row["nomeAutor"],
                        "tipo": str(row.get("tipoEmenda") or "NÃO INFORMADO")[:100],
                        "valorEmpenhado": reais(val_emp), "valorPago": reais(val_pago),
                        "localidade": str(row.get("localidadeDoGasto") or "")[:150],
                        "fonte": "https://portaldatransparencia.gov.br/emendas",
                        "origem": "CGU_API_AUTOR_EXATO",
                    })
                page += 1
                next_point = {"autor": name, "ano": year, "pagina": page,
                              "ultimaAssinatura": signature_before}
                if on_page is not None:on_page(records,next_point,index)
            if status != "CONSULTADA":
                break
            next_year_position = years.index(year) + 1
            if next_year_position < len(years):
                next_point = {"autor": name, "ano": years[next_year_position], "pagina": 1}
        if status != "CONSULTADA":
            break
        completed += 1
        next_index = (index + 1) % len(authors)
        next_point = {"autor": names[next_index], "ano": years[0], "pagina": 1}

    metric = {
        "estado": status, "consultas": queries, "falhas": failed,
        "autoresConcluidos": completed, "autoresElegiveis": len(authors),
        "registrosValidados": sum(map(len, records.values())),
        "registrosRejeitados": rejected, "anos": list(years),
        "proximoAutor": next_point["autor"], "proximoAno": next_point["ano"],
        "proximaPagina": next_point["pagina"],
        "limite": "Consulta incremental por autor/ano/página; não inclui autoria coletiva nem garante cobertura histórica integral.",
    }
    if reason:
        metric["motivoPausa"] = reason
    return records, metric, next_point, next_index


def crossings(campaigns,suppliers):
    # Igualdade de CNPJ completo validado, jamais similaridade de nomes.
    ceap=defaultdict(list)
    for row in suppliers:
        company=cnpj(row.get("cnpj"))
        if company:ceap[company].append(row)
    matches=[]
    for c in campaigns:
        for f in c.get("fornecedores",[]):
            company=cnpj(f.get("cnpj"))
            if not company:continue
            for expense in ceap.get(company,[]):
                matches.append({"cnpj":company,"nomeFornecedor":f["nome"],
                  "anoCampanha":c["ano"],"anoGabinete":expense["ano"],
                  "valorContratadoCampanha":f["valor"],"valorCEAP":expense["valor"],
                  "fonteCampanha":c["fonte"],"fonteCEAP":expense["fonte"],
                  "tipo":"MESMO_CNPJ_FORNECEDOR_CAMPANHA_E_CEAP"})
    return matches[:20]

def run():
    if not DB.exists():raise RuntimeError("Snapshot legislativo obrigatório não disponível")
    db=sqlite3.connect(str(DB));db.row_factory=sqlite3.Row
    people=[dict(row) for row in db.execute(
        "SELECT id,externalId,nome,nomeCivil,casa,uf,ativo FROM Parlamentar")]
    if len(people)<150:raise RuntimeError("Base parlamentar insuficiente")
    old=json.loads(OUT.read_text()) if OUT.exists() else {"version":1,"dados":{}}
    data=old.get("dados",{})
    preserved=json.loads(CAND_PATH.read_text()) if CAND_PATH.exists() else {"version":1,"dados":{}}
    pres_data=dict(preserved.get("dados",{}))
    official_president={}
    metrics={}; warnings=[]
    progress={"etapa":"INICIO","parciaisSalvas":0}
    def checkpoint(etapa,extras=None):
        progress["etapa"]=etapa
        progress["parciaisSalvas"]+=1
        state={"version":1,"atualizadoEm":datetime.now(timezone.utc).isoformat(),
               "dados":data,"cobertura":dict(metrics,checkpoint=progress.copy()),
               "avisos":warnings[-18:],
               "emendasCursor":old.get("emendasCursor",0),
               "emendasCheckpoint":old.get("emendasCheckpoint"),
               "senadoCursor":old.get("senadoCursor",0),
               "metodologia":old.get("metodologia","Coleta parcial de fontes oficiais")}
        if extras:state.update(extras)
        OUT.parent.mkdir(parents=True,exist_ok=True)
        tmp=OUT.with_suffix(".json.tmp")
        tmp.write_text(json.dumps(state,ensure_ascii=False,sort_keys=True,
                                   separators=(",",":"))+"\n")
        tmp.replace(OUT)
    mode=os.getenv("FINANCE_COLLECTION_MODE","full").strip().lower()
    if mode not in ("full","recent"):
        raise ValueError("Modo financeiro inválido")
    metrics["modoColeta"]=mode
    years_tse=(max(ANOS_TSE),) if mode=="recent" else ANOS_TSE
    years_ceap=(max(ANOS_CEAP),) if mode=="recent" else ANOS_CEAP
    for year in years_tse:
        try:
            campaign,stat=campaign_collect(year,people,
                official_president if year==2026 else None)
            for pid,row in campaign.items():
                existing={p["ano"]:p for p in data.get(pid,{}).get("campanhas",[])}
                existing[year]=row
                data.setdefault(pid,{})["campanhas"]=sorted(existing.values(),key=lambda p:-p["ano"])
            metrics[f"tse_{year}"]=stat
        except Exception as e:warnings.append(f"TSE {year}: {type(e).__name__}: {str(e)[:120]}")
        checkpoint("TSE_"+str(year))
    # O TSE informa candidatura, não vitória. Segundo turno é retido apenas
    # se já foi comprovado por fonte separada e a identidade segue idêntica.
    for key,candidate in official_president.items():
        previous=pres_data.get(key,{})
        if (previous.get("candidato")==candidate["candidato"] and
            previous.get("numero")==candidate["numero"] and
            previous.get("eleicao")==candidate["eleicao"]):
            for field in ("turno","fonteTurno","fontePropostas","vice"):
                if field in previous:candidate[field]=previous[field]
        pres_data[key]=candidate
    metrics["presidenciais_tse_2026"]={"vinculosExatos":len(official_president),
        "criterio":"Nome civil e nome de urna exatos; não infere resultado ou posse"}
    for year in years_ceap:
        try:
            supplies=gabinete_collect(year,people)
            for pid,rows in supplies.items():
                current=[x for x in data.get(pid,{}).get("fornecedoresGabinete",[]) if x["ano"]!=year]
                data.setdefault(pid,{})["fornecedoresGabinete"]=(current+rows)[:40]
            metrics[f"ceap_{year}"]={"perfisComFornecedoresPJ":len(supplies)}
        except Exception as e:warnings.append(f"CEAP {year}: {type(e).__name__}: {str(e)[:120]}")
        checkpoint("CEAP_"+str(year))
    for year in ((2026,) if mode=='recent' else (2025,2026)):
        try:
            supplies=senado_fornecedores_collect(year,people)
            for pid,rows in supplies.items():
                current=[x for x in data.get(pid,{}).get("fornecedoresSenado",[])
                         if x.get("ano")!=year]
                data.setdefault(pid,{})["fornecedoresSenado"]=(current+rows)[:40]
            metrics[f"ceaps_fornecedores_{year}"]={"senadoresComCNPJ":len(supplies)}
        except Exception as exc:
            warnings.append(f"CEAPS detalhada {year}: {type(exc).__name__}: {str(exc)[:100]}")
        checkpoint("CEAPS_"+str(year))
    # CEAPS oficial: relatórios por código de senador, sem inferência nominal.
    senado,status_senado,next_senado_cursor=senado_ceaps(
        people,limit=int(os.getenv("SENADO_MAX_SENATORS","18")),
        cursor=int(old.get("senadoCursor",0)),
        priority_ids=os.getenv("SENADO_PRIORITY_IDS","").split(",") if
                     os.getenv("SENADO_PRIORITY_IDS") else ())
    metrics["ceaps_senado"]=status_senado
    for pid,items in senado.items():
        past={x["ano"]:x for x in data.get(pid,{}).get("cotasSenado",[])}
        past.update({x["ano"]:x for x in items})
        data.setdefault(pid,{})["cotasSenado"]=sorted(past.values(),key=lambda x:-x["ano"])
    checkpoint("SENADORES",{"senadoCursor":next_senado_cursor})
    official=emendas_db(db,people)
    api_key=os.getenv("PORTAL_TRANSPARENCIA_API_KEY","")
    def checkpoint_cgu(registros,proximo,indice):
        for pid,novos in registros.items():
            anterior={(r["codigo"],r["ano"]):r for r in data.get(pid,{}).get("emendas",[])
                      if r.get("codigo") and r.get("ano")}
            for item in novos:anterior[(item["codigo"],item["ano"])]=item
            data.setdefault(pid,{})["emendas"]=sorted(
                anterior.values(),key=lambda item:-(item.get("ano") or 0))[:12]
        checkpoint("EMENDAS_CGU",{"emendasCheckpoint":proximo,
                                "emendasCursor":indice,"senadoCursor":next_senado_cursor})
    extra,status,next_checkpoint,next_cursor=emendas_api(
        people,api_key,
        limit=int(os.getenv("EMENDAS_MAX_AUTHORS","48")),
        cursor=int(old.get("emendasCursor",0)),
        checkpoint=old.get("emendasCheckpoint"),
        max_queries=int(os.getenv("EMENDAS_MAX_QUERIES","160")),
        on_page=checkpoint_cgu)
    metrics["emendas_cgu"]=status
    for p in people:
        pid=p["id"]
        stored=data.setdefault(pid,{})
        # Não perder emendas da CGU verificadas em rodadas anteriores.
        # Apenas reter autoria exata do perfil atual; jamais inferir por homônimos.
        own_name=norm(p["nomeCivil"] or p["nome"])
        verified_names=[q for q in people if q["ativo"] and norm(q["nomeCivil"] or q["nome"])==own_name]
        previous=(x for x in stored.get("emendas",[])
                  if x.get("origem")=="CGU_API_AUTOR_EXATO" and
                  norm(x.get("autor"))==own_name and len(verified_names)==1)
        merged={(x["codigo"],x["ano"]):x for x in previous if x.get("codigo") and x.get("ano")}
        for x in official.get(pid,[]):merged[(x["codigo"],x["ano"])]=x
        for x in extra.get(pid,[]):merged[(x["codigo"],x["ano"])]=x
        if merged:stored["emendas"]=sorted(merged.values(),key=lambda x:-(x.get("ano") or 0))[:12]
        stored["coincidencias"]=crossings(stored.get("campanhas",[]),
                                         stored.get("fornecedoresGabinete",[])+
                                         stored.get("fornecedoresSenado",[]))
        if not any((stored.get(key) for key in ("campanhas","fornecedoresGabinete","fornecedoresSenado","emendas","coincidencias","cotasSenado"))):
            data.pop(pid,None)
    db.close()
    now=datetime.now(timezone.utc).isoformat()
    output={"version":1,"atualizadoEm":now,"dados":data,"cobertura":metrics,"avisos":warnings[:18],
      "emendasCursor":next_cursor if api_key else old.get("emendasCursor",0),
      "emendasCheckpoint":next_checkpoint if api_key else old.get("emendasCheckpoint"),
      "senadoCursor":next_senado_cursor,
      "metodologia":"Campanhas TSE 2018/2022/2026 por nome civil ou nome de urna exato+UF+cargo+SQ único; fornecedores CEAP/CEAPS por identificador oficial do parlamentar e CNPJ válido; valores CEAPS oficiais por código, nome e UF; emendas e despesas não se somam; coincidência não implica irregularidade."}
    OUT.parent.mkdir(parents=True,exist_ok=True)
    temp=OUT.with_suffix(".json.tmp");temp.write_text(json.dumps(output,ensure_ascii=False,separators=(",",":"),sort_keys=True)+"\n")
    temp.replace(OUT)
    candidate_output={"version":1,"atualizadoEm":now,"dados":pres_data}
    candidate_temp=CAND_PATH.with_suffix(".json.tmp")
    candidate_temp.write_text(json.dumps(candidate_output,ensure_ascii=False,
        separators=(",",":"),sort_keys=True)+"\n")
    candidate_temp.replace(CAND_PATH)
    print(json.dumps({"perfisComDados":len(data),"cobertura":metrics,"avisos":warnings[:8]},ensure_ascii=False),flush=True)

if __name__=="__main__":run()
