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
bölündü.

Günü bölen şey saat değil **vardiya**: vardiyanın günü başladığı takvim
günüdür. Eskiden bir de "gün kesme saati" ayarı vardı (varsayılan 04:00);
yalnızca vardiya dışı kayıtları etkiliyordu, sürücüye anlamı
açıklanamadı ve kaldırıldı. Kesme artık her zaman gece yarısı
(`DEFAULT_CUTOFF_HOUR = 0`); ayar sütunu bulutta duruyor ama okunmuyor.

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
  açık vardiyadaki "Yakıt" butonundan yapılıyor. Depo ya da kilometre sayacı
  takibi yok.

### Her kayıt bir vardiyaya ait

Yolcu, gider ve yakıt **yalnızca açık vardiyada** giriliyor ve o vardiyaya
bağlanıyor (`shift_id`). "Vardiya dışı" kayıt yok: Kayıtlar vardiya vardiya
listeleniyor, her kart yalnızca kendi kayıtlarını sayıyor ve kartların
toplamı dönem özetine eşit. Vardiya silinince yolcuları, giderleri ve
dolumları da siliniyor (`deleteShift`) — sahipsiz kalıp toplamlara giren
ama hiçbir kartta görünmeyen kayıt olmasın diye. Ekranlarda "sefer" yerine
**"yolcu"** yazıyor (her sefer bir yolcu); kodda ve veritabanında adı
`rides`.

### Yıpranma payı sürücünün cevaplarından

Kilometre başına yıpranma payı kurulumda sorulan üç kalemden hesaplanıyor
(`src/lib/wear.ts`):

- **Bakım**: bakım maliyeti ÷ kaç km'de bir yapıldığı.
- **Lastik**: dört lastiğin maliyeti ÷ kaç km'de bir değiştiği.
- **Değer kaybı**: aracın ikinci el değeri × %0,90 ÷ 10.000 km.

Örnek: 8.000 ₺ / 10.000 km + 16.000 ₺ / 40.000 km + 900.000 ₺'lik araç =
0,80 + 0,40 + 0,81 = **2,01 ₺/km**. Değer kaybı oranı **bilerek düşük**
(ilk öneri %2'ydi, sürücü yüksek buldu). Yüksek bir pay kârı olduğundan kötü
gösterir ve sürücü sayıya inanmaz. Oran yayın sonrası gerçek veriyle ayarlanacak.

Bilinmeyen kalem sıfır sayılmıyor, **varsayılandan** geliyor: bakım 0,60,
lastik 0,40, değer kaybı 1,50 ₺/km. Hiçbir şey bilmeyen sürücünün payı eski
sabit katsayıyla aynı: **250 kuruş/km**. Hesaplanan katsayı araçta ayrıca
saklanıyor; formül değişirse geçmiş raporlar kaymıyor. Girdiler araç
düzenlemede değiştirilince katsayı yeniden hesaplanıyor. Geçmiş vardiyalar
eski katsayıda donduruluyor.

Kiralık araç ve işveren aracında pay **sıfır**: o maliyet zaten kira bedeliyle
sayılıyor, sıfırlanmazsa iki kez düşülür. Sahiplik kurulumda sorulmuyor
(varsayılan "kendi aracım"); araç düzenlemede değiştiriliyor. Hasar kaydı ve
vites saklanıyor ama şimdilik hesaba girmiyor.

### Kurulum sihirbazı

Yedi adım: ad soyad ve şehir → marka (logolu liste), model, yıl → yakıt ve
vites → periyodik bakım → lastik → ikinci el değer, güncel km, hasar kaydı →
özet ve "Başla". Kişisel bilgiler ilk adımda hemen kaydediliyor. Araç
**yalnızca son adımda** yazılıyor; yarıda bırakılan kurulum yarım araç
bırakmıyor. Bakım, lastik ve değer adımları "Bilmiyorum, atla" ile geçilebiliyor.

**Kurulum yalnızca hesap gerçekten boşsa açılıyor** (`src/lib/setup-gate.ts`).
Boş bir cihazda (yeni telefon, yeniden kurulum) önce bu hesabın ilk senkronu
bekleniyor. Eskiden araçlar buluttan inmeden kurulum açılıyor, her girişte
aynı araç bir kez daha ekleniyordu.

Marka logoları [car-logos-dataset](https://github.com/filippofilip95/car-logos-dataset)
paketinden alındı (MIT). Logolar markaların tescilli malı; yalnızca sürücünün
kendi aracının markasını göstermek için kullanılıyor. Logosu olmayan markada
(Togg) baş harf rozeti çıkıyor.

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
                  shift, fuel-cost, stats, goal, home, profile — hepsi
                  veritabanı bilmez
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

**Anasayfa kartlardan oluşuyor** (eski "gün defteri" düzeni kaldırıldı;
vardiya vardiya döküm vardiya detayında): saate göre selamlama ve ilk ad,
avatar (fotoğraf yoksa baş harf; dokununca Profil), bayat kalmış açık
vardiya uyarısı, **Günlük kazancın** (mavi vurgu kartı, YALNIZCA bilgi:
açık vardiyada yolcu/ciro/süre, kapalıyken bugünün cebe kalanı; hedef
girilmişse hedef çubuğu; kayıt girişi Sürüş'te, karta dokununca oraya
gidiliyor), **Aylık ortalama** (çalışılan gün başına cebe kalan; yolcu, km,
saat ve ciro gün başına — km yalnızca km'si girilmiş günlerden),
**Bu ayın en iyi günü** (cebe kalanı en yüksek kârlı gün), **Son 7 gün** (günlük
cebe kalan; kaydı olmayan gün boş çubuk olarak duruyor, yutulmuyor).
Aritmetik `src/lib/home.ts` ve `profile.ts`'te, okuma
`src/db/repo/home.ts` (`getHomeOverview`).

**Verimlilik puanı** (0–100, `src/lib/efficiency.ts`) sürücünün KENDİ
geçmişine göre (23 Eylül 2026 kararı; başka sürücülerle karşılaştırma
yok): günün saat başına cebe kalanı, önceki 30 günün ortancasına
bölünüyor; km biliniyorsa km başına oranla 60/40 harmanlanıyor. Oran 1 →
50 puan, 2 → 100, zarar → 0. Açık vardiyalı gün puanlanmıyor (süre
vardiya bitince soruluyor); ölçü için önceki 30 günde en az 5 kapanmış
gün gerekiyor. Anasayfa'da son puanlanmış günün halkası duruyor.

**İstatistik kartları** (sıra kararlaştırıldı): dönem özeti (önceki
dönemle fark ve kazanç seyri içinde), verimlilik analizi, zaman
verimliliği, sıcak saatler, en verimli gün, yolcu analizi, km analizi,
gider dağılımı. Aritmetik `src/lib/insights.ts`, okuma
`src/db/repo/insights.ts` (`getStatsOverview`), çizim
`src/components/stats/stat-cards.tsx`; halka ve pasta grafik
`react-native-svg` ile. Platform ve ödeme şekline göre dağılım yok: yolcu
girilirken ikisi de sorulmuyor.

Ad, şehir ve avatar `app_settings` satırında (`display_name`, `city`,
`avatar`; üçü de boş olabilir, senkronlanıyor). Kayıt ekranındaki
isteğe bağlı **Adın** alanı ayara değil hesabın metadata'sına
(`display_name`) yazılıyor: e-posta doğrulaması açıkken kayıttan sonra
oturum ve yerel veritabanı yok. `completeOnboarding` adı kurulum bitince
ayara bir kez taşıyor, ayarda zaten ad varsa dokunmuyor.

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

Sürücünün raporu üzerine yeniden düzenleme: Anasayfa kart düzenine geçti
(bkz. Yapı). Profil alanları (`drizzle/0016_profile_fields.sql`,
`supabase/migrations/20260922235107_profile_fields.sql`) buluta uygulandı.
Profil tek sayfada: kimlik (hazır avatar, ad, şehir, "Profili düzenle"),
Araçlarım, günlük hedef (`hedef.tsx`, eski Ayarlar), tema önizlemeleri,
Destek (uygulama içi geri bildirim, SSS taslağı `sss.tsx`), çıkış ve hesap
silme.

- **Geri bildirim** e-posta adresi göstermeden buluttaki `feedback`
  tablosuna yazılıyor (`src/lib/feedback.ts`; yalnızca ekleme, sürücü
  okuyamaz). Okumak için Supabase paneli → Table Editor → `feedback`.
- **Hesap silme** `supabase/functions/delete-account` (yayında, JWT
  doğrulamalı): kullanıcı silinince bütün tabloları cascade ile gidiyor;
  ardından cihazdaki kayıtlar `wipeLocalUserData` ile temizleniyor. Fotoğraf yükleme ve bildirimler sonraya.

Yayın öncesi kalanlar:

- **E-posta doğrulaması** bilerek kapalı (`mailer_autoconfirm` açık,
  23 Eylül 2026 kararı: kayıt kısa kalsın): yeni hesap e-postası
  doğrulanmadan açılıyor. Gönderim hazır — Gmail SMTP
  (`surucumappdestek@gmail.com`), Türkçe şablonlar `docs/eposta-sablonlari.md`
  (23 Eylül 2026'da denendi). Şablon değişikliği birkaç dakika sonra
  yansıyor.
- **Gizlilik politikası:** https://dincerenes.github.io/surucum-yasal/
  (hesap silme: `hesap-silme.html`). Kaynak metin
  `docs/gizlilik-politikasi.md`; sayfalar ayrı, herkese açık
  `dincerenes/surucum-yasal` deposunda — metin değişince orası da
  güncellenir: `python3 tools/yasal-site.py <site-klasörü>`. Kullanım
  koşulları `docs/kullanim-kosullari.md`, KVKK sayfası politikanın B bölümü.
  Kayıtta onay kutusu zorunlu; kabul edilen sürüm ve zaman hesabın
  metadata'sında (`terms_version`, `terms_accepted_at`). Profil → Hukuki'de
  üç metnin bağlantısı var (`src/lib/legal.ts`).
  Yurt dışına aktarımın dayanağı hukukçuya sorulacak. Mağaza formları:
  `docs/magaza-formlari.md`.
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
