import { Module } from '@nestjs/common';
import { OrganizationsModule } from '../organizations/organizations.module';
import {
  AdminStationInfoController,
  PortalStationInfoController,
} from './station-info.controller';
import { StationInfoService } from './station-info.service';

/** Horário de atendimento e serviços do posto (ADR 0033). */
@Module({
  imports: [OrganizationsModule],
  controllers: [PortalStationInfoController, AdminStationInfoController],
  providers: [StationInfoService],
  exports: [StationInfoService],
})
export class StationInfoModule {}
