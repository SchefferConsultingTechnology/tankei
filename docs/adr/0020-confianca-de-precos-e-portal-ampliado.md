# ADR 0020: Confiança dos preços, contestação pelo posto e portal ampliado

- **Status:** aceito (implementação em três fases)
- **Data:** 2026-11-05
- **Altera:** ADR 0003 (preço exibido e selos). **Complementa:** ADR 0006, 0018 e 0019.

## Contexto

Pela regra do ADR 0003, o preço do posto é substituído quando duas pessoas diferentes confirmam um valor posterior em até 48 h. Isso abre um ataque: concorrentes combinam um valor mais alto (sem precisar estar no posto) e derrubam o preço do posto. Do outro lado, o informe do consumidor é o que impede o posto de anunciar um preço e cobrar outro; dar ao posto o poder de apagar ou ocultar informes tiraria essa proteção. O autor pediu também o histórico de preços no portal, a comparação com outras cidades, promoções com arte e fotos do posto.

## Decisão

### Contestação (fase 2)

- O posto **não apaga nem oculta** informes. Ele **contesta** um informe de consumidor, com motivo.
- O informe contestado sai do cálculo do preço exibido enquanto a equipe Tankei analisa. A equipe mantém ou anula; a contestação e a decisão ficam registradas (só inserção), e o informe original nunca muda.

### Proteções contra ataque (fase 2; números em parâmetros, ADR 0006)

1. **Divergência avisa o posto.** Consumidores que confirmam um valor diferente de um preço recente do posto não o substituem na hora: o app mostra o preço do posto com o aviso "consumidores informaram R$ X" e o portal alerta o posto. Se o posto reconfirmar o preço, a divergência é encerrada; sem resposta no prazo, vale o valor dos consumidores.
2. **Peso por confiabilidade.** Contas novas ou sem informes anteriores aceitos informam, mas não confirmam o informe de outra pessoa (idade mínima da conta e número mínimo de informes aceitos).
3. **Estava no posto.** No envio, o app compara a posição da pessoa com a do posto e a API guarda só se estava perto (sim ou não), nunca a localização (ADR 0009). Informar à distância continua permitido, com peso menor.
4. **Detecção de rajada.** Vários informes iguais e destoantes do mesmo posto em pouco tempo, de contas novas ou longe do posto, vão para a fila da equipe em vez de mudar o preço.

### Desempate entre consumidores (fase 2)

Sem preço recente do posto, entre informes de consumidores na janela de confirmação vence o valor com mais pessoas diferentes, contadas com os pesos acima; persistindo o empate, vale o mais recente. Quando houver valores conflitantes, o app mostra o vencedor e indica que houve outro valor informado.

### Confirmação do valor

Quem informa um preço muito diferente do vigente (parâmetro `price.variation_confirm_pct`) confirma antes de publicar. Vale também para o posto e para **promoções**: antes, a promoção pulava essa confirmação, e um erro de digitação (ex.: etanol a R$ 3,00) entrava direto, acima dos outros preços.

### Selos

"Informado por motorista" passa a "Informado por consumidor" e "Confirmado por motoristas" a "Confirmado por consumidores" (fase 1). Os identificadores internos não mudam.

### Portal (fase 1)

- **Menu lateral** com itens e subitens (gaveta no celular): Preços (atualizar, histórico), Concorrência (região, outras cidades, promoções da concorrência) e Reputação. Os itens das fases seguintes entram quando existirem.
- **Histórico de preços:** informes do posto e dos consumidores, com a situação de cada um e qual está em vigor. O consumidor aparece sob um apelido estável por posto (sem nome, ADR 0009), para o posto reconhecer informes repetidos da mesma conta.
- **Concorrência:** raio escolhido na tela, limitado ao parâmetro `portal.competition_radius_m`; comparação com outra cidade (menor preço, média, mediana e a posição que o posto teria lá); promoções vigentes dos concorrentes; a média da ANP no estado continua.

### Promoções e imagens (fase 3)

- Promoção vira cadastro próprio: título, descrição, arte opcional, validade e, opcionalmente, preço promocional por combustível, que aparece no mapa e na concorrência.
- Fotos do posto e artes de promoção são publicadas na hora; a equipe vê as novas numa fila e pode remover. Arquivos no Storage do Supabase (com equivalente local no `docker compose`).

## Consequências

- O selo e o preço exibido passam a depender de mais sinais; a regra continua no backend, com testes.
- Nenhuma das proteções impede o consumidor de contrariar o posto: só exige mais evidência e dá ao posto a chance de responder.
- O apelido do consumidor no histórico é derivado da conta e do posto: o mesmo consumidor tem apelidos diferentes em postos diferentes.
