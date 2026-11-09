import { Module } from '@nestjs/common';
import { OrganizationsModule } from '../organizations/organizations.module';
import {
  AdminFeaturesController,
  PortalVisitsController,
  TelemetryController,
} from './visits.controller';
import { VisitsService } from './visits.service';

/** Visitas dos motoristas ao posto e recursos do plano (spec 0003, ADR 0039). */
@Module({
  imports: [OrganizationsModule],
  controllers: [
    TelemetryController,
    PortalVisitsController,
    AdminFeaturesController,
  ],
  providers: [VisitsService],
  exports: [VisitsService],
})
export class VisitsModule {}
