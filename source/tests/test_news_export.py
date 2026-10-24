"""Testes de regressão: dossiês e notícias compartilham a mesma regra."""
import copy
import importlib.util
from pathlib import Path
import unittest

spec=importlib.util.spec_from_file_location("export_news",Path("scripts/validate-news-export.py"))
module=importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)

def source(group="bbc", link="https://www.bbc.com/portuguese/validado"):
    return {"url":link,"titulo":"Matéria publicada pela redação original",
            "grupoEditorial":group,"publicadoEm":"2026-10-22T12:00:00Z",
            "idReportagemOriginal":link}

def item():
    return {"id":"verificado-1","resumo":"Segundo BBC, uma reportagem original registra a atuação parlamentar em sessão pública.",
            "situacao":"NOTICIA","ultimaConferencia":"2026-10-23T12:00:00Z",
            "nivel":"FONTE_UNICA","fontes":[source()]}

def store(entry):
    return {"version":1,"dados":{"perfil-oficial":[entry]}}

class NewsExportTests(unittest.TestCase):
    def test_fonte_unica_aceita_com_atribuicao(self):
        self.assertEqual(module.validate(store(item())),1)

    def test_duas_redacoes_aceitas_como_corroboradas(self):
        event=item()
        event["nivel"]="CORROBORADA"
        event["fontes"].append(source("poder360","https://www.poder360.com.br/artigo-original"))
        self.assertEqual(module.validate(store(event)),1)

    def test_uma_fonte_nao_pode_ser_corroborada(self):
        event=item()
        event["nivel"]="CORROBORADA"
        with self.assertRaisesRegex(ValueError,"duas redações"):
            module.validate(store(event))

    def test_quatro_fontes_de_um_grupo_nao_equivalem_a_independencia(self):
        event=item()
        event["nivel"]="CORROBORADA"
        event["fontes"]=[source("bbc",f"https://www.bbc.com/materia-{i}") for i in range(4)]
        with self.assertRaisesRegex(ValueError,"duplicada"):
            module.validate(store(event))

    def test_nunca_inferir_culpa_ou_status_processual(self):
        for label in ["REU","CONDENADO","INVESTIGADO"]:
            event=item()
            event["situacao"]=label
            with self.assertRaisesRegex(ValueError,"status jurídico"):
                module.validate(store(event))

    def test_fonte_http_ou_sem_proveniencia_e_bloqueada(self):
        event=item()
        event["fontes"][0]["url"]="http://www.bbc.com/nao-seguro"
        with self.assertRaises(ValueError):
            module.validate(store(event))
        event=item()
        del event["fontes"][0]["idReportagemOriginal"]
        with self.assertRaises(ValueError):
            module.validate(store(event))

    def test_resumo_nao_atribuido_nao_e_publicado(self):
        event=item()
        event["resumo"]="O parlamentar realizou uma atividade, conforme reportagens diversas."
        with self.assertRaisesRegex(ValueError,"atribuição"):
            module.validate(store(event))

    def test_clipping_nao_aceita_agregador_ou_metadados_falsos(self):
        sample={"version":1,"dados":{},"clippings":{"perfil":[{
            "url":"https://www.bbc.com/portuguese/noticia","titulo":"Título original de reportagem",
            "grupoEditorial":"bbc","publicadoEm":"2024-01-01T00:00:00Z",
            "ultimaConferencia":"2026-10-23T00:00:00Z"
        }]}}
        self.assertEqual(module.validate(sample),0)
        sample["clippings"]["perfil"][0]["url"]="https://news.google.com/rss/articles/falso"
        with self.assertRaises(ValueError):
            module.validate(sample)

    def test_snapshot_real_se_existir(self):
        path=Path("public/data/dossies/noticias.json")
        if path.exists():
            self.assertGreaterEqual(module.validate(__import__("json").loads(path.read_text())),0)

if __name__=="__main__":
    unittest.main()
