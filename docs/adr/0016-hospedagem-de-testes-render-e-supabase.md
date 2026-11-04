# ADR 0016: Hospedagem de testes no Render e no Supabase

- **Status:** aceito
- **Data:** 2026-11-04
- **Complementa:** ADR 0013 (testar em viagem exige a API hospedada).

## Contexto

O app no celular depende do computador de desenvolvimento (cabo e `adb reverse`). Para testar em viagem e com outras pessoas, a API e o banco precisam estar na internet. O produto ainda não tem receita, e outros projetos do autor já usam hospedagem gratuita: Render (lotomanager) e Supabase (Nexa, veezy).

## Decisão

- **Ambiente de testes no plano gratuito**, com os mesmos provedores dos outros projetos. Planos pagos serão escolhidos na ida para produção.
- **Banco: Supabase**, projeto "tankei" na região de São Paulo. PostgreSQL com a extensão PostGIS. O banco de desenvolvimento tem 71 MB, dentro do limite de 500 MB.
  - A API conecta pelo **pooler em modo sessão** (IPv4; a conexão direta do Supabase é só IPv6, que o Render não alcança).
  - A connection string termina em `?sslmode=require&uselibpqcompat=true`: conexão criptografada sem exigir certificado de autoridade pública. Sem `uselibpqcompat`, o driver `pg` trata `require` como `verify-full` e recusa o certificado do Supabase.
- **API: Render**, serviço web Node definido em `render.yaml`, com deploy automático a cada push na `development`.
  - O build instala também as dependências de desenvolvimento (Nest CLI e drizzle-kit) e compila `@tankei/shared` e a API com o filtro do pnpm, sem o Turbo.
  - As migrations rodam na subida do serviço (`drizzle-kit migrate`, que só aplica as que faltam): o plano gratuito não tem etapa de pré-deploy.
  - `TRUST_PROXY=1`: o IP de cada pessoa vem do proxy do Render, para que o limite de requisições por IP funcione.
  - `JWT_SECRET` é gerado pelo Render; `DATABASE_URL` é preenchida no painel. Nenhum segredo fica no repositório.
- **Cargas iniciais** (municípios do IBGE, postos e referências da ANP) rodam do computador de desenvolvimento, com `DATABASE_URL` apontando para o Supabase.

## Consequências

- **O serviço gratuito do Render dorme após 15 minutos sem uso.** A primeira requisição depois disso leva cerca de 1 minuto.
- Enquanto dorme, as rotinas agendadas não rodam: o recálculo diário do IQP (que já acontece a cada avaliação) e a importação diária das referências da ANP (que pode ser feita manualmente).
- **O Supabase gratuito pausa o projeto após 7 dias sem uso.** Reativa-se pelo painel.
- O Render não tem região no Brasil: a API fica nos EUA (Virginia) e o banco em São Paulo, o que acrescenta latência a cada consulta. É aceitável para testes; em produção, API e banco devem ficar na mesma região.
- Para usar o app longe do computador, ele precisa de um APK com o código JavaScript embutido e a URL da API do Render.
