import importlib.util
import unittest
from pathlib import Path

spec=importlib.util.spec_from_file_location("tse2026",Path(__file__).resolve().parents[1]/"scripts"/"collect-election-2026.py")
mod=importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)

def stub(votes,sections,expected):
    return {"ele":"6258","t":"2","v":{"vv":str(sum(votes)),"tv":str(sum(votes)+3 if sections else 0),"vb":"1","vn":"2","vnt":"0"},
            "s":{"ts":str(expected),"st":str(sections)},
            "carg":[{"cd":"1","agr":[{"par":[{"sg":"ABC","cand":[{"n":"13","nmu":"Pessoa Um","vap":str(votes[0])}]},{"sg":"XYZ","cand":[{"n":"22","nmu":"Pessoa Dois","vap":str(votes[1])}]}]}]}]}

class Election2026Tests(unittest.TestCase):
    def test_no_votes_does_not_invent_percentages(self):
        r=mod.resumo(stub([0,0],0,100))
        self.assertEqual(r["situacao"],"aguardando")
        self.assertIsNone(r["votosValidos"])
        self.assertTrue(all(c["percentual"] is None for c in r["candidatos"]))
    def test_partial_and_valid_vote_denominator(self):
        r=mod.resumo(stub([60,40],50,100))
        self.assertEqual(r["situacao"],"parcial")
        self.assertEqual(r["percentualSecoes"],50)
        self.assertEqual(r["candidatos"][0]["percentual"],60)
        self.assertEqual(r["candidatos"][1]["votos"],40)
    def test_concluded(self):
        self.assertEqual(mod.resumo(stub([72,28],100,100))["situacao"],"concluida")
    def test_rejects_inconsistent_total(self):
        v=stub([60,40],101,100)
        with self.assertRaises(ValueError):mod.resumo(v)
    def test_does_not_use_ibge_id_as_tse_code(self):
        self.assertIn("ac01120-c0001-e006258-u.json",mod.source_url("ac","01120"))
        with self.assertRaises(ValueError):mod.source_url("ac","1200013")
    def test_first_round_changes_id_without_mixing_results(self):
        mod.configurar_turno(1)
        try:
            self.assertIn("6257/dados/ac/ac01120-c0001-e006257-u.json",mod.source_url("ac","01120"))
            raw=stub([55,45],100,100)
            raw["ele"]="6257"
            raw["t"]="1"
            result=mod.resumo(raw)
            self.assertEqual(result["situacao"],"concluida")
            self.assertEqual(result["votosValidos"],100)
            raw["t"]="2"
            with self.assertRaises(ValueError):
                mod.resumo(raw)
        finally:
            mod.configurar_turno(2)
    def test_duplicate_ea12_rejected(self):
        raw={"abr":[{"cd":"ac","mu":[{"cd":"01120","cdi":"1200013","nm":"ACRELANDIA"},{"cd":"01120","cdi":"1200013","nm":"ACRELANDIA"}]}]}
        with self.assertRaises(ValueError):mod.municipios(raw)

if __name__=="__main__":unittest.main()
