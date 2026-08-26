# Sürücüm — Tasarım Brief'i

Bu belge Claude Design'a verilecek girdidir. Ekran envanteri, durumlar,
kısıtlar ve mevcut belirteçler burada.

---

## Ürün

Ticari sürücülerin (taksi şoförü, çağrı üzerine çalışan sürücü) kazanç, gider ve
gerçek araç maliyetini takip ettiği **iOS + Android** uygulaması.
Türkiye pazarı, **arayüz tamamen Türkçe**.

**Teknoloji: React Native (Expo).** Web sayfası değil. Hover durumu yok,
karmaşık CSS grid yok, `position: sticky` yok. Bileşenler React Native'de
karşılığı olan şeyler olmalı: View, Text, Pressable, ScrollView, FlatList,
Modal, alttan açılan sayfa (bottom sheet).

**Kullanım bağlamı biçimi belirliyor:**
- Sürücü telefona **tek elle**, çoğu zaman **araç hareket hâlindeyken** dokunuyor
- Ekrana **güneş altında ve gece** bakıyor → koyu tema süs değil, birinci sınıf durum
- Bir seferi kaydetmek **3 saniyeden uzun sürerse uygulama terk edilir**

---

## MUTLAK KISITLAR — ihlal eden tasarım kullanılamaz

### 1. Hiçbir yerde üçüncü taraf marka adı veya logosu geçmez

Uygulama adı, alt başlık, ikon, ekran görüntüsü, örnek veri, mockup içindeki
sahte veri — **hiçbirinde** taksi/yolculuk uygulaması markası olmayacak.
Yasal sebep.

Mockup'ta örnek kazanç kaynağı gerekiyorsa nötr adlar kullan:
**"Uygulama 1", "Uygulama 2", "Nakit Müşteri", "Kurumsal"**

Kazanç kaynakları sabit liste değildir — kullanıcı kendi listesini kurar.

Jenerik kelimeler serbesttir: *taksi, şoför, sürücü, ticari araç, vardiya, hasılat*.

### 2. Kâr TEK SAYI DEĞİLDİR — her zaman ÜÇ SATIR

Bu ürünün varlık sebebi. Tek "Kâr" rakamına indiren tasarım reddedilir.

| Satır | Ne demek | Ton |
|---|---|---|
| **Ciro** | Brüt hasılat | Nötr |
| **Cebe kalan** | Ciro − komisyon − bugün fiilen ödenen yakıt ve gider. **Yalnızca gerçekleşmiş nakit, hiçbir tahmin yok.** | Vurgulu — sürücünün her gün baktığı sayı |
| **Gerçek kâr** | Cebe kalan − sabit gider günlük payı − km yıpranma payı. Tahakkuk ve tahmin içerir. | En büyük vurgu ama farklı karakterde |

**2 ile 3 arasındaki fark ürünün tüm hikâyesi.** Sürücü cebinde 480 TL görürken
aslında o gün zarar etmiş olabilir. Tasarım bu farkı görünür kılmalı.

**Gerçek kâr negatif olabilir.** Sıfıra kırpılmaz, kırmızı gösterilir.

### 3. Km yıpranma payı kullanıcıya sorulmaz, düzenlenmez

Amortisman + lastik + balata + bakım. Sistem atıyor, sürücü değiştiremez.

Ekranda **düzenlenebilir alan olarak ASLA** çıkmaz. Gerçek kâr satırının altında
tek satırlık **sessiz, gri açıklama** olarak durur:

> *280 km yıpranma payı  −840 ₺*

Göze sokulmaz ama gizlenmez de — sürücü sayının nereden geldiğini
göremezse rakama güvenmez.

### 4. Bilinmeyen tahmin edilmez

Kilometre girilmemişse yıpranma payı **hesaplanmaz**. Uydurulmaz.
Bu durumda ekran açıkça söyler:
> *"Kilometre girilmediği için yıpranma payı hesaplanmadı."*

---

## Navigasyon

**Alt sekme çubuğu, 4 sekme.** (Raporlar Faz 3'te doluyor; şimdi "yakında"
durumu olacak ama sekme çubuğu sonradan yeniden dizilmesin diye şimdi tasarlansın.)

```
┌──────────┬──────────┬──────────┬──────────┐
│  Bugün   │ Kayıtlar │ Raporlar │  Profil  │
└──────────┴──────────┴──────────┴──────────┘
```

---

## Ekran envanteri

### A. Giriş (mevcut, yeniden giydirilecek)

1. **Giriş** — e-posta + şifre
2. **Kayıt** — e-posta + şifre + şifre tekrar
3. **Şifre sıfırlama** — e-posta

### B. İlk kurulum (kayıttan sonra, zorunlu, atlanamaz)

4. **Araç ekle** — araç adı, plaka (isteğe bağlı), **sahiplik biçimi** (4 seçenekli
   seçim: *Kendi aracım · Kiralık plaka · Kiralık araç · İşverenin aracı*),
   **yakıt tipi** (çoklu seçim — dönüşümlü LPG araçlar hem benzin hem LPG yakar)
5. **Araç detayı** — marka, model, model yılı. **Atlanabilir.**
6. **Kazanç kaynakları** — ad + komisyon oranı (%). Birden fazla eklenebilir,
   en az bir tane zorunlu. İlki varsayılan olur.
7. **Hazırsın** — kısa karşılama, ana ekrana geçiş

### C. Bugün sekmesi — ÜÇ AYRI DURUM

Bu uygulamanın kalbi. Üç durum da ayrı tasarlanmalı.

**C1 — Vardiya kapalı, bugün hiç kayıt yok (boş durum)**
- Sakin, davetkâr
- Tek büyük eylem: **[VARDİYA BAŞLAT]**
- Bu buton ekranın en büyük dokunma hedefi olmalı

**C2 — Vardiya AÇIK (sürücü direksiyonda, gün boyunca bu ekranda)**
- Üstte: geçen süre + bugüne kadarki ciro
- Ortada: bugünkü seferlerin listesi (en yeni üstte, tutar + saat + kaynak)
- **[+ SEFER]** — ekranın en erişilebilir yerinde, başparmak menzilinde,
  kaydırma yapmadan ulaşılabilir. **Bu buton her şeyden önemli.**
- Altta: **[VARDİYAYI BİTİR]** — ikincil, yanlışlıkla basılmayacak konumda
- Sefer listesi boşken de ekran boş görünmemeli

**C3 — Vardiya kapanmış, bugün kayıt var**
- **Üç satırlı özet** en üstte, tam vurguyla
- Altında: vardiya istatistikleri (süre, km, sefer sayısı, TL/saat, TL/km)
- **[YENİ VARDİYA]**

### D. Sefer girişi — alttan açılan sayfa (bottom sheet)

8. **Sefer ekle**
   - **Büyük tutar girişi** — ekranın kahramanı, rakamlar iri
   - Kazanç kaynağı: yatay **çip** satırı, varsayılan seçili gelir
   - Ödeme yöntemi: Nakit / Kart / Uygulama — küçük, ikincil
   - **[KAYDET]**
   - Hedef: aç → yaz → kaydet, **3 saniye**. Fazladan hiçbir soru yok.

### E. Vardiya bitirme sihirbazı — hepsi opsiyonel, atlanabilir

9. **Adım 1 — Mesafe ve süre**
   - "Kaç km yaptın?" (kilometre sayacı okuması DEĞİL, kat edilen yol)
   - "Kaç saat çalıştın?" (otomatik hesaplanmış süre önceden dolu gelir,
     sürücü düzeltebilir)
10. **Adım 2 — Giderler**
    - Hazır çipler: **Yakıt · Yemek · Otopark · Yıkama · Ceza · Diğer**
    - Yakıt seçilirse ek alanlar: litre, birim fiyat, **"Depoyu tam doldurdun mu?"**
      (tüketim ölçümünün anahtarı)
    - Birden fazla gider eklenebilir
11. **Adım 3 — ÖZET** ← ürünün ödül anı
    - **Üç satır**, tam vurguyla
    - Yıpranma payı sessiz gri satır olarak altta
    - Vardiya istatistikleri
    - **[BİTİR]**

### F. Kayıtlar sekmesi

12. **Kayıt listesi** — güne göre gruplanmış; her gün için ciro/cebe kalan
    özeti, açılınca o günün seferleri ve giderleri
13. **Vardiya detayı** — geçmiş bir vardiyanın tam dökümü, üç satır dahil
14. **Sefer düzenle / sil**
15. **Gider ekle** (vardiyadan bağımsız)
16. **Yakıt ekle** (vardiyadan bağımsız)

### G. Profil sekmesi

17. **Profil ana** — hesap, aktif araç, menü listesi
18. **Araçlarım** — liste, **aktif araç değiştirme**, yeni araç ekleme
19. **Araç düzenle**
20. **Kazanç kaynaklarım** — liste, ekle, düzenle, oran değiştir
21. **Sabit giderler** — kiralık plaka bedeli, kasko, MTV, muayene.
    Tutar + dönem (günlük/haftalık/aylık/3 aylık/yıllık). Bunlar **güne bölünüp**
    gerçek kâr satırından düşülür — ekran bunu açıklamalı.
22. **Ayarlar** — gün kesme saati (varsayılan 04:00, gece vardiyası için),
    tema (açık/koyu/sistem), il
23. **Çıkış**

### H. Raporlar sekmesi

24. **Yakında** durumu — Faz 3'te dolacak

---

## Mevcut tasarım belirteçleri

Bunlar Faz 1'de kuruldu ve kodda **çalışıyor**. Tasarım bunları temel alabilir
veya değiştirebilir — ama **yapı korunmalı** (aynı belirteç adları, aynı ölçek
mantığı), çünkü kod bu adlara bağlı.

### Renk — açık tema
```
background     #F4F6F4     text        #141C18     accent       #0E5A63
surface        #FFFFFF     textSoft    #586460     accentText   #FFFFFF
surfaceSunken  #EAEEEB     textFaint   #8B9691     accentSoft   #DCEDEF
border         #D6DDD8     borderStrong #B4BEB8
positive #15803D  positiveSoft #DCF3E4
negative #B3261E  negativeSoft #FADEDC
warning  #8A5D14  warningSoft  #F6E9CF
```

### Renk — koyu tema
```
background     #101512     text        #E6EBE7     accent       #4FC3D0
surface        #191F1B     textSoft    #9AA5A0     accentText   #062327
surfaceSunken  #0B0F0D     textFaint   #6D7873     accentSoft   #0E3238
border         #2A332E     borderStrong #3D4842
positive #5CC98A  positiveSoft #12301F
negative #F2837C  negativeSoft #3A1A18
warning  #D8A94E  warningSoft  #33280F
```

**Vurgu rengi kasıtlı olarak yeşil DEĞİL.** Yeşil ve kırmızı anlamsal olarak
kazanç ve gidere ayrılmış. Etkileşim rengi bunlarla çakışırsa
"bu buton mu, yoksa kâr mı" belirsizliği doğar.

### Boşluk — 4'ün katları, ara değer yok
```
xs 4 · sm 8 · md 12 · lg 16 · xl 24 · xxl 32 · xxxl 48
```

### Köşe yarıçapı
```
sm 6 · md 10 · lg 14 · pill 999
```

### Tipografi
```
display     30 / 700 / -0.6
title       22 / 700 / -0.3
heading     17 / 600
body        16 / 400
bodyStrong  16 / 600
caption     13 / 400
label       12 / 600 / +0.8
```

### Dokunma hedefi
**Minimum 52pt.** (Apple 44pt öneriyor; sürücü hareket hâlindeki bir araçta
dokunduğu için yükseltildi.) Hiçbir dokunulabilir öğe bunun altına inmez.

---

## Para gösterimi

- Türk Lirası, **₺** simgesi
- Binlik ayracı **nokta**, ondalık ayracı **virgül**: `2.310,50 ₺`
- Rakamlar **hizalı** (tabular figures) — alt alta gelen tutarlar kaymamalı
- Pozitif tutar `positive`, negatif tutar `negative` rengiyle
- Büyük tutarlar okunaklı olmalı; sürücü ekrana yarım saniye bakıyor

---

## İstenen çıktı

1. **Hem açık hem koyu tema** — koyu tema sonradan türetilmiş değil, eşdeğer
2. **Mobil ölçü** (iPhone / Android telefon). Tablet hedef değil.
3. **Bugün sekmesinin üç durumu da** ayrı ayrı
4. Bileşen envanteri: buton varyantları, giriş alanı, çip, kart, liste satırı,
   üç satırlı özet bloğu, tutar girişi, boş durum
5. Alt sekme çubuğu ve ikonografi yönü

## Tasarımın DÜŞMEMESİ gereken tuzaklar

- ❌ Mockup'ta gerçek marka adı / logo (yasal sorun)
- ❌ Tek bir "Kâr" rakamı (üç satır zorunlu)
- ❌ "Yıpranma payını düzenle" alanı (sistem atıyor, kullanıcı dokunmuyor)
- ❌ Web'e özgü düzenler — hover, sticky, karmaşık grid (React Native'de yok)
- ❌ Sefer girişini çok adımlı yapmak (3 saniye kuralı)
- ❌ Koyu temayı sadece renkleri ters çevirerek üretmek
- ❌ Grafik/chart tasarlamak — Faz 3 işi, şimdi gerekmiyor

---

# Tur 2 — revizyon istekleri

Birinci tur (`Sürücüm Mobil.dc.html`) incelendi. Yön onaylandı.
Aşağıdakiler ikinci turda düzeltilecek.

## Onaylananlar — değiştirme

- **Beş sekme**: Anasayfa · Kayıtlar · **Sürüş** (orta, yuvarlak) · İstatistik · Profil.
  Brief'te dört sekme yazıyordu; "Sürüş"ün ayrı sekme olması daha iyi bir karar.
  Açık vardiya bir *durum* değil, bir *yer*.
- **Anasayfa `1c`'nin "gün defteri" düzeniyle olacak** — kart tabanlı `1a` değil.
  Çıkarma işleminin görünür olması ve "HENÜZ ÖDEMEDİĞİNİZ" başlığı korunacak.
- **`1e` tam ekran canlı mod** Sürüş sekmesinin içeriği olacak.
- Palet, boşluk ölçeği, 52px dokunma hedefi aynen kalacak.

## Sefer ekleme sayfası — KULLANICI KARARI

1. **Komisyon ve "cebe kalan" satırları KALDIRILACAK.** Sürücü günde 40 kez
   sefer giriyor; her girişte üç oynayan sayı gereksiz yük. Komisyon zaten
   gün özetinde ayrı satır olarak görünüyor.
   Ekranda yalnızca **brüt tutar** kalacak.
2. **Özel tuş takımı KALDIRILACAK, sistem klavyesi kullanılacak.**
   Sayfa açılınca alan otomatik odaklanır, klavye kendiliğinden gelir.
   - Klavye türü **ondalık** olmalı — Türkçe yerel ayarda virgül verir.
     Özel tuş takımında virgül yoktu ve `187,50 ₺` girilemiyordu; bu tercih
     o sorunu çözüyor.
   - **"Kaydet" butonu klavyenin ÜSTÜNDE durmalı.** iOS'ta sayı klavyesi
     ekranın altını kaplar; buton arkada kalırsa sürücü kaydetmek için önce
     klavyeyi kapatmak zorunda kalır ve kazanılan hız geri verilir.
3. Kazanç kaynağı çipinde oran sessizce görünebilir: `Uygulama A · %20`.
   Hesap değil, sadece etiket — oran yanlış ayarlanmışsa sürücü fark etsin.

## Düzeltilecek hatalar

1. **"Net kazanç" terimi kullanılmayacak.** İstatistik ekranında
   *"NET KAZANÇ · AĞUSTOS"* yazıyor — bu tanımsız bir dördüncü terim.
   Yalnızca **Ciro**, **Cebe kalan**, **Gerçek kâr** kullanılır.
2. **"Boş kilometre %31" kaldırılacak.** Dolu km ile toplam km'yi ayrı
   bilmemiz gerekir, böyle bir veri toplanmıyor.
3. **"Toplam yolcu" → "Toplam sefer".** Bir seferde dört yolcu olabilir;
   biz sefer sayıyoruz. Aynı şekilde "Yolcu başı gelir" → "Sefer başı gelir".
4. **Mockup sayıları kendi içinde tutarlı olmalı.**
   `3.456 ₺ günlük ort. × 25 gün = 86.400` ama net kazanç `54.320` yazıyor.
   Kodlarken olduğu gibi kopyalanma riski var.
5. **Isı şeridi için vurgu renginin ara tonları** (`#4E8E95`, `#8FB9BE`)
   paletin dışından uyduruldu. Bu paletin eksiği — `tokens.ts`'e
   `accentScale` eklenecek, tasarım o adları kullanmalı.

## Eklenecek ekranlar

### Eksik olan ve MUTLAKA gereken

6. **Boş durumlar — her sekme için.** Yedi ekranın yedisi de dolu bir günü
   gösteriyor. Sürücünün **1. günü** hiçbir yerde yok: vardiya kapalı,
   kayıt sıfır, hedef yok, araç yeni eklenmiş, istatistik için veri yetersiz.
   Kullanıcıyı kaybettiğimiz an tam olarak burasıdır.
7. **Negatif gerçek kâr ekranı.** Cebinde 480 ₺ varken zarar etmiş gün.
   Ürünün varlık sebebi o gün; hiçbir mockup'ta yok.
8. **"Sürüş" sekmesinin vardiya kapalı hâli.** Sekme hep duruyor,
   içi ne gösterecek?
9. **İlk kurulum akışı** (bkz. bölüm B, ekran 4–7) — araç ekle, araç detayı,
   kazanç kaynakları, hazırsın. Bunlar olmadan uygulamaya girilemiyor.
10. **Vardiya bitirme sihirbazı** (bkz. bölüm E, ekran 9–11) — mesafe/süre,
    giderler, üç satırlı özet. Ürünün ödül anı.
11. **Gider ekle** ve **yakıt ekle** akışları.
