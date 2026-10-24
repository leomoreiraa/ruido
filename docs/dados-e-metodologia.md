# Dados, fontes e metodologia

[← Documentação](./README.md)

## Fontes institucionais

Conforme o módulo e a disponibilidade dos registros, o projeto contempla:

- [Câmara dos Deputados — Dados Abertos](https://dadosabertos.camara.leg.br/)
- [Senado Federal — Dados Abertos](https://www12.senado.leg.br/dados-abertos)
- [Portal da Transparência](https://portaldatransparencia.gov.br/)
- [IBGE](https://www.ibge.gov.br/)
- [Banco Central — Dados Abertos](https://dadosabertos.bcb.gov.br/)

A menção a uma fonte não implica cobertura integral nem atualização em tempo real.

## Modelo relacional

O schema pode ser consultado em [source/prisma/schema.prisma](../source/prisma/schema.prisma).

| Entidade | Descrição |
| --- | --- |
| `Parlamentar` | Identidade, casa legislativa, partido, UF e vínculos |
| `Proposicao` | Matéria legislativa, ementa, autoria e dados explicativos |
| `Votacao` | Evento, placar, resultado, fonte e cobertura |
| `Voto` | Opção nominal associada a parlamentar e votação |
| `Presenca` | Evidência de presença em sessão, com origem e cobertura |
| `FrequenciaPlenario` | Contagens de sessões auditadas por dia |
| `EmendaParlamentar` | Emendas, valores, finalidade e localidade |
| `BemDeclarado` | Bens informados em declaração eleitoral |
| `Discurso` | Transcrição, data e material associado |
| `ResumoIA` | Resumo ou palavras-chave derivados de conteúdo público |

O modelo também contém estruturas de suporte à sincronização, que não são necessárias para compreender os indicadores públicos.

## Regras de interpretação

**Ausência não é zero.** Um campo vazio pode indicar indisponibilidade, falta de cobertura ou ausência de registro verificável.

**Votação agregada não é voto nominal.** Resultados simbólicos, secretos ou sem relação nominal não autorizam atribuir escolhas a indivíduos. Obstrução e abstenção não são votos contrários.

**Presença depende da cobertura.** Evidências parciais não equivalem a chamada oficial de todas as sessões ou atividades.

**Valores financeiros representam estágios diferentes.** Empenho, liquidação e pagamento não são intercambiáveis. Patrimônio declarado em uma eleição não equivale ao patrimônio atual.

**Tempo e origem importam.** Comparações exigem períodos compatíveis, fonte identificável e metodologia consistente.

**Situação jurídica exige precisão.** Investigação, denúncia, processo, decisão e condenação não são sinônimos. Associação em notícia não comprova responsabilidade.

## Conteúdo derivado

Indicadores, resumos e explicações automáticas são interpretações auxiliares. Sempre que possível, consulte o documento oficial correspondente.

## Correções

[Abra uma issue](https://github.com/leomoreiraa/ruido/issues) com URL, registro, fonte e data de consulta. Evite compartilhar dados pessoais não públicos.
