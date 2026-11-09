# Spec 0003: Interações dos motoristas com o posto, no portal

- **Status:** implementada (2026-11-09). Os ajustes feitos na implementação estão no ADR 0039.
- **Data:** 2026-11-08
- **Relacionados:** ADR 0009 (dados pessoais e LGPD), ADR 0006 (parâmetros), ADR 0021 (papéis no posto), ADR 0038 (dashboard de engajamento no admin), spec 0004 (site do posto)

## Problema

O posto não tem como saber quantos motoristas olham para ele no Tankei. Hoje só existem os dados que já ficam gravados: informes de preço e avaliações. Não há registro de:
- toques no cartão do posto no mapa ou na lista;
- visitas à ficha do posto e o tempo que o motorista ficou nela;
- quantas dessas visitas terminaram em informe de preço ou avaliação, e quantas não.

Sem isso, o portal não mostra ao posto o retorno de estar na plataforma, que é o principal argumento para a assinatura.

## Objetivo

Registrar as visitas dos motoristas ao posto no app, de forma anônima, e mostrar no portal números agregados:
- aberturas do cartão;
- visitas à ficha;
- tempo na ficha;
- taxa de visitas que viraram informe de preço ou avaliação.

## Fora do escopo

- Saber **quem** visitou. O posto nunca vê pessoas, só totais.
- Localização do motorista. Continua não sendo guardada (ADR 0009).
- Impressões (quantas vezes o posto apareceu no mapa ou na lista sem toque). Ficam para uma fase B, porque o volume é muito maior.
- Visitas ao site do posto. A spec 0004 reaproveita esta estrutura com a origem `site`.

## Conceitos

- **Visita:** um contato do motorista com um posto. Começa no toque no cartão (mapa ou lista) ou na abertura direta da ficha (link compartilhado, notificação, busca). Termina quando o cartão fecha, ou ao sair da ficha.
- **Tempo na ficha:** só conta o tempo com a tela da ficha **em primeiro plano**:
  - pausa quando o app vai para segundo plano ou a tela apaga;
  - tem um teto em parâmetro, para descartar uma ficha esquecida aberta.
- **Contribuição da visita:** informe de preço ou avaliação feito **a partir daquela visita**. O app envia o identificador da visita junto com o informe ou a avaliação.
- **Visitante:** identificador aleatório **por instalação do app**, gerado no aparelho, sem ligação com a conta. Serve só para contar visitantes únicos.

## Comportamento no app

### Registro das visitas

1. O toque no cartão cria uma visita com estes dados:
   - `id` (UUID gerado no aparelho);
   - `stationId`;
   - `source`: `mapa`, `lista`, `favoritos`, `link` ou `site`;
   - `openedAt`;
   - `drivingMode`: se o modo direção estava ativo.
2. "Ver detalhes do posto" na mesma visita marca `detailOpenedAt` e começa a medir o tempo na ficha. Abrir a ficha direto (sem cartão) cria a visita já com a ficha aberta.
3. A visita fecha quando o cartão fecha (por tempo, por toque fora ou ao escolher outro posto) ou ao sair da ficha. O app grava `closedAt`, `detailMs` (tempo em primeiro plano) e `closeReason`.
4. **Ações dentro da visita**, quando existirem: `route` (traçar rota), `share` (compartilhar), `call` (ligar), `whatsapp`. Cada uma é contada uma vez por visita.
5. **Contribuição:** se o motorista informar preço ou avaliar o posto durante a visita, o app envia o `visitId` no informe ou na avaliação. Quem não está logado só visita; para contribuir é preciso entrar.

### Envio

- O app junta as visitas fechadas numa fila local (AsyncStorage) e envia em lote:
  - a cada `analytics.flush_seconds`;
  - ao ir para segundo plano;
  - quando volta a conexão.
- Rota pública, que também aceita o motorista logado: `POST /v1/telemetry/visits`, com até 50 visitas por chamada.
- O envio é idempotente pelo `id`: repetir não duplica.
- Visitas com mais de `analytics.max_queue_days` dias na fila são descartadas.
- Falha no envio nunca aparece para o motorista nem atrapalha o app.

### Preferência do motorista

Na tela Conta, um interruptor **"Compartilhar estatísticas de uso com os postos"**, ligado por padrão (base legal: legítimo interesse, informado na política de privacidade). Desligado:
- o app não registra visitas;
- a fila é apagada.

## API e banco

### Tabela `station_visits`

| Coluna | Tipo | Observação |
|---|---|---|
| `id` | uuid (PK) | gerado no aparelho |
| `station_id` | uuid | |
| `visitor_id` | uuid | aleatório por instalação; não é a conta |
| `source` | enum | `mapa`, `lista`, `favoritos`, `link`, `site` |
| `driving_mode` | boolean | |
| `opened_at` | timestamptz | data e hora do aparelho; descartada se estiver mais de 1 dia no futuro |
| `detail_opened_at` | timestamptz, nulo | |
| `detail_ms` | integer, nulo | limitado a `analytics.max_detail_seconds` |
| `actions` | text[] | `route`, `share`, `call`, `whatsapp` |
| `close_reason` | enum | `tempo`, `toque_fora`, `outro_posto`, `saiu_da_ficha`, `segundo_plano` |
| `received_at` | timestamptz | data e hora do servidor |

Regras da tabela:
- **Sem `user_id` e sem coordenadas.** Só inserção, com o mesmo gatilho das outras tabelas de histórico.
- Índices em `(station_id, opened_at)` e `(opened_at)`.

### Ligação com as contribuições

- Coluna `visit_id` (uuid, nulo) em `price_reports` e em `reviews`.
- Nas duas tabelas é **só um rótulo, sem chave estrangeira**: a visita pode chegar ao servidor depois da contribuição.
- As colunas novas e nulas não mexem no histórico.

### Retenção e agregação

*Adiada (ADR 0039): entra antes de a tabela completar um ano de dados.*

- Uma tarefa diária (`@nestjs/schedule`) consolida as visitas em `station_visit_daily`, uma linha por posto, dia e origem, com:
  - visitas;
  - visitantes únicos;
  - visitas com ficha;
  - mediana e p75 do tempo na ficha;
  - contagem de cada ação;
  - visitas com informe de preço;
  - visitas com avaliação.
- As visitas brutas mais antigas que `analytics.raw_retention_days` são apagadas, como exceção documentada à regra de só inserção:
  - a limpeza é feita por uma função própria, que desliga o gatilho só para essa operação;
  - o total diário fica para sempre.

### Leitura no portal

- `GET /v1/portal/stations/:stationId/visits?from&to`.
- Exige a ação `view`, que todos os papéis do posto têm (proprietário, gestor, operador e leitura). Verificada com `AccessService.assert`.
- Responde com:
  - indicadores do período e do período anterior;
  - série por dia ou semana (mesma regra de granularidade dos dashboards do admin);
  - divisão por origem;
  - distribuição por dia da semana e hora.

## Portal: tela "Visitas" (menu Posto › Visitas)

**Indicadores** (cada um com a variação sobre o período anterior):
- visitas;
- visitantes únicos;
- visitas à ficha;
- tempo típico na ficha (mediana);
- informaram preço (% das visitas);
- avaliaram (% das visitas).

**Gráficos e quadros:**
- Gráfico de barras com as visitas por dia ou semana.
- Funil da visita: cartão aberto → ficha aberta → informou preço / avaliou. Mostra o que o autor pediu: **quantos tocaram e não contribuíram**.
- Origem das visitas: mapa, lista, favoritos, link compartilhado, site do posto.
- Quando os motoristas olham: grade de dia da semana por faixa de hora.
- Ações: rotas traçadas, compartilhamentos, ligações.

**Regra de anonimato:**
- Qualquer número abaixo de `analytics.min_bucket` (5) aparece como "menos de 5". Vale para os indicadores, para cada barra e para cada célula da grade.
- Assim um posto com pouco movimento não consegue identificar um motorista conhecido.

**Comparação com a cidade (fase B, decisão pendente):** a mediana das visitas dos postos da mesma cidade, sem identificar nenhum posto.

## Admin

O dashboard de engajamento (ADR 0038) ganha estes dados por estado e cidade:
- visitas;
- taxa de conversão em informe de preço;
- taxa de conversão em avaliação.

Com eles dá para ver onde as pessoas olham mas não contribuem, e direcionar campanhas para pedir informes nessas regiões.

## Parâmetros novos (ADR 0006)

| Chave | Valor inicial | Unidade |
|---|---|---|
| `analytics.flush_seconds` | 60 | seconds |
| `analytics.max_queue_days` | 7 | days |
| `analytics.max_detail_seconds` | 600 | seconds |
| `analytics.min_bucket` | 5 | count |
| `analytics.raw_retention_days` | 400 | days |

O app lê `flush_seconds` e `max_detail_seconds` em `GET /v1/config`.

## Critérios de aceite

1. Tocar no cartão e deixá-lo fechar sozinho gera uma visita com `source` certo, sem ficha e com `close_reason = tempo`.
2. Abrir a ficha, ficar 30 s, ir para segundo plano 2 min e voltar por mais 10 s registra `detail_ms` perto de 40 000.
3. Informar preço na ficha grava o `visit_id` no informe. No portal, a visita conta em "informaram preço".
4. Sem conexão, as visitas ficam na fila e são enviadas quando a conexão volta, sem duplicar.
5. Com o interruptor desligado, nenhuma visita é registrada.
6. No portal, um período com 3 visitas mostra "menos de 5", inclusive nas barras e na grade.
7. Gestor sem acesso ao posto recebe 403 na rota de visitas.
8. A tabela de visitas não guarda conta nem coordenadas. A exclusão da conta não precisa mexer nela.
9. A carga fictícia (`pnpm demo:visits`, ADR 0036) preenche a tela para visualização no banco de teste.

## Decisões

1. **Plano (decidido em 2026-11-09):** só para assinantes; os planos ainda serão revisados. Até a assinatura existir, a equipe libera por posto no admin (ADR 0039).
2. **Interruptor ligado por padrão** (legítimo interesse): implementado assim. A confirmação está na pauta jurídica (item 5).
3. **Comparação com a cidade** na fase B: ajuda a vender, mas expõe a média dos concorrentes.
4. **Impressões** (fase B): contar quantas vezes o posto apareceu no mapa ou na lista, agregadas no aparelho por dia.
