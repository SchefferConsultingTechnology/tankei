# ADR 0024: Peso dos informes, divergência e moderação (fase 2)

- **Status:** aceito
- **Data:** 2026-11-06
- **Detalha:** ADR 0020 (fase 2). **Altera:** ADR 0003 (preço exibido). **Complementa:** ADR 0006 e 0009.

## Contexto

O ADR 0020 decidiu as proteções da fase 2 (contestação, divergência, peso por confiabilidade, "estava no posto", rajada e desempate). Faltava definir as regras de cálculo, o que fica gravado e os números iniciais.

## Decisão

### O que cada informe de consumidor grava na entrada

- `at_station`: se a pessoa estava a até `price.near_station_m` (300 m) do posto. O app envia a posição; a API calcula e **guarda só sim ou não**, nunca a posição (ADR 0009). Sem posição: nulo.
- `reporter_trusted`: se a conta já era confiável. Confiável é a conta com pelo menos `price.trusted_min_account_days` (3) dias e `price.trusted_min_accepted_reports` (1) informe anterior aceito, ou seja, válido e não anulado.
- `confirmation_weight`: peso na confirmação. Conta não confiável: 0, porque informa mas não confirma o informe de outra pessoa. No posto: 1. Longe ou sem localização: `price.away_weight_pct` (50%).

Os três ficam gravados como na entrada, como a distância da média ANP: a decisão continua explicável depois que os parâmetros mudam. Informes anteriores à regra valem 1.

### Preço exibido

- **Confirmação:** a soma dos pesos de pessoas diferentes (cada pessoa conta pelo maior peso) precisa chegar a `price.confirmations_required`.
- **Desempate entre consumidores:** a partir do informe mais recente, olha-se a janela de confirmação. Concorrem os valores confirmados ou com algum informe válido. Vence a maior soma de pesos; empate, o mais recente. Se houver outro valor na janela, o app recebe `otherValueReported`.
- **Divergência:** consumidores que confirmam, depois do preço do posto, um valor diferente não o substituem na hora. O preço do posto continua, com `divergence` (valor e prazo). O posto tem `price.divergence_response_hours` (24 h), contadas da confirmação, para:
  - **reconfirmar:** um novo preço do posto encerra a divergência;
  - **contestar.**

  Sem resposta no prazo, vale o valor dos consumidores.

### Moderação

- **Casos:** o caso reúne informes de um combustível de um posto e é de dois tipos:
  - **contestação:** aberta pelo posto, com motivo, por papéis com a ação `contest` (proprietário e gestor);
  - **rajada:** aberta pelo sistema quando `price.burst_min_reports` (3) pessoas informam o mesmo valor em `price.burst_window_minutes` (60), de contas não confiáveis ou sem estar no posto, e o valor se afasta do preço que valeria sem eles mais que `price.variation_confirm_pct`.
- **Efeito no preço:** informes de caso em análise e informes anulados não contam no preço exibido. Mantidos voltam a contar.
- **Decisão:** a equipe Tankei decide no admin, com explicação que o posto vê no portal.
- **Registro:** casos, informes dos casos e decisões são só inserção. O informe original nunca muda.

### Testes

O banco de testes e2e começa com peso neutro (qualquer conta confia, distância vale 1), porque as contas de teste são criadas na hora. O teste da fase 2 aplica os valores de produção só na própria instância.

## Consequências

- Um concorrente precisa de contas antigas, com histórico aceito e no posto para mudar o preço; e, mesmo assim, o posto tem 24 h para responder.
- No começo do piloto, contas recém-criadas não confirmam nada por 3 dias. Os números estão na tela de Parâmetros do admin (ADR 0023).
- Cada informe de consumidor faz algumas consultas a mais (confiança e rajada), aceitável no volume do piloto.
