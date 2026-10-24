import importlib.util
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
import urllib.error

spec=importlib.util.spec_from_file_location("datajud",Path("scripts/refresh-dossiers-datajud.py"))
m=importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)

CNJ="00000000000006190000"

class DataJudCheckpointTests(unittest.TestCase):
    def test_retry_resumes_exact_process_and_never_infers_guilt(self):
        self.assertEqual(m.tribunal_do_processo(CNJ),"tre-rj")
        with tempfile.TemporaryDirectory() as folder:
            src=Path(folder)/"tse.json"
            dst=Path(folder)/"datajud.json"
            src.write_text(json.dumps({"dados":{"parlamentar-id":[{
                "numeroProcesso":CNJ,"situacao":"PARTE_PROCESSUAL_ELEITORAL",
                "fonte":"https://cdn.tse.jus.br/teste","conferidoEm":"2026-10-23"}]}}))
            with patch.object(m,"SOURCE",src),patch.object(m,"TARGET",dst),\
                 patch.object(m,"obter_chave",return_value="credencial"),\
                 patch.object(m,"consultar",side_effect=urllib.error.HTTPError(
                     "https://api-publica.datajud.cnj.jus.br",429,"Quota",{},None)):
                m.main()
            first=json.loads(dst.read_text())
            self.assertNotIn("parlamentar-id",first["dados"])
            self.assertIn(CNJ,first["pendentes"])
            self.assertEqual(first["cobertura"]["estado"],"PARCIAL")
            first["pendentes"][CNJ]["proximaTentativaEm"]="2020-01-01T00:00:00+00:00"
            dst.write_text(json.dumps(first))
            with patch.object(m,"SOURCE",src),patch.object(m,"TARGET",dst),\
                 patch.object(m,"obter_chave",return_value="credencial"),\
                 patch.object(m,"consultar",return_value=[{
                     "numeroProcesso":CNJ,"classe":{"nome":"Procedimento"},
                     "dataAjuizamento":"2026-01-10","movimentos":[]}]):
                m.main()
            second=json.loads(dst.read_text())
            self.assertIn(CNJ,second["dados"]["parlamentar-id"])
            self.assertNotIn(CNJ,second["pendentes"])
            self.assertNotIn("culpado",second["dados"]["parlamentar-id"][CNJ])

if __name__=="__main__":unittest.main()
