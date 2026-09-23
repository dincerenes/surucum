# Sürücüm — Gizlilik Politikası ve KVKK Aydınlatma Metni (TASLAK)

> **YAYINDAN ÖNCE HUKUKÇUYA OKUTULMALI.** Bu metin kod taranarak
> hazırlanmış bir taslaktır, hukuki görüş değildir. `[DOLDURULACAK: …]`
> ile işaretli yerler bilerek boş bırakıldı; tahminle doldurulmamalı.
>
> Hukukçuya ayrıca sorulacaklar:
>
> - Posta adresi: veri sorumlusu ev adresini yayımlamak istemiyor. Metin
>   başvuruyu yalnızca kayıtlı e-posta üzerinden alıyor. Yazılı başvuru
>   için KEP adresi ya da sanal ofis adresi gerekip gerekmediği.
> - Yurt dışına aktarım (KVKK md. 9, 2024 değişikliği): verinin Almanya'da
>   durması ve altyapı sağlayıcısının ABD merkezli olması için hangi
>   güvence kullanılacak (standart sözleşme + Kurum'a bildirim vb.).
> - Açık rıza gerekip gerekmediği. Taslak, işlemeyi sözleşmenin ifasına
>   dayandırıyor ve kayıt ekranında onay kutusu değil, aydınlatma
>   bağlantısı öngörüyor.
> - Altyapı sağlayıcılarının adla anılması. Taslak şeffaflık için anıyor;
>   bu, projenin marka adı kuralıyla (kural platform çağrışımını
>   yasaklamak için konmuştu) birlikte değerlendirilmeli.
>
> Mağazalar politikayı herkese açık bir **https** adresinde ister; bu
> dosya o sayfanın kaynağıdır. Uygulama içinde kayıt ekranından ve
> Profil'den bu sayfaya bağlantı verilmelidir.
>
> Veri envanteri 23 Eylül 2026'daki koda göre çıkarıldı. Arayüze yeni
> bir alan eklendiğinde (ör. plaka, not, fiş fotoğrafı) bu metin ve
> `docs/magaza-formlari.md` birlikte güncellenmelidir.

**Yürürlük tarihi:** [DOLDURULACAK: yayın tarihi]
**Son güncelleme:** [DOLDURULACAK]

---

## A. Gizlilik Politikası

### 1. Biz kimiz

Sürücüm, ticari sürücülerin kazancını, giderini ve aracının maliyetini
takip ettiği bir mobil uygulamadır.

- **Veri sorumlusu:** Muhammed Enes Dinçer (gerçek kişi)
- **İletişim:** dincerenes466@gmail.com

### 2. Kısaca

- Yalnızca uygulamanın çalışması için gereken veriyi topluyoruz: hesabın
  için e-posta adresin, adın ve çalıştığın şehir, ve senin
  girdiğin araç ve iş kayıtları.
- **Konumunu almıyoruz** (çalıştığın şehri listeden sen seçiyorsun).
  Rehbere, fotoğraflara, kameraya, mikrofona erişmiyoruz.
- **Reklam yok, izleme yok, analitik yok.** Verini satmıyoruz, reklam
  için kullanmıyoruz, başka uygulamalardaki davranışını izlemiyoruz.
- Kayıtların önce **telefonunda** tutulur; hesabına bağlı bir yedeği
  Almanya'daki (Frankfurt) sunucularda saklanır.
- Hesabını ve tüm verini silebilirsin (bkz. 9. bölüm).

### 3. Topladığımız veriler

**3.1 Hesap bilgileri**

| Veri | Neden |
|---|---|
| E-posta adresi | Hesabın kimliği, giriş ve şifre sıfırlama |
| Parola | Giriş. Sunucuda yalnızca tek yönlü özeti (hash) saklanır; parolanın açık hâlini biz de göremeyiz |
| Hesap kimliği (rastgele üretilmiş bir numara) | Kayıtlarını hesabına bağlamak |
| Oturum anahtarları | Her açılışta yeniden giriş yapmaman için. Yalnızca telefonunda saklanır |
| Giriş sırasında IP adresi, cihaz / tarayıcı bilgisi, giriş zamanı | Kimlik doğrulama hizmetinin güvenlik kayıtları (kötüye kullanımı ve yetkisiz girişi tespit etmek) |

**3.2 Profil bilgileri** — senin girdiklerin

Ad ve şehir kurulumda sorulur; istediğin zaman Profil'den değiştirebilirsin.
Kullanmak istediğin adı yazman yeterli, kimlik doğrulaması yapılmaz.

| Veri | Neden |
|---|---|
| Ad soyad (ya da kullanmak istediğin ad) | Uygulamada seni adınla karşılamak |
| Çalıştığın şehir | Profilinde göstermek. Listeden seçilir; telefonunun konumundan alınmaz |
| Profil simgesi (hazır simge ve renk, isteğe bağlı) | Profilinde göstermek. Fotoğraf yüklenmez |

**3.3 Araç bilgileri** — senin girdiklerin

- Araç adı, marka, model, model yılı, vites tipi, yakıt tipi, sahiplik
  biçimi (kendi aracın, kiralık vb.), ortalama yakıt tüketimi ve son litre
  fiyatı.
- Aracın güncel kilometresi, ikinci el piyasa değeri ve hasar kaydı olup
  olmadığı (isteğe bağlı).
- Periyodik bakımı ve lastik değişimini kaç kilometrede bir yaptırdığın ve
  bunların maliyeti (isteğe bağlı).

Kilometre başına yıpranma payı bu cevaplardan uygulama tarafından
hesaplanır; boş bıraktığın kalem için ortalama bir tahmin kullanılır.

**3.4 İş kayıtların** — senin girdiklerin

- **Vardiya:** başlangıç ve bitiş zamanı, iş günü, yaptığın kilometre,
  çalıştığın süre, o gün uygulamaya ödediğin komisyon tutarı, ortalama
  tüketim ve yakıt fiyatı.
- **Yolcu (sefer):** tutar ve kayıt zamanı.
- **Gider:** tutar, kategori (yemek, otopark vb.) ve zaman.
- **Yakıt dolumu:** ödenen tutar, litre fiyatı, litre ve zaman.
- **Hedef:** belirlediğin kazanç hedefi.
- **Ayarlar:** seçili araç gibi hesap ayarları.

Bu kayıtlar **finansal niteliktedir** ve zaman bilgileri çalışma düzenini
(hangi gün, hangi saatlerde çalıştığını) gösterir. Bu yüzden yalnızca
aşağıdaki amaçlarla işlenir.

**3.5 Geri bildirimlerin** — uygulama içinden gönderdiğin

Konu (hata, istek, öneri, diğer), yazdığın mesaj, uygulamanın sürümü ve
telefonunun işletim sistemi ve sürümü (ör. "ios 26"). Sürüm bilgisi
bildirdiğin hatayı bulabilmek için alınır. Geri bildirimlerini gönderdikten
sonra uygulamada göremez ve değiştiremezsin; hesabın silinince onlar da
silinir.

**3.6 Yalnızca telefonunda kalanlar**

Tema tercihin (sistem / açık / koyu) ve senkronizasyonun teknik durumu (hangi
kaydın henüz yedeklenmediği gibi) telefonunda kalır, sunucuya gönderilmez.

**3.7 Toplamadıklarımız**

Konum, rehber, fotoğraf ve kamera, mikrofon, reklam kimliği, kullanım
analitiği, çökme raporu. Uygulamada reklam ya da izleme amaçlı üçüncü
taraf yazılım bulunmaz. Plaka, not ve fiş gibi alanlar uygulamada şu an
sorulmaz.

### 4. Verileri ne için kullanıyoruz

1. Hesabını oluşturmak ve seni tanımak (giriş, şifre sıfırlama).
2. Kayıtlarından ciro, cebe kalan ve gerçek kâr hesaplarını ve
   raporlarını üretmek. Hesaplar telefonunda yapılır.
3. Kayıtlarını yedeklemek, telefon değiştirdiğinde ya da uygulamayı
   yeniden kurduğunda geri yüklemek, birden fazla cihazda aynı hesabı
   kullanmanı sağlamak.
4. Hizmetin güvenliğini sağlamak, hataları ve veri bütünlüğü sorunlarını
   tespit edip düzeltmek, destek taleplerini yanıtlamak.
5. Yasal yükümlülükleri yerine getirmek.

Verini pazarlama, reklam, profil çıkarma ya da satış için kullanmayız.
E-posta adresine yalnızca hesabınla ilgili zorunlu iletiler (doğrulama,
şifre sıfırlama) gönderilir.

### 5. Veriler nerede saklanıyor

- **Telefonunda:** uygulamanın kendi korumalı alanındaki yerel
  veritabanında. Uygulama bu dosyayı ayrıca şifrelemez; korumayı
  telefonunun ekran kilidi ve cihaz şifrelemesi sağlar.
  - Android'de uygulama verisi telefonun sistem yedeğine **dahil
    edilmez**; geri yükleme yalnızca hesabın üzerinden, bulut yedeğinden
    yapılır.
  - iOS'ta telefonun kendi yedeği (iCloud ya da bilgisayar yedeği)
    uygulama verisini içerebilir; bu yedek senin Apple hesabına bağlıdır.
- **Bulutta:** Supabase veritabanı ve kimlik doğrulama hizmetinde.
  Sunucular Amazon Web Services'in **Frankfurt, Almanya** (eu-central-1)
  bölgesindedir. Telefon ile sunucu arasındaki tüm iletişim TLS ile
  şifrelenir.
- Her kullanıcı yalnızca kendi kayıtlarını okuyup yazabilir; bu kural
  veritabanı düzeyinde (satır bazlı güvenlik) zorlanır.

### 6. Verileri kimlerle paylaşıyoruz

Verini satmayız, kiralamayız, reklam ağlarıyla paylaşmayız. Yalnızca
hizmeti yürütmek için şu alıcılar veriye erişebilir:

| Alıcı | Ne için | Nerede |
|---|---|---|
| Supabase (veritabanı ve kimlik doğrulama altyapısı) | Hesabının ve kayıtlarının saklanması | Almanya (Frankfurt); şirket ABD merkezli |
| E-posta gönderim hizmeti | Doğrulama ve şifre sıfırlama e-postaları | [DOLDURULACAK: sağlayıcı adı ve ülkesi — henüz seçilmedi] |
| Yetkili personelimiz | Destek, hata ve veri bütünlüğü incelemesi | — |
| Yetkili kamu kurumları | Yalnızca yasal zorunluluk hâlinde | — |

**Yetkili personel erişimi:** Destek ve bütünlük denetimi için yetkili
personel özel olarak yazılmış ve denetlenen yönetim fonksiyonları
üzerinden kayıtlara erişebilir. Bir kullanıcının ham kayıtlarına her
erişim, kimin hangi hesaba ve hangi kayıtlara baktığıyla birlikte
**denetim kaydına** yazılır.

**Yurt dışına aktarım:** Verilerin Avrupa Birliği içinde (Almanya)
saklanması Türkiye dışına aktarım sayılır. Aktarım KVKK md. 9 kapsamında
[DOLDURULACAK: hukukçu — dayanılan aktarım mekanizması] ile yapılır.

### 7. Ne kadar süre saklıyoruz

- Hesabın açık olduğu sürece.
- Uygulamada sildiğin bir kayıt önce "silindi" olarak işaretlenir, böylece
  diğer cihazlarından da kalkar; bu işaretli kopya hesabın silinene kadar
  bulutta kalır. [DOLDURULACAK: işaretli kayıtların ayrıca kalıcı silinme
  süresi belirlenecekse]
- Hesabını sildiğinde kayıtların silme anında kalıcı olarak silinir. Sunucu yedeklerindeki kopyalar yedek
  saklama süresi dolunca kendiliğinden silinir: [DOLDURULACAK: yedek
  saklama süresi].
- Denetim kayıtları güvenlik ve hesap verebilirlik amacıyla
  [DOLDURULACAK: süre] saklanır; bunlarda hesap kimliğin (rastgele
  numara) bulunur, kayıtlarının içeriği bulunmaz.
- Kimlik doğrulama hizmetinin güvenlik kayıtları (IP, giriş zamanı)
  [DOLDURULACAK: süre] saklanır.

### 8. Güvenlik

Aktarımda TLS şifrelemesi, veritabanı düzeyinde satır bazlı erişim
denetimi, parolaların yalnızca özet olarak saklanması ve yetkili personel
erişimlerinin kayıt altına alınması uyguladığımız başlıca önlemlerdir.
Hiçbir sistem kusursuz değildir; bir ihlal olursa KVKK md. 12 uyarınca
Kurul'a ve etkilenen kullanıcılara bildirim yapılır.

### 9. Hesabını ve verini silme

- **Uygulama içinden:** Profil → **Hesabımı sil**. Onayından sonra
  hesabın ve bulutta saklanan tüm kayıtların (geri bildirimlerin dahil)
  silinir, telefonundaki veriler temizlenir. Bu işlem geri alınamaz.
- **Uygulamaya erişimin yoksa:** [DOLDURULACAK: hesap silme talep sayfasının
  https adresi] — Google Play bu adresi ayrıca ister.
- Uygulamayı telefondan kaldırmak yalnızca telefondaki kopyayı siler;
  bulut yedeği hesabın silinene kadar durur.

### 10. Hakların

KVKK md. 11 uyarınca, kişisel verilerinle ilgili olarak:

- işlenip işlenmediğini öğrenme,
- işlenmişse buna ilişkin bilgi talep etme,
- işlenme amacını ve amacına uygun kullanılıp kullanılmadığını öğrenme,
- yurt içinde veya yurt dışında aktarıldığı üçüncü kişileri bilme,
- eksik veya yanlış işlenmişse düzeltilmesini isteme,
- KVKK md. 7'deki şartlar çerçevesinde silinmesini veya yok edilmesini
  isteme,
- düzeltme ve silme işlemlerinin aktarıldığı üçüncü kişilere
  bildirilmesini isteme,
- münhasıran otomatik sistemlerle analiz edilmesi sonucu aleyhine bir
  sonuç çıkmasına itiraz etme,
- kanuna aykırı işlenmesi sebebiyle zarara uğraman hâlinde zararın
  giderilmesini talep etme

haklarına sahipsin. Kayıtlarının çoğunu uygulama içinden kendin
görüntüleyebilir, düzeltebilir ve silebilirsin.

**Başvuru:** hesabına kayıtlı e-posta adresinden dincerenes466@gmail.com adresine
yazarak. Başvurular en geç **30 gün** içinde ücretsiz yanıtlanır
(KVKK md. 13). Yanıttan memnun kalmazsan Kişisel Verileri Koruma
Kurulu'na şikâyette bulunabilirsin.

### 11. Çocuklar

Uygulama ticari araç kullanan yetişkinlere yöneliktir; 18 yaşından
küçüklere yönelik değildir ve bilerek onlardan veri toplamayız.

### 12. Değişiklikler

Bu politikayı değiştirdiğimizde güncel metni bu sayfada yayımlar, önemli
değişiklikleri uygulama içinde duyururuz.

---

## B. KVKK Aydınlatma Metni

6698 sayılı Kişisel Verilerin Korunması Kanunu'nun 10. maddesi uyarınca:

**1. Veri sorumlusu:** Muhammed Enes Dinçer (gerçek kişi) — dincerenes466@gmail.com

**2. İşlenen kişisel veriler**

- Kimlik ve iletişim: e-posta adresi, hesap kimliği, ad soyad.
- Müşteri işlem ve finansal bilgiler: sefer tutarları, ödenen komisyon,
  gider ve yakıt tutarları, kazanç hedefi.
- Araç bilgileri: araç adı, marka, model, model yılı, vites, kilometre,
  sahiplik biçimi, yakıt tipi ve tüketimi, piyasa değeri, hasar kaydı,
  bakım ve lastik aralıkları ile maliyetleri.
- Profil bilgileri: çalışılan şehir ve (isteğe bağlı) profil simgesi.
- Talep ve şikâyet bilgileri: uygulama içinden gönderilen geri bildirimler,
  uygulama sürümü ve işletim sistemi bilgisi.
- Çalışma bilgileri: vardiya başlangıç / bitiş zamanları, çalışılan süre
  ve kilometre.
- İşlem güvenliği: parola özeti, oturum anahtarları, giriş sırasında IP
  adresi, cihaz / tarayıcı bilgisi ve giriş zamanı; yetkili personel
  erişimlerine ilişkin denetim kayıtları.

**3. İşleme amaçları:** üyelik ve hesap işlemlerinin yürütülmesi;
uygulamanın sunduğu kazanç ve maliyet hesaplarının yapılması; verilerin
yedeklenmesi, geri yüklenmesi ve cihazlar arasında eşitlenmesi; bilgi
güvenliği süreçlerinin ve destek taleplerinin yürütülmesi; yetkili kurum
taleplerinin ve hukuki yükümlülüklerin yerine getirilmesi.

**4. Hukuki sebepler (KVKK md. 5/2):**

- (c) bir sözleşmenin kurulması veya ifasıyla doğrudan ilgili olması —
  hesap ve uygulama hizmeti;
- (ç) veri sorumlusunun hukuki yükümlülüğünü yerine getirebilmesi;
- (f) ilgili kişinin temel hak ve özgürlüklerine zarar vermemek kaydıyla
  veri sorumlusunun meşru menfaati — güvenlik ve denetim kayıtları.

[DOLDURULACAK: hukukçu — yurt dışına aktarım için ayrıca dayanılan
md. 9 mekanizması]

**5. Aktarım:** Veriler, hizmetin sağlanması amacıyla veri işleyen
sıfatıyla bulut altyapı sağlayıcısına (Supabase; sunucular Almanya,
Frankfurt) ve e-posta gönderim hizmetine [DOLDURULACAK: sağlayıcı]
aktarılır; yasal zorunluluk hâlinde yetkili kamu kurum ve kuruluşlarıyla
paylaşılabilir. Pazarlama ya da reklam amacıyla üçüncü kişilere
aktarılmaz.

**6. Toplama yöntemi:** Veriler, uygulama arayüzü üzerinden senin
girişinle ve hesabın kullanımı sırasında otomatik olarak, elektronik
ortamda toplanır.

**7. Hakların:** KVKK md. 11'de sayılan haklarını (bkz. A-10)
hesabına kayıtlı e-posta adresinden dincerenes466@gmail.com adresine yazarak
kullanabilirsin.
