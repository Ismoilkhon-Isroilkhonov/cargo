// backend/src/controllers/cargoController.js

const cargoService = require("../services/cargoService");

/**
 * POST /api/v1/cargo
 * Reader bot dan yangi xabar qabul qiladi
 */
const receiveCargo = async (req, res) => {
  try {
    const { message, regionKey, regionId, regionName, detectedBy } = req.body;

    if (!message || !regionKey || !regionId) {
      return res.status(400).json({
        success: false,
        error: "message, regionKey va regionId majburiy",
      });
    }

    if (message.length > 2000) {
      return res.status(400).json({
        success: false,
        error: "Xabar 2000 belgidan oshmasligi kerak",
      });
    }

    const saved = await cargoService.saveCargoMessage({
      message,
      regionKey,
      regionId,
      detectedBy,
    });

    return res.status(201).json({ success: true, id: saved.id });
  } catch (err) {
    console.error("[cargo] Saqlashda xato:", err.message);
    return res.status(500).json({ success: false, error: "Server xatosi" });
  }
};

/**
 * GET /api/v1/cargo/:regionKey
 * Viloyat bo'yicha xabarlarni oladi
 * Query: ?limit=50&since=2024-01-01T00:00:00Z
 */
const getCargoByRegion = async (req, res) => {
  try {
    const { regionKey } = req.params;
    const limit = Math.min(parseInt(req.query.limit, 10) || 50, 200);
    const since = req.query.since || null;

    const messages = await cargoService.getCargoByRegion(regionKey, limit, since);
    return res.json({ success: true, count: messages.length, data: messages });
  } catch (err) {
    console.error("[cargo] O'qishda xato:", err.message);
    return res.status(500).json({ success: false, error: "Server xatosi" });
  }
};

/**
 * GET /api/v1/cargo/unsent/:userId/:regionKey
 * Foydalanuvchiga yuborilmagan xabarlarni oladi
 */
const getUnsentMessages = async (req, res) => {
  try {
    const { userId, regionKey } = req.params;
    const since = parseInt(req.query.sinceMinutes, 10) || 60;

    const messages = await cargoService.getUnsentMessages(
      parseInt(userId, 10),
      regionKey,
      since
    );
    return res.json({ success: true, count: messages.length, data: messages });
  } catch (err) {
    console.error("[cargo] Unsent xatosi:", err.message);
    return res.status(500).json({ success: false, error: "Server xatosi" });
  }
};

/**
 * POST /api/v1/cargo/mark-sent
 * Yuborilgan xabarlarni belgilaydi
 */
const markSent = async (req, res) => {
  try {
    const { userId, cargoIds } = req.body;
    if (!userId || !Array.isArray(cargoIds) || cargoIds.length === 0) {
      return res.status(400).json({ success: false, error: "userId va cargoIds kerak" });
    }

    for (const cargoId of cargoIds) {
      await cargoService.markAsSent(userId, cargoId);
    }

    return res.json({ success: true, marked: cargoIds.length });
  } catch (err) {
    console.error("[cargo] Mark-sent xatosi:", err.message);
    return res.status(500).json({ success: false, error: "Server xatosi" });
  }
};

/**
 * GET /api/v1/stats
 * Umumiy statistika
 */
const getStats = async (req, res) => {
  try {
    const cargoStats = await cargoService.getStats();
    const userService = require("../services/userService");
    const userStats = await userService.getUserStats();

    // Birlashtirish
    const combined = cargoStats.map((c) => {
      const u = userStats.find((s) => s.key === c.key) || {};
      return {
        region: c.name_uz,
        key: c.key,
        totalMessages: parseInt(c.total, 10),
        todayMessages: parseInt(c.today, 10),
        aiDetected: parseInt(c.ai_detected, 10),
        subscribers: parseInt(u.subscriber_count || 0, 10),
      };
    });

    return res.json({ success: true, data: combined, generatedAt: new Date() });
  } catch (err) {
    console.error("[stats] Xato:", err.message);
    return res.status(500).json({ success: false, error: "Server xatosi" });
  }
};

module.exports = { receiveCargo, getCargoByRegion, getUnsentMessages, markSent, getStats };
