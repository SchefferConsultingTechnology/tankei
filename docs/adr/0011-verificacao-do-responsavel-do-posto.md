# ADR 0011: Verificação do responsável do posto

- **Status:** aceito
- **Data:** 2026-11-04
- **Complementa:** ADR 0007 (vínculo do gestor com o posto)

## Contexto

O login com Google ou Apple (ADR 0007) prova quem é a pessoa, mas não que ela responde por um posto. No piloto, o administrador vincula o gestor depois de falar pessoalmente com o dono. Na expansão para outras cidades e estados, isso não escala: a comprovação precisa ser feita pelo próprio responsável, de forma automática sempre que possível.

Um gestor falso poderia publicar preços com o selo "Atualizado pelo posto", criar promoções e ver estatísticas do posto. O impacto é limitado pelas regras existentes: os preços do posto passam pela validação da referência da ANP (ADR 0006), motoristas confirmados depois do posto substituem o preço dele (ADR 0003) e tudo fica no histórico. Ainda assim, a credibilidade do selo do posto depende de uma verificação séria.

Alternativas avaliadas:

| Forma | Força | Atrito para o posto | Custo |
|---|---|---|---|
| Assinatura com certificado digital e-CNPJ (ICP-Brasil) | Muito alta | Médio (o certificado às vezes fica com o contador) | Validação automática, sem custo por verificação |
| Código enviado por carta ao endereço do posto na ANP | Alta (prova acesso físico) | Médio (leva dias) | Postagem |
| Código para o e-mail ou telefone do cadastro do CNPJ | Média (contatos desatualizados ou do contador) | Baixo | Baixo |
| Documentos com revisão manual | Média | Médio | Tempo de revisão; não escala |
| Verificação de identidade paga (biometria + CPF no quadro de sócios) | Alta | Baixo | Por consulta |
| Visita presencial | Muito alta | Baixo | Não escala |

Todo posto emite nota fiscal eletrônica (NFC-e ou NF-e) e, para isso, tem um certificado digital ICP-Brasil da empresa. O certificado traz o CNPJ do titular, o que permite validar o vínculo sem revisão humana. O login com gov.br não foi considerado: a integração é voltada a órgãos públicos, e não há caminho claro para empresas privadas.

## Decisão

### Papéis

- **Responsável verificado:** quem comprovou o vínculo com o CNPJ do posto. Controla o posto no portal e convida gestores.
- **Gestor convidado:** pessoa convidada pelo responsável (gerente, funcionário). Gerencia preços e promoções, mas não convida outros nem se torna responsável.

Só o responsável passa pela verificação. Um posto pode ter mais de um responsável verificado.

### Verificação em camadas

| Fase | Forma |
|---|---|
| Piloto | Presencial, registrada pelo administrador (ADR 0007) |
| Expansão: caminho principal | Assinatura de um termo com o certificado e-CNPJ do posto, validada automaticamente (cadeia ICP-Brasil e CNPJ do certificado) |
| Expansão: alternativa | Código enviado por carta ao endereço do posto cadastrado na ANP |
| Exceções | Documentos com revisão manual pelo administrador |

Cada verificação registra a forma usada, a data e a evidência (por exemplo, o certificado usado na assinatura), para auditoria.

### Redes de postos

A verificação feita com o certificado da matriz vale para as filiais com a mesma raiz de CNPJ (8 primeiros dígitos).

### Proteções permanentes

- Registro de auditoria de toda ação no portal (preços, promoções, convites, remoções).
- Aviso ao responsável quando alguém ganha ou perde acesso ao posto.
- Canal "este não é o meu posto" para contestação, que suspende o acesso em disputa até a análise.
- A validação de preços do ADR 0006 continua valendo para os informes do posto.

## Consequências

- O modelo de dados separa responsável e gestor convidado desde já, e registra a forma de verificação de cada vínculo. No piloto, o administrador cria o vínculo de responsável com a forma "presencial".
- O registro de auditoria, previsto no ADR 0007 e ainda pendente, passa a ser requisito do portal.
- A verificação por e-CNPJ precisa de um componente de assinatura no portal. Certificados A1 (arquivo) podem ser usados no navegador; certificados A3 (token ou cartão) exigem um assinador instalado. O detalhe técnico será definido na implementação.
- A carta tem custo por envio e prazo de dias; entra quando houver demanda fora do alcance do e-CNPJ.
