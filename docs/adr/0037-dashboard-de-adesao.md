# ADR 0037: Dashboard de adesão no admin

- **Status:** aceito
- **Data:** 2026-11-07
- **Complementa:** ADR 0019 (pedidos de acesso), 0021 (redes), 0031 (origem dos pedidos), 0036 (ambiente de teste)

## Contexto

Primeira etapa do plano financeiro: antes de cobrar, é preciso acompanhar quantos postos entram no portal, de onde vêm e se passam a usar o portal (atualizar preços).

## Decisão

- **Aderido:** um posto "aderiu" quando entrou numa rede do portal (`organization_stations.added_at`), por pedido aprovado ou por vínculo feito pela equipe.
- **Rota:** `GET /v1/admin/dashboard/adhesion` (só administradores), com período (`from`, `to`) e recorte opcional por UF e município. Tudo é calculado no banco, no fuso de Brasília.
- **Agrupamento da série:**
  - até 31 dias: por dia;
  - até 6 meses: por semana;
  - acima disso: por mês.
- **Indicadores:**
  - **aderidos:** total e no período, comparados com o período anterior de mesma duração;
  - **participação:** fatia dos postos da ANP no recorte;
  - **pedidos:** em análise, aprovados e recusados;
  - **tempo médio até aprovar;**
  - **atualizando preço:** postos aderidos que informaram preço pelo portal nos últimos 7 dias do período.
- **Gráficos (MUI X Charts 9.16):**
  - adesões por período, em colunas, com a tabela dos mesmos números;
  - acumulado, em linha com área leve;
  - funil (pedidos → aprovados → informam preço);
  - origem dos pedidos;
  - cidades com mais postos aderidos, com o total da cidade na ANP.
- **Cor:** uma cor só (cada gráfico tem uma série), validada nos temas claro e escuro. Os valores ficam ao lado das barras, sem depender da cor.
- **Dados fictícios:** `pnpm --filter @tankei/api demo:adhesion` (com `DEMO_DATABASE_URL`) grava adesões fictícias dos últimos 12 meses, identificadas como manda o ADR 0036, e recusa rodar duas vezes no mesmo banco. Já foi rodado no banco de teste do Supabase.

## Consequências

- O mesmo painel ganha, nas etapas seguintes, a receita (assinaturas e adesão), as despesas e a projeção.
- Postos que saem de uma rede deixam de contar no total. O histórico de saídas pode entrar depois, se for preciso medir a perda de postos.
