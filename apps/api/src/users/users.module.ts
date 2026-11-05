import { Module } from '@nestjs/common';
import { OrganizationsModule } from '../organizations/organizations.module';
import { MeController } from './me.controller';
import { StationManagersController } from './station-managers.controller';
import { UsersService } from './users.service';

@Module({
  imports: [OrganizationsModule],
  controllers: [MeController, StationManagersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
