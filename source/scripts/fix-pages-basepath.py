#!/usr/bin/env python3
"""Rebase root-relative URLs in a Next.js static export, preserving external links."""
import argparse
from html.parser import HTMLParser
from pathlib import Path
import re
import sys

OLD="/radar-congresso"
PATTERN=re.compile(r"(?<![A-Za-z0-9./])" + re.escape(OLD) + r"(?=/|[\"'])")
EXTENSIONS={".html",".js",".css",".json",".txt",".xml",".webmanifest"}

class Assets(HTMLParser):
    def __init__(self):
        super().__init__()
        self.css=[]
        self.js=[]
    def handle_starttag(self,tag,attrs):
        d=dict(attrs)
        if tag=="link" and "stylesheet" in d.get("rel","").split():
            self.css.append(d.get("href",""))
        if tag=="script" and d.get("src"):
            self.js.append(d["src"])

def verify(root):
    index=root/"index.html"
    if not index.is_file():
        raise ValueError("index.html is missing")
    html=index.read_text()
    parsed=Assets()
    parsed.feed(html)
    if not parsed.css or not any("_next/static/css" in url for url in parsed.css):
        raise ValueError("No Next.js global CSS link")
    for url in parsed.css + parsed.js:
        if not url.startswith("/") or url.startswith("//") or OLD in url:
            raise ValueError("Unexpected stylesheet or JS asset URL: "+url)
        file=(root/url.lstrip("/")).resolve()
        if not file.is_relative_to(root.resolve()) or not file.is_file():
            raise ValueError("Missing asset: "+url)
    for page in root.rglob("*.html"):
        if PATTERN.search(page.read_text()):
            raise ValueError("Legacy path in "+str(page))
    print("Verified",len(parsed.css),"CSS stylesheets and",len(parsed.js),"scripts")

def rebase(root):
    rewritten=0
    for p in root.rglob("*"):
        if not p.is_file() or p.suffix not in EXTENSIONS:
            continue
        old=p.read_text()
        new=PATTERN.sub("",old)
        if new!=old:
            p.write_text(new)
            rewritten+=1
    print("Rebased",rewritten,"files")
    verify(root)

if __name__=="__main__":
    parser=argparse.ArgumentParser()
    parser.add_argument("--directory",type=Path,required=True)
    parser.add_argument("--verify-only",action="store_true")
    args=parser.parse_args()
    try:
        (verify if args.verify_only else rebase)(args.directory)
    except Exception as e:
        print("Page asset check failed:",e,file=sys.stderr)
        sys.exit(1)
