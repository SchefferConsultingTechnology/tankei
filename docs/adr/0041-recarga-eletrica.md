# ADR 0041: Recarga elétrica nos postos

- **Status:** aceito
- **Data:** 2026-11-09
- **Detalha:** estudo `docs/negocio/2026-11-recarga-eletrica.md`
- **Complementa:**
  - ADR 0003 (preço exibido) e ADR 0006 (parâmetros);
  - ADR 0024 (confiança nos preços) e ADR 0029 (Meu carro, alertas);
  - ADR 0033 (horário e serviços).

## Contexto

Postos estão instalando carregadores. O Tankei já tem a ficha do posto, o preço informado por quem usa, a confiança nos informes e o portal do posto. Falta a recarga. O estudo levantou as regras: a cobrança é livre (ANEEL, REN 1.000/2021) e o Inmetro ainda não publicou regra metrológica. Também levantou as formas de cobrança: por kWh, taxa por sessão, por tempo e ociosidade.

## Decisão

O autor aprovou as quatro recomendações do estudo em 2026-11-09.

### 1. Comparar só o preço por kWh

- O app compara só R$/kWh.
- Ficam como **observação** no ponto, fora da ordem por menor preço:
  - taxa por sessão;
  - taxa de ociosidade;
  - cobrança por tempo ("Cobra por tempo: consulte o preço no local").
- A ANP não tem referência para recarga. Os limites de plausibilidade são fixos em parâmetro (`price.ev_min_kwh` R$ 0,50 e `price.ev_max_kwh` R$ 6,00). Fora da faixa, a API responde 422 `PRICE_OUT_OF_RANGE`.

### 2. AC e DC como dois "combustíveis"

**Reaproveitamento**
- `recarga_ac` e `recarga_dc` entram em `FUEL_TYPES` (enum `fuel_type` no banco).
- Ganham, sem código novo:
  - informe de preço do consumidor e do posto, e preço oficial;
  - promoção e convênio;
  - confiança e divergência;
  - alertas de preço;
  - o filtro no mapa e a ordem por menor preço.

**Unidade e calculadoras**
- Cada combustível tem unidade (`FUEL_UNITS`: L, m³, kWh). O app mostra "R$ 2,90/kWh" e o portal mostra "(por kWh)".
- O "Vale a pena ir até lá?" não aparece para recarga, porque a conta é por tanque em litros.

**Quando o posto "vende" recarga**
- Vale o cadastro oficial (`station_charger_versions`) ou, sem ele, as sugestões confirmadas. Quem decide é sempre o que está valendo:
  - `station_fuels` recebe ou perde `recarga_ac` e `recarga_dc` conforme o que vale;
  - o posto não informa preço de recarga sem antes cadastrar o ponto.

### 3. Quem informa os pontos

**O posto e a equipe**
- O posto cadastra pelo portal, em Posto › Recarga elétrica, com a ação `manage_info`. A equipe cadastra pelo admin, na ficha do posto.
- Cada ponto informa:
  - tipo (AC ou DC) e conector (Tipo 2, CCS2, CHAdeMO, GB/T, Tipo 1);
  - potência e quantidade;
  - acesso (público ou só clientes) e forma de pagamento;
  - operadora, cobrança por tempo e taxas extras.
- O cadastro é só de inserção: vale a versão mais recente, e uma lista vazia quer dizer "sem recarga".

**O consumidor**
- Pelo app, na ficha: "Este posto tem recarga? Avise", com tipo e, se souber, o conector.
- O ponto aparece como "informado por motoristas" depois de `charger.min_confirmations` (2) pessoas diferentes.
- A mesma pessoa conta uma vez.
- A equipe do posto não pode sugerir.

**Moderação**
- O admin descarta as sugestões de um tipo, com motivo (`charger_suggestion_dismissals`). As sugestões anteriores ao descarte deixam de contar.

**Precedência**
- Com cadastro oficial, ele prevalece. Novas sugestões são recusadas (409) e o app esconde o botão.

### 4. Meu carro elétrico

- "Meu carro" ganha a motorização (combustão, elétrico ou híbrido plug-in) e os conectores do carro. Fica só no aparelho, como o resto do perfil.
- Na ficha, cada ponto mostra "✓ Serve no seu carro" ou "Conector diferente do seu carro".
- Com o carro elétrico, a seção de recarga aparece mesmo sem pontos informados.
- O custo por km na calculadora fica para depois.

### No app

- **Cartão do mapa e lista:** o chip "⚡ Recarga AC e DC até 60 kW".
- **Ficha:** a seção "⚡ Recarga elétrica", com os pontos, o acesso, o pagamento, as taxas e a origem da informação.
- **Seletor de combustível:** "Recarga AC" e "Recarga DC" aparecem quando há postos com recarga na região.

### IQP

Não muda. Recarga é um serviço, não qualidade: ter recarga não aumenta a nota e não ter não a reduz.

## Fora deste passo

- **Status em tempo real:** ponto livre ou ocupado depende de integração OCPP com as operadoras.
- **Reserva e pagamento pelo Tankei.**
- **Importação do Open Charge Map:** a licença CC BY-SA depende da revisão jurídica.
- **Carregadores fora de postos.**
- **Custo por km do elétrico** na calculadora e no "Vale a pena ir até lá?".
