// backend/src/controllers/userController.js

const userService = require("../services/userService");

/**
 * POST /api/v1/users
 * Foydalanuvchini ro'yxatdan o'tkazadi yoki yangilaydi
 */
const upsertUser = async (req, res) => {
  try {
    const { id, username, firstName, phone } = req.body;

    if (!id) {
      return res.status(400).json({ success: false, error: "id majburiy" });
    }

    const user = await userService.upsertUser({ id, username, firstName, phone });
    return res.json({ success: true, data: user });
  } catch (err) {
    console.error("[user] Upsert xatosi:", err.message);
    return res.status(500).json({ success: false, error: "Server xatosi" });
  }
};

/**
 * PATCH /api/v1/users/:userId/region
 * Foydalanuvchi viloyatini tanlaydi
 */
const selectRegion = async (req, res) => {
  try {
    const userId = parseInt(req.params.userId, 10);
    const { regionKey } = req.body;

    if (!regionKey) {
      return res.status(400).json({ success: false, error: "regionKey majburiy" });
    }

    const user = await userService.setUserRegion(userId, regionKey);
    if (!user) {
      return res.status(404).json({ success: false, error: "Foydalanuvchi topilmadi" });
    }

    return res.json({ success: true, data: user });
  } catch (err) {
    console.error("[user] Region tanlashda xato:", err.message);
    return res.status(500).json({ success: false, error: "Server xatosi" });
  }
};

/**
 * GET /api/v1/users/:userId
 */
const getUser = async (req, res) => {
  try {
    const userId = parseInt(req.params.userId, 10);
    const user = await userService.getUserById(userId);

    if (!user) {
      return res.status(404).json({ success: false, error: "Topilmadi" });
    }

    return res.json({ success: true, data: user });
  } catch (err) {
    console.error("[user] Get xatosi:", err.message);
    return res.status(500).json({ success: false, error: "Server xatosi" });
  }
};

/**
 * GET /api/v1/users/by-region/:regionKey
 * Berilgan viloyatga obuna bo'lgan foydalanuvchilarni oladi
 */
const getUsersByRegion = async (req, res) => {
  try {
    const { regionKey } = req.params;
    const users = await userService.getActiveUsersByRegion(regionKey);
    return res.json({ success: true, count: users.length, data: users });
  } catch (err) {
    console.error("[user] By-region xatosi:", err.message);
    return res.status(500).json({ success: false, error: "Server xatosi" });
  }
};

module.exports = { upsertUser, selectRegion, getUser, getUsersByRegion };
