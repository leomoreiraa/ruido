import importlib.util
import unittest
from pathlib import Path

spec=importlib.util.spec_from_file_location("safe_collectors",
    Path("scripts/publish-collector-safe.py"))
module=importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)

A="2026-10-23T20:00:00Z"
B="2026-10-23T21:00:00Z"
C="2026-10-23T22:00:00Z"

def doc(data,date=B,**meta):
    return {"version":1,"dados":data,"atualizadoEm":date,**meta}

def article(a,date=B):
    return {"id":a,"ultimaConferencia":date,
            "resumo":"Reportagem "+a,"fontes":[{"url":"https://www.poder360.com.br/"+a}]}

def camp(year,amount):
    return {"ano":year,"arrecadacao":amount,"fornecedores":[]}

def supplier(cnpj,year,value=100,name="FORNECEDOR OFICIAL"):
    return {"cnpj":cnpj,"ano":year,"nome":name,"valor":value,
            "fonte":"https://www.camara.leg.br/cotas"}

def person(campaigns=None,ceap=None,emendas=None):
    return {"campanhas":campaigns or [],
            "fornecedoresGabinete":ceap or [],
            "emendas":emendas or []}

def president(turn=False):
    d={"eleicao":2026,"cargo":"PRESIDENTE",
       "candidato":"FLAVIO NANTES BOLSONARO",
       "nomeUrna":"FLAVIO BOLSONARO","numero":"22","partido":"PL",
       "fonteRegistro":"https://www.tse.jus.br/candidaturas"}
    if turn:
        d.update({"turno":2,"fonteTurno":"https://www.tse.jus.br/turno-2"})
    return d

class CollectorMergeTest(unittest.TestCase):
    def test_news_merges_distinct_reports_from_concurrent_runs(self):
        older=doc({"p":[article("old",A)]},A,cursor=10)
        local=doc({"p":[article("old",A),article("local",B)]},B,cursor=20)
        remote=doc({"p":[article("old",A),article("remote",C)]},C,cursor=25)
        out=module.mix_news(older,local,remote)
        self.assertEqual({item["id"] for item in out["dados"]["p"]},
                         {"old","local","remote"})
        self.assertEqual(out["cursor"],25)

    def test_news_keeps_existing_clipings_by_url(self):
        clip=lambda url,t:{"url":url,"publicadoEm":t,"ultimaConferencia":t}
        b=doc({},A,clippings={"p":[clip("https://a.org",A)]})
        a=doc({},B,clippings={"p":[clip("https://a.org",A),clip("https://b.org",B)]})
        z=doc({},C,clippings={"p":[clip("https://a.org",A),clip("https://c.org",C)]})
        out=module.mix_news(b,a,z)
        self.assertEqual({r["url"] for r in out["clippings"]["p"]},
                         {"https://a.org","https://b.org","https://c.org"})

    def test_news_same_id_keeps_newer_factcheck_not_older(self):
        old=article("same",A);local=article("same",B);remote=article("same",C)
        out=module.mix_news(doc({"p":[old]},A),doc({"p":[local]},B),
                            doc({"p":[remote]},C))
        self.assertEqual(out["dados"]["p"][0]["ultimaConferencia"],C)

    def test_finance_preserves_years_and_suppliers(self):
        cnpj1="12345678000190";cnpj2="22345678000190"
        older=doc({"p":person([camp(2018,10)])},A)
        local=doc({"p":person([camp(2018,10),camp(2026,100)],
                              [supplier(cnpj1,2026)])},B)
        remote=doc({"p":person([camp(2018,10),camp(2022,200)],
                               [supplier(cnpj2,2026)])},C)
        out=module.mix_finance(older,local,remote)["dados"]["p"]
        self.assertEqual({i["ano"] for i in out["campanhas"]},{2018,2022,2026})
        self.assertEqual({i["cnpj"] for i in out["fornecedoresGabinete"]},
                         {cnpj1,cnpj2})

    def test_finance_updated_same_period_prefers_newer_verified_run(self):
        base=doc({"p":person([camp(2026,10)])},A)
        local=doc({"p":person([camp(2026,20)])},B)
        remote=doc({"p":person([camp(2026,30)])},C)
        out=module.mix_finance(base,local,remote)
        self.assertEqual(out["dados"]["p"]["campanhas"][0]["arrecadacao"],30)

    def test_finance_rejects_duplicate_unverifiable_keys(self):
        record=supplier("12345678000190",2026,100)
        changed=supplier("12345678000190",2026,200)
        with self.assertRaises(ValueError):
            module.mix_finance(doc({},A),
                doc({"p":{"fornecedoresSenado":[record,changed]}},B),doc({},C))

    def test_finance_two_supplier_names_same_cnpj_year_are_distinct_records(self):
        
        
        id="cmvithi6u008srdhbur3bbo48"
        cnpj="12345678000190"
        a=supplier(cnpj,2026,200,"EMPRESA EXEMPLO LTDA")
        b=supplier(cnpj,2026,500,"EMPRESA EXEMPLO COMERCIO LTDA")
        out=module.mix_finance(doc({},A),
            doc({id:{"fornecedoresGabinete":[a,b]}},B),
            doc({},C))
        rows=out["dados"][id]["fornecedoresGabinete"]
        self.assertEqual(len(rows),2)
        self.assertEqual({item["nome"] for item in rows},{a["nome"],b["nome"]})
        self.assertEqual(sum(item["valor"] for item in rows),700)

    def test_finance_concurrent_same_cnpj_distinct_names_preserved(self):
        cnpj="12345678000190"
        previous=supplier(cnpj,2026,120,"EMPRESA")
        added=supplier(cnpj,2026,80,"EMPRESA FILIAL")
        remote=supplier(cnpj,2026,200,"EMPRESA OFICIAL")
        out=module.mix_finance(
            doc({"p":{"fornecedoresSenado":[previous]}},A),
            doc({"p":{"fornecedoresSenado":[previous,added]}},B),
            doc({"p":{"fornecedoresSenado":[previous,remote]}},C))
        rows=out["dados"]["p"]["fornecedoresSenado"]
        self.assertEqual(len(rows),3)
        self.assertEqual(sum(x["valor"] for x in rows),400)

    def test_crossings_several_receipts_same_cnpj_differing_values(self):
        cnpj="12345678000190"
        a={"anoCampanha":2018,"anoGabinete":2026,"cnpj":cnpj,
           "nomeFornecedor":"EMPRESA","valorContratadoCampanha":100,
           "valorCEAP":35,"fonteCEAP":"https://www.camara.leg.br/cotas"}
        b={**a,"valorCEAP":65}
        merged=module.union_records([], [a,b], [],module.FIELDS["coincidencias"],
                                   None,None,"coincidencias")
        self.assertEqual(len(merged),2)

    def test_presidency_keeps_proven_second_round_when_csv_omits(self):
        first=doc({"SENADO:5894":president(True)},A)
        local=doc({"SENADO:5894":president(False)},C)
        remote=doc({"SENADO:5894":president(True)},B)
        out=module.mix_presidency(first,local,remote)
        self.assertEqual(out["dados"]["SENADO:5894"]["turno"],2)
        self.assertTrue(out["dados"]["SENADO:5894"]["fonteTurno"].startswith("https://www.tse.jus.br/"))

    def test_presidency_refuses_contradictory_identity(self):
        a=president(True)
        b=president(True);b["numero"]="13"
        with self.assertRaises(ValueError):
            module.mix_presidency(doc({},A),
                                 doc({"SENADO:5894":a},B),
                                 doc({"SENADO:5894":b},C))

    def test_paths_allow_only_news_and_finance(self):
        self.assertEqual(set(module.KINDS),{"news","finance"})
        self.assertNotIn("prisma/dev.db",sum((list(p) for p in module.KINDS.values()),[]))

if __name__=="__main__":
    unittest.main()
