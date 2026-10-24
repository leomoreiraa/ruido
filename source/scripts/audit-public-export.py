#!/usr/bin/env python3
"""Fail-closed audit for the compiled static site before public mirroring.

Only the Next.js export directory is publishable. Never publish the source tree,
Actions artifacts, SQLite snapshots, environment files, source maps or secrets.
"""
from __future__ import annotations

import argparse
import re
import subprocess
import sys
from pathlib import Path

ALLOWED_SUFFIXES = {
    ".html", ".css", ".js", ".json", ".xml", ".txt", ".md",
    ".svg", ".png", ".jpg", ".jpeg", ".gif", ".webp", ".avif",
    ".ico", ".woff", ".woff2", ".ttf", ".otf", ".webmanifest",
    ".pdf", ".webm", ".mp4", ".mp3", ".wav", ".ogg",
}
ALLOWED_EXTENSIONLESS = {".nojekyll", "CNAME"}
FORBIDDEN_PARTS = {
    ".git", ".github", ".next", "node_modules", "prisma", "scripts",
    "lib", "app", "tests", "_api_backup_during_export", "__pycache__",
}
FORBIDDEN_NAMES = {
    "package.json", "package-lock.json", "dockerfile",
    "docker-compose.yml", "next.config.mjs", ".env", ".env.local",
    ".env.production", ".env.development", ".npmrc", ".pypirc",
    ".gitmodules", ".gitignore", "id_rsa", "id_ed25519",
}
SECRET_PATTERNS = {
    "GitHub token": re.compile(rb"(?:github_pat_[A-Za-z0-9_]{20,}|gh[pousr]_[A-Za-z0-9_]{20,})"),
    "OpenAI token": re.compile(rb"\bsk-[A-Za-z0-9_-]{24,}"),
    "Google API key": re.compile(rb"\bAIza[0-9A-Za-z_-]{35}"),
    "AWS access key": re.compile(rb"\b(?:AKIA|ASIA)[A-Z0-9]{16}"),
    "Private key": re.compile(rb"-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----"),
}
TEXT_SUFFIXES = {".html", ".css", ".js", ".json", ".xml", ".txt", ".md", ".svg", ".webmanifest"}
SOURCE_SUFFIXES = {".ts", ".tsx", ".mjs", ".py", ".prisma", ".css", ".svg", ".json", ".js", ".md"}

def audit(root: Path) -> tuple[int, int]:
    root = root.resolve(strict=True)
    if not root.is_dir():
        raise ValueError("Export directory is not a directory")
    required = ["index.html", "mapa/index.html", "_next", "data/pautas-index.json"]
    for name in required:
        if not (root / name).exists():
            raise ValueError(f"Required public export asset missing: {name}")
    # The source mirror carries executable examples and build scripts. Validate
    # its strict manifest/path allowlist before approving any site publication.
    if (root / "source").exists():
        subprocess.run([sys.executable, "-I", "scripts/build-public-source.py", "verify", str(root / "source")], check=True)
    count = 0
    size = 0
    for path in root.rglob("*"):
        relative = path.relative_to(root)
        if path.is_symlink():
            raise ValueError(f"Symlinks cannot be published: {relative}")
        # Next.js emits legitimate browser chunks under _next/static/chunks/app/.
        # Operational roots must never be present, while .git/.github and
        # dependency/cache directories are forbidden at any nesting depth.
        forbidden_anywhere = {".git", ".github", "node_modules", "__pycache__", "_api_backup_during_export"}
        forbidden_at_root = FORBIDDEN_PARTS - forbidden_anywhere
        if (any(part.lower() in forbidden_anywhere for part in relative.parts)
                or relative.parts[0].lower() in forbidden_at_root):
            raise ValueError(f"Private directory in public export: {relative}")
        if path.is_dir():
            continue
        if not path.is_file():
            raise ValueError(f"Unexpected file type: {relative}")
        is_source = relative.parts[0] == "source"
        if path.name.startswith(".env") or (path.name.lower() in FORBIDDEN_NAMES and not is_source):
            raise ValueError(f"Private filename in public export: {relative}")
        # Only the generated public JSON archives may be gzip-compressed.
        # Reject any other gzip payload, including database and build artifacts.
        public_gzip = (
            path.name.endswith(".json.gz")
            and relative.parts[:2] in (("data", "historico"), ("data", "pautas-detalhe"))
        )
        allowed_source = is_source and path.suffix.lower() in SOURCE_SUFFIXES
        if path.suffix.lower() not in ALLOWED_SUFFIXES and path.name not in ALLOWED_EXTENSIONLESS and not public_gzip and not allowed_source:
            raise ValueError(f"Unapproved file extension in public export: {relative}")
        count += 1
        size += path.stat().st_size
        if path.suffix.lower() in TEXT_SUFFIXES or allowed_source or path.name == "CNAME":
            with path.open("rb") as handle:
                # Overlap chunks to catch credential strings across read boundaries.
                previous = b""
                while chunk := handle.read(1024 * 1024):
                    content = previous + chunk
                    for label, pattern in SECRET_PATTERNS.items():
                        if pattern.search(content):
                            raise ValueError(f"Possible {label} in published output: {relative}")
                    previous = content[-256:]
    if count < 10:
        raise ValueError(f"Suspiciously small static export ({count} files)")
    return count, size

def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("directory", type=Path, help="Next.js out directory")
    args = parser.parse_args()
    try:
        count, size = audit(args.directory)
    except (OSError, ValueError) as exc:
        print(f"::error::Public mirror security audit failed: {exc}", file=sys.stderr)
        return 1
    print(f"Static export security audit passed: {count} files, {size} bytes")
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
