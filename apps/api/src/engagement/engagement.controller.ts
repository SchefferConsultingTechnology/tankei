import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  contributionSchema,
  createPriceAlertSchema,
  priceAlertSchema,
  stationSchema,
  type Contribution,
  type PriceAlert,
  type Station,
} from '@tankei/shared';
import { createZodDto, ZodResponse } from 'nestjs-zod';
import { CurrentUser } from '../auth/decorators';
import type { AuthenticatedUser } from '../auth/tokens.service';
import { EngagementService } from './engagement.service';

class StationDto extends createZodDto(stationSchema) {}
class PriceAlertDto extends createZodDto(priceAlertSchema) {}
class CreatePriceAlertDto extends createZodDto(createPriceAlertSchema) {}
class ContributionDto extends createZodDto(contributionSchema) {}

const uuid = (message: string) =>
  new ParseUUIDPipe({
    exceptionFactory: () => new BadRequestException(message),
  });

/** Favoritos, alertas de preço e contribuição da pessoa (ADR 0029). */
@ApiTags('Conta')
@ApiBearerAuth()
@Controller('me')
export class EngagementController {
  constructor(private readonly engagement: EngagementService) {}

  @Get('favorites')
  @ZodResponse({
    status: 200,
    type: [StationDto],
    description: 'Postos favoritos, os mais recentes primeiro.',
  })
  favorites(@CurrentUser() user: AuthenticatedUser): Promise<Station[]> {
    return this.engagement.favorites(user.id);
  }

  @Put('favorites/:stationId')
  @HttpCode(204)
  async addFavorite(
    @Param('stationId', uuid('Posto inválido.')) stationId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<void> {
    await this.engagement.addFavorite(user.id, stationId);
  }

  @Delete('favorites/:stationId')
  @HttpCode(204)
  async removeFavorite(
    @Param('stationId', uuid('Posto inválido.')) stationId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<void> {
    await this.engagement.removeFavorite(user.id, stationId);
  }

  @Get('alerts')
  @ZodResponse({ status: 200, type: [PriceAlertDto] })
  alerts(@CurrentUser() user: AuthenticatedUser): Promise<PriceAlert[]> {
    return this.engagement.alerts(user.id);
  }

  @Post('alerts')
  @ZodResponse({
    status: 201,
    type: PriceAlertDto,
    description:
      'Avisa por e-mail quando o preço exibido ficar igual ou abaixo do valor.',
  })
  createAlert(
    @Body() body: CreatePriceAlertDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<PriceAlert> {
    return this.engagement.createAlert(user.id, body);
  }

  @Delete('alerts/:alertId')
  @HttpCode(204)
  async removeAlert(
    @Param('alertId', uuid('Alerta inválido.')) alertId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<void> {
    await this.engagement.removeAlert(user.id, alertId);
  }

  @Get('contribution')
  @ZodResponse({
    status: 200,
    type: ContributionDto,
    description: 'Selo e números de quem informa preços (só a própria pessoa).',
  })
  contribution(@CurrentUser() user: AuthenticatedUser): Promise<Contribution> {
    return this.engagement.contribution(user.id);
  }
}
