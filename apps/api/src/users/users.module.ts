import { Module } from '@nestjs/common';
import { MeController } from './me.controller';
import { StationManagersController } from './station-managers.controller';
import { UsersService } from './users.service';

@Module({
  controllers: [MeController, StationManagersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
