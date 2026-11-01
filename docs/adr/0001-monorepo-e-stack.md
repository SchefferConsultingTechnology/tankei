# ADR 0001: Monorepo e stack inicial

- **Status:** aceito
- **Data:** 2026-10-30

## Contexto

Teremos três produtos: o app do motorista, o portal dos postos e o backoffice. Eles compartilham o domínio (postos, preços, IQP) e são mantidos inicialmente por uma pessoa.

## Decisão

- Monorepo com pnpm workspaces + Turborepo, com tipos compartilhados em `packages/shared`.
- API em NestJS (TypeScript), REST versionado em `/v1`.
- PostgreSQL + PostGIS para buscas geográficas.
- Portal e admin em React + Vite. App móvel em React Native + Expo.
- Infraestrutura gerenciada no início, sem Kubernetes nem microsserviços.

## Consequências

- Uma única linguagem (TypeScript) em todas as camadas.
- A interface web e a móvel não são compartilhadas. Compartilhamos só tipos, validações e contratos.
- Redis/BullMQ, observabilidade avançada e mapas próprios ficam para quando houver demanda medida.
