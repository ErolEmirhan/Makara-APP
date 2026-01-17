# Firestore Rules - Online Siparişler (makaraonline-5464e) - GÜNCELLENMİŞ

Aşağıdaki rules'ı Firebase Console'da `makaraonline-5464e` projesinin Firestore Rules bölümüne yapıştırın:

## Firebase Console'a Git:
https://console.firebase.google.com/project/makaraonline-5464e/firestore/rules

## Güncellenmiş Rules:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // Online siparişler koleksiyonu
    match /orders/{orderId} {
      // Herkes sipariş oluşturabilir (web sitesinden online sipariş girişi için)
      allow create: if true;
      
      // Herkes okuyabilir (POS uygulaması ve admin paneli için)
      allow read: if true;
      
      // Güncelleme: status, assignedCourierId ve deliveryCoordinates alanlarını güncelleyebilir
      // (POS uygulaması ve kurye sistemi için)
      allow update: if request.resource.data.diff(resource.data).affectedKeys().hasOnly(['status', 'assignedCourierId', 'deliveryCoordinates']);
      
      // Silme sadece authenticated kullanıcılar için (admin paneli için)
      allow delete: if request.auth != null;
    }
    
    // Kurye konumları koleksiyonu
    match /courier_locations/{courierName} {
      // Herkes okuyabilir (en yakın kurye bulma için)
      allow read: if true;
      
      // Herkes yazabilir (kuryeler konumlarını güncelleyebilir)
      allow write: if true;
    }
    
    // Diğer koleksiyonlar için varsayılan kurallar (güvenlik için)
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

## Değişiklikler:

1. **`orders` collection**: `assignedCourierId` ve `deliveryCoordinates` alanlarını da güncelleyebilme izni eklendi
2. **`courier_locations` collection**: Yeni koleksiyon eklendi - kuryelerin konumlarını saklamak için
   - Herkes okuyabilir (en yakın kurye bulma için)
   - Herkes yazabilir (kuryeler konumlarını güncelleyebilir)

## Önemli:

Bu kuralları Firebase Console'da güncellemeden önce kurye sistemi çalışmayacaktır!
