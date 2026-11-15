import { Module } from '@nestjs/common';
import { IqpModule } from '../iqp/iqp.module';
import { ShowcaseModule } from '../showcase/showcase.module';
import { StationsModule } from '../stations/stations.module';
import { SitePagesController, StationSiteController } from './sites.controller';
import { SitesService } from './sites.service';

/** Site do posto (spec 0004, ADR 0042). */
@Module({
  imports: [StationsModule, IqpModule, ShowcaseModule],
  controllers: [SitePagesController, StationSiteController],
  providers: [SitesService],
})
export class SitesModule {}
