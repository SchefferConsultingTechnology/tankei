import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { UserRole } from '@tankei/shared';
import {
  IS_PUBLIC,
  REQUIRED_ROLES,
  type AuthenticatedRequest,
} from './decorators';
import { TokensService } from './tokens.service';

/**
 * Guard global: toda rota exige token de acesso, exceto as marcadas com
 * @Public(). Com @Roles(), exige também o perfil.
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly tokens: TokensService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const targets = [context.getHandler(), context.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, targets)) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const [scheme, token] = (request.headers.authorization ?? '').split(' ');
    if (scheme !== 'Bearer' || !token) {
      throw new UnauthorizedException('Faça login para continuar.');
    }
    request.user = this.tokens.verifyAccessToken(token);

    const roles = this.reflector.getAllAndOverride<UserRole[] | undefined>(
      REQUIRED_ROLES,
      targets,
    );
    if (roles && !roles.includes(request.user.role)) {
      throw new ForbiddenException('Você não tem permissão para esta ação.');
    }
    return true;
  }
}
