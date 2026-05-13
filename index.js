// reader-bot/index.js

require("dotenv").config();
const fs    = require("fs");
const path  = require("path");
const axios = require("axios");
const input = require("input");

const { TelegramClient } = require("telegram");
const { StringSession }  = require("telegram/sessions");
const { NewMessage }     = require("telegram/events");

const logger = require("./logger");
const { classifyWithAI }              = require("./aiClassifier");
const { isExcluded, detectRegionByKeyword } = require("../shared/regions");

// ─── Config ──────────────────────────────────────────────────────────────────
const CONFIG = {
  apiId:             parseInt(process.env.TELEGRAM_API_ID, 10),
  apiHash:           process.env.TELEGRAM_API_HASH,
  backendUrl:        process.env.BACKEND_URL || "http://localhost:5012",
  sessionFile:       path.join(__dirname, "session.txt"),
  useAI:             process.env.USE_AI_CLASSIFIER !== "false",
  duplicateWindowMs: (parseInt(process.env.DUPLICATE_WINDOW_MINUTES, 10) || 30) * 60 * 1000,
};

// ─── Session ─────────────────────────────────────────────────────────────────
const loadSession = () => {
  try {
    return fs.existsSync(CONFIG.sessionFile)
      ? fs.readFileSync(CONFIG.sessionFile, "utf-8").trim()
      : "";
  } catch { return ""; }
};

const saveSession = (session) => {
  try {
    fs.writeFileSync(CONFIG.sessionFile, session, "utf-8");
    logger.info("Session saqlandi");
  } catch (err) {
    logger.error("Session saqlashda xato:", err.message);
  }
};

// ─── Duplicate filter ─────────────────────────────────────────────────────────
const sentMessages = new Map();

const normalizeMessage = (msg) =>
  msg.trim().toLowerCase().replace(/\s+/g, " ").slice(0, 200);

const isDuplicate = (normalized) => {
  const now  = Date.now();
  const last = sentMessages.get(normalized);
  if (last && now - last <= CONFIG.duplicateWindowMs) return true;
  sentMessages.set(normalized, now);
  return false;
};

const cleanOldDuplicates = () => {
  const now = Date.now();
  for (const [msg, ts] of sentMessages) {
    if (now - ts > CONFIG.duplicateWindowMs) sentMessages.delete(msg);
  }
};

// ─── Stats ────────────────────────────────────────────────────────────────────
const stats = { total: 0, excluded: 0, duplicates: 0, noRegion: 0, sent: 0, aiUsed: 0, errors: 0 };

setInterval(() => {
  logger.info(
    `📊 Jami: ${stats.total} | Yuborildi: ${stats.sent} | AI: ${stats.aiUsed} | ` +
    `Filtrlandi: ${stats.excluded} | Takror: ${stats.duplicates} | ` +
    `Viloyatsiz: ${stats.noRegion} | Xato: ${stats.errors}`
  );
}, 10 * 60 * 1000);

// ─── Backend ──────────────────────────────────────────────────────────────────
const sendToBackend = async (message, regionKey, regionData, usedAI) => {
  try {
    await axios.post(
      `${CONFIG.backendUrl}/api/v1/cargo`,
      {
        message,
        regionKey,
        regionId:   regionData.id,
        regionName: regionData.nameUz,
        detectedBy: usedAI ? "ai" : "keyword",
      },
      { timeout: 5000 }
    );
    stats.sent++;
    if (usedAI) stats.aiUsed++;
    logger.info(`✅ [${regionData.nameUz}] ${message.slice(0, 70)}`);
  } catch (err) {
    stats.errors++;
    // logger.error(`❌ Backend: ${err.response?.data?.error || err.message}`);
  }
};

// ─── Core: xabarni qayta ishlash ─────────────────────────────────────────────
// BIRINCHI KODDAN O'RGANILGAN: entity va msg alohida olinadi
const processOneMessage = async (entity, msg) => {
  try {
    if (!msg) return;
    if (msg.out) return;                        // o'zimiz yuborgan xabar — o'tkazib yuborish
    if (!msg.message && !msg.media) return;     // bo'sh xabar

    const rawText = (msg.message || "").trim();
    if (!rawText || rawText.length < 5) return;

    stats.total++;
    const normalized = normalizeMessage(rawText);

    // 1. Chet el filtri
    if (isExcluded(normalized)) {
      stats.excluded++;
      logger.debug(`⛔ Filtrlandi: ${rawText.slice(0, 40)}`);
      return;
    }

    // 2. Takroriy xabar
    cleanOldDuplicates();
    if (isDuplicate(normalized)) {
      stats.duplicates++;
      logger.debug(`⏭️ Takror: ${rawText.slice(0, 40)}`);
      return;
    }

    // 3. Keyword orqali viloyat
    const keywordResult = detectRegionByKeyword(normalized);
    if (keywordResult) {
      await sendToBackend(rawText, keywordResult.regionKey, keywordResult.region, false);
      return;
    }

    // 4. AI orqali viloyat
    if (CONFIG.useAI) {
      logger.debug(`🤖 AI: ${rawText.slice(0, 50)}`);
      const aiRegion = await classifyWithAI(rawText);
      if (aiRegion) {
        const { REGIONS } = require("../shared/regions");
        const regionData  = REGIONS[aiRegion];
        if (regionData) {
          await sendToBackend(rawText, aiRegion, regionData, true);
          return;
        }
      }
    }

    stats.noRegion++;
    logger.debug(`❓ Viloyat aniqlanmadi: ${rawText.slice(0, 40)}`);
  } catch (err) {
    stats.errors++;
    logger.error("processOneMessage xato:", err.message);
  }
};

// ─── Main ─────────────────────────────────────────────────────────────────────
(async () => {
  if (!CONFIG.apiId || !CONFIG.apiHash) {
    logger.error("TELEGRAM_API_ID va TELEGRAM_API_HASH .env da bo'lishi shart!");
    process.exit(1);
  }

  const stringSession = new StringSession(loadSession());
  const client = new TelegramClient(stringSession, CONFIG.apiId, CONFIG.apiHash, {
    connectionRetries: 10,
    retryDelay: 3000,
    autoReconnect: true,
    timeout: 30000,
  });

  await client.start({
    phoneNumber: async () => input.text("📱 Telefon raqam (+998...): "),
    password:    async () => input.text("🔐 2FA parol (bo'sh — Enter): "),
    phoneCode:   async () => input.text("📲 SMS kodni kiriting: "),
    onError:     (err) => logger.error("Ulanish xatosi:", err.message),
  });

  saveSession(client.session.save());
  logger.info("✅ Telegram ga ulandi");

  // ── Barcha dialog/kanallarni yuklash (sessiyani to'liq aktivlashtiradi) ──
  const dialogs = await client.getDialogs({});
  const sourceEntities = [];

  for (const dialog of dialogs) {
    const entity = dialog.entity;
    if (!entity) continue;
    // faqat kanallar va guruhlar
    if (!entity.broadcast && !entity.megagroup) continue;
    sourceEntities.push(entity);
  }

  logger.info(`📡 Topilgan kanallar/guruhlar: ${sourceEntities.length} ta`);
  sourceEntities.forEach(e => {
    logger.info(`  - [${e.id}] ${e.title || e.username || "nomsiz"}`);
  });

  // ── Har bir kanaldan oxirgi 5 xabarni o'qish ──────────────────────────────
  for (const entity of sourceEntities) {
    try {
      const messages = await client.getMessages(entity, { limit: 5 });

      // console.log(messages);
      

      for (const msg of messages.reverse()) {
        await processOneMessage(entity, msg);
      }
    } catch (err) {
      logger.error(`History xato [${entity.title}]: ${err.message}`);
    }
  }

  // ── REAL-TIME: BIRINCHI KODDAN O'RGANILGAN USUL ───────────────────────────
  // event.message → getChat() → entity va msg alohida olinadi
  // Bu usul BARCHA xabarlarni to'g'ri ushlaydi
  client.addEventHandler(async (event) => {
  try {
    // console.log(event);
    
    if (!event.message) return;

    const msg  = event.message;
    const chat = await msg.getChat();
    console.log(chat);
    
    if (!chat) return;

    if (!chat.broadcast && !chat.megagroup) return;

    if (!msg.message) return;

    console.log("📩 YANGI XABAR:");
    console.log("Chat:", chat.title || chat.username || chat.id);
    console.log("Text:", msg.message);
    console.log("-------------------------");

  } catch (err) {
    console.log("❌ Realtime xato:", err.message);
  }
}, new NewMessage({}));

  logger.info("🚀 Reader Bot ishga tushdi — barcha kanallarni tinglayapti");
  logger.info(`🤖 AI: ${CONFIG.useAI ? "YOQILGAN" : "O'CHIRILGAN"}`);
  logger.info(`⏱️  Takror filtri: ${CONFIG.duplicateWindowMs / 60000} daqiqa`);
})();