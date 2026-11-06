# ADR 0028: Modo de exibição do posto

- **Status:** aceito
- **Data:** 2026-11-06
- **Complementa:** ADR 0003 (preço exibido), 0020 e 0024 (confiança e divergência), 0023 (admin de suporte)

## Contexto

O autor levantou dois pedidos possíveis de postos:
1. Um posto (cliente ou não) pede para não ter preços exibidos.
2. Um posto cliente pede que só ele informe preços, sem informes de consumidores.

Atender ao pé da letra traz dois problemas:
- **Lista enviesada:** quem pede para esconder preço é, quase sempre, o posto mais caro. A lista "menor preço" passaria a mostrar só quem é barato ou quem não pediu.
- **Fim da proteção do consumidor:** bloquear consumidores tira a única defesa contra o posto que anuncia um preço e cobra outro (ADR 0020).

Além disso, o pagamento passaria a mexer no que o consumidor vê, o que fere a regra de neutralidade do projeto. E o preço de combustível é informação pública: está na bomba, na placa e nos levantamentos da ANP.

## Decisão

- **Quem decide:** só a administração, a pedido do posto (cliente ou não). Nunca é um botão no portal.
- **Registro:** cada mudança registra quem pediu, o motivo e quem decidiu (`station_mode_changes`, só inserção). O modo atual fica em `stations.display_mode`.
- **Modos:**

  | Modo | Efeito |
  |---|---|
  | **Normal** | Regras de confiança dos ADR 0020 e 0024. |
  | **Não participa** | O posto pediu para não participar. Os preços continuam, informados por consumidores, com o aviso "Este posto não participa do Tankei" no app. |
  | **Preço oficial** | Só para posto com rede (cliente). O preço do posto sempre prevalece: informes de consumidores nunca o substituem, nem depois do prazo de resposta. A divergência continua visível como aviso no app, e o posto recebe o e-mail. Divergência além do prazo aparece para a equipe na tela de moderação; se o posto informa preço falso, a equipe tira o modo. |
  | **Preços ocultos** | O posto fica no mapa, sem preços nem promoções, e ninguém informa preço. Só por motivo objetivo: ordem judicial, dado incorreto comprovado ou risco de segurança. |
  | **Oculto** | O posto sai do app (mapa, lista, ficha e vitrine). Só por motivo objetivo: posto fechado, ordem judicial ou risco de segurança. |

- **Sem pedido:** posto que não aderiu e não pediu nada continua normal. Os preços aparecem com o selo de origem ("Informado por consumidor").

## Consequências

- A lista por menor preço continua representativa, e o consumidor não perde a voz nem com postos clientes.
- O cliente ganha controle do preço exibido sem esconder a divergência, e a plataforma continua confiável.
- **Pendente:** revisão jurídica (Código de Defesa do Consumidor, Marco Civil e termos de uso) para confirmar o que a plataforma é obrigada a remover e o texto dos termos sobre esses modos.
