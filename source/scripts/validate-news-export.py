#!/usr/bin/env python3
"""Único validador do JSON de notícias usado em ambos os GitHub Actions.

Publicação estratificada: uma única fonte original -> FONTE_UNICA; duas
redações distintas -> CORROBORADA. Nunca infere situação jurídica pela imprensa.
Os excertos originais e a identidade são verificados pelo coletor TypeScript;
este módulo confere a integridade do snapshot já gerado.
"""
import json
import sys
from datetime import datetime
from pathlib import Path
from urllib.parse import urlsplit

DEFAULT = Path("public/data/dossies/noticias.json")


def fail(path, message):
    raise ValueError(f"{path}: {message}")


def valid_date(value):
    try:
        if not isinstance(value, str) or not value.strip():
            return False
        datetime.fromisoformat(value.replace("Z", "+00:00"))
        return True
    except ValueError:
        return False


def https_url(value):
    if not isinstance(value, str):
        return False
    try:
        url = urlsplit(value)
        return url.scheme == "https" and bool(url.hostname) and not url.username and not url.password
    except ValueError:
        return False


def validate(store):
    if not isinstance(store, dict) or store.get("version") != 1 or not isinstance(store.get("dados"), dict):
        fail("noticias", "estrutura ou versão inválida")
    count = 0
    for pid, items in store["dados"].items():
        if not isinstance(pid, str) or not pid or not isinstance(items, list):
            fail(str(pid), "lista de notícias inválida")
        ids = set()
        for i, item in enumerate(items):
            field = f"{pid}[{i}]"
            if not isinstance(item, dict):
                fail(field, "registro inválido")
            ident = item.get("id")
            if not isinstance(ident, str) or not ident or ident in ids:
                fail(field, "ID ausente ou duplicado no perfil")
            ids.add(ident)
            if item.get("situacao") not in ("NOTICIA", "CITADO"):
                fail(field, "status jurídico/forma não permitida para reportagem")
            summary = item.get("resumo")
            if not isinstance(summary, str) or len(summary) < 45 or not summary.startswith("Segundo "):
                fail(field, "resumo sem atribuição explícita ao veículo")
            if not valid_date(item.get("ultimaConferencia")):
                fail(field, "data de conferência inválida")
            sources = item.get("fontes")
            if not isinstance(sources, list) or not sources:
                fail(field, "nenhuma fonte original")
            groups = set()
            urls = set()
            for j, src in enumerate(sources):
                sfield = f"{field}.fontes[{j}]"
                if not isinstance(src, dict):
                    fail(sfield, "fonte inválida")
                group = src.get("grupoEditorial")
                link = src.get("url")
                if (not isinstance(group, str) or not group.strip() or group in groups
                        or not https_url(link) or link in urls
                        or not isinstance(src.get("titulo"), str) or not src["titulo"].strip()
                        or not valid_date(src.get("publicadoEm"))
                        or not https_url(src.get("idReportagemOriginal"))):
                    fail(sfield, "fonte inválida, duplicada ou sem proveniência")
                groups.add(group)
                urls.add(link)
            level = item.get("nivel")
            if level == "FONTE_UNICA" and len(groups) != 1:
                fail(field, "FONTE_UNICA exige uma redação")
            if level == "CORROBORADA" and len(groups) < 2:
                fail(field, "CORROBORADA exige pelo menos duas redações independentes")
            if level not in ("FONTE_UNICA", "CORROBORADA"):
                fail(field, "nível de evidência não permitido para notícia")
            for j, check in enumerate(item.get("checagens") or []):
                if not isinstance(check, dict) or not https_url(check.get("url")) or not check.get("veiculo") or not check.get("titulo"):
                    fail(f"{field}.checagens[{j}]", "checagem externa inválida")
            count += 1
    clippings=store.get("clippings",{})
    if not isinstance(clippings,dict):
        fail("clippings","índice de links inválido")
    for pid,items in clippings.items():
        if not isinstance(pid,str) or not pid or not isinstance(items,list) or len(items)>100:
            fail("clippings","perfil ou coleção de links inválido")
        urls=set()
        for i,entry in enumerate(items):
            label=f"clippings[{pid}][{i}]"
            if not isinstance(entry,dict):
                fail(label,"item não é objeto")
            url=entry.get("url")
            if (not https_url(url) or url in urls or urlsplit(url).hostname in
                ("news.google.com","bing.com","www.bing.com")):
                fail(label,"URL duplicada, agregador ou insegura")
            urls.add(url)
            if (not isinstance(entry.get("titulo"),str) or
                not 12<=len(entry["titulo"])<=220 or
                not isinstance(entry.get("grupoEditorial"),str) or
                not entry["grupoEditorial"].strip() or
                not valid_date(entry.get("publicadoEm")) or
                not valid_date(entry.get("ultimaConferencia"))):
                fail(label,"metadados de notícia originais inválidos")
    return count


def main():
    path = Path(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT
    count = validate(json.loads(path.read_text(encoding="utf-8")))
    print(f"Notícias auditadas no snapshot: {count}; níveis FONTE_UNICA/CORROBORADA válidos.")


if __name__ == "__main__":
    main()
