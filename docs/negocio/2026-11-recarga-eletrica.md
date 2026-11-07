# Estudo: recarga de veículos elétricos nos postos

- **Data:** 2026-11-06
- **Situação:** estudo para implementação. As escolhas marcadas como **decisão pendente** viram ADR depois de aprovadas.
- **Relacionado:** ADR 0006 (parâmetros), 0024 (confiança nos preços), 0028 (modos de exibição), 0029 (recursos do consumidor), 0031 (caminho do dono).

## Por que agora

Postos estão instalando carregadores, e o Tankei já tem o que falta nos apps de recarga: a ficha do posto, preço informado por quem usa, confiança nos informes e o portal do posto. Quem chegar primeiro com "posto + recarga + preço" num só lugar ganha o hábito de quem tem carro elétrico ou híbrido plug-in.

## Como a recarga é cobrada no Brasil

### Regras

- **ANEEL:** a recarga é regulada pela Resolução Normativa 1.000/2021, no capítulo sobre veículos elétricos, que substituiu a REN 819/2018.
  - Recarga para terceiros é **atividade livre**: o preço é definido pelo operador, sem tarifa regulada.
  - A ANEEL já disse que não vai intervir no preço.
  - A distribuidora só cobra do posto a energia, pela tarifa normal.
- **Inmetro:** ainda **não há regra metrológica publicada** para a cobrança.
  - Os carregadores são chamados de SAVE (Sistemas de Abastecimento de Veículos Elétricos).
  - Houve consulta pública sobre a regulamentação metrológica deles.
  - Em maio de 2026, um grupo de trabalho preparava a análise de impacto regulatório (AIR) dos SAVE.
  - A tendência é a medição por kWh com garantia metrológica, como a bomba de combustível tem hoje.
- **Na prática:** a cobrança é livre, e a forma de cobrar varia de rede para rede.

### Formas de cobrança encontradas

| Forma | Como funciona | Observação |
|---|---|---|
| **Por kWh** | R$ por kWh entregue | A mais comum nas redes e a que o Inmetro deve exigir medir. É a única comparável entre postos. |
| Taxa por sessão | Valor fixo por recarga, somado ao kWh | Ex.: Volvo, R$ 2,50 de "conectividade". |
| Por tempo | R$ por minuto ou hora conectado | Usada em AC lento e em alguns estacionamentos. |
| Taxa de ociosidade | R$ por minuto após terminar a recarga e passar da tolerância | Ex.: Volvo, R$ 5,00/min após 15 min, em rodovias. Serve para liberar a vaga. |
| Gratuita | Cortesia para clientes (loja, restaurante, hotel) | Comum, mas está diminuindo: a Volvo passou a cobrar em junho de 2026. |

### Valores de referência (2026)

| Tipo | Faixa encontrada |
|---|---|
| DC (rápida) | R$ 1,80 a R$ 3,50/kWh. Volvo: R$ 2,90/kWh desde 15/06/2026. |
| Recarga pública com preço declarado | Mediana citada: R$ 2,00/kWh (set/2026). |
| Em casa | Cerca de R$ 0,85/kWh com impostos (média nacional). |

São valores de reportagens, não uma base oficial. Servem para definir os limites de plausibilidade dos informes.

### Termos técnicos que o app precisa mostrar

- **AC (lenta ou semirrápida):** de 7 a 22 kW. Uma recarga leva horas.
- **DC (rápida):** de 30 a mais de 150 kW. Leva de 20 a 60 minutos.
- **Conectores comuns no Brasil:**
  - Tipo 2 (AC), o padrão nacional;
  - CCS2 (DC), o mais comum em recarga rápida;
  - CHAdeMO (DC), em carros mais antigos;
  - GB/T (DC), em alguns modelos chineses.
- **O que interessa a quem dirige:** se o conector serve no seu carro, a potência, o preço por kWh e se o ponto está livre ou funcionando.

## Proposta para o Tankei

### 1. Dados do posto: pontos de recarga

Nova tabela `station_chargers`, com uma linha por tipo de ponto do posto:

- **Tipo e conector:** AC ou DC, e conector (Tipo 2, CCS2, CHAdeMO, GB/T).
- **Potência e quantidade:** potência em kW e quantos pontos daquele tipo existem.
- **Acesso:** público, ou só para clientes. "Não disponível" nunca vira nota baixa.
- **Como pagar:**
  - pelo app da operadora (campo livre com o nome da operadora);
  - no caixa do posto;
  - gratuito.
- **Histórico:** alterações criam registros novos (regra do histórico auditável).

### 2. Preço: R$/kWh como "combustível"

- **Dois novos tipos em `FUEL_TYPES`:** `recarga_ac` e `recarga_dc`, com o rótulo "Recarga AC/DC (kWh)". Assim se reaproveita o que já existe:
  - informe de preço do consumidor e do posto, preço oficial e promoções;
  - confiança e divergência (ADR 0024);
  - alertas de preço (ADR 0029) e a ordenação por menor preço.
- **Unidade:** cada tipo ganha a sua (L, m³ do GNV, kWh). O app passa a mostrar "R$ 2,90/kWh". Hoje a unidade é implícita.
- **Taxas extras** (sessão e ociosidade) ficam como **observação** no ponto de recarga, sem entrar na comparação. Comparar só R$/kWh é honesto e simples.
- **Cobrança só por tempo:** o posto marca "cobrança por tempo" e o app mostra "Preço por tempo, consulte no local", sem número comparável.
- **Novos parâmetros (ADR 0006):**
  - `price.ev_min_kwh` e `price.ev_max_kwh`, limites de plausibilidade (ex.: R$ 0,50 a R$ 6,00);
  - `charger.min_confirmations`, quantos consumidores confirmam um ponto sugerido.

### 3. Quem marca que o posto tem recarga

- **O posto, pelo portal:** cadastra os pontos e o preço oficial. Vale direto, como hoje.
- **O consumidor, pelo app ("Este posto tem recarga"):**
  - informa tipo, conector e, se souber, o preço por kWh;
  - o ponto aparece como **"informado por usuários"** depois de `charger.min_confirmations` confirmações, ou depois de aprovado na moderação do admin;
  - o preço segue as mesmas regras de confiança dos combustíveis.
- **Postos com responsável:** o que o posto informa prevalece, como no preço oficial.
- **Fora dos postos:** carregadores em shopping, hotel ou concessionária. Fica para depois; o Tankei é de postos.

### 4. No app

- **Seletor de combustível:** ganha "Recarga AC" e "Recarga DC". Com recarga escolhida, o mapa e a lista mostram só postos com o ponto, e a ordem é pelo menor R$/kWh.
- **Marcador e cartão:** raio no marcador; o cartão mostra a potência e os conectores.
- **Ficha do posto:** seção "Recarga elétrica" com os pontos, potência, conector, preço e forma de pagamento.
- **Meu carro:** "elétrico" ou "híbrido plug-in", conector e consumo (km/kWh). Com isso o app destaca os pontos compatíveis.
- **Depois:** a calculadora e o "Vale a pena ir até lá?" passam a comparar o custo por km do elétrico.

### 5. IQP

**Não muda agora.** A metodologia é versionada, e ter recarga é um serviço, não qualidade. Ter recarga não aumenta a nota, e não ter também não a reduz. Pode entrar mais tarde em "Serviços e conveniência" numa nova versão da metodologia, se fizer sentido.

### 6. Fora deste primeiro passo

- **Ponto livre ou ocupado em tempo real:** exige integração (OCPP) com as operadoras.
- **Reserva e pagamento pelo Tankei.**
- **Importação da base aberta [Open Charge Map](https://openchargemap.org):** licença CC BY-SA, exige atribuição. Daria uma carga inicial de pontos, mas a revisão jurídica precisa avaliar a licença antes.

## Decisões pendentes (para amanhã)

1. **Comparar só R$/kWh** e tratar taxas e cobrança por tempo como observação? *Recomendado.*
2. **Recarga AC e DC como dois "combustíveis"**, reaproveitando informes, confiança e alertas? *Recomendado.*
3. **Ponto sugerido pelo consumidor:** vale após N confirmações (parâmetro) ou só após moderação? *Recomendado: confirmações, com a moderação podendo remover.*
4. **"Meu carro" elétrico** entra junto ou numa segunda etapa? *Recomendado: junto, só com o conector, para filtrar pontos compatíveis.*

## Fontes

- ANEEL, REN 1.000/2021 (capítulo de veículos elétricos): [Canal Solar](https://canalsolar.com.br/resolucao-n1-000-da-aneel-e-publicada-e-revoga-ren-414/), [Poder360: Aneel não intervirá na cobrança](https://www.poder360.com.br/economia/aneel-nao-vai-intervir-em-cobrancas-para-recarregar-carros-eletricos/), [Agência Brasil via AASP](https://www.aasp.org.br/?p=39152).
- Inmetro e SAVE: [Canal VE: consulta pública](https://canalve.com.br/consulta-publica-inmetro-visa-regulamentar-recargas-ves/), [Agência Gov, maio/2026](https://agenciagov.ebc.com.br/noticias/202605/inmetro-estuda-novas-regras-para-baterias-e-recarga-de-veiculos-eletricos-no-pais), [Canal VE: regras em análise](https://canalve.com.br/inmetro-avalia-regras-recarga-carros-eletricos-brasil/).
- Preços: [Canal VE: Volvo unifica preço](https://canalve.com.br/eletropostos-volvo-unificam-preco-recarga-carros-eletricos/), [Canaltech: quanto custa em 2026](https://canaltech.com.br/carros/quanto-custa-carregar-um-carro-eletrico-em-2026), [Autoo: recarga rápida e gasolina](https://www.autoo.com.br/recarga-rapida-ja-esta-custando-o-mesmo-que-gasolina-no-brasil/), [Vrum: casa x postos](https://www.vrum.com.br/aceleradas/2026/08/7475124-carro-eletrico-quanto-custa-encher-o-tanque-em-casa-x-em-postos.html).
