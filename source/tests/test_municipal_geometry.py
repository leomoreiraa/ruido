import importlib.util
import unittest
from pathlib import Path

spec=importlib.util.spec_from_file_location("geom_municipios",Path(__file__).resolve().parents[1]/"scripts"/"build-municipal-geometry.py")
geom=importlib.util.module_from_spec(spec)
spec.loader.exec_module(geom)

def fake(code="1200013"):
    return {"type":"FeatureCollection","features":[{"type":"Feature","properties":{"id":code,"name":"Acrelândia"},"geometry":{"type":"Polygon","coordinates":[[[-68,-10],[-67,-10],[-67,-9],[-68,-9],[-68,-10]]]}}]}

class GeometryTests(unittest.TestCase):
    def test_svg_uses_ibge_code(self):
        item=geom.exportar(fake(),"AC",["1200013"])
        self.assertEqual(item["uf"],"AC")
        self.assertEqual(item["municipios"][0]["id"],"1200013")
        self.assertTrue(item["municipios"][0]["d"].startswith("M"))
        self.assertEqual(item["viewBox"],"0 0 800 610")
    def test_rejects_cross_state_code(self):
        with self.assertRaises(ValueError):
            geom.exportar(fake(),"SP")
    def test_rejects_missing_or_duplicate_code(self):
        raw=fake()
        raw["features"].append(raw["features"][0])
        with self.assertRaises(ValueError):
            geom.extrair(raw)
    def test_missing_coverage_fails_closed(self):
        with self.assertRaises(ValueError):
            geom.exportar(fake(),"AC",["1200013","1200054"])
    def test_rejects_invalid_geojson(self):
        with self.assertRaises(ValueError):
            geom.extrair({"type":"NotGeoJSON"})

if __name__=="__main__":unittest.main()
