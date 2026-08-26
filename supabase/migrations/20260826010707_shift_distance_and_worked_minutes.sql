-- Vardiya mesafesi ve fiilen çalışılan süre.
--
-- Mesafe kilometre sayacı okuması DEĞİL, vardiya boyunca kat edilen yoldur;
-- sürücü vardiya sonunda kendisi yazar. Km yıpranma payının tek girdisidir.
--
-- `worked_minutes` boşsa süre `ended_at - started_at` farkından düşülür;
-- doluysa o farkı ezer — sürücü mola verir ve vardiyayı kapatmayı unutur.

alter table public.shifts
  add column if not exists distance_km integer,
  add column if not exists worked_minutes integer;
