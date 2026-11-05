# ADR 0021: Redes de postos e equipe no portal

- **Status:** aceito
- **Data:** 2026-11-05
- **Altera:** ADR 0011 (papéis no posto). **Complementa:** ADR 0019 (reivindicação) e ADR 0020 (fases do portal).

## Contexto

O acesso ao portal era um vínculo por posto. Quem tem várias unidades (uma rede, ou um dono com empresas diferentes) precisaria vincular cada pessoa a cada posto, e unidades novas não chegavam sozinhas a quem já cuidava das outras. Foram avaliadas três alternativas: só vínculo por posto com convite em lote; permissões por pessoa sem entidade de grupo; e uma **rede** acima do posto, com membros, papéis e escopo. O autor escolheu a rede, mais completa e mais próxima de como os postos se organizam.

## Decisão

### Rede

- **Rede** é um grupo de postos com nome (ex.: "Rede Stang"). Cada posto pertence a no máximo uma rede.
- Um posto entra numa rede só por quem **comprovou ser responsável por ele** (reivindicação aprovada, ADR 0019, ou outra forma do ADR 0011). Ninguém junta à sua rede o posto de outra pessoa.
- A comprovação continua registrada por posto (`station_managers`: quem, forma e data). O acesso ao portal passa a vir da rede.
- Quem tem a reivindicação aprovada vira **proprietário** e o posto entra na rede dele; se a pessoa ainda não tem rede, uma é criada com o nome do posto.

### Papéis e escopo

| Papel | Pode |
|---|---|
| Proprietário | Tudo: equipe (convidar, alterar, remover), unidades da rede, nome da rede, além do que o gestor faz |
| Gestor | Preços, promoções e contestações (ADR 0020) das unidades do escopo |
| Operador | Atualizar preço das unidades do escopo |
| Somente leitura | Ver preços, histórico, concorrência e reputação das unidades do escopo |

- **Escopo:** todas as unidades da rede (inclui as que entrarem depois) ou unidades escolhidas. Proprietário tem sempre todas.
- Preço informado por qualquer papel com permissão sai como "Atualizado pelo posto".
- A rede precisa ter sempre ao menos um proprietário.

### Convites

- O proprietário convida por **e-mail**, com papel e escopo. Ainda não há envio de e-mail: o convite aparece no portal quando a pessoa entra com uma conta Google daquele e-mail, e ela aceita ou recusa. O proprietário pode copiar o endereço do portal para mandar por fora.
- Convite vale por um prazo (parâmetro `team.invitation_valid_days`, 14 dias) e pode ser revogado enquanto pendente.

### Registro de auditoria

Toda ação de equipe e de unidades (convite criado, aceito, recusado, revogado; papel ou escopo alterado; membro removido; unidade adicionada) entra num registro **só de inserção** por rede, com quem fez, quando e os detalhes. Atende ao registro exigido pelo ADR 0011.

### Portal

- Ao entrar: com mais de uma unidade, a **visão da rede** (tabela de unidades × combustíveis com preço e idade, alertas de preço desatualizado) e a atualização de um preço em várias unidades de uma vez. Com uma unidade só, direto nela.
- Menu lateral com seletor de unidade e o item **Equipe** (proprietário).
- Os itens do menu respeitam o papel: operador não vê o que não pode fazer; somente leitura não vê formulários.

### Migração

Cada pessoa com vínculo de responsável vira proprietária de uma rede com os postos que já gerenciava (nome da rede: o do primeiro posto). Nenhum acesso se perde.

## Consequências

- A autorização deixa de ser "gerencia o posto?" e passa a ser "pode fazer esta ação neste posto?", resolvida pela rede, pelo papel e pelo escopo, num único lugar da API.
- Alertas da fase 2 (divergência, contestação) vão para proprietários e gestores com o posto no escopo.
- Planos pagos por rede (ADR 0012) ganham onde se apoiar.
- Sem envio de e-mail, o convite depende de a pessoa entrar no portal; quando houver e-mail transacional, ele avisa do convite sem mudar o fluxo.
