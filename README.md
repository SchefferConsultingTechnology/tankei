# Tankei

> Nome provisório. Pode mudar.

Plataforma para encontrar postos de combustível com o melhor preço e a melhor experiência. Ela combina preços colaborativos, geolocalização, ofertas dos postos e o **IQP**, o Índice de Qualidade do Posto.

- **Motorista:** usa o app de graça, sem precisar de cadastro para consultar.
- **Posto:** paga para gerenciar o próprio cadastro, preços e campanhas.
- **IQP:** calculado só no backend, com metodologia versionada. Patrocínio não altera a nota.

## Estrutura

```text
tankei/
├── apps/
│   ├── api/       # NestJS: API REST (/v1)
│   ├── portal/    # React + Vite: portal dos postos
│   ├── admin/     # React + Vite: backoffice e moderação
│   └── mobile/    # React Native + Expo: app do motorista
├── packages/
│   └── shared/    # Tipos e regras de domínio compartilhados
├── docs/
│   ├── adr/         # Decisões de arquitetura
│   └── referencias/ # Material de origem (plano inicial)
└── docker-compose.yml  # PostgreSQL 17 + PostGIS
```

## Requisitos

- Node.js 22+
- pnpm 10 (`corepack enable` ou `corepack pnpm ...`)
- Docker

## Primeiros passos

```bash
pnpm install
pnpm db:up                       # PostGIS em localhost:5433
cp apps/api/.env.example apps/api/.env
pnpm --filter @tankei/shared build
pnpm db:migrate                  # aplica as migrations do Drizzle
pnpm --filter @tankei/api import:anp   # importa os postos de Curitibanos (API da ANP)
pnpm --filter @tankei/api import:anp-referencias   # médias semanais de preço da ANP
pnpm --filter @tankei/api user:admin EMAIL         # torna administrador quem já fez login
pnpm dev                         # sobe api, portal, admin e mobile
```

Um app só: `pnpm --filter @tankei/api dev`.

| App    | Endereço                           |
|--------|------------------------------------|
| API    | http://localhost:3333/v1/health    |
| Portal | http://localhost:5173              |
| Admin  | http://localhost:5174              |
| Mobile | Expo Dev Server (QR code no terminal) |

## Plano

O plano de produto, as fases e a arquitetura estão em [docs/referencias/conversa-chatgpt-plano-inicial.md](docs/referencias/conversa-chatgpt-plano-inicial.md). As decisões tomadas estão em [docs/adr/](docs/adr/).

Situação atual:

- **Piloto:** Curitibanos (SC), com os 10 postos importados da ANP.
- **API:** busca de postos por proximidade, login com Google e Apple, informes de preço validados pela referência semanal da ANP, preço vigente com selos, avaliações e IQP (metodologia 1.0.0). A base da API do MVP está completa.
- **Em andamento:** app mobile, com mapa react-native-maps (ADR 0010).

## Pendências

- **CI no GitHub Actions:** adiada até existir um ambiente para a API; será decidida junto com a infraestrutura. Os testes e2e já criam o próprio banco (`<banco>_test`), então basta um serviço PostGIS no workflow; nenhum segredo é necessário.
- **Coordenadas de 3 postos:** os dois da Gerhardt & Pelegrini e o ALB não têm localização na ANP e não aparecem na busca.
- **Login com contas reais:** criar as credenciais OAuth no Google Cloud e preencher `GOOGLE_CLIENT_IDS` (a Apple só quando o app for para o iOS).
- **Auditoria das ações administrativas** (ADR 0007): a remoção do vínculo de gestor ainda não deixa registro.
