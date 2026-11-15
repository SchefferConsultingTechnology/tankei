# ADR 0042: Página básica do posto (site, primeira entrega)

- **Status:** aceito
- **Data:** 2026-11-15
- **Detalha:** spec 0004 (site do posto)
- **Complementa:**
  - ADR 0006 (parâmetros)
  - ADR 0028 (modo de exibição)
  - ADR 0036 (ambiente de teste)
  - ADR 0039 (recursos do plano)

## Contexto

A spec 0004 tem decisões que o autor ainda não pode tomar: os planos, a ocultação do IQP, o logo próprio e o domínio do Tankei. A página básica para todos os postos já foi aceita, em 2026-11-09. O autor decidiu começar por ela, com escolhas que dá para trocar depois.

## Decisão

### HTML gerado pela própria API

- A API responde `GET /p/<slug>` com o HTML pronto, gerado no servidor com React (`renderToStaticMarkup`), fora do prefixo `/v1`. Também responde `/sitemap.xml` e `/robots.txt`.
- **Por que não um `apps/site` separado, como a spec propunha:**
  - no plano gratuito do Render, cada serviço dorme;
  - com dois serviços, o primeiro acesso esperaria a API e o site acordarem, até cerca de 2 minutos.
- Se o site crescer, dá para separar depois sem mudar os endereços.
- A rota JSON `GET /v1/sites/:slug` da spec não foi criada. Os dados vêm direto dos mesmos serviços do app.
- O CSS é próprio e leve, com as cores da marca e tema claro e escuro. Não usa MUI.

### Mesmos dados e regras do app

- A página usa o `StationsService.findById` e a vitrine (`ShowcaseService`) do app, com os mesmos textos do `@tankei/shared`.
- **Modo de exibição (ADR 0028):**
  - posto oculto ou inativo: "Página indisponível" (404);
  - preços ocultos: sem preços, promoções nem convênios, com o aviso;
  - não participa e preço oficial: o mesmo aviso do app.
- **IQP:** o bloco é sempre exibido (sugestão da spec, decisão 3). Liberar a ocultação depois seria só uma opção a mais.
- **Rodapé fixo:** "Dados de preço e avaliação: Tankei", com a explicação da origem dos preços e do IQP.
- **Datas:** o servidor roda em UTC, então o fim das promoções é exibido no fuso da UF do posto.

### Blocos da página

A ordem é fixa nesta entrega:
1. cabeçalho (com "aberto agora" e o IQP);
2. promoções;
3. preços;
4. convênios;
5. horário e serviços (com a recarga elétrica);
6. fotos;
7. IQP;
8. como chegar;
9. "Veja este posto no Tankei".

Blocos sem conteúdo não aparecem.

### Endereço (slug)

- **Formato:** o slug sai do nome no app e da cidade, sem repetir a cidade que já está no nome (`centro-automotivo-curitibanos`). Nome repetido na cidade ganha um número (`-2`).
- **Tabela:** os slugs ficam em `station_site_slugs`, só de inserção. Um slug, uma vez usado, pertence ao posto para sempre.
- **Criação sob demanda:** o slug é criado no primeiro pedido do endereço (`GET /v1/stations/:id/site` ou o sitemap), sem criar slugs para os 45 mil postos de uma vez.
- **Nome novo no app:** o posto ganha um slug novo, e o antigo redireciona (301). Um slug escolhido pelo posto (`source` "posto" ou "equipe", na próxima entrega) tem preferência.

### Segurança

- A página não tem script nenhum. A política de conteúdo é `default-src 'none'`, liberando só imagens https e estilos inline.
- O React escapa todo texto do posto. O JSON-LD escapa `<`.

### Google e WhatsApp

- **SEO:** título, descrição, `canonical`, Open Graph (com a primeira foto como capa) e dados estruturados schema.org `GasStation` (endereço, coordenadas e horário).
- **Sitemap:** entram só os postos com o recurso `site` liberado no admin (`station_feature_changes`, ADR 0039). Os demais têm página, mas não são anunciados.
- **Indexação:**
  - sem `SITE_INDEXING=1`, toda página vai com `noindex`, e o `robots.txt` bloqueia tudo;
  - o ambiente de teste (ADR 0036) fica fora do Google;
  - a homologação e a produção ligam a variável.
- **Domínio:** a variável `SITE_URL` define o endereço base. Por enquanto é o da API no Render; trocar o domínio é só mudar a variável.

### Mapa

- O mapa é estático, sem JavaScript: uma grade de 5×3 blocos do OpenStreetMap com um marcador. Abaixo dele ficam os botões de rota no Google Maps e no Waze.
- A política de uso do OpenStreetMap permite pouco tráfego, com a atribuição exibida.
- Em produção, avaliar um provedor de blocos de mapa (MapTiler, Stadia ou o próprio Google) antes de liberar o site em escala.

### Parâmetro novo

| Chave | Valor inicial | Unidade |
|---|---|---|
| `site.cache_seconds` | 120 | seconds |

## Fora desta entrega

Fica para as próximas entregas da spec 0004:
- o editor no portal (blocos, sobre, contato, redes, aparência, versões e o slug escolhido pelo posto);
- o admin (lista de sites, tirar do ar com motivo);
- o QR Code;
- o botão de compartilhar no app;
- as visitas com `source = site`;
- os parâmetros `site.slug_change_days` e `site.max_extra_sections`.

As decisões 2, 4 e 5 da spec continuam em aberto.
