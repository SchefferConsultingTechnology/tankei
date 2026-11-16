# ADR 0044: Domínio tankei.com.br e endereços dos ambientes

- **Status:** aceito
- **Data:** 2026-11-16
- **Complementa:**
  - ADR 0015 (credenciais do Google)
  - ADR 0016 (hospedagem de testes)
  - ADR 0036 (ambiente de teste e homologação)
  - ADR 0042 (página do posto)
  - ADR 0043 (site oficial)

## Contexto

O domínio do Tankei estava em aberto (spec 0004, decisão 5). O autor registrou `tankei.com.br`, com o DNS no Registro.br.

Tudo o que está publicado é do **ambiente de teste**, com preços fictícios nas páginas dos postos. A homologação terá um banco novo (ADR 0036). Para SEO, o site oficial e as páginas dos postos devem ficar no mesmo domínio: endereços diferentes contam como sites separados para o Google.

## Decisão

### Endereços

| Endereço | Serviço no Render | Conteúdo |
|---|---|---|
| `tankei.com.br` (e `www`, que redireciona) | `tankei-www` | Site oficial, sem as páginas dos postos |
| `teste.tankei.com.br` | `tankei-site` | Site + páginas dos postos do teste (`/p/...`) |
| `api-teste.tankei.com.br` | `tankei-api` | API de teste |
| `portal-teste.tankei.com.br` | `tankei-portal` | Portal de teste |
| `admin-teste.tankei.com.br` | `tankei-admin` | Admin de teste |

- **O domínio principal nunca mostra preço fictício.** O `tankei-www` usa o mesmo build do site, mas sem repassar `/p/` à API de teste.
- **Homologação e produção** assumem depois `tankei.com.br/p/...`, `api.`, `portal.` e `admin.tankei.com.br`.
- **Endereços `onrender.com`:** continuam funcionando. O APK de teste aponta para `tankei-api.onrender.com` e não precisa de uma versão nova.

### Páginas dos postos no endereço do site

- O site estático repassa `/p/*` e `/sitemap-postos.xml` à API ("rewrite" do Render), sem mudar o endereço no navegador.
- Para a página usar o endereço do site como canônico, a variável `SITE_URL` da API passa a ser o endereço do site (`https://teste.tankei.com.br`).
- O `robots.txt` do site cita os dois sitemaps quando a indexação está ligada.

### DNS (Registro.br)

| Tipo | Nome | Valor |
|---|---|---|
| A | `tankei.com.br` | `216.24.57.1` |
| CNAME | `www` | subdomínio `onrender.com` do `tankei-www` |
| CNAME | `teste` | subdomínio `onrender.com` do `tankei-site` |
| CNAME | `api-teste` | subdomínio `onrender.com` do `tankei-api` |
| CNAME | `portal-teste` | subdomínio `onrender.com` do `tankei-portal` |
| CNAME | `admin-teste` | subdomínio `onrender.com` do `tankei-admin` |

- Sem registros AAAA: o Render usa só IPv4.
- Os certificados HTTPS são criados e renovados automaticamente pelo Render.
- Os domínios são declarados no `render.yaml` (`domains`).

### Ordem da troca

1. Criar os registros no Registro.br e sincronizar o Blueprint no Render, que cria o `tankei-www` e associa os domínios.
2. Esperar o Render verificar os domínios e emitir os certificados.
3. Só então trocar as variáveis para os endereços novos:
   - API: `SITE_URL`, `PORTAL_URL`, `ADMIN_URL` e `OFFICIAL_SITE_URL`;
   - portal e admin: `VITE_API_URL`;
   - sites: `PORTAL_URL`.
4. Incluir `portal-teste.tankei.com.br` e `admin-teste.tankei.com.br` nas origens autorizadas do cliente OAuth Web do Google (ADR 0015). Sem isso, o login no portal e no admin falha nos endereços novos.

## Consequências

- **Custo:** o plano do Render inclui poucos domínios próprios. Os excedentes custam cerca de US$ 0,25 por mês cada.
- **Indexação:** `tankei.com.br` tem conteúdo real e pode ser indexado assim que o autor ligar `SITE_INDEXING=1` no `tankei-www`. Os endereços `-teste` ficam sempre fora do Google.
- **Google Search Console:** a verificação do domínio usa um registro TXT no Registro.br.
- **E-mails:** continuam saindo pelo domínio já configurado no Resend (ADR 0025). Usar `tankei.com.br` como remetente fica para depois.
