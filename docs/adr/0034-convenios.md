# ADR 0034: Convênios com desconto

- **Status:** aceito
- **Data:** 2026-11-07
- **Complementa:** ADR 0006 (parâmetros), 0021 (redes e papéis), 0026 (promoções), 0033 (cartão do mapa)

## Contexto

Muitos postos dão desconto por convênio, por exemplo:
- apps de pagamento;
- cartões de frota;
- clubes e cooperativas;
- empresas da região.

O desconto muda de convênio para convênio e de posto para posto. Quem tem o convênio quer saber quanto vai pagar. Quem não tem não pode ser enganado por um preço que não é o dele.

## Decisão

- **Cadastro único de convênios** (`agreements`):
  - **Portal:** o posto cria o convênio ao adicioná-lo, buscando antes nos existentes. Se já houver um com o mesmo nome (sem diferenciar maiúsculas e acentos), o existente é usado em vez de duplicar. Um índice único no banco garante isso.
  - **Admin:** o administrador cria, renomeia, descreve e desativa. Desativado, o convênio some do app e da busca do portal, mas o histórico fica.
  - **Exclusão:** só é possível para convênio que nenhum posto usou. Usado, a opção é desativar.
- **Desconto do posto** (`station_agreement_versions`):
  - É dado por convênio e por combustível, em **R$ por litro** ou **%**, com uma observação opcional (por exemplo, "pagando pelo app").
  - Proprietário e gestor alteram, com a mesma permissão das promoções (`manage_promotions`).
  - A tabela é só de inserção: cada alteração é uma versão, e encerrar grava uma versão inativa.
  - Tela: "Preços › Convênios" no portal.
- **Limites contra erro de digitação** (parâmetros, ADR 0006): `agreement.max_discount_pct` (30%) e `agreement.max_discount_per_liter` (R$ 1,00).
- **No app:**
  - **Mapa e lista:** mostram o **preço sem desconto**. A ordem por menor preço não muda.
  - **Cartão aberto pelo toque:** mostra os convênios do combustível escolhido, com o preço final e o desconto. Exemplo: "Shell Box: R$ 5,99 (−R$ 0,20) · pagando pelo app".
  - **Ficha do posto:** a seção "Convênios" mostra todos os combustíveis.
  - **Preços ocultos (ADR 0028):** o posto também não mostra convênios.
  - **Cálculo:** o preço final é calculado no cliente (`discountedPrice`), a partir do preço exibido.
- **"Ver detalhes do posto ›":** todo cartão do posto mostra esse convite, para deixar claro que o toque abre a ficha completa.
- **IQP:** não muda.

## Consequências

- O desconto vale sobre o preço exibido. Se o preço exibido vier de consumidores e não do posto, o preço final é uma estimativa.
- **Próximo passo possível:** o consumidor marcar no app os convênios que tem, para destacar ou ordenar pelo preço dele. Por enquanto, todos veem todos os convênios.
