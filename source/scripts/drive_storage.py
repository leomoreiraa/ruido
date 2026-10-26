#!/usr/bin/env python3
"""RUÍDO: storage management for app-owned files in a private Google Drive folder.

This transport is OPTIONAL. Existing GitHub Releases/Actions persistence is unchanged.
Only files created with the explicit ruido_storage=v1 marker are counted/deleted.
All sizes are decimal bytes: 5 GB ceiling, 80% cleanup, 65% cleanup target.
"""
from __future__ import annotations

import argparse
from datetime import datetime, timedelta, timezone
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
import sys
import time
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode, quote
from urllib.request import Request, build_opener, HTTPRedirectHandler
import zipfile
import gzip

LIMIT = 5_000_000_000
TRIGGER = 4_000_000_000
TARGET = 3_250_000_000
CHUNK = 8 * 1024 * 1024
KINDS = ("canonical", "historical", "news", "finance", "datajud", "official-ai", "ai", "backup")
DRIVE_URL = "https://www.googleapis.com/drive/v3"
UPLOAD_URL = "https://www.googleapis.com/upload/drive/v3"
TOKEN_URL = "https://oauth2.googleapis.com/token"
HEX = re.compile(r"^[0-9a-f]{64}$")


class StorageError(RuntimeError):
    pass


def timestamp(record):
    raw = record.get("appProperties", {}).get("ruido_seen") or record.get("createdTime")
    try:
        return datetime.fromisoformat(raw.replace("Z", "+00:00")).astimezone(timezone.utc)
    except (ValueError, AttributeError, TypeError):
        return datetime.min.replace(tzinfo=timezone.utc)


def sha256(path):
    h = hashlib.sha256()
    with Path(path).open("rb") as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b""):
            h.update(block)
    return h.hexdigest()


def kinds(record):
    raw = record.get("appProperties", {}).get("ruido_kinds", "")
    return set(raw.split(",")) & set(KINDS)


def managed(record):
    return record.get("appProperties", {}).get("ruido_storage") == "v1"


def normalized(records):
    result = []
    ids = set()
    for record in records:
        if not managed(record):
            continue
        ident = str(record.get("id", ""))
        if not ident or ident in ids:
            raise StorageError("Duplicated or missing managed Drive file ID")
        ids.add(ident)
        try:
            size = int(record["size"])
        except (KeyError, ValueError, TypeError) as exc:
            raise StorageError("Managed file without valid size") from exc
        if size < 0:
            raise StorageError("Negative file size")
        item = dict(record)
        item["size"] = size
        result.append(item)
    return result


def locked_ids(records):
    """Explicit pins and essential latest verified backups cannot be purged."""
    keep = {r["id"] for r in records
            if r.get("appProperties", {}).get("ruido_critical", "") != "false"
            or not HEX.fullmatch(r.get("appProperties", {}).get("ruido_sha256", ""))
            or r.get("sha256Checksum") not in (
                None, r.get("appProperties", {}).get("ruido_sha256"))}
    # Legacy managed objects without explicit critical=false are conservatively pinned.
    by_kind = {kind: sorted((r for r in records if kind in kinds(r)),
                            key=lambda r: (timestamp(r), r["id"]), reverse=True)
               for kind in KINDS}
    keep.update(r["id"] for r in by_kind["canonical"][:2])
    for kind in ("historical", "news", "finance", "datajud", "official-ai", "ai", "backup"):
        if by_kind[kind]:
            keep.add(by_kind[kind][0]["id"])
    return keep


def preference(records, now=None):
    """Prefer daily (7), weekly (4), monthly (3) restore points per kind."""
    now = now or datetime.now(timezone.utc)
    order = sorted(records, key=lambda r: (timestamp(r), r["id"]), reverse=True)
    chosen = set()
    for kind in KINDS:
        days, weeks, months = set(), set(), set()
        for item in order:
            if kind not in kinds(item):
                continue
            age = now - timestamp(item)
            if age < timedelta(0):
                age = timedelta(0)
            stamp = timestamp(item)
            week = stamp.isocalendar()
            month = (stamp.year, stamp.month)
            if age <= timedelta(days=7) and stamp.date() not in days:
                days.add(stamp.date())
                chosen.add(item["id"])
            if age <= timedelta(weeks=4) and (week.year, week.week) not in weeks:
                weeks.add((week.year, week.week))
                chosen.add(item["id"])
            if age <= timedelta(days=93) and month not in months:
                months.add(month)
                chosen.add(item["id"])
    return chosen


def cleanup_plan(records, incoming=0, now=None):
    """Return a deterministic, safe plan; never delete mandatory restore points."""
    records = normalized(records)
    if incoming < 0 or incoming > LIMIT:
        raise StorageError("Incoming object exceeds RUÍDO 5 GB budget")
    usage = sum(r["size"] for r in records)
    if usage + incoming < TRIGGER:
        return {"usage": usage, "deletions": [], "after": usage, "triggered": False}
    locked = locked_ids(records)
    preferred = preference(records, now)
    disposable = [r for r in records if r["id"] not in locked]
    # Delete duplicates/obsolete versions first, retained daily/weekly/monthly last.
    disposable.sort(key=lambda r: (r["id"] in preferred, timestamp(r), r["id"]))
    deletions = []
    remaining = usage
    desired = max(0, TARGET - incoming)
    for item in disposable:
        if remaining <= desired:
            break
        deletions.append(item)
        remaining -= item["size"]
    if remaining + incoming > LIMIT:
        raise StorageError(
            "Drive budget exceeded: critical/latest backups exhaust available space; "
            "refusing destructive cleanup and upload"
        )
    return {"usage": usage, "deletions": deletions, "after": remaining, "triggered": True,
            "target_reached": remaining <= desired}


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, request, fp, code, msg, headers, newurl):
        return None


class Drive:
    def __init__(self, access_token, folder_id, opener=None, sleep=time.sleep):
        if not access_token:
            raise StorageError("Missing Google Drive OAuth access token")
        if folder_id and not re.fullmatch(r"[A-Za-z0-9_-]{8,}", folder_id):
            raise StorageError("Invalid RUÍDO Drive folder ID")
        self.token = access_token
        self.folder = folder_id
        self.opener = opener or build_opener(NoRedirect)
        self.sleep = sleep

    def request(self, method, url, payload=None, headers=None, accepted=(200, 201, 204)):
        base_headers = {"Authorization": "Bearer " + self.token, "Accept": "application/json"}
        base_headers.update(headers or {})
        request = Request(url, data=payload, method=method, headers=base_headers)
        for attempt in range(5):
            try:
                with self.opener.open(request, timeout=120) as response:
                    status = response.status
                    data = response.read()
                    result_headers = dict(response.headers.items())
            except HTTPError as exc:
                status = exc.code
                data = exc.read(2048)
                result_headers = dict(exc.headers.items())
            except (URLError, TimeoutError) as exc:
                if attempt == 4:
                    raise StorageError("Google Drive unavailable after retries") from exc
                self.sleep(min(2 ** attempt, 16))
                continue
            if status in accepted:
                return status, result_headers, data
            reason = data.decode("utf-8", "replace")
            transient = status in (429, 500, 502, 503, 504) or (
                status == 403 and ("rateLimitExceeded" in reason or "userRateLimitExceeded" in reason))
            if transient and attempt != 4:
                self.sleep(min(2 ** attempt, 16))
                continue
            raise StorageError("Google Drive API HTTP " + str(status) + ": " + reason[:350])
        raise StorageError("Google Drive request failed")

    def json(self, method, url, data=None, accepted=(200, 201)):
        payload = json.dumps(data).encode("utf-8") if data is not None else None
        headers = {"Content-Type": "application/json"} if data is not None else {}
        _, _, raw = self.request(method, url, payload, headers, accepted)
        return json.loads(raw) if raw else {}

    def list_all(self):
        if not self.folder:
            raise StorageError("Set GOOGLE_DRIVE_FOLDER_ID")
        found, page_token = [], None
        while True:
            params = {
                "q": "'" + self.folder + "' in parents and trashed = false",
                "fields": "nextPageToken,files(id,name,size,sha256Checksum,createdTime,appProperties,mimeType,parents)",
                "pageSize": 1000,
                "spaces": "drive",
            }
            if page_token:
                params["pageToken"] = page_token
            data = self.json("GET", DRIVE_URL + "/files?" + urlencode(params))
            found += data.get("files", [])
            page_token = data.get("nextPageToken")
            if not page_token:
                return normalized(found)

    def metadata(self, file_id):
        fields = "id,size,sha256Checksum,appProperties,parents,trashed"
        return self.json("GET", DRIVE_URL + "/files/" + quote(file_id, safe="") + "?fields=" + fields)

    def patch(self, file_id, props):
        return self.json("PATCH", DRIVE_URL + "/files/" + quote(file_id, safe=""),
                         {"appProperties": props})

    def delete_checked(self, record):
        # A second read protects against changed pin/ownership/parents/bytes.
        current = self.metadata(record["id"])
        if not managed(current) or self.folder not in current.get("parents", []):
            raise StorageError("Refusing to delete file outside managed folder")
        if current.get("trashed") or current.get("appProperties", {}).get("ruido_critical") != "false":
            raise StorageError("Refusing to delete pinned/trashed file")
        if (current.get("sha256Checksum") not in (None, record.get("appProperties", {}).get("ruido_sha256")) or
                int(current.get("size", -1)) != record["size"] or
                current["appProperties"].get("ruido_sha256") !=
                record.get("appProperties", {}).get("ruido_sha256")):
            raise StorageError("Drive file changed since retention planning")
        self.request("DELETE", DRIVE_URL + "/files/" + quote(record["id"], safe=""),
                     accepted=(204,))

    def upload(self, path, name, props):
        path = Path(path)
        size = path.stat().st_size
        body = {"name": name, "mimeType": "application/octet-stream",
                "parents": [self.folder], "appProperties": props}
        status, headers, _ = self.request(
            "POST", UPLOAD_URL + "/files?uploadType=resumable&fields=id,name,size,sha256Checksum,appProperties",
            json.dumps(body).encode("utf-8"),
            {"Content-Type": "application/json; charset=UTF-8",
             "X-Upload-Content-Type": "application/octet-stream",
             "X-Upload-Content-Length": str(size)}
        )
        location = headers.get("Location") or headers.get("location")
        if not location or not location.startswith("https://www.googleapis.com/"):
            raise StorageError("Google Drive did not return a trusted resumable upload location")
        if not size:
            raise StorageError("Empty backup files are not accepted")
        with path.open("rb") as stream:
            position = 0
            while position < size:
                chunk = stream.read(min(CHUNK, size - position))
                end = position + len(chunk) - 1
                code, response_headers, response = self.request(
                    "PUT", location, chunk,
                    {"Content-Type": "application/octet-stream",
                     "Content-Range": f"bytes {position}-{end}/{size}"},
                    accepted=(200, 201, 308))
                if code in (200, 201):
                    item = json.loads(response)
                    if position + len(chunk) != size:
                        raise StorageError("Google Drive prematurely completed the upload")
                    return item
                acknowledged = response_headers.get("Range") or response_headers.get("range")
                if acknowledged != f"bytes=0-{end}":
                    raise StorageError("Upload checkpoint mismatch; refusing ambiguous retry")
                position = end + 1
        raise StorageError("Google Drive did not confirm uploaded file")

    def create_folder(self, name="RUÍDO — backups"):
        return self.json("POST", DRIVE_URL + "/files?fields=id,name",
                         {"name": name, "mimeType": "application/vnd.google-apps.folder",
                          "parents": ["root"]})


def authenticate(require_folder=True):
    variables = ("GOOGLE_DRIVE_CLIENT_ID", "GOOGLE_DRIVE_CLIENT_SECRET",
                 "GOOGLE_DRIVE_REFRESH_TOKEN")
    missing = [name for name in variables if not os.environ.get(name)]
    folder = os.environ.get("GOOGLE_DRIVE_FOLDER_ID")
    if require_folder and not folder:
        missing.append("GOOGLE_DRIVE_FOLDER_ID")
    if missing:
        raise StorageError("Google Drive authentication not configured: " + ", ".join(missing))
    body = urlencode({"client_id": os.environ[variables[0]],
                      "client_secret": os.environ[variables[1]],
                      "refresh_token": os.environ[variables[2]],
                      "grant_type": "refresh_token"}).encode()
    req = Request(TOKEN_URL, data=body, headers={"Content-Type": "application/x-www-form-urlencoded"})
    try:
        with build_opener(NoRedirect).open(req, timeout=30) as resp:
            token = json.load(resp)["access_token"]
    except (HTTPError, URLError, KeyError, TimeoutError) as exc:
        raise StorageError("Unable to obtain Google OAuth access token; check refresh token") from exc
    return Drive(token, folder)


def housekeeping(drive, incoming=0, apply=False):
    records = drive.list_all()
    plan = cleanup_plan(records, incoming)
    if apply:
        for record in plan["deletions"]:
            drive.delete_checked(record)
        # Verify post-delete usage; do not assume all API mutations succeeded.
        remaining = sum(r["size"] for r in drive.list_all())
        if remaining + incoming > LIMIT:
            raise StorageError("Concurrent Drive changes exhausted the storage budget")
    summary = {"limit": LIMIT, "trigger": TRIGGER, "target": TARGET,
               "usage_before": plan["usage"], "usage_after": plan["after"],
               "incoming": incoming, "triggered": plan["triggered"],
               "cleanup_candidates": len(plan["deletions"]),
               "deletion_applied": apply}
    return summary


def upload_managed(drive, path, kind, critical=False):
    path = Path(path)
    if not path.is_file() or path.is_symlink():
        raise StorageError("Backup must be a regular file")
    size = path.stat().st_size
    if size <= 0 or size > LIMIT:
        raise StorageError("Backup size outside permitted budget")
    digest = sha256(path)
    entries = drive.list_all()
    same = [f for f in entries if f["size"] == size and
            f.get("appProperties", {}).get("ruido_sha256") == digest and
            f.get("sha256Checksum") in (None, digest)]
    if same:
        entry = sorted(same, key=timestamp, reverse=True)[0]
        props = entry["appProperties"]
        merged = sorted(kinds(entry) | {kind})
        patch = {"ruido_kinds": ",".join(merged),
                 "ruido_seen": datetime.now(timezone.utc).isoformat()}
        if critical:
            patch["ruido_critical"] = "true"
        drive.patch(entry["id"], patch)
        return {"action": "deduplicated", "id": entry["id"], "sha256": digest,
                "bytes": size}
    if sum(e["size"] for e in entries) + size >= TRIGGER:
        housekeeping(drive, incoming=size, apply=True)
    elif sum(e["size"] for e in entries) + size > LIMIT:
        raise StorageError("5 GB budget reached")
    # Listing again also catches concurrent/previous uploads after cleanup.
    current = drive.list_all()
    if any(e["size"] == size and e.get("appProperties", {}).get("ruido_sha256") == digest
           and e.get("sha256Checksum") in (None, digest) for e in current):
        return upload_managed(drive, path, kind, critical=critical)
    if sum(e["size"] for e in current) + size > LIMIT:
        raise StorageError("5 GB cap would be exceeded; refusing upload")
    now = datetime.now(timezone.utc).isoformat()
    props = {"ruido_storage": "v1", "ruido_sha256": digest,
             "ruido_kinds": kind, "ruido_critical": "true" if critical else "false",
             "ruido_seen": now}
    file_name = f"ruido-{kind}-{digest[:20]}{path.suffix}"
    result = drive.upload(path, file_name, props)
    if result.get("sha256Checksum") not in (None, digest):
        raise StorageError("Drive returned a different SHA-256; refusing backup")
    if result.get("size") is not None and int(result["size"]) != size:
        raise StorageError("Drive confirmed wrong upload size")
    if not result.get("id"):
        raise StorageError("Drive upload without file ID")
    return {"action": "uploaded", "id": result["id"], "sha256": digest, "bytes": size}


def bundle(database, manifest, output):
    """Create one self-contained backup: either both files survive or neither."""
    database, manifest, output = map(Path, (database, manifest, output))
    if any(not f.is_file() or f.is_symlink() for f in (database, manifest)):
        raise StorageError("Snapshot SQLite/manifest absent or symlinked")
    script = Path(__file__).with_name("sqlite-snapshot.py")
    subprocess.run([sys.executable, "-I", str(script), "verify",
                    "--database", str(database), "--manifest", str(manifest)], check=True)
    payload = json.loads(manifest.read_text(encoding="utf-8"))
    if payload.get("sha256") != sha256(database):
        raise StorageError("Manifest database hash mismatch")
    output.parent.mkdir(parents=True, exist_ok=True)
    if output.exists():
        raise StorageError("Refusing to overwrite existing bundle")
    def entry(name, data):
        info = zipfile.ZipInfo(name, (2020, 1, 1, 0, 0, 0))
        info.compress_type = zipfile.ZIP_STORED
        return info, data
    with zipfile.ZipFile(output, "x") as archive:
        archive.writestr(*entry("manifest.json", manifest.read_bytes()))
        with database.open("rb") as source, archive.open(
                zipfile.ZipInfo("public.sqlite.gz", (2020, 1, 1, 0, 0, 0)), "w",
                force_zip64=True) as dst:
            # ZipInfo opened for writing defaults to STORE.
            with gzip.GzipFile(fileobj=dst, mode="wb", filename="", mtime=0, compresslevel=3) as gz:
                for block in iter(lambda: source.read(1024 * 1024), b""):
                    gz.write(block)
    return {"bundle": str(output), "sha256": sha256(output),
            "bytes": output.stat().st_size}


def main(argv=None, drive=None):
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest="command", required=True)
    sub.add_parser("init-folder")
    sub.add_parser("status")
    clean = sub.add_parser("cleanup")
    clean.add_argument("--apply", action="store_true")
    upload = sub.add_parser("upload")
    upload.add_argument("--file", required=True, type=Path)
    upload.add_argument("--kind", required=True, choices=KINDS)
    upload.add_argument("--critical", action="store_true")
    pack = sub.add_parser("bundle")
    pack.add_argument("--database", required=True, type=Path)
    pack.add_argument("--manifest", required=True, type=Path)
    pack.add_argument("--output", required=True, type=Path)
    args = parser.parse_args(argv)
    if args.command == "bundle":
        result = bundle(args.database, args.manifest, args.output)
    else:
        drive = drive or authenticate(require_folder=args.command != "init-folder")
        if args.command == "init-folder":
            result = drive.create_folder()
        elif args.command == "status":
            records = drive.list_all()
            result = {"files": len(records), "used_bytes": sum(r["size"] for r in records),
                      "limit_bytes": LIMIT, "cleanup_at_bytes": TRIGGER,
                      "critical_files": len(locked_ids(records))}
        elif args.command == "cleanup":
            result = housekeeping(drive, apply=args.apply)
        else:
            result = upload_managed(drive, args.file, args.kind, args.critical)
    print(json.dumps(result, ensure_ascii=False, sort_keys=True))
    return result


if __name__ == "__main__":
    try:
        main()
    except (StorageError, OSError, subprocess.CalledProcessError, ValueError) as exc:
        print("RUÍDO Drive storage: " + str(exc), file=sys.stderr)
        sys.exit(1)
