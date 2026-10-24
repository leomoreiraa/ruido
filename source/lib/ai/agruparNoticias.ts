
export type MancheteVerificada = { url: string; title: string; group: string; published: string };

const COMMON = new Set([
  "deputado","deputada","senador","senadora","federal","congresso","brasil",
  "politica","politico","politicos","camara","senado","poder","parlamentar",
  "afirma","diz","disse","fala","sobre","apos","segundo","para","pelo",
  "pela","pelos","pelas","entre","contra","com","uma","das","dos","por",
  "que","seus","suas","seu","sua","veja","entenda","saiba","novo",
  "nova","hoje","ontem","amanha","ainda","mais","menos","parte",
  "eleicao","eleicoes","governo","municipio","estado","politica",
  "noite","semana","ano","anos","sera","estao","este","esta",
  "agencia","noticias","news","exclusivo","urgente","atualizado",
]);
export function termosDeEvento(headline: string, pessoa: string): Set<string> {
  const normalize = (s: string) => s.normalize("NFKD")
    .replace(/[\u0300-\u036f]/g,"").toLowerCase();
  const names = new Set(normalize(pessoa).split(/[^a-z0-9]+/).filter(Boolean));
  const clean = normalize(headline).replace(/\s+[—–|-]\s+[^—–|]+$/, "");
  return new Set((clean.match(/[a-z0-9]{5,}/g) || [])
    .filter(w => !COMMON.has(w) && !names.has(w) && !/^\d+$/.test(w)));
}
export function sobreposicaoEvento(a: Set<string>, b: Set<string>): number {
  return [...a].filter(w => b.has(w)).length;
}
export function agruparReportagens<T extends MancheteVerificada>(
  articles: T[], pessoa: string, minGrupos = 4,
): T[][] {
  const ordered = articles.filter(a => Number.isFinite(Date.parse(a.published)))
    .slice().sort((a,b)=>Date.parse(b.published)-Date.parse(a.published));
  const tokens = ordered.map(a=>termosDeEvento(a.title,pessoa));
  const out: T[][] = [];
  const seen = new Set<string>();
  for (let i=0;i<ordered.length;i++) {
    if (tokens[i].size < 2) continue;
    const grupo = [ordered[i]];
    const chosen = new Set([ordered[i].group]);
    for (let j=0;j<ordered.length;j++) {
      if (i===j || chosen.has(ordered[j].group)) continue;
      if (Math.abs(Date.parse(ordered[i].published)-Date.parse(ordered[j].published))>14*86400000) continue;
      if (sobreposicaoEvento(tokens[i],tokens[j])<2) continue;
      grupo.push(ordered[j]);chosen.add(ordered[j].group);
    }
    if (chosen.size<minGrupos)continue;
    const key=grupo.map(a=>a.url).sort().join("|");
    if(!seen.has(key)){out.push(grupo);seen.add(key)}
  }
  return out.sort((a,b)=>b.length-a.length).slice(0,4);
}
