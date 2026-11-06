import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  adminModerationCaseSchema,
  createContestSchema,
  decideModerationSchema,
  moderationQuerySchema,
  stationModerationCaseSchema,
  type AdminModerationCase,
  type StationModerationCase,
} from '@tankei/shared';
import { createZodDto, ZodResponse } from 'nestjs-zod';
import { CurrentUser, Roles } from '../auth/decorators';
import type { AuthenticatedUser } from '../auth/tokens.service';
import { ModerationService } from './moderation.service';

class CreateContestDto extends createZodDto(createContestSchema) {}
class StationModerationCaseDto extends createZodDto(
  stationModerationCaseSchema,
) {}
class AdminModerationCaseDto extends createZodDto(adminModerationCaseSchema) {}
class ModerationQueryDto extends createZodDto(moderationQuerySchema) {}
class DecideModerationDto extends createZodDto(decideModerationSchema) {}

const uuid = (message: string) =>
  new ParseUUIDPipe({
    exceptionFactory: () => new BadRequestException(message),
  });

/** Contestação de informes pelo posto (ADR 0020). */
@ApiTags('Portal do posto')
@ApiBearerAuth()
@Controller('portal/stations/:stationId/moderation')
export class StationModerationController {
  constructor(private readonly moderation: ModerationService) {}

  @Get()
  @ZodResponse({
    status: 200,
    type: [StationModerationCaseDto],
    description: 'Contestações e rajadas do posto nos últimos 90 dias.',
  })
  list(
    @Param('stationId', uuid('Posto inválido.')) stationId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<StationModerationCase[]> {
    return this.moderation.stationCases(user, stationId);
  }

  @Post('contests')
  @ZodResponse({
    status: 201,
    type: StationModerationCaseDto,
    description:
      'Contesta informes de consumidores: saem do preço exibido até a equipe Tankei decidir.',
  })
  contest(
    @Param('stationId', uuid('Posto inválido.')) stationId: string,
    @Body() body: CreateContestDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<StationModerationCase> {
    return this.moderation.contest(user, stationId, body);
  }
}

/** Fila de moderação da equipe Tankei (ADR 0020 e 0024). */
@ApiTags('Administração')
@ApiBearerAuth()
@Roles('admin')
@Controller('admin/moderation')
export class AdminModerationController {
  constructor(private readonly moderation: ModerationService) {}

  @Get()
  @ZodResponse({
    status: 200,
    type: [AdminModerationCaseDto],
    description: 'Casos por situação; em análise, os mais antigos primeiro.',
  })
  list(@Query() query: ModerationQueryDto): Promise<AdminModerationCase[]> {
    return this.moderation.adminList(query);
  }

  @Post(':caseId/decide')
  @HttpCode(200)
  @ZodResponse({
    status: 200,
    type: AdminModerationCaseDto,
    description:
      'Mantém (os informes voltam a contar) ou anula (deixam de contar de vez).',
  })
  decide(
    @Param('caseId', uuid('Caso inválido.')) caseId: string,
    @Body() body: DecideModerationDto,
    @CurrentUser() admin: AuthenticatedUser,
  ): Promise<AdminModerationCase> {
    return this.moderation.decide(caseId, admin, body);
  }
}
