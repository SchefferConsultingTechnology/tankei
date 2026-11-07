import { Controller, Get } from '@nestjs/common';
import { appConfigSchema, type AppConfig } from '@tankei/shared';
import { createZodDto, ZodResponse } from 'nestjs-zod';
import { AppService } from './app.service';
import type { HealthStatus } from './app.service';
import { Public } from './auth/decorators';

class AppConfigDto extends createZodDto(appConfigSchema) {}

@Public()
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get('health')
  getHealth(): Promise<HealthStatus> {
    return this.appService.getHealth();
  }

  @Get('config')
  @ZodResponse({
    status: 200,
    type: AppConfigDto,
    description: 'Configuração pública para o app (ADR 0031).',
  })
  getConfig(): AppConfig {
    return this.appService.getConfig();
  }
}
