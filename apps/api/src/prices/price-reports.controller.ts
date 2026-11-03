import {
  BadRequestException,
  Body,
  Controller,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  priceReportRequestSchema,
  priceReportResponseSchema,
  type PriceReportResponse,
} from '@tankei/shared';
import { createZodDto, ZodResponse } from 'nestjs-zod';
import { CurrentUser } from '../auth/decorators';
import type { AuthenticatedUser } from '../auth/tokens.service';
import { PriceReportsService } from './price-reports.service';

class PriceReportRequestDto extends createZodDto(priceReportRequestSchema) {}
class PriceReportResponseDto extends createZodDto(priceReportResponseSchema) {}

@ApiTags('Preços')
@ApiBearerAuth()
@Controller('stations/:stationId/prices')
export class PriceReportsController {
  constructor(private readonly reports: PriceReportsService) {}

  /**
   * Informa um preço. Respostas de erro com `code`:
   * 409 CONFIRMATION_REQUIRED (reenvie com confirmed: true) e
   * 422 PRICE_OUT_OF_RANGE (valor fora da faixa, registrado como rejeitado).
   */
  @Post()
  @ZodResponse({
    status: 201,
    type: PriceReportResponseDto,
    description:
      'Informe registrado. Com status "suspeito", só aparece no app depois de confirmado.',
  })
  report(
    @Param(
      'stationId',
      new ParseUUIDPipe({
        exceptionFactory: () => new BadRequestException('Posto inválido.'),
      }),
    )
    stationId: string,
    @Body() body: PriceReportRequestDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<PriceReportResponse> {
    return this.reports.report(user, stationId, body);
  }
}
