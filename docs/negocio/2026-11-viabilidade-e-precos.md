# Estudo de viabilidade e preços

- **Data:** 2026-11-04
- **Situação:** estudo inicial. Preços e custos são **hipóteses** a validar no piloto; viram decisão (ADR) depois da validação.
- **Relacionado:** ADR 0002 (cidade-piloto), ADR 0011 (verificação do responsável), ADR 0012 (proposta de valor para postos e parceiros).

## Tamanho do mercado

Fonte: cadastro de revendedores varejistas da ANP, atualizado em 29/10/2026.

| Recorte | Postos |
|---|---|
| Brasil | 45.795 |
| Santa Catarina | 2.097 |
| Região de Curitibanos (Lages, Videira, Caçador, Campos Novos, Fraiburgo e vizinhos) | 139 |
| Curitibanos | 10 automotivos (11 no cadastro, um só de aviação) |

Postos por UF: SP 8.382, MG 5.045, BA 3.721, RS 3.181, PR 2.956, SC 2.097, GO 2.068, CE 2.026, RJ 1.987, MA 1.795, PA 1.752, PE 1.633, demais abaixo de 1.300.

Bandeira no Brasil: bandeira branca 21.999 (48%), Vibra 6.930, Ipiranga 5.631, Raízen 4.784, Ale 1.080, Rodoil 588.

Os postos de bandeira branca são donos independentes, sem o marketing de uma distribuidora: provável público mais interessado no portal.

## Fontes de receita (hipóteses)

| Fonte | Quem paga | Hipótese de preço | Quando |
|---|---|---|---|
| Plano do posto | Posto | Grátis (perfil, preços, promoções) e Pro a **R$ 149/mês** (concorrência, demanda, alertas, histórico); desconto para redes | Depois do piloto |
| Destaque patrocinado | Posto | R$ 50 a 150/mês, sempre identificado, sem alterar a ordem por preço (ADR 0012) | Quando houver motoristas |
| Parceiros | Seguradoras, fidelidade, associações | R$ 500 a 3.000/mês por perfil oficial e painel, ou comissão por cupom | Com dados de uso |
| Frotas | Empresas e cooperativas | ~R$ 10 por veículo por mês (200 veículos = R$ 2.000/mês) | Escala |

O motorista não paga.

## Custos mensais (estimativa)

| Item | Valor/mês |
|---|---|
| Infraestrutura gerenciada (API, banco com PostGIS, arquivos) | R$ 300 a 800 |
| Contas e serviços (Apple Developer, Expo, e-mail, domínio, monitoramento) | ~R$ 200 |
| Contabilidade | ~R$ 400 |
| **Subtotal operacional** | **~R$ 1.200** |
| Impostos (Simples Nacional) e taxa de cobrança | ~10% da receita (alíquota a confirmar com contador) |

O custo técnico é baixo por causa da arquitetura (mapa sem custo no SDK móvel, infraestrutura gerenciada, sem microsserviços). O custo principal é de pessoas: o tempo do fundador e, depois, comercial e implantação.

## Ponto de equilíbrio com o plano Pro

Receita líquida por posto: ~R$ 134 (R$ 149 menos ~10%).

| Cenário | Custo mensal | Postos pagantes necessários |
|---|---|---|
| Só custos operacionais | R$ 1.200 | ~9 |
| Mais pró-labore de R$ 10 mil | R$ 11.200 | ~84 |
| Mais uma pessoa de comercial e implantação (R$ 6 mil com encargos) | R$ 17.200 | ~128 (6% dos postos de SC) |

## Conclusões

1. **Curitibanos sozinha não se paga**: com os 10 postos pagando, são R$ 1.490/mês. O piloto prova o modelo; a viabilidade depende de repetir a operação cidade a cidade com custo de aquisição baixo (implantação remota, QR code nas bombas, indicação entre donos de posto).
2. **O posto só paga se vir clientes vindos do app.** Os números de demanda (visualizações, fichas abertas, rotas) são o argumento de venda; registrar esses eventos é prioridade.
3. **O plano do posto sozinho gera receita modesta.** Parceiros e frotas têm valor por cliente bem maior e devem ser trabalhados desde cedo, ainda que entrem depois.
4. **A disposição a pagar precisa ser medida.** No piloto: perguntar aos donos quanto pagariam pelo painel de concorrência e pelos números de demanda; oferecer condição de "parceiro fundador" (desconto permanente) para os primeiros.

## Validação no piloto

- Entrevista com os 10 donos sobre disposição a pagar e funcionalidades mais valiosas.
- Uso real do app em Curitibanos: motoristas ativos por mês, fichas abertas e rotas por posto.
- Atualização de preços pelos postos: quantos atualizam e com que frequência.
- Interesse de parceiros locais (cooperativas, associação comercial, taxistas, motoristas de aplicativo) em convênios e área de frotas.

## Questões em aberto

Para refinar o modelo (e montar um simulador de 24 meses), faltam:

1. Objetivo do negócio: renda complementar, renda principal ou construir para vender ou captar.
2. Pró-labore necessário para dedicação maior.
3. Prazo em que o projeto precisa se pagar.
4. Horas por semana e investimento disponível até o ponto de equilíbrio.
