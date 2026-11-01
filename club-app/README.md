# MAKARA Club — müşteri sadakat uygulaması

McDonald's / Starbucks uygulamalarındaki gibi: müşteri kasada kodunu okutur, harcadığı
her ₺ için puan kazanır, puanlarını menüdeki ürünlere çevirir. Sade, ürün odaklı arayüz;
menü, fiyatlar, içerikler ve ürün fotoğrafları POS veritabanından gelir.

## Neler var

**Müşteri uygulaması** (telefon, PWA — "Ana Ekrana Ekle" ile uygulama gibi açılır)

Düzen Starbucks ve McDonald's Türkiye uygulamalarının alışılmış yapısını izler (pembe-beyaz):

- Üyelik: ad, telefon, e-posta, şifre, doğum günü · üye olana 250 puan hediye
- **Ana Sayfa**: pembe başlıkta puan bakiyesi, sıradaki ödülün fotoğraflı ilerleme halkası, seviye rozeti;
  üyelik kartı ("Kodumu göster"), "Senin İçin" kampanya kartları, ödül rafı
- **Menü**: fotoğraflı kategori ızgarası → kategori sayfası → ürün detayı (fiyat, kalori, içindekiler,
  alerjenler, kazanılacak puan); arama ve Favorilerim
- **Ortadaki QR butonu**: kasada okutulan üyelik kodu
- **Ödüller**: QR kartı, degrade halkalı ödül kartları (puan seviyelerine göre "Hepsini gör"), Fırsatlar;
  "Ödülü kullan" → 10 dakika geçerli, tek kullanımlık QR
- **Diğer**: Hesabım, puan geçmişi, seviye ve kazanım, şubeler (yol tarifi), hakkımızda
- **Kampanyalar**: Çarşamba 2x puan, hafta içi 08–11 1,5x puan, doğum günü hediyesi (kasada otomatik uygulanır)
- **Seviyeler**: Pembe → Gül (+%10) → Elmas (+%20)

**Kasa paneli** — aynı uygulamada `#kasa` adresi (tablet / kasa bilgisayarı)

- Kamerayla QR okutma (iOS dahil), USB/Bluetooth el tipi okuyucu desteği, kod veya telefonla arama
- Tutarı tuş takımıyla gir → kampanya ve seviye bonusu hesaplanmış puanı yükle
- Ödül QR'ını okut → süre ve bakiye kontrolü → onayla (aynı kod ikinci kez kullanılamaz)
- Şube seçimi (Havzan / Suriçi), oturum içi işlem listesi

## Hemen dene (demo modu)

```bash
cd club-app
npm install
npm run dev          # http://localhost:5175
```

Firebase ayarı girilmediği sürece uygulama **demo modunda** çalışır: veriler yalnızca o
tarayıcıda saklanır. Üye ol → ana sayfadaki "Alışveriş yap" ile puan kazan ya da
Hesabım → "Kasa panelini aç" (şifre `1234`) ile ikinci sekmede gerçek kasa akışını dene;
iki sekme anlık senkronlanır.

## Menü ve ürün fotoğrafları

Menü, uygulamaya gömülü bir katalogdan gelir (`public/catalog/`). Müşteri telefonları POS
veritabanına hiç bağlanmaz; böylece Firestore okuma kotanız tükenmez ve menü hızlı açılır.
Menü, fiyat veya fotoğraf değiştiğinde:

```bash
cd club-app
npm run sync:catalog        # önce Havzan (makara-16344), olmazsa Suriçi veritabanını okur
npm run sync:catalog -- --project makarasurici
```

Betik kategorileri ve ürünleri okur, ürün fotoğraflarını (kasanın da kullandığı `image_base64` alanından; yoksa
görsel adresinden) alıp 480 px WebP'ye küçültür. Ardından uygulamayı yeniden yayınlayın.
Fotoğrafı olmayan ürünlerde kategoriye uygun sade bir ikon gösterilir.

## Gerçek kullanıma alma (Firebase)

Puanlar para değerinde olduğu için **ayrı bir Firebase projesi** önerilir; mevcut POS
projelerindeki Firestore kuralları herkese açık (`allow read, write: if true`) ve orada
müşteri puanları korunamaz.

1. [Firebase Console](https://console.firebase.google.com) → yeni proje (ör. `makara-club`).
2. **Authentication** → Sign-in method → *E-posta/Şifre* ve *Google*'ı etkinleştirin.
   Authorized domains'e uygulamanın yayınlanacağı alan adını ekleyin.
3. **Firestore Database** oluşturun (bölge olarak ör. `europe-west`).
4. Proje ayarları → Web uygulaması ekle → çıkan değerleri `club-app/.env.local` dosyasına yazın
   (`.env.example` şablon).
5. Güvenlik kurallarını yükleyin:
   ```bash
   cd club-app
   npx firebase-tools deploy --only firestore:rules --project <proje-id>
   ```
6. **Kasa personeli**: Authentication → Users → personel için e-posta/şifre ile kullanıcı ekleyin,
   UID'sini kopyalayın. Firestore'da `staff/<UID>` belgesi oluşturun: `{ name: "Havzan Kasa" }`.
   Yalnızca bu belgesi olan hesaplar `#kasa` paneline girip puan yükleyebilir.

### Güvenlik modeli (`firestore.rules`)

- Müşteri yalnızca **kendi** üyeliğini okur; puan alanlarını değiştiremez (yalnızca ad, telefon, doğum günü).
- Üyelik ilk kez 250 puanla oluşturulabilir; `codes/{üyeKodu}` kaydı kodun benzersizliğini garanti eder.
- Puan yükleme ve ödül harcama sadece `staff/{uid}` kaydı olan personelle, işlem (transaction) içinde yapılır.
- Kullanılan ödül kodları `redemptions/` altında tutulur; aynı QR iki kez okutulamaz.

## Yayınlama

**Mevcut hosting altında** (`makara-16344.web.app/club/`):

```bash
npm run build:club          # kök dizinden → public/club
npm run deploy:web
```

**Ayrı site / alan adı** (ör. `club.makara.network`): `club-app` içinde `npm run build`,
`dist/` klasörünü Firebase Hosting'e yükleyin (`club-app/firebase.json` hazır) ve alan adını
Hosting → Custom domain'den bağlayın. Uygulama göreli yollarla derlendiği için her iki yöntem de çalışır.

## Özelleştirme

Tüm iş kuralları tek dosyada: [`src/config/loyalty.js`](src/config/loyalty.js)

- `PROGRAM.pointsPerTL` — 1 ₺ başına puan (varsayılan 1)
- `PROGRAM.welcomeBonus` — hoş geldin puanı (değiştirirseniz `firestore.rules` içindeki `welcomeBonus()` ile eşleyin)
- `TIERS` — seviye eşikleri ve bonusları
- `REWARDS` — ödüller ve puan bedelleri; `match` ile menüdeki ürüne bağlanır (ad, fotoğraf, içerik oradan gelir)
- `OFFERS` — kampanyalar; `multiplier` + `days` / `hours` olanlar kasada otomatik uygulanır
- `BRANCHES` — şubeler ve harita bağlantıları

Ödül puanları örnek değerlerdir; menü fiyatlarınıza göre ayarlayın.

## Yapı

```
club-app/
├── firestore.rules          Firestore güvenlik kuralları
├── scripts/sync-catalog.mjs menüyü POS veritabanından çeker
├── src/
│   ├── config/              loyalty.js (kurallar), firebase.js (ortam değişkenleri)
│   ├── data/                katalog, demo (localStorage) ve Firebase arka uçları, QR/kod yardımcıları
│   ├── screens/             müşteri ekranları
│   ├── kasa/                kasa paneli ve QR tarayıcı
│   └── components/          tab bar, alt sayfa, QR, ürün görseli…
└── public/                  logo, ikonlar, manifest, service worker, catalog/ (menü + fotoğraflar)
```
