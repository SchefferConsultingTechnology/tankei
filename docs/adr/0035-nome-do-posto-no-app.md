# ADR 0035: Nome do posto escolhido pelo posto

- **Status:** aceito
- **Data:** 2026-11-07
- **Complementa:** ADR 0033 (dados do posto no portal)

## Contexto

O cadastro da ANP muitas vezes só traz a razão social ("CENTRO AUTOMOTIVO CURITIBANOS LTDA"). Na região, o posto é conhecido por outro nome: o nome fantasia, ou um apelido como "Posto do Trevo". O motorista procura pelo nome que conhece.

## Decisão

- **Onde se informa:** no portal, na tela "Posto › Dados do posto" (antes "Horário e serviços"), há o campo **"Nome no app"**. Proprietário e gestor alteram, com a ação `manage_info`. No admin, a equipe também altera, na ficha do posto.
- **Regras:** de 3 a 60 caracteres. Em branco, volta ao nome do cadastro da ANP; o próprio campo mostra qual é.
- **Onde fica gravado:** em `stations.display_name`. Cada alteração também fica na versão de `station_info_versions`, com quem alterou e quando. Ao salvar sem o campo, o nome atual é mantido. A importação da ANP não mexe nesse campo.
- **Onde aparece:**
  - **no app**, em mapa, lista, ficha, favoritos e alertas;
  - **no e-mail** de alerta de preço;
  - **no portal**, no cabeçalho, no seletor de unidade e na visão da rede.
- **Admin, pedidos de acesso e busca para reivindicar:** continuam com o nome oficial, para identificar o posto pelo CNPJ e pela razão social.

## Consequências

- Um nome indevido (por exemplo, "O mais barato da cidade") pode ser corrigido pela equipe no admin. Moderação prévia fica para depois, se houver abuso.
- A busca de postos por nome no app, quando existir, deve considerar os dois nomes.
