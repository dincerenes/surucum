-- Kilometre başına aşınma payı.
--
-- Lastik, fren, yağ, bakım — kilometreyle biriken ama fatura günü gelene
-- kadar görünmeyen maliyet. Sürücü "bugün 300 TL yaktım, 900 TL kazandım"
-- derken bu payı hiç saymıyor ve kârını olduğundan yüksek görüyor.
--
-- Varsayılan 300 kuruş/km (3 TL). Kullanıcı kendi aracına göre değiştirir;
-- amortisman ve bakım alışkanlığı araçtan araca çok değişiyor.
--
-- NOT: Bu migration canlı veritabanına 25 Ağustos 2026'da doğrudan
-- uygulanmış ama depoya yazılmamıştı. Dosya, depo ile veritabanını
-- hizalamak için sonradan eklendi; içeriği uygulanan SQL'in aynısı.
alter table public.vehicles
  add column if not exists wear_per_km_kurus bigint not null default 300;
