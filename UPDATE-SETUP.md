# MAKARA POS - Otomatik Güncelleme Kurulum Rehberi

## 📋 Adım Adım Kurulum

### 1. GitHub Repository Ayarları

`package.json` dosyasındaki GitHub bilgilerini düzenleyin:

```json
"publish": {
  "provider": "github",
  "owner": "KULLANICI_ADINIZ",  // GitHub kullanıcı adınız
  "repo": "REPO_ADINIZ"          // Repository adınız (örn: makara-pos)
}
```

**Örnek:**
```json
"publish": {
  "provider": "github",
  "owner": "makara",
  "repo": "makara-pos"
}
```

### 2. GitHub Personal Access Token Oluşturma

1. GitHub'a giriş yapın
2. Settings → Developer settings → Personal access tokens → Tokens (classic)
3. "Generate new token (classic)" tıklayın
4. Token'a bir isim verin (örn: "makara-pos-updater")
5. **`repo`** scope'unu seçin (tüm repo yetkileri için)
6. "Generate token" tıklayın
7. **Token'ı kopyalayın** (bir daha gösterilmeyecek!)

### 3. Environment Variable Ayarlama

Windows'ta (PowerShell):
```powershell
$env:GH_TOKEN="YOUR_TOKEN_HERE"
```

Veya kalıcı olarak:
```powershell
[System.Environment]::SetEnvironmentVariable('GH_TOKEN', 'YOUR_TOKEN_HERE', 'User')
```

### 4. İlk Build ve Release

#### a) Versiyonu Artırın
`package.json`'da versiyonu güncelleyin:
```json
"version": "1.0.0"  // → "1.0.1"
```

#### b) Build Alın
```bash
npm run build:win
```

#### c) GitHub'a Publish Edin
```bash
npm run build:win -- --publish always
```

Bu komut:
- Build alır
- GitHub Release oluşturur
- `.exe` ve `latest.yml` dosyalarını yükler

### 5. Sonraki Güncellemeler İçin

Her yeni versiyon için:

1. **Versiyonu artırın** (`package.json`)
2. **Değişiklikleri yapın**
3. **Build ve publish:**
   ```bash
   npm run build:win -- --publish always
   ```

### 6. Test Etme

1. İlk versiyonu (1.0.0) kurun ve çalıştırın
2. Yeni bir versiyon (1.0.1) publish edin
3. Uygulamayı açın - otomatik olarak güncelleme kontrolü yapacak
4. Güncelleme bildirimi görünecek
5. "İndir" butonuna tıklayın
6. İndirme tamamlandıktan sonra "Yükle ve Yeniden Başlat" butonuna tıklayın

## 🔧 Sorun Giderme

### Güncelleme kontrol edilmiyor
- `app.isPackaged` kontrolü yapılıyor mu? (Development modunda çalışmaz)
- GitHub token doğru ayarlanmış mı?
- Repository adı doğru mu?

### "Update not available" hatası
- GitHub Release'de `latest.yml` dosyası var mı?
- Versiyon numarası artırılmış mı?
- Release public mi?

### İndirme hatası
- İnternet bağlantısını kontrol edin
- GitHub Release'e erişilebiliyor mu?
- Token yetkileri yeterli mi?

## 📝 Önemli Notlar

1. **Development modunda çalışmaz**: Sadece build edilmiş (packaged) uygulamada çalışır
2. **Versiyon numarası önemli**: Her güncellemede versiyonu artırın
3. **GitHub Release gerekli**: Her build'den sonra GitHub'a publish etmelisiniz
4. **Token güvenliği**: Token'ı asla kod içine yazmayın, environment variable kullanın

## 🚀 Hızlı Başlangıç

```bash
# 1. Token'ı ayarla
$env:GH_TOKEN="your_token_here"

# 2. Versiyonu artır (package.json)

# 3. Build ve publish
npm run build:win -- --publish always
```

## 📞 Destek

Sorun yaşarsanız:
1. Console loglarını kontrol edin
2. GitHub Release sayfasını kontrol edin
3. `latest.yml` dosyasının varlığını kontrol edin

