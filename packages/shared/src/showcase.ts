import { z } from 'zod';
import { FUEL_TYPES } from './fuel';
import { nullable } from './validation';

/**
 * Vitrine do posto (ADR 0020, fase 3, e ADR 0026): promoções com arte e
 * fotos. Publicadas na hora pelo posto; a equipe Tankei pode remover imagens.
 */

/** Formatos aceitos no envio; a API converte tudo para WebP. */
export const IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;

export const stationPhotoSchema = z.object({
  id: z.uuid(),
  url: z.string().describe('Endereço público da imagem (WebP).'),
  width: z.number().int(),
  height: z.number().int(),
  caption: nullable(z.string(), 'Legenda.'),
  createdAt: z.iso.datetime(),
});
export type StationPhoto = z.infer<typeof stationPhotoSchema>;

/** Fotos vistas pelo posto: as publicadas e as que a equipe Tankei removeu. */
export const stationPhotosSchema = z.object({
  maxPhotos: z.number().int().describe('Limite de fotos publicadas.'),
  maxUploadMb: z.number().int().describe('Tamanho máximo da imagem (MB).'),
  photos: z.array(stationPhotoSchema),
  removedByTankei: z
    .array(
      z.object({
        id: z.uuid(),
        caption: nullable(z.string(), 'Legenda.'),
        reason: z.string(),
        removedAt: z.iso.datetime(),
      }),
    )
    .describe('Removidas pela equipe Tankei nos últimos 30 dias, com o motivo.'),
});
export type StationPhotos = z.infer<typeof stationPhotosSchema>;

export const PROMOTION_STATUSES = ['agendada', 'vigente', 'encerrada'] as const;
export type PromotionStatus = (typeof PROMOTION_STATUSES)[number];

export const PROMOTION_STATUS_LABELS: Record<PromotionStatus, string> = {
  agendada: 'Agendada',
  vigente: 'Vigente',
  encerrada: 'Encerrada',
};

export const promotionPriceSchema = z.object({
  fuelType: z.enum(FUEL_TYPES, { error: 'Combustível inválido.' }),
  price: z
    .number({ error: 'Preço inválido.' })
    .positive('Preço inválido.')
    .max(99.999, 'Preço inválido.')
    .refine(
      (value) => Math.abs(value * 1000 - Math.round(value * 1000)) < 1e-6,
      'Use no máximo 3 casas decimais.',
    ),
});
export type PromotionPrice = z.infer<typeof promotionPriceSchema>;

export const promotionSchema = z.object({
  id: z.uuid(),
  title: z.string(),
  description: nullable(z.string(), 'Texto da promoção.'),
  imageUrl: nullable(z.string(), 'Arte da promoção (WebP).'),
  startsAt: z.iso.datetime(),
  endsAt: z.iso.datetime().describe('Fim efetivo (antecipado, se encerrada antes).'),
  status: z.enum(PROMOTION_STATUSES),
  prices: z
    .array(promotionPriceSchema)
    .describe('Preços promocionais por combustível (pode ser vazio).'),
});
export type Promotion = z.infer<typeof promotionSchema>;

/** Promoção vista pelo posto: inclui quem criou e se a arte foi removida. */
export const stationPromotionSchema = promotionSchema.extend({
  createdBy: nullable(z.string(), 'Nome de quem cadastrou.'),
  createdAt: z.iso.datetime(),
  imageRemovedReason: nullable(
    z.string(),
    'Motivo, se a equipe Tankei removeu a arte.',
  ),
});
export type StationPromotion = z.infer<typeof stationPromotionSchema>;

const isoDateTime = (message: string) =>
  z.iso
    .datetime({ offset: true, error: message })
    .transform((value) => new Date(value));

export const createPromotionSchema = z
  .object({
    title: z
      .string({ error: 'Informe o título.' })
      .trim()
      .min(3, 'Título muito curto.')
      .max(60, 'Título muito longo (até 60 caracteres).'),
    description: z
      .string()
      .trim()
      .max(300, 'Descrição muito longa (até 300 caracteres).')
      .optional()
      .transform((value) => value || null),
    startsAt: isoDateTime('Início inválido.'),
    endsAt: isoDateTime('Fim inválido.'),
    prices: z
      .array(promotionPriceSchema)
      .max(7)
      .default([])
      .refine(
        (list) => new Set(list.map((p) => p.fuelType)).size === list.length,
        'Um preço por combustível.',
      ),
    confirmed: z
      .boolean()
      .default(false)
      .describe('true depois de confirmar preços muito diferentes do atual.'),
  })
  .refine((p) => p.endsAt > p.startsAt, {
    message: 'O fim deve ser depois do início.',
    path: ['endsAt'],
  });
export type CreatePromotion = z.output<typeof createPromotionSchema>;

/** Vitrine pública do posto, para a ficha no app. */
export const stationShowcaseSchema = z.object({
  photos: z.array(stationPhotoSchema),
  promotions: z
    .array(promotionSchema)
    .describe('Promoções vigentes, as que terminam antes primeiro.'),
});
export type StationShowcase = z.infer<typeof stationShowcaseSchema>;

export const photoCaptionSchema = z.object({
  caption: z
    .string()
    .trim()
    .max(80, 'Legenda muito longa (até 80 caracteres).')
    .optional()
    .transform((value) => value || null),
});
export type PhotoCaption = z.output<typeof photoCaptionSchema>;

// ---------- Administração ----------

export const MEDIA_KINDS = ['foto', 'arte'] as const;
export type MediaKind = (typeof MEDIA_KINDS)[number];

export const adminMediaSchema = z.object({
  kind: z.enum(MEDIA_KINDS),
  id: z.uuid().describe('Foto ou promoção.'),
  url: z.string(),
  label: nullable(z.string(), 'Legenda da foto ou título da promoção.'),
  station: z.object({
    id: z.uuid(),
    name: z.string(),
    city: z.string(),
    state: z.string(),
  }),
  uploadedBy: nullable(z.string(), 'Quem enviou.'),
  createdAt: z.iso.datetime(),
  removed: nullable(
    z.object({
      reason: z.string(),
      by: nullable(z.string(), 'Quem removeu.'),
      at: z.iso.datetime(),
    }),
    'Remoção, se houve.',
  ),
});
export type AdminMedia = z.infer<typeof adminMediaSchema>;

export const adminMediaQuerySchema = z.object({
  days: z
    .string()
    .regex(/^\d+$/, 'Período inválido.')
    .transform(Number)
    .pipe(z.number().int().min(1).max(90))
    .default(30),
});
export type AdminMediaQuery = z.output<typeof adminMediaQuerySchema>;

export const removeMediaSchema = z.object({
  reason: z
    .string({ error: 'Informe o motivo.' })
    .trim()
    .min(5, 'Explique o motivo em pelo menos 5 caracteres.')
    .max(300, 'Motivo muito longo.')
    .describe('O posto vê este motivo no portal.'),
});
export type RemoveMedia = z.output<typeof removeMediaSchema>;
