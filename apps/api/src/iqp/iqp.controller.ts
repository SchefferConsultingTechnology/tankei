import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  reviewRequestSchema,
  reviewResponseSchema,
  stationIqpSchema,
  type ReviewResponse,
  type StationIqp,
} from '@tankei/shared';
import { createZodDto, ZodResponse } from 'nestjs-zod';
import { CurrentUser, Public } from '../auth/decorators';
import type { AuthenticatedUser } from '../auth/tokens.service';
import { IqpService } from './iqp.service';
import { ReviewsService } from './reviews.service';

class ReviewRequestDto extends createZodDto(reviewRequestSchema) {}
class ReviewResponseDto extends createZodDto(reviewResponseSchema) {}
class StationIqpDto extends createZodDto(stationIqpSchema) {}

const stationIdPipe = new ParseUUIDPipe({
  exceptionFactory: () => new BadRequestException('Posto inválido.'),
});

@ApiTags('Avaliações e IQP')
@Controller('stations/:stationId')
export class IqpController {
  constructor(
    private readonly iqp: IqpService,
    private readonly reviews: ReviewsService,
  ) {}

  @Public()
  @Get('iqp')
  @ZodResponse({
    status: 200,
    type: StationIqpDto,
    description:
      'IQP do posto com a nota de cada dimensão. Sem nota com "Dados insuficientes".',
  })
  detail(
    @Param('stationId', stationIdPipe) stationId: string,
  ): Promise<StationIqp> {
    return this.iqp.detail(stationId);
  }

  @ApiBearerAuth()
  @Post('reviews')
  @ZodResponse({ status: 201, type: ReviewResponseDto })
  review(
    @Param('stationId', stationIdPipe) stationId: string,
    @Body() body: ReviewRequestDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ReviewResponse> {
    return this.reviews.create(user, stationId, body);
  }
}
