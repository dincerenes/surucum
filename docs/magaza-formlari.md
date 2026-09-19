# Mağaza gizlilik formları

App Store Connect **App Privacy** ve Google Play Console **Data safety**
formlarına girilecek kalemler. Kaynak, koddan çıkarılmış veri envanteri:
`docs/gizlilik-politikasi.md` bölüm 3. İkisi birebir tutmalı; biri
değişirse diğeri de güncellenir.

Envanter tarihi: **19 Eylül 2026**. Arayüze yeni bir alan (plaka, not,
fiş fotoğrafı…) ya da yeni bir SDK (analitik, çökme raporu, reklam)
eklenirse iki form da yeniden doldurulur.

Kısa özet: **izleme yok, reklam yok, analitik yok, konum yok, üçüncü
tarafla paylaşım yok.** Toplanan her şey hesabın ve uygulamanın
çalışması için; hepsi kullanıcıya bağlı.

---

## Ortak ön koşullar — form gönderilmeden önce

- [ ] **Gizlilik politikası https adresi** — `docs/gizlilik-politikasi.md`
      herkese açık bir sayfada yayında. `[DOLDURULACAK]` alanları
      doldurulmuş ve metin hukukçudan geçmiş.
- [ ] **Uygulama içi bağlantı** — kayıt ekranında ve Profil'de politikaya
      bağlantı (App Store 5.1.1(i)).
- [ ] **Uygulama içi hesap silme** — Profil → Hesabı sil çalışıyor
      (App Store 5.1.1(v); Play hesap silme politikası).
- [ ] **Hesap silme web adresi** — uygulamaya erişimi olmayan kullanıcı
      için talep sayfası. Play bunu ayrı bir alan olarak istiyor.
- [ ] Gerçek SMTP bağlı; e-posta gönderim sağlayıcısı politikada adıyla
      yazılı.

---

## App Store Connect — App Privacy

**Privacy Policy URL:** [DOLDURULACAK: politika adresi]

**Do you or your third-party partners collect data from this app?** Yes

**Tracking:** Hayır. Uygulama başka şirketlerin uygulama ya da
sitelerindeki veriyle birleştirme yapmıyor, reklam kimliği okumuyor.
App Tracking Transparency istemi **gerekmez**.

### Data Linked to You

Hepsi için: *Used for tracking* = **No**.

| Kategori → Tür | Ne | Amaç (Purposes) |
|---|---|---|
| Contact Info → **Email Address** | Hesap e-postası | App Functionality |
| Identifiers → **User ID** | Hesap kimliği (UUID) | App Functionality |
| Financial Info → **Other Financial Info** | Sefer tutarları, ödenen komisyon, gider ve yakıt tutarları, kazanç hedefi | App Functionality |
| User Content → **Other User Content** | Araç bilgileri (ad, marka, model, yıl, km, sahiplik, yakıt tipi, tüketim), vardiya zamanları, çalışılan süre ve km | App Functionality |

### Data Not Collected — bilerek "hayır" denecekler

Location (Precise / Coarse), Contacts, Health & Fitness, Sensitive Info,
Browsing History, Search History, Purchases, Usage Data (Product
Interaction, Advertising Data), Diagnostics (Crash Data, Performance
Data), Photos or Videos, Audio, Physical Address, Phone Number, Name,
Device ID.

Notlar:

- **Name** toplanmıyor: kayıt yalnızca e-posta + parola.
- **Diagnostics** yok: uygulamada çökme raporlama ya da analitik SDK'sı
  yok. Biri eklenirse bu satır değişir.
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
Yes — uygulama içinden (Profil → Hesabı sil) ve web adresinden:
[DOLDURULACAK: hesap silme talep adresi]

### Toplanan veriler

Hepsi için: *Shared* = **No** (veri işleyen altyapı sağlayıcıları Play
tanımında "paylaşım" sayılmaz), *Processed ephemerally* = **No**,
*Required* = **Yes** (hesap olmadan uygulama çalışmıyor; kayıtlar ise
uygulamanın kendisi).

| Kategori → Tür | Ne | Amaç |
|---|---|---|
| Personal info → **Email address** | Hesap e-postası | Account management, App functionality |
| Personal info → **User IDs** | Hesap kimliği (UUID) | Account management, App functionality |
| Financial info → **Other financial info** | Sefer, komisyon, gider, yakıt tutarları; hedef | App functionality |
| App activity → **Other user-generated content** | Araç bilgileri, vardiya zamanları, süre ve km | App functionality |

### Toplanmayanlar — bilerek "hayır" denecekler

Location, Personal info (Name, Address, Phone, Race/ethnicity, Political
or religious beliefs, Sexual orientation, Other info), Financial info
(User payment info, Purchase history, Credit score), Health and fitness,
Messages, Photos and videos, Audio, Files and docs, Calendar, Contacts,
App activity (App interactions, In-app search history, Installed apps,
Other actions), Web browsing, App info and performance (Crash logs,
Diagnostics, Other performance data), Device or other IDs.

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

- **Privacy policy:** [DOLDURULACAK: politika adresi]
- **Target audience:** 18 yaş ve üzeri (ticari araç kullanan yetişkinler).
- **Ads:** Uygulamada reklam yok.
- **App access:** giriş gerektiriyor → inceleme için test hesabı
  [DOLDURULACAK].
