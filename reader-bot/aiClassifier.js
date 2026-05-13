// reader-bot/aiClassifier.js
// Claude API yordamida viloyatni aniqlovchi modul

const axios = require("axios");

const REGION_LIST = [
  "Sirdaryo", "Toshkent", "Samarqand", "Jizzax", "Navoiy",
  "Qashqadaryo", "Surhondaryo", "Xorazm", "Buxoro", "Fargona",
  "Andijon", "Namangan",
];

const SYSTEM_PROMPT = `Siz O'zbekistondagi yuk/kargo tashish xabarlarini tahlil qiluvchi yordamchisiz.

Vazifangiz: Berilgan xabar matnidan qaysi viloyatga tegishli ekanligini aniqlash.

Qoidalar:
1. Faqat quyidagi viloyatlardan birini yozing: ${REGION_LIST.join(", ")}
2. Agar xabar O'zbekistondagi yuk/kargo bilan bog'liq bo'lmasa — "null" yozing
3. Agar viloyatni aniqlay olmasangiz — "null" yozing
4. Javobda FAQAT viloyat nomi yoki "null" bo'lsin, boshqa hech narsa yo'q
5. Chet el (Rossiya, Qozog'iston, Turkiya va h.k.) xabarlari uchun "null" yozing`;

/**
 * Claude API orqali xabar viloyatini aniqlaydi
 * @param {string} message - asl xabar matni
 * @returns {Promise<string|null>} - viloyat nomi yoki null
 */
const classifyWithAI = async (message) => {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.warn("[AI] ANTHROPIC_API_KEY topilmadi, AI o'tkazib yuborildi");
    return null;
  }

  try {
    const response = await axios.post(
      "https://api.anthropic.com/v1/messages",
      {
        model: "claude-haiku-4-5-20251001", // Tez va arzon model
        max_tokens: 20,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: message }],
      },
      {
        headers: {
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
          "Content-Type": "application/json",
        },
        timeout: 8000,
      }
    );

    const result = response.data.content?.[0]?.text?.trim();
    if (!result || result === "null") return null;

    // Javob haqiqiy viloyat nomimi tekshiramiz
    const matched = REGION_LIST.find(
      (r) => r.toLowerCase() === result.toLowerCase()
    );
    return matched || null;
  } catch (err) {
    if (err.response?.status === 429) {
      console.warn("[AI] Rate limit — AI o'tkazib yuborildi");
    } else {
      console.error("[AI] Xato:", err.message);
    }
    return null;
  }
};

module.exports = { classifyWithAI };
