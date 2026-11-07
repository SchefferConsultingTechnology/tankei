import { Module } from '@nestjs/common';
import { OrganizationsModule } from '../organizations/organizations.module';
import {
  AdminAgreementsController,
  PortalAgreementsController,
  StationAgreementsController,
} from './agreements.controller';
import { AgreementsService } from './agreements.service';

/** Convênios e descontos por posto (ADR 0034). */
@Module({
  imports: [OrganizationsModule],
  controllers: [
    PortalAgreementsController,
    StationAgreementsController,
    AdminAgreementsController,
  ],
  providers: [AgreementsService],
  exports: [AgreementsService],
})
export class AgreementsModule {}
