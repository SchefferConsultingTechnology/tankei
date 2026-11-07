import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Put,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  stationInfoSchema,
  updateStationInfoSchema,
  type StationInfo,
} from '@tankei/shared';
import { createZodDto, ZodResponse } from 'nestjs-zod';
import { CurrentUser, Roles } from '../auth/decorators';
import type { AuthenticatedUser } from '../auth/tokens.service';
import { StationInfoService } from './station-info.service';

class StationInfoDto extends createZodDto(stationInfoSchema) {}
class UpdateStationInfoDto extends createZodDto(updateStationInfoSchema) {}

const stationIdPipe = new ParseUUIDPipe({
  exceptionFactory: () => new BadRequestException('Posto inválido.'),
});

/** Horário e serviços pelo portal do posto (ADR 0033). */
@ApiTags('Portal do posto')
@ApiBearerAuth()
@Controller('portal/stations/:stationId/info')
export class PortalStationInfoController {
  constructor(private readonly info: StationInfoService) {}

  @Get()
  @ZodResponse({ status: 200, type: StationInfoDto })
  get(
    @Param('stationId', stationIdPipe) stationId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<StationInfo> {
    return this.info.forPortal(user, stationId);
  }

  @Put()
  @ZodResponse({
    status: 200,
    type: StationInfoDto,
    description: 'Proprietário e gestor. Cria uma versão nova.',
  })
  update(
    @Param('stationId', stationIdPipe) stationId: string,
    @Body() body: UpdateStationInfoDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<StationInfo> {
    return this.info.updateFromPortal(user, stationId, body);
  }
}

/** Horário e serviços pela equipe Tankei (ADR 0033). */
@ApiTags('Administração')
@ApiBearerAuth()
@Roles('admin')
@Controller('admin/stations/:stationId/info')
export class AdminStationInfoController {
  constructor(private readonly info: StationInfoService) {}

  @Get()
  @ZodResponse({ status: 200, type: StationInfoDto })
  get(
    @Param('stationId', stationIdPipe) stationId: string,
  ): Promise<StationInfo> {
    return this.info.forAdmin(stationId);
  }

  @Put()
  @ZodResponse({ status: 200, type: StationInfoDto })
  update(
    @Param('stationId', stationIdPipe) stationId: string,
    @Body() body: UpdateStationInfoDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<StationInfo> {
    return this.info.updateFromAdmin(user.id, stationId, body);
  }
}
