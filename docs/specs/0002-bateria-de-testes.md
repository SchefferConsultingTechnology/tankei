# Spec 0002: Bateria de testes completa (pendente)

- **Status:** a fazer (adiada pelo autor em 2026-11-06)
- **Relacionados:** ADR 0016 (ambiente publicado), 0019 a 0025

## Objetivo

Conferir de ponta a ponta, no ambiente publicado (Render e Supabase) e no celular, o que até agora só foi testado automaticamente (e2e no banco de testes) ou com dados de demonstração. Rodar antes de abrir o piloto para postos reais.

## O que já está coberto

- **Testes automáticos** (rodar antes da bateria e anotar o total):
  - unitários: `pnpm test`;
  - e2e: `pnpm --filter @tankei/api test:e2e`;
  - estáticos: `pnpm lint`, `pnpm typecheck`.
- **Telas conferidas com dados de demonstração** (Playwright e celular): portal, admin, fase 2 e escala do IQP no app.

## Roteiro

### 1. E-mails (ADR 0025): nunca testados com a chave real

- [ ] **Deploy** do commit `ef25195` ou posterior "Live" no Render e `RESEND_API_KEY` configurada.
- [ ] **Convite para a equipe:**
  - chega ao e-mail convidado, de `nao-responda@scheffer.solutions`;
  - o link abre o portal.
- [ ] **Pedido de acesso:**
  - a equipe Tankei recebe "Novo pedido de acesso";
  - se o posto já tem rede, o proprietário recebe "Pedido de acesso a…".
- [ ] **Decisão do pedido:**
  - aprovar envia "Acesso liberado";
  - recusar envia "Pedido de acesso recusado", com o motivo.
- [ ] **Divergência:**
  - com duas contas de consumidor confirmando outro valor, proprietário, gestor e operador recebem o aviso com o prazo;
  - um terceiro informe do mesmo valor não reenvia.
- [ ] **Moderação:**
  - contestação e rajada chegam à equipe Tankei;
  - a decisão chega ao proprietário e ao gestor, e o operador não recebe.
- [ ] **Leitura:** HTML e texto legíveis no Gmail (web e celular), sem cair no spam. Conferir o SPF e o DKIM do domínio no Resend.
- [ ] **Falhas:** com uma chave inválida, a ação (ex.: convite) continua funcionando e o erro aparece no log do Render.
- [ ] **Resposta:** responder a um e-mail do Tankei chega a `scheffer.consulting.technology@gmail.com` (`MAIL_REPLY_TO`).

### 2. Fase 2: confiança dos preços (ADR 0020 e 0024)

- [ ] **Informe pelo app:** no posto, `at_station` = sim; longe, não; sem permissão de localização, nulo.
- [ ] **Conta nova** (menos de `price.trusted_min_account_days`): informa, mas não confirma o informe de outra pessoa.
- [ ] **Divergência:**
  - aparece no app ("Consumidores informaram R$ X");
  - aparece no portal, com prazo;
  - reconfirmar encerra.
- [ ] **Prazo:** sem resposta em `price.divergence_response_hours`, vale o valor dos consumidores.
- [ ] **Contestação pelo portal:**
  - tira os informes do preço;
  - "Manter" no admin devolve;
  - "Anular" remove de vez;
  - o posto vê a explicação em Contestações.
- [ ] **Rajada:** 3 contas novas, sem localização, com o mesmo valor destoante, abrem o caso sozinhas e não mudam o preço.
- [ ] **Desempate:** sem preço do posto, vence o valor com mais pessoas; empate, o mais recente; o app indica "Também foi informado outro valor".

### 3. Admin (ADR 0023)

- [ ] **Parâmetros:** alterar com motivo, ver no histórico e o efeito em até 1 minuto. A validação recusa valores fora da unidade e pares incoerentes.
- [ ] **Postos:** busca por CNPJ parcial, nome e cidade; vínculo de responsável pelo e-mail.
- [ ] **Redes:**
  - promover alguém a proprietário com motivo;
  - remover da equipe;
  - não permitir ficar sem proprietário;
  - registro legível.

### 4. Fase 3: vitrine do posto (ADR 0026)

- [ ] **Armazenamento:** no Supabase, criar o balde público `tankei-imagens` e as chaves S3, e configurar `STORAGE_*` no Render. Sem isso, o envio responde 503.
- [ ] **Promoções:**
  - criar com arte e preço por combustível; aparece no app (ficha com a arte, lista e mapa com o selo);
  - agendada não aparece antes do início;
  - encerrar antes tira o preço promocional;
  - preço muito diferente pede confirmação.
- [ ] **Fotos:**
  - enviar foto do celular (JPG e HEIC convertido pelo aparelho);
  - a imagem final está em WebP, com no máximo 1600 px e sem a localização GPS;
  - respeita os limites de 10 fotos e 5 MB.
- [ ] **Admin › Imagens:**
  - remover foto e arte, com motivo;
  - o posto vê o motivo no portal.
- [ ] **Permissões:** operador e somente leitura não enviam nem removem imagens.

### 5. Suporte (ADR 0027)

- [ ] **"Não reconheço":** o proprietário vê o pedido de outra pessoa no portal, responde "Não reconheço", a fila do admin mostra a contestação e o e-mail chega à equipe Tankei.
- [ ] **Mover posto:** mover para outra rede e tirar da rede; conferir o acesso das duas equipes e o registro das duas redes.
- [ ] **Rede sem dono:** excluir a única conta proprietária de uma rede envia o e-mail "Rede sem proprietário".

### 6. Modo de exibição do posto (ADR 0028)

- [ ] **Não participa:** preços continuam, com o aviso na ficha do app.
- [ ] **Preço oficial:**
  - só aceito para posto com rede;
  - consumidores não substituem o preço do posto nem depois de 24 h, e o aviso aparece;
  - a divergência persistente aparece na Moderação do admin.
- [ ] **Preços ocultos:**
  - posto no mapa sem preços ("Preços não exibidos"), sem o botão "Informar preço";
  - a API recusa informes.
- [ ] **Oculto:** o posto some do mapa, da lista e da ficha. Voltar para Normal o traz de volta.
- [ ] **Registro:** o histórico na ficha do admin mostra quem pediu, o motivo e quem decidiu.

### 7. Recursos do consumidor (ADR 0029)

- [ ] **Calculadora:** abre preenchida, pela tela inicial e pela ficha; com e sem o consumo do carro; resultado coerente (etanol a 63% da gasolina: etanol).
- [ ] **Meu carro:** tanque e consumo ficam salvos após fechar o app.
- [ ] **Favoritos:** estrela na ficha, lista em Favoritos, em outro aparelho com a mesma conta.
- [ ] **Alerta:**
  - criar um alerta e baixar o preço (pelo portal) abaixo do valor; o e-mail chega;
  - não repete no mesmo dia;
  - apagar o alerta.
- [ ] **Vale a pena:** aparece só com localização real; a conta faz sentido para um posto mais barato e mais longe.
- [ ] **Sua contribuição:** os números batem com os preços informados; selo Iniciante numa conta nova.

### 8. Portal e app em aparelhos reais

- [ ] **Celulares:** portal no celular (Chrome Android e Safari iOS), em tema claro e escuro.
- [ ] **App:**
  - escala do IQP (pílula "IQP N/100", medidor, "Como ler o IQP") em 360 e 412 dp, claro e escuro;
  - TalkBack anunciando "Índice de qualidade N de 100".
- [ ] **Modo direção (ADR 0032), num trajeto real (ex.: Curitibanos → Lages):**
  - acima de 15 km/h aparece "Dirigindo: mostrando os postos à frente"; o mapa gira no sentido da estrada, com o carro abaixo do centro;
  - o zoom abre na estrada e fecha na cidade, sem ficar pulando;
  - postos que ficaram para trás somem; "Ver todos" traz de volta;
  - postos novos aparecem à frente sem a tela piscar;
  - parado (semáforo), o modo continua até ficar abaixo de 5 km/h; a bússola volta o norte;
  - arrastar o mapa para de seguir; "Seguir minha posição" volta;
  - anotar a bateria gasta por hora.
- [ ] **Velocímetro:**
  - no padrão, o cartão aparece acima de 40 km/h e some abaixo de 35;
  - o número fica verde acima de 40, laranja acima de 80 e vermelho acima de 110;
  - "Sempre" mostra o cartão parado (0 km/h); "Desligado" não mostra o cartão.
- [ ] **Tela ligada:** com o app aberto a tela não apaga; desligando "Manter a tela ligada" em Conta, volta a apagar no tempo do celular; em segundo plano, apaga normalmente.
- [ ] **Perfis:** fluxo completo com cada papel (proprietário, gestor, operador, somente leitura), conferindo o que cada um vê e pode fazer.

### 9. Caminho do dono do posto (ADR 0031)

- [ ] **Convite na ficha:** aparece num posto sem rede e some num posto com rede.
- [ ] **WhatsApp:** abre o WhatsApp Business da equipe com a mensagem pronta (posto, endereço, código).
- [ ] **Pedir acesso:** o link abre o portal; depois do login, o pedido começa no passo dos dados com o posto certo; o admin vê a origem "Veio do app (responsável)".
- [ ] **Indicar:** o compartilhamento leva o link; o pedido feito por ele mostra "Veio do app (convite)".
- [ ] **Produção:** `SUPPORT_WHATSAPP` configurada no Render.

### 10. Horário, serviços e cartão do mapa (ADR 0033)

- [ ] **Portal:**
  - proprietário e gestor salvam horário e serviços em "Posto › Horário e serviços";
  - operador vê sem poder alterar;
  - a prévia "No app, agora" bate com o relógio.
- [ ] **Admin:** a equipe preenche um posto sem responsável; o resumo mostra "pela equipe".
- [ ] **App, cartão do mapa:**
  - "Aberto · fecha às…" em verde e "Fechado · abre…" em vermelho;
  - os ícones de Calibragem e Borracharia aparecem;
  - num posto sem horário informado, não aparece nada.
- [ ] **Casos de horário:** horário que passa da meia-noite, sábado com pausa para o almoço, domingo fechado e um feriado nacional (por exemplo, 15/11).
- [ ] **Cartão:**
  - fecha sozinho depois de 8 s;
  - mudar `app.map_card_close_seconds` no admin muda o tempo; 0 deixa o cartão aberto.

- [ ] **Nome no app (ADR 0035):**
  - o posto informa o nome em "Dados do posto";
  - o nome aparece no app (mapa, lista, ficha, favoritos), no e-mail de alerta e no portal;
  - em branco, volta ao nome da ANP;
  - a importação da ANP não apaga o nome.

### 11. Convênios (ADR 0034)

- [ ] **Portal:**
  - adicionar um convênio existente e um novo;
  - o mesmo nome com outra grafia (maiúsculas ou acento) usa o existente;
  - descontos em R$/L e em %, com a prévia do preço final;
  - acima do limite, a API recusa;
  - editar e encerrar;
  - operador não altera.
- [ ] **Admin:**
  - criar, renomear e desativar;
  - desativado some do app e da busca do portal;
  - excluir só aparece em convênio nunca usado.
- [ ] **App:**
  - o preço no mapa e na lista é sem desconto;
  - o cartão aberto pelo toque mostra os convênios do combustível escolhido;
  - a ficha mostra a seção "Convênios";
  - todo cartão mostra "Ver detalhes do posto ›".

### 12. Dashboard de adesão (ADR 0037)

- [ ] **Períodos:** 30 dias, 90 dias, 12 meses, "Este ano" e datas livres; o agrupamento muda de dia para semana e para mês.
- [ ] **Filtro por UF:** os totais batem com uma contagem manual no admin (Redes).
- [ ] **Tabela:** "Tabela" mostra os mesmos números do gráfico.
- [ ] **Temas e celular:** claro e escuro, e no celular sem rolagem lateral.

### 13. Dashboard de engajamento (ADR 0038)

- [ ] **Totais:** informes e avaliações batem com uma contagem manual de um posto conhecido; preço informado pelo posto não entra.
- [ ] **Regiões:** sem UF, aparecem os estados; com UF, as cidades. A tabela ordena por coluna.
- [ ] **Oportunidades:** só regiões com pelo menos 20 postos e menos de 10% de cobertura.
- [ ] **Temas e celular:** claro e escuro, e no celular sem rolagem lateral (só a tabela rola).

### 14. Visitas ao posto (spec 0003, ADR 0039)

- [ ] **Cartão:** tocar num posto do mapa e deixar o cartão fechar sozinho gera uma visita sem ficha. Em até 1 minuto ela chega à API.
- [ ] **Ficha:** abrir a ficha, ficar 30 s, ir para segundo plano por 2 min e voltar por mais 10 s registra cerca de 40 s na ficha.
- [ ] **Contribuição:** informar preço pela ficha (e pelo botão do cartão) liga o informe à visita. O mesmo vale para a avaliação.
- [ ] **Sem conexão:** as visitas ficam na fila e são enviadas quando a conexão volta, sem duplicar.
- [ ] **Interruptor:** desligado em Conta, nenhuma visita é registrada.
- [ ] **Portal sem o recurso:** aparece "Disponível na assinatura do portal". Liberado no admin, os números aparecem.
- [ ] **Anonimato:** com poucas visitas, aparece "menos de 5" e o gráfico agrupa por semana.
- [ ] **Temas e celular:** claro e escuro, e no celular sem rolagem lateral.

## Resultado

Registrar no fim deste arquivo: data, quem testou, o que passou e os problemas encontrados (com issue ou commit da correção).
