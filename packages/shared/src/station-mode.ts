import { z } from 'zod';
import { FUEL_TYPES } from './fuel';
import { nullable } from './validation';

/**
 * Como o posto aparece no app (ADR 0028). Definido só pela administração,
 * a pedido do posto (cliente ou não), com registro de quem pediu e por quê.
 * O preço de combustível é informação pública: esconder é exceção.
 */
export const STATION_MODES = [
  'normal',
  'nao_participa',
  'preco_oficial',
  'precos_ocultos',
  'oculto',
] as const;
export type StationMode = (typeof STATION_MODES)[number];

export const STATION_MODE_LABELS: Record<StationMode, string> = {
  normal: 'Normal',
  nao_participa: 'Não participa',
  preco_oficial: 'Preço oficial',
  precos_ocultos: 'Preços ocultos',
  oculto: 'Oculto',
};

export const STATION_MODE_DESCRIPTIONS: Record<StationMode, string> = {
  normal: 'Preços do posto e dos consumidores, com as regras de confiança.',
  nao_participa:
    'O posto pediu para não participar. Os preços continuam, informados por consumidores, com esse aviso no app.',
  preco_oficial:
    'Só para posto com rede. O preço do posto sempre prevalece; informes de consumidores aparecem como aviso e não o substituem.',
  precos_ocultos:
    'O posto fica no mapa, sem preços, e ninguém informa preço. Só por motivo objetivo.',
  oculto:
    'O posto sai do app (mapa, lista e ficha). Só por motivo objetivo.',
};

/** Motivos objetivos para esconder preços ou o posto. */
export const HIDE_REASONS = [
  'fechado',
  'ordem_judicial',
  'dado_incorreto',
  'seguranca',
] as const;
export type HideReason = (typeof HIDE_REASONS)[number];

export const HIDE_REASON_LABELS: Record<HideReason, string> = {
  fechado: 'Posto fechado ou desativado',
  ordem_judicial: 'Ordem judicial',
  dado_incorreto: 'Dado incorreto comprovado',
  seguranca: 'Risco de segurança',
};

/** Modos que escondem algo exigem um motivo objetivo. */
export function modeNeedsHideReason(mode: StationMode): boolean {
  return mode === 'precos_ocultos' || mode === 'oculto';
}

/** Aviso que o app mostra na ficha do posto, conforme o modo. */
export const STATION_MODE_NOTICES: Partial<Record<StationMode, string>> = {
  nao_participa:
    'Este posto não participa do Tankei. Os preços são informados por consumidores.',
  preco_oficial:
    'Preço oficial informado pelo posto. Informes de consumidores aparecem como aviso.',
  precos_ocultos: 'Os preços deste posto não são exibidos no Tankei.',
};

export const stationModeChangeSchema = z.object({
  mode: z.enum(STATION_MODES),
  hideReason: nullable(z.enum(HIDE_REASONS), 'Motivo objetivo, quando esconde.'),
  requestedBy: z.string().describe('Quem pediu (ex.: "proprietário, por telefone").'),
  reason: z.string(),
  decidedBy: nullable(z.string(), 'Administrador que decidiu.'),
  createdAt: z.iso.datetime(),
});
export type StationModeChange = z.infer<typeof stationModeChangeSchema>;

export const setStationModeSchema = z
  .object({
    mode: z.enum(STATION_MODES, { error: 'Escolha o modo.' }),
    hideReason: z.enum(HIDE_REASONS).nullable().default(null),
    requestedBy: z
      .string({ error: 'Informe quem pediu.' })
      .trim()
      .min(3, 'Informe quem pediu.')
      .max(120, 'Texto muito longo.'),
    reason: z
      .string({ error: 'Informe o motivo.' })
      .trim()
      .min(5, 'Explique o motivo em pelo menos 5 caracteres.')
      .max(300, 'Motivo muito longo.'),
  })
  .superRefine((value, ctx) => {
    if (modeNeedsHideReason(value.mode) && !value.hideReason) {
      ctx.addIssue({
        code: 'custom',
        path: ['hideReason'],
        message: 'Escolha o motivo objetivo.',
      });
    }
    if (value.mode === 'precos_ocultos' && value.hideReason === 'fechado') {
      ctx.addIssue({
        code: 'custom',
        path: ['hideReason'],
        message: 'Posto fechado sai do app: use o modo Oculto.',
      });
    }
    if (value.mode === 'oculto' && value.hideReason === 'dado_incorreto') {
      ctx.addIssue({
        code: 'custom',
        path: ['hideReason'],
        message: 'Dado incorreto: oculte só os preços.',
      });
    }
  });
export type SetStationMode = z.output<typeof setStationModeSchema>;

/** Posto em "preço oficial" com divergência além do prazo (fila do admin). */
export const officialDivergenceSchema = z.object({
  station: z.object({
    id: z.uuid(),
    name: z.string(),
    city: z.string(),
    state: z.string(),
  }),
  fuelType: z.enum(FUEL_TYPES),
  stationPrice: z.number(),
  consumerPrice: z.number(),
  since: z.iso.datetime().describe('Desde quando consumidores confirmam o outro valor.'),
});
export type OfficialDivergence = z.infer<typeof officialDivergenceSchema>;
