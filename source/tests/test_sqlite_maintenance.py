"""Proteções do workflow de rotação e dos escritores sem serviços externos."""
from pathlib import Path
import importlib.util
import unittest

ROOT = Path(__file__).resolve().parent.parent
WORKFLOW = ROOT / ".github/workflows"
RETENTION = ROOT / "scripts/release-retention.py"
spec = importlib.util.spec_from_file_location("retention", RETENTION)
retention = importlib.util.module_from_spec(spec)
spec.loader.exec_module(retention)


class MaintenanceTests(unittest.TestCase):
    def test_all_sqlite_writers_share_one_lock_and_baseline(self):
        for name in ("deploy-gh-pages.yml", "sync-legislativo-recente.yml", "ai-enrichment.yml"):
            content = (WORKFLOW / name).read_text()
            self.assertIn("group: clean-v2-pages", content, name)
            self.assertIn("--baseline-tag", content, name)
            self.assertIn("steps.restore.outputs.previous_tag", content, name)
            self.assertIn("queue: max", content, name)

    def test_maintenance_requires_verified_snapshot_and_uses_shared_lock(self):
        source = (WORKFLOW / "sqlite-maintenance.yml").read_text()
        self.assertIn("group: clean-v2-pages", source)
        self.assertIn("sqlite-snapshot.py verify", source)
        self.assertIn("release-snapshot.py restore", source)
        self.assertIn("test -s", source)
        self.assertIn("public.sqlite.gz", source)
        self.assertIn("--apply --max-delete 30", source)
        self.assertIn("AUTO_APPLY:", source)
        self.assertIn("default: false", source)

    def test_same_day_backups_keep_three_newest(self):
        releases = [
            {"tag_name": f"rebuilt-v2-{i+100}-1", "id": i+100,
             "published_at": f"2026-10-24T04:{i:02d}:00Z", "draft": False, "prerelease": False}
            for i in range(16)
        ]
        keep, remove = retention.choose(releases)
        self.assertEqual(len(keep), 3)
        self.assertEqual(len(remove), 13)
        self.assertEqual({r["tag_name"] for r in keep},
                         {"rebuilt-v2-113-1", "rebuilt-v2-114-1", "rebuilt-v2-115-1"})


if __name__ == "__main__":
    unittest.main()
