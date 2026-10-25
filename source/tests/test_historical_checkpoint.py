"""Regression tests for the artifact-quota-free historical checkpoint transport."""
import importlib.util
from pathlib import Path
import shutil
import sqlite3
import subprocess
import sys
import tempfile
import unittest
from types import SimpleNamespace
from unittest.mock import patch

ROOT = Path(__file__).resolve().parent.parent
SCRIPT = ROOT / "scripts" / "historical-checkpoint.py"
spec = importlib.util.spec_from_file_location("historical_checkpoint", SCRIPT)
checkpoint = importlib.util.module_from_spec(spec)
spec.loader.exec_module(checkpoint)

fixture_spec = importlib.util.spec_from_file_location("snapshot_fixture", ROOT / "tests" / "sqlite-snapshot.test.py")
fixture = importlib.util.module_from_spec(fixture_spec)
fixture_spec.loader.exec_module(fixture)


def release(tag, published, *, prerelease=True, draft=False, id=1):
    return {"tag_name": tag, "published_at": published, "prerelease": prerelease,
            "draft": draft, "id": id}


class HistoricalCheckpointTests(unittest.TestCase):
    def test_only_newer_verified_progress_is_restorable(self):
        rows = [
            release("rebuilt-v2-progress-50-1-camara", "2026-10-25T09:00:00Z", id=1),
            release("rebuilt-v2-progress-50-1-senado", "2026-10-25T10:00:00Z", id=2),
            release("rebuilt-v2-progress-50-1-final", "2026-10-25T11:00:00Z", draft=True, id=3),
            release("rebuilt-v2-50-1", "2026-10-25T12:00:00Z", prerelease=False, id=4),
            release("ruido-ai-projects-partial-50-1", "2026-10-25T12:00:00Z", id=5),
        ]
        selected = checkpoint.candidates(rows, "2026-10-25T09:30:00Z")
        self.assertEqual([r["tag_name"] for r in selected], ["rebuilt-v2-progress-50-1-senado"])
        self.assertEqual(checkpoint.candidates(rows, "2026-10-25T12:30:00Z"), [])

    def test_cleanup_only_when_canonical_is_newer(self):
        rows = [
            release("rebuilt-v2-70-1", "2026-10-25T11:00:00Z", prerelease=False, id=10),
            release("rebuilt-v2-progress-68-1-camara", "2026-10-25T10:00:00Z", id=11),
            release("rebuilt-v2-progress-72-1-senado", "2026-10-25T12:00:00Z", id=12),
            release("rebuilt-v2-progress-68-1-final", "2026-10-25T10:30:00Z", draft=True, id=13),
        ]
        deleted = []
        with patch.object(checkpoint, "releases", return_value=rows), patch.object(
            checkpoint, "gh", side_effect=lambda *args: deleted.append(args)
        ):
            checkpoint.cleanup(SimpleNamespace(repository="owner/repo", max_delete=20))
        self.assertEqual(len(deleted), 1)
        self.assertEqual(deleted[0][2], "rebuilt-v2-progress-68-1-camara")

    def test_cleanup_refuses_missing_canonical(self):
        with patch.object(checkpoint, "releases", return_value=[]):
            with self.assertRaisesRegex(ValueError, "No canonical Release"):
                checkpoint.cleanup(SimpleNamespace(repository="owner/repo", max_delete=20))

    def test_restoration_validates_and_never_shrinks_history(self):
        with tempfile.TemporaryDirectory() as tmp:
            folder = Path(tmp)
            snaps = []
            for count in (3, 4, 2):
                source = folder / f"source-{count}.sqlite"
                fixture.TestSQLiteSnapshot.create_sample_db(None, source, count)
                candidate = folder / f"snapshot-{count}"
                subprocess.run([sys.executable, "-I", str(ROOT / "scripts" / "sqlite-snapshot.py"),
                                "create", "--source", str(source), "--output-dir", str(candidate)],
                               check=True, capture_output=True)
                subprocess.run([sys.executable, "-I", str(ROOT / "scripts" / "release-snapshot.py"),
                                "pack", "--work-dir", str(candidate)], check=True, capture_output=True)
                snaps.append(candidate)
            target = folder / "current.sqlite"
            shutil.copyfile(snaps[0] / "public.sqlite", target)
            row = release("rebuilt-v2-progress-99-1-senado", "2026-10-25T12:00:00Z")

            def download(candidate):
                def mock_gh(*args):
                    if args[:2] == ("release", "download"):
                        output = Path(args[args.index("--dir") + 1])
                        shutil.copyfile(candidate / "public.sqlite.gz", output / "public.sqlite.gz")
                        shutil.copyfile(candidate / "manifest.json", output / "manifest.json")
                    else:
                        raise AssertionError(f"Unexpected gh command: {args}")
                    return ""
                return mock_gh

            real_run_script = checkpoint.run_script
            def verify_fixture(script, *args):
                if script == "verify-rebuilt.py":
                    return None  # Minimal fixture has no deployment-only tables/columns.
                return real_run_script(script, *args)
            with patch.object(checkpoint, "run_script", side_effect=verify_fixture), patch.object(
                checkpoint, "releases", return_value=[row]
            ), patch.object(checkpoint, "gh", side_effect=download(snaps[1])):
                checkpoint.restore(SimpleNamespace(repository="owner/repo", destination=target,
                    work_dir=folder / "recover-good", since="2026-10-25T10:00:00Z"))
            with sqlite3.connect(target) as db:
                self.assertEqual(db.execute("SELECT COUNT(*) FROM Parlamentar").fetchone()[0], 4)
            original = target.read_bytes()
            with patch.object(checkpoint, "run_script", side_effect=verify_fixture), patch.object(
                checkpoint, "releases", return_value=[row]
            ), patch.object(checkpoint, "gh", side_effect=download(snaps[2])):
                with self.assertRaisesRegex(ValueError, "History shrank"):
                    checkpoint.restore(SimpleNamespace(repository="owner/repo", destination=target,
                        work_dir=folder / "recover-bad", since="2026-10-25T10:00:00Z"))
            self.assertEqual(target.read_bytes(), original)


if __name__ == "__main__":
    unittest.main()
