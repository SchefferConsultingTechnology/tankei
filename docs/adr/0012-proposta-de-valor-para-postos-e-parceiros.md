# ADR 0012: Proposta de valor para postos e parceiros

- **Status:** aceito
- **Data:** 2026-11-04

## Contexto

Em Curitibanos, os preços dependem dos próprios postos e dos motoristas (ADR 0002 e 0003). Os postos só manterão o perfil atualizado se o portal resolver problemas reais do dia a dia deles, além das promoções. Vários postos também têm convênios com seguradoras, gestoras de frota, programas de fidelidade e empresas locais, uma informação que o motorista não encontra reunida em lugar nenhum e que muda a escolha do posto. Atrair essas empresas exige mostrar uso real, o que só acontece depois de haver motoristas no app.

## Decisão

### O que o portal oferece aos postos

1. **Concorrência local:** preços dos postos próximos por combustível, com a idade de cada informação; posição no ranking da cidade; comparação com a média semanal da ANP do estado; histórico; alerta quando um concorrente próximo muda o preço.
2. **Demanda gerada pelo app:** quantos motoristas viram o posto, abriram a ficha e tocaram em "Traçar rota", por dia e por combustível, e o efeito de promoções e mudanças de preço nesses números.
3. **Reputação:** IQP por dimensão comparado à média da cidade, com evolução no tempo; QR code e selo ("Posto verificado", ADR 0011) para fachada e bombas, levando à ficha e à avaliação.
4. **Vitrine:** ficha completa (fotos, horário, serviços, formas de pagamento, convênios).
5. **Pouco esforço:** atualizar preço em segundos pelo celular, lembrete de preço desatualizado, várias unidades em uma conta e, mais adiante, integração com o sistema de automação do posto.

### Limite concorrencial

O portal mostra aos postos apenas informações que o app já mostra publicamente aos motoristas. Não sugere preços nem oferece recursos que facilitem a coordenação de preços entre postos.

### Convênios

- **Catálogo de parceiros** mantido pelo administrador. O posto marca no portal os convênios que aceita, com o benefício e as condições em texto.
- No app, os convênios aparecem na ficha do posto e há um filtro "Aceita meu convênio".
- **"Meus convênios" fica só no celular** do motorista: o filtro roda no aparelho, e a API não guarda qual é a seguradora ou o cartão de ninguém (ADR 0009).
- **Confiabilidade:** "Informado pelo posto", "Confirmado pelo parceiro" e relatos de motoristas ("não aceitaram meu convênio").
- O **preço com desconto do convênio** só entra quando o parceiro fornecer as regras de forma estruturada.

### Atração de parceiros

De baixo para cima: os postos cadastram os convênios que já têm; com dados de uso agregados (postos por parceiro, motoristas que filtraram, rotas para postos conveniados), cada parceiro é abordado com números. Alvos: seguradoras e associações, gestoras de frota, programas de fidelidade e meios de pagamento e, no piloto, parceiros locais (cooperativas, associação comercial, taxistas, motoristas de aplicativo).

### Regra de neutralidade

Nada que seja pago (planos, destaque patrocinado, parceria) altera o IQP nem a ordem por menor preço. Destaques e conteúdos de parceiros são sempre identificados como tal. Convênios aparecem como informação e filtro, não como posição na lista.

### Fases

| Fase | Postos | Parceiros |
|---|---|---|
| **Piloto** (gratuito, postos como "parceiros fundadores") | Preços e promoções; concorrência local; IQP por dimensão comparado à cidade; QR code; contagem de visualizações e rotas | Catálogo; convênios declarados pelo posto; ficha, filtro e "Meus convênios" no app |
| **Depois do piloto** | Fotos, alertas de concorrência, histórico longo; planos grátis e pago | Abordagem com dados; parceiro confirmado; painel do parceiro |
| **Escala** | Integração com a automação do posto; destaque patrocinado identificado; cupons | Regras estruturadas de desconto; cupons com comissão; integração com pagamento; área de frotas |

## Consequências

- O app passa a registrar eventos anônimos e agregados por posto (visualização, abertura da ficha, "Traçar rota"), sem dado pessoal. O registro começa antes do portal, para haver números quando os postos entrarem.
- O modelo de dados ganha parceiros, convênios por posto (com origem e confirmação) e relatos de motoristas.
- A ficha do posto ganha campos de vitrine (horário, serviços, formas de pagamento), editáveis no portal.
- A receita vem de planos para postos, perfil e painel de parceiros, cupons e área de frotas; nunca de posição na lista ou nota.
