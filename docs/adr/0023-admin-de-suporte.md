# ADR 0023: Admin de suporte (parâmetros, postos e redes)

- **Status:** aceito
- **Data:** 2026-11-05
- **Complementa:** ADR 0006 (parâmetros), 0011 (vínculo com o posto), 0019 (reivindicação) e 0021 (redes)

## Contexto

O admin publicado tinha só a fila de pedidos de acesso. Para dar suporte aos primeiros postos, a equipe Tankei precisava mexer direto no banco: mudar um parâmetro, achar a rede de um posto, ver quem está na equipe, socorrer uma rede que ficou sem proprietário ou retirar um acesso indevido.

## Decisão

- **Parâmetros:** a tela lista os parâmetros por grupo, com nome, unidade, valor vigente e a última alteração. A alteração exige motivo e grava um registro novo (a tabela continua só de inserção, ADR 0006). A API valida a unidade (percentual de 0 a 100; os demais, inteiros positivos) e a coerência dos pares: a distância normal da média ANP não passa da máxima, e o prazo de "desatualizado" não passa do prazo para ocultar. Cada parâmetro ganha `label` e `unit` no `@tankei/shared`.
- **Postos:** busca por CNPJ (pode ser parcial), nome ou cidade, inclusive inativos. O detalhe mostra a rede, os responsáveis verificados (com a forma de verificação) e os pedidos em análise. O vínculo direto (verificação presencial) passa a aceitar o **e-mail** da conta, além do id.
- **Redes:** lista por nome da rede ou e-mail de alguém da equipe, com aviso de rede sem proprietário. O detalhe mostra unidades, equipe, convites e o **registro da rede em texto** (nomes de pessoas e unidades resolvidos na API).
- **Ajustes pelo administrador:** renomear a rede, mudar papel e escopo de alguém e remover da equipe. Mudança de papel e remoção exigem motivo, que vai para o registro da rede com a marca "pelo administrador". As regras são as mesmas do portal (o `OrganizationsService` é o único caminho): a rede não fica sem proprietário por essas ações. Remover pelo administrador também retira a verificação de responsável da pessoa nas unidades da rede.
- **Rotas:** `/v1/admin/parameters`, `/v1/admin/stations`, `/v1/admin/networks` (todas `@Roles('admin')`).

## Consequências

- Suporte do dia a dia sem SQL; toda alteração deixa autor, data e motivo.
- Rede sem proprietário (ex.: conta excluída) é resolvida promovendo alguém da equipe ou vinculando um responsável pelo posto.
- Ficam para depois: tirar uma unidade da rede ou mover para outra, desfazer o vínculo de um responsável sem rede, e a fila de moderação da fase 2 (ADR 0020).
