import importlib.util
import sqlite3
import unittest
from pathlib import Path

spec=importlib.util.spec_from_file_location("coverage",Path("scripts/gerar-indicadores-presenca.py"))
m=importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)

class TestCoverage(unittest.TestCase):
    def test_percentual_e_descritivo_nao_inventa_ausencias(self):
        db=sqlite3.connect(":memory:")
        db.execute("CREATE TABLE Presenca (parlamentarId TEXT,casa TEXT,sessaoExternalId TEXT,dataSessao TEXT,origem TEXT,cobertura TEXT,status TEXT,fonteUrl TEXT)")
        for i in range(12):
            db.execute("INSERT INTO Presenca VALUES (?,?,?,?,?,?,?,?)",
                ("a","CAMARA",str(i),"2026-06-%02d"%(i+1),"EVENTO_CAMARA","CHAMADA_OFICIAL","PRESENTE","https://www.camara.leg.br"))
            if i<9:
                db.execute("INSERT INTO Presenca VALUES (?,?,?,?,?,?,?,?)",
                    ("b","CAMARA",str(i),"2026-06-%02d"%(i+1),"EVENTO_CAMARA","CHAMADA_OFICIAL","PRESENTE","https://www.camara.leg.br"))
        
        
        result=m.gerar(db)
        self.assertEqual(result["a"]["percentual"],100.0)
        self.assertNotIn("b",result)  
        self.assertEqual(result["a"]["criterio"],"EVENTOS_COLETADOS_NAO_ASSIDUIDADE")
    def test_sem_eventos_nao_gera_zero(self):
        db=sqlite3.connect(":memory:")
        db.execute("CREATE TABLE Presenca (parlamentarId TEXT,casa TEXT,sessaoExternalId TEXT,dataSessao TEXT,origem TEXT,cobertura TEXT,status TEXT,fonteUrl TEXT)")
        self.assertEqual(m.gerar(db),{})
if __name__=="__main__":unittest.main()
