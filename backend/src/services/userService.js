// backend/src/services/userService.js

const db = require("../db");

/**
 * Foydalanuvchini topadi yoki yaratadi
 */
const upsertUser = async ({ id, username, firstName, phone }) => {
  const { rows } = await db.query(
    `INSERT INTO users (id, username, first_name, phone, updated_at)
     VALUES ($1, $2, $3, $4, NOW())
     ON CONFLICT (id) DO UPDATE SET
       username   = EXCLUDED.username,
       first_name = EXCLUDED.first_name,
       updated_at = NOW()
     RETURNING *`,
    [id, username || null, firstName || null, phone || null]
  );
  return rows[0];
};

/**
 * Foydalanuvchi viloyatini o'rnatadi
 */
const setUserRegion = async (userId, regionKey) => {
  const { rows } = await db.query(
    `UPDATE users
     SET selected_region = $1, updated_at = NOW()
     WHERE id = $2
     RETURNING *`,
    [regionKey, userId]
  );
  return rows[0] || null;
};

/**
 * Foydalanuvchi ma'lumotlarini oladi
 */
const getUserById = async (userId) => {
  const { rows } = await db.query(
    `SELECT u.*, r.name_uz as region_name
     FROM users u
     LEFT JOIN regions r ON r.key = u.selected_region
     WHERE u.id = $1`,
    [userId]
  );
  return rows[0] || null;
};

/**
 * Berilgan viloyatga obuna bo'lgan aktiv foydalanuvchilarni oladi
 */
const getActiveUsersByRegion = async (regionKey) => {
  const { rows } = await db.query(
    `SELECT id, username, first_name
     FROM users
     WHERE selected_region = $1 AND is_active = TRUE`,
    [regionKey]
  );
  return rows;
};

/**
 * Barcha aktiv foydalanuvchilar soni
 */
const getUserStats = async () => {
  const { rows } = await db.query(`
    SELECT
      r.name_uz,
      r.key,
      COUNT(u.id) AS subscriber_count
    FROM regions r
    LEFT JOIN users u ON u.selected_region = r.key AND u.is_active = TRUE
    GROUP BY r.key, r.name_uz
    ORDER BY subscriber_count DESC
  `);
  return rows;
};

module.exports = {
  upsertUser,
  setUserRegion,
  getUserById,
  getActiveUsersByRegion,
  getUserStats,
};
