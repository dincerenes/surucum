import {
  index, integer, sqliteTable, text, uniqueIndex,
} from 'drizzle-orm/sqlite-core';
import { GOAL_PERIODS, businessDate, kurus, syncColumns } from './_shared';

/** Kullanıcı ayarları. Tek satır tutulur, cihazlar arası senkronlanır. */
export const appSettings = sqliteTable('app_settings', {
  ...syncColumns,

  /**
   * Gün kesme saati (0–23). Bu saatten önceki kayıtlar bir önceki
   * iş gününe yazılır. Gece vardiyası çalışan sürücü için hayati.
   */
  dayCutoffHour: integer().notNull().default(4),

  defaultVehicleId: text(),

  /** Yakıt fiyatı sorgusu için il kodu. */
  regionCode: text().notNull().default('TR'),

  /** Sefer eklerken varsayılan kazanç kaynağı — girişi hızlandırır. */
  defaultEarningSourceId: text(),

  /** Kullanıcı ilk kurulum akışını tamamladı mı? */
  onboardingCompletedAt: integer(),
});

/** Kazanç hedefi. */
export const goals = sqliteTable(
  'goals',
  {
    ...syncColumns,

    period: text({ enum: GOAL_PERIODS }).notNull().default('daily'),
    targetNetKurus: kurus().notNull(),

    startDate: businessDate().notNull(),
    endDate: businessDate(),

    isActive: integer({ mode: 'boolean' }).notNull().default(true),
  },
  (t) => [index('goals_user_idx').on(t.userId, t.isActive)],
);

// ---------------------------------------------------------------------------
// Yerel-yalnız tablolar — buluta senkronlanmaz
// ---------------------------------------------------------------------------

/**
 * Senkron kuyruğu.
 *
 * TASARIM KARARI — satırın kendisi değil, yalnızca KİMLİĞİ tutulur.
 * Sürücü aynı seferi beş kez düzeltirse kuyrukta yine tek satır olur ve
 * gönderim anında kaydın son hâli okunur. Payload saklamak, beş ayrı
 * gönderim ve sıralama sorunu demek olurdu.
 *
 * `id` otomatik artan tam sayıdır: ekleme sırası, yabancı anahtar
 * bağımlılıklarının doğru sırada gönderilmesi için gerekiyor
 * (vardiya, kendisine bağlı seferlerden önce gitmeli).
 */
export const outbox = sqliteTable(
  'outbox',
  {
    id: integer().primaryKey({ autoIncrement: true }),

    tableName: text().notNull(),
    rowId: text().notNull(),
    operation: text({ enum: ['upsert', 'delete'] }).notNull(),

    attemptCount: integer().notNull().default(0),
    lastError: text(),
    lastAttemptAt: integer(),

    /** Üstel geri çekilme: bu zamandan önce yeniden denenmez. */
    nextAttemptAt: integer(),

    createdAt: integer().notNull(),
  },
  (t) => [
    // Aynı satır için tek bekleyen kayıt — tekrar düzenlemeler çakışır.
    uniqueIndex('outbox_row_unique_idx').on(t.tableName, t.rowId),
    index('outbox_ready_idx').on(t.nextAttemptAt, t.id),
  ],
);

/**
 * Senkron durumu — çekme imleci, son başarılı senkron zamanı gibi
 * anahtar/değer çiftleri. Yerel kalır.
 */
export const syncState = sqliteTable('sync_state', {
  key: text().primaryKey(),
  value: text(),
  updatedAt: integer().notNull(),
});

export type AppSettings = typeof appSettings.$inferSelect;
export type NewAppSettings = typeof appSettings.$inferInsert;
export type Goal = typeof goals.$inferSelect;
export type NewGoal = typeof goals.$inferInsert;
export type OutboxEntry = typeof outbox.$inferSelect;
export type NewOutboxEntry = typeof outbox.$inferInsert;
