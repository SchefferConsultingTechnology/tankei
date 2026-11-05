# ADR 0022: Portal com MUI

- **Status:** aceito
- **Data:** 2026-11-05
- **Complementa:** ADR 0017 (identidade e temas) e ADR 0018 (portal)

## Contexto

O portal começou com componentes e CSS próprios (cerca de 670 linhas). Com as fases seguintes (contestação, promoções com arte e datas, equipe, admin), os formulários ficam mais complexos e o CSS próprio passaria a ser um custo de manutenção e de acessibilidade. Avaliou-se o MUI (Material UI): compatível com React 19 e Vite, componentes acessíveis prontos (Autocomplete, Dialog, Drawer, Stepper, tabelas, seletores de data no MUI X).

## Decisão

- O portal e o admin usam o **MUI** (`@mui/material`, ícones `@mui/icons-material`, Emotion). Todas as telas foram migradas.
- **Tema da marca** em `apps/portal/src/mui-theme.ts`: paleta do ADR 0017 (cor de ação azul-marinho no claro, laranja no escuro), botões sem caixa alta, item selecionado do menu e opção escolhida com a cor de ação. O tema segue a escolha do portal (automático, claro ou escuro).
- O `index.css` guarda só as cores das origens de preço (`--badge-*`, ADR 0003) e o fundo antes do JavaScript carregar.
- **Padrões de tela:** no celular, filtros em campos de seleção (nada de chips com rolagem lateral), listas sem sobreposição, formulários em janela de tela cheia, confirmações em janela, avisos de sucesso no rodapé.
- **Carregamento:** cada tela é carregada quando aberta (`React.lazy`); React e a camada de dados (TanStack Query, Zod) ficam em arquivos próprios, guardados pelo navegador entre versões. O MUI é distribuído pelo empacotador entre as telas.

## Consequências

- Entrada do portal: cerca de 223 KB compactados (era 130 KB antes do MUI e 237 KB com o MUI num arquivo só). As telas têm de 1 a 4 KB cada; componentes pesados (ex.: Autocomplete) só vêm com a tela que os usa.
- Visual consistente e acessível; menos CSS próprio para manter.
- Atualizações grandes do MUI podem mudar APIs (no MUI 9, por exemplo, propriedades como `fontWeight` saíram da `Typography` e vão no `sx`).
- O admin segue o mesmo padrão (tema, cabeçalho e menu lateral iguais; cópias em `apps/admin/src`). Portal e admin repetem essa base: se crescer, vira um pacote compartilhado do monorepo.
