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
pnpm --filter @tankei/api import:ibge     # municípios do IBGE (antes do import:anp numa base nova)
pnpm --filter @tankei/api import:anp BR   # postos do Brasil (ou: SC, ou SC LAGES; sem argumento, Curitibanos)
pnpm --filter @tankei/api import:anp-referencias   # médias semanais de preço da ANP
pnpm --filter @tankei/api user:admin EMAIL         # torna administrador quem já fez login
pnpm dev                         # sobe api, portal, admin e mobile
```

Um app só: `pnpm --filter @tankei/api dev`.

### Dados de demonstração

`pnpm --filter @tankei/api demo:db` recria o banco `tankei_demo` com os postos do banco de desenvolvimento e preços e avaliações **fictícios** (todos os selos, promoção e IQP). O banco de desenvolvimento não é alterado. Suba a API apontando para ele com o comando que o script imprime.

### App mobile no celular

1. Instale o **Expo Go** no celular, conectado à mesma rede Wi-Fi do computador.
2. Crie `apps/mobile/.env` a partir de `apps/mobile/.env.example`, com o IP do computador na rede local (`hostname -I` no Linux). No celular, `localhost` não alcança a API.
3. Suba a API (`pnpm --filter @tankei/api dev`) e o app (`pnpm --filter @tankei/mobile start`), e leia o QR code com o Expo Go (Android) ou a câmera (iOS).

| App    | Endereço                           |
|--------|------------------------------------|
| API    | http://localhost:3333/v1/health    |
| Portal | http://localhost:5173              |
| Admin  | http://localhost:5174              |
| Mobile | Expo Dev Server (QR code no terminal) |

## Plano

O plano de produto, as fases e a arquitetura estão em [docs/referencias/conversa-chatgpt-plano-inicial.md](docs/referencias/conversa-chatgpt-plano-inicial.md). As decisões tomadas estão em [docs/adr/](docs/adr/), e os estudos de negócio em [docs/negocio/](docs/negocio/).

Situação atual:

- **Piloto:** Curitibanos (SC); próxima cidade: Lages (SC). A base tem os ~45 mil postos do Brasil importados da ANP (ADR 0013).
- **API:** busca de postos por proximidade, login com Google e Apple, informes de preço validados pela referência semanal da ANP, preço vigente com selos, avaliações e IQP (metodologia 1.0.0). A base da API do MVP está completa.
- **App mobile (fase A):** mapa e lista pelo menor preço, perto de você ou numa cidade escolhida por estado e cidade (municípios do IBGE, ADR 0014). Mapa com react-native-maps (ADR 0010).
- **App mobile (fase B):** login com Google, avatar da conta, informe de preço e avaliação do posto pelos critérios do IQP (ADR 0004 e 0015). O app roda num APK de desenvolvimento próprio (`pnpm --filter @tankei/mobile android`), não mais no Expo Go.

## Pendências

- **CI no GitHub Actions:** adiada até existir um ambiente para a API; será decidida junto com a infraestrutura. Os testes e2e já criam o próprio banco (`<banco>_test`), então basta um serviço PostGIS no workflow; nenhum segredo é necessário.
- **Coordenadas de 3 postos:** os dois da Gerhardt & Pelegrini e o ALB não têm localização na ANP e não aparecem na busca.
- **Login com Apple:** só quando o app for para o iOS (junto com o cliente iOS do Google, ADR 0015).
- **Auditoria das ações administrativas** (ADR 0007): a remoção do vínculo de gestor ainda não deixa registro.
