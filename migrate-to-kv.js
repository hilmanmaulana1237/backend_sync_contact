// Script untuk migrate data dari database.json ke Vercel KV
// Jalankan dengan: node migrate-to-kv.js

const { kv } = require("@vercel/kv");
const fs = require("fs");
const path = require("path");

const DB_KEY = "contact_sync_database";
const DATABASE_FILE = path.join(__dirname, "database.json");

async function migrateData() {
  try {
    console.log("🔄 Memulai migrasi data ke Vercel KV...");

    // Baca data dari database.json
    if (!fs.existsSync(DATABASE_FILE)) {
      console.log("❌ File database.json tidak ditemukan");
      return;
    }

    const data = fs.readFileSync(DATABASE_FILE, "utf8");
    const companies = JSON.parse(data);

    console.log(`📊 Ditemukan ${companies.length} perusahaan`);

    // Upload ke Vercel KV
    await kv.set(DB_KEY, companies);

    console.log("✅ Migrasi berhasil!");
    console.log("📦 Data berhasil disimpan ke Vercel KV");

    // Verifikasi
    const savedData = await kv.get(DB_KEY);
    console.log(`✅ Verifikasi: ${savedData.length} perusahaan tersimpan`);
  } catch (error) {
    console.error("❌ Error saat migrasi:", error);
  }
}

migrateData();
