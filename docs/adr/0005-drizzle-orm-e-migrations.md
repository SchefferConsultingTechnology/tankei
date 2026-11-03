# ADR 0005: Drizzle ORM e migrations

- **Status:** aceito
- **Data:** 2026-11-02

## Contexto

A API precisa de acesso tipado ao PostgreSQL e de migrations versionadas. A consulta central do app é geográfica ("postos perto de mim"), então o suporte ao PostGIS pesa mais que a popularidade da ferramenta. O histórico de preços só de inserção (ADR 0003) também pede consultas que vão além do CRUD, como "último informe válido por combustível".

Opções avaliadas:

- **Prisma:** conhecido pela equipe, mas trata geometria como tipo não suportado. Toda consulta espacial vira SQL manual, sem tipagem.
- **TypeORM:** conhecido pela equipe e com integração oficial com o NestJS. Suporta geometria, mas tem tipagem mais solta e manutenção mais lenta.
- **Kysely:** construtor de consultas tipado, sem schema nem migrations geradas.
- **Drizzle:** schema em TypeScript, consultas próximas do SQL, tipos de geometria do PostGIS e migrations geradas em SQL.

## Decisão

- Usar **Drizzle ORM** (`drizzle-orm` com o driver `pg`) na API.
- O schema fica em `apps/api/src/database/schema/`, um arquivo por domínio.
- As migrations são geradas pelo **drizzle-kit** como arquivos SQL em `apps/api/drizzle/` e versionadas no repositório. Elas são revisadas antes do commit, como qualquer código.
- Regras que o ORM não expressa (extensão PostGIS, bloqueio de UPDATE e DELETE em tabelas só de inserção) entram como migrations SQL escritas à mão.
- Coordenadas em `geometry(Point, 4326)` (WGS 84). As coordenadas da ANP (SIRGAS 2000, SRID 4674) são gravadas diretamente: para o mapa do app, a diferença entre os dois é desprezível.

## Consequências

- A equipe precisa aprender o Drizzle. A API é pequena e próxima do SQL, o que reduz a curva.
- Não há integração oficial com o NestJS: a conexão é um provider próprio em `DatabaseModule`.
- Como as migrations são SQL puro, dá para revisar e ajustar exatamente o que roda no banco.
