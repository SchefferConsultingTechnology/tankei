import { Inject, Injectable } from '@nestjs/common';
import { IQP_METHODOLOGY_VERSION, type AppConfig } from '@tankei/shared';
import { sql } from 'drizzle-orm';
import { DRIZZLE, type Database } from './database/database.module';
import { ParametersService } from './parameters/parameters.service';

export interface HealthStatus {
  status: 'ok' | 'degradado';
  service: 'tankei-api';
  database: 'ok' | 'indisponivel';
  iqpMethodology: string;
}

@Injectable()
export class AppService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly parameters: ParametersService,
  ) {}

  async getHealth(): Promise<HealthStatus> {
    const databaseOk = await this.db
      .execute(sql`select 1`)
      .then(() => true)
      .catch(() => false);

    return {
      status: databaseOk ? 'ok' : 'degradado',
      service: 'tankei-api',
      database: databaseOk ? 'ok' : 'indisponivel',
      iqpMethodology: IQP_METHODOLOGY_VERSION,
    };
  }

  /**
   * WhatsApp da equipe e endereço do portal (ADR 0031). Vêm do ambiente: não
   * são regras de negócio e mudam sem nova versão do app.
   */
  async getConfig(): Promise<AppConfig> {
    const digits = (process.env.SUPPORT_WHATSAPP ?? '').replace(/\D/g, '');
    return {
      supportWhatsapp: /^\d{12,13}$/.test(digits) ? digits : null,
      portalUrl: (process.env.PORTAL_URL || 'http://localhost:5173').replace(
        /\/$/,
        '',
      ),
      mapCardCloseSeconds: await this.parameters.get(
        'app.map_card_close_seconds',
      ),
      visitsFlushSeconds: await this.parameters.get('analytics.flush_seconds'),
      visitsMaxDetailSeconds: await this.parameters.get(
        'analytics.max_detail_seconds',
      ),
      visitsMaxQueueDays: await this.parameters.get('analytics.max_queue_days'),
    };
  }
}
