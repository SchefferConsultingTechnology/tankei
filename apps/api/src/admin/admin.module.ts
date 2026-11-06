import { Module } from '@nestjs/common';
import { OrganizationsModule } from '../organizations/organizations.module';
import { PricesModule } from '../prices/prices.module';
import {
  AdminNetworksController,
  AdminOfficialDivergencesController,
  AdminStationsController,
} from './admin.controller';
import { AdminService } from './admin.service';

/** Telas de suporte da equipe Tankei: postos e redes (ADR 0023). */
@Module({
  imports: [OrganizationsModule, PricesModule],
  controllers: [
    AdminStationsController,
    AdminNetworksController,
    AdminOfficialDivergencesController,
  ],
  providers: [AdminService],
})
export class AdminModule {}
