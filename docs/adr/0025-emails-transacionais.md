# ADR 0025: E-mails transacionais

- **Status:** aceito
- **Data:** 2026-11-06
- **Complementa:** ADR 0011 (vínculo com o posto), 0019 (pedido de acesso), 0021 (equipe), 0020 e 0024 (divergência e moderação)

## Contexto

Convites, decisões de pedido de acesso, divergências de preço e decisões da moderação só apareciam quando a pessoa abria o portal. O prazo de 24 h da divergência (ADR 0024) não funciona se o posto não fica sabendo. Os outros projetos do autor já enviam pelo Resend, com o domínio `scheffer.solutions` verificado.

## Decisão

- **Provedor:** Resend, com a mesma conta e chave dos outros projetos.
- **Remetente:** `Tankei <nao-responda@scheffer.solutions>`, configurável em `MAIL_FROM`.
- **Resposta:** endereço de resposta opcional em `MAIL_REPLY_TO`. Com ele, o aviso ao proprietário diz "responda a este e-mail".
- **Links:** apontam para o portal e o admin publicados (`PORTAL_URL`, `ADMIN_URL`).
- **E-mails:**

  | Quando | Para quem |
  |---|---|
  | Convite para a equipe da rede | o e-mail convidado |
  | Novo pedido de acesso | equipe Tankei (contas administradoras) |
  | Novo pedido de acesso | proprietários atuais do posto (proteção do ADR 0011: quem não reconhece o pedido avisa antes da decisão) |
  | Pedido aprovado ou recusado (com o motivo) | quem pediu |
  | Consumidores confirmaram outro preço (divergência), com o prazo para responder | quem pode atualizar preço no posto (proprietário, gestor e operador do escopo). Uma vez por divergência: um novo informe do mesmo valor não reenvia |
  | Contestação aberta pelo posto ou rajada detectada | equipe Tankei |
  | Decisão da moderação | quem pode contestar no posto (proprietário e gestor do escopo) |

- **Destinatários:** os da equipe do posto vêm de `AccessService.recipients(posto, ação)`, com as mesmas regras de papel e escopo da API. Contas excluídas não recebem.
- **Um e-mail por destinatário**, para ninguém ver o endereço do outro. HTML simples com a versão em texto, e dados de cadastro escapados.
- **O envio nunca desfaz nem atrasa a ação:** roda em segundo plano depois de gravada. Falha do Resend ou da consulta de destinatários só vai para o log.
- **Sem `RESEND_API_KEY`** (desenvolvimento e testes), nada é enviado: o log registra destinatário e assunto.

## Consequências

- Não há fila nem nova tentativa: um e-mail que falha se perde (fica no log). Aceitável no piloto. Com volume, entra uma fila (tabela de saída e rotina de reenvio).
- O link "este não é o meu posto" (ADR 0011), que bloquearia o pedido direto do e-mail, fica para depois. Por enquanto, a pessoa responde ou avisa a equipe.
- A chave fica só no painel do Render (`sync: false`), nunca no repositório.
