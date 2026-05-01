// backend/src/db/migrate.js
// Ma'lumotlar bazasi jadvallarini yaratish

require("dotenv").config({ path: require("path").join(__dirname, "../../.env") });
const db = require("./index");

const migrations = [
  // 1. Viloyatlar jadvali
  `CREATE TABLE IF NOT EXISTS regions (
    id         SERIAL PRIMARY KEY,
    key        VARCHAR(50) UNIQUE NOT NULL,
    name_uz    VARCHAR(100) NOT NULL,
    name_ru    VARCHAR(100),
    created_at TIMESTAMPTZ DEFAULT NOW()
  )`,

  // 2. Yuk xabarlari jadvali
  `CREATE TABLE IF NOT EXISTS cargo_messages (
    id          BIGSERIAL PRIMARY KEY,
    message     TEXT NOT NULL,
    region_key  VARCHAR(50) NOT NULL REFERENCES regions(key),
    region_id   INT NOT NULL,
    detected_by VARCHAR(20) DEFAULT 'keyword',  -- 'keyword' | 'ai'
    is_active   BOOLEAN DEFAULT TRUE,
    created_at  TIMESTAMPTZ DEFAULT NOW()
  )`,

  // 3. Tezlik uchun indeks
  `CREATE INDEX IF NOT EXISTS idx_cargo_region_created
    ON cargo_messages(region_key, created_at DESC)`,

  `CREATE INDEX IF NOT EXISTS idx_cargo_active
    ON cargo_messages(is_active, created_at DESC)`,

  // 4. Foydalanuvchilar jadvali
  `CREATE TABLE IF NOT EXISTS users (
    id              BIGINT PRIMARY KEY,   -- Telegram user_id
    username        VARCHAR(100),
    first_name      VARCHAR(100),
    phone           VARCHAR(20),
    selected_region VARCHAR(50) REFERENCES regions(key),
    is_active       BOOLEAN DEFAULT TRUE,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
  )`,

  // 5. Xabar yuborish tarixi (takroriy yuborishni oldini olish)
  `CREATE TABLE IF NOT EXISTS sent_messages (
    id         BIGSERIAL PRIMARY KEY,
    user_id    BIGINT NOT NULL REFERENCES users(id),
    cargo_id   BIGINT NOT NULL REFERENCES cargo_messages(id),
    sent_at    TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, cargo_id)
  )`,

  `CREATE INDEX IF NOT EXISTS idx_sent_user_sent
    ON sent_messages(user_id, sent_at DESC)`,
];

// Viloyatlar seed ma'lumotlari
const seedRegions = `
  INSERT INTO regions (key, name_uz, name_ru) VALUES
    ('Sirdaryo',    'Sirdaryo',    'Сырдарья'),
    ('Toshkent',    'Toshkent',    'Ташкент'),
    ('Samarqand',   'Samarqand',   'Самарканд'),
    ('Jizzax',      'Jizzax',      'Джизак'),
    ('Navoiy',      'Navoiy',      'Навои'),
    ('Qashqadaryo', 'Qashqadaryo', 'Кашкадарья'),
    ('Surhondaryo', 'Surxondaryo', 'Сурхандарья'),
    ('Xorazm',      'Xorazm',      'Хорезм'),
    ('Buxoro',      'Buxoro',      'Бухара'),
    ('Fargona',     'Farg''ona',   'Фергана'),
    ('Andijon',     'Andijon',     'Андижан'),
    ('Namangan',    'Namangan',    'Наманган')
  ON CONFLICT (key) DO NOTHING
`;

(async () => {
  console.log("🗄️  Migratsiya boshlanmoqda...");
  try {
    for (const sql of migrations) {
      await db.query(sql);
      console.log("✅", sql.split("\n")[0].trim().slice(0, 60));
    }
    await db.query(seedRegions);
    console.log("✅ Viloyatlar seed qilindi");
    console.log("🎉 Migratsiya muvaffaqiyatli tugadi!");
  } catch (err) {
    console.error("❌ Migratsiya xatosi:", err.message);
    process.exit(1);
  } finally {
    await db.pool.end();
  }
})();
