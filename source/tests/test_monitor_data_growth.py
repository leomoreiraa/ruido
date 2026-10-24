import importlib.util
from pathlib import Path
import tempfile
import unittest

p = Path("scripts/monitor-data-growth.py")
spec = importlib.util.spec_from_file_location("monitor_growth", p)
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)


class MonitorGrowthTest(unittest.TestCase):
    def test_json_report_and_pages_limit(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            folder = root / "public/data/dossies"
            folder.mkdir(parents=True)
            (folder / "noticias.json").write_text('{"version":1,"dados":{}}')
            pages = root / "out"
            pages.mkdir()
            (pages / "index.html").write_text("RUÍDO")
            report = mod.audit(root, pages)
            self.assertEqual(report["json_bytes_total"], (folder / "noticias.json").stat().st_size)
            self.assertEqual(report["pages_bytes"], len("RUÍDO".encode()))
            old = mod.PAGES_HARD_LIMIT
            try:
                mod.PAGES_HARD_LIMIT = 1
                with self.assertRaises(ValueError):
                    mod.audit(root, pages)
            finally:
                mod.PAGES_HARD_LIMIT = old

    def test_big_json_warns_without_forcing_migration(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            folder = root / "public/data/dossies"
            folder.mkdir(parents=True)
            (folder / "finance.json").write_bytes(b"12345")
            old = mod.JSON_ALERT
            try:
                mod.JSON_ALERT = 4
                report = mod.audit(root)
                self.assertEqual(len(report["warnings"]), 1)
            finally:
                mod.JSON_ALERT = old


if __name__ == "__main__":
    unittest.main()
