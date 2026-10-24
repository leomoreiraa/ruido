"""Rotate SQLite Releases from clean generation, without touching other assets.

Policy (UTC): keep the three newest snapshots plus a representative from each
of the previous seven days, four ISO weeks and twelve calendar months.
Only published, non-draft rebuilt-v2-<run>-<attempt> Releases may be removed.
Run defaults to dry-run. --apply is needed to delete anything.
"""
from datetime import datetime, timedelta, timezone
import argparse
import json
import re
import subprocess
import sys

TAG = re.compile(r"rebuilt-v2-\d+-\d+")
MIN_RECENT = 3
MAX_DELETE = 30


def when(value):
    return datetime.fromisoformat(value.replace("Z", "+00:00")).astimezone(timezone.utc)


def choose(releases, now=None):
    now = now or datetime.now(timezone.utc)
    candidates = [r for r in releases if isinstance(r, dict) and
                  TAG.fullmatch(str(r.get("tag_name", ""))) and
                  not r.get("draft") and not r.get("prerelease") and
                  r.get("published_at")]
    candidates.sort(key=lambda r: (when(r["published_at"]), int(r.get("id", 0))), reverse=True)
    keep, delete, occupied = [], [], set()
    reference_month = now.year * 12 + now.month

    for index, item in enumerate(candidates):
        date = when(item["published_at"])
        age = max(timedelta(0), now - date)
        keys = []
        if age < timedelta(days=7):
            keys.append(("day", date.date().isoformat()))
        if age < timedelta(days=28):
            week = date.isocalendar()
            keys.append(("week", week.year, week.week))
        if 0 <= reference_month - (date.year * 12 + date.month) < 12:
            keys.append(("month", date.year, date.month))
        protected = index < MIN_RECENT or any(key not in occupied for key in keys)
        if protected:
            keep.append(item)
            occupied.update(keys)
        else:
            delete.append(item)
    return keep, delete


def run(*args):
    return subprocess.check_output(["gh", *args], text=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--repository", required=True)
    parser.add_argument("--apply", action="store_true")
    parser.add_argument("--max-delete", type=int, default=MAX_DELETE)
    args = parser.parse_args()
    if not re.fullmatch(r"[\w.-]+/[\w.-]+", args.repository, flags=re.ASCII):
        raise ValueError("Unexpected repository identifier")
    if not 1 <= args.max_delete <= MAX_DELETE:
        raise ValueError("Max deletion batch must be 1..30")
    pages = json.loads(run("api", "--paginate", "--slurp",
                           f"repos/{args.repository}/releases?per_page=100"))
    releases = [r for page in pages for r in page]
    keep, delete = choose(releases)
    print(json.dumps({
        "mode": "apply" if args.apply else "dry-run",
        "eligible": len(keep) + len(delete),
        "keep": len(keep),
        "older_redundant": len(delete),
        "removing_now": min(len(delete), args.max_delete)
                         if args.apply and len(keep) >= MIN_RECENT else 0,
        "protected_newest": [r["tag_name"] for r in keep[:MIN_RECENT]],
    }, ensure_ascii=False), flush=True)
    # Conservative bootstrap: first 3 good backups are *never* removed.
    if not args.apply or len(keep) < MIN_RECENT:
        return
    for item in delete[:args.max_delete]:
        tag = item["tag_name"]
        print(f"Removing redundant SQLite Release {tag}", flush=True)
        subprocess.run(["gh", "release", "delete", tag,
                        "--repo", args.repository, "--yes", "--cleanup-tag"], check=True)


if __name__ == "__main__":
    try:
        main()
    except Exception as err:
        print(f"Retention failed: {err}", file=sys.stderr)
        sys.exit(1)
