# Spec 0001: Escala do IQP visível no app

- **Status:** implementada (2026-11-06)
- **Data:** 2026-11-05
- **Relacionados:** ADR 0004 (metodologia do IQP), ADR 0017 (identidade e temas). Já implementado no portal (aba Reputação).

## Problema

O consumidor vê "IQP 86" na lista, no cartão do mapa e na ficha do posto, sem saber que a escala vai de 0 a 100 nem como a nota é formada. Sem a régua, 86 pode parecer pouco ou muito.

## Objetivo

Deixar a escala de 0 a 100 evidente em todo lugar onde a nota aparece, de forma discreta, e oferecer uma explicação curta de como ler o índice. O mesmo texto do portal.

## Fora do escopo

- Faixas de qualidade ("bom", "ruim", cores por faixa): seriam um julgamento do Tankei sobre o posto. A escala é neutra.
- Mudanças no cálculo ou na API: tudo o que é preciso já vem da API.

## Onde a nota aparece hoje

| Lugar | Arquivo | Hoje |
|---|---|---|
| Lista de postos e cartão do posto no mapa | `apps/mobile/src/components/IqpPill.tsx` (usado em `StationCard.tsx`) | "IQP 86" ou "IQP: sem dados" |
| Ficha do posto | `apps/mobile/src/app/station/[id].tsx`, função `IqpDetail` | "86" grande + "de 100 · Confiança média · 6 avaliações", barras por dimensão |

## Mudanças

### 1. Pílula (lista e cartão do mapa)

- Texto: **"IQP 86/100"**, com o "/100" em peso normal e cor `textMuted` (a nota em destaque, a escala como apoio).
- Sem nota: continua "IQP: sem dados".
- Acessibilidade: `accessibilityLabel="Índice de qualidade do posto: 86 de 100"` (sem nota: "Índice de qualidade: dados insuficientes").
- Conferir que a pílula ainda cabe no rodapé do cartão em 360 px de largura com o maior preço e "Atualizado pelo posto · há 10 dias".

### 2. Ficha do posto: medidor

- Trocar o número grande por um **medidor circular**, como no portal (`apps/portal/src/components/IqpGauge.tsx`):
  - arco de 0 a 100 preenchido até a nota, trilho completo atrás;
  - nota no centro e "de 100" embaixo;
  - cor do arco: `colors.primary` do tema (azul-marinho no claro, laranja no escuro); trilho: `colors.surfaceAlt`;
  - tamanho ~88 dp.
- Ao lado do medidor: confiança e "N pessoas avaliaram" (o que hoje está na linha "de 100 · …").
- Sem nota: medidor com o trilho vazio e "—", mais o texto atual de dados insuficientes.
- Implementação do arco: `react-native-svg` (instalar com `pnpm exec expo install react-native-svg`; exige novo APK de desenvolvimento e de versão). Alternativa sem dependência nova, se preferirmos não mexer no binário agora: barra horizontal de 0 a 100 com as marcas "0" e "100" nas pontas.
- Acessibilidade: o medidor inteiro com `accessibilityRole="image"` e `accessibilityLabel="Índice de qualidade 86 de 100"`; os elementos internos ocultos dos leitores de tela.

### 3. Barras por dimensão

- Manter as barras; acrescentar "de 100" ao número só na primeira dimensão (ou uma legenda "notas de 0 a 100" acima da lista), para não repetir em todas.

### 4. "Como ler o IQP"

- Abaixo das dimensões, um item que abre e fecha (`Pressable` com seta, `accessibilityState={{ expanded }}`), fechado por padrão.
- Conteúdo: a lista `IQP_EXPLANATION` do `@tankei/shared` (mesmo texto do portal), em itens com marcador, e uma linha final "Índice calculado pelo Tankei com a metodologia X" (`iqp.methodologyVersion`).
- Substitui a frase atual "O IQP mede a experiência relatada por consumidores. Preço e anúncios não alteram a nota.", que passa a fazer parte da lista.

### 5. Texto de dados insuficientes

- Hoje o app escreve "a partir de 3 avaliações de pessoas diferentes", com o 3 fixo no código. O mínimo é da metodologia versionada (ADR 0004) e pode mudar. Trocar por "a nota aparece quando mais pessoas diferentes avaliarem ({n} até agora)", sem o número fixo.

## Critérios de aceite

- [ ] A pílula mostra "IQP N/100" na lista e no cartão do mapa, nos temas claro e escuro.
- [ ] A ficha mostra o medidor com "N de 100" e, sem nota, o medidor vazio com "—".
- [ ] "Como ler o IQP" abre e fecha, com o texto do `@tankei/shared`.
- [ ] Nenhum número da metodologia (mínimo de avaliações, pesos) fixo no app: pesos vêm da API.
- [ ] Leitor de tela (TalkBack) anuncia "Índice de qualidade … de 100".
- [ ] Capturas no emulador (claro e escuro, 360 e 412 dp de largura) anexadas ao PR.
- [ ] `pnpm --filter @tankei/mobile typecheck` e `lint` passam; APK de versão gerado se `react-native-svg` entrar.

## Notas

- O `@tankei/shared` precisa ser recompilado (`pnpm --filter @tankei/shared build`) antes do app, para o `IQP_EXPLANATION` estar disponível.
- Leia `apps/mobile/AGENTS.md` antes de instalar dependências (APIs do Expo mudam a cada SDK).
