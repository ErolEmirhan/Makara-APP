# MAKARA POS - Build ve Kurulum Rehberi

## 📦 Setup Dosyası Oluşturma

### Gereksinimler
- Node.js (v16 veya üzeri)
- npm veya yarn

### Adımlar

1. **Bağımlılıkları yükleyin:**
```bash
npm install
```

2. **Uygulamayı build edin:**
```bash
npm run build
```

3. **Windows installer oluşturun:**
```bash
npm run build:win
```

Bu komut:
- Vite ile React uygulamasını build eder
- Electron-builder ile Windows installer (.exe) oluşturur
- `release` klasörüne installer dosyasını kaydeder

### Oluşturulan Dosyalar

Build işlemi tamamlandıktan sonra `release` klasöründe şunlar olacak:
- `MAKARA POS Setup x.x.x.exe` - Windows installer
- `MAKARA POS x.x.x.exe` - Portable versiyon (isteğe bağlı)

### Installer Özellikleri

- ✅ Kullanıcı kurulum dizinini seçebilir
- ✅ Masaüstü kısayolu oluşturur
- ✅ Başlat menüsüne ekler
- ✅ Tek tıkla kurulum (isteğe bağlı)

### Icon Dosyası

`build/icon.ico` dosyasına uygulama ikonunuzu ekleyebilirsiniz. Şu anda placeholder var.

### Geliştirme Notları

- Geliştirme modunda çalıştırmak için: `npm run dev`
- Sadece build için: `npm run build`
- Installer oluşturmak için: `npm run build:win`

## 🚀 Dağıtım

Oluşturulan `MAKARA POS Setup x.x.x.exe` dosyasını kullanıcılara dağıtabilirsiniz. Bu dosya:
- Tüm bağımlılıkları içerir
- Kullanıcının bilgisayarına kurulum yapar
- Uygulamayı başlat menüsüne ekler

