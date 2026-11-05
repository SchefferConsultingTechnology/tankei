import {
  BadRequestException,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  stationCompetitionSchema,
  stationReputationSchema,
  type StationCompetition,
  type StationReputation,
} from '@tankei/shared';
import { createZodDto, ZodResponse } from 'nestjs-zod';
import { CurrentUser } from '../auth/decorators';
import type { AuthenticatedUser } from '../auth/tokens.service';
import { PortalService } from './portal.service';

class StationCompetitionDto extends createZodDto(stationCompetitionSchema) {}
class StationReputationDto extends createZodDto(stationReputationSchema) {}

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
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<StationCompetition> {
    await this.portal.assertManages(user, stationId);
    return this.portal.competition(stationId);
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
