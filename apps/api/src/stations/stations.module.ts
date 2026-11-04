import { Module } from '@nestjs/common';
import { IqpModule } from '../iqp/iqp.module';
import { MunicipalitiesModule } from '../municipalities/municipalities.module';
import { PricesModule } from '../prices/prices.module';
import { AnpImportService } from './anp/anp-import.service';
import { AnpRevendedoresClient } from './anp/anp-revendedores.client';
import { StationsController } from './stations.controller';
import { StationsService } from './stations.service';

@Module({
  imports: [PricesModule, IqpModule, MunicipalitiesModule],
  controllers: [StationsController],
  providers: [AnpRevendedoresClient, AnpImportService, StationsService],
  exports: [AnpImportService],
})
export class StationsModule {}
