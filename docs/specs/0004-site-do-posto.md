# Spec 0004: Site do posto na plataforma

- **Status:** proposta (aguarda as decisões do fim do documento e o plano financeiro, etapa 3)
- **Data:** 2026-11-08
- **Relacionados:**
  - ADR 0003 (preço exibido), ADR 0004 (IQP), ADR 0021 (papéis no posto);
  - ADR 0026 (vitrine: promoções e fotos), ADR 0028 (modo de exibição);
  - ADR 0033 (horário e serviços), ADR 0034 (convênios), ADR 0035 (nome do posto);
  - spec 0003 (interações);
  - pauta jurídica (`docs/negocio/2026-11-pauta-revisao-juridica.md`).

## Problema

Muitos postos não têm site, ou têm um site parado, sem preço nem horário atualizados. O Tankei já tem tudo o que um site de posto precisa e mantém esses dados atualizados:
- nome;
- endereço e mapa;
- horário e serviços;
- preços com data;
- convênios;
- promoções e fotos;
- IQP.

## Objetivo

Cada posto, conforme o contrato, ganha um **site próprio e personalizável**, hospedado pela plataforma. O site é montado com os dados que o posto já mantém no portal, e a personalização é feita no próprio portal, sem conhecimento técnico.

## Fora do escopo

- Loja virtual, pagamento ou pedido pelo site.
- Editor livre de HTML ou CSS. A personalização é por blocos e opções, para o site nunca quebrar.
- Logo das distribuidoras (bandeiras): segue bloqueado pela revisão jurídica.

## Endereços (por fase)

| Fase | Endereço | Observação |
|---|---|---|
| A | `https://<domínio Tankei>/p/<slug>` | o slug vem do nome no app e da cidade, por exemplo `posto-zulu-curitibanos` |
| B | `https://<slug>.<domínio Tankei>` | subdomínio por posto |
| C | domínio do próprio posto (`www.postozulu.com.br`) | o posto aponta o DNS (CNAME); certificado automático |

Regras do slug:
- único;
- o posto pode trocar uma vez a cada `site.slug_change_days`;
- o slug antigo continua redirecionando (tabela `station_site_slugs`).

O domínio do Tankei ainda não foi escolhido (pendência do site oficial).

## Conteúdo do site

### Blocos com dados da plataforma

O posto escolhe a ordem e quais blocos aparecem, mas **não edita o conteúdo** desses blocos.

| Bloco | Fonte | Regra |
|---|---|---|
| Cabeçalho | nome no app (ADR 0035), endereço, status "aberto agora" | |
| Preços | preços atuais com origem e data (ADR 0003) | iguais aos do app, com o mesmo selo de origem; respeitam o modo de exibição (ADR 0028) |
| Promoções | promoções vigentes com arte (ADR 0026) | |
| Horário e serviços | ADR 0033 | |
| Convênios | descontos vigentes (ADR 0034) | |
| Fotos | galeria (ADR 0026) | |
| IQP | nota com a escala de 0 a 100 (spec 0001) | nunca alterada; ver decisão 3 |
| Como chegar | mapa estático e botão de rota (Google Maps / Waze) | |
| No app | "Veja este posto no Tankei", com link para a ficha no app | |

### Blocos do posto

| Bloco | Conteúdo |
|---|---|
| Sobre | texto de até 1 000 caracteres, com formatação simples (negrito, listas, links); sem HTML |
| Contato | telefone, WhatsApp e e-mail |
| Redes sociais | Instagram, Facebook, TikTok, YouTube (só links) |
| Seções extras | até `site.max_extra_sections` (por exemplo: conveniência, lavação, troca de óleo), com título, texto e até 4 fotos |
| Aparência | cor principal (escolhida numa paleta com contraste garantido, claro e escuro), imagem de capa, logo próprio do posto (ver decisão 4) |

Rodapé fixo: "Dados de preço e avaliação: Tankei", com link para a explicação do IQP e da origem dos preços. O posto não pode remover o rodapé.

### Regras que não mudam no site

As regras de domínio do projeto valem igual no site:
- o IQP é calculado só no backend e nunca é editado;
- preço pago não altera a nota;
- o histórico não é sobrescrito.

O site é uma vitrine do que já existe na plataforma, não uma segunda fonte de dados.

## Portal: tela "Site do posto" (menu Posto › Site)

- **Editor:** à esquerda, a lista de blocos para arrastar, ligar ou desligar, e as opções de cada um. À direita, a pré-visualização ao vivo, com seletor de celular ou computador.
- **Rascunho e publicação:**
  - as mudanças ficam em rascunho até "Publicar";
  - cada publicação grava uma versão nova (`station_site_versions`, só inserção, como `station_info_versions`);
  - é possível voltar a uma versão anterior, o que cria uma versão nova com o conteúdo antigo.
- **Imagens:** mesmo envio e preparação das fotos do posto (ADR 0026):
  - WebP, sem metadados;
  - limites de tamanho em parâmetros.
- **Compartilhar:** link, QR Code em PNG para imprimir (bomba, caixa, adesivo) e prévia de como o link aparece no WhatsApp.
- **Permissão:** nova ação `manage_site`, para o proprietário e o gestor (ADR 0021), verificada por `AccessService`.

## Admin

- Lista de sites publicados, com posto, plano, endereço e última publicação.
- **Tirar do ar com motivo**, como na remoção de imagens (ADR 0026):
  - o registro fica em `station_site_moderations`;
  - o posto vê o motivo no portal.
- Liga ou desliga o direito ao site por posto até o Mercado Pago existir (tabela `station_entitlements`, com `feature`, início, fim e quem concedeu). Depois, a assinatura passa a conceder o direito automaticamente.

## Técnica

- **Página renderizada no servidor:**
  - o site precisa aparecer no Google ("posto zulu curitibanos preço gasolina") e gerar a prévia certa no WhatsApp;
  - proposta: um app novo, `apps/site`, que gera o HTML no servidor com React e o tema MUI em modo leve, num serviço próprio no Render;
  - os dados vêm de uma rota pública da API: `GET /v1/sites/:slug`, com bloco e conteúdo publicados.
- **Cache:**
  - de 1 a 5 minutos (`site.cache_seconds`), porque preços mudam;
  - a publicação no portal limpa o cache do posto.
- **SEO:**
  - título e descrição por posto;
  - Open Graph com a capa;
  - dados estruturados schema.org `GasStation` (endereço, horário, geo);
  - `sitemap.xml` com os sites publicados;
  - o site sem contrato fica fora do sitemap.
- **Desempenho:** página leve, sem o mapa interativo; mapa estático com link para a rota. Meta: carregar em menos de 2 s no 4G.
- **Visitas:** cada acesso conta na spec 0003 com `source = site`, sem cookies de rastreamento. Ações (rota, WhatsApp, ligação) contam igual.
- **Domínio próprio (fase C):** exige um provedor que emita certificado por domínio de cliente, por exemplo o Cloudflare for SaaS. Avaliar o custo quando chegar a hora.

## Parâmetros novos (ADR 0006)

| Chave | Valor inicial | Unidade |
|---|---|---|
| `site.max_extra_sections` | 4 | count |
| `site.slug_change_days` | 90 | days |
| `site.cache_seconds` | 120 | seconds |

## Critérios de aceite (fase A)

1. Posto com direito ao site publica pelo portal, e o site abre em `/p/<slug>` com os blocos na ordem escolhida.
2. Preço novo informado no portal aparece no site em até `site.cache_seconds`.
3. Os preços do site são idênticos aos do app, com o mesmo selo de origem. O modo "preços ocultos" também os esconde no site.
4. O posto não consegue editar preço, IQP nem o rodapé pelo editor; a API rejeita o conteúdo.
5. Texto com HTML ou script é exibido como texto, nunca executado.
6. Voltar a uma versão anterior cria uma versão nova; nada é sobrescrito.
7. Tirado do ar pelo admin, o site mostra "página indisponível" e o portal mostra o motivo.
8. O fim do contrato tira a personalização conforme a decisão 1, sem perder as versões.
9. O link compartilhado no WhatsApp mostra o nome, a capa e o endereço do posto.
10. O site aparece no `sitemap.xml` e passa no teste de dados estruturados do Google.

## Decisões pendentes

1. **Página básica para todos? (aceita em 2026-11-09)** Proposta: todo posto ganha uma página pública simples (sem personalização), útil para o link de compartilhar do app e para o Google. O contrato libera a personalização, o QR Code e, depois, o subdomínio e o domínio próprio. A outra opção é só quem assina ter página.
2. **Planos:** o site entra em qual plano, e o domínio próprio é um adicional? Depende da etapa 3 do plano financeiro.
3. **IQP no site:** o posto pode **ocultar** o bloco do IQP no próprio site (sem nunca alterar a nota)? Ocultar é comum em sites de empresa, mas esconder uma nota baixa enfraquece a confiança na plataforma. Sugestão: o bloco é obrigatório, como o de preços.
4. **Logo próprio do posto (2026-11-09):** nada a implementar agora. Quando o jurídico definir o texto (pauta, item 3), entra como um checkbox de aceite no envio do logo ("declaro ter o direito de uso desta imagem").
5. **Domínio do Tankei** para os endereços das fases A e B (mesma pendência do site oficial).
