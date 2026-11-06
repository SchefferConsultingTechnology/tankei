import { Module } from '@nestjs/common';
import { OrganizationsModule } from '../organizations/organizations.module';
import { PricesModule } from '../prices/prices.module';
import { ImageService } from './image.service';
import {
  AdminMediaController,
  PublicShowcaseController,
  StationShowcaseController,
} from './showcase.controller';
import { ShowcaseService } from './showcase.service';
import { StorageService } from './storage.service';

/** Fotos e promoções do posto (ADR 0026). */
@Module({
  imports: [OrganizationsModule, PricesModule],
  controllers: [
    StationShowcaseController,
    PublicShowcaseController,
    AdminMediaController,
  ],
  providers: [ShowcaseService, StorageService, ImageService],
  exports: [StorageService],
})
export class ShowcaseModule {}
