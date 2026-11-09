import { z } from 'zod';
import { nullable } from './validation';

/**
 * Caminho curto entre o dono do posto e o Tankei (ADR 0031): na ficha de um
 * posto sem rede no portal, o app oferece WhatsApp, o pedido de acesso já
 * preenchido e o convite para quem conhece o dono. Os textos não falam de
 * preço nem de cobrança.
 */

/** Configuração pública que o app lê da API. */
export const appConfigSchema = z.object({
  supportWhatsapp: nullable(
    z.string().regex(/^\d{12,13}$/),
    'WhatsApp da equipe Tankei, só dígitos com DDI e DDD. Nulo esconde o botão.',
  ),
  portalUrl: z.string().describe('Endereço do portal do posto.'),
  mapCardCloseSeconds: z
    .number()
    .int()
    .min(0)
    .default(8)
    .describe(
      'Segundos até o cartão do mapa fechar sozinho (parâmetro app.map_card_close_seconds, ADR 0033). 0 = não fecha.',
    ),
  visitsFlushSeconds: z
    .number()
    .int()
    .default(60)
    .describe('Envio das visitas pelo app (parâmetro analytics.flush_seconds).'),
  visitsMaxDetailSeconds: z
    .number()
    .int()
    .default(600)
    .describe('Teto do tempo na ficha (parâmetro analytics.max_detail_seconds).'),
  visitsMaxQueueDays: z
    .number()
    .int()
    .default(7)
    .describe('Validade da visita não enviada (parâmetro analytics.max_queue_days).'),
});
export type AppConfig = z.infer<typeof appConfigSchema>;

/** De onde veio o pedido de acesso. */
export const CLAIM_ORIGINS = ['portal', 'app_dono', 'app_convite'] as const;
export type ClaimOrigin = (typeof CLAIM_ORIGINS)[number];

export const CLAIM_ORIGIN_LABELS: Record<ClaimOrigin, string> = {
  portal: 'Portal',
  app_dono: 'Veio do app (responsável)',
  app_convite: 'Veio do app (convite)',
};

interface InviteStation {
  id: string;
  name: string;
  address: string;
  city: string;
  state: string;
}

/** Pedido de acesso no portal, com o posto já escolhido. */
export function claimLink(
  portalUrl: string,
  stationId: string,
  origin: Exclude<ClaimOrigin, 'portal'>,
): string {
  const base = portalUrl.replace(/\/$/, '');
  return `${base}/acesso?posto=${stationId}&origem=${origin}`;
}

/** Mensagem pronta do responsável para o WhatsApp da equipe. */
export function ownerWhatsappMessage(station: InviteStation): string {
  return [
    'Olá! Sou responsável por um posto que aparece no app Tankei e quero cuidar das informações dele.',
    '',
    `Posto: ${station.name}`,
    `Endereço: ${station.address}, ${station.city}/${station.state}`,
    `Código no Tankei: ${station.id}`,
  ].join('\n');
}

export function whatsappLink(phone: string, message: string): string {
  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
}

/** Convite que o consumidor envia para quem cuida do posto. */
export function inviteShareMessage(
  station: InviteStation,
  link: string,
): string {
  return `O ${station.name} aparece no Tankei, app que mostra preços e a qualidade dos postos. Quem responde pelo posto pode atualizar as informações e falar com os clientes por aqui: ${link}`;
}
