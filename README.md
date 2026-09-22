# Sürücüm

Ticari sürücülerin kazanç, gider ve **aracının gerçek maliyetini** takip ettiği
iOS + Android uygulaması. React Native (Expo), Türkçe arayüz, Türkiye pazarı.

Hedef kitle kendi arabasıyla ve uygulama üzerinden çalışan sürücüler. Taksici
değil — **kendi arabası eriyen** sürücü. Ürünün tezi bu kitlede en güçlü hâlinde:
araç sürücünün malı, değer kaybı doğrudan onun cebinden çıkıyor ve sürücü bunu
hiçbir yerde görmüyor.

---

## Ürünün varlık sebebi: kâr tek sayı değildir

Sürücü akşam cebinde 480 ₺ ile eve gider ve kazandığını sanır. Aracının o gün
238 kilometre eridiğini görmez. Uygulama her yerde **üç satır** gösterir:

```
Ciro                          447,50 ₺
Komisyon                     −215,50 ₺
Yakıt · tüketimden 17,9 lt   −892,50 ₺
Gider                        −150,00 ₺
──────────────────────────────────────
CEBE KALAN                   −810,50 ₺     ← komisyon, yakıt ve gider düşülmüş
Yıpranma · 238 km            −595,00 ₺
──────────────────────────────────────
GERÇEK KÂR                 −1.405,50 ₺     ← aracın eridiği de düşülmüş
```

- **Ciro** — brüt hasılat.
- **Cebe kalan** — ciro − komisyon − yakıt − gider. Yakıt pompada ödenen
  tutar değil, o gün **yakılan** yakıttır: tüketim × km × litre fiyatı
  (tüketim girilmemişse o vardiyada kaydedilen dolum tutarı). Yani bu
  satır saf nakit değil; içindeki tek hesaplanmış kalem yakıt.
- **Gerçek kâr** — cebe kalan − km yıpranma payı.

**İki satır arasındaki tek fark yıpranma payıdır.** Ekrandaki satırlar
toplanınca gerçek kâra ulaşır; sürücü gördüğü sayıları topluyor ve
tutmadığında sayıya güvenmiyor.

Tek bir "Kâr" rakamına indirmek ürünü yok eder: yalnızca cebe kalanı göstermek
sürücünün zaten bildiğini tekrar etmek, yalnızca gerçek kârı göstermek ise
"ben 480 lira aldım, bu uygulama ne diyor" dedirtip uygulamayı sildirmektir.

---

## Mimari kararlar

Bu bölüm kodun **neden böyle** olduğunu anlatıyor. Kararların çoğu yaşanmış
bir hatanın karşılığı.

### Para tam sayı kuruştur

Hiçbir tutar `float` değil. Tutarlar `Kurus` markalı tipiyle taşınıyor, sütun
adları `_kurus` ile bitiyor, aritmetiğin tamamı `src/lib/money.ts` içinde.

- Oranlar baz puan (`BasisPoints`): 2500 = %25,00. Ondalık oran çarpıma girmiyor.
- Tutar parçalara bölünürken `allocate()` kullanılıyor — naif bölme kuruş
  kaybeder ve aylık rapor günlerin toplamıyla tutmaz.
- Yuvarlama sıfırdan uzağa yarım, `Math.round` değil.
- Kullanıcı girdisi `parseAmount()` ile okunuyor; okunamayan girdi `null`
  dönüyor, **asla 0'a düşmüyor**. Sıfıra düşseydi sürücü yanlış yazdığını
  fark etmeden bedava sefer kaydederdi.

### İş günü takvim gününden farklıdır

Gece 22:00'de başlayan vardiya sabah 06:00'da bitiyor ama sürücünün kafasında
tek bir çalışma günü. Her kayıt `business_date` taşıyor ve tüm dönüşümler
`src/lib/business-date.ts` üzerinden yapılıyor.

**Vardiyaya bağlı kayıt, vardiyanın gününü alır** — kendi saatinden değil.
Bu kural yaşanarak bulundu: 03:52'de girilen iki sefer 27 Ağustos'a, 04:01'de
girilen ikisi 28 Ağustos'a düştü ve tek bir kesintisiz vardiya iki güne
bölündü. Gün kesme saati (varsayılan 04:00) kullanıcı ayarı.

### Cihaz kaynak-doğruluktur

Arayüz hiçbir zaman ağ çağrısı beklemiyor. Yazma yerel SQLite'a düşüyor, ekran
o an güncelleniyor, senkron arka planda `outbox` üzerinden oluyor. Bulut yedek
ve cihaz değiştirme için.

Bulut yalnızca **ilk giriş** için gerekli: her sürücünün hesabı var ve oturum
açıldıktan sonra her şey çevrimdışı çalışıyor. Uygulama bulut yapılandırılmadan
derlenmişse sessizce kilitlenmiyor, "Uygulama yapılandırılmamış" ekranında
hangi ortam değişkeninin eksik olduğunu söylüyor. Yerelde başlayıp sonradan
hesaba taşınan bir "yerel mod" yok.

- Kimlikler cihazda üretiliyor (UUID v7) — kayıt çevrimdışıyken de kalıcı
  kimliğine sahip, ilişkiler ağ beklemeden kuruluyor.
- Silme yumuşak: `deleted_at` damgalanıyor. Sert silme senkronda kaydı
  diriltir — cihaz A satırı siler, cihaz B eski hâlini geri gönderir.
- Senkronlanan bir tabloya yapılan her yazma **aynı işlem içinde** kuyruğa da
  düşüyor (`withOutbox`). Ayrılabilselerdi kayıt buluta hiç gitmez ve bunu
  kimse fark etmezdi.
- Sunucudaki `touch_server_updated_at()` tetikleyicisi **bayat yazmayı
  reddediyor**: last-write-wins sunucuda zorlanıyor, istemciye güvenilmiyor.
- Artımlı çekmenin imleci `server_updated_at`, yani **sunucu saati**. Cihaz
  saatine güvenilmiyor: yanlış saatteki bir telefon kayıt atlatır.
- Bulut eşlemesi: kuruş `bigint`, `business_date` `date`,
  `created/updated/deleted_at` `bigint` (unix ms — istemciyle birebir,
  dönüşüm yok).
- RLS politikalarında `auth.uid()` her zaman `(select auth.uid())` olarak
  sarmalanıyor; sarmalanmazsa her satır için yeniden değerlendiriliyor.

### Komisyon ve yakıt tek sayıdır

**Komisyon oran değil, tek rakam.** Sürücü yüzdesini bilmiyor, kesileni
biliyor: vardiya sonunda "bugün uygulamaya ne kadar ödedin" sorusuna tek
sayı yazıyor (`shifts.commission_kurus`). Sefer kaydı yalnızca brüt tutarı
taşıyor; sefer ekleme ekranında komisyon yok.

**Yakıt da tek sayı.** Vardiya sonunda ayrı bir "yakıt aldın mı" sorusu yok;
sorulan **kaç km yaptın** ve **ortalama tüketim**. Litre fiyatı son dolumdan
biliniyor. Üçü çarpılıp o günün yakıt gideri bulunuyor.

- Tüketim ve fiyat vardiyaya **kopyalanıyor** (`shifts.fuel_consumption_per_100km`,
  `fuel_price_kurus`). Araçtaki değer sürücünün son beyanı ve değişiyor;
  geçmiş bir günün maliyeti bugünkü fiyatla kaymamalı. Araçtaki değer
  yalnızca ön dolgu.
- Tüketim girilmemişse o vardiyada kaydedilen dolum tutarı kullanılıyor.
  **İkisi birden sayılmıyor** — aynı yakıt iki kez düşülürdü.
- Bu yüzden vardiya sonu sihirbazının gider adımında **Yakıt çipi yok**:
  bir önceki adım tüketimi ve fiyatı zaten soruyor. Dolum kaydı gerekiyorsa
  Kayıtlar'daki "Yakıt" girişinden yapılıyor. Depo ya da kilometre sayacı
  takibi yok.

### Yıpranma payı sorulmaz

Kilometre başına yıpranma kullanıcıya sorulmuyor ve arayüzde düzenlenmiyor.
Sürücü aracının kaç kilometrede ne kadar değer kaybettiğini bilmiyor; sorarsak
ya boş bırakır ya rastgele bir sayı yazar, ikisi de raporu kirletir.

**Tek katsayı, kalem kalem değil**: amortisman, lastik, balata, bakım, MTV,
sigorta hepsi bunun içinde. Değer **bilerek düşük** ve gerçek maliyeti tam
karşılaması hedeflenmiyor — yüksek bir pay sürücünün kârını olduğundan kötü
gösterir, sürücü sayıya inanmaz ve uygulamayı bırakır. Eksik tahmin, güven
kaybından iyidir.

Sahiplik biçimine göre atanıyor: kendi aracı ve kiralık plakada **250 kuruş/km**,
kiralık araç ve işveren aracında **sıfır** — o maliyet zaten kira bedeliyle
sayılıyor, sıfırlanmazsa iki kez düşülür. Sahiplik kurulumda sorulmuyor
(varsayılan "kendi aracım"); araç düzenlemede değiştiriliyor.

### Sabit gider tahakkuku yok (v1)

Plaka kirası, kasko, MTV gibi dönemsel ödemeler güne **dağıtılmıyor**.
Sürücü bunları sıradan gider olarak giriyor ve ödendiği gün cebe kalandan
düşüyor. Gerçek kâr satırı yalnızca km yıpranma payını düşüyor.

Bilinen ve kabul edilen sapma: ödemenin yapıldığı gün olduğundan kötü, ayın
diğer günleri olduğundan iyi görünüyor. `recurring_expenses` tablosu ve repo
katmanı yerinde; hesap motoru ve arayüzü yayın sonrasına ertelendi.
`expense_categories.kind` şu an yalnızca etiket, hiçbir hesaba girmiyor.

### Bilinmeyen tahmin edilmez

Kilometre girilmemişse yıpranma payı hesaplanmıyor, uydurulmuyor, ve ekran
bunu **açıkça söylüyor**. Sessizce sıfır saymak, sürücüye yanlış bir sayıyı
doğruymuş gibi göstermektir; sayıya olan güven bir kez kaybedilince geri
gelmiyor. Aynı kural yakıt tüketimi ve vardiya süresi için de geçerli.

Eksiği söyleyen her ekran onu **düzeltme yolunu da** veriyor — düzeltilemeyen
bir uyarı, uyarı değil suçlamadır.

### Marka adı yasağı

Uygulamanın hiçbir yerinde üçüncü taraf marka adı geçmiyor: uygulama adı, ikon,
kod içi sabit, örnek veri, test verisi, yorum satırı. Yasal sebep.

v1'de kazanç kaynağı sorulmuyor — hedef kitle tek platform üzerinden çalışıyor
ve her sefer için cevabı hep aynı olan bir soru sormak, sefer girişini
yavaşlatmaktan başka bir işe yaramıyor. `earning_sources` tablosu duruyor;
ileride çoklu kaynak gerekirse kapı açık.

---

## Kullanım bağlamı biçimi belirliyor

Sürücü telefona **tek elle**, çoğu zaman **araç hareket hâlindeyken** dokunuyor
ve ekrana hem güneş altında hem gece bakıyor.

- Bir seferi kaydetmek **3 saniyeden uzun sürerse uygulama terk edilir.**
  Sefer ekleme ekranında **tek alan** var: tutar. Kaynak yok, komisyon yok,
  ödeme yöntemi yok. Sayfa açılınca klavye kendiliğinden geliyor ve Kaydet
  butonu klavyenin üstünde duruyor.
- Dokunma hedefi alt sınırı **52pt** (Apple 44 öneriyor; hareket hâlindeki
  araç için yükseltildi).
- Koyu tema sonradan türetilmiş değil, eşdeğer bir durum.
- Vardiya **başlarken hiçbir şey sorulmuyor**, tek tuş. Mesafe ve süre vardiya
  biterken alınıyor: sürücü işe başlarken telefonla uğraşmaz, akşam hesabı
  kapatırken uğraşır. Başlangıçta soru sorarsak vardiya hiç açılmaz.

---

## Yapı

```
src/
  app/            Expo Router ekranları — (auth), (kurulum), (app)/(sekmeler)
  components/ui/  Arayüz primitifleri: tasarım tek buradan giydiriliyor
  db/
    schema/       Kanonik şema — drizzle-kit'in de tek kaynağı
    repo/         Yazma ve okuma yolu; ham insert/update yazılmıyor
  lib/            Saf aritmetik: money, business-date, profit, day-summary,
                  shift, fuel-cost, stats, goal — hepsi veritabanı bilmez
  sync/           Gönderim, artımlı çekme, imleç, zamanlayıcı
  theme/          Belirteçler ve tema sağlayıcısı
supabase/         Postgres migration'ları, RLS politikaları, tetikleyiciler
drizzle/          Üretilen SQLite migration'ları — tamamı sürüm kontrolünde
docs/             Tasarım brief'i, gizlilik taslağı, mağaza formları,
                  bilinen güvenlik uyarıları
.github/          CI: test, typecheck, lint, drizzle tutarlılığı, audit
```

`supabase/migrations` altındaki dosya adları buluttaki
`supabase_migrations.schema_migrations` sürümleriyle **birebir** aynı ve
içerikleri uzakta çalıştırılan metinle aynı. Uygulanmış bir migration
dosyası sonradan düzenlenmiyor — yorum düzeltmesi bile yapılmıyor;
düzeltme yeni bir migration'la geliyor. Yeni migration uygulanınca dosya
adı, uygulamanın döndürdüğü sürümle veriliyor (elle saat uydurulmuyor).

Bulutta yönetim paneline ait tablolar ve fonksiyonlar da var
(`admin_*` migration'ları); panelin kodu henüz ayrı dalda.
`fuel_prices` tablosu ve yazma politikaları duruyor ama v1'de
kullanılmıyor: yakıt fiyatı sürücünün son dolumundan okunuyor.
Migration yorumlarında geçen zamanlanmış fiyat güncelleme işi kurulmadı.

Aritmetiğin veritabanından ayrı durması bilinçli: `src/lib` native SQLite
kurmadan `node --test` ile koşuyor ve para hesabının tamamı bağımlılıksız
test ediliyor.

Alt sekmeler: **Anasayfa · Kayıtlar · Sürüş · İstatistik · Profil.** "Sürüş"
ayrı bir sekme çünkü açık vardiya bir *durum* değil, bir *yer* — sürücü gün
boyu oraya dönüp sefer ekliyor.

---

## Komutlar

```bash
npm start          # Expo geliştirme sunucusu
npm test           # node:test ile birim testleri (bağımlılıksız)
npm run typecheck  # tsc --noEmit
npm run lint       # expo lint
npm run db:generate  # şema değişince SQLite migration üretir
npm run db:check   # drizzle/ migration geçmişi tutarlı mı
npx expo run:ios   # simülatörde yerel derleme
```

CI (`.github/workflows/ci.yml`) her main push'unda ve PR'da bunları
koşuyor; ek olarak şemanın `drizzle/` ile güncel olduğunu ve
`npm audit`'te high/critical olmadığını denetliyor. Bilinen moderate
uyarılar ve neden bekletildikleri: `docs/bilinen-uyarilar.md`.

CocoaPods UTF-8 şart koşuyor: kabuk yerel ayarı boşsa (`LANG=""`)
`pod` ve `npx expo-doctor` yanıltıcı hatalar veriyor (ör. Xcode lisansı
kabul edilmemiş). Pod çağıran komutları
`LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8` ile çalıştır.

---

## Veritabanı katmanı — canlı olarak doğrulanmış notlar

Bunlar tahmin değil, yaşanmış hataların karşılığı:

- Sürümler `drizzle-orm@0.45.x`, `drizzle-kit@0.31.x`'te tutuluyor
  (bugün 0.45.2 ve 0.31.10). package.json'daki `^` 0.x sürümlerinde yalnızca
  yama sürümüne izin veriyor, tam sürümü lockfile kilitliyor. Resmî doküman
  `@rc` diyor ama o 1.0.0-rc; migrator imzası ve relations API'si kırık.
- `drizzle.config.ts` içinde `driver: 'expo'` **şart**, yoksa
  `drizzle/migrations.js` üretilmiyor.
- `casing: 'snake_case'` **hem** config'te **hem** runtime `drizzle()`
  çağrısında olmalı; tek taraflı olursa 'no such column' alınıyor.
- `openDatabaseSync(..., { enableChangeListener: true })` olmadan canlı sorgu
  ilk veriyi getirip bir daha güncellenmiyor — **sessiz hata**.
- Yerel ve bulut sütun adları **birebir** aynı olmak zorunda: senkron satırları
  hiçbir eşleme yapmadan gönderiyor. Bir kez `avg_consumption_per100_km` ile
  `avg_consumption_per_100km` ayrıştı ve o tablo Faz 1'den beri hiç
  senkronlanmadı; hiçbir tip denetimi yakalamadı. `schema-parity.test.ts`
  artık bunu her koşuda doğruluyor.
- `crypto-polyfill` giriş dosyasının **en üstünde**, uuid kullanan her şeyden
  önce import edilmeli — Hermes `crypto.getRandomValues` sağlamıyor.

---

## Durum

**Faz 1 (iskelet)**, **Faz 2 (kayıt)** ve **Faz 3 (raporlar)** tamamlandı.
**Faz 4 (yayın hazırlığı)** sürüyor.

Yayın öncesi kalanlar:

- **Gerçek SMTP** bağlanması ve e-posta doğrulamasının geri açılması. Şu an
  `mailer_autoconfirm` açık ve şifre sıfırlama, üretim için desteklenmeyen
  yerleşik posta servisine bağlı.
- **Şifre sıfırlama bağlantısının adresi** Supabase panelinde izinli
  dönüş adreslerine eklenmeli: `surucum://sifre-yenile` (Authentication →
  URL Configuration → Redirect URLs). Eklenmezse e-postadaki bağlantı
  uygulamaya dönmez. Uygulama tarafı hazır: bağlantı `sifre-yenile`
  ekranını açıyor, kod PKCE ile oturuma çevriliyor ve yeni şifre orada
  yazılıyor. Kod, bağlantının istendiği telefonda saklı; başka cihazda
  açılan bağlantı "artık geçerli değil" der.
- **Uygulama içi hesap silme** — iki mağazanın da şartı.
- **Gizlilik politikası:** taslak `docs/gizlilik-politikasi.md`. Hukukçudan
  geçmesi, herkese açık bir https adresinde yayımlanması ve kayıt ekranı ile
  Profil'den bağlanması gerekiyor. Mağaza formları: `docs/magaza-formlari.md`.
- **Android hiç derlenmedi** — geliştirme makinesinde Android SDK yok.
  `expo prebuild --platform android` temiz geçiyor.
- **Uygulama adı** (16 Eylül'de kontrol edildi): iki mağazada da tam olarak
  "Sürücüm" adlı bir uygulama yok, ama adı kendi uygulama adının içinde
  kullanan, sürücülere yönelik komşu kategoride bir uygulama var. Aramada
  karışıklık ve itiraz riski gerçek; adı korumak ya da ayırt edici bir ek
  almak kararı bekliyor.

Yayın sonrasına ertelenenler: sabit gider tahakkuku (bkz. "Sabit gider
tahakkuku yok"), kimlik devri (yerelde başlayıp sonradan hesaba taşınma).

## Depo kuralları

- Şema değişince `npm run db:generate` ve `drizzle/` klasörünün **tamamı**
  commit'leniyor.
- `supabase/migrations` dosya adı = buluttaki sürüm (bkz. Yapı).
- Commit mesajları Türkçe; başlık sürücünün ya da kullanıcının gördüğü
  sorunu anlatıyor. Mesajlara `Co-Authored-By`, "Generated with" ya da
  benzeri eş-yazar/imza satırı **eklenmiyor**.

## Lisans

Özel depo. Tüm hakları saklıdır.
