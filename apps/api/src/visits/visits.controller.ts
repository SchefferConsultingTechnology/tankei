import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  setStationFeatureSchema,
  STATION_FEATURES,
  stationFeaturesSchema,
  stationVisitsQuerySchema,
  stationVisitsSchema,
  visitBatchResultSchema,
  visitBatchSchema,
  type StationFeature,
  type StationFeatures,
  type StationVisits,
  type VisitBatchResult,
} from '@tankei/shared';
import { createZodDto, ZodResponse } from 'nestjs-zod';
import { CurrentUser, Public, Roles } from '../auth/decorators';
import type { AuthenticatedUser } from '../auth/tokens.service';
import { VisitsService } from './visits.service';

class VisitBatchDto extends createZodDto(visitBatchSchema) {}
class VisitBatchResultDto extends createZodDto(visitBatchResultSchema) {}
class StationVisitsQueryDto extends createZodDto(stationVisitsQuerySchema) {}
class StationVisitsDto extends createZodDto(stationVisitsSchema) {}
class StationFeaturesDto extends createZodDto(stationFeaturesSchema) {}
class SetStationFeatureDto extends createZodDto(setStationFeatureSchema) {}

const stationIdPipe = new ParseUUIDPipe({
  exceptionFactory: () => new BadRequestException('Posto inválido.'),
});

function parseFeature(value: string): StationFeature {
  if (!(STATION_FEATURES as readonly string[]).includes(value)) {
    throw new BadRequestException('Recurso inválido.');
  }
  return value as StationFeature;
}

/** Envio das visitas pelo app (spec 0003). Aberta: quem não entrou também visita. */
@ApiTags('Visitas')
@Public()
@Controller('telemetry/visits')
export class TelemetryController {
  constructor(private readonly visits: VisitsService) {}

  @Post()
  @HttpCode(200)
  @ZodResponse({
    status: 200,
    type: VisitBatchResultDto,
    description:
      'Grava até 50 visitas fechadas. Anônimas: sem conta e sem localização. Reenvio pelo mesmo id não duplica.',
  })
  async ingest(@Body() body: VisitBatchDto): Promise<VisitBatchResult> {
    return { accepted: await this.visits.ingest(body) };
  }
}

@ApiTags('Portal do posto')
@ApiBearerAuth()
@Controller('portal/stations/:stationId')
export class PortalVisitsController {
  constructor(private readonly visits: VisitsService) {}

  @Get('visits')
  @ZodResponse({
    status: 200,
    type: StationVisitsDto,
    description:
      'Visitas ao posto no app, só em totais (contagens abaixo do mínimo voltam nulas). Exige o recurso "visitas" (403 FEATURE_LOCKED).',
  })
  stats(
    @Param('stationId', stationIdPipe) stationId: string,
    @Query() query: StationVisitsQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<StationVisits> {
    return this.visits.forPortal(user, stationId, query);
  }

  @Get('features')
  @ZodResponse({
    status: 200,
    type: StationFeaturesDto,
    description: 'Recursos do plano liberados para o posto.',
  })
  features(
    @Param('stationId', stationIdPipe) stationId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<StationFeatures> {
    return this.visits.featuresForPortal(user, stationId);
  }
}

/** Liberação de recursos pela equipe, até a assinatura existir. */
@ApiTags('Administração')
@ApiBearerAuth()
@Roles('admin')
@Controller('admin/stations/:stationId/features')
export class AdminFeaturesController {
  constructor(private readonly visits: VisitsService) {}

  @Get()
  @ZodResponse({ status: 200, type: StationFeaturesDto })
  list(
    @Param('stationId', stationIdPipe) stationId: string,
  ): Promise<StationFeatures> {
    return this.visits.features(stationId);
  }

  @Put(':feature')
  @ZodResponse({
    status: 200,
    type: StationFeaturesDto,
    description: 'Liga ou desliga um recurso do posto (fica registrado).',
  })
  set(
    @Param('stationId', stationIdPipe) stationId: string,
    @Param('feature') feature: string,
    @Body() body: SetStationFeatureDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<StationFeatures> {
    return this.visits.setFeature(user, stationId, parseFeature(feature), body);
  }
}
