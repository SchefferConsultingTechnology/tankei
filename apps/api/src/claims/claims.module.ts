import { Module } from '@nestjs/common';
import { OrganizationsModule } from '../organizations/organizations.module';
import {
  AdminClaimsController,
  ClaimsController,
  StationClaimsController,
} from './claims.controller';
import { ClaimsService } from './claims.service';

@Module({
  imports: [OrganizationsModule],
  controllers: [
    ClaimsController,
    AdminClaimsController,
    StationClaimsController,
  ],
  providers: [ClaimsService],
})
export class ClaimsModule {}
