# Panduan Pembuatan Mobile Bundle (.aab) Siap Keystore via Expo EAS

Panduan ini menjelaskan langkah demi langkah untuk mempersiapkan dan membuat berkas **Android App Bundle (.aab)** yang siap dirilis atau diperbarui (update) di Google Play Store menggunakan **EAS (Expo Application Services)**.

---

## 💡 Mengapa Menggunakan Format `.aab`?
Format `.aab` (Android App Bundle) adalah format standar yang wajib digunakan ketika mengunggah aplikasi baru atau pembaruan ke Google Play Store. Google Play akan memproses berkas `.aab` ini untuk menghasilkan file `.apk` yang dioptimalkan sesuai dengan perangkat masing-masing pengguna.

---

## 🛠️ Persiapan Awal (Prerequisites)

Sebelum mulai melakukan build, pastikan beberapa konfigurasi dasar berikut sudah sesuai:

1. **Ubah/Naikkan Versi Aplikasi**
   Jika Anda sedang melakukan *update* (pembaruan aplikasi), Anda **wajib** menaikkan `versionCode` dan `version` di berkas [app.json](file:///c:/Users/evane/OneDrive/Dokumen/Punya%20Ahmad/perpustakaandigital/perpustakaandigital/mobile/app.json) agar Google Play Store menerima pembaruan tersebut.
   ```json
   "expo": {
     "version": "1.0.1", // Naikkan versi rilis (misal 1.0.0 ke 1.0.1)
     "android": {
       "versionCode": 2, // Naikkan angka ini (+1 dari rilis sebelumnya)
       "package": "com.perpustakaan.digital"
     }
   }
   ```

2. **Periksa Konfigurasi EAS Build**
   Berkas [eas.json](file:///c:/Users/evane/OneDrive/Dokumen/Punya%20Ahmad/perpustakaandigital/perpustakaandigital/mobile/eas.json) Anda sudah terkonfigurasi dengan profil `production` untuk Android dengan `buildType: "app-bundle"`. Ini sudah sangat tepat!

---

## 🔥 Metode Pembuatan `.aab` Siap Keystore

Ada tiga skenario utama untuk menyiapkan dan memproses pembuatan `.aab` dengan keystore yang aman:

### Skema A: EAS Cloud Build (Sangat Direkomendasikan & Termudah)
Metode ini melakukan proses kompilasi di server cloud Expo, sehingga Anda tidak membutuhkan Java JDK, Android SDK, atau komputer berspesifikasi tinggi. Expo juga akan mengelola dan menyimpan keystore Anda dengan aman secara otomatis.

1. **Buka Terminal** di direktori `/mobile` Anda.
2. **Jalankan Perintah Login Expo** (jika belum login):
   ```bash
   npx eas-cli login
   ```
   *Masukkan username/email dan password akun Expo Anda.*
   
3. **Inisialisasi Project EAS** (jika pertama kali):
   ```bash
   npx eas-cli project:init
   ```
   
4. **Jalankan Perintah Pembuatan `.aab`**:
   ```bash
   npx eas-cli build --platform android --profile production
   ```
5. **Proses Keystore Otomatis**:
   - Jika ini aplikasi baru di akun Expo Anda, EAS akan bertanya: *"Would you like us to generate a new Keystore for you?"*
   - Pilih **Yes/Setup**. EAS akan otomatis membuat keystore baru dengan aman di cloud server Expo.
   - Jika Anda memperbarui aplikasi lama yang **keystore-nya sudah ada di Google Play Store**, Anda bisa mengunggah berkas keystore lama Anda saat diminta oleh EAS CLI, atau mengaturnya lewat perintah:
     ```bash
     npx eas-cli credentials
     ```
6. Setelah proses build selesai, terminal akan menampilkan tautan (link) untuk mengunduh berkas `.aab` Anda.

---

### Skema B: Menggunakan Keystore Lokal dengan `credentials.json`
Jika Anda ingin mendefinisikan lokasi file keystore lokal Anda sendiri (misal `release-key.jks`) secara eksplisit untuk digunakan oleh EAS Build:

1. Buat file `credentials.json` di direktori utama `mobile` (gunakan file contoh [credentials.json.example](file:///c:/Users/evane/OneDrive/Dokumen/Punya%20Ahmad/perpustakaandigital/perpustakaandigital/mobile/credentials.json.example) yang telah disiapkan).
2. Salin file `credentials.json.example` menjadi `credentials.json`:
   ```json
   {
     "android": {
       "keystore": {
         "keystorePath": "./release-key.jks",
         "keystorePassword": "PASSWORD_KEYSTORE_ANDA",
         "keyAlias": "ALIAS_KEYSTORE_ANDA",
         "keyPassword": "PASSWORD_KUNCI_ANDA"
       }
     }
   }
   ```
   > [!WARNING]
   > Jangan pernah mengunggah atau melakukan *commit* file `credentials.json` atau file `.jks` ke dalam Git Repository demi keamanan credential Anda. Tambahkan file tersebut ke `.gitignore`.

3. Jalankan build cloud dengan kredensial lokal tersebut:
   ```bash
   npx eas-cli build --platform android --profile production
   ```

---

### Skema C: Local Build (Tanpa Server Cloud Expo)
Jika Anda memiliki spesifikasi komputer yang memadai dan ingin melakukan kompilasi `.aab` secara offline di komputer lokal tanpa menggunakan kuota build cloud Expo:

1. **Prasyarat Tambahan**:
   - Komputer Anda harus terinstal **Java JDK 17** (atau versi yang didukung React Native).
   - Terinstal **Android Studio** beserta **Android SDK** lengkap dengan `ANDROID_HOME` environment variables terdaftar di system PATH.

2. **Jalankan Perintah Build Lokal**:
   ```bash
   npx eas-cli build --local --platform android --profile production
   ```
3. Berkas `.aab` akan langsung di-compile di komputer Anda dan disimpan di folder proyek Anda setelah selesai.

---

## 🔒 Tips Keamanan Keystore & Google Play Store Update

* **Pentingnya Keystore**: Keystore Android adalah sertifikat digital penanda keaslian aplikasi Anda. Sekali Anda merilis aplikasi di Google Play Store dengan keystore tertentu, **seluruh update selanjutnya wajib menggunakan keystore yang sama**. Jika keystore hilang atau berbeda, Google Play akan menolak update aplikasi Anda secara permanen.
* **Google Play App Signing**: Jika Anda mengaktifkan fitur *Google Play App Signing*, Google akan mengelola kunci rilis utama Anda. Namun, Anda tetap memerlukan kunci unggah (upload key/keystore) untuk mengirimkan update ke Play Store Console.
