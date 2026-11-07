import { Inject, Injectable } from '@nestjs/common';
import { IQP_METHODOLOGY_VERSION, type AppConfig } from '@tankei/shared';
import { sql } from 'drizzle-orm';
import { DRIZZLE, type Database } from './database/database.module';

export interface HealthStatus {
  status: 'ok' | 'degradado';
  service: 'tankei-api';
  database: 'ok' | 'indisponivel';
  iqpMethodology: string;
}

@Injectable()
export class AppService {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

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
  getConfig(): AppConfig {
    const digits = (process.env.SUPPORT_WHATSAPP ?? '').replace(/\D/g, '');
    return {
      supportWhatsapp: /^\d{12,13}$/.test(digits) ? digits : null,
      portalUrl: (process.env.PORTAL_URL || 'http://localhost:5173').replace(
        /\/$/,
        '',
      ),
    };
  }
}
