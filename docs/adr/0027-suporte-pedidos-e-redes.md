# ADR 0027: "Não reconheço este pedido", mover posto de rede e rede sem dono

- **Status:** aceito
- **Data:** 2026-11-06
- **Complementa:** ADR 0011 (vínculo com o posto), 0019 (pedido de acesso), 0021 (redes), 0023 (admin de suporte), 0025 (e-mails)

## Contexto

Três pendências do suporte:
- o aviso de pedido de acesso ao proprietário atual não tinha como ser respondido pelo sistema;
- o admin não tirava nem movia um posto de rede;
- uma rede podia ficar sem proprietário quando a última conta proprietária era excluída, sem ninguém saber.

## Decisão

- **"Não reconheço este pedido":**
  - Quem gerencia a equipe da rede do posto (proprietário) vê, no portal, os pedidos de acesso em análise feitos por outras pessoas: nome informado, cargo e data, sem telefone nem observação.
  - Pode responder "Não reconheço", com motivo. Fica registrado (tabela `station_claim_disputes`, só inserção, uma por pessoa e pedido).
  - A fila de pedidos do admin mostra a contestação em destaque, e a equipe Tankei recebe um e-mail.
  - O e-mail ao proprietário (ADR 0025) leva ao portal.
- **Mover ou tirar o posto da rede (admin):**
  - Com motivo, registrado nas duas redes ("saiu da rede" / "entrou na rede … pelo administrador").
  - Quem tinha escopo só naquela unidade perde o acesso a ela.
  - A verificação de responsável (ADR 0011) fica, porque é histórico. O acesso vem da rede.
- **Rede sem proprietário:** depois da exclusão de uma conta, as redes de que ela saiu e que ficaram sem proprietário geram um e-mail à equipe Tankei, com o link da rede no admin.

## Consequências

- A proteção do ADR 0011 contra pedido indevido passa a ter resposta dentro do sistema. O botão direto no e-mail (sem entrar no portal) fica para depois, porque exigiria link assinado.
- Mover um posto de rede é ação de suporte, só do admin: no portal, ninguém transfere unidades entre redes.
