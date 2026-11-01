# Tankei

Monorepo (pnpm workspaces + Turborepo) de uma plataforma de preços e qualidade de postos de combustível. "Tankei" é um nome provisório.

- `apps/api`: NestJS. Prefixo global `/v1`, porta 3333.
- `apps/portal`, `apps/admin`: React + Vite + TypeScript.
- `apps/mobile`: Expo. Leia `apps/mobile/AGENTS.md` antes de mexer, porque as APIs do Expo mudam a cada SDK.
- `packages/shared`: tipos de domínio (combustíveis, critérios do IQP). Rode o build antes dos apps.
- Banco: PostgreSQL + PostGIS via `docker compose`, porta 5433.

## Regras de domínio

- O IQP é calculado **só no backend**, com versão da metodologia (`IQP_METHODOLOGY_VERSION`). Os clientes apenas exibem o resultado.
- Preço não entra no IQP. Anúncio pago não altera a nota nem a ordem por menor preço.
- Preços e avaliações nunca são sobrescritos: correções criam registros novos (histórico auditável).
- Item inexistente no posto (por exemplo, sem banheiro) é "não disponível", nunca uma nota baixa.
- Textos de interface em português do Brasil.

## Comandos

Use `pnpm` (se não estiver no PATH: `corepack pnpm`).

```bash
pnpm install
pnpm db:up
pnpm build | pnpm typecheck | pnpm lint | pnpm test
pnpm --filter @tankei/api dev
```
