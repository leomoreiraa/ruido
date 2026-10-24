"""Teste de roteamento DataJud. Usa somente os números públicos e não faz rede."""
import importlib.util
from pathlib import Path
import unittest

SOURCE=Path("scripts/refresh-dossiers-datajud.py")
spec=importlib.util.spec_from_file_location("ruido_datajud",SOURCE)
mod=importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)

class DataJudRoutingTests(unittest.TestCase):
    def test_tribunal_sao_paulo(self):
        self.assertEqual(mod.tribunal_do_processo("06013897020226260000"),"tre-sp")
    def test_tre_distrito_federal(self):
        self.assertEqual(mod.tribunal_do_processo("00000000120266070000"),"tre-dft")
    def test_tse(self):
        self.assertEqual(mod.tribunal_do_processo("00000000120266000000"),"tse")
    def test_invalid_or_non_electoral(self):
        self.assertIsNone(mod.tribunal_do_processo("123"))
        self.assertIsNone(mod.tribunal_do_processo("06013897020228260000"))
        self.assertIsNone(mod.tribunal_do_processo("06013897020226990000"))
    def test_coverage_all_tribunals(self):
        self.assertEqual(len(mod.TRIBUNAIS),28)
        self.assertEqual(len(set(mod.TRIBUNAIS.values())),28)
        self.assertEqual(mod.TRIBUNAIS["25"],"tre-se")
        self.assertEqual(mod.TRIBUNAIS["26"],"tre-sp")
    def test_endpoint_is_official(self):
        self.assertEqual(mod.ROOT,"https://api-publica.datajud.cnj.jus.br")

if __name__=="__main__":
    unittest.main()
