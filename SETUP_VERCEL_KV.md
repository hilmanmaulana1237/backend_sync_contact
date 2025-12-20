# Setup Vercel KV untuk Contact Sync App

## Masalah yang Diperbaiki

❌ **Sebelumnya**: Data hilang setelah beberapa menit karena menggunakan in-memory database  
✅ **Sekarang**: Data tersimpan permanen menggunakan Vercel KV (Redis)

## Langkah Setup

### 1. Buat Vercel KV Database

1. Buka dashboard Vercel: https://vercel.com/dashboard
2. Pilih project "ContactSyncApp" atau project backend Anda
3. Klik tab **Storage**
4. Klik **Create Database**
5. Pilih **KV (Redis)**
6. Beri nama: `contact-sync-db`
7. Pilih region yang dekat dengan lokasi Anda (misal: Singapore)
8. Klik **Create**

### 2. Connect Database ke Project

1. Setelah database dibuat, klik **Connect to Project**
2. Pilih project backend Anda
3. Klik **Connect**
4. Environment variables otomatis ditambahkan:
   - `KV_URL`
   - `KV_REST_API_URL`
   - `KV_REST_API_TOKEN`
   - `KV_REST_API_READ_ONLY_TOKEN`

### 3. Deploy Ulang

```bash
# Push perubahan code ke GitHub
git add .
git commit -m "Migrate to Vercel KV for persistent storage"
git push

# Atau deploy manual via Vercel CLI
vercel --prod
```

### 4. Migrate Data yang Sudah Ada (Opsional)

Jika Anda punya data di `database.json`, migrate dengan cara:

```bash
# Set environment variables dari Vercel dashboard
# Copy KV_REST_API_URL dan KV_REST_API_TOKEN

# Jalankan script migrasi
node migrate-to-kv.js
```

## Verifikasi

Setelah deploy, coba:

1. Buat company baru
2. Tunggu 10-15 menit (jangan akses backend)
3. Coba login atau sync lagi
4. ✅ Data seharusnya masih ada!

## Keuntungan Vercel KV

- ✅ Data persisten (tidak hilang)
- ✅ Cepat (Redis-based)
- ✅ Gratis untuk usage kecil
- ✅ Auto-scaling
- ✅ Terintegrasi dengan Vercel

## Troubleshooting

### Jika masih hilang:

1. Cek environment variables di Vercel Dashboard → Settings → Environment Variables
2. Pastikan `KV_URL`, `KV_REST_API_URL`, dan `KV_REST_API_TOKEN` ada
3. Redeploy project

### Jika error saat akses:

1. Pastikan package `@vercel/kv` sudah terinstall
2. Check logs: `vercel logs <deployment-url>`

## Catatan Penting

- ⚠️ Jangan commit file `.env` ke Git (sudah di `.gitignore`)
- ⚠️ Environment variables otomatis tersedia di production
- ⚠️ Untuk local development, copy environment variables dari Vercel Dashboard ke `.env`
