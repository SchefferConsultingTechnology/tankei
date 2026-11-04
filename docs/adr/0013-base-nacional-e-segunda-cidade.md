# ADR 0013: Base nacional de postos e segunda cidade (Lages)

- **Status:** aceito
- **Data:** 2026-11-04
- **Complementa:** ADR 0002 (cidade-piloto). **Substitui**, no ADR 0006, a UF fixa da referência de preço.

## Contexto

O piloto é Curitibanos (ADR 0002), mas o cadastro de postos da ANP é público e nacional. Ter todos os postos no banco permite testar o app em viagem, pela localização, e prepara a expansão. A próxima cidade é Lages (SC), a 70 km de Curitibanos, com 44 postos e frequentada pelo fundador.

A API Revendedores da ANP devolve o Brasil inteiro em 10 páginas de 5.000 postos. Em 04/11/2026: 45.816 registros, 85% com coordenada; Lages com os 44 postos georreferenciados. A API limita a frequência de chamadas (responde 429 a páginas pedidas em sequência).

## Decisão

- **Importar todos os postos do Brasil** da API Revendedores (`import:anp BR`). Também é possível importar uma UF (`import:anp SC`) ou um município (`import:anp SC LAGES`).
- **Lages é a segunda cidade.** Curitibanos continua sendo o piloto; o trabalho de campo e a adesão dos postos começam por ela e seguem para Lages.
- O app funciona para consulta em qualquer lugar do país. A operação (postos parceiros, conferência em campo, convênios) fica restrita às cidades ativas.
- **A referência de preço é a média semanal da UF do próprio posto**, não mais uma UF fixa. O parâmetro `price.reference_state` deixa de existir; as referências dos 27 estados já eram importadas (ADR 0006).

## Consequências

- O banco de desenvolvimento passa a ter cerca de 45 mil postos. A busca por proximidade continua rápida (11 a 54 ms medidos em Lages, São Paulo e Belém) por causa do índice geográfico.
- A importação grava em lotes e trata o limite de chamadas da ANP com pausa entre páginas e novas tentativas com espera crescente.
- **A autorização da ANP não identifica o posto:** a base nacional tem 62 autorizações repetidas entre CNPJs diferentes. O CNPJ continua sendo o identificador (nenhum CNPJ repetido em 45.795 registros do cadastro); a autorização perde a restrição de unicidade.
- Cerca de 15% dos postos não têm coordenada na ANP e não aparecem no mapa até serem geocodificados ou conferidos.
- **Testar em viagem exige a API hospedada.** Hoje o app no celular depende do computador de desenvolvimento (cabo ou mesma rede). A decisão de infraestrutura passa a ser pré-requisito para esse uso.
