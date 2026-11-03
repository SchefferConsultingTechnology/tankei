import { Module } from '@nestjs/common';
import { UsersModule } from '../users/users.module';
import { IqpController } from './iqp.controller';
import { IqpService } from './iqp.service';
import { ReviewsService } from './reviews.service';

@Module({
  imports: [UsersModule],
  controllers: [IqpController],
  providers: [IqpService, ReviewsService],
  exports: [IqpService],
})
export class IqpModule {}
