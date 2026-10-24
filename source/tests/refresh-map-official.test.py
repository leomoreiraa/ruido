import importlib.util
from pathlib import Path
import unittest

SCRIPT=Path(__file__).resolve().parent.parent/"scripts"/"refresh-map-official.py"
spec=importlib.util.spec_from_file_location("map_refresh_official", SCRIPT)
mapa=importlib.util.module_from_spec(spec)
spec.loader.exec_module(mapa)

class MapSourceTests(unittest.TestCase):
    def test_ibge_responses_are_parsed_without_invented_missing_values(self):
        raw=[{"V":"V","D1C":"Unidade territorial","D2C":"Período"},
             {"V":"4666497","D1C":"35","D2C":"2025"},
             {"V":"-","D1C":"33","D2C":"2025"}]
        data=mapa.parse_sidra(raw)
        self.assertEqual(data[("SP","2025")],4666497)
        self.assertNotIn(("RJ","2025"),data)
    def test_preserves_other_indicators_on_population_refresh(self):
        state={"uf":"SP","porAno":{"2024":{"populacao":1000,"pibMilReais":90,"emendasPagas":32,"emendasCount":5}}}
        count=mapa.apply_population([state],{("SP","2024"):2000})
        self.assertEqual(count,1)
        self.assertEqual(state["porAno"]["2024"]["populacao"],2000)
        self.assertEqual(state["porAno"]["2024"]["pibMilReais"],90)
        self.assertEqual(state["porAno"]["2024"]["emendasPagas"],32)
    def test_credit_uses_newest_official_observation(self):
        state={}
        rows=[{"data":"01/01/2024","valor":"10,5"},
              {"data":"01/11/2024","valor":"12,5"}]
        self.assertTrue(mapa.apply_credit(state,rows,26618))
        self.assertEqual(state["creditoMei"]["milhoesReais"],12.5)

if __name__=="__main__":unittest.main()
