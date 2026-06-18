# MAKARA Mobil Personel PWA (Firebase Cloud)

İnternet üzerinden çalışan mobil personel arayüzü. Kasa IP'si veya aynı Wi-Fi **gerekmez**.

## Mimari

```
[PWA — her yerden]
        │ Firestore (okuma/yazma)
        ▼
[Firebase Cloud]
        │ mobile_orders dinleyici
        ▼
[Masaüstü Electron — kasa PC]
  → yerel db + yazıcı + masa ekranı
```

## Akış

1. **Masaüstünde** personel oluşturulunca şifre Firestore `staff` koleksiyonuna yazılır
2. **PWA'da** şube seç → personel şifresi ile giriş (Firestore sorgusu)
3. **Sipariş gönder** → Firestore `mobile_orders` koleksiyonuna `pending` kayıt
4. **Kasa PC** anlık dinler → yazdırır, yerel db günceller, masayı senkronlar

## Kurulum

```bash
cd mobile-pwa
npm install
npm run dev        # http://localhost:5174/mobile/
npm run build      # production
```

Kök dizinden: `npm run build:mobile`

## Firestore koleksiyonları

| Koleksiyon | Proje | Açıklama |
|------------|-------|----------|
| `staff` | main (katalog) | Personel + şifre |
| `categories`, `products` | main | Menü (mevcut) |
| `tables` | tables | Masa durumu (mevcut) |
| `mobile_orders` | tables | PWA sipariş kuyruğu |
| `broadcasts` | main | Duyurular (mevcut) |

## Önemli

- Masaüstü uygulama açık ve Firebase bağlı olmalı (siparişleri işlemek için)
- İlk açılışta mevcut personeller otomatik Firestore'a senkronize edilir
- Şifreler düz metin (mevcut sistemle aynı) — production'da güvenlik kuralları sıkılaştırılmalı
