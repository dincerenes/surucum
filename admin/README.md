# Sürücüm — Yönetim Paneli

Operatör back-office'i. Mobil uygulamayla **aynı Supabase projesine** bağlanır,
ama ondan tamamen ayrı bir uygulamadır: buradaki hiçbir satır sürücünün
telefonundaki pakete girmez.

## Güvenlik modeli

Panelin tek bir kuralı var: **yetkiyi veritabanı verir, uygulama değil.**

- `service_role` anahtarı **hiçbir yerde kullanılmaz.** Panel, giriş yapmış
  yöneticinin kendi oturumuyla çalışır. Paneldeki bir açık, veritabanındaki
  yetkiden fazlasını açamaz.
- Sürücü verisine erişim geniş bir RLS politikasıyla değil, `security definer`
  fonksiyonlarla olur. Sebep: **bir RLS politikası kayıt tutamaz.** Sürücünün
  hasılatı hassas veridir; ona bakmak izlenebilir bir eylem olmalı.
- `admin_audit_log` tablosunda INSERT/UPDATE/DELETE politikası **yoktur.**
  Satır yalnızca definer fonksiyonlar ve tetikleyicilerle düşer — yönetici
  kendi izini ne silebilir ne de sahteleyebilir.

### Roller

| Rol | Yetki |
|---|---|
| `owner` | Yetki atar/kaldırır, ham sürücü verisi açar, her şeyi düzenler |
| `admin` | Ham sürücü verisi açar, yakıt/duyuru/bayrak düzenler. Yetki atayamaz |
| `support` | Yalnızca toplamları ve denetim kaydını görür. Ham veri açamaz |

## Kurulum

### 1. Migration'lar

```bash
supabase db push
```

### 2. İlk sahip (bootstrap)

Politikalar gereği admin'i yalnızca bir `owner` atayabilir; ilk `owner`'ı
atayacak kimse yoktur. Bu yüzden ilk kayıt Supabase SQL editöründen
(service_role, RLS'i baypas eder) elle atılır:

```sql
insert into public.admin_users (user_id, role, note)
select id, 'owner', 'kurucu'
from auth.users
where email = 'senin@adresin.com';
```

Kişinin uygulamada zaten bir hesabı olmalı. Sonraki yöneticiler panelden
e-postayla eklenir.

### 3. Ortam değişkenleri

`.env.example` dosyasını `.env.local` olarak kopyalayıp doldurun.
`service_role` anahtarı **yazılmaz** — yazılırsa panelin tüm güvenlik
modeli anlamsızlaşır.

### 4. Çalıştırma

```bash
npm install
npm run dev
```

Depo kökünden `npm run admin` da aynı işi yapar.

## Ekranlar

| Yol | İçerik |
|---|---|
| `/` | Kullanıcı sayısı, DAU/WAU/MAU, 30 günlük seriler, para ve kayıt toplamları |
| `/kullanicilar` | Arama, sıralama, sayfalama; hesap başına sefer ve net hasılat |
| `/kullanicilar/[id]` | Toplamlar + **denetlenen** ham kayıt görüntüleyici |
| `/sistem-sagligi` | Bütünlük denetimleri, yakıt fiyatı beslemesinin tazeliği |
| `/yakit-fiyatlari` | Bölge × yakıt tipi fiyat girişi ve düzeltme |
| `/duyurular` | Sürücüye inen duyurular (platform, sürüm, zaman penceresi) |
| `/ozellik-bayraklari` | Uzaktan özellik anahtarları, kademeli açılış |
| `/yoneticiler` | Panel erişimi ve roller |
| `/denetim` | Değiştirilemez denetim kaydı |

## Uygulamaya bağlantı

Panel dekoratif değil; iki yerden mobil uygulamayı gerçekten etkiler:

- **Özellik bayrakları** → `src/lib/remote-config.ts` okur,
  `src/lib/entitlements.ts` içindeki `hasFeature()` buna bakar.
  Bayrak tanımsızsa **açık** kabul edilir: uygulama bulutsuz da eksiksiz
  çalışmak zorunda.
- **Duyurular** → `src/lib/announcements.ts` okur, ana ekranda gösterilir.
  Yalnızca yayında olanlar cihaza iner; taslak duyuru ağ trafiğinde bile
  görünmez.

## Yayına alma

Vercel'de kök dizin olarak `admin/` seçin, iki ortam değişkenini girin.
Panelin kendi `outputFileTracingRoot` ayarı var; üstteki Expo projesini
izlemeye almaz.
