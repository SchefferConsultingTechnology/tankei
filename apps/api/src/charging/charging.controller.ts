import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  chargingAdminSchema,
  dismissChargerSuggestionsSchema,
  setChargersSchema,
  suggestChargerResultSchema,
  suggestChargerSchema,
  type ChargingAdmin,
  type SuggestChargerResult,
} from '@tankei/shared';
import { createZodDto, ZodResponse } from 'nestjs-zod';
import { CurrentUser, Roles } from '../auth/decorators';
import type { AuthenticatedUser } from '../auth/tokens.service';
import { ChargingService } from './charging.service';

class ChargingAdminDto extends createZodDto(chargingAdminSchema) {}
class SetChargersDto extends createZodDto(setChargersSchema) {}
class SuggestChargerDto extends createZodDto(suggestChargerSchema) {}
class SuggestChargerResultDto extends createZodDto(
  suggestChargerResultSchema,
) {}
class DismissDto extends createZodDto(dismissChargerSuggestionsSchema) {}

const stationIdPipe = new ParseUUIDPipe({
  exceptionFactory: () => new BadRequestException('Posto inválido.'),
});

/** "Este posto tem recarga", pelo consumidor no app (ADR 0041). */
@ApiTags('Recarga elétrica')
@ApiBearerAuth()
@Controller('stations/:stationId/charging/suggestions')
export class ChargingSuggestionsController {
  constructor(private readonly charging: ChargingService) {}

  @Post()
  @ZodResponse({
    status: 201,
    type: SuggestChargerResultDto,
    description:
      'Registra a sugestão. O ponto aparece no app depois de charger.min_confirmations pessoas. 409 se o posto já cadastrou.',
  })
  suggest(
    @Param('stationId', stationIdPipe) stationId: string,
    @Body() body: SuggestChargerDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<SuggestChargerResult> {
    return this.charging.suggest(user, stationId, body);
  }
}

@ApiTags('Portal do posto')
@ApiBearerAuth()
@Controller('portal/stations/:stationId/charging')
export class PortalChargingController {
  constructor(private readonly charging: ChargingService) {}

  @Get()
  @ZodResponse({ status: 200, type: ChargingAdminDto })
  get(
    @Param('stationId', stationIdPipe) stationId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ChargingAdmin> {
    return this.charging.forPortal(user, stationId);
  }

  @Put()
  @ZodResponse({
    status: 200,
    type: ChargingAdminDto,
    description:
      'Proprietário e gestor. Cria uma versão nova; lista vazia = sem recarga.',
  })
  set(
    @Param('stationId', stationIdPipe) stationId: string,
    @Body() body: SetChargersDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ChargingAdmin> {
    return this.charging.setFromPortal(user, stationId, body);
  }
}

@ApiTags('Administração')
@ApiBearerAuth()
@Roles('admin')
@Controller('admin/stations/:stationId/charging')
export class AdminChargingController {
  constructor(private readonly charging: ChargingService) {}

  @Get()
  @ZodResponse({ status: 200, type: ChargingAdminDto })
  get(
    @Param('stationId', stationIdPipe) stationId: string,
  ): Promise<ChargingAdmin> {
    return this.charging.admin(stationId);
  }

  @Put()
  @ZodResponse({ status: 200, type: ChargingAdminDto })
  set(
    @Param('stationId', stationIdPipe) stationId: string,
    @Body() body: SetChargersDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ChargingAdmin> {
    return this.charging.setFromAdmin(user, stationId, body);
  }

  @Post('dismiss')
  @ZodResponse({
    status: 201,
    type: ChargingAdminDto,
    description:
      'Descarta as sugestões de consumidores de um tipo (AC ou DC), com motivo.',
  })
  dismiss(
    @Param('stationId', stationIdPipe) stationId: string,
    @Body() body: DismissDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ChargingAdmin> {
    return this.charging.dismiss(user, stationId, body);
  }
}
