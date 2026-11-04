import { Inject, Injectable } from '@nestjs/common';
import type { FuelType } from '@tankei/shared';
import { and, desc, eq } from 'drizzle-orm';
import { DRIZZLE, type Database } from '../database/database.module';
import { priceReferences } from '../database/schema';

/** A ANP não pesquisa gasolina premium: usa a aditivada como referência (ADR 0006). */
const REFERENCE_FUEL: Partial<Record<FuelType, FuelType>> = {
  gasolina_premium: 'gasolina_aditivada',
};

export interface PriceReference {
  id: string;
  weekStart: string;
  state: string;
  /** Combustível cuja média foi usada (pode diferir do pedido, como na premium). */
  fuelType: FuelType;
  averagePrice: number;
}

@Injectable()
export class PriceReferencesService {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  /**
   * Referência mais recente para o combustível na UF do posto (ADR 0013).
   * Nula se ainda não houver referência importada para a UF.
   */
  async latest(
    fuelType: FuelType,
    state: string,
  ): Promise<PriceReference | null> {
    const referenceFuel = REFERENCE_FUEL[fuelType] ?? fuelType;

    const [row] = await this.db
      .select({
        id: priceReferences.id,
        weekStart: priceReferences.weekStart,
        state: priceReferences.state,
        fuelType: priceReferences.fuelType,
        averagePrice: priceReferences.averagePrice,
      })
      .from(priceReferences)
      .where(
        and(
          eq(priceReferences.state, state),
          eq(priceReferences.fuelType, referenceFuel),
        ),
      )
      .orderBy(desc(priceReferences.weekStart))
      .limit(1);

    return row ?? null;
  }
}
