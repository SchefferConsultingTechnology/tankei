import { Module } from '@nestjs/common';
import { AdminClaimsController, ClaimsController } from './claims.controller';
import { ClaimsService } from './claims.service';

@Module({
  controllers: [ClaimsController, AdminClaimsController],
  providers: [ClaimsService],
})
export class ClaimsModule {}
