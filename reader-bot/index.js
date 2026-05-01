// reader-bot/index.js
// Telegram kanallardan yuk xabarlarini o'qib backend ga yuboruvchi bot

require("dotenv").config();
const fs = require("fs");
const path = require("path");
const axios = require("axios");
const input = require("input");
const { TelegramClient } = require("telegram");
const { StringSession } = require("telegram/sessions");
const { NewMessage } = require("telegram/events");

const logger = require("./logger");
const { classifyWithAI } = require("./aiClassifier");
const { isExcluded, detectRegionByKeyword } = require("../shared/regions");

// ─── Konfiguratsiya ───────────────────────────────────────────────────────────
const CONFIG = {
  apiId: parseInt(process.env.TELEGRAM_API_ID, 10),
  apiHash: process.env.TELEGRAM_API_HASH,
  backendUrl: process.env.BACKEND_URL || "http://localhost:5012",
  sessionFile: path.join(__dirname, "session.txt"),
  useAI: process.env.USE_AI_CLASSIFIER !== "false",
  duplicateWindowMs: (parseInt(process.env.DUPLICATE_WINDOW_MINUTES, 10) || 30) * 60 * 1000,
};

// ─── Session boshqaruvi ───────────────────────────────────────────────────────
const loadSession = () => {
  try {
    return fs.existsSync(CONFIG.sessionFile)
      ? fs.readFileSync(CONFIG.sessionFile, "utf-8").trim()
      : "";
  } catch {
    return "";
  }
};

const saveSession = (session) => {
  try {
    fs.writeFileSync(CONFIG.sessionFile, session, "utf-8");
    logger.info("Session saqlandi");
  } catch (err) {
    logger.error("Session saqlashda xato:", err.message);
  }
};

// ─── Takroriy xabar boshqaruvi ────────────────────────────────────────────────
const sentMessages = new Map();

const normalizeMessage = (msg) => msg.trim().toLowerCase().replace(/\s+/g, " ");

const isDuplicate = (normalized) => {
  const now = Date.now();
  const last = sentMessages.get(normalized);
  if (last && now - last <= CONFIG.duplicateWindowMs) return true;
  sentMessages.set(normalized, now);
  return false;
};

const cleanOldMessages = () => {
  const now = Date.now();
  for (const [msg, ts] of sentMessages) {
    if (now - ts > CONFIG.duplicateWindowMs) sentMessages.delete(msg);
  }
};

// ─── Statistika ───────────────────────────────────────────────────────────────
const stats = {
  total: 0,
  excluded: 0,
  duplicates: 0,
  noRegion: 0,
  sent: 0,
  aiUsed: 0,
  errors: 0,
};

const printStats = () => {
  logger.info(
    `📊 Statistika | Jami: ${stats.total} | Yuborildi: ${stats.sent} | ` +
    `AI: ${stats.aiUsed} | Filtrlandi: ${stats.excluded} | ` +
    `Takror: ${stats.duplicates} | Viloyatsiz: ${stats.noRegion} | Xato: ${stats.errors}`
  );
};

// Har 10 daqiqada statistika chiqarish
setInterval(printStats, 10 * 60 * 1000);

// ─── Backend ga yuborish ──────────────────────────────────────────────────────
const sendToBackend = async (message, regionKey, regionData, usedAI) => {
  try {
    await axios.post(
      `${CONFIG.backendUrl}/api/v1/cargo`,
      {
        message,
        regionKey,
        regionId: regionData.id,
        regionName: regionData.nameUz,
        detectedBy: usedAI ? "ai" : "keyword",
        createdAt: new Date().toISOString(),
      },
      { timeout: 5000 }
    );
    stats.sent++;
    if (usedAI) stats.aiUsed++;
    logger.info(`✅ [${regionData.nameUz}] ${message.slice(0, 60)}...`);
  } catch (err) {
    stats.errors++;
    const msg = err.response?.data?.message || err.message;
    logger.error(`❌ Backend xatosi [${regionData.nameUz}]: ${msg}`);
  }
};

// const sendToBackend = async (message, regionKey, regionData, usedAI) => {
//   try {
//     const payload = {
//       message,
//       regionKey,
//       regionId: regionData.id,
//       regionName: regionData.nameUz,
//       detectedBy: usedAI ? "ai" : "keyword",
//       createdAt: new Date().toISOString(),
//     };

//     console.log("📦 Payload:", payload);

//     stats.sent++;
//     if (usedAI) stats.aiUsed++;

//     logger.info(`🟡 [${regionData.nameUz}] (console) ${message.slice(0, 60)}...`);
//   } catch (err) {
//     stats.errors++;
//     logger.error(`❌ Console error: ${err.message}`);
//   }
// };

// ─── Xabar handler ────────────────────────────────────────────────────────────
const handleMessage = async (event) => {
  try {
    const rawMessage = event.message?.message;
    if (!rawMessage?.trim()) return;

    stats.total++;
    const normalized = normalizeMessage(rawMessage);

    // 1. Chet el filtri
    if (isExcluded(normalized)) {
      stats.excluded++;
      logger.debug(`⛔ Filtrlandi: ${rawMessage.slice(0, 40)}`);
      return;
    }

    // 2. Takroriy xabar tekshiruvi
    cleanOldMessages();
    if (isDuplicate(normalized)) {
      stats.duplicates++;
      logger.debug(`⏭️ Takror: ${rawMessage.slice(0, 40)}`);
      return;
    }

    // 3. Keyword orqali viloyat aniqlash
    const keywordResult = detectRegionByKeyword(normalized);
    if (keywordResult) {
      await sendToBackend(rawMessage, keywordResult.regionKey, keywordResult.region, false);
      return;
    }

    // 4. AI orqali viloyat aniqlash (keyword topilmasa)
    if (CONFIG.useAI) {
      logger.debug(`🤖 AI ga yuborilmoqda: ${rawMessage.slice(0, 40)}`);
      const aiRegion = await classifyWithAI(rawMessage);
      if (aiRegion) {
        const { REGIONS } = require("../shared/regions");
        const regionData = REGIONS[aiRegion];
        if (regionData) {
          await sendToBackend(rawMessage, aiRegion, regionData, true);
          return;
        }
      }
    }

    stats.noRegion++;
    logger.debug(`❓ Viloyat aniqlanmadi: ${rawMessage.slice(0, 40)}`);
  } catch (err) {
    stats.errors++;
    logger.error("Xabar qayta ishlashda xato:", err.message);
  }
};

// ─── Asosiy funksiya ──────────────────────────────────────────────────────────
(async () => {
  if (!CONFIG.apiId || !CONFIG.apiHash) {
    logger.error("TELEGRAM_API_ID va TELEGRAM_API_HASH .env da bo'lishi shart!");
    process.exit(1);
  }

  const stringSession = new StringSession(loadSession());
  const client = new TelegramClient(stringSession, CONFIG.apiId, CONFIG.apiHash, {
    connectionRetries: 5,
    timeout: 15000,
  });

  try {
    await client.start({
      phoneNumber: async () => input.text("📱 Telefon raqam (+998...): "),
      password: async () => input.text("🔐 2FA parol (bo'sh bo'lsa Enter): "),
      phoneCode: async () => input.text("📲 SMS kodini kiriting: "),
      onError: (err) => logger.error("Ulanish xatosi:", err.message),
    });

    saveSession(client.session.save());

    // Barcha yangi xabarlarni tinglash
    client.addEventHandler(handleMessage, new NewMessage({}));

    logger.info("🚀 Reader Bot ishga tushdi");
    logger.info(`🤖 AI klassifikator: ${CONFIG.useAI ? "YOQILGAN" : "O'CHIRILGAN"}`);
    logger.info(`⏱️ Takror filtri: ${CONFIG.duplicateWindowMs / 60000} daqiqa`);

    // Ulanish uzilsa qayta ulanish
    client.addEventHandler(async (update) => {
      // Connection state monitoring — gramjs o'zi qayta ulaydi
    });

  } catch (err) {
    logger.error("Bot ishga tushmadi:", err.message);
    process.exit(1);
  }
})();
