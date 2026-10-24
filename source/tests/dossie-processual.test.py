#!/usr/bin/env python3
"""Fixtures sintéticas sem dados pessoais: guardas do leitor TSE."""
import importlib.util
import io
import tempfile
import unittest
import zipfile
from pathlib import Path

SCRIPT = Path(__file__).resolve().parent.parent / "scripts" / "refresh-dossiers-judicial.py"
spec = importlib.util.spec_from_file_location("dossie_processual", SCRIPT)
assert spec and spec.loader
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)

class LeitorProcessualTests(unittest.TestCase):
    def fixture(self, csv_content):
        buffer=io.BytesIO()
        with zipfile.ZipFile(buffer,"w") as z:
            z.writestr("processos_eleitorais_partes_2026_BRASIL.csv",csv_content.encode("latin-1"))
        return buffer.getvalue()

    def test_header_and_rows_streamed(self):
        raw=self.fixture('NR_PROCESSO;SQ_CANDIDATO;SG_UF_TRIBUNAL;NM_PARTE;DS_POLO\n"00000001202660000001";"321";"SP";"JOAO EXEMPLO";"Requerido"\n')
        rows=list(module.iterate_zip(raw,{"NRPROCESSO","NUMEROPROCESSO"}))
        self.assertEqual(len(rows),1)
        self.assertEqual(rows[0]["SQCANDIDATO"],"321")
        self.assertEqual(rows[0]["SGUFTRIBUNAL"],"SP")
        self.assertEqual(rows[0]["DSPOLO"],"Requerido")
        self.assertEqual(rows[0]["NMPARTE"],"JOAO EXEMPLO")

    def test_missing_source_key_means_no_rows(self):
        raw=self.fixture("COLUNA;VALOR\nX;1\n")
        self.assertEqual(list(module.iterate_zip(raw,{"NRPROCESSO","NUMEROPROCESSO"})),[])

    def test_names_and_document_numbers_are_normalized(self):
        self.assertEqual(module.normal("João  Éxemplo"),"JOAO EXEMPLO")
        self.assertEqual(module.clean_number("0000.0001-2026.6.00.0000"),"0000000120266000000")

if __name__=="__main__":
    unittest.main()
