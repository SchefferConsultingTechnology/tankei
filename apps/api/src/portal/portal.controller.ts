import {
  BadRequestException,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  cityComparisonQuerySchema,
  cityComparisonSchema,
  competitionQuerySchema,
  priceHistoryQuerySchema,
  priceHistorySchema,
  stationCompetitionSchema,
  stationReputationSchema,
  type CityComparison,
  type PriceHistory,
  type StationCompetition,
  type StationReputation,
} from '@tankei/shared';
import { createZodDto, ZodResponse } from 'nestjs-zod';
import { CurrentUser } from '../auth/decorators';
import type { AuthenticatedUser } from '../auth/tokens.service';
import { PortalService } from './portal.service';

class StationCompetitionDto extends createZodDto(stationCompetitionSchema) {}
class StationReputationDto extends createZodDto(stationReputationSchema) {}
class CompetitionQueryDto extends createZodDto(competitionQuerySchema) {}
class PriceHistoryQueryDto extends createZodDto(priceHistoryQuerySchema) {}
class PriceHistoryDto extends createZodDto(priceHistorySchema) {}
class CityComparisonQueryDto extends createZodDto(cityComparisonQuerySchema) {}
class CityComparisonDto extends createZodDto(cityComparisonSchema) {}

const stationIdPipe = new ParseUUIDPipe({
  exceptionFactory: () => new BadRequestException('Posto inválido.'),
});

@ApiTags('Portal do posto')
@ApiBearerAuth()
@Controller('portal/stations/:stationId')
export class PortalController {
  constructor(private readonly portal: PortalService) {}

  @Get('competition')
  @ZodResponse({
    status: 200,
    type: StationCompetitionDto,
    description:
      'Concorrência local por combustível: postos no raio, posição na cidade e média da ANP no estado. Só para gestores do posto.',
  })
  async competition(
    @Param('stationId', stationIdPipe) stationId: string,
    @Query() query: CompetitionQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<StationCompetition> {
    await this.portal.assertManages(user, stationId);
    return this.portal.competition(stationId, query.radius);
  }

  @Get('price-history')
  @ZodResponse({
    status: 200,
    type: PriceHistoryDto,
    description:
      'Informes de preço do posto (posto e consumidores) no período, com a situação e qual está em vigor.',
  })
  async history(
    @Param('stationId', stationIdPipe) stationId: string,
    @Query() query: PriceHistoryQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<PriceHistory> {
    await this.portal.assertManages(user, stationId);
    return this.portal.history(stationId, query);
  }

  @Get('city-comparison')
  @ZodResponse({
    status: 200,
    type: CityComparisonDto,
    description:
      'Menor preço, média e mediana de outra cidade por combustível, e a posição que o posto teria lá.',
  })
  async cityComparison(
    @Param('stationId', stationIdPipe) stationId: string,
    @Query() query: CityComparisonQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<CityComparison> {
    await this.portal.assertManages(user, stationId);
    return this.portal.cityComparison(stationId, query.municipality);
  }

  @Get('reputation')
  @ZodResponse({
    status: 200,
    type: StationReputationDto,
    description:
      'IQP do posto por dimensão e a média dos postos da cidade. Só para gestores do posto.',
  })
  async reputation(
    @Param('stationId', stationIdPipe) stationId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<StationReputation> {
    await this.portal.assertManages(user, stationId);
    return this.portal.reputation(stationId);
  }
}
