# ADR 0043: Site oficial do Tankei

- **Status:** aceito
- **Data:** 2026-11-16
- **Complementa:**
  - ADR 0030 (como funciona)
  - ADR 0031 (caminho do dono do posto)
  - ADR 0036 (ambiente de teste)
  - ADR 0042 (página do posto)

## Contexto

O Tankei não tinha um site. Os textos de "Como funciona" (ADR 0030) já estavam no `@tankei/shared` pensando nele. Ainda faltam decisões que o autor não pode tomar agora:
- o domínio;
- os planos e os preços para postos;
- o parecer jurídico sobre privacidade e termos.

O autor decidiu fazer o site com o que já está decidido.

## Decisão

### Conteúdo

- **Público:** motoristas e postos.
- **Páginas:**
  - **Início:** o que o app faz, os selos de preço e as regras que não mudam;
  - **Como funciona:** os mesmos textos do app (`HOW_IT_WORKS` e `BADGE_DESCRIPTIONS`);
  - **Para postos:** o que o portal oferece, como assumir o posto e as regras iguais para todos. Não fala de preço nem de plano (ADR 0031). O botão leva a `/acesso?origem=site` no portal;
  - **Privacidade** e **Termos de uso:** minutas, com o aviso "Minuta em revisão jurídica" no topo. Os pontos em aberto ficam entre colchetes (razão social, encarregado, bases legais, prazos e foro). As minutas descrevem só o que o sistema faz hoje (ADR 0009, 0024, 0026, 0029 e 0039).
- **Recarga elétrica (2026-11-16):** o início tem uma seção própria para quem tem carro elétrico, com o que o app faz hoje (ADR 0041): preço por kWh, AC e DC, conector e "Meu carro", e a sugestão de ponto pelo motorista. A seção avisa o que ainda não existe: o status livre ou ocupado do ponto. A página "Para postos" ganhou o cartão "Pontos de recarga".
- **Ilustrações (2026-11-16):**
  - desenhos originais em SVG (`src/illustrations.tsx`): o app com o mapa de preços, o carregador com o carro elétrico, os preços com a origem, o medidor do IQP, o posto e o portal;
  - não usam fotos, marcas de terceiros nem imagens geradas por IA;
  - nomes, preços e notas são fictícios;
  - as cores seguem o tema (variáveis `--ill-*` e `--badge-*`).
  Imagens geradas por IA, se o autor quiser, entram no mesmo lugar.
- **Foto da seção "Cada preço mostra de onde veio" (2026-11-16):**
  - imagem gerada pelo autor no ChatGPT (geração de imagens), em 16/11/2026, com o prompt 3 do roteiro de imagens (mão segurando o celular ao lado da bomba);
  - a tela genérica foi trocada por um print real do app (mapa de Curitibanos, gasolina comum), feito no emulador com a API de teste e encaixado com correção de perspectiva; o encaixe foi refeito com a área da tela detectada na foto (bordas ajustadas por reta, cantos arredondados e o desfoque da foto);
  - a lista não foi usada porque mostra nomes e bandeiras de postos reais com preços fictícios do ambiente de teste;
  - a foto substitui a ilustração dos cartões de preço; o topo do início continua com o celular desenhado;
  - a matriz fica em `apps/site/art/preco-origem.jpg`, e as versões publicadas ficam em `public/img/`: WebP de 560 e 900 px e o JPEG de 1200×630, usado também como prévia de links (`og:image`).
- **Foto da seção "Recarga para carros elétricos" (2026-11-16):**
  - imagem gerada pelo autor no ChatGPT (geração de imagens), em 16/11/2026, com o prompt 2 do roteiro de imagens;
  - carregador genérico com a tela apagada, carro sem emblema e araucárias ao fundo;
  - recorte 4:3 em WebP de 640 e 1000 px, no lugar da ilustração do carregador; a matriz fica em `apps/site/art/recarga-eletrica.jpg`.
- **Foto do topo de "Para postos" (2026-11-16):**
  - imagem gerada pelo autor no ChatGPT (geração de imagens), em 16/11/2026, com o prompt 6 do roteiro de imagens (gestor no balcão da loja de conveniência);
  - as telas genéricas foram trocadas por prints reais: no notebook, a tela Visitas do portal (90 dias); no celular, o mapa do app;
  - o print do portal saiu do banco de demonstração, com o posto e a rede renomeados para "Posto Exemplo" e "Rede Exemplo", para não mostrar um posto real com números fictícios;
  - a mão na frente do notebook foi preservada da foto original;
  - recorte 4:3 em WebP de 640 e 1000 px, no lugar da ilustração do portal; a matriz fica em `apps/site/art/portal-posto.jpg`.
- **Foto do topo do início (2026-11-16):**
  - imagem gerada pelo autor no ChatGPT (geração de imagens), em 16/11/2026, com o prompt 1 do roteiro de imagens (motorista no carro, ao entardecer, num posto da serra);
  - a tela apagada do celular recebeu um print real do app no tema escuro (mapa de Curitibanos com os preços), encaixado por baixo dos dedos;
  - a imagem original tem o volante à direita (carro de mão inglesa, que não existe no Brasil); o recorte quadrado pela esquerda tira o volante e o retrovisor;
  - WebP de 560 e 900 px, no lugar do celular desenhado; a matriz (sem recorte) fica em `apps/site/art/topo-motorista.jpg`.
- **Foto da chamada "É responsável por um posto?" (2026-11-16):**
  - imagem gerada pelo autor no ChatGPT (geração de imagens), em 16/11/2026, com o prompt 5 do roteiro de imagens (posto sem bandeira numa rodovia da serra, com araucárias);
  - usada sem alterações; recorte 3:2 sem o tronco da árvore da borda, em WebP de 640 e 1000 px; a matriz fica em `apps/site/art/posto-serra.jpg`;
  - a chamada passou a ter duas colunas no computador (foto, texto e botão); o posto desenhado continua em "Regras iguais para todos", na página "Para postos".
- **Foto da seção "Regras que não mudam" (2026-11-16):**
  - imagem gerada pelo autor no ChatGPT (geração de imagens), em 16/11/2026, com o prompt 4 do roteiro de imagens (frentista abastecendo);
  - de duas variações, foi escolhida a que mostra o frentista de costas e de lado, sem rosto reconhecível, com araucárias ao fundo; a outra mostrava o rosto nítido;
  - recorte 4:3 em WebP de 640 e 1000 px, no lugar do medidor desenhado do IQP; a matriz fica em `apps/site/art/frentista.jpg`.
- **App nas lojas:** como o app ainda não foi publicado, os botões aparecem como "Em breve: Google Play / App Store". O site não coleta dados (nada de lista de espera).
- **Origem do pedido de acesso:** nova origem `site` (`claim_origin`), para medir o canal no painel de adesão.

### Técnica

- **App novo `apps/site`:**
  - páginas em React, geradas como HTML no build (`renderToStaticMarkup`), com o `tsx`;
  - sem JavaScript no navegador;
  - CSS próprio com as cores da marca e tema claro e escuro;
  - a mesma abordagem da página do posto (ADR 0042).
- **Hospedagem:** serviço estático no Render (`tankei-site`). Site estático não dorme no plano gratuito, ao contrário da API.
- **Configuração por variável de ambiente, no build:** `SITE_URL`, `PORTAL_URL`, `SUPPORT_WHATSAPP`, `CONTACT_EMAIL` e `SITE_INDEXING`.
- **Fora do Google no ambiente de teste:** sem `SITE_INDEXING=1`, as páginas vão com `noindex`, o `robots.txt` bloqueia tudo e o sitemap sai vazio.
- **Testes:** `node:test` com o `tsx`. Conferem que:
  - todo link interno existe;
  - nenhuma página tem script;
  - a indexação, o sitemap e a origem do pedido saem certos;
  - privacidade e termos têm o aviso de minuta.

## Achados para o lançamento

- **Exclusão da conta pelo app:** a API tem a exclusão (`DELETE /v1/me`), mas o app não tem a tela. A Google Play exige a exclusão dentro do app e um endereço na web para pedir a exclusão. Por enquanto, a minuta orienta a pedir por e-mail.
- **Login com Apple:** a API aceita, mas o app só oferece o Google. A minuta cita só o Google.

## Próximas etapas

- **Páginas de preço por cidade** ("Preço da gasolina em Curitibanos"), com links para as páginas dos postos. Ficam para quando houver dados reais e o domínio.
- **Domínio do Tankei** (spec 0004, decisão 5): unir o site oficial e as páginas dos postos no mesmo endereço.
- **Textos finais** de privacidade e termos, depois do parecer jurídico (pauta, item 4).
