# Bilinen güvenlik uyarıları

`npm audit --omit=dev` bugün **14 moderate** uyarı veriyor; high ya da
critical yok. Uyarıların hepsi iki kök advisory'den türüyor. İkisi de bu
uygulamada fiilen erişilebilir değil ve ikisinin de npm'in önerdiği
düzeltmesi uygulanamaz, bu yüzden bilerek bekletiliyorlar.

CI `npm audit --omit=dev --audit-level=high` çalıştırıyor: bu iki
moderate uyarı kapıyı kilitlemiyor, yeni bir high/critical gelirse iş
kırmızıya döner.

Son değerlendirme: **19 Eylül 2026** (expo 57.0.23, expo-router 57.0.21).

> `npm audit fix --force` ÇALIŞTIRILMAZ. Önerdiği "düzeltme"
> expo-router 5.1.11 ve expo-splash-screen 55'e düşürmek; ikisi de SDK
> 57 ile uyumsuz, uygulamayı derlenmez hâle getirir.

---

## 1. decode-uri-component — GHSA-vcc3-ghjq-m6fr

**Ne:** Bozuk yüzde kodlamalı (`%`) bir girdi üstel süreli çözümlemeye
yol açıyor; hizmet dışı bırakma. Etkilenen aralık `<=0.4.2`, ilk düzeltme
`0.5.0`.

**Zincir:** `expo-router@57.0.21` → `query-string@7.1.3` →
`decode-uri-component@0.2.2`. Sürüm olarak gerçekten etkilenen aralıkta.

**Neden erişilebilir değil:**

- `query-string` savunmasız fonksiyonu yalnızca `parse` yolunda çağırıyor.
- expo-router'da `queryString.parse` yalnızca kendi içine aldığı eski
  React Navigation kopyasında geçiyor
  (`build/react-navigation/core/getStateFromPath.js`). Gelen bağlantılar
  bu yoldan değil, expo-router'ın kendi çatalından
  (`build/fork/getStateFromPath*.js`) geçiyor ve o çatal `URL` /
  `URLSearchParams` kullanıyor.
- Yol üretimi (`getPathFromState`) yalnızca `stringify` çağırıyor; o da
  çözümleme yapmıyor.
- En kötü senaryo bile uzak değil yerel: özel hazırlanmış bir
  `surucum://` bağlantısının kullanıcının kendi cihazında uygulamayı
  dondurması. Sunucu tarafı yok.

**Neden override edilmedi:** `decode-uri-component@0.5.0` yalnızca ESM
(`"type": "module"`, tek `default` dışa aktarım). `query-string@7`
onu `require()` ile çağırıyor; override edilince `require` sonucu
`{ default }` nesnesi oluyor ve `decodeComponent is not a function`
hatasıyla `parse` çalışma zamanında kırılıyor. Birim testleri bunu
yakalamaz, çünkü testler expo-router yüklemiyor — kırılma ancak cihazda
bir bağlantı açılınca görünür. Uyarıyı susturmak için uygulamayı
bozmak kabul edilemez.

**Ne zaman tekrar bakılır:**

- expo-router `query-string@8+`'e geçtiğinde ya da bağımlılığı
  kaldırdığında — her SDK / expo-router güncellemesinde
  `npm ls decode-uri-component` kontrol edilir.
- Uygulama gelen bağlantıdan parametre okumaya başladığında (ör. e-posta
  doğrulama / şifre sıfırlama dönüşü için derin bağlantı). O zaman
  bağlantı ayrıştırması `query-string` üzerinden değil, uzunluk sınırlı
  kendi fonksiyonumuzla yapılmalı.
- Advisory high/critical'a yükseltilirse (CI zaten kırmızıya döner).

---

## 2. uuid — GHSA-w5hq-g745-h8pq

**Ne:** `uuid` v3/v5/v6'da, çağıran bir `buf` tamponu verdiğinde sınır
denetimi eksik. Etkilenen aralık `<11.1.1`.

**Zincir:** `expo` / `expo-splash-screen` → `@expo/config-plugins@57.0.9`
→ `xcode@3.0.1` → `uuid@7.0.3`. Audit'teki diğer satırlar (`@expo/cli`,
`@expo/config`, `@expo/prebuild-config` …) hep aynı zincirin halkaları.

**Neden erişilebilir değil:**

- Yalnızca **derleme aracı**: `xcode` paketi `expo prebuild` sırasında
  Node'da Xcode projesini düzenlemek için yükleniyor. Uygulama paketine
  (Hermes) girmiyor.
- `xcode` yalnızca `uuid.v4()` çağırıyor; advisory v3/v5/v6'nın `buf`
  parametresiyle ilgili.
- Uygulamanın kendi kimlik üretimi `uuid@14.0.2` kullanıyor, etkilenen
  aralığın dışında.

**Neden override edilmedi:** Susturmaktan başka kazancı yok. Kapsamlı bir
override (`"overrides": { "xcode": { "uuid": "^11.1.1" } }`) teknik
olarak mümkün ama Expo'nun prebuild zincirine test edilmemiş bir sürüm
sokar; kırılırsa ancak `expo prebuild` sırasında görülür.

**Ne zaman tekrar bakılır:**

- `@expo/config-plugins` `xcode`'un daha yeni bir sürümüne ya da
  `uuid@11.1.1+`'e geçtiğinde — her SDK güncellemesinde
  `npm ls uuid` kontrol edilir.
- Advisory `v4`'ü de kapsayacak şekilde genişlerse.

---

## Kontrol komutları

```bash
npm audit --omit=dev                      # güncel tablo
npm ls decode-uri-component uuid          # zincirler hâlâ aynı mı
npx expo install --check                  # SDK ile hizalı güncellemeler
```
