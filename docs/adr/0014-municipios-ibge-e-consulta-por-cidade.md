# ADR 0014: Municípios do IBGE e consulta de preços por cidade

- **Status:** aceito
- **Data:** 2026-11-04
- **Complementa:** ADR 0013 (base nacional de postos).

## Contexto

Pelo app, a pessoa só via os postos perto de onde está. O caso de uso novo é consultar outra cidade antes de sair (por exemplo, os preços de Lages vistos de Curitibanos), escolhendo estado e cidade.

O cadastro da ANP traz o município só como texto em maiúsculas e sem acento ("SAO JOSE DOS PINHAIS"), sem o código do IBGE. Usar esse texto como lista de cidades daria nomes feios e grafias divergentes do oficial.

## Decisão

- **Importar a lista oficial de municípios do IBGE** (API de localidades, 5.571 municípios) para a tabela `municipalities`: código de 7 dígitos, nome oficial, UF e nome normalizado. Comando: `import:ibge`, rodado antes do `import:anp` numa base nova.
- **Vincular cada posto ao município** (`stations.municipality_code`) comparando UF e nome normalizado (sem acentos, pontuação e espaços repetidos, em maiúsculas). As 16 grafias da ANP que diferem do IBGE (por exemplo, "SANTANA DO LIVRAMENTO" → Sant'Ana do Livramento, "BOA SAUDE" → Januário Cicco) ficam numa tabela de apelidos no código (`ANP_MUNICIPALITY_ALIASES`). Em 04/11/2026, 100% dos 45.496 postos foram vinculados.
- O vínculo é refeito a cada importação da ANP; um posto que deixa de casar mantém o código anterior.
- **Duas rotas novas na API:**
  - `GET /v1/stations/cities?state=SC`: cidades da UF que têm postos, em ordem alfabética, com a quantidade de postos.
  - `GET /v1/stations?municipality=4209300&fuel=gasolina_comum`: postos da cidade, ordenados pelo menor preço do combustível, limitados a 100 (`CITY_STATIONS_LIMIT`), com o total e o centro da cidade (média das coordenadas dos postos).
- **No app**, a tela inicial mostra o lugar consultado ("Perto de você" ou "Cidade: Lages/SC"). Tocar nele abre a escolha em dois passos: estado e cidade, com busca sem acentos. A escolha vale para a sessão e não é gravada.
- O nome exibido do município passa a ser o oficial do IBGE; sem vínculo, o texto da ANP é formatado.

## Consequências

- Uma cidade nova no cadastro do IBGE ou uma grafia nova na ANP aparece como posto sem município. A importação informa a contagem para revisão, e o apelido é acrescentado na tabela.
- O limite de 100 postos por cidade só afeta capitais grandes (São Paulo tem 1.521 postos). O app avisa quando mostra apenas os mais baratos.
- No mapa da cidade, postos sem preço do combustível escolhido aparecem como um ponto discreto, e os preços próximos são empilhados para não se sobrepor.
- O código do IBGE prepara recursos por município: cidades ativas, dia sem impostos local (ADR 0006) e estatísticas por cidade.
