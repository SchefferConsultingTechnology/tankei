import { Module } from '@nestjs/common';
import { OrganizationsModule } from '../organizations/organizations.module';
import { AdminClaimsController, ClaimsController } from './claims.controller';
import { ClaimsService } from './claims.service';

@Module({
  imports: [OrganizationsModule],
  controllers: [ClaimsController, AdminClaimsController],
  providers: [ClaimsService],
})
export class ClaimsModule {}
