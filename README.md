# 📸 Nişan Fotoğraf Paylaşım Uygulaması

QR kod ile erişilen, nişan fotoğraflarını yüksek kalitede yükleme ve görüntüleme uygulaması.

## Özellikler

- ✨ **QR Kod Erişimi**: Kolayca erişim için QR kod desteği
- 📤 **Çoklu Fotoğraf Yükleme**: Aynı anda birden fazla fotoğraf yükleme
- 🖼️ **Real-time Galeri**: Anlık fotoğraf görüntüleme
- 📱 **Mobil Uyumlu**: Tüm cihazlardan kullanım
- ⚡ **Yüksek Performans**: 200+ eşzamanlı kullanıcı desteği
- 🔥 **Firebase Entegrasyonu**: Güvenli cloud storage

## Teknolojiler

- React 18
- TypeScript
- Vite
- Firebase Storage & Firestore
- CSS Grid & Flexbox

## Kurulum

```bash
npm install
npm run dev
```

## Firebase Yapılandırması

### 1. Firebase Projesi Oluşturma
1. [Firebase Console](https://console.firebase.google.com)'a git
2. "Create a project" tıkla
3. Proje adını gir (örn: `photos-album`)
4. Google Analytics'i istersen etkinleştir
5. "Create project" tıkla

### 2. Web App Ekleme
1. Project Overview'da **Web** ikonuna (</>)  tıkla
2. App nickname gir (örn: `photos-web`)
3. "Register app" tıkla
4. **firebaseConfig** nesnesini kopyala
5. `src/lib/firebase.ts` dosyasına yapıştır

### 3. Firestore Database Kurulumu
1. Sol menüden **Firestore Database** seç
2. "Create database" tıkla
3. **Test mode**'u seç (geliştirme için)
4. Lokasyon seç (örn: `europe-west3`)
5. "Done" tıkla

### 4. Firebase Storage Kurulumu
1. Sol menüden **Storage** seç
2. "Get started" tıkla
3. **Test mode**'u seç
4. Lokasyon seç (Firestore ile aynı)
5. "Done" tıkla

### 5. Security Rules Güncellemesi

#### Firestore Rules
```javascript
// Firestore Database > Rules
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /photos/{document} {
      allow read, write: if true;
    }
  }
}
```

#### Storage Rules  
```javascript
// Storage > Rules
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /photos/{allPaths=**} {
      allow read, write: if true;
      allow write: if request.resource.size < 20 * 1024 * 1024 // 20MB limit
                  && request.resource.contentType.matches('image/.*');
    }
  }
}
```

### 6. Güvenlik (Opsiyonel)
Production için:
1. **Authentication** > Sign-in method > Anonymous'u etkinleştir
2. Rules'larda `if true` yerine `if request.auth != null` kullan

### 7. Monitoring (Opsiyonel)
1. **Analytics** > Events > Özel eventler tanımla
2. **Performance** > Monitoring aktifleştir
