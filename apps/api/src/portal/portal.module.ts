import { Module } from '@nestjs/common';
import { IqpModule } from '../iqp/iqp.module';
import { PricesModule } from '../prices/prices.module';
import { StationsModule } from '../stations/stations.module';
import { OrganizationsModule } from '../organizations/organizations.module';
import {
  MyInvitationsController,
  NetworkController,
} from './network.controller';
import { NetworkService } from './network.service';
import { PortalController } from './portal.controller';
import { PortalService } from './portal.service';

@Module({
  imports: [StationsModule, PricesModule, IqpModule, OrganizationsModule],
  controllers: [PortalController, NetworkController, MyInvitationsController],
  providers: [PortalService, NetworkService],
})
export class PortalModule {}
