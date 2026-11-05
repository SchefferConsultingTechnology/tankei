# ADR 0017: Identidade visual, temas claro e escuro

- **Status:** aceito
- **Data:** 2026-11-04

## Contexto

O app usava uma identidade provisória (verde-petróleo) e só o tema claro. O autor definiu o logo do Tankei (bomba de combustível com gota e traço laranja, e a versão horizontal com o nome), e com ele a paleta. Na tela inicial, a troca entre mapa e lista não deixava claro que eram duas alternativas.

## Decisão

### Paleta

Tirada do logo: azul-marinho `#012049` e laranja em gradiente (`#FD9E02` → `#FD6000` → `#FD3900`).

- Texto branco sobre o laranja do logo tem contraste de 2,9:1, abaixo do mínimo de 4,5:1 (WCAG AA). Por isso a **cor de ação** (botões, item selecionado) é o **azul-marinho no tema claro** (15,9:1 com texto branco) e o **laranja `#FF7A1A` no escuro**, com texto azul-marinho (6,1:1).
- O laranja do claro (`#E8590C`, 3,6:1 sobre branco) fica para destaques e ícones, não para texto pequeno.
- As cores das origens de preço (ADR 0003) ganham uma versão clara para o tema escuro, todas acima de 8:1 sobre a superfície escura.
- Os valores ficam em `apps/mobile/src/theme.ts`; as telas os leem por `useTheme()` e `createStyles()` (`src/appearance.tsx`), nunca direto.

### Tema claro e escuro

- Segue o tema do celular por padrão (`userInterfaceStyle: automatic`, com `expo-system-ui`).
- Na tela Conta, "Aparência": Automático, Claro ou Escuro, lembrado entre aberturas. A escolha é aplicada com `Appearance.setColorScheme`, então componentes nativos acompanham.
- A tela de abertura fica visível até a escolha salva ser aplicada, para o app não piscar no tema errado.
- Mapa: no Android, a propriedade `userInterfaceStyle` do react-native-maps não escureceu o Google Maps; o tema escuro usa um estilo JSON próprio (`src/map-dark-style.ts`), nos tons da paleta.

### Logo

- Arquivos em `apps/mobile/assets/brand/`: os originais (`source-*.png`) e as versões usadas pelo app, recortadas e sem os pontos soltos das imagens originais.
- **Cabeçalho da tela inicial:** logo horizontal no lugar do título. No tema escuro, uma variante com azul-marinho e branco trocados (o nome em branco), gerada a partir do original.
- **Ícone do app:** a bomba sobre azul-marinho. No Android, ícone adaptativo (bomba em 50% da área, dentro da zona segura) e versão monocromática para os ícones temáticos.
- **Tela de abertura:** a bomba sobre o fundo do tema (`expo-splash-screen`, com variante escura).

### Mapa ou lista

Controle segmentado com contorno, ícone em cada opção (`expo-symbols`: Material Symbols no Android, SF Symbols no iOS) e a opção escolhida preenchida com a cor de ação.

## Consequências

- Mudanças de ícone, abertura e tema automático são nativas: exigem `expo prebuild` e um novo APK.
- O logo veio como imagem gerada, com bordas irregulares. Para a loja de apps e materiais impressos, convém uma versão vetorial (SVG) desenhada a partir dele.
- `@expo/vector-icons` está sendo descontinuado pela Expo; os ícones usam `expo-symbols`.
