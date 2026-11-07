# ADR 0032: Modo direção no mapa

- **Status:** aceito
- **Data:** 2026-11-06
- **Complementa:** ADR 0009 (privacidade), 0010 (mapa), 0029 (recursos do consumidor)

## Contexto

Com a tela sempre ligada, o app passa a ser usado no carro, como o Maps e o Waze: a pessoa quer ver, enquanto dirige, os postos que vêm pela frente. O mapa já seguia a posição (a cada 25 m) e refazia a busca a cada 2 km. Mas continuava com o norte para cima, com o zoom fixo e com postos que já tinham ficado para trás.

## Decisão

- **Quando entra:** com a opção "Perto de você", acima de 15 km/h; sai abaixo de 5 km/h. A folga evita alternar em semáforo e lombada.
- **Leituras do GPS:** uma por segundo (antes, uma a cada 25 m), mesmo parado. Assim a velocidade cai a zero ao parar e o modo desliga. Oscilações de menos de 8 m com a mesma velocidade são ignoradas, para o mapa não tremer.
- **Velocímetro:** no modo direção, a velocidade aparece no canto superior esquerdo do mapa. Pode diferir do painel do carro, que por norma marca um pouco a mais.
- **Velocidade e rumo:** vêm do GPS. Sem rumo do GPS, o app calcula pela direção entre as duas últimas posições. A velocidade é suavizada. O rumo só é atualizado acima de 5 km/h, porque abaixo disso ele não é confiável.
- **Mapa no rumo:** o mapa gira no sentido do deslocamento. O carro fica um quarto da tela abaixo do centro, para mostrar mais da estrada à frente.
- **Parado:** o mapa mantém a última direção. A bússola volta o norte para cima.
- **Zoom pela velocidade:**
  - 15 até 45 km/h (cidade): zoom 15;
  - até 80 km/h (avenida): zoom 14;
  - acima de 80 km/h (estrada): zoom 13.
- **Folga do zoom:** a troca de faixa tem 5 km/h de folga. O zoom só é aplicado quando a faixa muda, então o zoom feito com os dedos vale até a próxima troca.
- **Postos à frente:**
  - no mapa e na lista ficam só os postos a até 100° do rumo, mais os que estão a menos de 300 m em qualquer direção;
  - o posto selecionado continua, mesmo depois de passar;
  - uma faixa "Dirigindo: mostrando os postos à frente" tem o botão "Ver todos".
- **Busca à frente:** dirigindo, o centro da busca fica 4 km à frente, no rumo. Ela é refeita quando esse ponto se afasta 3 km da última busca, uma folga maior por causa das curvas. O raio de 15 km cobre cerca de 19 km adiante.
- **Arrastar o mapa:** o mapa para de seguir, como antes. "Seguir minha posição" volta a seguir.
- **Onde fica:** os limites são constantes de interface em `src/driving.ts`, não regras de negócio, por isso não ficam nos parâmetros do banco (ADR 0006). A conta é feita no aparelho; a posição não vai para o servidor (ADR 0009).

## Consequências

- **Bateria:** o GPS de alta precisão ligado com a tela acesa gasta bateria. Se o teste real mostrar consumo alto, o próximo passo é baixar a precisão quando a pessoa estiver parada.
- **Distração:** o app mostra informação, não guia a rota. Tocar no posto abre o cartão, e "Traçar rota" leva ao app de navegação.
- **Sem Apple Maps no iOS:** a câmera usa zoom e rumo do Google Maps no Android. No iOS, a conferência fica para quando houver build iOS.
