import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";

const file=(path:string)=>fs.readFileSync(path,"utf8");

test("texto visual com barras não é confundido com comentário de código",()=>{
  const markers:Record<string,string[]>={
    "app/layout.tsx":["/// DADOS PÚBLICOS","/// POLÍTICA SOB LUPA","DADOS ABERTOS"],
    "app/apoie/page.tsx":["/// APOIO DIRETO","/// PRESTAÇÃO DE CONTAS"],
    "app/cobertura/page.tsx":["/// AUDITORIA DO ACERVO","EMENDAS POR ANO // COBERTURA PARCIAL"],
    "app/not-found.tsx":["/// RUÍDO"],
    "components/EmendasTrackerView.tsx":["// AUDITORIA DO ORÇAMENTO PÚBLICO"],
    "components/MapaBrasilView.tsx":["// CAMADA DE INFORMAÇÃO","/// DESENVOLVIMENTO HUMANO"],
    "components/ParlamentaresFilterView.tsx":["// ARQUIVO NOMINAL"],
    "components/PautasFilterView.tsx":["// MATÉRIAS LEGISLATIVAS"],
    "components/ui/RansomTitle.tsx":[">///</span>"]
  };
  for(const [path,expected] of Object.entries(markers)){
    const code=file(path);
    for(const marker of expected)assert.ok(code.includes(marker),path+": rótulo ausente "+marker);
  }
});

test("fontes TypeScript e TSX críticos continuam sintaticamente válidos",()=>{
  const paths=[
    "app/apoie/page.tsx","app/cobertura/page.tsx","app/layout.tsx",
    "app/not-found.tsx","components/EmendasTrackerView.tsx",
    "components/MapaBrasilView.tsx","components/ParlamentaresFilterView.tsx",
    "components/PautasFilterView.tsx","components/ui/RansomTitle.tsx",
    "lib/presencaCoverage.ts","lib/services/syncHistory.ts",
    "scripts/refresh-dossiers-news.ts"
  ];
  for(const path of paths){
    const source=ts.createSourceFile(path,file(path),ts.ScriptTarget.Latest,true,
      path.endsWith(".tsx")?ts.ScriptKind.TSX:ts.ScriptKind.TS);
    const errors=(source as ts.SourceFile & {parseDiagnostics?:readonly ts.Diagnostic[]}).parseDiagnostics ?? [];
    assert.equal(errors.length,0,
      path+": "+errors.map(e=>ts.flattenDiagnosticMessageText(e.messageText," ")).join("; "));
  }
});
