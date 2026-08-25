-- Kilometre başına yıpranma payı: amortisman, lastik, balata, bakım.
-- Kuruş cinsinden bigint — istemcideki `wearPerKmKurus` ile birebir.
--
-- Kullanıcıya sorulmaz, arayüzde düzenlenmez. Araç oluşturulurken sahiplik
-- biçimine göre atanır: kendi aracı ve kiralık plakada 300 (3,00 TL/km),
-- kiralık araç ve işveren aracında 0 — o maliyet kira bedelinde zaten sayılıyor.
--
-- Sütun olarak duruyor ki varsayılan ilerde güncellenirse mevcut araçların
-- geçmiş raporları kaymasın.

alter table public.vehicles
  add column if not exists wear_per_km_kurus bigint not null default 300;
