import { Module } from '@nestjs/common';
import { UsersModule } from '../users/users.module';
import { AnpLpcClient } from './anp-reference/anp-lpc.client';
import { PriceReferenceImportService } from './anp-reference/price-reference-import.service';
import { PriceReferencesService } from './price-references.service';
import { PriceReportsController } from './price-reports.controller';
import { PriceReportsService } from './price-reports.service';

@Module({
  imports: [UsersModule],
  controllers: [PriceReportsController],
  providers: [
    AnpLpcClient,
    PriceReferenceImportService,
    PriceReferencesService,
    PriceReportsService,
  ],
  exports: [
    PriceReferenceImportService,
    PriceReferencesService,
    PriceReportsService,
  ],
})
export class PricesModule {}
