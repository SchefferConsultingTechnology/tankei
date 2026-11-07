import {
  ForbiddenException,
  HttpException,
  Inject,
  Injectable,
} from '@nestjs/common';
import {
  FUEL_TYPES,
  roleCan,
  type BulkPrice,
  type BulkPriceResult,
  type OrganizationOverview,
} from '@tankei/shared';
import { eq, inArray } from 'drizzle-orm';
import type { AuthenticatedUser } from '../auth/tokens.service';
import { DRIZZLE, type Database } from '../database/database.module';
import {
  municipalities,
  organizations,
  stationFuels,
  stations,
} from '../database/schema';
import { AccessService } from '../organizations/access.service';
import { OrganizationsService } from '../organizations/organizations.service';
import { PriceReportsService } from '../prices/price-reports.service';
import { cityDisplayName, stationDisplayName } from '../stations/display-name';

/** Visão da rede e ações em várias unidades (ADR 0021). */
@Injectable()
export class NetworkService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly access: AccessService,
    private readonly organizations: OrganizationsService,
    private readonly priceReports: PriceReportsService,
  ) {}

  /** Preço vigente de cada unidade do escopo da pessoa, por combustível. */
  async overview(
    user: AuthenticatedUser,
    organizationId: string,
  ): Promise<OrganizationOverview> {
    const role = await this.organizations.memberRole(user.id, organizationId);
    const visible = (await this.access.stationsOf(user.id)).filter(
      (s) => s.organizationId === organizationId,
    );
    const ids = visible.map((s) => s.stationId);
    const [organization] = await this.db
      .select({ name: organizations.name })
      .from(organizations)
      .where(eq(organizations.id, organizationId));
    if (ids.length === 0) {
      return {
        id: organizationId,
        name: organization.name,
        role,
        fuels: [],
        stations: [],
      };
    }

    const [rows, fuels, prices] = await Promise.all([
      this.db
        .select({
          id: stations.id,
          tradeName: stations.tradeName,
          displayName: stations.displayName,
          legalName: stations.legalName,
          city: stations.city,
          municipalityName: municipalities.name,
          state: stations.state,
        })
        .from(stations)
        .leftJoin(
          municipalities,
          eq(municipalities.code, stations.municipalityCode),
        )
        .where(inArray(stations.id, ids)),
      this.db
        .select()
        .from(stationFuels)
        .where(inArray(stationFuels.stationId, ids)),
      this.priceReports.currentPrices(ids),
    ]);

    const units = rows
      .map((row) => ({
        id: row.id,
        name: stationDisplayName(row.tradeName, row.legalName, row.displayName),
        city: row.municipalityName ?? cityDisplayName(row.city),
        state: row.state,
        fuels: FUEL_TYPES.filter((fuel) =>
          fuels.some((f) => f.stationId === row.id && f.fuelType === fuel),
        ),
        prices: prices.get(row.id) ?? [],
      }))
      .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));

    return {
      id: organizationId,
      name: organization.name,
      role,
      fuels: FUEL_TYPES.filter((fuel) =>
        units.some((u) => u.fuels.includes(fuel)),
      ),
      stations: units,
    };
  }

  /**
   * Mesmo preço em várias unidades. Cada unidade passa pelas mesmas regras de
   * um informe individual (ADR 0006); o resultado vem por unidade.
   */
  async bulkPrice(
    user: AuthenticatedUser,
    organizationId: string,
    body: BulkPrice,
  ): Promise<BulkPriceResult> {
    await this.organizations.memberRole(user.id, organizationId);
    const allowed = new Map(
      (await this.access.stationsOf(user.id))
        .filter(
          (s) =>
            s.organizationId === organizationId &&
            roleCan(s.role, 'update_price'),
        )
        .map((s) => [s.stationId, s.name]),
    );
    if (body.stationIds.some((id) => !allowed.has(id))) {
      throw new ForbiddenException(
        'Há unidades fora do seu escopo ou que seu papel não permite atualizar.',
      );
    }

    const results: BulkPriceResult['results'] = [];
    for (const stationId of body.stationIds) {
      const name = allowed.get(stationId)!;
      try {
        const response = await this.priceReports.report(user, stationId, {
          fuelType: body.fuelType,
          price: body.price,
          confirmed: body.confirmed,
        });
        results.push({
          stationId,
          name,
          ok: response.status !== 'rejeitado',
          code: null,
          message: response.message,
        });
      } catch (error) {
        if (!(error instanceof HttpException)) throw error;
        const payload = error.getResponse();
        const code =
          typeof payload === 'object' && payload && 'code' in payload
            ? String(payload.code)
            : null;
        results.push({
          stationId,
          name,
          ok: false,
          code,
          message: error.message,
        });
      }
    }
    return { results };
  }
}
