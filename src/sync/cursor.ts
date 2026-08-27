/**
 * Çekme imlecinin ilerletilmesi.
 *
 * Ayrı modülde çünkü senkronun EN TEHLİKELİ kararı burada: imleci
 * olması gerekenden ileri taşımak, aradaki kayıtların bir daha hiç
 * istenmemesi demektir. Veri sessizce kaybolur ve kimse fark etmez.
 * Bu yüzden kural veritabanından ve ağdan bağımsız, test edilebilir.
 */

/** Bir tablonun bu turda nereye kadar indiği. */
export interface TableProgress {
  /** İndirilen son satırın `server_updated_at` değeri. */
  lastSeen: string | null;
  /** Sayfa sınırına takıldı mı? Takıldıysa tablonun devamı var. */
  truncated: boolean;
}

/**
 * İki sunucu damgasını karşılaştırır.
 *
 * METİN KARŞILAŞTIRMASI KULLANILMIYOR: başlangıç imleci `...000Z` ile,
 * PostgREST'in döndürdüğü damga `...+00:00` ile bitiyor. Aynı ana ait
 * iki damga metin olarak farklı sıralanabilir.
 *
 * Çözümlenemeyen damga "daha yeni değil" sayılır — imleç yerinde kalır
 * ve tur tekrarlanır. Fazladan indirmek zararsız (yazma upsert),
 * atlamak geri dönüşsüz.
 */
export function isAfter(candidate: string, reference: string): boolean {
  const a = Date.parse(candidate);
  const b = Date.parse(reference);
  if (Number.isNaN(a) || Number.isNaN(b)) return false;
  return a > b;
}

/**
 * İmlecin taşınacağı yeni değer.
 *
 * İki sayı belirliyor:
 *
 * - **En yüksek damga** — hiçbir tablo kesilmediyse imleç buraya gider.
 * - **Kesilen tabloların en düşük son damgası** — böyle bir tablo varsa
 *   imleç buranın ötesine GEÇEMEZ.
 *
 * İkinci kural olmasaydı şu olurdu: A tablosu sayfa sınırında T1'de
 * kesilir, B tablosu T2 > T1'e kadar iner, imleç T2'ye taşınır ve A'nın
 * T1–T2 arasındaki satırları bir daha hiç istenmez.
 *
 * Hata varsa imleç HİÇ ilerlemez: başarısız tablonun kaçırdığı satırlar
 * sonraki turda yeniden istensin.
 */
export function nextCursor(
  current: string,
  progress: readonly TableProgress[],
  hasErrors: boolean,
): string {
  if (hasErrors) return current;

  let highest = current;
  let truncatedFloor: string | null = null;

  for (const p of progress) {
    if (!p.lastSeen) continue;
    if (isAfter(p.lastSeen, highest)) highest = p.lastSeen;
    if (p.truncated && (truncatedFloor === null || isAfter(truncatedFloor, p.lastSeen))) {
      truncatedFloor = p.lastSeen;
    }
  }

  const candidate = truncatedFloor ?? highest;
  return isAfter(candidate, current) ? candidate : current;
}
