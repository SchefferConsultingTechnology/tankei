# ADR 0009: Dados pessoais (LGPD)

- **Status:** aceito
- **Data:** 2026-11-02

## Contexto

A plataforma recebe contribuições de motoristas e precisa identificar quem contribui (ADR 0003, ADR 0007). Ao mesmo tempo, preços e avaliações formam um histórico auditável que não pode ser apagado (regra do projeto). A LGPD exige coletar só o necessário e permitir a exclusão dos dados pessoais.

## Decisão

- **Dados guardados:** nome, e-mail, o identificador do provedor de login (Google ou Apple) e o endereço da foto da conta no provedor, para exibir o avatar (incluído em 04/11/2026). A imagem não é copiada: o app a carrega do provedor, e o endereço é atualizado a cada login. Nada além disso no piloto.
- **Localização:** a localização usada nas buscas **não é guardada**. Ela só existe durante a requisição.
- **Exclusão da conta:** os dados pessoais são apagados. Os informes de preço e as avaliações continuam no histórico, desvinculados da pessoa (anonimizados), para preservar o histórico auditável e o cálculo do IQP.
- **Logs** não registram e-mail, tokens nem coordenadas da busca.

## Consequências

- O vínculo entre contribuição e autor precisa permitir a anonimização: a contribuição aponta para a conta, e a exclusão remove os dados pessoais da conta, mantendo um registro anônimo.
- A política de privacidade em texto deve ser publicada antes do lançamento do piloto.
