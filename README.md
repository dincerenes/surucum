# Sürücüm

Kendi arabasıyla, bir uygulama üzerinden çalışan sürücüler için kazanç,
gider ve **aracın gerçek maliyetini** takip eden iOS + Android uygulaması.
React Native (Expo), Türkçe arayüz.

Sürücü akşam cebinde 480 ₺ ile eve gider ve kazandığını sanır; aracının o
gün eridiğini görmez. Sürücüm her yerde üç satır gösterir:

| | |
|---|---|
| **Ciro** | Brüt hasılat |
| **Cebe kalan** | Ciro − komisyon − yakıt − gider |
| **Gerçek kâr** | Cebe kalan − aracın km yıpranma payı |

## Neler var

- **Sürüş:** tek tuşla vardiya aç, her yolcuyu tek alanla (tutar) kaydet.
- **Anasayfa:** günlük kazanç, aylık ortalama, verimlilik puanı, son 7 gün.
- **Kayıtlar:** vardiya vardiya döküm.
- **İstatistik → Kazancım:** dönem özeti, verimlilik, sıcak saatlerin,
  yolcu, km ve gider analizi.
- **İstatistik → Pusula:** İstanbul, Ankara, İzmir ve Antalya için şehrin
  tahmini sıcak saatleri, günleri ve bölgeleri.
- **Profil:** araçlar, günlük hedef, tema, destek, hesap silme.

Kayıtlar önce telefonda tutulur, internet olmadan da çalışır; hesabın
yedeği bulutta durur.

## Çalıştırmak

```bash
npm install
npm start            # geliştirme sunucusu
npx expo run:ios     # simülatörde derle ve aç
npm test             # birim testleri
```

Kök dizinde `.env` gerekli (`EXPO_PUBLIC_SUPABASE_URL`,
`EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`). Gerçek iPhone'a kurma adımları ve
diğer komutlar: [docs/mimari.md → Komutlar](docs/mimari.md#komutlar).

## Belgeler

- [docs/mimari.md](docs/mimari.md): mimari kararlar, ürün kuralları,
  klasör yapısı, depo kuralları, durum ve yayın öncesi kalanlar
- [docs/tasarim-brief.md](docs/tasarim-brief.md): tasarım brief'i
- [docs/gizlilik-politikasi.md](docs/gizlilik-politikasi.md),
  [docs/kullanim-kosullari.md](docs/kullanim-kosullari.md): hukuki metinler
- [docs/magaza-formlari.md](docs/magaza-formlari.md): mağaza formları

## Lisans

Özel depo. Tüm hakları saklıdır.
