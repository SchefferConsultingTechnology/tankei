import { z } from 'zod';
import { VERIFICATION_METHODS } from './claim';
import { STATION_MODES, stationModeChangeSchema } from './station-mode';
import {
  invitationSchema,
  ORG_ROLES,
  ORG_SCOPES,
  scopeFields,
  scopeRule,
} from './organization';
import { nullable } from './validation';

/**
 * Suporte da equipe Tankei a postos e redes (ADR 0021 e 0023): consulta,
 * vínculo de responsáveis e ajustes na equipe de uma rede, com registro.
 */

const networkRef = z.object({ id: z.uuid(), name: z.string() });

// ---------- Postos ----------

export const adminStationSearchSchema = z.object({
  q: z
    .string({ error: 'Informe o CNPJ, o nome ou a cidade do posto.' })
    .trim()
    .min(2, 'Digite pelo menos 2 caracteres.')
    .max(100)
    .describe('CNPJ (pode ser parcial), nome ou cidade.'),
});
export type AdminStationSearch = z.output<typeof adminStationSearchSchema>;

export const adminStationSummarySchema = z.object({
  id: z.uuid(),
  name: z.string(),
  legalName: z.string(),
  cnpj: z.string().describe('CNPJ formatado.'),
  brand: z.string(),
  city: z.string(),
  state: z.string(),
  active: z.boolean(),
  network: nullable(networkRef, 'Rede do posto, se tiver.'),
  mode: z.enum(STATION_MODES).describe('Modo de exibição (ADR 0028).'),
});
export type AdminStationSummary = z.infer<typeof adminStationSummarySchema>;

export const verifiedManagerSchema = z.object({
  userId: z.uuid(),
  name: nullable(z.string(), 'Nome na conta.'),
  email: nullable(z.string(), 'E-mail da conta.'),
  verificationMethod: nullable(
    z.enum(VERIFICATION_METHODS),
    'Como o vínculo foi comprovado (ADR 0011).',
  ),
  verifiedAt: nullable(z.iso.datetime(), 'Quando foi verificado.'),
});
export type VerifiedManager = z.infer<typeof verifiedManagerSchema>;

export const adminStationSchema = adminStationSummarySchema.extend({
  mode: z.enum(STATION_MODES),
  modeHistory: z
    .array(stationModeChangeSchema)
    .describe('Mudanças de modo, as mais recentes primeiro (ADR 0028).'),
  address: z.string(),
  district: nullable(z.string(), 'Bairro.'),
  verifiedManagers: z
    .array(verifiedManagerSchema)
    .describe('Responsáveis com vínculo comprovado (ADR 0011).'),
  pendingClaims: z.number().int().describe('Pedidos de acesso em análise.'),
});
export type AdminStation = z.infer<typeof adminStationSchema>;

/** Vínculo direto pelo administrador: pela conta (id) ou pelo e-mail dela. */
export const addStationManagerSchema = z
  .object({
    userId: z.uuid({ error: 'Usuário inválido.' }).optional(),
    email: z
      .email({ error: 'E-mail inválido.' })
      .transform((value) => value.trim().toLowerCase())
      .optional(),
  })
  .refine((value) => Boolean(value.userId ?? value.email), {
    message: 'Informe o e-mail da conta.',
    path: ['email'],
  });
export type AddStationManager = z.output<typeof addStationManagerSchema>;

// ---------- Redes ----------

export const adminNetworkQuerySchema = z.object({
  q: z
    .string()
    .trim()
    .max(100)
    .optional()
    .describe('Nome da rede ou e-mail de alguém da equipe.'),
});
export type AdminNetworkQuery = z.output<typeof adminNetworkQuerySchema>;

export const adminNetworkSummarySchema = z.object({
  id: z.uuid(),
  name: z.string(),
  stations: z.number().int().describe('Unidades.'),
  members: z.number().int().describe('Pessoas na equipe.'),
  owners: z.array(z.string()).describe('Nome (ou e-mail) dos proprietários.'),
  createdAt: z.iso.datetime(),
});
export type AdminNetworkSummary = z.infer<typeof adminNetworkSummarySchema>;

export const adminNetworkMemberSchema = z.object({
  userId: z.uuid(),
  name: nullable(z.string(), 'Nome na conta.'),
  email: nullable(z.string(), 'E-mail da conta.'),
  role: z.enum(ORG_ROLES),
  scope: z.enum(ORG_SCOPES),
  stationIds: z.array(z.uuid()),
  since: z.iso.datetime(),
});
export type AdminNetworkMember = z.infer<typeof adminNetworkMemberSchema>;

export const networkEventSchema = z.object({
  id: z.uuid(),
  action: z.string(),
  description: z.string().describe('O que aconteceu, em texto.'),
  actor: nullable(
    z.string(),
    'Quem fez (nome ou e-mail); nulo quando foi o sistema.',
  ),
  createdAt: z.iso.datetime(),
});
export type NetworkEvent = z.infer<typeof networkEventSchema>;

export const adminNetworkSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  createdAt: z.iso.datetime(),
  stations: z.array(
    z.object({
      id: z.uuid(),
      name: z.string(),
      cnpj: z.string(),
      city: z.string(),
      state: z.string(),
    }),
  ),
  members: z.array(adminNetworkMemberSchema),
  invitations: z
    .array(invitationSchema)
    .describe('Convites dos últimos 90 dias, os pendentes primeiro.'),
  events: z
    .array(networkEventSchema)
    .describe('Registro da rede, os mais recentes primeiro (até 100).'),
});
export type AdminNetwork = z.infer<typeof adminNetworkSchema>;

const reason = z
  .string({ error: 'Informe o motivo.' })
  .trim()
  .min(5, 'Explique o motivo em pelo menos 5 caracteres.')
  .max(300, 'Motivo muito longo.')
  .describe('Por que o administrador fez a alteração (fica no registro).');

/** Ajuste do papel ou do escopo pelo administrador (ex.: rede sem dono). */
export const adminUpdateMemberSchema = z
  .object({ ...scopeFields, reason })
  .superRefine(scopeRule);
export type AdminUpdateMember = z.output<typeof adminUpdateMemberSchema>;

export const adminRemoveMemberSchema = z.object({ reason });
export type AdminRemoveMember = z.output<typeof adminRemoveMemberSchema>;

/** Tirar o posto da rede (null) ou movê-lo para outra, com motivo. */
export const adminStationNetworkSchema = z.object({
  networkId: z
    .uuid({ error: 'Rede inválida.' })
    .nullable()
    .describe('Rede de destino; null tira o posto da rede atual.'),
  reason,
});
export type AdminStationNetwork = z.output<typeof adminStationNetworkSchema>;
