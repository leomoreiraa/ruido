#!/usr/bin/env python3
"""Auditoria leve de crescimento da exportação estática do RUÍDO (sem serviços externos)."""
import argparse
import datetime
import json
import os
from pathlib import Path
import sys

MIB = 1024 * 1024
JSON_ALERT = 50 * MIB
PAGES_HARD_LIMIT = 900 * MIB


def audit(root, pages=None):
    root = Path(root)
    files = sorted((root / "public/data/dossies").glob("*.json"))
    infos = {}
    alerts = []
    for file in files:
        size = file.stat().st_size
        infos[file.name] = size
        if size > JSON_ALERT:
            alerts.append(f"JSON {file.name} acima de 50 MiB; revisar processamento")
    result = {
        "generated_at_utc": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "json_files": infos,
        "json_bytes_total": sum(infos.values()),
        "warnings": alerts,
    }
    if pages:
        folder = Path(pages)
        if folder.is_dir():
            files = [(p, p.stat().st_size) for p in folder.rglob("*") if p.is_file()]
            total = sum(size for _, size in files)
            groups = {}
            kinds = {}
            for file, size in files:
                part = file.relative_to(folder).parts
                key = part[0] if part else "(root)"
                groups[key] = groups.get(key, 0) + size
                suffix = file.suffix or "(none)"
                kinds[suffix] = kinds.get(suffix, 0) + size
            result["pages_directory_mib"] = {
                k: round(v / MIB, 1) for k, v in
                sorted(groups.items(), key=lambda entry: -entry[1])[:20]
            }
            result["pages_file_types_mib"] = {
                k: round(v / MIB, 1) for k, v in
                sorted(kinds.items(), key=lambda entry: -entry[1])[:20]
            }
            result["pages_largest_files"] = [
                {"path": str(p.relative_to(folder)), "mib": round(size / MIB, 1)}
                for p, size in sorted(files, key=lambda item: -item[1])[:12]
            ]
            result["pages_files_count"] = len(files)
            result["pages_bytes"] = total
            result["pages_budget_bytes"] = PAGES_HARD_LIMIT
            if total > PAGES_HARD_LIMIT:
                print(json.dumps(result, ensure_ascii=False, indent=2), flush=True)
                raise ValueError(f"Export do Pages ocupa {total/MIB:.1f} MiB, ultrapassando orçamento de 900 MiB")
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, default=Path("."))
    parser.add_argument("--pages", type=Path)
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()
    report = audit(args.root, args.pages)
    text = json.dumps(report, ensure_ascii=False, indent=2) + "\n"
    print(text)
    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(text, encoding="utf-8")
    if os.environ.get("GITHUB_STEP_SUMMARY"):
        with open(os.environ["GITHUB_STEP_SUMMARY"], "a", encoding="utf-8") as out:
            out.write(f"### Crescimento dos dados\nJSON: {report['json_bytes_total']/MIB:.2f} MiB; "
                      f"export Pages: {report.get('pages_bytes', 0)/MIB:.2f} MiB.\n")
            for warning in report["warnings"]:
                out.write(f"- ⚠️ {warning}\n")


if __name__ == "__main__":
    try:
        main()
    except (OSError, ValueError) as error:
        print(f"Data growth check failed: {error}", file=sys.stderr)
        sys.exit(1)
