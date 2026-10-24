import hashlib
import importlib.util
from io import BytesIO
from pathlib import Path
import unittest
from unittest.mock import patch
from xml.sax.saxutils import escape
from zipfile import ZipFile

FILE=Path(__file__).resolve().parent.parent/"scripts"/"collect-idhm.py"
spec=importlib.util.spec_from_file_location("collect_idhm",FILE)
collector=importlib.util.module_from_spec(spec)
spec.loader.exec_module(collector)

def workbook():
    header=["ANO","AGREGACAO","NOME","IDHM"]
    entries=[header]
    for year in [2022,2023,2024]:
        for state in collector.STATES.values():
            entries.append([year,"Unidade da Federação",state,
                            (0.7 if year==2022 else 0.71 if year==2023 else 0.72)])
    rows=[]
    for i,values in enumerate(entries,1):
        cells=[]
        for j,value in enumerate(values):
            col=chr(65+j)
            if isinstance(value,(float,int)):
                cells.append(f'<c r="{col}{i}"><v>{value}</v></c>')
            else:
                cells.append(f'<c r="{col}{i}" t="inlineStr"><is><t>{escape(value)}</t></is></c>')
        rows.append(f'<row r="{i}">{"".join(cells)}</row>')
    sheet='<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>'+''.join(rows)+'</sheetData></worksheet>'
    wb='<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Total" sheetId="1" r:id="rId1"/></sheets></workbook>'
    rel='<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Target="worksheets/sheet1.xml"/></Relationships>'
    with BytesIO() as buf:
        with ZipFile(buf,"w") as z:
            z.writestr("xl/workbook.xml",wb)
            z.writestr("xl/_rels/workbook.xml.rels",rel)
            z.writestr("xl/worksheets/sheet1.xml",sheet)
        return buf.getvalue()

class PNUDTests(unittest.TestCase):
    def test_validated_annual_27_state_index(self):
        xlsx=workbook()
        sha=hashlib.sha1(b"blob "+str(len(xlsx)).encode()+b"\0"+xlsx).hexdigest()
        with patch.object(collector,"BLOB",sha):
            result=collector.extract(xlsx)
        self.assertEqual(len(result["porUF"]),27)
        self.assertEqual(result["porUF"]["SP"],{"2022":0.7,"2023":0.71,"2024":0.72})
        self.assertEqual(result["serieAte"],2024)
        self.assertIn("undp.org",result["urlOficial"])
    def test_rejects_changed_publisher_file(self):
        xlsx=workbook()
        with self.assertRaisesRegex(ValueError,"blob does not match"):
            collector.extract(xlsx)

if __name__=="__main__":
    unittest.main()
