# ADR 0018: Portal do posto, primeira entrega

- **Status:** aceito
- **Data:** 2026-11-05
- **Complementa:** ADR 0011 (verificação do responsável) e ADR 0012 (proposta de valor)

## Contexto

O ADR 0012 lista o que o portal oferece aos postos. A primeira entrega precisa cobrir o motivo principal para o posto entrar (manter os preços atualizados) e mostrar valor logo no primeiro acesso, sem esperar recursos que dependem de dados ainda inexistentes (eventos de uso do app, convênios).

## Decisão

### Escopo

- Login com Google e lista "Meus postos" (com um só posto, abre direto nele).
- **Preços:** preços vigentes do posto e atualização por combustível, com promoção (nome e validade). Usa a rota de informe de preço que o app já usa; para o gestor, o informe sai como "Atualizado pelo posto" (ADR 0003). Valor muito diferente do atual pede confirmação, como no app.
- **Concorrência local:** por combustível, os postos num raio com preço vigente (do mais barato ao mais caro, com o próprio posto na posição), a posição do posto na cidade (1º = mais barato) e a média semanal da ANP no estado.
- **Reputação:** IQP do posto por dimensão comparado à média dos postos da cidade com nota.

Ficam para depois: QR code, vitrine (horário, serviços, fotos), demanda gerada pelo app (precisa dos eventos do ADR 0012), convênios, gestores convidados e verificação por e-CNPJ (ADR 0011).

### Limite concorrencial

Os dados de concorrência são os mesmos que o app mostra a qualquer motorista: preços vigentes, idade da informação e a média pública da ANP. O portal não sugere preço, não alerta sobre mudanças de concorrentes nesta entrega e não mostra nada que não seja público.

### API

- `GET /v1/portal/stations/:id/competition` e `GET /v1/portal/stations/:id/reputation`, só para gestores do posto (`UsersService.managesStation`) e administradores.
- O raio da concorrência é o parâmetro `portal.competition_radius_m` (5 km no início, a cidade-piloto inteira), conforme o ADR 0006.
- A posição na cidade considera todos os postos ativos do município com preço vigente do combustível; empates ficam na mesma posição.
- A média do IQP da cidade usa o último cálculo de cada posto, só dos que têm nota (fora "Dados insuficientes").

### Portal (apps/portal)

- React, Vite, React Router e TanStack Query. Layout pensado primeiro para o celular (o gerente atualiza o preço na pista) e que se expande no computador.
- Mesma identidade e temas do app (ADR 0017): segue o sistema, com troca no cabeçalho, lembrada no navegador.
- **Login:** botão oficial do Google (Google Identity Services), com o mesmo cliente OAuth Web que o app usa; a API recebe o ID token como no app. A origem do portal precisa estar em "Authorized JavaScript origins" desse cliente.
- **Sessão no navegador:** token de acesso só na memória; token de renovação no `localStorage`, para a sessão sobreviver ao recarregar. Um cookie `httpOnly` seria mais protegido contra XSS, mas portal e API ficam em domínios diferentes no Render (cookie de terceiros, bloqueado por vários navegadores). O risco é reduzido porque o token de renovação vale uma vez e a reutilização de um token já usado revoga a família inteira (ADR 0007). Rever ao colocar portal e API sob o mesmo domínio.
- O portal usa o código-fonte TypeScript do `@tankei/shared` (alias no Vite): o pacote é compilado em CommonJS para a API e o app, e o empacotador da web não lê os nomes reexportados desse formato.

## Consequências

- O registro de auditoria exigido pelo ADR 0011 ainda não existe. Nesta entrega a única ação do portal é informar preço, e cada informe já fica no histórico com o autor (tabela só de inserção). O registro passa a ser necessário quando entrarem convites, remoções e edição da vitrine.
- O vínculo do gestor continua sendo criado pelo administrador (piloto). A separação entre responsável verificado e gestor convidado (ADR 0011) entra com os convites.
- A hospedagem do portal (site estático no Render, com o endereço cadastrado no Google) fica para quando a primeira versão for aos postos.
