import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { addStationManagerSchema } from '@tankei/shared';
import { createZodDto } from 'nestjs-zod';
import { CurrentUser, Roles } from '../auth/decorators';
import type { AuthenticatedUser } from '../auth/tokens.service';
import { UsersService } from './users.service';

class AddStationManagerDto extends createZodDto(addStationManagerSchema) {}

const uuid = (message: string) =>
  new ParseUUIDPipe({
    exceptionFactory: () => new BadRequestException(message),
  });

/** Vínculo de gestores com postos, feito pelo administrador (ADR 0007). */
@ApiTags('Administração')
@ApiBearerAuth()
@Roles('admin')
@Controller('admin/stations/:stationId/managers')
export class StationManagersController {
  constructor(private readonly users: UsersService) {}

  @Post()
  @HttpCode(204)
  add(
    @Param('stationId', uuid('Posto inválido.')) stationId: string,
    @Body() body: AddStationManagerDto,
    @CurrentUser() admin: AuthenticatedUser,
  ): Promise<void> {
    return this.users.addStationManager(stationId, body.userId, admin.id);
  }

  @Delete(':userId')
  @HttpCode(204)
  remove(
    @Param('stationId', uuid('Posto inválido.')) stationId: string,
    @Param('userId', uuid('Usuário inválido.')) userId: string,
    @CurrentUser() admin: AuthenticatedUser,
  ): Promise<void> {
    return this.users.removeStationManager(stationId, userId, admin.id);
  }
}
