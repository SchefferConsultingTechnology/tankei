import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  PayloadTooLargeException,
} from '@nestjs/common';
import type {
  AdminMedia,
  CreatePromotion,
  Promotion,
  PromotionStatus,
  StationPhoto,
  StationPhotos,
  StationPromotion,
} from '@tankei/shared';
import { and, asc, desc, eq, gt, inArray, isNull, or } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import type { AuthenticatedUser } from '../auth/tokens.service';
import { DRIZZLE, type Database } from '../database/database.module';
import {
  priceReports,
  promotions,
  stationPhotos,
  stations,
  users,
} from '../database/schema';
import { AccessService } from '../organizations/access.service';
import { ParametersService } from '../parameters/parameters.service';
import { PriceReportsService } from '../prices/price-reports.service';
import { cityDisplayName, stationDisplayName } from '../stations/display-name';
import { ImageService } from './image.service';
import { StorageService } from './storage.service';

const DAY_MS = 86_400_000;
const MB = 1024 * 1024;
/** Promoções encerradas que o posto ainda vê no portal. */
const PROMOTION_HISTORY_DAYS = 90;

type PromotionRow = typeof promotions.$inferSelect;

export interface UploadedImage {
  buffer: Buffer;
  size: number;
}

/**
 * Vitrine do posto (ADR 0026): fotos e promoções com arte. Publicadas na
 * hora por quem gerencia promoções (proprietário e gestor); a equipe Tankei
 * vê as imagens novas e pode remover, com motivo.
 */
@Injectable()
export class ShowcaseService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly access: AccessService,
    private readonly parameters: ParametersService,
    private readonly prices: PriceReportsService,
    private readonly storage: StorageService,
    private readonly images: ImageService,
  ) {}

  // ---------- Fotos ----------

  async photos(
    user: AuthenticatedUser,
    stationId: string,
    now = new Date(),
  ): Promise<StationPhotos> {
    await this.access.assert(user, stationId, 'view');
    const removed = await this.db
      .select({
        id: stationPhotos.id,
        caption: stationPhotos.caption,
        reason: stationPhotos.removedReason,
        removedAt: stationPhotos.removedAt,
        removedBy: users.role,
      })
      .from(stationPhotos)
      .innerJoin(users, eq(users.id, stationPhotos.removedByUserId))
      .where(
        and(
          eq(stationPhotos.stationId, stationId),
          eq(users.role, 'admin'),
          gt(stationPhotos.removedAt, new Date(now.getTime() - 30 * DAY_MS)),
        ),
      )
      .orderBy(desc(stationPhotos.removedAt));
    return {
      maxPhotos: await this.parameters.get('media.max_station_photos'),
      maxUploadMb: await this.parameters.get('media.max_upload_mb'),
      photos: await this.activePhotos(stationId),
      removedByTankei: removed.map((r) => ({
        id: r.id,
        caption: r.caption,
        reason: r.reason ?? '',
        removedAt: (r.removedAt ?? now).toISOString(),
      })),
    };
  }

  async addPhoto(
    user: AuthenticatedUser,
    stationId: string,
    file: UploadedImage | undefined,
    caption: string | null,
  ): Promise<StationPhoto> {
    await this.access.assert(user, stationId, 'manage_promotions');
    const max = await this.parameters.get('media.max_station_photos');
    if ((await this.activePhotos(stationId)).length >= max) {
      throw new ConflictException(
        `O posto já tem ${max} fotos. Remova uma antes de enviar outra.`,
      );
    }
    const image = await this.prepare(file);
    const key = `stations/${stationId}/photos/${randomUUID()}.webp`;
    await this.storage.put(key, image.data, image.contentType);
    const [row] = await this.db
      .insert(stationPhotos)
      .values({
        stationId,
        storageKey: key,
        width: image.width,
        height: image.height,
        bytes: image.data.length,
        caption,
        uploadedByUserId: user.id,
      })
      .returning();
    return this.toPhoto(row);
  }

  async removePhoto(
    user: AuthenticatedUser,
    stationId: string,
    photoId: string,
  ): Promise<void> {
    await this.access.assert(user, stationId, 'manage_promotions');
    const photo = await this.activePhoto(photoId, stationId);
    await this.markPhotoRemoved(photo, user.id, 'Removida pelo posto.');
  }

  // ---------- Promoções ----------

  async stationPromotions(
    user: AuthenticatedUser,
    stationId: string,
    now = new Date(),
  ): Promise<StationPromotion[]> {
    await this.access.assert(user, stationId, 'view');
    const rows = await this.db
      .select({ promotion: promotions, createdBy: users.name })
      .from(promotions)
      .leftJoin(users, eq(users.id, promotions.createdByUserId))
      .where(
        and(
          eq(promotions.stationId, stationId),
          gt(
            promotions.endsAt,
            new Date(now.getTime() - PROMOTION_HISTORY_DAYS * DAY_MS),
          ),
        ),
      )
      .orderBy(desc(promotions.startsAt));
    const list = await this.toPromotions(
      rows.map((r) => r.promotion),
      now,
    );
    return list.map((promotion, index) => ({
      ...promotion,
      createdBy: rows[index].createdBy,
      createdAt: rows[index].promotion.createdAt.toISOString(),
      imageRemovedReason: rows[index].promotion.imageRemovedReason,
    }));
  }

  async createPromotion(
    user: AuthenticatedUser,
    stationId: string,
    body: CreatePromotion,
    now = new Date(),
  ): Promise<Promotion> {
    await this.access.assert(user, stationId, 'manage_promotions');
    if (body.endsAt <= now) {
      throw new BadRequestException('A promoção já terminou.');
    }
    const maxDays = await this.parameters.get('price.promotion_max_days');
    if (body.endsAt.getTime() - body.startsAt.getTime() > maxDays * DAY_MS) {
      throw new BadRequestException(
        `A promoção pode durar no máximo ${maxDays} dias.`,
      );
    }
    const checked = await this.prices.checkPromotionPrices(
      stationId,
      body.prices,
      body.confirmed,
      now,
    );
    const created = await this.db.transaction(async (tx) => {
      const [row] = await tx
        .insert(promotions)
        .values({
          stationId,
          title: body.title,
          description: body.description,
          startsAt: body.startsAt,
          endsAt: body.endsAt,
          createdByUserId: user.id,
        })
        .returning();
      await this.prices.insertPromotionPrices(
        tx,
        {
          stationId,
          userId: user.id,
          promotionId: row.id,
          title: body.title,
          startsAt: body.startsAt,
          endsAt: body.endsAt,
          prices: checked,
        },
        now,
      );
      return row;
    });
    const [promotion] = await this.toPromotions([created], now);
    return promotion;
  }

  async setPromotionImage(
    user: AuthenticatedUser,
    stationId: string,
    promotionId: string,
    file: UploadedImage | undefined,
    now = new Date(),
  ): Promise<Promotion> {
    await this.access.assert(user, stationId, 'manage_promotions');
    const promotion = await this.promotionOf(stationId, promotionId);
    if (effectiveEnd(promotion) <= now) {
      throw new BadRequestException('A promoção já terminou.');
    }
    const image = await this.prepare(file);
    const key = `stations/${stationId}/promotions/${promotionId}/${randomUUID()}.webp`;
    await this.storage.put(key, image.data, image.contentType);
    const [row] = await this.db
      .update(promotions)
      .set({
        imageKey: key,
        imageUploadedAt: now,
        imageUploadedByUserId: user.id,
        imageRemovedAt: null,
        imageRemovedByUserId: null,
        imageRemovedReason: null,
      })
      .where(eq(promotions.id, promotionId))
      .returning();
    if (promotion.imageKey && !promotion.imageRemovedAt) {
      await this.storage.remove(promotion.imageKey);
    }
    const [result] = await this.toPromotions([row], now);
    return result;
  }

  /** Encerra antes do prazo: os preços promocionais deixam de valer. */
  async endPromotion(
    user: AuthenticatedUser,
    stationId: string,
    promotionId: string,
    now = new Date(),
  ): Promise<Promotion> {
    await this.access.assert(user, stationId, 'manage_promotions');
    const promotion = await this.promotionOf(stationId, promotionId);
    if (effectiveEnd(promotion) <= now) {
      throw new ConflictException('A promoção já está encerrada.');
    }
    const [row] = await this.db
      .update(promotions)
      .set({ endedAt: now, endedByUserId: user.id })
      .where(eq(promotions.id, promotionId))
      .returning();
    const [result] = await this.toPromotions([row], now);
    return result;
  }

  // ---------- Vitrine pública (app) ----------

  async showcase(stationId: string, now = new Date()) {
    const [station] = await this.db
      .select({ id: stations.id, mode: stations.displayMode })
      .from(stations)
      .where(eq(stations.id, stationId));
    if (!station || station.mode === 'oculto') {
      throw new NotFoundException('Posto não encontrado.');
    }
    // Preços ocultos (ADR 0028): as fotos ficam, as promoções não.
    if (station.mode === 'precos_ocultos') {
      return { photos: await this.activePhotos(stationId), promotions: [] };
    }
    const rows = await this.db
      .select()
      .from(promotions)
      .where(
        and(
          eq(promotions.stationId, stationId),
          gt(promotions.endsAt, now),
          or(isNull(promotions.endedAt), gt(promotions.endedAt, now)),
        ),
      )
      .orderBy(asc(promotions.endsAt));
    const current = (await this.toPromotions(rows, now)).filter(
      (p) => p.status === 'vigente',
    );
    return { photos: await this.activePhotos(stationId), promotions: current };
  }

  // ---------- Equipe Tankei ----------

  async adminMedia(days: number, now = new Date()): Promise<AdminMedia[]> {
    const since = new Date(now.getTime() - days * DAY_MS);
    const [photoRows, promotionRows] = await Promise.all([
      this.db
        .select({
          photo: stationPhotos,
          uploadedBy: users.name,
          uploadedByEmail: users.email,
        })
        .from(stationPhotos)
        .leftJoin(users, eq(users.id, stationPhotos.uploadedByUserId))
        .where(gt(stationPhotos.createdAt, since)),
      this.db
        .select({
          promotion: promotions,
          uploadedBy: users.name,
          uploadedByEmail: users.email,
        })
        .from(promotions)
        .leftJoin(users, eq(users.id, promotions.imageUploadedByUserId))
        .where(gt(promotions.imageUploadedAt, since)),
    ]);
    const stationIds = [
      ...new Set([
        ...photoRows.map((r) => r.photo.stationId),
        ...promotionRows.map((r) => r.promotion.stationId),
      ]),
    ];
    const userIds = [
      ...new Set(
        [
          ...photoRows.map((r) => r.photo.removedByUserId),
          ...promotionRows.map((r) => r.promotion.imageRemovedByUserId),
        ].filter((id): id is string => id !== null),
      ),
    ];
    const [places, removers] = await Promise.all([
      this.db
        .select({
          id: stations.id,
          tradeName: stations.tradeName,
          legalName: stations.legalName,
          city: stations.city,
          state: stations.state,
        })
        .from(stations)
        .where(inArray(stations.id, stationIds)),
      this.db
        .select({ id: users.id, name: users.name, email: users.email })
        .from(users)
        .where(inArray(users.id, userIds)),
    ]);
    const stationOf = (id: string) => {
      const s = places.find((p) => p.id === id);
      return {
        id,
        name: s ? stationDisplayName(s.tradeName, s.legalName) : 'Posto',
        city: s ? cityDisplayName(s.city) : '',
        state: s?.state ?? '',
      };
    };
    const who = (id: string | null) => {
      const u = removers.find((r) => r.id === id);
      return u ? (u.name ?? u.email) : null;
    };

    const items: AdminMedia[] = [
      ...photoRows.map(({ photo, uploadedBy, uploadedByEmail }) => ({
        kind: 'foto' as const,
        id: photo.id,
        url: this.storage.publicUrl(photo.storageKey),
        label: photo.caption,
        station: stationOf(photo.stationId),
        uploadedBy: uploadedBy ?? uploadedByEmail,
        createdAt: photo.createdAt.toISOString(),
        removed: photo.removedAt
          ? {
              reason: photo.removedReason ?? '',
              by: who(photo.removedByUserId),
              at: photo.removedAt.toISOString(),
            }
          : null,
      })),
      ...promotionRows.flatMap(({ promotion, uploadedBy, uploadedByEmail }) =>
        promotion.imageKey && promotion.imageUploadedAt
          ? [
              {
                kind: 'arte' as const,
                id: promotion.id,
                url: this.storage.publicUrl(promotion.imageKey),
                label: promotion.title,
                station: stationOf(promotion.stationId),
                uploadedBy: uploadedBy ?? uploadedByEmail,
                createdAt: promotion.imageUploadedAt.toISOString(),
                removed: promotion.imageRemovedAt
                  ? {
                      reason: promotion.imageRemovedReason ?? '',
                      by: who(promotion.imageRemovedByUserId),
                      at: promotion.imageRemovedAt.toISOString(),
                    }
                  : null,
              },
            ]
          : [],
      ),
    ];
    return items.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async adminRemovePhoto(adminId: string, photoId: string, reason: string) {
    const [photo] = await this.db
      .select()
      .from(stationPhotos)
      .where(eq(stationPhotos.id, photoId));
    if (!photo) throw new NotFoundException('Foto não encontrada.');
    if (photo.removedAt) {
      throw new ConflictException('Esta foto já foi removida.');
    }
    await this.markPhotoRemoved(photo, adminId, reason);
  }

  async adminRemovePromotionImage(
    adminId: string,
    promotionId: string,
    reason: string,
  ) {
    const [promotion] = await this.db
      .select()
      .from(promotions)
      .where(eq(promotions.id, promotionId));
    if (!promotion?.imageKey) {
      throw new NotFoundException('Arte não encontrada.');
    }
    if (promotion.imageRemovedAt) {
      throw new ConflictException('Esta arte já foi removida.');
    }
    await this.db
      .update(promotions)
      .set({
        imageRemovedAt: new Date(),
        imageRemovedByUserId: adminId,
        imageRemovedReason: reason,
      })
      .where(eq(promotions.id, promotionId));
    await this.storage.remove(promotion.imageKey);
  }

  // ---------- Apoio ----------

  private async prepare(file: UploadedImage | undefined) {
    if (!file?.buffer?.length) {
      throw new BadRequestException('Envie a imagem.');
    }
    const maxMb = await this.parameters.get('media.max_upload_mb');
    if (file.size > maxMb * MB) {
      throw new PayloadTooLargeException(
        `A imagem pode ter no máximo ${maxMb} MB.`,
      );
    }
    return this.images.prepare(file.buffer);
  }

  private async activePhotos(stationId: string): Promise<StationPhoto[]> {
    const rows = await this.db
      .select()
      .from(stationPhotos)
      .where(
        and(
          eq(stationPhotos.stationId, stationId),
          isNull(stationPhotos.removedAt),
        ),
      )
      .orderBy(asc(stationPhotos.createdAt));
    return rows.map((row) => this.toPhoto(row));
  }

  private async activePhoto(photoId: string, stationId: string) {
    const [photo] = await this.db
      .select()
      .from(stationPhotos)
      .where(
        and(
          eq(stationPhotos.id, photoId),
          eq(stationPhotos.stationId, stationId),
          isNull(stationPhotos.removedAt),
        ),
      );
    if (!photo) throw new NotFoundException('Foto não encontrada.');
    return photo;
  }

  private async markPhotoRemoved(
    photo: typeof stationPhotos.$inferSelect,
    userId: string,
    reason: string,
  ) {
    await this.db
      .update(stationPhotos)
      .set({
        removedAt: new Date(),
        removedByUserId: userId,
        removedReason: reason,
      })
      .where(eq(stationPhotos.id, photo.id));
    await this.storage.remove(photo.storageKey);
  }

  private async promotionOf(stationId: string, promotionId: string) {
    const [promotion] = await this.db
      .select()
      .from(promotions)
      .where(
        and(
          eq(promotions.id, promotionId),
          eq(promotions.stationId, stationId),
        ),
      );
    if (!promotion) throw new NotFoundException('Promoção não encontrada.');
    return promotion;
  }

  private toPhoto(row: typeof stationPhotos.$inferSelect): StationPhoto {
    return {
      id: row.id,
      url: this.storage.publicUrl(row.storageKey),
      width: row.width,
      height: row.height,
      caption: row.caption,
      createdAt: row.createdAt.toISOString(),
    };
  }

  private async toPromotions(
    rows: PromotionRow[],
    now: Date,
  ): Promise<Promotion[]> {
    if (rows.length === 0) return [];
    const priceRows = await this.db
      .select({
        promotionId: priceReports.promotionId,
        fuelType: priceReports.fuelType,
        price: priceReports.price,
      })
      .from(priceReports)
      .where(
        inArray(
          priceReports.promotionId,
          rows.map((r) => r.id),
        ),
      );
    return rows.map((row) => {
      const end = effectiveEnd(row);
      const status: PromotionStatus =
        now < row.startsAt ? 'agendada' : now < end ? 'vigente' : 'encerrada';
      return {
        id: row.id,
        title: row.title,
        description: row.description,
        imageUrl:
          row.imageKey && !row.imageRemovedAt
            ? this.storage.publicUrl(row.imageKey)
            : null,
        startsAt: row.startsAt.toISOString(),
        endsAt: end.toISOString(),
        status,
        prices: priceRows
          .filter((p) => p.promotionId === row.id)
          .map((p) => ({ fuelType: p.fuelType, price: p.price })),
      };
    });
  }
}

function effectiveEnd(row: PromotionRow): Date {
  return row.endedAt && row.endedAt < row.endsAt ? row.endedAt : row.endsAt;
}
