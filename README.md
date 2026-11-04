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

Para acrescentar os mesmos dados fictícios a um banco que já tem os postos, como o de testes no Supabase: `DEMO_DATABASE_URL='postgresql://...' pnpm --filter @tankei/api demo:seed`. Preços são só de inserção e não podem ser apagados depois; o script recusa rodar de novo no mesmo banco.

### App mobile no celular

O app usa um APK de desenvolvimento próprio (`br.com.tankei.app`), não o Expo Go: o login com Google e o mapa exigem código nativo (ADR 0015).

1. Celular no cabo USB, com a depuração USB ativa.
2. Instale o APK: `pnpm --filter @tankei/mobile android` (a primeira compilação leva cerca de 10 minutos).
3. Encaminhe as portas: `adb reverse tcp:8081 tcp:8081` e `adb reverse tcp:3333 tcp:3333`.
4. Suba a API e o Metro: `EXPO_PUBLIC_API_URL=http://127.0.0.1:3333/v1 pnpm --filter @tankei/mobile exec expo start --dev-client`.

Só é preciso recompilar o APK quando mudar código nativo (pacotes com código nativo ou plugins no `app.json`).

### Hospedagem de testes

API no Render e banco no Supabase, no plano gratuito (ADR 0016). O `render.yaml` define o serviço; o deploy é automático a cada push na `development`, e as migrations rodam na subida. As cargas iniciais rodam do computador, com `DATABASE_URL` apontando para o Supabase:

```bash
DATABASE_URL='postgresql://...pooler.supabase.com:5432/postgres?sslmode=require&uselibpqcompat=true' \
  pnpm --filter @tankei/api import:ibge   # e depois import:anp BR e import:anp-referencias
```

O serviço gratuito dorme após 15 minutos sem uso: a primeira requisição depois disso leva cerca de 1 minuto.

Para usar o app longe do computador, gere o APK de versão, com o JavaScript embutido e a URL do Render. Ele usa a mesma chave de assinatura do APK de desenvolvimento (login com Google e mapa continuam valendo) e o substitui no celular:

```bash
cd apps/mobile && pnpm exec expo prebuild --platform android
cd android && EXPO_PUBLIC_API_URL=https://tankei-api.onrender.com/v1 NODE_ENV=production \
  ./gradlew app:assembleRelease -PreactNativeArchitectures=arm64-v8a
adb install -r app/build/outputs/apk/release/app-release.apk
```

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
