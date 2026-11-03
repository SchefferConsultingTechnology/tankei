import {
  createParamDecorator,
  ExecutionContext,
  SetMetadata,
} from '@nestjs/common';
import type { UserRole } from '@tankei/shared';
import type { Request } from 'express';
import type { AuthenticatedUser } from './tokens.service';

export const IS_PUBLIC = 'isPublic';
export const REQUIRED_ROLES = 'requiredRoles';

/** Rota aberta, sem login. Todas as outras exigem token de acesso. */
export const Public = () => SetMetadata(IS_PUBLIC, true);

/** Exige um dos perfis informados. */
export const Roles = (...roles: UserRole[]) =>
  SetMetadata(REQUIRED_ROLES, roles);

export type AuthenticatedRequest = Request & { user: AuthenticatedUser };

/** Usuário autenticado da requisição. */
export const CurrentUser = createParamDecorator(
  (_: unknown, context: ExecutionContext): AuthenticatedUser =>
    context.switchToHttp().getRequest<AuthenticatedRequest>().user,
);
