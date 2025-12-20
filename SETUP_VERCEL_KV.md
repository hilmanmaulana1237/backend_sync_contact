# Setup Redis untuk Contact Sync App

## Masalah yang Diperbaiki

❌ **Sebelumnya**: Data hilang setelah beberapa menit karena menggunakan in-memory database  
✅ **Sekarang**: Data tersimpan permanen menggunakan Redis Cloud

## Setup yang Sudah Dilakukan ✅

### 1. Redis Database
- ✅ Redis Cloud dari RedisLabs sudah dikonfigurasi
- ✅ Region: ap-southeast-1 (Singapore)
- ✅ Connection string sudah tersimpan

### 2. Backend Code
- ✅ Package `redis` sudah terinstall
- ✅ Code sudah diupdate untuk menggunakan Redis
- ✅ Environment variable `REDIS_URL` sudah dikonfigurasi

### 3. Data Migration
- ✅ Data dari `database.json` sudah dimigrate ke Redis
- ✅ 2 perusahaan berhasil tersimpan

## Langkah Deploy ke Vercel

### 1. Tambahkan Environment Variable di Vercel

1. Buka dashboard Vercel: https://vercel.com/dashboard
2. Pilih project backend Anda
3. Klik **Settings** → **Environment Variables**
4. Tambahkan variable baru:
   - **Name**: `REDIS_URL`
   - **Value**: `redis://default:tzHpJhCPIvOURTAYdnqTe0QoNd2AUywR@redis-17846.c292.ap-southeast-1-1.ec2.cloud.redislabs.com:17846`
   - **Environment**: Production, Preview, Development (centang semua)
5. Klik **Save**

### 2. Deploy ke Vercel

```bash
# Push perubahan code ke GitHub
git add .
git commit -m "Use Redis Cloud for persistent storage"
git push

# Atau deploy manual via Vercel CLI
vercel --prod
```

## Verifikasi

Setelah deploy, coba:

1. Buat company baru
2. Tunggu 10-15 menit (jangan akses backend)
3. Coba login atau sync lagi
4. ✅ Data seharusnya masih ada!

## Keuntungan Redis Cloud

- ✅ Data persisten (tidak hilang selamanya)
- ✅ Super cepat (in-memory database)
- ✅ Gratis 30MB storage
- ✅ Auto-failover & high availability
- ✅ Support SSL/TLS encryption

## Troubleshooting

### Jika masih hilang setelah deploy:

1. Cek environment variables di Vercel Dashboard → Settings → Environment Variables
2. Pastikan `REDIS_URL` sudah ditambahkan
3. Redeploy project

### Jika error connection:

1. Pastikan Redis URL benar dan Redis server aktif
2. Check logs: `vercel logs <deployment-url>`
3. Test koneksi lokal dengan: `node migrate-to-kv.js`

## Catatan Penting

- ⚠️ Jangan commit file `.env` ke Git (sudah di `.gitignore`)
- ✅ Environment variable `REDIS_URL` harus ditambahkan di Vercel Dashboard
- ✅ Data sudah tersimpan di Redis dan siap digunakan

