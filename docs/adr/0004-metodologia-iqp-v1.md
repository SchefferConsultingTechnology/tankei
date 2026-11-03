# ADR 0004: Metodologia do IQP, versão 1

- **Status:** aceito
- **Data:** 2026-11-02

## Contexto

O Índice de Qualidade do Posto (IQP) mede a experiência do motorista no posto. O plano inicial propunha 5 dimensões com pesos, e o código tinha 7 critérios diferentes. Esta decisão junta os dois e define o cálculo da primeira versão.

O IQP é centrado na experiência do consumidor. A confiança nos dados aparece como um indicador separado, e o preço não entra no índice. O IQP também não certifica a qualidade do combustível nem substitui a fiscalização da ANP.

No piloto em Curitibanos (ADR 0002) serão só 10 postos e poucas avaliações. As regras precisam funcionar bem com pouco volume de dados.

## Decisão

### Critérios e dimensões

O motorista avalia **critérios** simples. O IQP agrupa os critérios em **dimensões** com peso:

| Dimensão | Peso | Critérios | Escala |
|---|---|---|---|
| Atendimento e agilidade | 30% | `atendimento` | 1 a 5 |
| Limpeza e infraestrutura | 25% | `limpeza`, `banheiro` | 1 a 5 |
| Transparência | 20% | `preco_conforme`: "O preço na bomba era o anunciado?" | sim/não |
| Serviços e conveniência | 15% | `calibrador`, `conveniencia`, `formas_pagamento` | 1 a 5 |
| Segurança | 10% | `seguranca` | 1 a 5 |

A "satisfação geral" proposta no plano não entra no índice, porque repete o que os outros critérios já medem.

### Cálculo

- **Escala:** notas de 1 a 5 são convertidas para 0 a 100 (1 = 0, 5 = 100). Em `preco_conforme`, "sim" vale 100 e "não" vale 0. Dentro de cada dimensão, os critérios têm o mesmo peso.
- **Não disponível:** um item que o posto não tem (por exemplo, sem banheiro) sai da conta. Se uma dimensão inteira ficar sem dados, seu peso é redistribuído proporcionalmente entre as demais.
- **Poucas avaliações:** cada critério começa puxado para a média dos postos da cidade, como se o posto já tivesse 5 avaliações com essa média. Conforme chegam avaliações reais, a nota passa a refletir o posto.
- **Avaliações antigas:** cada avaliação perde metade do peso a cada 180 dias.
- **Mínimo para exibir:** a nota só aparece com avaliações de pelo menos 3 pessoas diferentes. Abaixo disso, o app mostra "Dados insuficientes", nunca uma nota baixa.

### Uma avaliação por pessoa

Cada pessoa pode avaliar o mesmo posto uma vez a cada 30 dias. A avaliação mais recente substitui a anterior no cálculo, mas as duas ficam no histórico.

### Confiança

Exibida separada da nota, com base na soma dos pesos das avaliações depois do decaimento ("avaliações efetivas"):

| Confiança | Avaliações efetivas |
|---|---|
| Baixa | menos de 5 |
| Média | 5 a 15 |
| Alta | mais de 15 |

### Versão e auditoria

- O cálculo acontece só no backend.
- `IQP_METHODOLOGY_VERSION` passa para `1.0.0` quando este cálculo for implementado.
- Cada nota calculada registra a versão da metodologia e a contribuição de cada dimensão, para explicar e auditar a nota.

## Consequências

- O app de avaliação mostra os critérios agrupados por dimensão, com a opção "não disponível" em cada um, e a pergunta de sim/não sobre o preço.
- A média da cidade é recalculada periodicamente e entra no cálculo de cada posto. Uma mudança nela altera a nota de postos com poucas avaliações.
- Os pesos e números (5 avaliações iniciais, 180 dias, 3 pessoas, 30 dias, faixas de confiança) são hipóteses para o piloto e devem ser revistos com os dados reais. Qualquer mudança gera uma nova versão da metodologia.
