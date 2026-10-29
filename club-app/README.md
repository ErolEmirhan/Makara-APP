# MAKARA Club — müşteri sadakat uygulaması

McDonald's / Starbucks uygulamalarındaki gibi: müşteri kasada QR kartını okutur, harcadığı
her ₺ için puan kazanır, puanlarını makara, kahve, tatlı gibi ödüllere çevirir.
Pembe-beyaz, Apple tarzı arayüz; tatlılar tarayıcıda gerçek zamanlı 3D olarak (three.js)
çizilir, dışarıdan model dosyası gerekmez.

## Neler var

**Müşteri uygulaması** (telefon, PWA — "Ana Ekrana Ekle" ile uygulama gibi açılır)

- Sinematik giriş: parmakla çevrilebilen 3D pembe glazürlü makara, parıltılar
- Üyelik: ad, telefon, e-posta, şifre, doğum günü · üye olana 250 puan hediye
- Ana sayfa: sayarak artan puan, sıradaki ödüle ilerleme çubuğu, kampanyalar, ödül rafı, son hareketler
- **Kartım**: Apple Wallet tarzı eğilen kart; QR + 8 haneli üye kodu
- **Ödüller**: kategori filtreli 3D ödül kataloğu, detayda çevrilebilir model,
  "Ödülü Kullan" → 10 dakika geçerli, tek kullanımlık QR
- **Kampanyalar**: Çarşamba 2x puan, hafta içi 08–11 1.5x puan, doğum günü hediyesi (kasada otomatik uygulanır)
- **Seviyeler**: Pembe → Gül (+%10) → Elmas (+%20)
- Kasadan puan yüklendiği anda telefonda dönen 3D jeton + konfeti kutlaması

**Kasa paneli** — aynı uygulamada `#/kasa` adresi (tablet / kasa bilgisayarı)

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
tarayıcıda saklanır. Üye ol → ana sayfadaki "Simüle et" ile alışveriş yap ya da
Hesabım → "Kasa panelini aç" (şifre `1234`) ile ikinci sekmede gerçek kasa akışını dene;
iki sekme anlık senkronlanır.

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
   Yalnızca bu belgesi olan hesaplar `#/kasa` paneline girip puan yükleyebilir.

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
- `REWARDS` — ödüller, puan bedelleri ve 3D modeli (`roll`, `cup`, `macaron`, `croissant`, `prag`, `gift`)
- `OFFERS` — kampanyalar; `multiplier` + `days` / `hours` olanlar kasada otomatik uygulanır
- `BRANCHES` — şubeler ve harita bağlantıları

Ödül puanları örnek değerlerdir; menü fiyatlarınıza göre ayarlayın.

## Yapı

```
club-app/
├── firestore.rules          Firestore güvenlik kuralları
├── src/
│   ├── config/              loyalty.js (kurallar), firebase.js (ortam değişkenleri)
│   ├── data/                demo (localStorage) ve Firebase arka uçları, QR/kod yardımcıları
│   ├── three/               prosedürel 3D modeller, stüdyo ışığı, canlı sahne, ödül fotoğrafları
│   ├── screens/             müşteri ekranları
│   ├── kasa/                kasa paneli ve QR tarayıcı
│   └── components/          tab bar, alt sayfa, QR, sayaç, kutlama…
└── public/                  logo, ikonlar, manifest, service worker
```
