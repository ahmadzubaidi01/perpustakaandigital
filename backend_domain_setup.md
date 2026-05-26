# 🌐 Panduan Konfigurasi Backend Node.js (Express) ke Domain Sendiri

Dokumen ini berisi panduan lengkap untuk menghubungkan backend proyek **Perpustakaan Digital** Anda ke domain kustom pribadi Anda (misalnya: `api.perpustakaanahmad.co.id`) agar dapat diakses secara online oleh aplikasi Web dan Mobile secara aman menggunakan protokol HTTPS.

---

## 🏗️ Gambaran Arsitektur Produksi

Untuk menghubungkan Express backend Anda yang berjalan secara lokal di server pada port `5000` agar dapat diakses melalui internet menggunakan domain Anda sendiri, kita menggunakan skema arsitektur berikut:

```
[Pengguna Web / Mobile] 
       │ (HTTPS - Port 443)
       ▼
[DNS: api.perpustakaanahmad.co.id] ────► [VPS / Server Publik]
                                                │
                                                ▼ (Nginx Reverse Proxy)
                                       [Localport: 5000 (Express)]
```

---

## 🛠️ Langkah 1: Konfigurasi DNS Manager

Arahkan domain atau subdomain Anda ke IP Publik dari VPS atau server tempat backend Anda berjalan.

1. Masuk ke **DNS Manager** penyedia domain Anda (Cloudflare, Niagahoster, GoDaddy, dll).
2. Tambahkan baris baru dengan tipe **A Record**:
   * **Type**: `A`
   * **Name/Host**: `api` (jika menggunakan subdomain `api.perpustakaanahmad.co.id`) atau `@` (jika menggunakan domain utama).
   * **IPv4 Address / Value**: `IP_PUBLIC_VPS_ANDA` (contoh: `103.189.10.12`).
   * **TTL**: `Automatic` atau `3600`.
3. Tambahkan juga record untuk **Frontend Web** (jika di-deploy pada VPS yang sama atau platform cloud lain seperti Vercel/Netlify):
   * **Type**: `A`
   * **Name/Host**: `@` (untuk domain utama `perpustakaanahmad.co.id`).
   * **Value**: `IP_TARGET_FRONTEND`.

---

## 📝 Langkah 2: Sesuaikan Variabel Lingkungan (`.env`)

Pada server VPS Anda, perbarui berkas `.env` backend Anda untuk mengganti alamat lokal `localhost` menjadi domain produksi asli Anda agar CORS dan Socket.io mengizinkan koneksi luar:

```ini
# =============================================
# APPLICATION
# =============================================
NODE_ENV=production
PORT=5000
APP_NAME=PerpustakaanDigital

# Ubah ini ke URL Subdomain Backend Anda (tanpa slash akhiran)
APP_URL=https://api.perpustakaanahmad.co.id

# Ubah ini ke URL Frontend Utama Anda
FRONTEND_URL=https://perpustakaanahmad.co.id

# =============================================
# CORS CONFIGURATION (Sangat Penting untuk Web Frontend!)
# =============================================
# Pisahkan dengan koma origin yang diizinkan mengakses backend Anda
CORS_ORIGINS=https://perpustakaanahmad.co.id,http://localhost:3000,http://localhost:8081
```

---

## 🔒 Langkah 3: Setup Nginx & SSL Let's Encrypt (Wajib untuk Mobile)

> [!IMPORTANT]
> Android & iOS secara default **melarang keras** aplikasi seluler memanggil API non-secure (`http://`). API backend Anda **wajib menggunakan HTTPS (`https://`)** agar aplikasi mobile Anda dapat berjalan di mode produksi.

Berikut cara termudah mengkonfigurasi Nginx sebagai reverse proxy sekaligus mendapatkan sertifikat SSL HTTPS gratis selamanya:

### 1. Install Nginx di Server
```bash
sudo apt update
sudo apt install nginx -y
```

### 2. Buat Berkas Blok Konfigurasi Nginx Baru
Buat berkas baru di direktori sites-available:
```bash
sudo nano /etc/nginx/sites-available/perpustakaan-backend
```

Tempel konfigurasi Nginx berikut (sesuaikan port `5000` dengan port backend Anda dan ganti domainnya):
```nginx
server {
    listen 80;
    server_name api.perpustakaanahmad.co.id;

    location / {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        
        # Meneruskan detail IP asli klien ke Express
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### 3. Aktifkan Konfigurasi & Restart Nginx
Hubungkan konfigurasi ke direktori sites-enabled lalu uji apakah ada error sintaks:
```bash
sudo ln -s /etc/nginx/sites-available/perpustakaan-backend /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

### 4. Dapatkan SSL HTTPS dengan Certbot (Let's Encrypt)
Jalankan perintah berikut untuk menginstal Certbot dan otomatis mengubah konfigurasi Nginx menjadi HTTPS:
```bash
sudo apt install certbot python3-certbot-nginx -y
sudo certbot --nginx -d api.perpustakaanahmad.co.id
```
*Ikuti langkah-langkah di layar, pilih **Redirect** agar semua trafik HTTP otomatis diarahkan ke HTTPS.*

---

## 🚀 Langkah 4: Jalankan Backend Selamanya dengan PM2

Agar backend Anda terus berjalan di latar belakang (background) meskipun Anda menutup terminal SSH Anda:

1. **Install PM2 secara global**:
   ```bash
   sudo npm install pm2 -g
   ```
2. **Jalankan Proyek Express**:
   * Jika menggunakan TypeScript langsung (ts-node):
     ```bash
     pm2 start ts-node -- -P tsconfig.json index.ts --name perpustakaan-backend
     ```
   * Jika sudah di-build menjadi JavaScript biasa (sangat direkomendasikan untuk produksi):
     ```bash
     npm run build
     pm2 start dist/index.js --name perpustakaan-backend
     ```
3. **Simpan agar PM2 otomatis menyala saat server restart**:
   ```bash
   pm2 save
   pm2 startup
   ```

---

## 📱 Langkah 5: Hubungkan Aplikasi Mobile Anda ke Domain Baru

Terakhir, pastikan aplikasi mobile React Native Anda memanggil domain baru Anda untuk mengambil data API pada mode produksi.

Sesuaikan endpoint API di file konstanta client seluler Anda:
* Buka berkas **[theme.ts](file:///c:/Users/evane/OneDrive/Dokumen/Punya%20Ahmad/perpustakaandigital/perpustakaandigital/mobile/src/constants/theme.ts)**.
* Pada baris **98-100**, ganti nilai URL produksi (`https://your-production-api.com/api`) menjadi domain API baru Anda:
  ```typescript
  export const API_BASE_URL = __DEV__
    ? getBackendUrl()
    : 'https://api.perpustakaanahmad.co.id/api'; // <--- Masukkan domain baru Anda di sini!
  ```
