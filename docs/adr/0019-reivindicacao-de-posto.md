# ADR 0019: Reivindicação de posto com aprovação do administrador

- **Status:** aceito
- **Data:** 2026-11-05
- **Complementa:** ADR 0007 (vínculo do gestor) e ADR 0011 (verificação do responsável)

## Contexto

Quem entrava no portal sem vínculo com um posto via só "fale com a equipe", sem caminho dentro do produto, e o administrador vinculava a conta pela API. A verificação automática por e-CNPJ (ADR 0011) é uma entrega maior. O piloto precisa de um caminho que funcione já e que o e-CNPJ possa assumir depois sem mudar o fluxo.

## Decisão

### Fluxo

1. No portal, quem não gerencia posto vê os próprios pedidos e "Reivindicar meu posto": busca o posto por CNPJ (com ou sem pontuação, pode ser parcial) ou por nome (sem diferenciar acento, com filtro de UF) e informa nome, telefone com DDD, cargo (dono, sócio, gerente, outro) e uma observação opcional.
2. No admin, a fila "Em análise" mostra o posto (razão social e CNPJ), o contato, a conta do Google e quantas pessoas já têm acesso ao posto. O administrador liga, confirma o vínculo e aprova registrando a forma (telefone, presencial ou documentos), ou recusa com um motivo que a pessoa vê.
3. A aprovação cria o vínculo de **responsável** com a forma e a data da verificação. O portal recarrega a conta quando encontra um pedido aprovado.

### Dados

- `station_managers` ganha `role` (responsável ou convidado), `verification_method` e `verified_at`. Os vínculos já existentes (piloto) viram responsável com verificação presencial, e o vínculo direto pelo administrador também passa a registrar "presencial".
- `station_claims` guarda o pedido. **Não é só de inserção:** nome, telefone e observação são apagados na exclusão da conta (ADR 0009); o pedido continua registrado.
- `station_claim_decisions` guarda a decisão: uma por pedido, **só de inserção** (registro de auditoria da verificação). Pedido decidido não volta para análise; um novo pedido pode ser feito.
- Limite de pedidos em análise por conta no parâmetro `claim.max_pending_per_user` (3), contra abuso.
- A busca por nome normaliza acentos no próprio SQL (`translate`), sem depender da extensão `unaccent`, que pode não estar instalada em todos os bancos.

### Admin (apps/admin)

Primeira versão do admin: login com Google, acesso só para administradores (a API também recusa os demais) e a fila de pedidos por situação. Usa a mesma base do portal (sessão, login, tema), copiada.

## Consequências

- Quando o e-CNPJ entrar, a assinatura válida aprova o pedido automaticamente com a forma `ecnpj`; a carta, com `carta`. O resto do fluxo não muda.
- Ainda faltam duas proteções do ADR 0011: avisar os responsáveis atuais quando alguém ganha acesso ao posto (não há envio de e-mail ou notificação na plataforma) e o canal "este não é o meu posto". O admin mostra quantas pessoas já têm acesso, para o administrador confirmar com o posto antes de liberar mais alguém.
- Portal e admin repetem a base web (cliente da API, sessão, login, tema, estilos). Se crescer, vira um pacote compartilhado do monorepo.
- O login do admin exige cadastrar `http://localhost:5174` (e o endereço publicado) nas origens do cliente OAuth Web do Google, como no portal.
