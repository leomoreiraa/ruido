"""Isolated tests for sqlite snapshot integrity, history preservation, and release transport."""
import json
import gzip
import hashlib
from pathlib import Path
import sqlite3
import subprocess
import sys
import tempfile
import unittest

ROOT = Path(__file__).resolve().parent.parent
SNAPSHOT_SCRIPT = ROOT / "scripts" / "sqlite-snapshot.py"
RELEASE_SCRIPT = ROOT / "scripts" / "release-snapshot.py"

SCHEMA = """
CREATE TABLE Parlamentar (
    id TEXT PRIMARY KEY,
    externalId TEXT NOT NULL,
    casa TEXT NOT NULL,
    nome TEXT NOT NULL,
    partido TEXT NOT NULL,
    uf TEXT NOT NULL,
    ativo INTEGER NOT NULL DEFAULT 0,
    createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE Proposicao (
    id TEXT PRIMARY KEY,
    externalId TEXT NOT NULL,
    casa TEXT NOT NULL,
    siglaTipo TEXT NOT NULL,
    numero INTEGER NOT NULL,
    ano INTEGER NOT NULL,
    ementa TEXT NOT NULL,
    dataApresentacao DATETIME,
    createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE Votacao (
    id TEXT PRIMARY KEY,
    externalId TEXT NOT NULL,
    casa TEXT NOT NULL,
    dataHora DATETIME NOT NULL,
    descricao TEXT NOT NULL,
    proposicaoId TEXT,
    createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (proposicaoId) REFERENCES Proposicao(id) ON DELETE SET NULL
);
CREATE TABLE Voto (
    id TEXT PRIMARY KEY,
    votacaoId TEXT NOT NULL,
    parlamentarId TEXT NOT NULL,
    opcao TEXT NOT NULL,
    createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (votacaoId) REFERENCES Votacao(id) ON DELETE CASCADE,
    FOREIGN KEY (parlamentarId) REFERENCES Parlamentar(id) ON DELETE CASCADE
);
CREATE TABLE Presenca (
    id TEXT PRIMARY KEY,
    sessaoExternalId TEXT NOT NULL,
    casa TEXT NOT NULL,
    parlamentarId TEXT NOT NULL,
    dataSessao DATETIME NOT NULL,
    tituloSessao TEXT NOT NULL,
    status TEXT NOT NULL,
    createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (parlamentarId) REFERENCES Parlamentar(id) ON DELETE CASCADE
);
CREATE TABLE SyncLease (
    id TEXT PRIMARY KEY,
    holder TEXT NOT NULL,
    expiresAt DATETIME NOT NULL
);
CREATE TABLE SyncExecution (
    id TEXT PRIMARY KEY,
    iniciadoEm DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    finalizadoEm DATETIME,
    status TEXT NOT NULL,
    erro TEXT,
    parametros TEXT,
    resumo TEXT
);
"""

class TestSQLiteSnapshot(unittest.TestCase):
    def test_gzip_transport_backward_compatible_and_hash_checked(self):
        with tempfile.TemporaryDirectory() as tmp:
            folder = Path(tmp)
            db = folder / 'source.db'
            self.create_sample_db(db)
            candidate = folder / 'candidate'
            subprocess.run([sys.executable, '-I', str(SNAPSHOT_SCRIPT), 'create',
                            '--source', str(db), '--output-dir', str(candidate)], check=True)
            raw = candidate / 'public.sqlite'
            original_sha = hashlib.sha256(raw.read_bytes()).hexdigest()
            compressed = candidate / 'public.sqlite.gz'
            with gzip.open(compressed, 'wb', compresslevel=3) as dest:
                dest.write(raw.read_bytes())
            raw.unlink()
            result = subprocess.run([sys.executable, '-I', str(RELEASE_SCRIPT), 'unpack',
                                     '--work-dir', str(candidate)], capture_output=True, text=True)
            self.assertEqual(result.returncode, 0, msg=result.stderr)
            self.assertEqual(hashlib.sha256(raw.read_bytes()).hexdigest(), original_sha)
            result = subprocess.run([sys.executable, '-I', str(SNAPSHOT_SCRIPT), 'verify',
                                     '--database', str(raw),
                                     '--manifest', str(candidate / 'manifest.json')], capture_output=True)
            self.assertEqual(result.returncode, 0, msg=result.stderr)
            raw.unlink()
            compressed.write_bytes(b'corrupt gzip stream')
            failed = subprocess.run([sys.executable, '-I', str(RELEASE_SCRIPT), 'unpack',
                                     '--work-dir', str(candidate)], capture_output=True)
            self.assertNotEqual(failed.returncode, 0)
            self.assertFalse(raw.exists())

    def test_gzip_pack_reproducible(self):
        import importlib.util
        spec = importlib.util.spec_from_file_location('release_transport', RELEASE_SCRIPT)
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        with tempfile.TemporaryDirectory() as tmp:
            folder = Path(tmp)
            source = folder / 'raw.sqlite'
            source.write_bytes(b'12345' * 1000)
            module.pack(source, folder / 'a.gz')
            module.pack(source, folder / 'b.gz')
            self.assertEqual((folder / 'a.gz').read_bytes(), (folder / 'b.gz').read_bytes())


    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory(ignore_cleanup_errors=True)
        self.dir = Path(self.tmp.name)

    def tearDown(self):
        try:
            self.tmp.cleanup()
        except Exception:
            pass

    def create_sample_db(self, db_path, count=3):
        db = sqlite3.connect(db_path)
        try:
            db.executescript(SCHEMA)
            for i in range(1, count + 1):
                db.execute("INSERT INTO Parlamentar (id, externalId, casa, nome, partido, uf) VALUES (?, ?, 'CAMARA', ?, 'PART', 'UF')",
                           (f"p{i}", f"ext_p{i}", f"Deputado {i}"))
                db.execute("INSERT INTO Proposicao (id, externalId, casa, siglaTipo, numero, ano, ementa) VALUES (?, ?, 'CAMARA', 'PL', ?, 2024, 'Ementa')",
                           (f"prop{i}", f"ext_prop{i}", 1000 + i))
                db.execute("INSERT INTO Votacao (id, externalId, casa, dataHora, descricao, proposicaoId) VALUES (?, ?, 'CAMARA', '2024-03-01 10:00:00', 'Votacao', ?)",
                           (f"v{i}", f"ext_v{i}", f"prop{i}"))
                db.execute("INSERT INTO Voto (id, votacaoId, parlamentarId, opcao) VALUES (?, ?, ?, 'SIM')",
                           (f"voto{i}", f"v{i}", f"p{i}"))
                db.execute("INSERT INTO Presenca (id, sessaoExternalId, casa, parlamentarId, dataSessao, tituloSessao, status) VALUES (?, 'sess1', 'CAMARA', ?, '2024-03-01 09:00:00', 'Sessao', 'PRESENTE')",
                           (f"pres{i}", f"p{i}"))
            
            db.execute("INSERT INTO SyncLease (id, holder, expiresAt) VALUES ('GLOBAL', 'runner-1', '2099-01-01')")
            db.execute("INSERT INTO SyncExecution (id, status, erro, parametros, resumo) VALUES (?, 'SUCESSO', 'token_secret_leaked', ?, ?)",
                       ("history:v1:camara:2024-01",
                        json.dumps({"tipo": "historico-v1", "collectorRevision": 2, "fonte": "camara", "mes": "2024-01", "encerrada": True, "token": "leaked"}),
                        json.dumps({"votacoesSincronizadas": 10, "secret_field": "leak"})))
            db.execute("INSERT INTO SyncExecution (id, status, erro, parametros) VALUES ('cron-daily', 'ERRO', 'failed', 'some-params')")
            db.commit()
        finally:
            db.close()

    def test_snapshot_creation_sanitization_and_restoration(self):
        source = self.dir / "source.db"
        self.create_sample_db(source)

        out_dir = self.dir / "snap1"
        res = subprocess.run([sys.executable, "-I", str(SNAPSHOT_SCRIPT), "create",
                              "--source", str(source), "--output-dir", str(out_dir)],
                             capture_output=True, text=True)
        self.assertEqual(res.returncode, 0, msg=res.stderr)

        manifest_file = out_dir / "manifest.json"
        sqlite_file = out_dir / "public.sqlite"
        self.assertTrue(manifest_file.is_file())
        self.assertTrue(sqlite_file.is_file())

        
        snap_db = sqlite3.connect(sqlite_file)
        try:
            leases = snap_db.execute("SELECT COUNT(*) FROM SyncLease").fetchone()[0]
            self.assertEqual(leases, 0, "SyncLease rows must be deleted in public snapshot")

            execs = snap_db.execute("SELECT id, status, erro, parametros, resumo FROM SyncExecution").fetchall()
            self.assertEqual(len(execs), 1, "Only successful historical checkpoints retained")
            exec_id, status, erro, params_raw, resumo_raw = execs[0]
            self.assertEqual(exec_id, "history:v1:camara:2024-01")
            self.assertEqual(status, "SUCESSO")
            self.assertIsNone(erro, "Error field must be cleared")
            params = json.loads(params_raw)
            self.assertNotIn("token", params, "Non-whitelisted params key must be stripped")
            self.assertEqual(params.get("fonte"), "camara")
            self.assertEqual(params.get("collectorRevision"), 2, "Collector revision must survive sanitization")
            resumo = json.loads(resumo_raw)
            self.assertNotIn("secret_field", resumo, "Non-whitelisted resumo key must be stripped")
            self.assertEqual(resumo.get("votacoesSincronizadas"), 10)
        finally:
            snap_db.close()

        
        res_verify = subprocess.run([sys.executable, "-I", str(SNAPSHOT_SCRIPT), "verify",
                                     "--database", str(sqlite_file), "--manifest", str(manifest_file)],
                                    capture_output=True, text=True)
        self.assertEqual(res_verify.returncode, 0, msg=res_verify.stderr)

        
        dest = self.dir / "restored.db"
        res_restore = subprocess.run([sys.executable, "-I", str(SNAPSHOT_SCRIPT), "restore",
                                      "--database", str(sqlite_file), "--manifest", str(manifest_file),
                                      "--destination", str(dest)],
                                     capture_output=True, text=True)
        self.assertEqual(res_restore.returncode, 0, msg=res_restore.stderr)
        self.assertTrue(dest.is_file())

        
        res_refuse = subprocess.run([sys.executable, "-I", str(SNAPSHOT_SCRIPT), "restore",
                                     "--database", str(sqlite_file), "--manifest", str(manifest_file),
                                     "--destination", str(dest)],
                                    capture_output=True, text=True)
        self.assertNotEqual(res_refuse.returncode, 0)
        self.assertIn("Refusing to overwrite", res_refuse.stderr)

    def test_legacy_snapshot_manifest_is_rejected(self):
        source = self.dir / "source.db"
        self.create_sample_db(source)
        directory = self.dir / "clean"
        subprocess.run([sys.executable, "-I", str(SNAPSHOT_SCRIPT), "create",
                        "--source", str(source), "--output-dir", str(directory)], check=True)
        path = directory / "manifest.json"
        data = json.loads(path.read_text())
        self.assertEqual(data.get("generation"), "rebuilt-v2")
        del data["generation"]
        path.write_text(json.dumps(data))
        result = subprocess.run([sys.executable, "-I", str(SNAPSHOT_SCRIPT), "verify",
                                 "--database", str(directory / "public.sqlite"),
                                 "--manifest", str(path)], capture_output=True, text=True)
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("Legacy snapshot generation refused", result.stderr)

    def test_history_preservation_rejection_on_regression(self):
        source1 = self.dir / "source1.db"
        self.create_sample_db(source1, count=3)
        out_dir1 = self.dir / "snap1"
        subprocess.run([sys.executable, "-I", str(SNAPSHOT_SCRIPT), "create",
                        "--source", str(source1), "--output-dir", str(out_dir1)], check=True)

        
        source2 = self.dir / "source2.db"
        self.create_sample_db(source2, count=2)
        out_dir2 = self.dir / "snap2"
        res = subprocess.run([sys.executable, "-I", str(SNAPSHOT_SCRIPT), "create",
                              "--source", str(source2), "--output-dir", str(out_dir2),
                              "--previous", str(out_dir1 / "public.sqlite")],
                             capture_output=True, text=True)
        self.assertNotEqual(res.returncode, 0)
        self.assertIn("History shrank", res.stderr)

    def test_history_preservation_passes_on_growth(self):
        source1 = self.dir / "source1.db"
        self.create_sample_db(source1, count=3)
        out_dir1 = self.dir / "snap1"
        subprocess.run([sys.executable, "-I", str(SNAPSHOT_SCRIPT), "create",
                        "--source", str(source1), "--output-dir", str(out_dir1)], check=True)

        source2 = self.dir / "source2.db"
        self.create_sample_db(source2, count=4)
        out_dir2 = self.dir / "snap2"
        res = subprocess.run([sys.executable, "-I", str(SNAPSHOT_SCRIPT), "create",
                              "--source", str(source2), "--output-dir", str(out_dir2),
                              "--previous", str(out_dir1 / "public.sqlite")],
                             capture_output=True, text=True)
        self.assertEqual(res.returncode, 0, msg=res.stderr)


if __name__ == "__main__":
    unittest.main()
