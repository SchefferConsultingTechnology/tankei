# ADR 0036: Ambiente atual é de teste; homologação terá banco novo

- **Status:** aceito
- **Data:** 2026-11-07

## Contexto

A API, o portal e o admin estão publicados no Render, com o banco no Supabase, e o app está instalado só no celular do autor. Nada está disponível para clientes: todo uso até aqui é teste.

## Decisão

- **Ambiente atual:** é **de teste**. O banco pode receber **dados fictícios** para visualização (por exemplo, o dashboard de adesão do admin), sempre identificados:
  - redes com "(fictício)" no nome;
  - contas com e-mail `@ficticio.tankei.test`.
- **Homologação:** quando a plataforma for aberta a testes com postos e motoristas, haverá **um banco novo**:
  - as migrations rodam do zero;
  - os parâmetros recebem os valores iniciais;
  - o cadastro da ANP (e do IBGE) é importado de novo.
  - Nenhum dado do banco de teste é levado.
- **Scripts:** os scripts de carga (`seed-*`) devem rodar em qualquer banco e nunca no de homologação ou produção sem decisão explícita.

## Consequências

- Os preços, avaliações, redes e convênios lançados até aqui não valem como histórico.
- O app de teste aponta para a API atual. Antes da homologação, a versão distribuída aos testadores precisa apontar para o ambiente novo.
