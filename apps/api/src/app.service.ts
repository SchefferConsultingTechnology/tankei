import { Inject, Injectable } from '@nestjs/common';
import { IQP_METHODOLOGY_VERSION } from '@tankei/shared';
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
}
