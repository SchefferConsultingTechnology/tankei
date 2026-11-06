import {
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import { stations } from './stations';
import { users } from './users';

/**
 * Foto do posto (ADR 0026). Publicada na hora; não é só de inserção: a
 * remoção (pelo posto ou pela equipe Tankei) marca removed_at e o arquivo
 * sai do armazenamento, mas o registro fica com quem removeu e o motivo.
 */
export const stationPhotos = pgTable(
  'station_photos',
  {
    id: uuid().primaryKey().defaultRandom(),
    stationId: uuid()
      .notNull()
      .references(() => stations.id),
    storageKey: text().notNull(),
    width: integer().notNull(),
    height: integer().notNull(),
    bytes: integer().notNull(),
    caption: text(),
    uploadedByUserId: uuid().references(() => users.id),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    removedAt: timestamp({ withTimezone: true }),
    removedByUserId: uuid().references(() => users.id),
    removedReason: text(),
  },
  (t) => [index('station_photos_station_idx').on(t.stationId, t.createdAt)],
);

/**
 * Promoção do posto (ADR 0026): título, texto, arte e período. Os preços
 * promocionais são informes de preço ligados a ela (price_reports.promotion_id),
 * que continuam só de inserção. Encerrar antes marca ended_at.
 */
export const promotions = pgTable(
  'promotions',
  {
    id: uuid().primaryKey().defaultRandom(),
    stationId: uuid()
      .notNull()
      .references(() => stations.id),
    title: text().notNull(),
    description: text(),
    startsAt: timestamp({ withTimezone: true }).notNull(),
    endsAt: timestamp({ withTimezone: true }).notNull(),
    createdByUserId: uuid().references(() => users.id),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    endedAt: timestamp({ withTimezone: true }),
    endedByUserId: uuid().references(() => users.id),
    imageKey: text(),
    imageUploadedAt: timestamp({ withTimezone: true }),
    imageUploadedByUserId: uuid().references(() => users.id),
    imageRemovedAt: timestamp({ withTimezone: true }),
    imageRemovedByUserId: uuid().references(() => users.id),
    imageRemovedReason: text(),
  },
  (t) => [index('promotions_station_idx').on(t.stationId, t.endsAt)],
);
