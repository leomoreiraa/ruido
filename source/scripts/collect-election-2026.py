#!/usr/bin/env python3
"""Coleta a apuração presidencial do 2º turno de 2026 exclusivamente do TSE."""
import argparse
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
from pathlib import Path
import json
import os
import time
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

BASE = "https://resultados.tse.jus.br/oficial"
CONFIG = BASE + "/ele2026/6258/config/mun-e006258-cm.json"
CONFIG_ELECTION = BASE + "/comum/config/ele-c.json"
ELECTION = "6258"
CARGO = "0001"
UFS = ("ac al ap am ba ce df es go ma mt ms mg pa pb pr pe pi rj rn rs ro rr sc sp se to").split()

def get(url, retries=2):
    for attempt in range(retries + 1):
        try:
            request = Request(url, headers={"User-Agent":"RUIDO/1.0 (divulgacao de resultados eleitorais; contato via repositorio)", "Accept":"application/json"})
            with urlopen(request, timeout=16) as res:
                if res.status != 200:
                    raise ValueError("HTTP inesperado")
                data = res.read(7_500_000)
            return json.loads(data)
        except (HTTPError, URLError, TimeoutError, ValueError, OSError):
            if attempt == retries:
                raise
            time.sleep(0.5 * (attempt + 1))

def source_url(uf, code=None):
    if uf not in UFS and uf != "br":
        raise ValueError("UF invalida")
    if code is not None and (len(code) != 5 or not code.isascii() or not code.isdecimal()):
        raise ValueError("Codigo TSE deve ter cinco digitos")
    stem = uf + (code or "")
    return BASE + f"/ele2026/{ELECTION}/dados/{uf}/{stem}-c{CARGO}-e006258-u.json"

def inteiro(v):
    try:
        s = str(v)
        if not s.isdecimal():
            return 0
        return int(s)
    except (TypeError, ValueError):
        return 0

def resumo(raw):
    if not isinstance(raw, dict) or str(raw.get("ele")) != ELECTION or str(raw.get("t")) != "2":
        raise ValueError("Resposta nao corresponde ao segundo turno de 2026")
    voters = raw.get("v") or {}
    sections = raw.get("s") or {}
    if not isinstance(voters, dict) or not isinstance(sections, dict):
        raise ValueError("Estrutura do arquivo TSE invalida")
    validos = inteiro(voters.get("vv"))
    total = inteiro(voters.get("tv"))
    done = inteiro(sections.get("st"))
    expected = inteiro(sections.get("ts"))
    if expected < 0 or done > expected or validos > total:
        raise ValueError("Totalizacao TSE inconsistente")
    candidates = []
    for cargo in raw.get("carg", []):
        if str(cargo.get("cd")) != "1":
            continue
        for agr in cargo.get("agr", []):
            for partido in agr.get("par", []):
                for c in partido.get("cand", []):
                    votos = inteiro(c.get("vap"))
                    candidates.append({"numero":str(c.get("n","")), "nome":str(c.get("nmu") or c.get("nm") or ""), "partido":str(partido.get("sg") or ""), "votos":votos, "percentual":round(100*votos/validos, 4) if validos else None})
    if not candidates:
        raise ValueError("TSE nao publicou candidatos na eleicao")
    if validos and sum(c["votos"] for c in candidates) > validos:
        raise ValueError("Soma de votos dos candidatos excede votos validos")
    candidates.sort(key=lambda c:(-c["votos"], c["numero"]))
    started = total > 0 and done > 0
    return {"situacao":"parcial" if started and done < expected else "concluida" if started and done == expected else "aguardando",
            "apuradoEm": (str(raw.get("dt") or "")+" "+str(raw.get("ht") or "")).strip() or None,
            "secoesTotalizadas":done,"secoesPrevistas":expected,
            "percentualSecoes":round(100*done/expected, 3) if expected else None,
            "votosValidos":validos if started else None,
            "votosTotais":total if started else None,
            "brancos":inteiro(voters.get("vb")) if started else None,
            "nulos":inteiro(voters.get("vn"))+inteiro(voters.get("vnt")) if started else None,
            "candidatos":candidates}

def municipios(raw):
    if not isinstance(raw, dict) or not isinstance(raw.get("abr"), list):
        raise ValueError("EA12 sem municipios")
    out = []
    seen = set()
    for state in raw["abr"]:
        uf = str(state.get("cd","")).lower()
        if uf not in UFS:
            continue
        for city in state.get("mu", []):
            code, ibge = str(city.get("cd","")), str(city.get("cdi",""))
            if len(code)!=5 or not code.isdecimal() or len(ibge)!=7 or not ibge.isdecimal():
                raise ValueError("EA12 com codigos municipais invalidos")
            key = uf+code
            if key in seen:
                raise ValueError("EA12 com municipio duplicado")
            seen.add(key)
            out.append({"uf":uf.upper(),"codigoTSE":code,"codigoIBGE":ibge,"nome":str(city.get("nm","")).strip()})
    if len(out) < 5500 or len(set(c["uf"] for c in out)) != 27:
        raise ValueError("EA12 incompleto: recusado")
    return out

def fetch_city(city):
    try:
        return city["uf"],city["codigoIBGE"],resumo(get(source_url(city["uf"].lower(),city["codigoTSE"]),retries=1))
    except Exception:
        return city["uf"],city["codigoIBGE"],None

def main():
    p=argparse.ArgumentParser()
    p.add_argument("--output",default="public/data/eleicoes-2026.json")
    p.add_argument("--workers",type=int,default=28)
    p.add_argument("--all-cities",action="store_true")
    args=p.parse_args()
    if not 1<=args.workers<=40:
        raise ValueError("workers: 1..40")
    conf=get(CONFIG_ELECTION)
    if not any(str(e.get("cdt2"))=="6258" for pleito in conf.get("pl",[]) for e in pleito.get("e",[])):
        raise ValueError("TSE nao confirmou codigo 6258")
    cities=municipios(get(CONFIG))
    national=resumo(get(source_url("br")))
    by_uf={}
    with ThreadPoolExecutor(max_workers=min(12,args.workers)) as pool:
        tasks={pool.submit(get,source_url(uf)):uf for uf in UFS}
        for task in as_completed(tasks):
            uf=tasks[task]
            try:
                by_uf[uf.upper()]=resumo(task.result())
            except Exception:
                by_uf[uf.upper()]=None
    if sum(v is not None for v in by_uf.values())<25:
        raise ValueError("TSE indisponivel em mais de duas UFs; sem sobrescrever dados")
    current={}
    old_path=Path(args.output)
    if old_path.is_file():
        try:
            old=json.loads(old_path.read_text(encoding="utf-8"))
            if old.get("fonte")==BASE and old.get("turno")==2:
                current=old.get("resultadosMunicipais",{})
        except (ValueError,OSError):
            pass
    by_city={}
    fail_count=0
    if args.all_cities:
        with ThreadPoolExecutor(max_workers=args.workers) as pool:
            tasks=[pool.submit(fetch_city,city) for city in cities]
            for task in as_completed(tasks):
                uf,ibge,result=task.result()
                if result is not None:
                    by_city[ibge]=result
                elif ibge in current:
                    by_city[ibge]=current[ibge]
                    fail_count+=1
                else:
                    fail_count+=1
        if len(by_city)<int(len(cities)*.95):
            raise ValueError("Menos de 95% dos municipios com consulta TSE; snapshot nao substituido")
    else:
        by_city=current
    now=datetime.now(timezone.utc).isoformat()
    snapshot={"versao":1,"fonte":BASE,"urlOficial":"https://resultados.tse.jus.br/oficial/app/index.html",
      "eleicao":"6258","ano":2026,"turno":2,"cargo":"Presidente","dataEleicao":"2026-10-25",
      "coletadoEm":now,"municipiosConsultados":len(by_city),"municipiosPrevistos":len(cities),
      "falhasNaRodada":fail_count,"brasil":national,"estados":by_uf,
      "municipios":cities,"resultadosMunicipais":by_city}
    dest=Path(args.output)
    dest.parent.mkdir(parents=True,exist_ok=True)
    tmp=dest.with_suffix(".tmp")
    tmp.write_text(json.dumps(snapshot,ensure_ascii=False,separators=(",",":")),encoding="utf-8")
    tmp.replace(dest)
    print(json.dumps({"hora":now,"situacao":national["situacao"],"ufs":sum(v is not None for v in by_uf.values()),"municipios":len(by_city),"falhas":fail_count},ensure_ascii=False))

if __name__=="__main__":
    main()
