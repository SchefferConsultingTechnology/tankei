import { Module } from '@nestjs/common';
import { OrganizationsModule } from '../organizations/organizations.module';
import { PricesModule } from '../prices/prices.module';
import {
  AdminDashboardController,
  AdminNetworksController,
  AdminOfficialDivergencesController,
  AdminStationsController,
} from './admin.controller';
import { AdminService } from './admin.service';
import { DashboardService } from './dashboard.service';

/** Telas de suporte da equipe Tankei: postos e redes (ADR 0023). */
@Module({
  imports: [OrganizationsModule, PricesModule],
  controllers: [
    AdminStationsController,
    AdminNetworksController,
    AdminOfficialDivergencesController,
    AdminDashboardController,
  ],
  providers: [AdminService, DashboardService],
})
export class AdminModule {}
