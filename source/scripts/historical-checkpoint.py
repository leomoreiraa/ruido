"""Verified, immutable historical SQLite checkpoints stored as prerelease assets.

Progress Releases are never eligible as canonical rebuilt-v2 snapshots. They are
restored only if newer than the last verified canonical Release or Actions fallback.
"""
import argparse
from datetime import datetime, timezone
import importlib.util
import json
from pathlib import Path
import re
import subprocess
import sys

ROOT = Path(__file__).resolve().parent
TAG = re.compile(r"rebuilt-v2-progress-(\d+)-(\d+)-(camara|senado|final)")
REPOSITORY = re.compile(r"[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+")


def gh(*args):
    return subprocess.check_output(["gh", *args], text=True)


def timestamp(value):
    if not value:
        return datetime.min.replace(tzinfo=timezone.utc)
    return datetime.fromisoformat(value.replace("Z", "+00:00")).astimezone(timezone.utc)


def releases(repository):
    pages = json.loads(gh("api", "--paginate", "--slurp",
                          f"repos/{repository}/releases?per_page=100"))
    return [item for page in pages for item in page if isinstance(item, dict)]


def candidates(items, since=""):
    result = [item for item in items
              if TAG.fullmatch(str(item.get("tag_name", "")))
              and item.get("prerelease") is True
              and item.get("draft") is False
              and item.get("published_at")
              and timestamp(item["published_at"]) > timestamp(since)]
    return sorted(result, key=lambda item: (timestamp(item["published_at"]),
                                            int(item.get("id", 0))), reverse=True)


def run_script(script, *args):
    subprocess.run([sys.executable, "-I", str(ROOT / script), *map(str, args)], check=True)


def publish(args):
    tag = f"rebuilt-v2-progress-{args.run_id}-{args.attempt}-{args.stage}"
    if not TAG.fullmatch(tag):
        raise ValueError("Invalid progress checkpoint tag")
    database = args.candidate / "public.sqlite"
    manifest = args.candidate / "manifest.json"
    compressed = args.candidate / "public.sqlite.gz"
    if not all(path.is_file() and not path.is_symlink()
               for path in (database, manifest, compressed)):
        raise ValueError("Verified snapshot assets missing")
    run_script("sqlite-snapshot.py", "verify", "--database", database,
               "--manifest", manifest)
    run_script("verify-rebuilt.py", "--checkpoint-only", "--database", database)

    # A long-running collector must never write progress against a stale baseline.
    spec = importlib.util.spec_from_file_location("release_snapshot", ROOT / "release-snapshot.py")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    module.assert_baseline(args.repository, args.baseline_tag)
    gh("release", "create", tag, "--repo", args.repository, "--target", args.commit,
       "--draft", "--title", tag,
       "--notes", "Intermediate verified SQLite checkpoint. Not a canonical public snapshot.")
    gh("release", "upload", tag, str(compressed), str(manifest), "--repo", args.repository)
    module.assert_baseline(args.repository, args.baseline_tag)
    gh("release", "edit", tag, "--repo", args.repository, "--draft=false", "--prerelease")
    print(f"Verified historical progress saved as prerelease {tag}")


def restore(args):
    selected = candidates(releases(args.repository), args.since)
    if not selected:
        print("No newer verified historical progress Release")
        return
    latest = selected[0]
    args.work_dir.mkdir(parents=True, exist_ok=False)
    gh("release", "download", latest["tag_name"], "--repo", args.repository,
       "--pattern", "public.sqlite*", "--pattern", "manifest.json",
       "--dir", str(args.work_dir))
    spec = importlib.util.spec_from_file_location("release_snapshot", ROOT / "release-snapshot.py")
    transport = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(transport)
    database = transport.unpack(args.work_dir)
    manifest = args.work_dir / "manifest.json"
    verified = args.work_dir / "restored.sqlite"
    run_script("sqlite-snapshot.py", "restore", "--database", database,
               "--manifest", manifest, "--destination", verified)
    run_script("verify-rebuilt.py", "--checkpoint-only", "--database", verified)
    if args.destination.exists():
        spec = importlib.util.spec_from_file_location("sqlite_snapshot", ROOT / "sqlite-snapshot.py")
        snapshots = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(snapshots)
        snapshots.preserve_history(verified, args.destination)
    if any(Path(str(args.destination) + suffix).exists() for suffix in ("-wal", "-shm")):
        raise ValueError("Refusing to replace SQLite with active WAL/SHM")
    args.destination.parent.mkdir(parents=True, exist_ok=True)
    verified.replace(args.destination)
    print(f"Restored verified newer historical progress {latest['tag_name']}")


def cleanup(args):
    items = releases(args.repository)
    canonical = [item for item in items
                 if re.fullmatch(r"rebuilt-v2-\d+-\d+", str(item.get("tag_name", "")))
                 and not item.get("draft") and not item.get("prerelease")
                 and item.get("published_at")]
    if not canonical:
        raise ValueError("No canonical Release: refusing progress cleanup")
    latest = max(canonical, key=lambda item: (timestamp(item["published_at"]),
                                               int(item.get("id", 0))))
    expected_canonical = f"rebuilt-v2-{args.run_id}-{args.attempt}"
    if latest["tag_name"] != expected_canonical:
        print("Canonical Release is not from this run; retaining progress for safety")
        return
    expected_progress = f"rebuilt-v2-progress-{args.run_id}-{args.attempt}-"
    eligible = [item for item in candidates(items)
                if item["tag_name"].startswith(expected_progress)
                and timestamp(item["published_at"]) <= timestamp(latest["published_at"])]
    for item in eligible[:args.max_delete]:
        gh("release", "delete", item["tag_name"], "--repo", args.repository,
           "--yes", "--cleanup-tag")
        print(f"Removed superseded verified progress {item['tag_name']}")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest="command", required=True)
    pub = sub.add_parser("publish")
    pub.add_argument("--repository", required=True)
    pub.add_argument("--candidate", required=True, type=Path)
    pub.add_argument("--run-id", required=True)
    pub.add_argument("--attempt", required=True)
    pub.add_argument("--stage", required=True, choices=("camara", "senado", "final"))
    pub.add_argument("--baseline-tag", required=True)
    pub.add_argument("--commit", required=True)
    rec = sub.add_parser("restore")
    rec.add_argument("--repository", required=True)
    rec.add_argument("--destination", required=True, type=Path)
    rec.add_argument("--work-dir", required=True, type=Path)
    rec.add_argument("--since", default="")
    clean = sub.add_parser("cleanup")
    clean.add_argument("--repository", required=True)
    clean.add_argument("--run-id", required=True)
    clean.add_argument("--attempt", required=True)
    clean.add_argument("--max-delete", type=int, default=20)
    args = parser.parse_args()
    if not REPOSITORY.fullmatch(args.repository):
        raise ValueError("Invalid repository")
    if args.command == "publish":
        if not args.run_id.isdecimal() or not args.attempt.isdecimal():
            raise ValueError("Invalid run identifier")
        publish(args)
    elif args.command == "restore":
        restore(args)
    else:
        if not args.run_id.isdecimal() or not args.attempt.isdecimal():
            raise ValueError("Invalid run identifier")
        if not 1 <= args.max_delete <= 30:
            raise ValueError("Invalid cleanup limit")
        cleanup(args)


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        print(f"Historical checkpoint failed: {error}", file=sys.stderr)
        sys.exit(1)
