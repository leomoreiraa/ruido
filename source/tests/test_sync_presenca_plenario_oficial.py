import importlib.util
import json
import sqlite3
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path


SCRIPT = Path("scripts/sync-presenca-plenario-oficial.py")
spec = importlib.util.spec_from_file_location("sync_presenca_plenario_oficial", SCRIPT)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


def preparar_banco(path):
    db = sqlite3.connect(path)
    db.execute("""CREATE TABLE FrequenciaPlenario (
        parlamentarId TEXT, dia TEXT, presentes INTEGER, ausentes INTEGER,
        justificadas INTEGER, sessoesAuditadas INTEGER, casa TEXT, fonteUrl TEXT
    )""")
    origem = "https://www.camara.leg.br/SitCamaraWS/sessoesreunioes.asmx/ListarPresencasDia?data=01/10/2026"
    for dia, status in [("2026-10-01", (1, 0, 0)), ("2026-10-02", (0, 1, 0)), ("2026-10-03", (0, 0, 1))]:
        db.execute("INSERT INTO FrequenciaPlenario VALUES (?,?,?,?,?,?,?,?)",
                   ("deputado-a", dia, *status, 1, "CAMARA", origem))
    for dia in ("2026-10-01", "2026-10-02"):
        db.execute("INSERT INTO FrequenciaPlenario VALUES (?,?,?,?,?,?,?,?)",
                   ("deputado-b", dia, 1, 0, 0, 1, "CAMARA", origem))
    db.execute("INSERT INTO FrequenciaPlenario VALUES (?,?,?,?,?,?,?,?)",
               ("deputado-a", "2026-10-04", 1, 0, 0, 0, "CAMARA", origem))
    db.execute("INSERT INTO FrequenciaPlenario VALUES (?,?,?,?,?,?,?,?)",
               ("deputado-a", "2026-10-05", 1, 0, 0, 1, "CAMARA", "https://outra-fonte.invalid"))
    db.commit()
    return db


class TestExportacaoPresencaOficial(unittest.TestCase):
    def test_exportar_com_row_factory_padrao_nao_inventa_dados(self):
        with tempfile.TemporaryDirectory() as pasta:
            caminho = Path(pasta) / "presenca.db"
            saida = Path(pasta) / "saida.json"
            db = preparar_banco(caminho)
            self.assertIsNone(db.row_factory)
            try:
                self.assertEqual(module.exportar(db, saida), 1)
            finally:
                db.close()
            dados = json.loads(saida.read_text(encoding="utf-8"))
            self.assertEqual(dados["metodo"], "DIAS_SESSAO_PLENARIO_CAMARA")
            self.assertEqual(set(dados["dados"]), {"deputado-a"})
            self.assertEqual(dados["dados"]["deputado-a"]["sessoes"], 3)
            self.assertEqual(dados["dados"]["deputado-a"]["presentes"], 1)
            self.assertEqual(dados["dados"]["deputado-a"]["ausentes"], 1)
            self.assertEqual(dados["dados"]["deputado-a"]["justificadas"], 1)

    def test_modo_export_only_nao_exige_consulta_externa(self):
        with tempfile.TemporaryDirectory() as pasta:
            caminho = Path(pasta) / "presenca.db"
            saida = Path(pasta) / "export-only.json"
            preparar_banco(caminho).close()
            processo = subprocess.run(
                [sys.executable, "-I", str(SCRIPT), "--database", str(caminho),
                 "--output", str(saida), "--export-only"],
                capture_output=True, text=True, check=True, timeout=20
            )
            self.assertEqual(json.loads(processo.stdout)["perfis_exportados"], 1)
            self.assertEqual(len(json.loads(saida.read_text(encoding="utf-8"))["dados"]), 1)


if __name__ == "__main__":
    unittest.main()
