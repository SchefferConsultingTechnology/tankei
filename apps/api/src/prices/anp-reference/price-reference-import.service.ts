import { Inject, Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { DRIZZLE, type Database } from '../../database/database.module';
import { priceReferences } from '../../database/schema';
import { AnpLpcClient } from './anp-lpc.client';
import { parseResumoEstados } from './resumo-parser';

export interface PriceReferenceImportResult {
  semanasImportadas: string[];
  /** Semana mais recente que já estava no banco, onde a importação parou. */
  paradaEm: string | null;
}

/** Semanas buscadas quando o banco ainda não tem nenhuma referência. */
const MAX_WEEKS_PER_RUN = 8;

/**
 * Importa os resumos semanais da ANP (ADR 0006). Percorre da semana mais
 * recente para a mais antiga e para na primeira que já estiver no banco.
 */
@Injectable()
export class PriceReferenceImportService {
  private readonly logger = new Logger(PriceReferenceImportService.name);

  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly anp: AnpLpcClient,
  ) {}

  // Diariamente: a ANP publica uma vez por semana, mas sem dia fixo.
  @Cron(process.env.ANP_REFERENCE_CRON ?? '0 9 * * *', {
    name: 'anp-price-references',
    timeZone: 'America/Sao_Paulo',
  })
  async importarAgendado(): Promise<void> {
    try {
      await this.importar();
    } catch (error) {
      this.logger.error('Falha ao importar referências da ANP', error);
    }
  }

  async importar(
    maxWeeks = MAX_WEEKS_PER_RUN,
  ): Promise<PriceReferenceImportResult> {
    const links = await this.anp.listarResumos();
    const result: PriceReferenceImportResult = {
      semanasImportadas: [],
      paradaEm: null,
    };

    for (const url of links.slice(0, maxWeeks)) {
      const references = parseResumoEstados(await this.anp.baixarEstados(url));
      const inserted = await this.db
        .insert(priceReferences)
        .values(references.map((r) => ({ ...r, sourceUrl: url })))
        .onConflictDoNothing()
        .returning({ id: priceReferences.id });

      const week = references[0].weekStart;
      if (inserted.length === 0) {
        result.paradaEm = week;
        break;
      }
      result.semanasImportadas.push(week);
    }

    this.logger.log(
      `Referências da ANP: ${result.semanasImportadas.length} semana(s) importada(s)` +
        (result.paradaEm ? `, já existia a de ${result.paradaEm}` : ''),
    );
    return result;
  }
}
