import { Module } from '@nestjs/common';
import { PricesModule } from '../prices/prices.module';
import { StationsModule } from '../stations/stations.module';
import { EngagementController } from './engagement.controller';
import { EngagementService } from './engagement.service';

/** Favoritos, alertas de preço e contribuição (ADR 0029). */
@Module({
  imports: [PricesModule, StationsModule],
  controllers: [EngagementController],
  providers: [EngagementService],
})
export class EngagementModule {}
