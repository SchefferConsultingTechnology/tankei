import { Module } from '@nestjs/common';
import { OrganizationsModule } from '../organizations/organizations.module';
import {
  AdminChargingController,
  ChargingSuggestionsController,
  PortalChargingController,
} from './charging.controller';
import { ChargingService } from './charging.service';

/** Recarga elétrica no posto (ADR 0041). */
@Module({
  imports: [OrganizationsModule],
  controllers: [
    ChargingSuggestionsController,
    PortalChargingController,
    AdminChargingController,
  ],
  providers: [ChargingService],
  exports: [ChargingService],
})
export class ChargingModule {}
