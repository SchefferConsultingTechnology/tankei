# ADR 0003: Fontes e regras de preços

- **Status:** aceito
- **Data:** 2026-11-02

## Contexto

A ANP não pesquisa preços em Curitibanos (ver ADR 0002). Todo preço exibido no piloto virá dos próprios postos ou dos motoristas. O preço errado é o principal risco do produto: se o usuário encontra um valor diferente na bomba, deixa de confiar no app. As regras abaixo definem como um preço entra, qual aparece e como mostramos o quanto ele é confiável.

Continua valendo a regra do projeto: preços nunca são sobrescritos. Cada informe é um registro novo, e o preço exibido é derivado do histórico.

## Decisão

### Quem informa

- **Posto:** pelo portal, por um usuário vinculado ao estabelecimento.
- **Motorista:** pelo app.
- **ANP:** permanece prevista no modelo (`anp`), mas não fornece preços no piloto.

### Conta

Consultar preços não exige cadastro. **Informar** preço exige conta (login social ou telefone), para permitir limites por usuário e medir a confiabilidade de cada colaborador.

### Preço exibido

- Vale o informe válido mais recente para cada combustível do posto.
- Um informe de motorista só substitui o preço informado pelo posto se for posterior a ele **e** tiver ao menos uma confirmação de outra pessoa.

### Selos de confiabilidade

| Selo | Regra |
|---|---|
| Atualizado pelo posto | Preço vigente informado pelo posto |
| Confirmado por motoristas | 2 ou mais pessoas diferentes informaram o mesmo valor em até 48 h |
| Informado por motorista | Uma pessoa informou, sem confirmação ainda |
| Desatualizado | Mais de 7 dias sem informe novo |

### Prazos

- Depois de **7 dias** sem informe, o preço recebe o selo "Desatualizado".
- Depois de **30 dias**, deixa de ser exibido como preço atual, mas continua no histórico.

### Proteção contra erro e fraude

- Rejeitar valores fora de uma faixa plausível por combustível. A faixa é configurável e revisada periodicamente.
- Pedir confirmação ao usuário quando o valor variar mais de **10%** em relação ao preço vigente.
- Limitar a quantidade de informes por conta, por posto e por dia.
- Informes rejeitados ou suspeitos também são registrados, para auditoria e moderação.

### Combustíveis no piloto

Gasolina comum, gasolina aditivada, gasolina premium, etanol, diesel S10 e diesel S500. O GNV continua no modelo, mas não é exibido em Curitibanos, onde nenhum posto o vende.

## Consequências

- O modelo de dados precisa de informes de preço (com origem, autor, data e situação), confirmações e uma visão derivada do preço vigente com seu selo.
- O app precisa de login antes da primeira contribuição, mas não antes da consulta.
- A adesão dos postos é decisiva: sem preços informados pelo posto, o app depende só dos motoristas desde o primeiro dia.
- Os valores (48 h, 7 dias, 30 dias, 10%) são hipóteses para o piloto e devem ser revistos com os dados reais.

## Pendências

- **Faixas plausíveis por combustível:** definir os valores iniciais antes da implementação.
- **Limite diário de informes por conta:** definir o número.
