import { z } from 'zod';
import { nullable } from './validation';

/** Provedores de login (ADR 0007). */
export const AUTH_PROVIDERS = ['google', 'apple'] as const;
export type AuthProvider = (typeof AUTH_PROVIDERS)[number];

/**
 * Perfil da conta. Gestor de posto não é um perfil: é quem tem vínculo com
 * algum posto (`managedStations`), e continua sendo motorista.
 */
export const USER_ROLES = ['motorista', 'admin'] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const loginRequestSchema = z.object({
  provider: z
    .enum(AUTH_PROVIDERS, { error: 'Provedor de login inválido.' })
    .describe('Provedor que emitiu o token de identidade.'),
  idToken: z
    .string({ error: 'Token de identidade ausente.' })
    .min(1, 'Token de identidade ausente.')
    .describe('Token de identidade (ID token) obtido do Google ou da Apple.'),
  name: z
    .string()
    .trim()
    .min(1)
    .max(100)
    .optional()
    .describe(
      'Nome da pessoa. A Apple só informa o nome no primeiro login, ao app, fora do token.',
    ),
});
export type LoginRequest = z.output<typeof loginRequestSchema>;

export const refreshRequestSchema = z.object({
  refreshToken: z
    .string({ error: 'Token de renovação ausente.' })
    .min(1, 'Token de renovação ausente.'),
});
export type RefreshRequest = z.output<typeof refreshRequestSchema>;

export const authTokensSchema = z.object({
  accessToken: z.string(),
  refreshToken: z
    .string()
    .describe('Usado uma única vez: cada renovação devolve um novo.'),
  expiresIn: z
    .number()
    .int()
    .describe('Validade do token de acesso, em segundos.'),
});
export type AuthTokens = z.infer<typeof authTokensSchema>;

export const meSchema = z.object({
  id: z.uuid(),
  name: nullable(z.string(), 'Nome, quando informado.'),
  email: nullable(
    z.string(),
    'E-mail verificado pelo provedor, quando houver.',
  ),
  role: z.enum(USER_ROLES),
  managedStations: z
    .array(z.object({ id: z.uuid(), name: z.string() }))
    .describe('Postos que a pessoa gerencia.'),
});
export type Me = z.infer<typeof meSchema>;

export const loginResponseSchema = authTokensSchema.extend({ user: meSchema });
export type LoginResponse = z.infer<typeof loginResponseSchema>;

export const addStationManagerSchema = z.object({
  userId: z.uuid({ error: 'Usuário inválido.' }),
});
export type AddStationManager = z.output<typeof addStationManagerSchema>;
