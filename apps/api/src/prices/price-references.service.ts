import { Inject, Injectable } from '@nestjs/common';
import type { FuelType } from '@tankei/shared';
import { and, desc, eq } from 'drizzle-orm';
import { DRIZZLE, type Database } from '../database/database.module';
import { priceReferences } from '../database/schema';
import { ParametersService } from '../parameters/parameters.service';

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
  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly parameters: ParametersService,
  ) {}

  /**
   * Referência mais recente para o combustível, na UF configurada em
   * `price.reference_state`. Nula se ainda não houver referência importada.
   */
  async latest(fuelType: FuelType): Promise<PriceReference | null> {
    const state = await this.parameters.get('price.reference_state');
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
