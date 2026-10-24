import importlib.util
import json
import tempfile
import unittest
from pathlib import Path

spec=importlib.util.spec_from_file_location("checkpoint",
    Path("scripts/workflow-json-checkpoint.py"))
module=importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)

class CheckpointTest(unittest.TestCase):
    def test_valid_and_invalid_structures(self):
        with tempfile.TemporaryDirectory() as directory:
            p=Path(directory)/"checkpoint.json"
            p.write_text(json.dumps({"version":1,"dados":{"id":[]},
                "atualizadoEm":"2026-10-23T22:30:00Z"}))
            self.assertGreater(module.validate(p),1_600_000_000)
            p.write_text(json.dumps({"version":1,"dados":[],
                "atualizadoEm":"2026-10-23T22:30:00Z"}))
            with self.assertRaises(ValueError):module.validate(p)
            p.write_text(json.dumps({"version":1,"dados":{},
                "atualizadoEm":"invalido"}))
            with self.assertRaises(ValueError):module.validate(p)

    def test_no_implicit_write_without_context(self):
        self.assertFalse(module.restore("news","",None))

    def test_paths_are_whitelisted(self):
        self.assertEqual(set(module.FILES),{"news","datajud","finance","official-ai"})

if __name__=="__main__":unittest.main()
