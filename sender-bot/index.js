// sender-bot/index.js
// Foydalanuvchilarga yuk xabarlarini real-time yuboruvchi bot

require("dotenv").config();
const TelegramBot = require("node-telegram-bot-api");
const axios = require("axios");
const { REGIONS } = require("../shared/regions");

// ─── Konfiguratsiya ───────────────────────────────────────────────────────────
const CONFIG = {
  token: process.env.TELEGRAM_BOT_TOKEN,
  backendUrl: process.env.BACKEND_URL || "http://localhost:5012",
  pollIntervalMs: (parseInt(process.env.POLL_INTERVAL_SECONDS, 10) || 30) * 1000,
  maxMessagesPerPoll: parseInt(process.env.MAX_MESSAGES_PER_POLL, 10) || 5,
};

if (!CONFIG.token) {
  console.error("❌ TELEGRAM_BOT_TOKEN .env da bo'lishi shart!");
  process.exit(1);
}

const bot = new TelegramBot(CONFIG.token, { polling: true });

// ─── Backend bilan ishlash ────────────────────────────────────────────────────
const api = axios.create({
  baseURL: `${CONFIG.backendUrl}/api/v1`,
  timeout: 5000,
});

const saveUser = async (user) => {
  try {
    await api.post("/users", {
      id: user.id,
      username: user.username,
      firstName: user.first_name,
    });
  } catch {}
};

const setRegion = async (userId, regionKey) => {
  await api.patch(`/users/${userId}/region`, { regionKey });
};

const getUser = async (userId) => {
  try {
    const { data } = await api.get(`/users/${userId}`);
    return data.success ? data.data : null;
  } catch {
    return null;
  }
};

const getUnsentMessages = async (userId, regionKey) => {
  try {
    const { data } = await api.get(
      `/cargo/unsent/${userId}/${regionKey}`,
      { params: { sinceMinutes: Math.ceil(CONFIG.pollIntervalMs / 60000) + 5 } }
    );
    return data.success ? data.data : [];
  } catch {
    return [];
  }
};

const markSent = async (userId, cargoIds) => {
  try {
    await api.post("/cargo/mark-sent", { userId, cargoIds });
  } catch {}
};

// ─── Klaviatura ───────────────────────────────────────────────────────────────
const MAIN_KEYBOARD = {
  keyboard: [
    ["🗺️ Viloyat tanlash", "📋 Mening viloyatim"],
    ["⏸️ Pauza", "📊 Statistika"],
    ["ℹ️ Yordam"],
  ],
  resize_keyboard: true,
};

const regionKeyboard = () => {
  const regionNames = Object.values(REGIONS);
  const rows = [];
  for (let i = 0; i < regionNames.length; i += 3) {
    rows.push(
      regionNames.slice(i, i + 3).map((r) => ({
        text: r.nameUz,
        callback_data: `region:${Object.keys(REGIONS).find((k) => REGIONS[k] === r)}`,
      }))
    );
  }
  rows.push([{ text: "❌ Bekor qilish", callback_data: "cancel" }]);
  return { inline_keyboard: rows };
};

// Foydalanuvchi holati (pause/active)
const pausedUsers = new Set();

// ─── Komandalar ───────────────────────────────────────────────────────────────
bot.onText(/\/start/, async (msg) => {
  const { from } = msg;
  await saveUser(from);

  const user = await getUser(from.id);
  const name = from.first_name || "Do'stim";

  let text = `👋 Assalomu alaykum, *${name}*!\n\n`;
  text += `🚛 *Cargo Bot*ga xush kelibsiz!\n\n`;
  text += `Bu bot O'zbekiston bo'ylab yuk/kargo xabarlarini real-time yetkazib beradi.\n\n`;

  if (user?.selected_region) {
    text += `✅ Siz hozir *${user.region_name}* viloyatiga obunasiz.\n`;
    text += `Xabarlar avtomatik keladi.`;
  } else {
    text += `⚠️ Hali viloyat tanlanmagan.\n`;
    text += `"🗺️ Viloyat tanlash" tugmasini bosing.`;
  }

  bot.sendMessage(msg.chat.id, text, {
    parse_mode: "Markdown",
    reply_markup: MAIN_KEYBOARD,
  });
});

bot.onText(/\/help|ℹ️ Yordam/, (msg) => {
  const text = [
    "*📖 Yordam*\n",
    "🗺️ *Viloyat tanlash* — qaysi viloyat xabarlarini olishni tanlang",
    "📋 *Mening viloyatim* — hozirgi obunangizni ko'ring",
    "⏸️ *Pauza* — xabarlarni vaqtincha to'xtatish",
    "📊 *Statistika* — bugungi xabarlar soni\n",
    `⏱️ Xabarlar har *${CONFIG.pollIntervalMs / 1000}* soniyada tekshiriladi`,
  ].join("\n");

  bot.sendMessage(msg.chat.id, text, { parse_mode: "Markdown", reply_markup: MAIN_KEYBOARD });
});

// Viloyat tanlash
bot.on("message", async (msg) => {
  if (!msg.text || msg.text.startsWith("/")) return;

  const chatId = msg.chat.id;
  const text = msg.text;

  if (text === "🗺️ Viloyat tanlash") {
    bot.sendMessage(chatId, "🗺️ Qaysi viloyat xabarlarini olmoqchisiz?", {
      reply_markup: regionKeyboard(),
    });
    return;
  }

  if (text === "📋 Mening viloyatim") {
    const user = await getUser(msg.from.id);
    if (user?.selected_region) {
      const isPaused = pausedUsers.has(msg.from.id);
      bot.sendMessage(
        chatId,
        `✅ Viloyatingiz: *${user.region_name}*\n` +
        `Holat: ${isPaused ? "⏸️ Pauza" : "▶️ Aktiv"}`,
        { parse_mode: "Markdown", reply_markup: MAIN_KEYBOARD }
      );
    } else {
      bot.sendMessage(chatId, "⚠️ Hali viloyat tanlanmagan.", { reply_markup: MAIN_KEYBOARD });
    }
    return;
  }

  if (text === "⏸️ Pauza") {
    if (pausedUsers.has(msg.from.id)) {
      pausedUsers.delete(msg.from.id);
      bot.sendMessage(chatId, "▶️ Xabarlar qayta yoqildi!", { reply_markup: MAIN_KEYBOARD });
    } else {
      pausedUsers.add(msg.from.id);
      bot.sendMessage(chatId, "⏸️ Xabarlar to'xtatildi. Qayta yoqish uchun yana bosing.", {
        reply_markup: MAIN_KEYBOARD,
      });
    }
    return;
  }

  if (text === "📊 Statistika") {
    try {
      const { data } = await api.get("/stats");
      if (!data.success) throw new Error();

      const total = data.data.reduce((s, r) => s + r.todayMessages, 0);
      const totalSubs = data.data.reduce((s, r) => s + r.subscribers, 0);

      let statsText = `📊 *Bugungi statistika*\n\n`;
      statsText += `📨 Jami xabarlar: *${total}*\n`;
      statsText += `👥 Obunachiler: *${totalSubs}*\n\n`;
      statsText += `*Viloyatlar bo'yicha:*\n`;

      data.data.forEach((r) => {
        if (r.todayMessages > 0 || r.subscribers > 0) {
          statsText += `• ${r.region}: ${r.todayMessages} xabar, ${r.subscribers} obunachi\n`;
        }
      });

      bot.sendMessage(chatId, statsText, { parse_mode: "Markdown", reply_markup: MAIN_KEYBOARD });
    } catch {
      bot.sendMessage(chatId, "❌ Statistika yuklanmadi.", { reply_markup: MAIN_KEYBOARD });
    }
  }
});

// Inline keyboard callbacklar
bot.on("callback_query", async (query) => {
  const { data, from, message } = query;

  if (data === "cancel") {
    bot.answerCallbackQuery(query.id);
    bot.editMessageText("❌ Bekor qilindi.", {
      chat_id: message.chat.id,
      message_id: message.message_id,
    });
    return;
  }

  if (data.startsWith("region:")) {
    const regionKey = data.split(":")[1];
    const regionData = REGIONS[regionKey];

    if (!regionData) {
      bot.answerCallbackQuery(query.id, { text: "Noma'lum viloyat!" });
      return;
    }

    try {
      await saveUser(from);
      await setRegion(from.id, regionKey);
      pausedUsers.delete(from.id); // Yangi viloyat tanlanganda pauzani olib tashlash

      bot.answerCallbackQuery(query.id, { text: `✅ ${regionData.nameUz} tanlandi!` });
      bot.editMessageText(
        `✅ *${regionData.nameUz}* viloyati tanlandi!\n\nEndi ushbu viloyatdan kelgan yuk xabarlari sizga yuboriladi.`,
        {
          chat_id: message.chat.id,
          message_id: message.message_id,
          parse_mode: "Markdown",
        }
      );
    } catch (err) {
      bot.answerCallbackQuery(query.id, { text: "Xato yuz berdi!" });
    }
  }
});

// ─── Real-time xabar yuborish ─────────────────────────────────────────────────
const formatCargoMessage = (msg, regionName) => {
  const time = new Date(msg.created_at).toLocaleTimeString("uz-UZ", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Tashkent",
  });
  const aiTag = msg.detected_by === "ai" ? " 🤖" : "";
  return `📦 *${regionName}*${aiTag} | ${time}\n\n${msg.message}`;
};

let isPolling = false;

const pollAndSend = async () => {
  if (isPolling) return; // Oldingi polling hali tugamagan bo'lsa o'tkazib yuborish
  isPolling = true;

  try {
    // Barcha aktiv foydalanuvchilarni har bir viloyat uchun tekshirish
    const { data: statsData } = await api.get("/stats").catch(() => ({ data: null }));
    if (!statsData?.success) return;

    for (const regionStat of statsData.data) {
      if (regionStat.subscribers === 0) continue;

      // Ushbu viloyatga obuna bo'lgan foydalanuvchilarni backenddan olamiz
      try {
        const { data: usersData } = await api.get(`/users/by-region/${regionStat.key}`)
          .catch(() => ({ data: { success: false } }));

        if (!usersData?.success || !usersData.data?.length) continue;

        for (const user of usersData.data) {
          // Pauza rejimida bo'lsa o'tkazib yuborish
          if (pausedUsers.has(user.id)) continue;

          const messages = await getUnsentMessages(user.id, regionStat.key);
          if (!messages.length) continue;

          // Max N ta xabar yuborish
          const toSend = messages.slice(0, CONFIG.maxMessagesPerPoll);
          const sentIds = [];

          for (const msg of toSend) {
            try {
              await bot.sendMessage(
                user.id,
                formatCargoMessage(msg, regionStat.region),
                { parse_mode: "Markdown" }
              );
              sentIds.push(msg.id);
              // Har xabar orasida 300ms kutish (Telegram rate limit)
              await new Promise((r) => setTimeout(r, 300));
            } catch (err) {
              // Foydalanuvchi botni bloklagan bo'lishi mumkin
              if (err.response?.statusCode === 403) {
                console.log(`👤 Foydalanuvchi ${user.id} botni bloklagan`);
              }
            }
          }

          if (sentIds.length > 0) {
            await markSent(user.id, sentIds);
          }
        }
      } catch {}
    }
  } catch (err) {
    console.error("[Polling] Xato:", err.message);
  } finally {
    isPolling = false;
  }
};

// Polling ni ishga tushirish
setInterval(pollAndSend, CONFIG.pollIntervalMs);

// Bot ishga tushganda birinchi polling
setTimeout(pollAndSend, 3000);

// ─── Xatolarni ushlash ────────────────────────────────────────────────────────
bot.on("polling_error", (err) => {
  console.error("[Telegram] Polling xatosi:", err.message);
});

process.on("uncaughtException", (err) => {
  console.error("[Process] Kutilmagan xato:", err.message);
});

console.log("🤖 Sender Bot ishga tushdi!");
console.log(`⏱️ Polling interval: ${CONFIG.pollIntervalMs / 1000}s`);
