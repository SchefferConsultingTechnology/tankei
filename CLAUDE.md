# Tankei

Monorepo (pnpm workspaces + Turborepo) de uma plataforma de preços e qualidade de postos de combustível. "Tankei" é um nome provisório.

- `apps/api`: NestJS. Prefixo global `/v1`, porta 3333.
- `apps/portal`, `apps/admin`: React + Vite + TypeScript.
- `apps/mobile`: Expo SDK 58 com Expo Router (rotas em `src/app/`). Leia `apps/mobile/AGENTS.md` antes de mexer, porque as APIs do Expo mudam a cada SDK. Instale pacotes com `pnpm exec expo install` (versões compatíveis com o SDK). Só `src/components/StationMap.tsx` importa `react-native-maps` (ADR 0010). Respostas da API são validadas com os schemas de `@tankei/shared` em `src/api/`. Cores só por `useTheme()`/`createStyles()` de `src/appearance.tsx` (temas claro e escuro, ADR 0017), nunca valores fixos nas telas.
- `packages/shared`: tipos de domínio e schemas Zod dos contratos da API. Rode o build antes dos apps.
- Banco: PostgreSQL + PostGIS via `docker compose`, porta 5433. Acesso pela API com Drizzle (ADR 0005). Revise o SQL gerado: o drizzle-kit omite o SRID de colunas `geometry` (corrigir para `geometry(point, 4326)`).
- Decisões ficam em `docs/adr/`. Estudos de negócio (hipóteses ainda não validadas) ficam em `docs/negocio/`.

## Regras de domínio

- O IQP é calculado **só no backend**, com versão da metodologia (`IQP_METHODOLOGY_VERSION`). Os clientes apenas exibem o resultado.
- Preço não entra no IQP. Anúncio pago não altera a nota nem a ordem por menor preço.
- Preços e avaliações nunca são sobrescritos: correções criam registros novos (histórico auditável).
- Item inexistente no posto (por exemplo, sem banheiro) é "não disponível", nunca uma nota baixa.
- Textos de interface em português do Brasil.
- Números de regras de negócio (percentuais, prazos, limites) ficam em parâmetros no banco, não no código (ADR 0006). Exceção: a metodologia versionada do IQP.

## Convenções da API (ADR 0008)

- Entrada e saída validadas com schemas Zod de `@tankei/shared`, via `createZodDto` e `@ZodResponse({ status, type })` (nestjs-zod). O `ZodValidationPipe` e o `ZodSerializerInterceptor` são globais.
- Campo que pode ser nulo: use `nullable(schema, descrição)` de `@tankei/shared`, nunca `.nullable()` direto (sem descrição, o Swagger documenta o campo como array).
- Documentação em `/v1/docs` (JSON em `/v1/docs-json`). Nos testes e2e, chame `configureApp(app)` para ter o prefixo `/v1` e o Swagger.
- Rotas, parâmetros e campos em inglês; mensagens de erro em português.
- Toda rota exige login (guard global, ADR 0007). Marque rotas abertas com `@Public()`; perfil com `@Roles('admin')`; usuário com `@CurrentUser()`. Gestor de posto não é perfil: verifique com `UsersService.managesStation`.
- Prefira dependências CommonJS: o Jest não carrega pacotes só ESM no Node 22 (por isso `@nestjs/schedule` 6.x e `jsonwebtoken` em vez de `jose`/`@nestjs/jwt`).

## Comandos

Use `pnpm`. Ele precisa estar no PATH (`corepack enable`): o Turbo procura o binário e falha com `corepack pnpm`.

```bash
pnpm install
pnpm db:up
pnpm db:migrate                  # aplica as migrations (apps/api/drizzle)
pnpm db:generate                 # gera migration após mudar apps/api/src/database/schema
pnpm build | pnpm typecheck | pnpm lint | pnpm test
pnpm --filter @tankei/api dev
pnpm --filter @tankei/api test:e2e     # precisa do container do banco (db:up)
```

Os testes e2e rodam no banco `<banco>_test`, recriado com as migrations a cada execução (`test/global-setup.ts`); podem gravar em tabelas só de inserção (`price_reports`, `parameters`, `price_references`), que bloqueiam UPDATE, DELETE e TRUNCATE por trigger. Os arquivos rodam em paralelo no mesmo banco: use dados próprios (CNPJs e coordenadas distintos) em cada arquivo.
