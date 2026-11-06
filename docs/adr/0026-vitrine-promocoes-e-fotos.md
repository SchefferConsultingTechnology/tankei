# ADR 0026: Vitrine do posto: promoções com arte e fotos (fase 3)

- **Status:** aceito
- **Data:** 2026-11-06
- **Detalha:** ADR 0020 (fase 3). **Complementa:** ADR 0003 (preço exibido), 0006 (parâmetros), 0009 (privacidade), 0021 (papéis)

## Contexto

Até aqui, promoção era só um preço do posto com nome e prazo. O ADR 0020 previu promoção com cadastro próprio (título, descrição, arte, validade e preço por combustível) e fotos do posto, publicadas na hora, com remoção pela equipe Tankei.

## Decisão

### Quem e quanto

- Cadastram promoções e fotos quem tem a ação `manage_promotions`: **proprietário e gestor** (ADR 0021).
- Limites em parâmetros (ADR 0006): `media.max_station_photos` (**10** fotos publicadas por posto) e `media.max_upload_mb` (**5 MB** por imagem).

### Promoção

- Tabela própria (`promotions`), com título (até 60 caracteres), descrição (até 300), período e arte opcional.
- **Duração:** máxima de `price.promotion_max_days`. Pode ser agendada para depois.
- **Preços promocionais por combustível (opcionais):**
  - são informes de preço do posto ligados à promoção (`price_reports.promotion_id`), que continuam só de inserção;
  - seguem as regras do preço do posto: faixa da ANP só pelo limite máximo e confirmação de valor muito diferente do atual.

  Todos são validados antes de gravar.
- **Encerrar antes:** marca `ended_at`. O fim efetivo é o menor entre o prazo e o encerramento, e o preço exibido respeita isso.
- O preço com promoção pelo caminho antigo (campo `promotion` no informe) continua funcionando.

### Imagens

- **Preparação:** a API confere o formato pelo conteúdo (JPG, PNG ou WebP), gira conforme o EXIF, reduz para no máximo 1600 px e converte para WebP com o `sharp`. **Metadados não são copiados**, inclusive a localização GPS (ADR 0009).
- **Armazenamento:** compatível com S3. Em produção, o Supabase Storage (balde público `tankei-imagens`). Localmente, a SeaweedFS do `docker compose` (`pnpm storage:up`), porque a MinIO deixou de publicar imagens. Sem configuração, o envio responde 503.
- **Publicação imediata.** O admin lista as imagens dos últimos dias e a equipe pode remover com motivo:
  - **foto:** sai do ar e do armazenamento; o registro fica, com quem removeu e por quê;
  - **arte:** sai, mas a promoção continua.

  O posto vê o motivo no portal. O próprio posto também remove as suas fotos.
- **Na ficha do app:** fotos e promoções vigentes, pela rota pública `GET /v1/stations/:id/showcase`. A arte aparece só na ficha. A lista e o mapa continuam com o selo e o nome da promoção.

## Consequências

- Fotos e promoções não são tabelas só de inserção: remoção e encerramento atualizam o registro (com autor e data). Os preços promocionais continuam auditáveis em `price_reports`.
- O posto é responsável pelo conteúdo. Fotos com pessoas ou placas podem ser removidas pela equipe.
- Em produção, falta criar no Supabase o balde público e as chaves S3 e configurar `STORAGE_*` no Render.
