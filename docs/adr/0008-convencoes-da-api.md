# ADR 0008: Convenções da API

- **Status:** aceito
- **Data:** 2026-11-02

## Contexto

Com os endpoints de escrita (informes de preço, avaliações), a API passa a receber dados no corpo das requisições. As mesmas regras de validação são úteis nos formulários do app, do portal e do admin. A API também precisa de documentação navegável e de proteção básica contra abuso.

## Decisão

- **Validação com Zod.** Os schemas ficam em `@tankei/shared`, para que API e clientes validem com as mesmas regras. Na API, um pipe valida o corpo e os parâmetros com o schema. Os pipes nativos do NestJS continuam aceitáveis para parâmetros simples.
- **Documentação OpenAPI (Swagger)** em `/v1/docs`, gerada a partir dos schemas do Zod.
- **Erros** no formato padrão do NestJS (`statusCode`, `message`, `error`), com mensagens em português do Brasil.
- **Limite de requisições por IP** com `@nestjs/throttler`, além dos limites por conta do ADR 0006.
- **Nomes** de rotas, parâmetros e campos em inglês. Textos exibidos ao usuário, inclusive mensagens de erro, em português.

## Consequências

- Os clientes podem validar formulários antes de enviar, com as mesmas mensagens da API.
- O `@tankei/shared` passa a depender do Zod.
- A documentação acompanha o código, sem manutenção à parte.
