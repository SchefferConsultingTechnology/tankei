import { Module } from '@nestjs/common';
import { AnpLpcClient } from './anp-reference/anp-lpc.client';
import { PriceReferenceImportService } from './anp-reference/price-reference-import.service';
import { PriceReferencesService } from './price-references.service';

@Module({
  providers: [
    AnpLpcClient,
    PriceReferenceImportService,
    PriceReferencesService,
  ],
  exports: [PriceReferenceImportService, PriceReferencesService],
})
export class PricesModule {}
