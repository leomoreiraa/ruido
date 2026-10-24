"""Testes sem rede: nenhum vínculo por nome parecido, CPF ou documento inválido."""
import importlib.util
from pathlib import Path
import unittest

spec=importlib.util.spec_from_file_location("financial",Path("scripts/refresh-financial-links.py"))
financial=importlib.util.module_from_spec(spec)
spec.loader.exec_module(financial)

class FinancialLinkTests(unittest.TestCase):
    def test_cnpj_integridade_14_digitos(self):
        self.assertEqual(financial.cnpj("11.222.333/0001-81"),"11222333000181")
        self.assertIsNone(financial.cnpj("11.222.333/0001-80"))
        self.assertIsNone(financial.cnpj("123.456.789-09"))
        self.assertIsNone(financial.cnpj("00.000.000/0000-00"))
        self.assertIsNone(financial.cnpj("11222333"))

    def test_uf_cargo_nome_civil_unicos(self):
        people=[
          {"id":"A","nome":"Joao","nomeCivil":"JOAO DE SOUZA",
           "casa":"CAMARA","uf":"SP"},
          {"id":"B","nome":"Joao","nomeCivil":"JOAO DE SOUZA",
           "casa":"CAMARA","uf":"RJ"},
          {"id":"C","nome":"Jose","nomeCivil":"JOSE SILVA",
           "casa":"SENADO","uf":"SP"},
        ]
        rows=[
          {"NM_CANDIDATO":"João de Souza","SQ_CANDIDATO":"9001",
           "SG_UF":"SP","DS_CARGO":"DEPUTADO FEDERAL"},
          {"NM_CANDIDATO":"Joao de Souza","SQ_CANDIDATO":"9002",
           "SG_UF":"RJ","DS_CARGO":"DEPUTADO FEDERAL"},
          {"NM_CANDIDATO":"Jose Silva","SQ_CANDIDATO":"9003",
           "SG_UF":"SP","DS_CARGO":"SENADOR"},
        ]
        matches,errors=financial.candidatos_verificados(rows,people)
        self.assertEqual(matches,{("SP","9001"):"A",("RJ","9002"):"B",("SP","9003"):"C"})
        self.assertEqual(errors,0)

    def test_nome_urna_exato_quando_camara_nao_tem_nome_civil(self):
        people=[{"id":"A","nome":"Deputada Esperanca","nomeCivil":None,
                 "casa":"CAMARA","uf":"SP"}]
        rows=[{"NM_CANDIDATO":"MARIA DA SILVA","NM_URNA_CANDIDATO":"DEPUTADA ESPERANÇA",
               "SQ_CANDIDATO":"9033","SG_UF":"SP","DS_CARGO":"DEPUTADO FEDERAL"}]
        matches,ambiguous=financial.candidatos_verificados(rows,people)
        self.assertEqual(matches,{("SP","9033"):"A"})
        self.assertEqual(ambiguous,0)

    def test_nome_urna_ambiguo_ou_nome_civil_divergente_nao_vincula(self):
        people=[
          {"id":"A","nome":"Deputado Joao","nomeCivil":None,"casa":"CAMARA","uf":"SP"},
          {"id":"B","nome":"Maria","nomeCivil":"MARIA OLIVEIRA","casa":"CAMARA","uf":"RJ"},
        ]
        rows=[
          {"NM_CANDIDATO":"JOAO SILVA","NM_URNA_CANDIDATO":"DEPUTADO JOAO",
           "SQ_CANDIDATO":"9001","SG_UF":"SP","DS_CARGO":"DEPUTADO FEDERAL"},
          {"NM_CANDIDATO":"JOAO SANTOS","NM_URNA_CANDIDATO":"DEPUTADO JOAO",
           "SQ_CANDIDATO":"9002","SG_UF":"SP","DS_CARGO":"DEPUTADO FEDERAL"},
          {"NM_CANDIDATO":"MARIA SOUZA","NM_URNA_CANDIDATO":"MARIA",
           "SQ_CANDIDATO":"9003","SG_UF":"RJ","DS_CARGO":"DEPUTADO FEDERAL"},
        ]
        matches,_=financial.candidatos_verificados(rows,people)
        self.assertEqual(matches,{})

    def test_ambiguidade_na_eleicao_exclui_candidato(self):
        people=[{"id":"A","nome":"Joao","nomeCivil":"JOAO SOUZA","casa":"CAMARA","uf":"SP"}]
        rows=[{"NM_CANDIDATO":"Joao Souza","SQ_CANDIDATO":sq,
               "SG_UF":"SP","DS_CARGO":"DEPUTADO FEDERAL"} for sq in ("9001","9002")]
        matches,_=financial.candidatos_verificados(rows,people)
        self.assertEqual(matches,{})

    def test_cruzamento_apenas_identidade_cnpj_validada(self):
        a="11222333000181"
        campaigns=[{"ano":2022,"fonte":"https://cdn.tse.jus.br/original.zip",
            "fornecedores":[{"nome":"Loja Oficial","cnpj":a,"valor":200.0},
                            {"nome":"Empresa Homônima","cnpj":"11111111000191","valor":80.0}]}]
        suppliers=[
          {"nome":"Loja Oficial","cnpj":a,"valor":100.0,"ano":2025,
           "fonte":"https://www.camara.leg.br/cotas/Ano-2025.csv.zip"},
          {"nome":"Loja Oficial","cnpj":"00000000000000","valor":900.0,
           "ano":2026,"fonte":"https://www.camara.leg.br/cotas/Ano-2026.csv.zip"}
        ]
        matches=financial.crossings(campaigns,suppliers)
        self.assertEqual(len(matches),1)
        self.assertEqual(matches[0]["cnpj"],a)
        self.assertEqual(matches[0]["tipo"],"MESMO_CNPJ_FORNECEDOR_CAMPANHA_E_CEAP")

    def test_valores_nao_sao_inferidos(self):
        self.assertEqual(financial.cents("1.234,56"),123456)
        self.assertEqual(financial.cents("120.40"),12040)
        self.assertIsNone(financial.cents(""))
        self.assertIsNone(financial.cents("sem valor"))


    def test_cgu_checkpoint_paginas_anos_e_autores(self):
        from unittest.mock import patch
        people=[
            {"id":"A","nome":"Ana Silva","nomeCivil":None,"ativo":True},
            {"id":"B","nome":"Beatriz Souza","nomeCivil":None,"ativo":True},
        ]
        calls=[]
        def fake(name,year,page,key,pace):
            calls.append((name,year,page))
            if page>1:return []
            return [{"nomeAutor":name,"ano":year,"codigoEmenda":f"{year}000001",
                     "numeroEmenda":"1","tipoEmenda":"INDIVIDUAL",
                     "valorEmpenhado":"100,00","valorPago":"50,00"}]
        with patch.object(financial,"cgu_get_page",side_effect=fake):
            first,metrics,checkpoint,cursor=financial.emendas_api(
                people,"chave-simulada",limit=2,max_queries=3,years=(2025,2026))
            self.assertEqual(metrics["estado"],"PARCIAL_LIMITE")
            self.assertEqual(checkpoint,{"autor":"ANA SILVA","ano":2026,"pagina":2,
                                         "ultimaAssinatura":checkpoint["ultimaAssinatura"]})
            self.assertEqual(len(first["A"]),2)
            second,metrics2,checkpoint2,cursor2=financial.emendas_api(
                people,"chave-simulada",limit=2,max_queries=20,
                cursor=cursor,checkpoint=checkpoint,years=(2025,2026))
        self.assertEqual(metrics2["estado"],"CONSULTADA")
        self.assertEqual(metrics2["autoresConcluidos"],2)
        self.assertIn(("ANA SILVA",2026,2),calls)
        self.assertEqual(checkpoint2["autor"],"ANA SILVA")
        self.assertEqual(len(second["B"]),2)

    def test_cgu_http_429_nao_pula_autor(self):
        from unittest.mock import patch
        from urllib.error import HTTPError
        people=[{"id":"A","nome":"ANA","nomeCivil":None,"ativo":True},
                {"id":"B","nome":"BEATRIZ","nomeCivil":None,"ativo":True}]
        call=[]
        def fake(name,year,page,key,pace):
            call.append((name,year,page))
            if name=="ANA" and page==2:
                raise HTTPError("https://api.portaldatransparencia.gov.br",429,"rate",{},None)
            if page==1:
                return [{"nomeAutor":name,"ano":year,"codigoEmenda":"2026000001",
                         "valorEmpenhado":"100,00","valorPago":"20,00"}]
            return []
        with patch.object(financial,"cgu_get_page",side_effect=fake):
            _,status,cp,_=financial.emendas_api(people,"secret",limit=2,max_queries=10,years=(2026,))
        self.assertEqual(status["estado"],"PAUSADA_FONTE")
        self.assertEqual(status["motivoPausa"],"HTTP 429")
        self.assertEqual(cp["autor"],"ANA")
        self.assertEqual(cp["pagina"],2)
        self.assertNotIn(("BEATRIZ",2026,1),call)

    def test_cgu_autor_e_ano_divergentes_nao_publicam(self):
        from unittest.mock import patch
        people=[{"id":"A","nome":"ANA","nomeCivil":None,"ativo":True}]
        def fake(name,year,page,key,pace):
            return [{"nomeAutor":"ANA PARECIDA","ano":year,"codigoEmenda":"2026000001",
                     "valorEmpenhado":"100,00","valorPago":"20,00"}] if page==1 else []
        with patch.object(financial,"cgu_get_page",side_effect=fake):
            records,meta,_,_=financial.emendas_api(people,"secret",limit=1,
                                                   max_queries=5,years=(2026,))
        self.assertEqual(dict(records),{})
        self.assertEqual(meta["registrosRejeitados"],1)

    def test_cgu_paginacao_repetida_bloqueia_avanço(self):
        from unittest.mock import patch
        people=[{"id":"A","nome":"ANA","nomeCivil":None,"ativo":True}]
        def fake(name,year,page,key,pace):
            return [{"nomeAutor":"ANA","ano":2026,"codigoEmenda":"2026000001",
                     "valorEmpenhado":"100,00","valorPago":"20,00"}]
        with patch.object(financial,"cgu_get_page",side_effect=fake):
            _,meta,cp,_=financial.emendas_api(people,"secret",limit=1,
                                              max_queries=5,years=(2026,))
        self.assertEqual(meta["estado"],"PAUSADA_PAGINACAO")
        self.assertEqual(cp["pagina"],2)


    def test_senado_relatorio_oficial_ano_uf_nome_e_total(self):
        senator={"id":"s1","nome":"Flávio Bolsonaro","nomeCivil":"FLAVIO NANTES BOLSONARO",
                 "uf":"RJ","externalId":"5894","casa":"SENADO","ativo":True}
        report="""<html><body>Senador: <strong>Flávio Bolsonaro</strong>
        Partido: PL UF: RJ Ano: 2026
        1. COTAS PARLAMENTARES (CEAP)
        Aluguel de imóveis R$ 42.587,62
        TOTAL COTAS <b>R$ 86.264,27</b>
        2. GASTOS NÃO INCLUSOS NAS COTAS
        TOTAL GASTOS <b>R$ 20.886,47</b></body></html>"""
        self.assertEqual(financial.parse_senado_ceaps(report,senator,2026),86264.27)
        for changed in [report.replace("UF: RJ","UF: SP"),
                        report.replace("Flávio Bolsonaro","Outro Senador"),
                        report.replace("Ano: 2026","Ano: 2025"),
                        report.replace("TOTAL COTAS","TOTAL FICTICIO")]:
            with self.assertRaises(ValueError):
                financial.parse_senado_ceaps(changed,senator,2026)

    def test_campanha_de_2018_incluida_sem_inferir_receitas(self):
        self.assertIn(2018,financial.ANOS_TSE)
        self.assertIn(2022,financial.ANOS_TSE)
        self.assertIn(2026,financial.ANOS_TSE)
        people=[{"id":"senador","nome":"Flávio Bolsonaro",
                 "nomeCivil":"FLAVIO NANTES BOLSONARO","casa":"SENADO","uf":"RJ"}]
        rows=[{"NM_CANDIDATO":"FLAVIO NANTES BOLSONARO",
               "NM_URNA_CANDIDATO":"FLAVIO BOLSONARO",
               "SG_UF":"RJ","DS_CARGO":"SENADOR","SQ_CANDIDATO":"201899"}]
        matches,ambiguous=financial.candidatos_verificados(rows,people)
        self.assertEqual(matches,{("RJ","201899"):"senador"})
        self.assertEqual(ambiguous,0)


    def test_nome_urna_exato_com_nome_civil_abreviado_sem_colisao(self):
        people=[{"id":"senado","nome":"FLAVIO BOLSONARO",
                 "nomeCivil":"FLAVIO BOLSONARO","casa":"SENADO","uf":"RJ"}]
        rows=[{"NM_CANDIDATO":"FLAVIO NANTES BOLSONARO",
               "NM_URNA_CANDIDATO":"FLAVIO BOLSONARO",
               "SG_UF":"RJ","DS_CARGO":"SENADOR","SQ_CANDIDATO":"2018111"}]
        matches,errors=financial.candidatos_verificados(rows,people)
        self.assertEqual(matches,{("RJ","2018111"):"senado"})
        self.assertEqual(errors,0)

    def test_ceaps_cnpj_exato_e_dados_anonimizados(self):
        people=[{"id":"s","externalId":"5894","casa":"SENADO"}]
        rows=[{"codSenador":5894,"fornecedor":"Empresa Real",
               "cnpjCpf":"11.222.333/0001-81","valorReembolsado":123.45},
              {"codSenador":5894,"fornecedor":"Pessoa física",
               "cnpjCpf":"123.456.789-09","valorReembolsado":900},
              {"codSenador":9000,"fornecedor":"Empresa de outro senador",
               "cnpjCpf":"11.222.333/0001-81","valorReembolsado":500}]
        rows=rows*25
        result=financial.extract_senado_ceaps(rows,people,2026,
            "https://adm.senado.gov.br/adm-dadosabertos/api/v1/senadores/despesas_ceaps/2026")
        self.assertEqual(len(result["s"]),1)
        self.assertEqual(result["s"][0]["cnpj"],"11222333000181")
        self.assertEqual(result["s"][0]["valor"],3086.25)
        self.assertNotIn("12345678909",str(result))


    def test_ceaps_schema_real_cpfCnpj_aceita_so_pessoa_juridica(self):
        
        people=[{"id":"s","externalId":"5936","casa":"SENADO"}]
        rows=[
            {"codSenador":5936,"fornecedor":"Empresa autorizada",
             "cpfCnpj":"11.222.333/0001-81","valorReembolsado":130.25},
            {"codSenador":5936,"fornecedor":"Pessoa física",
             "cpfCnpj":"123.456.789-09","valorReembolsado":990.00},
            {"codSenador":9999,"fornecedor":"Outro senador",
             "cpfCnpj":"11.222.333/0001-81","valorReembolsado":200.00},
        ]*25
        result=financial.extract_senado_ceaps(
            rows,people,2025,
            "https://adm.senado.gov.br/adm-dadosabertos/api/v1/senadores/despesas_ceaps/2025")
        self.assertEqual(len(result["s"]),1)
        self.assertEqual(result["s"][0]["cnpj"],"11222333000181")
        self.assertEqual(result["s"][0]["valor"],3256.25)
        self.assertNotIn("12345678909",str(result))

    def test_ceaps_indisponibilidade_falha_fechada(self):
        with self.assertRaises(ValueError):
            financial.extract_senado_ceaps([],[],2026,"https://adm.senado.gov.br")


    def test_presidencial_2026_por_nomes_oficiais_unicos(self):
        people=[{"casa":"SENADO","externalId":"5894","nome":"FLAVIO BOLSONARO",
                 "nomeCivil":"FLAVIO NANTES BOLSONARO"}]
        rows=[{"DS_CARGO":"PRESIDENTE","SG_UF":"BR","SQ_CANDIDATO":"20260022",
               "NM_CANDIDATO":"FLAVIO NANTES BOLSONARO",
               "NM_URNA_CANDIDATO":"FLAVIO BOLSONARO","SG_PARTIDO":"PL",
               "NR_CANDIDATO":"22","DS_SITUACAO_CANDIDATURA":"DEFERIDO"}]
        result=financial.presidenciais_parlamentares(rows,people)
        self.assertEqual(list(result),["SENADO:5894"])
        self.assertEqual(result["SENADO:5894"]["cargo"],"PRESIDENTE")
        self.assertNotIn("eleito",result["SENADO:5894"])
        self.assertNotIn("turno",result["SENADO:5894"])
        rows[0]["NM_CANDIDATO"]="NOME DIVERGENTE"
        self.assertEqual(financial.presidenciais_parlamentares(rows,people),{})

    def test_publicacao_ceap_nao_confunde_duas_razões_sociais_do_mesmo_cnpj(self):
        module_spec=importlib.util.spec_from_file_location(
            "safe_finance",Path("scripts/publish-collector-safe.py"))
        safe=importlib.util.module_from_spec(module_spec)
        module_spec.loader.exec_module(safe)
        a={"ano":2026,"cnpj":"11222333000181","nome":"FORNECEDOR LTDA",
           "valor":100,"fonte":"https://www.camara.leg.br/cotas"}
        b={**a,"nome":"FORNECEDOR COMERCIO LTDA","valor":250}
        doc=lambda records:{"version":1,"atualizadoEm":"2026-10-23T22:00:00Z",
                            "dados":{"p":{"fornecedoresGabinete":records}}}
        out=safe.mix_finance(doc([]),doc([a,b]),doc([]))
        values=out["dados"]["p"]["fornecedoresGabinete"]
        self.assertEqual(len(values),2)
        self.assertEqual(sum(v["valor"] for v in values),350)


if __name__=="__main__":unittest.main()
