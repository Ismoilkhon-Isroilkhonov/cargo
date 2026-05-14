// reader-bot/index.js

require("dotenv").config();
const fs = require("fs");
const path = require("path");
const axios = require("axios");
const input = require("input");

const { TelegramClient } = require("telegram");
const { StringSession } = require("telegram/sessions");
const { Api } = require("telegram");

const logger = require("./logger");
const { classifyWithAI } = require("./aiClassifier");
const { isExcluded, detectRegionByKeyword } = require("../shared/regions");

// ─── Config ──────────────────────────────────────────────────────────────────
const CONFIG = {
  apiId: parseInt(process.env.TELEGRAM_API_ID, 10),
  apiHash: process.env.TELEGRAM_API_HASH,
  backendUrl: process.env.BACKEND_URL || "http://localhost:5012",
  sessionFile: path.join(__dirname, "session.txt"),
  useAI: process.env.USE_AI_CLASSIFIER !== "false",
  duplicateWindowMs:
    (parseInt(process.env.DUPLICATE_WINDOW_MINUTES, 10) || 30) * 60 * 1000,
};

// ─── Session ─────────────────────────────────────────────────────────────────
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

// ─── Chat ID normalizatsiya ───────────────────────────────────────────────────
// Barcha ID larni string formatiga keltiramiz, -100 prefixini olib tashlaymiz
function normalizeChatId(id) {
  return String(id).replace(/^-100/, "").replace(/^-/, "");
}

// ─── CARGO_CHAT_IDS — STRING formatida saqlaymiz ─────────────────────────────
const CARGO_CHAT_IDS = new Set([
  "1210236379", // YUK MARKAZI
  "2182000321", // 🚛YUK MARKAZI🚚
  "2251329979", // Tezkor Yuk
  "2456189523", // Yuk fura
  "2284204348", // isuzu sprinter Gazel yuk
  "2209710843", // Shafyorlar Gruppasi
  "2457958196", // Labo sprinter uz
]);

// ─── Duplicate filter ─────────────────────────────────────────────────────────
const sentMessages = new Map();

const normalizeMessage = (msg) =>
  msg.trim().toLowerCase().replace(/\s+/g, " ").slice(0, 200);

const isDuplicate = (normalized) => {
  const now = Date.now();
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
const stats = {
  total: 0,
  excluded: 0,
  duplicates: 0,
  noRegion: 0,
  sent: 0,
  aiUsed: 0,
  errors: 0,
};

setInterval(
  () => {
    logger.info(
      `📊 Jami: ${stats.total} | Yuborildi: ${stats.sent} | AI: ${stats.aiUsed} | ` +
        `Filtrlandi: ${stats.excluded} | Takror: ${stats.duplicates} | ` +
        `Viloyatsiz: ${stats.noRegion} | Xato: ${stats.errors}`,
    );
  },
  10 * 60 * 1000,
);

// ─── Backend ──────────────────────────────────────────────────────────────────
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
      },
      { timeout: 5000 },
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
const processOneMessage = async (entity, msg) => {
  try {
    if (!msg) return;
    if (msg.out) return; // o'zimiz yuborgan xabar
    if (!msg.message && !msg.media) return;

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
      await sendToBackend(
        rawText,
        keywordResult.regionKey,
        keywordResult.region,
        false,
      );
      return;
    }

    // 4. AI orqali viloyat
    if (CONFIG.useAI) {
      logger.debug(`🤖 AI: ${rawText.slice(0, 50)}`);
      const aiRegion = await classifyWithAI(rawText);
      if (aiRegion) {
        const { REGIONS } = require("../shared/regions");
        const regionData = REGIONS[aiRegion];
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
    logger.error("TELEGRAM_API_ID va TELEGRAM_API_HASH kerak!");
    process.exit(1);
  }

  const stringSession = new StringSession(loadSession());

  const client = new TelegramClient(
    stringSession,
    CONFIG.apiId,
    CONFIG.apiHash,
    {
      connectionRetries: 10,
      retryDelay: 3000,
      autoReconnect: true,
      timeout: 30000,
      sequentialUpdates: true,
    },
  );

  await client.start({
    phoneNumber: async () => input.text("📱 Telefon: "),
    password: async () => input.text("🔐 2FA: "),
    phoneCode: async () => input.text("📲 Kod: "),
  });

  saveSession(client.session.save());

  logger.info("✅ Telegram ga ulandi");

  // ❌ catchUp OLIB TASHLANDI
  // await client.catchUp();

  // ─────────────────────────────────────────────
  // CHAT ID NORMALIZE
  // ─────────────────────────────────────────────
const normalizeChatId = (id) => {
  const s = String(id);
  return s.startsWith("-100") ? s.slice(4) : s;
};
  // ─────────────────────────────────────────────
  // GROUP FILTER
  // ─────────────────────────────────────────────
  const CARGO_CHAT_IDS = new Set(
    [
      1210236379, 2182000321, 2251329979, 2456189523, 2284204348, 2209710843,
      2457958196,
    ].map(String),
  );

  // ─────────────────────────────────────────────
  // GET GROUPS
  // ─────────────────────────────────────────────
  const dialogs = await client.getDialogs({});
  const sourceEntities = [];

  for (const dialog of dialogs) {
    const entity = dialog.entity;
    if (!entity) continue;

    if (!entity.broadcast && !entity.megagroup) continue;

    const id = normalizeChatId(entity.id);

    if (!CARGO_CHAT_IDS.has(id)) continue;

    sourceEntities.push(entity);

    logger.info(`📌 TOPILDI: [${id}] ${entity.title}`);
  }

  logger.info(`🚛 Guruhlar: ${sourceEntities.length}`);

  // ─────────────────────────────────────────────
  // HISTORY LOAD (oxirgi 5 ta)
  // ─────────────────────────────────────────────
  for (const entity of sourceEntities) {
    try {
      const messages = await client.getMessages(entity, { limit: 5 });

      for (const msg of messages.reverse()) {
        await processOneMessage(entity, msg);
      }
    } catch (err) {
      logger.error(`History error: ${err.message}`);
    }
  }

  // ─────────────────────────────────────────────
  // REAL-TIME (ENG MUHIM QISM)
  // ─────────────────────────────────────────────
  const { NewMessage } = require("telegram/events");

  client.addEventHandler(async (update) => {
  try {
    let msg = null;

    // Channel message
    if (update instanceof Api.UpdateNewChannelMessage) {
      msg = update.message;
    }

    // Group/user message
    if (update instanceof Api.UpdateNewMessage) {
      msg = update.message;
    }

    if (!msg) return;
    if (!msg.message) return;
    if (msg.out) return;

    const peer = msg.peerId;

    const chatId =
      peer?.channelId ||
      peer?.chatId ||
      peer?.userId;

    if (!chatId) return;

    const normalized = normalizeChatId(chatId);

    if (!CARGO_CHAT_IDS.has(normalized)) return;

    logger.info("🚀 REAL MESSAGE (RAW)");

    logger.info(`📦 Chat ID: ${normalized}`);
    logger.info(`📝 ${msg.message}`);

    await processOneMessage({ id: normalized }, msg);

  } catch (err) {
    logger.error("RAW UPDATE ERROR:", err.message);
  }
});

  logger.info("🚀 BOT ISHGA TUSHDI (REAL-TIME ACTIVE)");

  // ─────────────────────────────────────────────
  // OPTIONAL POLLING (agar internet unstable bo‘lsa)
  // ─────────────────────────────────────────────
 const lastMsgId = new Map();

// init
for (const entity of sourceEntities) {
  try {
    const msgs = await client.getMessages(entity, { limit: 1 });
    if (msgs.length) {
      lastMsgId.set(normalizeChatId(entity.id), msgs[0].id);
    }
  } catch {}
}

setInterval(async () => {
  for (const entity of sourceEntities) {
    try {
      const eid = normalizeChatId(entity.id);
      const lastId = lastMsgId.get(eid) || 0;

      const msgs = await client.getMessages(entity, {
        limit: 30,
        minId: lastId,
      });

      if (!msgs.length) continue;

      let max = lastId;

      for (const msg of msgs.reverse()) {
        if (!msg.message) continue;
        if (msg.id <= lastId) continue;

        max = Math.max(max, msg.id);

        logger.info(`📩 POLL: ${entity.title} -> ${msg.message}`);

        await processOneMessage(entity, msg);
      }

      lastMsgId.set(eid, max);

    } catch (err) {
      logger.debug("poll error", err.message);
    }
  }
}, 3000); // 3 sec (5 ham bo‘ladi)
})();
