#!/usr/bin/env python3
"""Regression tests for the allowlisted RUÍDO static-publication boundary."""
import runpy
import tempfile
import unittest
from pathlib import Path

AUDIT = runpy.run_path("scripts/audit-public-export.py")["audit"]

class StaticExportAuditTest(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.root = Path(self.temporary.name)
        for name in ["index.html", "mapa/index.html", "data/pautas-index.json"]:
            file = self.root / name
            file.parent.mkdir(parents=True, exist_ok=True)
            file.write_text("<html>safe</html>" if name.endswith(".html") else "[]")
        nextdir = self.root / "_next/static"
        nextdir.mkdir(parents=True)
        for i in range(10):
            (nextdir / f"chunk-{i}.js").write_text("console.log('safe');")
        (self.root / ".nojekyll").write_text("")
        (self.root / "CNAME").write_text("ruido.runs-at.dev\n")

    def test_clean_public_export(self):
        count, _ = AUDIT(self.root)
        self.assertGreaterEqual(count, 10)

    def test_env_file_is_rejected(self):
        (self.root / ".env.production").write_text("SECRET=something")
        with self.assertRaisesRegex(ValueError, "Private filename"):
            AUDIT(self.root)

    def test_valid_compressed_history_is_allowed(self):
        file = self.root / "data/historico/profile-123.json.gz"
        file.parent.mkdir(parents=True, exist_ok=True)
        file.write_bytes(b"compressed-public-data")
        self.assertGreaterEqual(AUDIT(self.root)[0], 10)

    def test_arbitrary_compressed_database_is_rejected(self):
        file = self.root / "data/checkpoint.sqlite.gz"
        file.parent.mkdir(parents=True, exist_ok=True)
        file.write_bytes(b"private")
        with self.assertRaisesRegex(ValueError, "Unapproved file extension"):
            AUDIT(self.root)

    def test_sqlite_snapshot_is_rejected(self):
        (self.root / "snapshot.sqlite").write_bytes(b"SQLite format 3")
        with self.assertRaisesRegex(ValueError, "Unapproved file extension"):
            AUDIT(self.root)

    def test_nextjs_browser_chunk_app_directory_is_allowed(self):
        # The Next.js export includes _next/static/chunks/app by design.
        f = self.root / "_next/static/chunks/app/page-abc.js"
        f.parent.mkdir(parents=True, exist_ok=True)
        f.write_text("console.log('public client chunk')")
        self.assertGreaterEqual(AUDIT(self.root)[0], 10)

    def test_private_app_source_root_is_rejected(self):
        f = self.root / "app/api/private/route.js"
        f.parent.mkdir(parents=True, exist_ok=True)
        f.write_text("server-only source")
        with self.assertRaisesRegex(ValueError, "Private directory"):
            AUDIT(self.root)

    def test_operational_workflow_is_rejected(self):
        f = self.root / ".github/workflows/secret.yml"
        f.parent.mkdir(parents=True)
        f.write_text("name: private")
        with self.assertRaisesRegex(ValueError, "Private directory"):
            AUDIT(self.root)

    def test_credential_embedded_in_html_is_rejected(self):
        (self.root / "index.html").write_text("before github_pat_" + "A"*35 + " after")
        with self.assertRaisesRegex(ValueError, "GitHub token"):
            AUDIT(self.root)

    def test_source_map_is_rejected(self):
        (self.root / "_next/static/chunk.js.map").write_text('{"sources":["src/private.ts"]}')
        with self.assertRaisesRegex(ValueError, "Unapproved file extension"):
            AUDIT(self.root)

if __name__ == "__main__":
    unittest.main()
