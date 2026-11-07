# ADR 0031: Caminho curto do dono do posto até o Tankei

- **Status:** aceito
- **Data:** 2026-11-06
- **Complementa:** ADR 0011 (verificação do vínculo), 0019 (reivindicação), 0021 (redes)

## Contexto

Muitos donos de posto vão conhecer o Tankei pelo celular de um cliente. Hoje,
para assumir o posto, a pessoa precisa achar o portal, entrar e procurar o
posto pelo CNPJ. A ideia é parecida com "Esta empresa é sua?" do Google Maps:
o convite aparece no próprio posto, com um canal direto com a equipe.

## Decisão

- **Onde aparece:** na ficha do posto no app, só quando o posto não tem rede no
  portal. A API passa a informar `managed` em cada posto.
- **Texto:** "É o responsável por este posto?". Fala do que o responsável pode
  fazer (manter as informações em dia, divulgar promoções e fotos, acompanhar a
  opinião dos clientes). **Não fala de preço nem de cobrança**, por decisão do
  autor.
- **Falar com a equipe no WhatsApp:** abre o WhatsApp Business da equipe com a
  mensagem pronta (posto, endereço e código do posto no Tankei).
- **Pedir acesso pelo portal:** abre `/acesso?posto=<id>&origem=app_dono`. Depois
  do login, o pedido já começa com o posto escolhido, no passo dos dados. A
  verificação continua a mesma (ADR 0011).
- **Indicar o Tankei:** o consumidor envia, pelo compartilhamento do celular, um
  convite com o link do pedido (`origem=app_convite`).
- **Origem do pedido:** `station_claims.origin` (`portal`, `app_dono`,
  `app_convite`), mostrada na fila do administrador. Serve para medir o canal.
- **Número do WhatsApp:** variável de ambiente `SUPPORT_WHATSAPP` da API, lida
  pelo app em `GET /v1/config` (pública), com o endereço do portal. Não é regra
  de negócio (por isso não fica em `parameters`, ADR 0006) e muda sem nova
  versão do app. Vazio esconde o botão.

## Consequências

- O contato pelo WhatsApp fica fora da plataforma: a equipe ainda precisa
  registrar o pedido no portal (ou orientar a pessoa a fazer) para haver
  verificação e histórico.
- A mensagem do WhatsApp leva o código do posto: no admin, a ficha fica em `/postos/<código>`.
- Postos com rede não mostram o convite. Um posto cuja rede sai do portal volta
  a mostrar.
