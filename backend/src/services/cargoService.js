// backend/src/services/cargoService.js

const db = require("../db");

/**
 * Yangi yuk xabarini saqlaydi
 */
const saveCargoMessage = async ({ message, regionKey, regionId, detectedBy }) => {
  const { rows } = await db.query(
    `INSERT INTO cargo_messages (message, region_key, region_id, detected_by)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [message, regionKey, regionId, detectedBy || "keyword"]
  );
  return rows[0];
};

/**
 * Viloyat bo'yicha so'nggi xabarlarni oladi
 * @param {string} regionKey - viloyat kaliti
 * @param {number} limit - nechta xabar
 * @param {string} since - shu vaqtdan keyingi xabarlar (ISO string)
 */
const getCargoByRegion = async (regionKey, limit = 50, since = null) => {
  let sql = `
    SELECT id, message, detected_by, created_at
    FROM cargo_messages
    WHERE region_key = $1 AND is_active = TRUE
  `;
  const params = [regionKey];

  if (since) {
    params.push(since);
    sql += ` AND created_at > $${params.length}`;
  }

  sql += ` ORDER BY created_at DESC LIMIT $${params.length + 1}`;
  params.push(limit);

  const { rows } = await db.query(sql, params);
  return rows;
};

/**
 * Foydalanuvchiga yuborilmagan yangi xabarlarni oladi
 */
const getUnsentMessages = async (userId, regionKey, sinceMinutes = 60) => {
  const { rows } = await db.query(
    `SELECT cm.id, cm.message, cm.created_at, cm.detected_by
     FROM cargo_messages cm
     WHERE cm.region_key = $1
       AND cm.is_active = TRUE
       AND cm.created_at > NOW() - INTERVAL '${sinceMinutes} minutes'
       AND cm.id NOT IN (
         SELECT cargo_id FROM sent_messages WHERE user_id = $2
       )
     ORDER BY cm.created_at DESC
     LIMIT 20`,
    [regionKey, userId]
  );
  return rows;
};

/**
 * Yuborilgan xabarni qayd qiladi
 */
const markAsSent = async (userId, cargoId) => {
  await db.query(
    `INSERT INTO sent_messages (user_id, cargo_id)
     VALUES ($1, $2)
     ON CONFLICT (user_id, cargo_id) DO NOTHING`,
    [userId, cargoId]
  );
};

/**
 * Statistika
 */
const getStats = async () => {
  const { rows } = await db.query(`
    SELECT
      r.name_uz,
      r.key,
      COUNT(cm.id) AS total,
      COUNT(cm.id) FILTER (WHERE cm.created_at > NOW() - INTERVAL '24 hours') AS today,
      COUNT(cm.id) FILTER (WHERE cm.detected_by = 'ai') AS ai_detected
    FROM regions r
    LEFT JOIN cargo_messages cm ON cm.region_key = r.key AND cm.is_active = TRUE
    GROUP BY r.key, r.name_uz
    ORDER BY total DESC
  `);
  return rows;
};

module.exports = {
  saveCargoMessage,
  getCargoByRegion,
  getUnsentMessages,
  markAsSent,
  getStats,
};
