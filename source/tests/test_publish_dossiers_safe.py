import importlib.util
import unittest
from pathlib import Path

spec=importlib.util.spec_from_file_location("dossier_publish",
    Path("scripts/publish-dossiers-safe.py"))
module=importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)

def doc(data,stamp="2026-10-23T21:00:00Z"):
    return {"version":1,"atualizadoEm":stamp,"dados":data,"cobertura":{"perfis":len(data)}}

def record(value,stamp):
    return {"valor":value,"coletadoEm":stamp,"fonte":"https://www.camara.leg.br/cotas"}

class SafePublishTests(unittest.TestCase):
    def test_unrelated_profiles_preserved(self):
        base=doc({"a":{"2022":record(10,"2026-10-20T10:00:00Z")}})
        ours=doc({"a":{"2022":record(10,"2026-10-20T10:00:00Z")},
            "b":{"2026":record(20,"2026-10-23T10:00:00Z")}})
        remote=doc({"a":{"2022":record(10,"2026-10-20T10:00:00Z")},
            "c":{"2026":record(30,"2026-10-23T10:00:00Z")}})
        merged=module.merge_document(base,ours,remote)
        self.assertEqual(set(merged["dados"]),{"a","b","c"})

    def test_same_profile_distinct_years_preserved(self):
        base=doc({"id":{"2018":record(5,"2026-01-01T10:00:00Z")}})
        ours=doc({"id":{"2018":record(5,"2026-01-01T10:00:00Z"),
            "2026":record(15,"2026-10-23T12:00:00Z")}})
        theirs=doc({"id":{"2018":record(5,"2026-01-01T10:00:00Z"),
            "2022":record(9,"2026-10-23T11:00:00Z")}})
        merged=module.merge_document(base,ours,theirs)
        self.assertEqual(set(merged["dados"]["id"]),{"2018","2022","2026"})

    def test_same_evidence_uses_newest_verified_collection(self):
        old=record(1,"2026-10-21T10:00:00Z")
        local=record(3,"2026-10-23T11:00:00Z")
        remote=record(2,"2026-10-23T12:00:00Z")
        merged=module.merge_document(doc({"p":{"2026":old}}),
            doc({"p":{"2026":local}}),doc({"p":{"2026":remote}}))
        self.assertEqual(merged["dados"]["p"]["2026"]["valor"],2)

    def test_without_fresh_timestamp_fails_closed(self):
        old={"texto":"base","fonteHash":"a"}
        local={"texto":"local","fonteHash":"b"}
        remote={"texto":"remote","fonteHash":"c"}
        with self.assertRaises(ValueError):
            module.merge_document(doc({"p":old}),doc({"p":local}),doc({"p":remote}))

    def test_judicial_records_union_by_case_number(self):
        def case(n,stamp):
            return {"numeroProcesso":n,"anoEleicao":2026,
                "conferidoEm":stamp,"situacao":"PARTE_PROCESSUAL_ELEITORAL"}
        older=case("00000000000000000001","2026-10-21T10:00:00Z")
        new=case("00000000000000000002","2026-10-23T11:00:00Z")
        other=case("00000000000000000003","2026-10-23T12:00:00Z")
        result=module.merge_document(doc({"p":[older]}),
            doc({"p":[older,new]}),doc({"p":[older,other]}))
        self.assertEqual({x["numeroProcesso"] for x in result["dados"]["p"]},
                         {older["numeroProcesso"],new["numeroProcesso"],other["numeroProcesso"]})

    def test_partial_collection_does_not_remove_published_record(self):
        old=doc({"p":{"2025":record(10,"2026-01-01T00:00:00Z")}})
        local=doc({})
        remote=doc({"p":{"2025":record(10,"2026-01-01T00:00:00Z")}})
        self.assertIn("p",module.merge_document(old,local,remote)["dados"])


    def test_datajud_preserves_new_cnjs_added_by_parallel_writer(self):
        def entry(name,when):
            return {"numeroProcesso":name,"tribunal":"TRE-RJ","conferidoEm":when,
                "fonte":"https://api-publica.datajud.cnj.jus.br/api_publica_tre-rj/_search"}
        older=entry("00000000000000000001","2026-10-20T10:00:00Z")
        ours=entry("00000000000000000002","2026-10-23T20:00:00Z")
        theirs=entry("00000000000000000003","2026-10-23T21:00:00Z")
        result=module.merge_document(doc({"p":{older["numeroProcesso"]:older}}),
            doc({"p":{older["numeroProcesso"]:older,ours["numeroProcesso"]:ours}}),
            doc({"p":{older["numeroProcesso"]:older,theirs["numeroProcesso"]:theirs}}))
        self.assertEqual(set(result["dados"]["p"]),
            {older["numeroProcesso"],ours["numeroProcesso"],theirs["numeroProcesso"]})
        self.assertIn("public/data/dossies/datajud.json",module.ALLOWED)

if __name__=="__main__":unittest.main()
