import { Module } from '@nestjs/common';
import { IqpModule } from '../iqp/iqp.module';
import { PricesModule } from '../prices/prices.module';
import { StationsModule } from '../stations/stations.module';
import { UsersModule } from '../users/users.module';
import { PortalController } from './portal.controller';
import { PortalService } from './portal.service';

@Module({
  imports: [StationsModule, PricesModule, IqpModule, UsersModule],
  controllers: [PortalController],
  providers: [PortalService],
})
export class PortalModule {}
