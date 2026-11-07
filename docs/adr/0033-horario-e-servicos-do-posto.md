# ADR 0033: Horário de atendimento, serviços do posto e cartão do mapa

- **Status:** aceito
- **Data:** 2026-11-07
- **Complementa:** ADR 0006 (parâmetros), 0021 (redes e papéis), 0026 (vitrine do posto)

## Contexto

Nem todo posto funciona 24 horas, e quem procura um posto à noite ou no domingo precisa saber se ele está aberto. O autor também precisou de borracharia na estrada: muitos postos de rodovia têm uma anexa, e calibragem é o serviço mais procurado. Além disso, o cartão aberto pelo toque num posto do mapa ficava na tela até a pessoa fechar.

## Decisão

- **Horário:**
  - quatro tipos de dia: segunda a sexta, sábado, domingo e feriados;
  - cada tipo é "fechado", "24 horas" ou até dois intervalos (por exemplo, uma pausa no almoço);
  - um intervalo pode passar da meia-noite (18:00 às 02:00);
  - dois intervalos do mesmo dia não podem se sobrepor.
- **Feriados:** só os nacionais, calculados no código: os fixos (Leis 662/1949, 6.802/1980, 10.607/2002 e 14.759/2023) e a Sexta-feira Santa. Carnaval e Corpus Christi são ponto facultativo e ficam de fora. Feriados estaduais e municipais ficam para depois; exigem cadastro por UF e município.
- **"Aberto agora":**
  - é calculado no cliente (`openingStatus`), na hora local da UF do posto. AC fica em -5; AM, RO, RR, MT e MS em -4; o restante em -3. Não há horário de verão.
  - Textos: "Aberto 24 horas" (quando não fecha nas próximas 24 h), "Aberto · fecha às 22:00", "Fechado · abre às 06:00", "Fechado · abre amanhã às 06:00" e "Fechado · abre segunda às 06:00".
  - Sem horário informado, o app **não diz nada**. Não informar não significa fechado.
- **Serviços:** "Calibragem" e "Borracharia". A lista pode crescer, com troca de óleo, lavagem, recarga elétrica e outros.
- **Quem informa:**
  - no portal, o proprietário e o gestor, pela nova ação `manage_info` (tela "Posto › Horário e serviços"); o operador e o somente leitura só veem;
  - no admin, a equipe Tankei, na ficha do posto, para preencher postos do piloto que ainda não têm responsável.
- **Histórico:** `station_info_versions` é só de inserção, como preços e avaliações. Cada alteração é uma versão com a origem (posto ou equipe), a conta e o momento. Vale a mais recente.
- **Leitura tolerante:** as regras de preenchimento valem só na entrada. As respostas usam o formato gravado (`storedOpeningHoursSchema`), para que uma regra nova não quebre a leitura de horários já salvos, nem a lista do app.
- **No app:**
  - o cartão do posto, no mapa e na lista, mostra "aberto agora" em verde ou vermelho e os serviços com ícone;
  - a ficha ganha a seção "Horário e serviços", com o tipo de dia de hoje em destaque.
- **Cartão do mapa:** o cartão aberto pelo toque num posto fecha sozinho depois de `app.map_card_close_seconds` segundos (parâmetro novo, valor inicial 8; 0 = não fecha). Tocar de novo num posto recomeça a contagem. O app lê o valor em `GET /v1/config`.
- **IQP:** não muda. Serviço marcado não dá nota, e não ter o serviço não tira nota.

## Consequências

- A informação só aparece nos postos que a preencherem: no piloto, a equipe preenche pelo admin os postos sem responsável.
- **Próximo passo:** o consumidor sugerir pelo app ("tem borracharia"), com confirmações, como no estudo de recarga elétrica. As avaliações que dão nota ao calibrador também indicam que ele existe.
- Feriado municipal (por exemplo, o aniversário da cidade) aparece com o horário de dia comum até existir o cadastro de feriados locais.
