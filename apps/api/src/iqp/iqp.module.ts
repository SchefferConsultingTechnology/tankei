import { Module } from '@nestjs/common';
import { OrganizationsModule } from '../organizations/organizations.module';
import { IqpController } from './iqp.controller';
import { IqpService } from './iqp.service';
import { ReviewsService } from './reviews.service';

@Module({
  imports: [OrganizationsModule],
  controllers: [IqpController],
  providers: [IqpService, ReviewsService],
  exports: [IqpService],
})
export class IqpModule {}
