# ADR 0006: Validação de preços pela referência da ANP e regras parametrizadas

- **Status:** aceito
- **Data:** 2026-11-02
- **Complementa:** ADR 0003 (substitui a pendência das faixas fixas por combustível)

## Contexto

O ADR 0003 previa rejeitar preços fora de uma faixa plausível fixa por combustível. Faixas fixas exigem manutenção manual a cada mudança de mercado. A ANP publica toda semana um resumo com preço médio, mínimo e máximo por estado e município, que acompanha o mercado sozinho.

Curitibanos não aparece no resumo (ADR 0002). A média de Santa Catarina tem mais de 100 postos pesquisados para quase todos os combustíveis e é mais estável que a de municípios vizinhos, com poucos postos.

Algumas cidades fazem o **Dia Livre de Impostos**, quando os postos vendem sem tributos e o preço cai de 40% a 45%. Uma validação rígida rejeitaria esses preços verdadeiros.

Além disso, as regras de preço envolvem vários números (percentuais, prazos, limites) que são hipóteses para o piloto. Eles precisam ser ajustados sem alterar código.

## Decisão

### Referência de preço

- A referência de cada combustível é o **preço médio da revenda em Santa Catarina** no resumo semanal da ANP mais recente.
- A gasolina premium não aparece no resumo: usa a referência da **gasolina aditivada**.
- A API importa o resumo semanal e grava as referências em uma tabela só de inserção, com a semana, o estado, o combustível, a média, o mínimo, o máximo e o número de postos pesquisados.
- O nome do arquivo da ANP não segue um padrão fixo: a importação busca o link na página do levantamento.
- Se a ANP atrasar, vale a última referência disponível.

### Três faixas em vez de aceitar ou rejeitar

| Distância da referência | Resultado |
|---|---|
| Até o **limite normal** (padrão 25%) | Aceito (`valido`) |
| Entre o limite normal e o **limite máximo** (padrão 60%) | `suspeito`: só aparece depois que outra pessoa confirmar o mesmo valor, ou se vier do posto |
| Acima do limite máximo | `rejeitado`: erro de digitação |

O Dia Livre de Impostos cai na faixa `suspeito`: não é rejeitado e aparece assim que confirmado. Sem referência disponível, o limite máximo não é aplicado.

A regra de variação do ADR 0003 continua: quando o valor varia mais que o percentual configurado em relação ao preço vigente **do mesmo posto**, o app pede confirmação ao usuário.

### Preço promocional

O posto pode informar um preço com **início e fim**, por exemplo para o Dia Livre de Impostos. Durante o período, o preço aparece com o selo "Promoção" e não passa pelo limite normal, só pelo limite máximo. Ao fim do período, volta a valer o preço normal.

### Regras parametrizadas

Os números das regras de preço ficam em **parâmetros no banco**, não no código. Cada alteração cria um registro novo com autor e data (histórico auditável). Os valores iniciais entram por migration:

| Parâmetro | Valor inicial |
|---|---|
| UF da referência de preço | SC |
| Limite normal de distância da referência | 25% |
| Limite máximo de distância da referência | 60% |
| Variação que pede confirmação ao usuário | 10% |
| Janela para "Confirmado por motoristas" | 48 h |
| Confirmações de pessoas diferentes | 2 |
| Preço "Desatualizado" após | 7 dias |
| Preço deixa de ser exibido após | 30 dias |
| Intervalo mínimo entre informes da mesma conta, mesmo posto e combustível | 2 h |
| Máximo de informes por conta por dia | 30 |
| Intervalo mínimo entre avaliações da mesma conta para o mesmo posto (ADR 0004) | 30 dias |

Informes feitos pelo próprio posto, pelo portal, não têm limite de quantidade.

## Consequências

- Os valores podem ser ajustados durante o piloto sem deploy. No futuro, pelo painel administrativo.
- O código lê os parâmetros do banco, com cache curto, em vez de constantes.
- Cada informe guarda a referência usada na validação, para que a decisão possa ser explicada e auditada mesmo depois de os parâmetros mudarem.
- A importação semanal da ANP passa a ser uma rotina agendada da API.
- Os parâmetros do IQP **não** entram nesta tabela: eles fazem parte da metodologia versionada (ADR 0004), e mudar um peso gera uma nova versão.

## Implementação (2026-11-03)

- `POST /v1/stations/{id}/prices`. Quem gerencia o posto informa como "posto", sem limite de quantidade; os demais, como motorista.
- Ordem das verificações: posto existe; promoção só do gestor e dentro da duração máxima (parâmetro `price.promotion_max_days`, inicial 7 dias); combustível vendido pelo posto (o gestor pode acrescentar um combustível novo); limites da conta; confirmação de variação; classificação pela referência.
- Variação acima do parâmetro em relação ao preço vigente responde `409` com `code: CONFIRMATION_REQUIRED`; o app reenvia com `confirmed: true`. Nada é gravado antes da confirmação.
- Informe rejeitado é gravado e responde `422` com `code: PRICE_OUT_OF_RANGE`. Conta para os limites da conta.
- Informes suspeitos do posto aparecem; os de motoristas, só confirmados.
- "Desatualizado" vem como `stale: true`, junto do selo de origem, para o app mostrar as duas informações.
- As regras de classificação e de preço exibido são funções puras (`src/prices/price-rules.ts`), testadas caso a caso.
