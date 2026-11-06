import { Module } from '@nestjs/common';
import { OrganizationsModule } from '../organizations/organizations.module';
import {
  AdminModerationController,
  StationModerationController,
} from './moderation.controller';
import { ModerationService } from './moderation.service';

/** Contestação pelo posto e fila de moderação (ADR 0020 e 0024). */
@Module({
  imports: [OrganizationsModule],
  controllers: [StationModerationController, AdminModerationController],
  providers: [ModerationService],
})
export class ModerationModule {}
