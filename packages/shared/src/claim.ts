import { z } from 'zod';
import { nullable } from './validation';

/**
 * Reivindicação de posto (ADR 0019): a pessoa pede para gerenciar um posto no
 * portal e o administrador aprova depois de verificar o vínculo (ADR 0011).
 */

/** Papel no posto (ADR 0011). Só o responsável passa pela verificação. */
export const MANAGER_ROLES = ['responsavel', 'convidado'] as const;
export type ManagerRole = (typeof MANAGER_ROLES)[number];

/** Como o vínculo com o posto foi comprovado (ADR 0011). */
export const VERIFICATION_METHODS = [
  'presencial',
  'telefone',
  'documentos',
  'ecnpj',
  'carta',
] as const;
export type VerificationMethod = (typeof VERIFICATION_METHODS)[number];

export const VERIFICATION_METHOD_LABELS: Record<VerificationMethod, string> = {
  presencial: 'Presencial',
  telefone: 'Por telefone',
  documentos: 'Documentos',
  ecnpj: 'Certificado e-CNPJ',
  carta: 'Código por carta',
};

/** Cargo declarado por quem reivindica. */
export const CLAIM_POSITIONS = ['dono', 'socio', 'gerente', 'outro'] as const;
export type ClaimPosition = (typeof CLAIM_POSITIONS)[number];

export const CLAIM_POSITION_LABELS: Record<ClaimPosition, string> = {
  dono: 'Dono',
  socio: 'Sócio',
  gerente: 'Gerente',
  outro: 'Outro',
};

export const CLAIM_STATUSES = ['em_analise', 'aprovado', 'recusado'] as const;
export type ClaimStatus = (typeof CLAIM_STATUSES)[number];

export const CLAIM_STATUS_LABELS: Record<ClaimStatus, string> = {
  em_analise: 'Em análise',
  aprovado: 'Aprovado',
  recusado: 'Recusado',
};

/** Busca de postos para reivindicar: CNPJ (só dígitos) ou nome. */
export const claimStationSearchSchema = z.object({
  q: z
    .string({ error: 'Informe o CNPJ ou o nome do posto.' })
    .trim()
    .min(3, 'Digite pelo menos 3 caracteres.')
    .max(100)
    .describe('CNPJ (com ou sem pontuação, pode ser parcial) ou nome do posto.'),
  state: z
    .string()
    .regex(/^[A-Z]{2}$/, 'UF inválida.')
    .optional()
    .describe('Restringe a busca por nome a uma UF.'),
});
export type ClaimStationSearch = z.output<typeof claimStationSearchSchema>;

export const claimableStationSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  legalName: z.string().describe('Razão social, para a pessoa conferir.'),
  cnpj: z.string().describe('CNPJ formatado (00.000.000/0000-00).'),
  brand: z.string(),
  address: z.string(),
  city: z.string(),
  state: z.string(),
});
export type ClaimableStation = z.infer<typeof claimableStationSchema>;

export const createClaimSchema = z.object({
  stationId: z.uuid({ error: 'Posto inválido.' }),
  contactName: z
    .string({ error: 'Informe seu nome.' })
    .trim()
    .min(3, 'Informe seu nome completo.')
    .max(100, 'Nome muito longo.'),
  phone: z
    .string({ error: 'Informe um telefone.' })
    .transform((value) => value.replace(/\D/g, ''))
    .pipe(
      z
        .string()
        .regex(/^\d{10,11}$/, 'Informe o telefone com DDD (10 ou 11 dígitos).'),
    )
    .describe('Telefone com DDD; a equipe liga para confirmar o vínculo.'),
  position: z.enum(CLAIM_POSITIONS, { error: 'Informe seu cargo no posto.' }),
  message: z
    .string()
    .trim()
    .max(500, 'Mensagem muito longa.')
    .optional()
    .describe('Observação para a equipe (melhor horário para ligar, por exemplo).'),
});
export type CreateClaim = z.output<typeof createClaimSchema>;

/** Pedido visto por quem pediu. */
export const claimSchema = z.object({
  id: z.uuid(),
  station: claimableStationSchema,
  position: z.enum(CLAIM_POSITIONS),
  status: z.enum(CLAIM_STATUSES),
  createdAt: z.iso.datetime(),
  decidedAt: nullable(z.iso.datetime(), 'Momento da decisão.'),
  reason: nullable(z.string(), 'Motivo da recusa, quando recusado.'),
});
export type Claim = z.infer<typeof claimSchema>;

/** Pedido visto pelo administrador, com o contato para a verificação. */
export const adminClaimSchema = claimSchema.extend({
  contactName: nullable(z.string(), 'Nulo se a conta foi excluída.'),
  phone: nullable(z.string(), 'Só dígitos. Nulo se a conta foi excluída.'),
  message: nullable(z.string(), 'Observação de quem pediu.'),
  account: z.object({
    id: z.uuid(),
    name: nullable(z.string(), 'Nome na conta do Google.'),
    email: nullable(z.string(), 'E-mail da conta do Google.'),
  }),
  currentManagers: z
    .number()
    .int()
    .describe('Quantas pessoas já gerenciam o posto.'),
  verificationMethod: nullable(
    z.enum(VERIFICATION_METHODS),
    'Forma de verificação, quando aprovado.',
  ),
  disputes: z
    .array(
      z.object({
        by: nullable(z.string(), 'Nome de quem contestou.'),
        reason: z.string(),
        createdAt: z.iso.datetime(),
      }),
    )
    .describe(
      'Proprietários atuais que não reconhecem o pedido (ADR 0011 e 0027).',
    ),
});
export type AdminClaim = z.infer<typeof adminClaimSchema>;

export const adminClaimsQuerySchema = z.object({
  status: z
    .enum(CLAIM_STATUSES, { error: 'Situação inválida.' })
    .default('em_analise'),
});
export type AdminClaimsQuery = z.output<typeof adminClaimsQuerySchema>;

export const approveClaimSchema = z.object({
  verificationMethod: z.enum(VERIFICATION_METHODS, {
    error: 'Informe como o vínculo foi verificado.',
  }),
});
export type ApproveClaim = z.output<typeof approveClaimSchema>;

export const rejectClaimSchema = z.object({
  reason: z
    .string({ error: 'Informe o motivo da recusa.' })
    .trim()
    .min(5, 'Explique o motivo da recusa.')
    .max(300, 'Motivo muito longo.')
    .describe('Mostrado a quem pediu.'),
});
export type RejectClaim = z.output<typeof rejectClaimSchema>;

/**
 * Pedido de acesso ao posto visto pelo proprietário atual (ADR 0027): sem
 * telefone nem observação, só o necessário para reconhecer quem pediu.
 */
export const stationClaimNoticeSchema = z.object({
  id: z.uuid(),
  contactName: nullable(z.string(), 'Nome informado por quem pediu.'),
  position: z.enum(CLAIM_POSITIONS),
  createdAt: z.iso.datetime(),
  disputedByMe: z.boolean().describe('Se a pessoa já disse que não reconhece.'),
});
export type StationClaimNotice = z.infer<typeof stationClaimNoticeSchema>;

export const disputeClaimSchema = z.object({
  reason: z
    .string({ error: 'Conte por que você não reconhece o pedido.' })
    .trim()
    .min(5, 'Explique em pelo menos 5 caracteres.')
    .max(300, 'Texto muito longo.')
    .describe('A equipe Tankei lê antes de decidir.'),
});
export type DisputeClaim = z.output<typeof disputeClaimSchema>;
