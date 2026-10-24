#!/usr/bin/env python3
"""Build an auditable state IDHM dataset from PNUD/FJP/IBGE Radar IDHM (2012-24).

Input workbook is mirrored with attribution by a CEDEPLAR/UFMG workshop, not a
different statistical series. The pinned GitHub blob SHA guards against changes.
No Excel runtime dependency: read XLSX via standard-library ZIP/XML.
"""
import argparse
import hashlib
import json
from pathlib import Path
import re
import sys
import unicodedata
from urllib.request import Request, urlopen
import xml.etree.ElementTree as ET
import zipfile
from io import BytesIO

SOURCE = ("https://raw.githubusercontent.com/DemoPOP/indicadores-sinteticos/"
          "7891ed55926df86a60c645ef3b1c201930830a70/"
          "data/adh_radar_base_2012_2024.xlsx")
BLOB = "6416d6b7d465f9febe08a5bf90fb30e42d8d655c"
PROVENANCE = "https://www.undp.org/pt/brazil/publications/radar-idhm-evolucao-do-idhm-e-de-seus-componentes-periodo-de-2012-2024"
MIRROR = "https://github.com/DemoPOP/indicadores-sinteticos/blob/main/data/adh_radar_base_2012_2024.xlsx"

STATES = {
    "AC":"Acre","AL":"Alagoas","AP":"Amapá","AM":"Amazonas","BA":"Bahia",
    "CE":"Ceará","DF":"Distrito Federal","ES":"Espírito Santo","GO":"Goiás",
    "MA":"Maranhão","MT":"Mato Grosso","MS":"Mato Grosso do Sul",
    "MG":"Minas Gerais","PA":"Pará","PB":"Paraíba","PR":"Paraná",
    "PE":"Pernambuco","PI":"Piauí","RJ":"Rio de Janeiro","RN":"Rio Grande do Norte",
    "RS":"Rio Grande do Sul","RO":"Rondônia","RR":"Roraima",
    "SC":"Santa Catarina","SP":"São Paulo","SE":"Sergipe","TO":"Tocantins"
}
NS={"s":"http://schemas.openxmlformats.org/spreadsheetml/2006/main",
    "r":"http://schemas.openxmlformats.org/officeDocument/2006/relationships"}
def normal(name):
    return "".join(x for x in unicodedata.normalize("NFD",str(name).strip().lower())
                   if unicodedata.category(x)!="Mn")

NAMES={normal(name):uf for uf,name in STATES.items()}


def get_rows(content):
    with zipfile.ZipFile(BytesIO(content)) as z:
        workbook=ET.fromstring(z.read("xl/workbook.xml"))
        rels=ET.fromstring(z.read("xl/_rels/workbook.xml.rels"))
        rid_to_path={node.attrib.get("Id"):node.attrib.get("Target")
                     for node in rels}
        desired=next((n for n in workbook.findall(".//s:sheet",NS)
                      if n.attrib.get("name")=="Total"),None)
        if desired is None:
            raise ValueError("Expected workbook sheet Total not found")
        rid=desired.attrib.get("{"+NS["r"]+"}id")
        target=rid_to_path.get(rid,"")
        if not target:
            raise ValueError("Missing workbook relation for sheet Total")
        sheet_name=target.lstrip("/") if target.startswith("/") else "xl/"+target.lstrip("/")
        strings=[]
        if "xl/sharedStrings.xml" in z.namelist():
            tree=ET.fromstring(z.read("xl/sharedStrings.xml"))
            strings=["".join(t.text or "" for t in si.findall(".//s:t",NS))
                     for si in tree.findall("s:si",NS)]
        rows=[]
        with z.open(sheet_name) as file:
            for event,elem in ET.iterparse(file,events=("end",)):
                if elem.tag != "{"+NS["s"]+"}row":
                    continue
                cells={}
                for cell in elem.findall("s:c",NS):
                    col=re.match(r"[A-Z]+",cell.attrib.get("r",""))
                    if not col:
                        continue
                    col_num=0
                    for ch in col.group(0):
                        col_num=col_num*26+ord(ch)-64
                    v=cell.find("s:v",NS)
                    kind=cell.attrib.get("t")
                    if kind=="inlineStr":
                        value="".join(t.text or "" for t in cell.findall(".//s:t",NS))
                    elif v is None or v.text is None:
                        value=None
                    elif kind=="s":
                        value=strings[int(v.text)]
                    else:
                        value=v.text
                    cells[col_num-1]=value
                if cells:
                    rows.append([cells.get(i) for i in range(max(cells)+1)])
                elem.clear()
        return rows


def extract(content):
    if hashlib.sha1(b"blob "+str(len(content)).encode()+b"\0"+content).hexdigest()!=BLOB:
        raise ValueError("Workbook blob does not match pinned upstream source")
    rows=get_rows(content)
    header_index=None
    for i,row in enumerate(rows[:30]):
        cols={str(value).strip().upper():j for j,value in enumerate(row) if value is not None}
        if {"ANO","AGREGACAO","NOME","IDHM"}.issubset(cols):
            header_index=i
            break
    if header_index is None:
        raise ValueError("Missing ANO / AGREGACAO / NOME / IDHM columns")
    out={uf:{} for uf in STATES}
    for row in rows[header_index+1:]:
        def get(name):
            index=cols[name]
            return row[index] if index<len(row) else None
        try:
            year=int(float(str(get("ANO"))))
        except (ValueError,TypeError):
            continue
        if not 2012<=year<=2024 or normal(get("AGREGACAO"))!="unidade da federacao":
            continue
        uf=NAMES.get(normal(get("NOME")))
        if not uf:
            raise ValueError("Unknown UF in official data: "+str(get("NOME")))
        try:
            idhm=float(str(get("IDHM")).replace(",","."))
        except (ValueError,TypeError):
            raise ValueError(f"Missing IDHM {uf}/{year}")
        if not .3<=idhm<=1:
            raise ValueError(f"Out-of-range IDHM {uf}/{year}: {idhm}")
        if str(year) in out[uf]:
            raise ValueError(f"Duplicate IDHM {uf}/{year}")
        out[uf][str(year)]=round(idhm,4)
    for year in (2022,2023,2024):
        complete=sum(str(year) in v for v in out.values())
        if complete != 27:
            raise ValueError(f"IDHM {year}: {complete}/27 states; refusing incomplete source")
    return {
        "indicador":"IDHM",
        "fonte":"PNUD/FJP/IBGE — Radar IDHM (PNAD Contínua), 2012–2024",
        "urlOficial":PROVENANCE,
        "espelho":MIRROR,
        "serieAte":2024,
        "unidade":"índice de 0 a 1",
        "porUF":out,
    }

def main():
    parser=argparse.ArgumentParser()
    parser.add_argument("--output",required=True,type=Path)
    args=parser.parse_args()
    data=urlopen(Request(SOURCE,headers={"User-Agent":"RUÍDO-public-data/1.0"}),timeout=40).read()
    result=extract(data)
    args.output.parent.mkdir(parents=True,exist_ok=True)
    tmp=args.output.with_suffix(".tmp")
    tmp.write_text(json.dumps(result,ensure_ascii=False,separators=(",",":")),encoding="utf8")
    tmp.replace(args.output)
    print("IDHM official annual series:",len(result["porUF"]),"states; latest 2024. Provenance:",PROVENANCE)

if __name__=="__main__":
    try: main()
    except Exception as err:
        print("IDHM source integration failed:",err,file=sys.stderr)
        sys.exit(1)
