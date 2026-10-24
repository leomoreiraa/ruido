# Desenvolvimento e contribuição

[← Documentação](./README.md)

## Stack

O projeto utiliza Next.js 14, React 18, TypeScript, Tailwind CSS, Prisma, SQLite, Node.js, Lucide React e Radix UI. Confira versões e dependências em [source/package.json](../source/package.json).

## Pré-requisitos

Git, Node.js compatível com Next.js 14 (Node.js 20 é uma escolha adequada), npm e um editor. Algumas funcionalidades requerem configuração local de banco ou serviços externos.

## Instalação

```bash
git clone https://github.com/leomoreiraa/ruido.git
cd ruido/source
npm install
npm run dev
```

O servidor de desenvolvimento costuma estar disponível em `http://localhost:3000`. **A instalação isolada não garante execução integral de módulos que dependem de dados ou integrações externas.**

## Persistência local

O schema está em [source/prisma/schema.prisma](../source/prisma/schema.prisma). Em ambiente de desenvolvimento isolado, depois de configurar a conexão local:

```bash
npm run db:generate
npm run db:push
```

Não utilize dados, credenciais ou bancos de produção em testes locais.

## Build

```bash
npm run build
npm run build:ghpages
```

A exportação estática exige compatibilidade das páginas e dados necessários ao build.

## Scripts principais

| Comando | Finalidade |
| --- | --- |
| `npm run dev` | Servidor de desenvolvimento |
| `npm run build` | Geração Prisma e build Next.js |
| `npm run start` | Execução da aplicação compilada |
| `npm run db:generate` | Geração do cliente Prisma |
| `npm run db:push` | Sincronização do schema |
| `npm run db:migrate` | Migrações de desenvolvimento |
| `npm run build:ghpages` | Preparação de exportação estática |
| `npm run build:historico` | Preparação de dados históricos |
| `npm run build:regional` | Preparação de dados regionais |

Existem rotinas adicionais de sincronização e processamento no código. Elas podem modificar dados e consultar serviços externos; examine o código antes de executá-las.

## Estrutura

```text
source/
├── app/          # Páginas, rotas e layouts
├── components/   # Interface e visualizações
├── lib/          # Serviços e regras de domínio
├── prisma/       # Modelo relacional
├── scripts/      # Coleta, processamento e exportação
└── package.json  # Dependências e comandos
```

## Como contribuir

Abra uma [issue](https://github.com/leomoreiraa/ruido/issues), crie uma branch no seu fork, faça alterações documentadas e valide o comportamento em ambiente local. Envie um pull request com descrição e passos de verificação.

Não publique tokens, credenciais, bancos de dados, arquivos de ambiente preenchidos ou informações pessoais não públicas. Vulnerabilidades não devem ser detalhadas em issues públicas.
