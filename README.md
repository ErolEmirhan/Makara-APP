# MAKARA POS - Modern Ödeme Uygulaması

Modern, şık ve profesyonel bir POS (Point of Sale) uygulaması. Electron, React ve Vite teknolojileri ile geliştirilmiştir.

## ✨ Özellikler

- 🎨 **Modern Gradient UI**: Yeni nesil profesyonel renkler ve gradient tasarım
- 📦 **Kategori Bazlı Ürün Yönetimi**: 6 farklı kategori (Kruvasan Çeşitleri, Prag Tatlısı, Paris Tatlıları, Kahvaltılar, Sıcak İçecekler, Soğuk İçecekler)
- 🛒 **Akıllı Sepet Sistemi**: Ürün ekleme, miktar güncelleme ve silme
- 💳 **Çoklu Ödeme Yöntemleri**: Nakit ve Kredi Kartı ödemeleri
- 💾 **Local Veritabanı**: SQLite ile güvenli veri saklama
- 📊 **Satış Detayları**: Tarih, saat, ürün ve ödeme türü bazlı raporlama
- ⚡ **Hızlı ve Performanslı**: Electron tabanlı masaüstü uygulaması

## 🚀 Kurulum

### Gereksinimler
- Node.js (v16 veya üzeri)
- npm veya yarn

### Adımlar

1. Bağımlılıkları yükleyin:
```bash
npm install
```

2. Uygulamayı geliştirme modunda çalıştırın:
```bash
npm run dev
```

3. Üretim için build alın:
```bash
npm run build
```

## 📁 Proje Yapısı

```
makara-pos/
├── electron/
│   ├── main.js          # Electron ana süreç
│   └── preload.js       # Electron preload script
├── src/
│   ├── components/
│   │   ├── Navbar.jsx           # Üst navigasyon
│   │   ├── CategoryPanel.jsx   # Kategori seçimi
│   │   ├── ProductGrid.jsx     # Ürün listesi
│   │   ├── Cart.jsx            # Sepet bölümü
│   │   ├── PaymentModal.jsx    # Ödeme modalı
│   │   └── SalesHistory.jsx    # Satış geçmişi
│   ├── App.jsx          # Ana uygulama
│   ├── main.jsx         # React giriş noktası
│   └── index.css        # Global stiller
├── package.json
├── vite.config.js
├── tailwind.config.js
└── README.md
```

## 🎯 Kullanım

### Satış Yapma
1. Sol panelden kategori seçin
2. Ürünlere tıklayarak sepete ekleyin
3. Sağ panelde sepeti kontrol edin
4. "Ödeme Al" butonuna tıklayın
5. Ödeme yöntemini seçin (Nakit/Kredi Kartı)

### Satış Detaylarını Görüntüleme
1. Üst navbardaki "Satış Detayları" butonuna tıklayın
2. Tüm satışları tarih, saat ve ödeme türü ile görüntüleyin
3. Toplam satış, gelir ve ortalama satış istatistiklerini inceleyin

## 🎨 Teknolojiler

- **Electron**: Masaüstü uygulama framework'ü
- **React**: UI kütüphanesi
- **Vite**: Hızlı build tool'u
- **Tailwind CSS**: Utility-first CSS framework'ü
- **SQLite**: Embedded veritabanı (better-sqlite3)

## 📊 Veritabanı Yapısı

### Tablolar
- **categories**: Ürün kategorileri
- **products**: Ürün bilgileri
- **sales**: Satış işlemleri
- **sale_items**: Satış detayları

## 🔧 Geliştirme

Geliştirme modunda uygulamayı çalıştırdığınızda:
- Hot reload aktif olacak
- DevTools otomatik açılacak
- Vite dev server localhost:5173 üzerinde çalışacak

## 📝 Notlar

- Veritabanı dosyası kullanıcının uygulama verisi klasöründe saklanır
- Örnek ürünler ilk çalıştırmada otomatik olarak eklenir
- Tüm satışlar yerel veritabanında güvenli bir şekilde saklanır

## 🎉 Özellik Geliştirme Planı

- [ ] Ürün görselleri yükleme
- [ ] Kullanıcı yönetimi
- [ ] Stok takibi
- [ ] Rapor çıktısı alma (PDF)
- [ ] Fiş yazdırma
- [ ] Excel export
- [ ] Kampanya ve indirim yönetimi

## 👨‍💻 Geliştirici

MAKARA - Modern POS Sistemi

---

**Not**: Bu uygulama tamamen yerel olarak çalışır ve internet bağlantısı gerektirmez.

