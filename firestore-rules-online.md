# Firestore Rules - Online Siparişler (makaraonline-5464e)

Aşağıdaki rules'ı Firebase Console'da `makaraonline-5464e` projesinin Firestore Rules bölümüne yapıştırın:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // Online siparişler koleksiyonu
    match /orders/{orderId} {
      // Herkes sipariş oluşturabilir (web sitesinden online sipariş girişi için)
      allow create: if true;
      
      // Herkes okuyabilir (POS uygulaması ve admin paneli için)
      // Not: Eğer daha güvenli olmasını isterseniz, authentication kontrolü ekleyebilirsiniz
      allow read: if true;
      
      // Güncelleme: Sadece status alanını güncelleyebilir (POS uygulaması için)
      // Diğer alanlar değiştirilemez (güvenlik için)
      allow update: if request.resource.data.diff(resource.data).affectedKeys().hasOnly(['status']);
      
      // Silme sadece authenticated kullanıcılar için (admin paneli için)
      allow delete: if request.auth != null;
    }
    
    // Diğer koleksiyonlar için varsayılan kurallar (güvenlik için)
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

## Açıklama:

1. **`allow create: if true;`** - Web sitenizden herkes sipariş oluşturabilir (online sipariş girişi için)
2. **`allow read: if true;`** - POS uygulaması ve admin paneli siparişleri okuyabilir (authentication gerektirmez)
3. **`allow update: if request.resource.data.diff(resource.data).affectedKeys().hasOnly(['status']);`** - Sadece `status` alanı güncellenebilir (POS uygulaması "Ödeme Alındı" butonu için). Diğer alanlar değiştirilemez (güvenlik için)
4. **`allow delete: if request.auth != null;`** - Sadece authenticated kullanıcılar (admin) siparişleri silebilir
5. **`match /{document=**} { allow read, write: if false; }`** - Diğer tüm koleksiyonlar için varsayılan olarak erişim yok (güvenlik için)

## Daha Güvenli Alternatif (Opsiyonel):

Eğer siparişlerin herkes tarafından okunmasını istemiyorsanız, authentication kontrolü ekleyebilirsiniz:

```javascript
allow read: if request.auth != null;
```

Ancak bu durumda POS uygulamasının Firebase Authentication kullanması gerekir.

---

## Firestore Index Gereksinimi

`where('status', '==', 'pending')` ve `orderBy('createdAt', 'desc')` sorgusunu birlikte kullandığımız için Firestore'da **composite index** oluşturmanız gerekiyor.

### Index Oluşturma (Önerilen - En Performanslı)

1. Hata mesajındaki linke tıklayın veya Firebase Console'a gidin:
   - https://console.firebase.google.com/project/makaraonline-5464e/firestore/indexes

2. "Create Index" butonuna tıklayın

3. Aşağıdaki ayarları yapın:
   - **Collection ID**: `orders`
   - **Fields to index**:
     - `status` (Ascending)
     - `createdAt` (Descending)
   - **Query scope**: Collection

4. Index oluşturulmasını bekleyin (birkaç dakika sürebilir)

### Alternatif Çözüm (Index Oluşturmadan)

Eğer index oluşturmak istemiyorsanız, query'yi değiştirip client-side'da sıralama yapabiliriz. Ancak bu daha az performanslıdır.
