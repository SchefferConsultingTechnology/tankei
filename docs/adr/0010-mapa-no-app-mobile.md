# ADR 0010: Mapa no app mobile

- **Status:** aceito
- **Data:** 2026-11-03

## Contexto

O app do motorista (Expo SDK 58) tem o mapa como tela principal, com o preço do combustível escolhido sobre cada posto. O plano inicial pede uma camada de abstração sobre o provedor de mapas, para que a troca de fornecedor não exija reescrever a lógica do app. No piloto, o custo deve ser zero, e ainda não há ambiente de produção nem contas nas lojas.

Alternativas avaliadas:

| | react-native-maps | expo-maps | MapLibre + OpenFreeMap | Mapbox |
|---|---|---|---|---|
| Mapa | Google (Android), Apple (iOS) | Google (Android), Apple (iOS) | OpenStreetMap nos dois | Mapbox nos dois |
| Expo Go | Sim | Não confirmado | Não | Não |
| Preço no marcador | Componente React | Só imagem | Sim | Sim |
| Custo | Sem cobrança pelo SDK móvel do Google; Apple grátis | Igual | Zero, sem chave | Grátis até ~25 mil usuários ativos/mês |
| Risco | Visual diferente entre plataformas | Recursos limitados | Servidor gratuito sem garantia de disponibilidade | Custo e dependência do fornecedor |

## Decisão

- Usar **react-native-maps**: Apple Maps no iOS e Google Maps no Android.
- O mapa fica isolado em um componente próprio do app (`StationMap`). Telas e regras não importam `react-native-maps` diretamente.
- "Traçar rota" abre o app de navegação instalado (Google Maps, Waze, Apple Maps) por link, independente do mapa.

## Consequências

- O desenvolvimento começa no Expo Go, sem build de desenvolvimento nem EAS.
- Para gerar o app Android para a loja, é preciso uma chave do Maps SDK for Android no Google Cloud (com conta de faturamento, sem cobrança pelo uso do SDK móvel), restrita ao pacote do app.
- O visual do mapa difere entre Android e iOS. Se isso pesar, a troca por MapLibre fica restrita ao `StationMap`.
