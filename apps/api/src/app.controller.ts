import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';
import type { HealthStatus } from './app.service';
import { Public } from './auth/decorators';

@Public()
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get('health')
  getHealth(): Promise<HealthStatus> {
    return this.appService.getHealth();
  }
}
