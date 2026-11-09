# ADR 0039: Visitas dos motoristas ao posto, no portal

- **Status:** aceito
- **Data:** 2026-11-09
- **Detalha:** spec 0003
- **Complementa:**
  - ADR 0006 (parâmetros)
  - ADR 0009 (dados pessoais)
  - ADR 0021 (papéis no posto)
  - ADR 0036 (ambiente de teste)

## Contexto

O posto não sabe quantos motoristas olham para ele no app. Também não sabe quantos desses tocaram e foram embora sem informar preço nem avaliar. É o principal argumento de venda da assinatura. O autor decidiu que a tela é **só para assinantes**, com os planos ainda em revisão.

## Decisão

### O que é registrado

**Visita**
- Começa no toque no cartão do mapa, ou ao abrir a ficha pela lista, pelos favoritos ou por um link.
- Termina quando o cartão fecha (por tempo, por toque fora ou ao escolher outro posto) ou ao sair da ficha.

**Tempo na ficha**
- Conta só com a ficha em primeiro plano. Outra tela por cima ou o app em segundo plano pausam a contagem.
- Tem um teto (`analytics.max_detail_seconds`).
- Se o app for fechado com uma visita aberta, ela é enviada na próxima abertura com o motivo "segundo plano".

**Contribuição**
- O informe de preço e a avaliação levam o `visitId` da visita em andamento, ou da última visita ao mesmo posto nos 30 minutos anteriores.
- Ficam gravados em `price_reports.visit_id` e `reviews.visit_id`, sem chave estrangeira, porque a visita pode chegar ao servidor depois.

**Ações**
- Por enquanto só "traçar rota". O schema já aceita compartilhar, ligar e WhatsApp.

### Privacidade

**Base legal**
- Legítimo interesse: o registro começa ligado, e o motorista desliga em Conta › "Compartilhar estatísticas com os postos".
- Ao desligar, o app apaga a fila de envio e o identificador.
- A política de privacidade precisa citar isso. A pergunta está na pauta jurídica: se o advogado pedir consentimento, o app passa a começar desligado e pergunta uma vez.

**O que fica guardado**
- `station_visits` não guarda conta nem coordenadas.
- O único identificador é um UUID aleatório por instalação, gerado no aparelho, que serve para contar visitantes únicos.
- A exclusão da conta não precisa mexer na tabela.

**Mínimo de anonimato**
- Toda contagem abaixo de `analytics.min_bucket` (5) volta nula da API, e o portal mostra "menos de 5".
- A mediana do tempo na ficha também só aparece com o mínimo de visitas à ficha.

**Ajustes para o pouco movimento**
- Com mais da metade dos períodos abaixo do mínimo, o gráfico sobe de dia para semana, ou de semana para mês.
- A grade dia da semana × horário (56 células) foi trocada por duas distribuições: dia da semana e faixa de 3 horas. Com pouco movimento, quase toda célula da grade sumia.

### Envio pelo app

- `POST /v1/telemetry/visits` é público, com até 50 visitas por lote, e idempotente pelo `id`.
- A API descarta sem erro:
  - visitas mais antigas que `analytics.max_queue_days`;
  - visitas datadas mais de 1 dia no futuro;
  - visitas de posto inexistente.
- O app envia:
  - a cada `analytics.flush_seconds`;
  - ao ir para segundo plano;
  - ao voltar.

  A fila fica no AsyncStorage, e falhas não aparecem para o motorista.

### Recurso do plano (`station_feature_changes`)

**Liberação**
- Até a assinatura pelo Mercado Pago existir, a equipe libera recursos por posto no admin, na ficha do posto › "Recursos do plano", com observação.
- A tabela é só de inserção: cada mudança é uma linha, e vale a mais recente.
- O primeiro recurso é `visitas`. O site do posto (spec 0004) usará a mesma tabela.

**Portal**
- Sem o recurso, o portal mostra "Disponível na assinatura do portal".
- A rota de visitas responde 403 com `code: FEATURE_LOCKED`.
- A equipe Tankei (admin) vê sempre.

**Quem vê:** todos os papéis do posto (ação `view`).

### Parâmetros (ADR 0006)

| Chave | Valor inicial |
|---|---|
| `analytics.flush_seconds` | 60 s |
| `analytics.max_queue_days` | 7 dias |
| `analytics.max_detail_seconds` | 600 s |
| `analytics.min_bucket` | 5 |

### Fica para depois

- **Consolidação diária e retenção** (apagar as visitas brutas antigas): entra antes de a tabela completar um ano de dados.
- **Impressões:** quantas vezes o posto apareceu no mapa ou na lista sem toque.
- **Comparação com a média da cidade.**
- **Visitas no dashboard de engajamento do admin.**

## Consequências

- O app passa a registrar visitas a partir da versão 1.8.0. As visitas anteriores não existem.
- A carga fictícia (`pnpm demo:visits`) preenche a tela no banco de teste e libera o recurso para os postos de rede da região do piloto.
