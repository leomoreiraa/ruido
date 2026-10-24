import importlib.util
import unittest
from pathlib import Path

spec=importlib.util.spec_from_file_location("municipios",Path(__file__).resolve().parents[1]/"scripts"/"collect-municipios-ibge.py")
mod=importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)

class MunicipalCatalogTests(unittest.TestCase):
    def test_tse_snapshot_validated_fallback(self):
        uf_ids={"RO":"11","AC":"12","AM":"13","RR":"14","PA":"15","AP":"16","TO":"17","MA":"21","PI":"22","CE":"23","RN":"24","PB":"25","PE":"26","AL":"27","SE":"28","BA":"29","MG":"31","ES":"32","RJ":"33","SP":"35","PR":"41","SC":"42","RS":"43","MS":"50","MT":"51","GO":"52","DF":"53"}
        cities=[{"uf":uf,"codigoIBGE":code+f"{i:05d}","nome":f"Municipio {i}"} for uf,code in uf_ids.items() for i in range(207)]
        snapshot={"fonte":"https://resultados.tse.jus.br/oficial","eleicao":"6257","turno":1,"municipios":cities}
        result=mod.preparar_tse(snapshot)
        self.assertEqual(len(result["municipios"]),27*207)
        self.assertEqual(result["fontes"]["municipios"],mod.TSE_MUNICIPIOS)
        self.assertFalse(result["populacaoCompleta"])
        self.assertTrue(all(m["populacaoCenso2022"] is None for m in result["municipios"]))
    def test_rejects_unauthorized_or_incomplete_snapshot(self):
        for candidate in [{},{"fonte":"https://other.invalid","eleicao":"6257","turno":1,"municipios":[]},
                          {"fonte":"https://resultados.tse.jus.br/oficial","eleicao":"6258","turno":2,"municipios":[]}]:
            with self.assertRaises(ValueError):
                mod.preparar_tse(candidate)

if __name__=="__main__":unittest.main()
