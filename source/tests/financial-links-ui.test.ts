import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=(p:string)=>readFileSync(p,"utf8");

test("todos os perfis recebem painel financeiro no build estático",()=>{
  const profile=read("app/parlamentares/[id]/page.tsx");
  const panel=read("components/DossieRedeFinanceira.tsx");
  assert.match(profile,/import \{ DossieRedeFinanceira \}/);
  assert.match(profile,/<DossieRedeFinanceira parlamentarId=\{parlamentar.id\}/);
  assert.match(panel,/redes-financeiras\.json/);
  assert.match(panel,/FINANCIAMENTO ELEITORAL/);
  assert.match(panel,/EMENDAS PARLAMENTARES/);
  assert.match(panel,/FORNECEDORES DOCUMENTADOS/);
  assert.match(panel,/COINCIDÊNCIAS POR CNPJ/);
  assert.doesNotMatch(panel,/GEMINI_API_KEY|TRANSPARENCIA_API_KEY|fetch\(/);
});
test("origem exata, fonte oficial, identidade e bloqueio de CPF permanecem no coletor",()=>{
  const code=read("scripts/refresh-financial-links.py");
  assert.match(code,/candidatos_verificados/);
  assert.match(code,/by_name\.get\(\(norm\(p\["uf"\]\),cargo,norm\(p\["nomeCivil"\]/);
  assert.match(code,/len\(names\)==1/);
  assert.match(code,/cnpj\(row\.get\("NR_CPF_CNPJ_FORNECEDOR"\)\)/);
  assert.match(code,/cnpj\(row\.get\("txtCNPJCPF"\)\)/);
  assert.match(code,/MESMO_CNPJ_FORNECEDOR_CAMPANHA_E_CEAP/);
  assert.match(code,/fonte.*portaldatransparencia\.gov\.br\/emendas/);
  assert.doesNotMatch(code,/\["cpf"\]/);
});
test("fase 1 só publica dados produzidos e validados no Actions",()=>{
  const wf=read(".github/workflows/financial-links.yml");
  assert.match(wf,/scripts\/refresh-financial-links\.py/);
  assert.match(wf,/test_financial_links\.py/);
  assert.match(wf,/redes-financeiras\.json/);
  assert.match(wf,/gh workflow run deploy-visual-fast\.yml/);
  assert.match(wf,/secrets\.PORTAL_TRANSPARENCIA_API_KEY/);
  assert.doesNotMatch(wf,/actions\/deploy-pages@/);
});

test("painéis financeiros e jornalísticos são responsivos e incluem CEAPS oficial",()=>{
  const panel=read("components/DossieRedeFinanceira.tsx");
  const news=read("components/DossieFinanceiroNoticias.tsx");
  const css=read("app/globals.css");
  assert.match(panel,/cotasSenado/);
  assert.match(panel,/COTAS DO SENADO/);
  assert.match(panel,/adm\.senado\.gov\.br/);
  assert.match(panel,/grid-cols-1 lg:grid-cols-2/);
  assert.match(news,/grid-cols-1 lg:grid-cols-2/);
  assert.match(news,/"FONTE ÚNICA"/);
  assert.match(news,/"CORROBORADA"/);
  assert.doesNotMatch(news,/FONTE ÚNICA • SEM CONFIRMAÇÃO/);
  assert.doesNotMatch(news,/grupoEditorial\.toUpperCase\(\)\} ·/);
  assert.match(css,/\.ruido-dossie-section \{/);
  assert.match(css,/overflow-wrap: anywhere/);
});

test("cota CEAPS não ocupa card vazio no perfil de deputado",()=>{
  const panel=read("components/DossieRedeFinanceira.tsx");
  const profile=read("app/parlamentares/[id]/page.tsx");
  assert.match(panel,/casa==="SENADO" && <article/);
  assert.match(profile,/casa=\{parlamentar.casa\}/);
});
