# ADR 0002: Cidade-piloto Curitibanos (SC)

- **Status:** aceito
- **Data:** 2026-11-02

## Contexto

O produto depende de densidade local: uma cidade com postos bem cadastrados e preços atualizados vale mais, no início, do que um mapa nacional incompleto. A Fase 1 pede uma cidade-piloto para importar a base de postos, medir a situação inicial e definir as metas do MVP.

## Decisão

O piloto será no município de **Curitibanos, Santa Catarina** (código IBGE 4204806, cerca de 40 mil habitantes no Censo 2022).

## Consequências

- A importação inicial, as buscas e os testes com dados reais ficam limitados a Curitibanos. O modelo de dados continua nacional, com município e UF em cada posto.
- Cidade pequena: a quantidade de postos deve permitir cadastrar e conferir todos manualmente, e contatar os proprietários pessoalmente.
- Com poucos motoristas contribuindo, o volume de preços e avaliações será baixo. As regras do IQP (mínimo de avaliações, ajuste para poucas avaliações) precisam funcionar bem com poucos dados.

## Levantamento nos dados abertos da ANP (2026-11-02)

- **Postos:** o [cadastro de revendedores varejistas](https://www.gov.br/anp/pt-br/centrais-de-conteudo/dados-abertos/dados-cadastrais-dos-revendedores-varejistas-de-combustiveis-automotivos) (atualizado em 29/10/2026) lista **11 postos** em Curitibanos: 5 de bandeira branca e 6 de bandeiras diferentes (Vibra, Ipiranga, Raízen, Stang, Maxsul, Rodoil). Uma mesma empresa (mesma raiz de CNPJ) opera dois deles, então o posto se identifica pelo CNPJ completo do estabelecimento ou pela autorização da ANP, não pela empresa.
- **Coordenadas:** o CSV traz endereço e CEP, mas não latitude e longitude. A [API Revendedores da ANP](https://revendedoresapi.anp.gov.br/swagger/index.html) (`GET /v1/combustivel?municipio=CURITIBANOS&uf=SC`, pública, sem autenticação) retorna os mesmos 11 registros com coordenadas em SIRGAS 2000 (SRID 4674) para **7 deles**. Nenhuma está marcada como validada pela ANP: foram coletadas por agente de fiscalização (2022–2023) ou informadas pela própria empresa (2024–2026). Os outros 4 vêm sem coordenadas.
- **Combustíveis por posto:** a API também informa os produtos e a quantidade de bicos de cada posto. Isso serve de base para saber quais combustíveis cada um vende. Nenhum posto de Curitibanos vende GNV.
- **Um registro não é posto automotivo:** a filial da Comércio de Combustíveis Landin (CNPJ 02.728.176/0006-02) vende só gasolina e querosene de aviação. Na prática, são **10 postos para motoristas**.
- **Preços:** Curitibanos **não está** no levantamento semanal de preços da ANP. Não há nenhum registro no 1º semestre de 2026 nem em setembro de 2026. Em SC, a pesquisa cobre 16 municípios; os mais próximos são Caçador e Videira.

Consequência para as fontes de preço: no piloto, a ANP serve **só para o cadastro inicial dos postos**. Os preços exibidos virão dos próprios postos e dos motoristas desde o primeiro dia. Por isso, a adesão dos postos e o incentivo à colaboração dos motoristas são críticos para o piloto.

## Pendências

- Conferir em campo os 10 postos (existência, localização, combustíveis vendidos), obter as coordenadas dos 4 que não as têm e procurar postos que não constem do cadastro.
- **Metas do piloto** (cobertura, atualidade dos preços, engajamento): definir com base nesses 10 postos.
