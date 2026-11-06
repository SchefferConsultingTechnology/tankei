import { Module } from '@nestjs/common';
import { OrganizationsModule } from '../organizations/organizations.module';
import {
  AdminNetworksController,
  AdminStationsController,
} from './admin.controller';
import { AdminService } from './admin.service';

/** Telas de suporte da equipe Tankei: postos e redes (ADR 0023). */
@Module({
  imports: [OrganizationsModule],
  controllers: [AdminStationsController, AdminNetworksController],
  providers: [AdminService],
})
export class AdminModule {}
