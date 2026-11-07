import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  STATION_SERVICES,
  type OpeningHours,
  type StationInfo,
  type StationService,
  type UpdateStationInfo,
} from '@tankei/shared';
import { desc, eq, inArray } from 'drizzle-orm';
import type { AuthenticatedUser } from '../auth/tokens.service';
import { DRIZZLE, type Database } from '../database/database.module';
import { stationInfoVersions, stations } from '../database/schema';
import { AccessService } from '../organizations/access.service';
import { stationDisplayName } from '../stations/display-name';

export interface CurrentStationInfo {
  hours: OpeningHours | null;
  services: StationService[];
}

const known = (list: string[]) =>
  list.filter((s): s is StationService =>
    (STATION_SERVICES as readonly string[]).includes(s),
  );

/**
 * Horário de atendimento e serviços do posto (ADR 0033): o posto edita pelo
 * portal (proprietário e gestor), a equipe Tankei pelo admin. Cada alteração
 * é uma versão nova.
 */
@Injectable()
export class StationInfoService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly access: AccessService,
  ) {}

  /** Versão atual de cada posto (para a lista e a ficha). */
  async current(
    stationIds: string[],
  ): Promise<Map<string, CurrentStationInfo>> {
    if (stationIds.length === 0) return new Map();
    const rows = await this.db
      .selectDistinctOn([stationInfoVersions.stationId], {
        stationId: stationInfoVersions.stationId,
        hours: stationInfoVersions.hours,
        services: stationInfoVersions.services,
      })
      .from(stationInfoVersions)
      .where(inArray(stationInfoVersions.stationId, stationIds))
      .orderBy(
        stationInfoVersions.stationId,
        desc(stationInfoVersions.createdAt),
      );
    return new Map(
      rows.map((r) => [
        r.stationId,
        { hours: r.hours ?? null, services: known(r.services) },
      ]),
    );
  }

  async forPortal(user: AuthenticatedUser, stationId: string) {
    await this.access.assert(user, stationId, 'view');
    return this.info(stationId);
  }

  async updateFromPortal(
    user: AuthenticatedUser,
    stationId: string,
    body: UpdateStationInfo,
  ): Promise<StationInfo> {
    await this.access.assert(user, stationId, 'manage_info');
    return this.save(stationId, body, 'posto', user.id);
  }

  async forAdmin(stationId: string) {
    await this.ensureStation(stationId);
    return this.info(stationId);
  }

  async updateFromAdmin(
    userId: string,
    stationId: string,
    body: UpdateStationInfo,
  ): Promise<StationInfo> {
    await this.ensureStation(stationId);
    return this.save(stationId, body, 'equipe', userId);
  }

  private async save(
    stationId: string,
    body: UpdateStationInfo,
    source: 'posto' | 'equipe',
    userId: string,
  ): Promise<StationInfo> {
    // Nome no app (ADR 0035): ausente mantém o atual; nulo volta ao oficial.
    const [station] = await this.db
      .select({ displayName: stations.displayName })
      .from(stations)
      .where(eq(stations.id, stationId));
    const displayName =
      body.displayName === undefined
        ? (station?.displayName ?? null)
        : body.displayName;
    await this.db.transaction(async (tx) => {
      await tx.insert(stationInfoVersions).values({
        stationId,
        hours: body.hours,
        services: body.services,
        displayName,
        source,
        userId,
      });
      await tx
        .update(stations)
        .set({ displayName })
        .where(eq(stations.id, stationId));
    });
    return this.info(stationId);
  }

  private async info(stationId: string): Promise<StationInfo> {
    const [station] = await this.db
      .select({
        tradeName: stations.tradeName,
        legalName: stations.legalName,
        displayName: stations.displayName,
      })
      .from(stations)
      .where(eq(stations.id, stationId));
    const names = {
      displayName: station?.displayName ?? null,
      officialName: station
        ? stationDisplayName(station.tradeName, station.legalName)
        : '',
    };
    const [row] = await this.db
      .select({
        hours: stationInfoVersions.hours,
        services: stationInfoVersions.services,
        source: stationInfoVersions.source,
        createdAt: stationInfoVersions.createdAt,
      })
      .from(stationInfoVersions)
      .where(eq(stationInfoVersions.stationId, stationId))
      .orderBy(desc(stationInfoVersions.createdAt))
      .limit(1);
    if (!row) {
      return {
        ...names,
        hours: null,
        services: [],
        updatedAt: null,
        updatedBy: null,
      };
    }
    return {
      ...names,
      hours: row.hours ?? null,
      services: known(row.services),
      updatedAt: row.createdAt.toISOString(),
      updatedBy: row.source === 'equipe' ? 'equipe' : 'posto',
    };
  }

  private async ensureStation(stationId: string) {
    const [row] = await this.db
      .select({ id: stations.id })
      .from(stations)
      .where(eq(stations.id, stationId));
    if (!row) throw new NotFoundException('Posto não encontrado.');
  }
}
