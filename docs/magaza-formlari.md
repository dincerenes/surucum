# Mağaza gizlilik formları

App Store Connect **App Privacy** ve Google Play Console **Data safety**
formlarına girilecek kalemler. Kaynak, koddan çıkarılmış veri envanteri:
`docs/gizlilik-politikasi.md` bölüm 3. İkisi birebir tutmalı; biri
değişirse diğeri de güncellenir.

Envanter tarihi: **23 Eylül 2026**. Arayüze yeni bir alan (plaka, not,
fiş fotoğrafı…) ya da yeni bir SDK (analitik, çökme raporu, reklam)
eklenirse iki form da yeniden doldurulur.

Kısa özet: **izleme yok, reklam yok, analitik yok, cihaz konumu yok,
üçüncü tarafla paylaşım yok.** Toplanan her şey hesabın ve uygulamanın
çalışması için; hepsi kullanıcıya bağlı.

---

## Ortak ön koşullar — form gönderilmeden önce

- [ ] **Gizlilik politikası https adresi** — `docs/gizlilik-politikasi.md`
      herkese açık bir sayfada yayında. `[DOLDURULACAK]` alanları
      doldurulmuş ve metin hukukçudan geçmiş.
- [x] **Uygulama içi bağlantı** — kayıt ekranında ve Profil'de politikaya
      bağlantı (App Store 5.1.1(i)).
- [x] **Uygulama içi hesap silme** — Profil → Hesabımı sil çalışıyor
      (App Store 5.1.1(v); Play hesap silme politikası).
- [x] **Hesap silme web adresi** — uygulamaya erişimi olmayan kullanıcı
      için talep sayfası. Play bunu ayrı bir alan olarak istiyor.
      https://dincerenes.github.io/surucum-yasal/hesap-silme.html
- [ ] Gerçek SMTP bağlı (Gmail, surucumappdestek@gmail.com); sağlayıcı
      politikada adıyla yazılı.

---

## App Store Connect — App Privacy

**Privacy Policy URL:** https://dincerenes.github.io/surucum-yasal/

**Do you or your third-party partners collect data from this app?** Yes

**Tracking:** Hayır. Uygulama başka şirketlerin uygulama ya da
sitelerindeki veriyle birleştirme yapmıyor, reklam kimliği okumuyor.
App Tracking Transparency istemi **gerekmez**.

### Data Linked to You

Hepsi için: *Used for tracking* = **No**.

| Kategori → Tür | Ne | Amaç (Purposes) |
|---|---|---|
| Contact Info → **Email Address** | Hesap e-postası | App Functionality |
| Contact Info → **Name** | Sürücünün yazdığı ad (selamlama, profil) | App Functionality |
| Location → **Coarse Location** | Sürücünün listeden seçtiği çalıştığı şehir — cihaz konumu değil | App Functionality |
| Identifiers → **User ID** | Hesap kimliği (UUID) | App Functionality |
| Financial Info → **Other Financial Info** | Sefer tutarları, ödenen komisyon, gider ve yakıt tutarları, kazanç hedefi | App Functionality |
| User Content → **Customer Support** | Uygulama içinden gönderilen geri bildirim mesajları | App Functionality |
| User Content → **Other User Content** | Araç bilgileri (ad, marka, model, yıl, vites, km, sahiplik, yakıt tipi, tüketim, piyasa değeri, hasar kaydı, bakım/lastik aralığı ve maliyeti), profil simgesi, vardiya zamanları, çalışılan süre ve km | App Functionality |
| Diagnostics → **Other Diagnostic Data** | Geri bildirimle birlikte gönderilen uygulama sürümü ve işletim sistemi sürümü | App Functionality |

### Data Not Collected — bilerek "hayır" denecekler

Precise Location, Contacts, Health & Fitness, Sensitive Info,
Browsing History, Search History, Purchases, Usage Data (Product
Interaction, Advertising Data), Diagnostics (Crash Data, Performance
Data), Photos or Videos, Audio, Physical Address, Phone Number,
Device ID.

Notlar:

- **Name** toplanıyor: kurulumun ilk adımı ad soruyor (23 Eylül 2026'dan
  beri). Kimlik doğrulaması yok, sürücü istediği adı yazabiliyor.
- **Coarse Location** temkinli beyan: cihazdan konum okunmuyor, ama
  sürücünün seçtiği şehir Apple'ın "kaba konum" tanımına giriyor.
- **Diagnostics** yalnızca geri bildirimin yanındaki sürüm bilgisi:
  uygulamada çökme raporlama ya da analitik SDK'sı yok. Biri eklenirse
  Crash / Performance satırları da değişir.
- Kimlik doğrulama hizmeti girişlerde IP adresini güvenlik kaydı olarak
  tutuyor. Apple'da ayrı bir "IP adresi" türü yok ve konum çıkarmak için
  kullanılmıyor; politikada açıkça yazılı. Hukukçu ya da App Review
  aksini isterse bu karar yeniden değerlendirilir.

### İnceleme notları (App Review Information)

- Demo hesap: [DOLDURULACAK: inceleme için test hesabı e-posta/parola]
  — kayıt olmadan uygulama açılmıyor, Apple test hesabı ister.
- Şifreleme beyanı `app.json` → `ios.config.usesNonExemptEncryption:
  false` ile derlemeye giriyor; TestFlight'ta soru sorulmamalı.
- **Privacy manifest:** ilk yüklemede App Store Connect "ITMS-91053
  Missing API declaration" e-postası gönderirse bildirilen API'ler
  `app.json` → `ios.privacyManifests` altına gerekçe koduyla eklenir.

---

## Google Play Console — Data safety

**Does your app collect or share any of the required user data types?** Yes

**Is all of the user data collected by your app encrypted in transit?** Yes (TLS)

**Do you provide a way for users to request that their data is deleted?**
Yes — uygulama içinden (Profil → Hesabımı sil) ve web adresinden:
https://dincerenes.github.io/surucum-yasal/hesap-silme.html

### Toplanan veriler

Hepsi için: *Shared* = **No** (veri işleyen altyapı sağlayıcıları Play
tanımında "paylaşım" sayılmaz), *Processed ephemerally* = **No**,
*Required* = **Yes** (hesap olmadan uygulama çalışmıyor; kayıtlar ise
uygulamanın kendisi).

| Kategori → Tür | Ne | Amaç |
|---|---|---|
| Personal info → **Email address** | Hesap e-postası | Account management, App functionality |
| Personal info → **User IDs** | Hesap kimliği (UUID) | Account management, App functionality |
| Personal info → **Name** | Sürücünün yazdığı ad | App functionality |
| Location → **Approximate location** | Sürücünün listeden seçtiği şehir — cihaz konumu değil | App functionality |
| Financial info → **Other financial info** | Sefer, komisyon, gider, yakıt tutarları; hedef | App functionality |
| App activity → **Other user-generated content** | Araç bilgileri (piyasa değeri, hasar kaydı, bakım/lastik dahil), profil simgesi, vardiya zamanları, süre ve km, geri bildirim mesajları | App functionality |
| App info and performance → **Diagnostics** | Geri bildirimle gönderilen uygulama ve işletim sistemi sürümü | App functionality |

### Toplanmayanlar — bilerek "hayır" denecekler

Precise location, Personal info (Address, Phone, Race/ethnicity, Political
or religious beliefs, Sexual orientation, Other info), Financial info
(User payment info, Purchase history, Credit score), Health and fitness,
Messages, Photos and videos, Audio, Files and docs, Calendar, Contacts,
App activity (App interactions, In-app search history, Installed apps,
Other actions), Web browsing, App info and performance (Crash logs,
Other performance data), Device or other IDs.

Notlar:

- **Device or other IDs** yok: reklam kimliği okunmuyor, manifestte
  `AD_ID` izni yok.
- Release manifestindeki izinler yalnızca `INTERNET` ve `VIBRATE`.
  `SYSTEM_ALERT_WINDOW` ve harici depolama `app.json` →
  `android.blockedPermissions` ile çıkarıldı; `npx expo prebuild
  --platform android` sonrası `tools:node="remove"` görülmeli.
- `android.allowBackup: false` — uygulama verisi Google yedeğine
  gitmiyor; politikada da böyle yazıyor.

### Diğer Play alanları

- **Privacy policy:** https://dincerenes.github.io/surucum-yasal/
- **Target audience:** 18 yaş ve üzeri (ticari araç kullanan yetişkinler).
- **Ads:** Uygulamada reklam yok.
- **App access:** giriş gerektiriyor → inceleme için test hesabı
  [DOLDURULACAK].
