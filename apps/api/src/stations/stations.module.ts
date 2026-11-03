import { Module } from '@nestjs/common';
import { AnpImportService } from './anp/anp-import.service';
import { AnpRevendedoresClient } from './anp/anp-revendedores.client';

@Module({
  providers: [AnpRevendedoresClient, AnpImportService],
  exports: [AnpImportService],
})
export class StationsModule {}
