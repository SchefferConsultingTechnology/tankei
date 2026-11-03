# ADR 0007: Autenticação e permissões

- **Status:** aceito
- **Data:** 2026-11-02

## Contexto

Consultar preços não exige conta, mas informar preço exige (ADR 0003). O portal precisa de login para os postos e o backoffice, para a moderação. O piloto tem 10 postos e é mantido por uma pessoa: a solução precisa ser simples de operar e sem custo fixo.

Opções avaliadas:

- **Login próprio com Google e Apple:** a API confere o token do provedor e emite a própria sessão. Sem fornecedor intermediário e sem custo.
- **Firebase Auth:** pronto e com login por telefone, mas cria dependência de um fornecedor, e o SMS é pago.
- **E-mail e senha próprios:** exige recuperação de senha, envio de e-mail e aumenta a superfície de ataque.

## Decisão

### Login

- Login com **Google** e **Apple**. A Apple é obrigatória no iOS quando o app oferece login com Google.
- O app, o portal ou o admin obtém o token de identidade do provedor e envia à API. A API valida a assinatura, o emissor e o público do token e cria ou localiza o usuário pelo identificador do provedor.
- A API emite a própria sessão: um **token de acesso JWT de curta duração** e um **token de renovação** guardado no banco (com hash), que pode ser revogado e é trocado a cada uso.
- Login por telefone fica para depois do piloto.

### Perfis

| Perfil | Pode |
|---|---|
| Motorista | Informar preços e avaliar postos |
| Gestor de posto | Gerenciar os postos aos quais está vinculado: preços, promoções, dados do cadastro |
| Administrador | Moderar conteúdo, vincular gestores a postos, alterar parâmetros (ADR 0006) |

Toda conta começa como motorista. Um gestor de posto também é motorista.

### Vínculo do gestor com o posto

No piloto, o **administrador** vincula o gestor ao posto manualmente, depois do contato pessoal com o dono. O fluxo de reivindicação com comprovação de propriedade fica para a expansão.

## Consequências

- Não há senha para guardar, recuperar ou vazar.
- É preciso registrar o app no Google Cloud e no Apple Developer para obter os identificadores de cliente.
- A autorização verifica o perfil e, para gestores, o vínculo com o posto em cada operação.
- Ações administrativas e de gestores entram no registro de auditoria.
