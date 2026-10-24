import {expect,test} from "@playwright/test";

const url="https://ruido.runs-at.dev/eleicoes/";

for(const configuracao of [
 {nome:"desktop",viewport:{width:1366,height:850},isMobile:false,hasTouch:false},
 {nome:"celular",viewport:{width:390,height:844},isMobile:true,hasTouch:true}
]){
 test.describe("Apuração eleitoral "+configuracao.nome,()=>{
  test.use({viewport:configuracao.viewport,isMobile:configuracao.isMobile,hasTouch:configuracao.hasTouch});
  test.setTimeout(90000);

  test("primeiro turno, SVG real, zoom e enquadramento",async({page})=>{
   await page.goto(url,{waitUntil:"domcontentloaded"});
   await expect(page.getByRole("heading",{name:/ELEIÇÕES 2026/})).toBeVisible();
   await expect(page.locator(".ruido-map-zoom svg")).toBeVisible({timeout:45000});
   const mapa=page.locator(".ruido-map-zoom").first();
   const imagem=mapa.locator("svg");
   const original=await imagem.getAttribute("viewBox");
   expect(original).toBeTruthy();
   const municipios=await imagem.locator("path[data-city]").count();
   expect(municipios).toBeGreaterThan(5400);
   await mapa.getByRole("button",{name:"Ampliar mapa"}).click();
   await expect.poll(()=>imagem.getAttribute("viewBox")).not.toBe(original);
   await expect(mapa).toHaveAttribute("data-zoom",/^(?!1\.00)/);
   await mapa.getByRole("button",{name:"Restaurar enquadramento do mapa"}).click();
   await expect(imagem).toHaveAttribute("viewBox",original);
   await expect(page.getByText("MUNICÍPIOS NO MAPA")).toHaveCount(0);
  });

  test("segundo turno, localização municipal e distinção de dados",async({page})=>{
   await page.goto(url,{waitUntil:"domcontentloaded"});
   await page.getByRole("button",{name:/2º TURNO/}).click();
   await expect(page.getByText("25/10/2026",{exact:false}).first()).toBeVisible();
   await page.locator("#eleicao-uf").selectOption("SP");
   await expect(page.locator("#eleicao-busca")).toBeVisible();
   await page.locator("#eleicao-busca").fill("Araras");
   await expect(page.locator("#eleicao-cidade").locator("option",{hasText:"Araras"})).toHaveCount(1,{timeout:20000});
   const codigoAraras=await page.locator("#eleicao-cidade option").filter({hasText:/araras/i}).getAttribute("value");
   expect(codigoAraras).toBeTruthy();
   await page.locator("#eleicao-cidade").selectOption(codigoAraras);
   await expect(page.getByRole("heading",{name:/Araras.*RESULTADOS/i})).toBeVisible();
   const segundaRodada=page.locator("section").filter({has:page.getByRole("heading",{name:/COMPARAÇÃO TERRITORIAL/})});
   await expect(segundaRodada).not.toContainText("ESCRITOR AUGUSTO CURY");
   await page.getByRole("button",{name:/VOLTAR AO BRASIL/}).click();
   await expect(page.locator("#eleicao-uf")).toHaveValue("BR");
  });

  test("layout não cria rolagem lateral de página",async({page})=>{
   await page.goto(url,{waitUntil:"domcontentloaded"});
   await expect(page.getByRole("heading",{name:/ELEIÇÕES 2026/})).toBeVisible();
   const diagnostico=await page.evaluate(()=>{
    const largura=window.innerWidth;
    const excesso=Math.max(document.documentElement.scrollWidth,document.body.scrollWidth)-largura;
    const elementos=[...document.body.querySelectorAll("*")].flatMap(el=>{
     const r=el.getBoundingClientRect();
     if(r.right<largura+5||r.width===0)return [];
     const cs=getComputedStyle(el);
     return [{elemento:el.tagName.toLowerCase(),classe:String(el.className).slice(0,80),right:Math.round(r.right),width:Math.round(r.width),posicao:cs.position,overflow:cs.overflowX}];
    }).slice(0,25);
    return {largura,excesso,elementos};
   });
   console.log("DIAGNOSTICO-LARGURA "+configuracao.nome+" "+JSON.stringify(diagnostico));
   expect(diagnostico.excesso).toBeLessThanOrEqual(5);
  });
 });
}
