# ADR 0038: Dashboard de engajamento dos motoristas

- **Status:** aceito
- **Data:** 2026-11-07
- **Complementa:** ADR 0036 (ambiente de teste), 0037 (dashboard de adesão)

## Contexto

Para direcionar o marketing por estado e cidade, é preciso saber onde os motoristas usam o Tankei: em quais postos informam preços e fazem avaliações, e onde há muitos postos sem nenhuma interação.

## Decisão

- **O que conta:** só interações de **motoristas**: informes de preço com origem `usuario` (inclusive os recusados, porque também são uso) e avaliações. Preços informados pelos próprios postos ficam no dashboard de adesão.
- **Rota:** `GET /v1/admin/dashboard/engagement`, com os mesmos filtros e o mesmo agrupamento do dashboard de adesão.
- **Indicadores:**
  - postos com interação e a **cobertura** (a parte dos postos da ANP no recorte);
  - informes de preço e avaliações, com quantos postos receberam cada um;
  - **motoristas ativos** (informaram ou avaliaram);
  - informes por motorista.
  - Informes, avaliações e motoristas ativos são comparados com o período anterior.
- **Por região:**
  - sem estado no filtro, os estados (todos);
  - com estado, as cidades: até 60, primeiro todas as que tiveram interação, depois as maiores sem interação.
  - **Tabela:** postos, postos com interação, cobertura, informes, avaliações e motoristas, ordenável por qualquer coluna.
- **Gráficos:**
  - informes de preço e avaliações por período, em dois gráficos de coluna (as escalas são muito diferentes);
  - cobertura por região;
  - **oportunidades de marketing**: regiões com pelo menos 20 postos e menos de 10% de cobertura, das maiores para as menores. Esses limites são de leitura do painel, não regras de negócio.
- **Peças comuns:** filtros, indicadores, cartões e barras ficam em `dashboard-kit` e `dashboard-utils`, para os dois dashboards.
- **Barras horizontais:** uma grade única para a lista toda, para que os comprimentos sejam comparáveis entre as linhas.
- **Dados fictícios:** `pnpm --filter @tankei/api demo:engagement` (com `DEMO_DATABASE_URL`) grava 80 motoristas fictícios, informes e avaliações em 15 cidades de SC, PR, RS e SP nos últimos 12 meses, e recalcula o IQP. Já foi rodado no banco de teste do Supabase.

## Consequências

- Um motorista que informa em várias cidades conta como ativo em cada uma; no total, conta uma vez.
- **Próximos passos possíveis:**
  - contar também as fichas abertas e as rotas traçadas, que exigem registrar esses eventos no app;
  - mostrar um mapa de calor por município.
