# ADR 0045: Convite para informar o primeiro preço

- **Status:** aceito
- **Data:** 2026-11-16
- **Complementa:** ADR 0003 (fontes de preço), ADR 0017 (identidade visual e temas), ADR 0029 (recursos do consumidor)

## Contexto

A maioria dos postos do cadastro da ANP ainda não tem preço no Tankei. No mapa, o posto sem preço do combustível escolhido aparecia como um círculo pequeno (22 px) com a bomba em cinza, quase invisível no tema escuro. No cartão, havia só um botão discreto "Informar preço". Cada posto sem preço é uma chance de o motorista contribuir, e o app não aproveitava isso.

## Decisão

- **Marcador no mapa:**
  - círculo de 30 px com a bomba em 18 px, no laranja de destaque do Tankei (`accent`), com borda laranja;
  - o laranja tem contraste de ícone (3:1 ou mais) nos dois temas (ADR 0017);
  - selecionado, o círculo fica todo laranja, com a bomba na cor do fundo.
- **Convite "Seja o primeiro a informar!"** (`FirstPriceInvite`):
  - no cartão do mapa, quando o posto não tem preço do combustível escolhido: "Ainda não há preço de <combustível> neste posto. Viu na bomba? O seu informe aparece para todos que passam por aqui.";
  - na ficha, quando o posto não tem nenhum preço, no lugar do botão "Informar preço";
  - quadro com borda e ícone laranja, e o botão "Informar o preço" na cor de ação do tema (azul-marinho no claro, laranja no escuro), porque o laranja de destaque não tem contraste para texto no tema claro;
  - não aparece com preços ocultos (ADR 0028).
- **O texto não promete recompensa.** O informe conta na "Sua contribuição" (ADR 0029) como qualquer outro.

## Consequências

- O posto sem preço deixa de parecer desativado e passa a convidar a contribuir.
- Em regiões com poucos preços, o mapa fica mais laranja. Isso é intencional: mostra onde falta informação.
