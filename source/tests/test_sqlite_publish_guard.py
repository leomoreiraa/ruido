"""Falha fechada contra publicações de snapshots obsoletos."""
import importlib.util
from pathlib import Path
import json
import os
from types import SimpleNamespace
import tempfile
import unittest
from unittest.mock import patch

SCRIPT = Path(__file__).resolve().parent.parent / "scripts" / "release-snapshot.py"
spec = importlib.util.spec_from_file_location("release_snapshot", SCRIPT)
transport = importlib.util.module_from_spec(spec)
spec.loader.exec_module(transport)


def rel(tag, stamp="2026-10-24T03:00:00Z", draft=False):
    return {"tag_name": tag, "published_at": stamp, "id": 1 if tag.endswith("-1") else 2,
            "draft": draft, "prerelease": False}


class GuardTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.folder = Path(self.temp.name)
        self.folder.joinpath("public.sqlite").write_bytes(b"SQLite fake; validator mocked")
        self.folder.joinpath("manifest.json").write_text(
            json.dumps({"sha256": "new", "schema_sha256": "schema"}))
        self.baseline = self.folder / "baseline.json"
        self.baseline.write_text(json.dumps({"sha256": "previous", "schema_sha256": "schema"}))
        self.records = [rel("rebuilt-v2-100-1")]
        self.actions = []
        self.args = SimpleNamespace(repository="owner/repo", candidate=self.folder,
                                    tag="rebuilt-v2-101-1", commit="f" * 40,
                                    baseline_tag="rebuilt-v2-100-1",
                                    baseline_manifest=self.baseline)

    def gh(self, *args):
        self.actions.append(args)
        if args[0] == "api":
            return json.dumps([self.records])
        if args[:2] == ("release", "upload") and self.behavior == "inject":
            self.records.append(rel("rebuilt-v2-102-1", "2026-10-24T04:00:00Z"))
        return ""

    def perform_publish(self, mode="normal"):
        self.behavior = mode
        with patch.object(transport, "gh", side_effect=self.gh), \
             patch.object(transport, "validate"), \
             patch.object(transport, "pack", return_value=self.folder / "public.sqlite.gz"), \
             patch.dict(os.environ, {"GITHUB_OUTPUT": str(self.folder / "github-output")}, clear=False):
            transport.publish(self.args)

    def test_latest_matches_baseline_publishes_once(self):
        self.perform_publish()
        actions = [a[:2] for a in self.actions if a[0] == "release"]
        self.assertEqual(actions, [("release", "create"), ("release", "upload"), ("release", "edit")])
        self.assertIn("changed=true", (self.folder / "github-output").read_text())

    def test_stale_at_start_refuses_before_creating_draft(self):
        self.records.append(rel("rebuilt-v2-102-1", "2026-10-24T04:00:00Z"))
        with self.assertRaisesRegex(ValueError, "STALE_SNAPSHOT"):
            self.perform_publish()
        self.assertFalse(any(a[:2] == ("release", "create") for a in self.actions))

    def test_newer_release_appears_during_upload_stays_draft(self):
        with self.assertRaisesRegex(ValueError, "STALE_SNAPSHOT"):
            self.perform_publish("inject")
        self.assertIn(("release", "create"), [a[:2] for a in self.actions])
        self.assertNotIn(("release", "edit"), [a[:2] for a in self.actions])

    def test_unchanged_writes_no_release(self):
        self.folder.joinpath("manifest.json").write_text(
            json.dumps({"sha256": "previous", "schema_sha256": "schema"}))
        self.perform_publish()
        self.assertFalse(any(a[0] == "release" for a in self.actions))
        self.assertIn("changed=false", (self.folder / "github-output").read_text())

    def test_without_baseline_fails_closed(self):
        self.args.baseline_tag = None
        with self.assertRaisesRegex(ValueError, "baseline-tag"):
            self.perform_publish()
        self.assertFalse(any(a[0] == "release" for a in self.actions))

    def test_draft_is_not_considered_latest(self):
        self.records.append(rel("rebuilt-v2-102-1", "2026-10-24T04:00:00Z", draft=True))
        self.perform_publish()
        self.assertIn(("release", "edit"), [a[:2] for a in self.actions])


if __name__ == "__main__":
    unittest.main()
