import { Module } from '@nestjs/common';
import { AnpImportService } from './anp/anp-import.service';
import { AnpRevendedoresClient } from './anp/anp-revendedores.client';
import { StationsController } from './stations.controller';
import { StationsService } from './stations.service';

@Module({
  controllers: [StationsController],
  providers: [AnpRevendedoresClient, AnpImportService, StationsService],
  exports: [AnpImportService],
})
export class StationsModule {}
