# RUÍDO — Código-fonte da aplicação

Esta pasta reúne a implementação do RUÍDO para consulta, estudo e contribuição.

## Organização

- [`app/`](./app/) — páginas, layouts e rotas da aplicação.
- [`components/`](./components/) — componentes de interface e visualizações.
- [`lib/`](./lib/) — serviços, integrações e regras de domínio.
- [`prisma/`](./prisma/) — modelagem relacional e persistência.
- [`scripts/`](./scripts/) — processamento, sincronização e exportação.
- [`package.json`](./package.json) — dependências e comandos disponíveis.

## Documentação

Consulte a [documentação completa](../docs/README.md) para conhecer funcionalidades, arquitetura, modelo de dados, metodologia, recursos de IA e desenvolvimento local.

## Desenvolvimento

```bash
npm install
npm run dev
```

Algumas funcionalidades exigem configuração local de banco de dados e serviços externos. A exportação estática apresenta conteúdo previamente preparado; rotas dinâmicas do Next.js não estão necessariamente disponíveis como serviços no site publicado.

Não inclua credenciais, bancos de dados ou informações pessoais não públicas em commits.
