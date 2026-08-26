'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { parseKurus } from '@/lib/parse';
import { createClient } from '@/lib/supabase/server';

const PATH = '/yakit-fiyatlari';

function back(params: Record<string, string>): never {
  redirect(`${PATH}?${new URLSearchParams(params)}`);
}

export async function upsertFuelPrice(formData: FormData) {
  const region = String(formData.get('region_code') ?? '').trim();
  const fuelType = String(formData.get('fuel_type') ?? '').trim();
  const effectiveDate = String(formData.get('effective_date') ?? '').trim();
  const priceText = String(formData.get('unit_price') ?? '');

  if (!region || !fuelType || !effectiveDate) {
    back({ hata: 'Bölge, yakıt tipi ve tarih zorunlu.' });
  }

  const unitPriceKurus = parseKurus(priceText);
  if (unitPriceKurus === null || unitPriceKurus <= 0) {
    back({ hata: `Birim fiyat okunamadı: "${priceText}". Örnek: 48,99` });
  }

  const supabase = await createClient();
  const { error } = await supabase.from('fuel_prices').upsert(
    {
      region_code: region,
      fuel_type: fuelType,
      unit_price_kurus: unitPriceKurus,
      effective_date: effectiveDate,
      // Kaynağın 'panel' olması önemli: zamanlanmış işin yazdığı satırla
      // elle girilen satır sonradan ayırt edilebilsin.
      source: 'panel',
      fetched_at: Date.now(),
    },
    { onConflict: 'region_code,fuel_type,effective_date' },
  );

  if (error) back({ hata: error.message });

  revalidatePath(PATH);
  back({ sonuc: 'Fiyat kaydedildi.' });
}

export async function deleteFuelPrice(formData: FormData) {
  const id = String(formData.get('id') ?? '');
  if (!id) back({ hata: 'Kayıt bulunamadı.' });

  const supabase = await createClient();
  const { error } = await supabase.from('fuel_prices').delete().eq('id', id);
  if (error) back({ hata: error.message });

  revalidatePath(PATH);
  back({ sonuc: 'Fiyat silindi.' });
}
