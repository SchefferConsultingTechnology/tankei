import { Controller, Delete, Get, HttpCode } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { meSchema, type Me } from '@tankei/shared';
import { createZodDto, ZodResponse } from 'nestjs-zod';
import { CurrentUser } from '../auth/decorators';
import type { AuthenticatedUser } from '../auth/tokens.service';
import { UsersService } from './users.service';

class MeDto extends createZodDto(meSchema) {}

@ApiTags('Conta')
@ApiBearerAuth()
@Controller('me')
export class MeController {
  constructor(private readonly users: UsersService) {}

  @Get()
  @ZodResponse({ status: 200, type: MeDto })
  me(@CurrentUser() user: AuthenticatedUser): Promise<Me> {
    return this.users.me(user.id);
  }

  /** Exclui a conta: apaga os dados pessoais e encerra as sessões (ADR 0009). */
  @Delete()
  @HttpCode(204)
  delete(@CurrentUser() user: AuthenticatedUser): Promise<void> {
    return this.users.deleteAccount(user.id);
  }
}
