/**
 * Gider — tek seferlik harcamalar, kategoriler ve dönemsel sabit giderler.
 *
 * İki gider türü BİRBİRİNDEN AYRI çalışır:
 *
 * - `expenses`: o gün fiilen ödenen para. "Cebe kalan" satırından düşer.
 * - `recurring_expenses`: plaka kirası, kasko, MTV gibi dönemsel ödemeler.
 *   Ödendiği güne tek kalem YAZILMAZ; günlük paya bölünür ve yalnızca
 *   "gerçek kâr" satırından düşer. Aynı ödemeyi ikisine birden girmek
 *   maliyeti iki kez saydırır.
 */

import { and, asc, desc, eq, gte, lte } from 'drizzle-orm';
import { getDb } from '../client';
import { expenseCategories, expenses, recurringExpenses } from '../schema';
import type { Expense, ExpenseCategory, RecurringExpense } from '../schema/expenses';
import type { ExpenseKind, RecurrencePeriod } from '../schema/_shared';
import { type UnixMs, alive, aliveById, softDeleteRow, stampNew, withOutbox } from './_base';
import type { Kurus } from '@/lib/money';
import { type BusinessDate, DEFAULT_CUTOFF_HOUR, toBusinessDate } from '@/lib/business-date';

// ---------------------------------------------------------------------------
// Kategoriler
// ---------------------------------------------------------------------------

/**
 * İlk açılışta oluşturulan kategoriler.
 *
 * Adların tamamı JENERİK — hiçbiri bir markaya, bir platforma ya da
 * belirli bir şirkete işaret etmez. Kullanıcı bunları gizleyebilir ve
 * kendi kategorisini ekleyebilir; silemez, çünkü geçmiş kayıtlar bağlı.
 *
 * "YAKIT" KASTEN YOK. Yakıtın kendi tablosu var (`fuel_logs`) ve gün
 * özeti oradan okuyor. Bir de gider kategorisi olsaydı sürücü aynı
 * dolumu iki yere girebilir, iki kez düşülür ve fark edilmezdi.
 * Vardiya sonundaki "Yakıt" çipi `addFuelLog`'a gider, `addExpense`'e değil.
 *
 * `kind` alanının ŞU AN HİÇBİR HESAP DAVRANIŞI YOKTUR, yalnızca etikettir.
 * Sabit gider tahakkuku yayın sonrasına ertelendi (27 Ağustos 2026); plaka
 * kirası da sigorta da sıradan gider gibi, ödendiği güne yazılıyor. Alan
 * duruyor çünkü motor geldiğinde ayrım oradan okunacak.
 */
const SYSTEM_CATEGORIES: ReadonlyArray<{
  name: string; kind: ExpenseKind; icon: string;
}> = [
  { name: 'Yemek', kind: 'variable', icon: 'food' },
  { name: 'Otopark', kind: 'variable', icon: 'parking' },
  { name: 'Yıkama', kind: 'variable', icon: 'wash' },
  { name: 'Ceza', kind: 'variable', icon: 'ticket' },
  { name: 'Bakım', kind: 'variable', icon: 'wrench' },
  { name: 'Plaka kirası', kind: 'fixed', icon: 'plate' },
  { name: 'Sigorta', kind: 'fixed', icon: 'shield' },
  { name: 'Vergi', kind: 'fixed', icon: 'receipt' },
  { name: 'Diğer', kind: 'variable', icon: 'dots' },
];

/**
 * Sistem kategorilerini bir kez oluşturur.
 *
 * Zaten kategori varsa hiçbir şey yapmaz — çağıran her açılışta bunu
 * güvenle çağırabilsin diye.
 */
export function seedSystemCategories(
  userId: string, now: UnixMs = Date.now(),
): ExpenseCategory[] {
  const existing = listExpenseCategories(userId);
  if (existing.length > 0) return existing;

  SYSTEM_CATEGORIES.forEach((c, index) => {
    const stamp = stampNew(userId, now);
    withOutbox('expense_categories', stamp.id, 'upsert', (tx) => {
      tx.insert(expenseCategories).values({
        ...stamp, name: c.name, kind: c.kind, icon: c.icon,
        isSystem: true, sortOrder: index,
      }).run();
    }, now);
  });

  return listExpenseCategories(userId);
}

export function createExpenseCategory(
  userId: string,
  input: { name: string; kind?: ExpenseKind; icon?: string | null },
  now: UnixMs = Date.now(),
): ExpenseCategory {
  const stamp = stampNew(userId, now);
  return withOutbox('expense_categories', stamp.id, 'upsert', (tx) => (
    tx.insert(expenseCategories).values({
      ...stamp, name: input.name.trim(),
      kind: input.kind ?? 'variable', icon: input.icon ?? null,
      isSystem: false, sortOrder: 100,
    }).returning().get()
  ), now);
}

export function listExpenseCategories(userId: string): ExpenseCategory[] {
  return getDb().select().from(expenseCategories)
    .where(alive(expenseCategories, userId))
    .orderBy(asc(expenseCategories.sortOrder), asc(expenseCategories.createdAt))
    .all();
}

export function listActiveExpenseCategories(userId: string): ExpenseCategory[] {
  return listExpenseCategories(userId).filter((c) => c.isActive);
}

/** Kategoriyi gizler. Sistem kategorisi de gizlenebilir, silinemez. */
export function hideExpenseCategory(id: string, now: UnixMs = Date.now()): void {
  withOutbox('expense_categories', id, 'upsert', (tx) => {
    tx.update(expenseCategories)
      .set({ isActive: false, updatedAt: now })
      .where(eq(expenseCategories.id, id)).run();
  }, now);
}

// ---------------------------------------------------------------------------
// Tek seferlik gider
// ---------------------------------------------------------------------------

/**
 * Giderin vardiyaya değil, İŞ GÜNÜNE bağlandığına dikkat: `shiftId` yok.
 *
 * Gün özeti zaten `business_date` üzerinden topluyor. Vardiya kimliği de
 * saklasaydık, aynı günde iki vardiya açan sürücüde giderin hangisine
 * ait olduğu iki farklı yerden okunur ve ikisi çelişebilirdi.
 */
export interface NewExpenseInput {
  categoryId: string;
  amountKurus: Kurus;
  vehicleId?: string | null;
  occurredAt?: UnixMs;

  /**
   * İş günü. Açık vardiya varsa ÇAĞIRAN vardiyanın gününü verir; yoksa
   * kaydın saatinden türetilir. Gece vardiyası gün ortasında dönmesin.
   */
  businessDate?: BusinessDate;
  receiptPath?: string | null;
  notes?: string | null;
}

export function addExpense(
  userId: string,
  input: NewExpenseInput,
  cutoffHour: number = DEFAULT_CUTOFF_HOUR,
  now: UnixMs = Date.now(),
): Expense {
  const occurredAt = input.occurredAt ?? now;
  const stamp = stampNew(userId, now);

  return withOutbox('expenses', stamp.id, 'upsert', (tx) => (
    tx.insert(expenses).values({
      ...stamp,
      categoryId: input.categoryId,
      vehicleId: input.vehicleId ?? null,
      amountKurus: input.amountKurus,
      occurredAt,
      businessDate: input.businessDate ?? toBusinessDate(occurredAt, cutoffHour),
      receiptPath: input.receiptPath ?? null,
      notes: input.notes?.trim() || null,
    }).returning().get()
  ), now);
}

export function updateExpense(
  id: string, patch: Partial<NewExpenseInput>, now: UnixMs = Date.now(),
): void {
  withOutbox('expenses', id, 'upsert', (tx) => {
    tx.update(expenses).set({
      ...(patch.categoryId !== undefined ? { categoryId: patch.categoryId } : {}),
      ...(patch.amountKurus !== undefined ? { amountKurus: patch.amountKurus } : {}),
      ...(patch.vehicleId !== undefined ? { vehicleId: patch.vehicleId } : {}),
      ...(patch.notes !== undefined ? { notes: patch.notes?.trim() || null } : {}),
      updatedAt: now,
    }).where(eq(expenses.id, id)).run();
  }, now);
}

export function deleteExpense(id: string, now: UnixMs = Date.now()): void {
  softDeleteRow(expenses, 'expenses', id, now);
}

export function getExpense(id: string): Expense | undefined {
  return getDb().select().from(expenses).where(aliveById(expenses, id)).get();
}

export function listExpensesOnDate(userId: string, date: BusinessDate): Expense[] {
  return getDb().select().from(expenses)
    .where(and(alive(expenses, userId), eq(expenses.businessDate, date)))
    .orderBy(desc(expenses.occurredAt))
    .all();
}

export function listExpensesInRange(
  userId: string, from: BusinessDate, to: BusinessDate,
): Expense[] {
  return getDb().select().from(expenses)
    .where(and(
      alive(expenses, userId),
      gte(expenses.businessDate, from),
      lte(expenses.businessDate, to),
    ))
    .orderBy(desc(expenses.occurredAt))
    .all();
}

// ---------------------------------------------------------------------------
// Dönemsel sabit gider
// ---------------------------------------------------------------------------

export interface NewRecurringExpenseInput {
  categoryId: string;
  name: string;
  amountKurus: Kurus;
  period: RecurrencePeriod;
  startDate: BusinessDate;
  endDate?: BusinessDate | null;
  vehicleId?: string | null;
  notes?: string | null;
}

/**
 * Dönemsel gider ekler.
 *
 * Bu satır günlük gider kaydına AÇILMAZ — günlük pay rapor anında
 * hesaplanır. Her kullanıcı için günde bir satır üretmek yılda 365
 * gereksiz satır demek ve dönem/tutar düzeltmesi geriye dönük yeniden
 * üretim gerektirirdi.
 */
export function addRecurringExpense(
  userId: string, input: NewRecurringExpenseInput, now: UnixMs = Date.now(),
): RecurringExpense {
  const stamp = stampNew(userId, now);
  return withOutbox('recurring_expenses', stamp.id, 'upsert', (tx) => (
    tx.insert(recurringExpenses).values({
      ...stamp,
      categoryId: input.categoryId,
      vehicleId: input.vehicleId ?? null,
      name: input.name.trim(),
      amountKurus: input.amountKurus,
      period: input.period,
      startDate: input.startDate,
      endDate: input.endDate ?? null,
      notes: input.notes?.trim() || null,
    }).returning().get()
  ), now);
}

export function updateRecurringExpense(
  id: string, patch: Partial<NewRecurringExpenseInput> & { isActive?: boolean },
  now: UnixMs = Date.now(),
): void {
  withOutbox('recurring_expenses', id, 'upsert', (tx) => {
    tx.update(recurringExpenses).set({
      ...(patch.name !== undefined ? { name: patch.name.trim() } : {}),
      ...(patch.amountKurus !== undefined ? { amountKurus: patch.amountKurus } : {}),
      ...(patch.period !== undefined ? { period: patch.period } : {}),
      ...(patch.startDate !== undefined ? { startDate: patch.startDate } : {}),
      ...(patch.endDate !== undefined ? { endDate: patch.endDate } : {}),
      ...(patch.isActive !== undefined ? { isActive: patch.isActive } : {}),
      updatedAt: now,
    }).where(eq(recurringExpenses.id, id)).run();
  }, now);
}

export function deleteRecurringExpense(id: string, now: UnixMs = Date.now()): void {
  softDeleteRow(recurringExpenses, 'recurring_expenses', id, now);
}

export function listRecurringExpenses(userId: string): RecurringExpense[] {
  return getDb().select().from(recurringExpenses)
    .where(alive(recurringExpenses, userId))
    .orderBy(asc(recurringExpenses.createdAt))
    .all();
}

export function listActiveRecurringExpenses(userId: string): RecurringExpense[] {
  return listRecurringExpenses(userId).filter((r) => r.isActive);
}
