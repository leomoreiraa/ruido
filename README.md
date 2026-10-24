# RUÍDO — código aberto e site público

**Dados públicos. Fiscalização cidadã. Código auditável.**

[**Acessar o RUÍDO ↗**](https://ruido.runs-at.dev/) · [**Consultar código-fonte ↗**](source/) · [**Manifesto ↗**](https://ruido.runs-at.dev/sobre/)

Este repositório publica duas coisas:

- **Site estático:** arquivos HTML, CSS, JS e dados de acesso público gerados a partir de snapshots validados.
- **Código-fonte legível em [`source/`](source/):** frontend Next.js/React, componentes, backend (coletores, integrações com APIs e IA), rotas, testes e schema Prisma.

O backend operacional executa no repositório de produção privado; **o código que o compõe é público**. Não são publicados bancos SQLite, checkpoints, chaves, arquivos de ambiente, histórico Git privado e configurações dos GitHub Actions.

Cada versão do código em `source/` traz um `manifest.json` com hashes SHA-256 para auditoria. Alterações devem ser feitas no repositório principal; o espelho é atualizado automaticamente.

> O GitHub Pages hospeda o site estático e não executa os arquivos do backend visíveis em `source/`.
