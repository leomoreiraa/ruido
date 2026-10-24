#!/usr/bin/env python3
"""Publish an auditable RUÍDO source snapshot, never the operational repo itself.

This intentionally shares frontend AND backend implementation, including API
routes, collectors, AI integration and Prisma schema. It excludes workflow
configuration, runtime databases, checkpoints, environment files and Git history.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import re
import shutil
import subprocess
import sys
from pathlib import Path

SOURCE_EXTENSIONS = {
    "app": {".ts", ".tsx", ".css", ".svg"},
    "components": {".ts", ".tsx", ".css"},
    "lib": {".ts", ".tsx", ".js"},
    "scripts": {".ts", ".tsx", ".js", ".mjs", ".py"},
    "tests": {".ts", ".tsx", ".js", ".mjs", ".py"},
}
INDIVIDUAL_FILES = {
    "prisma/schema.prisma", "package.json", "package-lock.json",
    "next.config.mjs", "postcss.config.mjs", "tailwind.config.ts",
    "tsconfig.json", "components.json",
}
BLOCKED_PARTS = {
    ".git", ".github", ".next", "node_modules", "__pycache__",
    "checkpoints", "secrets", "snapshots", "artifacts",
}
BLOCKED_FILENAMES = {
    ".env", ".npmrc", ".pypirc", "credentials.json",
    "id_rsa", "id_ed25519", "config.json",
}
BAD_SUFFIXES = {".db", ".sqlite", ".sqlite3", ".pem", ".p12", ".key", ".zip", ".gz", ".map"}
PATTERNS = {
    "GitHub credential": re.compile(rb"(?:github_pat_[A-Za-z0-9_]{20,}|gh[pousr]_[A-Za-z0-9_]{20,})"),
    "OpenAI credential": re.compile(rb"\bsk-[A-Za-z0-9_-]{24,}"),
    "Google credential": re.compile(rb"\bAIza[0-9A-Za-z_-]{35}"),
    "AWS credential": re.compile(rb"\b(?:AKIA|ASIA)[A-Z0-9]{16}"),
    "Private key": re.compile(rb"-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----"),
    "Slack token": re.compile(rb"xox[baprs]-[0-9A-Za-z-]{15,}"),
}
MAX_SOURCE_FILE_BYTES = 3 * 1024 * 1024


def allowed_path(filename: str) -> bool:
    name = Path(filename)
    parts = name.parts
    if not parts or filename.startswith("/") or ".." in parts:
        return False
    if any(part.lower() in BLOCKED_PARTS for part in parts):
        return False
    if any(part.startswith(".") for part in parts):
        return False
    if name.name.lower() in BLOCKED_FILENAMES or any(name.name.lower().endswith(ext) for ext in BAD_SUFFIXES):
        return False
    if filename in INDIVIDUAL_FILES:
        return True
    return len(parts) >= 2 and parts[0] in SOURCE_EXTENSIONS and name.suffix.lower() in SOURCE_EXTENSIONS[parts[0]]


def check_bytes(filename: str, data: bytes) -> None:
    if len(data) > MAX_SOURCE_FILE_BYTES:
        raise ValueError(f"Source file too large: {filename}")
    if b"\x00" in data:
        raise ValueError(f"Binary data in source file: {filename}")
    for label, pattern in PATTERNS.items():
        if pattern.search(data):
            raise ValueError(f"Potential {label} in {filename}; publication blocked")


def manifest_for(root: Path) -> dict[str, str]:
    hashes = {}
    for path in sorted(root.rglob("*")):
        if path.is_symlink():
            raise ValueError(f"Symlink in public source: {path}")
        if path.is_dir():
            continue
        rel = path.relative_to(root).as_posix()
        if rel in ("README.md", "manifest.json"):
            continue
        if not allowed_path(rel):
            raise ValueError(f"Unapproved public source path: {rel}")
        data = path.read_bytes()
        check_bytes(rel, data)
        hashes[rel] = hashlib.sha256(data).hexdigest()
    if not any(k.startswith("app/") for k in hashes):
        raise ValueError("Missing frontend implementation")
    if not any(k.startswith("scripts/") for k in hashes):
        raise ValueError("Missing backend implementation")
    if "prisma/schema.prisma" not in hashes:
        raise ValueError("Missing public database schema")
    return hashes


def export(destination: Path) -> None:
    repo = Path.cwd().resolve()
    tracked = subprocess.check_output(["git", "ls-files", "-z"], cwd=repo).split(b"\x00")
    if destination.exists():
        shutil.rmtree(destination)
    destination.mkdir(parents=True)
    for raw in tracked:
        if not raw:
            continue
        rel = raw.decode("utf-8")
        if not allowed_path(rel):
            continue
        src = repo / rel
        if src.is_symlink() or not src.is_file():
            raise ValueError(f"Unexpected source entry: {rel}")
        data = src.read_bytes()
        check_bytes(rel, data)
        dst = destination / rel
        dst.parent.mkdir(parents=True, exist_ok=True)
        dst.write_bytes(data)
    write_manifest(destination)


def write_manifest(root: Path) -> None:
    hashes = manifest_for(root)
    readme = (
        "# RUÍDO — código-fonte público\n\n"
        "Esta pasta contém o código legível do frontend e do backend: "
        "páginas React/Next.js, componentes, rotas de API, serviços de coleta, "
        "integrações com IA, testes e o schema Prisma.\n\n"
        "**Não inclui** arquivos SQLite, dados operacionais, checkpoints, "
        "secrets, variáveis de ambiente, histórico Git privado nem "
        "configurações de GitHub Actions. A execução acontece no "
        "repositório de produção privado; o código público é publicado "
        "automaticamente após auditoria.\n\n"
        "O código-fonte NÃO é um backend em funcionamento no Pages: "
        "o site usa arquivos estáticos previamente gerados.\n\n"
        "O manifest.json lista o hash SHA-256 de cada arquivo do snapshot "
        "para facilitar auditoria e comparação de versões.\n"
    )
    (root / "README.md").write_text(readme, encoding="utf-8")
    (root / "manifest.json").write_text(
        json.dumps({"version": 1, "files": hashes}, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )
    print(f"Exported {len(hashes)} vetted source files")


def verify(root: Path) -> None:
    if not root.is_dir() or root.is_symlink():
        raise ValueError("Public source directory missing or unsafe")
    actual = manifest_for(root)
    expected = json.loads((root / "manifest.json").read_text(encoding="utf-8"))
    if expected != {"version": 1, "files": actual}:
        raise ValueError("Public source manifest mismatch")
    if not (root / "README.md").is_file():
        raise ValueError("Public source README missing")
    entries = {p.relative_to(root).as_posix() for p in root.rglob("*") if p.is_file()}
    if entries != set(actual) | {"manifest.json", "README.md"}:
        raise ValueError("Unexpected files in source snapshot")
    print(f"Verified {len(actual)} public frontend/backend source files")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("action", choices=("export", "verify"))
    parser.add_argument("directory", type=Path)
    args = parser.parse_args()
    if args.action == "export":
        export(args.directory)
    else:
        verify(args.directory)


if __name__ == "__main__":
    try:
        main()
    except (ValueError, OSError, subprocess.CalledProcessError, json.JSONDecodeError) as error:
        print(f"::error::RUÍDO public-source security check: {error}", file=sys.stderr)
        sys.exit(1)
