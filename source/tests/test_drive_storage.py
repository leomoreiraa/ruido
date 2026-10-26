"""Offline tests for RUÍDO optional Google Drive archival and bounded retention."""
from datetime import datetime, timedelta, timezone
import gzip
import importlib.util
import io
import json
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch
import zipfile

ROOT = Path(__file__).resolve().parent.parent
spec = importlib.util.spec_from_file_location("ruido_drive", ROOT / "scripts" / "drive_storage.py")
drive_storage = importlib.util.module_from_spec(spec)
spec.loader.exec_module(drive_storage)


def entry(i, size, kind="canonical", ago=0, critical="false", digest=None):
    date = datetime(2026, 10, 26, tzinfo=timezone.utc) - timedelta(days=ago)
    return {
        "id": f"drivefile{i}", "size": size, "createdTime": date.isoformat(),
        "parents": ["folder12345678"],
        "appProperties": {
            "ruido_storage": "v1", "ruido_sha256": digest or ("%064x" % (i + 1)),
            "ruido_kinds": kind, "ruido_critical": critical,
            "ruido_seen": date.isoformat(),
        },
    }


NOW = datetime(2026, 10, 26, tzinfo=timezone.utc)


class FakeDrive:
    def __init__(self, files=None):
        self.files = list(files or [])
        self.deleted = []
        self.uploaded = []
        self.patched = []
        self.folder = "folder12345678"

    def list_all(self):
        return drive_storage.normalized(self.files)

    def delete_checked(self, item):
        current = next(x for x in self.files if x["id"] == item["id"])
        if current["appProperties"].get("ruido_critical") != "false":
            raise drive_storage.StorageError("File is pinned")
        self.files = [f for f in self.files if f["id"] != item["id"]]
        self.deleted.append(item["id"])

    def patch(self, file_id, props):
        self.patched.append((file_id, props))
        item = next(f for f in self.files if f["id"] == file_id)
        item["appProperties"].update(props)

    def upload(self, file, name, props):
        index = 1000 + len(self.uploaded)
        size = Path(file).stat().st_size
        record = entry(index, size, kind=props["ruido_kinds"], digest=props["ruido_sha256"],
                       critical=props["ruido_critical"])
        record["appProperties"] = props
        self.files.append(record)
        self.uploaded.append(name)
        return {"id": record["id"], "size": str(size)}


class StoragePolicyTests(unittest.TestCase):
    def test_cap_and_cleanup_threshold_are_decimal(self):
        self.assertEqual(drive_storage.LIMIT, 5_000_000_000)
        self.assertEqual(drive_storage.TRIGGER, 4_000_000_000)
        self.assertEqual(drive_storage.TARGET, 3_250_000_000)

    def test_only_managed_files_are_counted(self):
        outside = entry(9, 4_500_000_000)
        outside["appProperties"] = {}
        plan = drive_storage.cleanup_plan([outside, entry(1, 200_000_000)], now=NOW)
        self.assertFalse(plan["triggered"])
        self.assertEqual(plan["usage"], 200_000_000)

    def test_no_cleanup_before_eighty_percent(self):
        items = [entry(i, 100_000_000, ago=i) for i in range(12)]
        result = drive_storage.cleanup_plan(items, now=NOW)
        self.assertFalse(result["triggered"])
        self.assertEqual(result["deletions"], [])

    def test_prune_when_eighty_percent_reached(self):
        items = [entry(i, 200_000_000, ago=i) for i in range(23)]
        result = drive_storage.cleanup_plan(items, now=NOW)
        self.assertTrue(result["triggered"])
        self.assertGreater(len(result["deletions"]), 0)
        self.assertLessEqual(result["after"], drive_storage.TARGET)
        self.assertNotIn("drivefile0", {x["id"] for x in result["deletions"]})
        self.assertNotIn("drivefile1", {x["id"] for x in result["deletions"]})

    def test_latest_two_canonical_and_critical_pinned(self):
        rows = [entry(i, 550_000_000, ago=i) for i in range(9)]
        rows[-1]["appProperties"]["ruido_critical"] = "true"
        result = drive_storage.cleanup_plan(rows, now=NOW)
        deleted = {x["id"] for x in result["deletions"]}
        self.assertNotIn("drivefile0", deleted)
        self.assertNotIn("drivefile1", deleted)
        self.assertNotIn("drivefile8", deleted)

    def test_malformed_or_changed_checksums_are_never_deleted(self):
        rows = [entry(i, 800_000_000, ago=i) for i in range(6)]
        rows[4]["appProperties"]["ruido_sha256"] = "invalid"
        rows[5]["sha256Checksum"] = "f" * 64
        result = drive_storage.cleanup_plan(rows, now=NOW)
        ids = {item["id"] for item in result["deletions"]}
        self.assertNotIn(rows[4]["id"], ids)
        self.assertNotIn(rows[5]["id"], ids)

    def test_latest_per_collector_is_protected(self):
        rows = [entry(i, 490_000_000, kind=("news" if i % 2 else "finance"), ago=i)
                for i in range(9)]
        result = drive_storage.cleanup_plan(rows, now=NOW)
        deleted = {x["id"] for x in result["deletions"]}
        self.assertNotIn("drivefile0", deleted)
        self.assertNotIn("drivefile1", deleted)

    def test_fail_closed_when_critical_files_consume_budget(self):
        rows = [entry(i, 1_200_000_000, critical="true", ago=i) for i in range(4)]
        with self.assertRaisesRegex(drive_storage.StorageError, "critical/latest"):
            drive_storage.cleanup_plan(rows, incoming=500_000_000, now=NOW)

    def test_refuse_a_single_over_cap_file(self):
        with self.assertRaisesRegex(drive_storage.StorageError, "exceeds"):
            drive_storage.cleanup_plan([], incoming=drive_storage.LIMIT + 1)

    def test_unknown_critical_marker_is_protected(self):
        rows = [entry(i, 900_000_000, ago=i) for i in range(5)]
        rows[-1]["appProperties"].pop("ruido_critical")
        result = drive_storage.cleanup_plan(rows, now=NOW)
        self.assertNotIn(rows[-1]["id"], {x["id"] for x in result["deletions"]})

    def test_duplicate_sha_reuses_file_and_updates_critical(self):
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / "sample.json"
            path.write_text('{"ok":true}', encoding="utf-8")
            current = entry(11, path.stat().st_size, kind="news",
                            digest=drive_storage.sha256(path))
            mock = FakeDrive([current])
            result = drive_storage.upload_managed(mock, path, "official-ai", critical=True)
            self.assertEqual(result["action"], "deduplicated")
            self.assertEqual(len(mock.uploaded), 0)
            self.assertEqual(len(mock.patched), 1)
            self.assertEqual(current["appProperties"]["ruido_critical"], "true")
            self.assertEqual(current["appProperties"]["ruido_kinds"], "news,official-ai")

    def test_upload_creates_metadata_and_sha(self):
        with tempfile.TemporaryDirectory() as folder:
            file = Path(folder) / "good.json"
            file.write_bytes(b'{"version":1}')
            mock = FakeDrive()
            result = drive_storage.upload_managed(mock, file, "news")
            self.assertEqual(result["action"], "uploaded")
            self.assertEqual(result["sha256"], drive_storage.sha256(file))
            self.assertEqual(len(mock.uploaded), 1)
            self.assertEqual(mock.files[0]["appProperties"]["ruido_storage"], "v1")

    def test_upload_checks_space_before_mutating_files(self):
        with tempfile.TemporaryDirectory() as folder:
            file = Path(folder) / "new.bin"
            file.write_bytes(b"a" * 1024)
            mock = FakeDrive([entry(i, 1_200_000_000, critical="true") for i in range(4)])
            result = drive_storage.upload_managed(mock, file, "canonical")
            self.assertEqual(result["action"], "uploaded")
            self.assertEqual(len(mock.deleted), 0)
            # 4.8 GB still fits a small backup; no critical file may be removed.
            self.assertLess(sum(x["size"] for x in mock.files), drive_storage.LIMIT)

    def test_housekeeping_dry_run_has_no_deletions(self):
        mock = FakeDrive([entry(i, 220_000_000, ago=i) for i in range(21)])
        report = drive_storage.housekeeping(mock, apply=False)
        self.assertTrue(report["triggered"])
        self.assertGreater(report["cleanup_candidates"], 0)
        self.assertEqual(mock.deleted, [])

    def test_housekeeping_apply_removes_only_planned(self):
        mock = FakeDrive([entry(i, 220_000_000, ago=i) for i in range(21)])
        expected = drive_storage.cleanup_plan(mock.list_all())["deletions"]
        report = drive_storage.housekeeping(mock, apply=True)
        self.assertEqual(set(mock.deleted), {item["id"] for item in expected})
        self.assertTrue(report["deletion_applied"])

    def test_bundle_is_deterministic_and_contains_both_verified_parts(self):
        fixture_spec = importlib.util.spec_from_file_location(
            "sample_snapshot", ROOT / "tests" / "sqlite-snapshot.test.py")
        fixture = importlib.util.module_from_spec(fixture_spec)
        fixture_spec.loader.exec_module(fixture)
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            source = root / "source.db"
            fixture.TestSQLiteSnapshot.create_sample_db(None, source, 2)
            candidate = root / "snapshot"
            subprocess.run([sys.executable, "-I", str(ROOT / "scripts" / "sqlite-snapshot.py"),
                            "create", "--source", str(source), "--output-dir", str(candidate)],
                           check=True, capture_output=True)
            one, two = root / "one.zip", root / "two.zip"
            for output in (one, two):
                drive_storage.bundle(candidate / "public.sqlite", candidate / "manifest.json", output)
            self.assertEqual(drive_storage.sha256(one), drive_storage.sha256(two))
            with zipfile.ZipFile(one) as archive:
                self.assertEqual(archive.namelist(), ["manifest.json", "public.sqlite.gz"])
                self.assertEqual(gzip.decompress(archive.read("public.sqlite.gz")),
                                 (candidate / "public.sqlite").read_bytes())
                self.assertEqual(archive.read("manifest.json"),
                                 (candidate / "manifest.json").read_bytes())

    def test_bundle_rejects_corruption(self):
        with tempfile.TemporaryDirectory() as directory:
            folder = Path(directory)
            (folder / "data.db").write_bytes(b"broken")
            (folder / "manifest.json").write_text('{"sha256":"wrong"}')
            with self.assertRaises(subprocess.CalledProcessError):
                drive_storage.bundle(folder / "data.db", folder / "manifest.json",
                                     folder / "bad.zip")

    def test_delete_rechecks_drive_ownership_and_pin(self):
        item = entry(20, 300_000_000)
        drive = drive_storage.Drive("fake-access-token", "folder12345678")
        called = []
        drive.request = lambda *a, **k: called.append(a)
        drive.metadata = lambda file_id: {
            "id": file_id, "size": str(item["size"]), "parents": ["otherfolder987"],
            "appProperties": dict(item["appProperties"]),
        }
        with self.assertRaisesRegex(drive_storage.StorageError, "outside managed folder"):
            drive.delete_checked(item)
        self.assertEqual(called, [])
        drive.metadata = lambda file_id: {
            "id": file_id, "size": str(item["size"]), "parents": ["folder12345678"],
            "appProperties": {**item["appProperties"], "ruido_critical": "true"},
        }
        with self.assertRaisesRegex(drive_storage.StorageError, "pinned"):
            drive.delete_checked(item)
        self.assertEqual(called, [])

    def test_delete_rechecks_sha_and_size(self):
        item = entry(21, 300_000_000)
        drive = drive_storage.Drive("fake-access-token", "folder12345678")
        drive.metadata = lambda file_id: {
            "id": file_id, "size": str(item["size"]), "parents": ["folder12345678"],
            "appProperties": {**item["appProperties"], "ruido_sha256": "f" * 64},
        }
        with self.assertRaisesRegex(drive_storage.StorageError, "changed"):
            drive.delete_checked(item)

    def test_duplicate_file_outside_managed_scope_is_never_reused(self):
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / "file.json"
            path.write_bytes(b"data")
            foreign = entry(15, 4, kind="news", digest=drive_storage.sha256(path))
            foreign["appProperties"].pop("ruido_storage")
            mock = FakeDrive([foreign])
            result = drive_storage.upload_managed(mock, path, "news")
            self.assertEqual(result["action"], "uploaded")
            self.assertEqual(len(mock.uploaded), 1)
            self.assertEqual(len(mock.files), 2)

    def test_no_credential_required_for_offline_policy(self):
        with patch.dict("os.environ", {}, clear=True):
            result = drive_storage.cleanup_plan([])
        self.assertFalse(result["triggered"])


if __name__ == "__main__":
    unittest.main()
