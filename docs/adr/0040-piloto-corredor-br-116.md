# ADR 0040: Piloto ampliado no trajeto Curitibanos–Lages (BR-116)

- **Status:** aceito
- **Data:** 2026-11-09
- **Amplia:** ADR 0002 (cidade-piloto Curitibanos). **Ver também:** ADR 0036 (ambiente de teste)

## Contexto

O autor faz o trajeto Curitibanos → Lages e testa o app em uso real: modo direção, postos à frente (ADR 0032) e horário e serviços (ADR 0033). No caminho, pela BR-116, há três cidades pequenas cujos postos ele visita e pode contatar pessoalmente, como em Curitibanos.

## Decisão

O piloto passa a incluir, além de Curitibanos:

| Município | IBGE | Postos ativos (ANP) |
|---|---|---|
| São Cristóvão do Sul/SC | 4216057 | 3 |
| Ponte Alta/SC | 4213302 | 2 |
| Correia Pinto/SC | 4204558 | 5 |

- **Sem mudança de código.** A base da ANP já foi importada para o Brasil inteiro. Os 10 postos estão no banco de teste, ativos, com coordenadas e combustíveis cadastrados, e já aparecem no app, inclusive nos postos à frente no modo direção.
- **O piloto é operacional, não técnico.** Nessas cidades, a equipe faz o que o ADR 0002 prevê para Curitibanos:
  - conferir os postos em campo;
  - contatar os proprietários pessoalmente;
  - cadastrar horário e serviços pelo admin enquanto o posto não entra no portal (ADR 0033).
- **Homologação:** a nova importação da ANP (ADR 0036) traz essas cidades de novo, porque é nacional.

## Postos (ANP, 2026-11-09)

**São Cristóvão do Sul**
- Auto Posto Meu Postinho (RDP Energia), BR-116, 1970.
- Cesca & Cia (Ipiranga), BR-116, s/n.
- Posto Maçã (Raízen Mime), R. Florisbal Bragança de Moraes, 33.

**Ponte Alta**
- Cesca & Cia (Ipiranga), BR-116, s/n.
- Cesca & Cia (Raízen), BR-116, km 206.

**Correia Pinto**
- Auto Posto Martins (bandeira branca), R. Duque de Caxias, 56.
- Poli Ipiranga (Stang), Av. Juscelino Kubitschek, 110.
- Posto Leo Ampessan (Ipiranga), Av. Duque de Caxias, 3665.
- Sim Rede de Postos (bandeira branca), Av. Juscelino Kubitschek, 8382.
- Xavier & Deggerone (Ale), R. Juscelino Kubitschek, 1720.

## Conferência em campo (pendências)

- **Cesca & Cia opera 3 postos no trajeto** (São Cristóvão do Sul e Ponte Alta). É uma rede só no portal (ADR 0021) e o melhor primeiro contato: uma adesão cobre três postos.
- **Nome no app (ADR 0035):** a maioria aparece pela razão social. Anotar o nome conhecido na estrada (placa, fachada) para o posto ou a equipe cadastrar.
- **Combustíveis a conferir:**
  - o Auto Posto Martins consta com GNV, raro em cidade pequena;
  - a Sim Rede de Postos consta sem gasolina comum.
- **Horário e serviços:** postos de rodovia costumam abrir 24 h e ter borracharia, que é útil no trajeto. Cadastrar pelo admin.
- **Postos fora do cadastro:** procurar postos que não constem da ANP.
