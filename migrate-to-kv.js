// Script untuk migrate data dari database.json ke Redis
// Jalankan dengan: node migrate-to-kv.js

require('dotenv').config();
const { createClient } = require("redis");
const fs = require("fs");
const path = require("path");

const DB_KEY = "contact_sync_database";
const DATABASE_FILE = path.join(__dirname, "database.json");
const REDIS_URL = process.env.REDIS_URL;

async function migrateData() {
  let client;
  try {
    console.log("🔄 Memulai migrasi data ke Redis...");

    // Baca data dari database.json
    if (!fs.existsSync(DATABASE_FILE)) {
      console.log("❌ File database.json tidak ditemukan");
      return;
    }

    const data = fs.readFileSync(DATABASE_FILE, "utf8");
    const companies = JSON.parse(data);

    console.log(`📊 Ditemukan ${companies.length} perusahaan`);

    // Connect to Redis
    client = createClient({ url: REDIS_URL });
    await client.connect();
    console.log("✅ Terhubung ke Redis");

    // Upload ke Redis
    await client.set(DB_KEY, JSON.stringify(companies));

    console.log("✅ Migrasi berhasil!");
    console.log("📦 Data berhasil disimpan ke Redis");

    // Verifikasi
    const savedData = await client.get(DB_KEY);
    const parsedData = JSON.parse(savedData);
    console.log(`✅ Verifikasi: ${parsedData.length} perusahaan tersimpan`);
  } catch (error) {
    console.error("❌ Error saat migrasi:", error);
  } finally {
    if (client) {
      await client.quit();
    }
  }
}

migrateData();
