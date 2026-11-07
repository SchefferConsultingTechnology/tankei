import { z } from 'zod';
import { FUEL_TYPES } from './fuel';
import { currentPriceSchema } from './price';
import { nullable } from './validation';

/**
 * Redes de postos e equipe no portal (ADR 0021). A rede agrupa postos; cada
 * pessoa da equipe tem um papel e um escopo (todas as unidades ou algumas).
 */

export const ORG_ROLES = [
  'proprietario',
  'gestor',
  'operador',
  'leitura',
] as const;
export type OrgRole = (typeof ORG_ROLES)[number];

export const ORG_ROLE_LABELS: Record<OrgRole, string> = {
  proprietario: 'Proprietário',
  gestor: 'Gestor',
  operador: 'Operador',
  leitura: 'Somente leitura',
};

export const ORG_ROLE_DESCRIPTIONS: Record<OrgRole, string> = {
  proprietario: 'Tudo, inclusive a equipe e as unidades da rede.',
  gestor: 'Preços, promoções e contestações das unidades do escopo.',
  operador: 'Atualizar preço das unidades do escopo.',
  leitura: 'Ver preços, histórico, concorrência e reputação, sem alterar.',
};

/** Ações verificadas pela API para cada papel. */
export const ORG_ACTIONS = [
  'view',
  'update_price',
  'manage_promotions',
  'manage_info',
  'contest',
  'manage_team',
] as const;
export type OrgAction = (typeof ORG_ACTIONS)[number];

export const ROLE_PERMISSIONS: Record<OrgRole, readonly OrgAction[]> = {
  proprietario: ORG_ACTIONS,
  gestor: ['view', 'update_price', 'manage_promotions', 'manage_info', 'contest'],
  operador: ['view', 'update_price'],
  leitura: ['view'],
};

export function roleCan(role: OrgRole, action: OrgAction): boolean {
  return ROLE_PERMISSIONS[role].includes(action);
}

export const ORG_SCOPES = ['todas', 'selecionadas'] as const;
export type OrgScope = (typeof ORG_SCOPES)[number];

/** Rede vista por um membro: o papel dele e as unidades do seu escopo. */
export const myOrganizationSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  role: z.enum(ORG_ROLES),
  scope: z.enum(ORG_SCOPES),
  stations: z
    .array(z.object({ id: z.uuid(), name: z.string() }))
    .describe('Unidades do escopo da pessoa, por nome.'),
  totalStations: z.number().int().describe('Unidades da rede.'),
});
export type MyOrganization = z.infer<typeof myOrganizationSchema>;

export const renameOrganizationSchema = z.object({
  name: z
    .string({ error: 'Informe o nome da rede.' })
    .trim()
    .min(2, 'Nome muito curto.')
    .max(80, 'Nome muito longo.'),
});
export type RenameOrganization = z.output<typeof renameOrganizationSchema>;

/** Visão da rede: preço vigente de cada unidade por combustível. */
export const organizationOverviewSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  role: z.enum(ORG_ROLES),
  fuels: z
    .array(z.enum(FUEL_TYPES))
    .describe('Combustíveis vendidos por alguma unidade, na ordem padrão.'),
  stations: z.array(
    z.object({
      id: z.uuid(),
      name: z.string(),
      city: z.string(),
      state: z.string(),
      fuels: z.array(z.enum(FUEL_TYPES)),
      prices: z.array(currentPriceSchema),
    }),
  ),
});
export type OrganizationOverview = z.infer<typeof organizationOverviewSchema>;

/** Mesmo preço em várias unidades (rede com preço único). */
export const bulkPriceSchema = z.object({
  fuelType: z.enum(FUEL_TYPES, { error: 'Combustível inválido.' }),
  price: z
    .number({ error: 'Preço inválido.' })
    .positive('Preço inválido.')
    .max(99.999, 'Preço inválido.'),
  stationIds: z
    .array(z.uuid())
    .min(1, 'Escolha ao menos uma unidade.')
    .max(200, 'Unidades demais de uma vez.'),
  confirmed: z
    .boolean()
    .default(false)
    .describe('true depois de confirmar valores muito diferentes do atual.'),
});
export type BulkPrice = z.output<typeof bulkPriceSchema>;

export const bulkPriceResultSchema = z.object({
  results: z.array(
    z.object({
      stationId: z.uuid(),
      name: z.string(),
      ok: z.boolean(),
      code: nullable(z.string(), 'Código do erro (ex.: CONFIRMATION_REQUIRED).'),
      message: z.string(),
    }),
  ),
});
export type BulkPriceResult = z.infer<typeof bulkPriceResultSchema>;

// ---------- Equipe ----------

export const teamMemberSchema = z.object({
  userId: z.uuid(),
  name: nullable(z.string(), 'Nome na conta.'),
  email: nullable(z.string(), 'E-mail da conta.'),
  role: z.enum(ORG_ROLES),
  scope: z.enum(ORG_SCOPES),
  stationIds: z
    .array(z.uuid())
    .describe('Unidades escolhidas (vazio quando o escopo é "todas").'),
  since: z.iso.datetime(),
});
export type TeamMember = z.infer<typeof teamMemberSchema>;

export const INVITATION_STATUSES = [
  'pendente',
  'aceito',
  'recusado',
  'revogado',
  'expirado',
] as const;
export type InvitationStatus = (typeof INVITATION_STATUSES)[number];

export const invitationSchema = z.object({
  id: z.uuid(),
  email: z.string(),
  role: z.enum(ORG_ROLES),
  scope: z.enum(ORG_SCOPES),
  stationIds: z.array(z.uuid()),
  status: z.enum(INVITATION_STATUSES),
  invitedBy: nullable(z.string(), 'Nome de quem convidou.'),
  createdAt: z.iso.datetime(),
  expiresAt: z.iso.datetime(),
});
export type Invitation = z.infer<typeof invitationSchema>;

export const teamSchema = z.object({
  members: z.array(teamMemberSchema),
  invitations: z
    .array(invitationSchema)
    .describe('Convites dos últimos 90 dias, os pendentes primeiro.'),
  stations: z
    .array(z.object({ id: z.uuid(), name: z.string() }))
    .describe('Unidades da rede, para escolher o escopo.'),
});
export type Team = z.infer<typeof teamSchema>;

export const scopeFields = {
  role: z.enum(ORG_ROLES, { error: 'Escolha o papel.' }),
  scope: z.enum(ORG_SCOPES, { error: 'Escolha o escopo.' }),
  stationIds: z
    .array(z.uuid())
    .default([])
    .describe('Obrigatório com escopo "selecionadas".'),
};

/** Proprietário vê todas as unidades; escopo "selecionadas" exige unidades. */
export function scopeRule<T extends { role: OrgRole; scope: OrgScope; stationIds: string[] }>(
  value: T,
  ctx: z.RefinementCtx,
) {
  if (value.role === 'proprietario' && value.scope !== 'todas') {
    ctx.addIssue({
      code: 'custom',
      path: ['scope'],
      message: 'Proprietário tem acesso a todas as unidades.',
    });
  }
  if (value.scope === 'selecionadas' && value.stationIds.length === 0) {
    ctx.addIssue({
      code: 'custom',
      path: ['stationIds'],
      message: 'Escolha ao menos uma unidade.',
    });
  }
}

export const createInvitationSchema = z
  .object({
    email: z
      .email({ error: 'E-mail inválido.' })
      .transform((value) => value.trim().toLowerCase()),
    ...scopeFields,
  })
  .superRefine(scopeRule);
export type CreateInvitation = z.output<typeof createInvitationSchema>;

export const updateMemberSchema = z.object(scopeFields).superRefine(scopeRule);
export type UpdateMember = z.output<typeof updateMemberSchema>;

/** Convite visto por quem foi convidado. */
export const myInvitationSchema = z.object({
  id: z.uuid(),
  organization: z.object({ id: z.uuid(), name: z.string() }),
  role: z.enum(ORG_ROLES),
  stations: z
    .array(z.object({ id: z.uuid(), name: z.string() }))
    .describe('Unidades do escopo (todas, quando o escopo é "todas").'),
  invitedBy: nullable(z.string(), 'Nome de quem convidou.'),
  expiresAt: z.iso.datetime(),
});
export type MyInvitation = z.infer<typeof myInvitationSchema>;
