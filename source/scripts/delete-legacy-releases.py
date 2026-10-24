"""Delete previous public-data-* releases only after a clean v2 Pages deployment.

Intentionally excludes rebuilt-v2-* and unrelated releases.
A GitHub release removal does NOT purge LFS objects in earlier Git history.
"""
import argparse
import json
import re
import subprocess
import sys

LEGACY = re.compile(r"public-data-\d+-\d+")


def gh(*args):
    return subprocess.check_output(("gh",) + args, text=True)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--repository", required=True)
    args = parser.parse_args()
    if not re.fullmatch(r"[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+", args.repository):
        raise ValueError("Unsafe repository name")
    pages = json.loads(gh("api", "--paginate", "--slurp",
                          f"repos/{args.repository}/releases?per_page=100"))
    legacy = sorted({
        release.get("tag_name", "")
        for page in pages for release in page
        if LEGACY.fullmatch(release.get("tag_name", ""))
    })
    print(f"Legacy releases to remove: {len(legacy)}", flush=True)
    for tag in legacy:
        print(f"Deleting old SQLite release {tag}", flush=True)
        subprocess.run(
            ["gh", "release", "delete", tag, "--repo", args.repository,
             "--yes", "--cleanup-tag"], check=True,
        )
    print("Old public-data-* GitHub Releases cleanup completed.", flush=True)


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        print(f"Legacy release cleanup failed: {error}", file=sys.stderr)
        sys.exit(1)
