import OpenAI from "openai";
import { prisma } from "@/lib/prisma";
import { ResumoIAItem } from "@/lib/types";
import { normalizarTexto } from "@/lib/utils";

export interface OpcoesResumoIA {
  apiKey?: string;
  modelo?: string;
  forcar?: boolean;
}

export interface ResultadoExtracaoIA {
  keywords: string[];
  resumo: string;
  modeloUsado: string;
}

const STOPWORDS_PT = new Set([
  "de", "a", "o", "que", "e", "do", "da", "em", "um", "para", "é", "com", "não",
  "uma", "os", "no", "se", "na", "por", "mais", "as", "dos", "como", "mas", "foi",
  "ao", "ele", "das", "tem", "à", "seu", "sua", "ou", "ser", "quando", "muito",
  "há", "nos", "já", "está", "eu", "também", "só", "pelo", "pela", "até", "isso",
  "ela", "entre", "era", "depois", "sem", "mesmo", "aos", "ter", "seus", "quem",
  "nas", "me", "esse", "eles", "estão", "você", "tinha", "foram", "essa", "num",
  "nem", "suas", "meu", "às", "minha", "têm", "numa", "pelos", "elas", "havia",
  "seja", "qual", "será", "nós", "tenho", "lhe", "deles", "essas", "esses", "pelas",
  "este", "fosse", "dele", "tu", "te", "vocês", "vos", "lhes", "meus", "minhas",
  "teu", "tua", "teus", "tuas", "nosso", "nossa", "nossos", "nossas", "dela", "delas",
  "esta", "estes", "estas", "aquele", "aquela", "aqueles", "aquelas", "isto", "aquilo",
  "estou", "está", "estamos", "estão", "estive", "esteve", "estivemos", "estiveram",
  "estava", "estávamos", "estavam", "estivera", "estivéramos", "esteja", "estejamos",
  "estejam", "estivesse", "estivéssemos", "estivessem", "estiver", "estivermos",
  "estiverem", "hei", "havemos", "hão", "houve", "houvemos", "houveram", "houvera",
  "houvéramos", "haja", "hajamos", "hajam", "houvesse", "houvéssemos", "houvessem",
  "houver", "houvermos", "houverem", "houverei", "houverá", "houveremos", "houverão",
  "houveria", "houveríamos", "houveriam", "sou", "somos", "são", "era", "éramos",
  "eram", "fui", "fomos", "foram", "fora", "fôramos", "seja", "sejamos", "sejam",
  "fosse", "fôssemos", "fossem", "for", "formos", "forem", "serei", "será", "seremos",
  "serão", "seria", "seríamos", "seriam", "tenho", "tem", "temos", "tém", "tinha",
  "tínhamos", "tinham", "tive", "teve", "tivemos", "tiveram", "tivera", "tivéramos",
  "tenha", "tenhamos", "tenham", "tivesse", "tivéssemos", "tivessem", "tiver",
  "tivermos", "tiverem", "terei", "terá", "teremos", "terão", "teria", "teríamos",
  "teriam", "sr", "sra", "srs", "sras", "presidente", "deputado", "deputada",
  "senador", "senadora", "plenário", "casa", "tribuna", "orador", "revisão",
  "ordem", "voto", "sim", "não", "pela", "sobre", "aqui", "neste", "nesta",
  "deste", "desta", "disse", "apenas", "ainda", "assim", "onde", "então", "pois"
]);

/**
 * Extrai 5 palavras-chave e resumo sintético a partir de textos de discursos,
 * garantindo fallback determinístico e neutro na ausência de API Key.
 */
export function extrairResumoAlgoritmico(
  textos: Array<{ transcricao: string; sumario?: string | null }>
): ResultadoExtracaoIA {
  const frequenciaPalavras = new Map<string, number>();
  const frasesRelevantes: string[] = [];

  for (const item of textos) {
    if (item.sumario && item.sumario.trim().length > 20) {
      frasesRelevantes.push(item.sumario.trim());
    }

    const conteudo = `${item.sumario || ""} ${item.transcricao || ""}`;
    const palavras = conteudo
      .toLowerCase()
      .replace(/[^a-záàâãéèêíïóôõöúçñ\s]/gi, " ")
      .split(/\s+/)
      .filter((p) => p.length >= 4 && !STOPWORDS_PT.has(p));

    for (const p of palavras) {
      frequenciaPalavras.set(p, (frequenciaPalavras.get(p) || 0) + 1);
    }
  }

  const termosOrdenados = Array.from(frequenciaPalavras.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([palavra]) => palavra.toUpperCase());

  const keywords: string[] = [];
  for (const termo of termosOrdenados) {
    if (keywords.length >= 5) break;
    if (!keywords.includes(termo)) {
      keywords.push(termo);
    }
  }

  const fallbackKeywords = ["ORÇAMENTO", "TRANSPARÊNCIA", "FISCALIZAÇÃO", "SAÚDE", "EDUCAÇÃO"];
  for (const fb of fallbackKeywords) {
    if (keywords.length >= 5) break;
    if (!keywords.includes(fb)) {
      keywords.push(fb);
    }
  }

  let linha1 = "Atuação concentrada na tramitação legislativa em plenário com pronunciamentos regulares sobre políticas públicas.";
  let linha2 = "Foco temático priorizado nas pautas de " + keywords.slice(0, 3).join(", ").toLowerCase() + " e desenvolvimento regional.";
  let linha3 = "Intervenções frequentes em orientações de bancada, fiscalização de projetos e deliberações das comissões temáticas.";

  if (frasesRelevantes.length > 0) {
    const primeiraFrase = frasesRelevantes[0];
    const limpa = primeiraFrase.replace(/^O Deputado|^A Deputada|^O Senador|^A Senadora/i, "Pronunciamentos com destaque para").trim();
    if (limpa.length > 30) {
      linha1 = limpa.slice(0, 140) + (limpa.length > 140 ? "..." : "");
    }
  }

  const resumo = `${linha1}\n${linha2}\n${linha3}`;

  return {
    keywords: keywords.slice(0, 5),
    resumo,
    modeloUsado: "extrativo-tematico-v1",
  };
}

/**
 * Gera ou atualiza o perfil temático/ideológico de um parlamentar
 * baseado nos seus últimos 20 pronunciamentos em plenário.
 */
export async function gerarResumoTematicoParlamentar(
  parlamentarId: string,
  options: OpcoesResumoIA = {}
): Promise<ResumoIAItem | null> {
  if (!options.forcar) {
    const existente = await prisma.resumoIA.findFirst({
      where: { parlamentarId },
      orderBy: { geradoEm: "desc" },
    });

    if (existente) {
      let parsedKeywords: string[] = [];
      try {
        parsedKeywords = JSON.parse(existente.keywords);
      } catch {
        parsedKeywords = existente.keywords.split(",").map((k) => k.trim());
      }

      return {
        id: existente.id,
        parlamentarId: existente.parlamentarId,
        keywords: parsedKeywords,
        resumo: existente.resumo,
        modeloUsado: existente.modeloUsado,
        geradoEm: existente.geradoEm,
      };
    }
  }

  const discursos = await prisma.discurso.findMany({
    where: { parlamentarId },
    orderBy: { dataHora: "desc" },
    take: 20,
    select: {
      id: true,
      dataHora: true,
      faseEvento: true,
      sumario: true,
      transcricao: true,
    },
  });

  if (discursos.length === 0) {
    return null;
  }

  const apiKey = options.apiKey || process.env.OPENAI_API_KEY;
  const modeloEscolhido = options.modelo || process.env.OPENAI_MODEL || "gpt-4o-mini";

  let resultadoIA: ResultadoExtracaoIA;

  if (apiKey) {
    try {
      const openai = new OpenAI({ apiKey });

      const corpus = discursos
        .map((d, i) => {
          const dataIso = d.dataHora.toISOString().split("T")[0];
          const resumoTxt = d.sumario ? `Sumário: ${d.sumario}` : "";
          const trechoTexto = d.transcricao.slice(0, 600);
          return `[Discurso ${i + 1} - ${dataIso} - ${d.faseEvento || "Plenário"}]\n${resumoTxt}\n${trechoTexto}`;
        })
        .join("\n\n---\n\n");

      const promptSistema =
        "Você é um analista político neutro, institucional e objetivo.\n" +
        "Com base exclusivamente nas transcrições dos pronunciamentos em plenário fornecidos a seguir, realize duas tarefas:\n" +
        "1. Extraia exatamente 5 palavras-chave mais recorrentes e representativas das bandeiras e temas defendidos pelo parlamentar (em CAIXA ALTA).\n" +
        "2. Escreva um parágrafo analítico de exatamente 3 linhas resumindo com clareza o foco temático, as principais pautas e a atuação parlamentar dele.\n" +
        "Retorne exclusivamente um JSON no formato: {\"keywords\": [\"PALAVRA1\", \"PALAVRA2\", \"PALAVRA3\", \"PALAVRA4\", \"PALAVRA5\"], \"resumo\": \"linha1\\nlinha2\\nlinha3\"}";

      const completion = await openai.chat.completions.create({
        model: modeloEscolhido,
        messages: [
          { role: "system", content: promptSistema },
          { role: "user", content: corpus },
        ],
        response_format: { type: "json_object" },
        temperature: 0.2,
      });

      const rawContent = completion.choices[0]?.message?.content || "{}";
      const parsed = JSON.parse(rawContent) as {
        keywords?: string[];
        resumo?: string;
      };

      if (
        Array.isArray(parsed.keywords) &&
        parsed.keywords.length >= 3 &&
        typeof parsed.resumo === "string" &&
        parsed.resumo.trim().length > 20
      ) {
        resultadoIA = {
          keywords: parsed.keywords.slice(0, 5).map((k) => String(k).toUpperCase()),
          resumo: parsed.resumo.trim(),
          modeloUsado: modeloEscolhido,
        };
      } else {
        resultadoIA = extrairResumoAlgoritmico(discursos);
      }
    } catch (err) {
      console.warn(
        `[ResumoIA] Falha na chamada da OpenAI para parlamentar ${parlamentarId} (${
          err instanceof Error ? err.message : String(err)
        }). Aplicando extrator determinístico de segurança.`
      );
      resultadoIA = extrairResumoAlgoritmico(discursos);
    }
  } else {
    resultadoIA = extrairResumoAlgoritmico(discursos);
  }

  const novoRegistro = await prisma.resumoIA.create({
    data: {
      parlamentarId,
      keywords: JSON.stringify(resultadoIA.keywords),
      resumo: resultadoIA.resumo,
      modeloUsado: resultadoIA.modeloUsado,
    },
  });

  const idsDiscursos = discursos.map((d) => d.id);
  await prisma.discurso.updateMany({
    where: { id: { in: idsDiscursos } },
    data: { analisadoPorIA: true },
  });

  return {
    id: novoRegistro.id,
    parlamentarId: novoRegistro.parlamentarId,
    keywords: resultadoIA.keywords,
    resumo: novoRegistro.resumo,
    modeloUsado: novoRegistro.modeloUsado,
    geradoEm: novoRegistro.geradoEm,
  };
}

/**
 * Processa em lote a geração de resumos de IA para parlamentares que possuam
 * discursos indexados mas ainda não possuam resumo gerado.
 */
export async function gerarResumosIAParlamentares(
  options: { limite?: number; forcar?: boolean } = {}
): Promise<{ total: number; gerados: number; erros: number }> {
  const parlamentaresComDiscursos = await prisma.parlamentar.findMany({
    where: {
      discursos: { some: {} },
      ...(options.forcar ? {} : { resumosIA: { none: {} } }),
    },
    select: { id: true, nome: true },
    take: options.limite ?? 50,
  });

  let gerados = 0;
  let erros = 0;

  for (const p of parlamentaresComDiscursos) {
    try {
      const res = await gerarResumoTematicoParlamentar(p.id, {
        forcar: options.forcar,
      });
      if (res) gerados++;
    } catch (err) {
      erros++;
      console.warn(`[ResumoIA] Erro ao processar resumo do parlamentar ${p.nome}:`, err);
    }
  }

  return {
    total: parlamentaresComDiscursos.length,
    gerados,
    erros,
  };
}
