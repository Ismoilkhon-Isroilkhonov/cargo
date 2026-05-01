# 🚛 Cargo Bot — O'zbekiston Yuk Tizimi

Telegram kanallardagi yuk/kargo xabarlarini avtomatik o'qib, viloyatlarga ajratib, obuna bo'lgan foydalanuvchilarga real-time yetkazib beruvchi tizim.

## Arxitektura

```
Telegram Kanallar
      ↓
 Reader Bot          ← AI klassifikator (Claude API)
      ↓
 Backend API         ← Express + PostgreSQL
      ↓
  Database
      ↓
 Sender Bot          ← Obuna tizimi + real-time
      ↓
Foydalanuvchilar    ← Viloyat bo'yicha filter
```

## Papkalar

```
cargo-bot/
├── reader-bot/       # Telegram kanallarni o'quvchi bot
├── sender-bot/       # Foydalanuvchilarga yuboruvchi bot
├── backend/          # REST API + PostgreSQL
└── shared/           # Umumiy konstantalar (viloyatlar, kalit so'zlar)
```

## O'rnatish

### 1. Talablar
- Node.js 18+
- PostgreSQL 14+
- Telegram API credentials (my.telegram.org dan)
- Telegram Bot token (@BotFather dan)
- Claude API key (console.anthropic.com dan)

### 2. O'rnatish

```bash
# Barcha dependencylarni o'rnatish
cd reader-bot && npm install
cd ../sender-bot && npm install
cd ../backend && npm install
```

### 3. Muhit o'zgaruvchilari

Har bir papkada `.env.example` faylini `.env` ga nusxalab to'ldiring.

### 4. Database sozlash

```bash
cd backend
npm run db:migrate
```

### 5. Ishga tushirish

```bash
# 3 ta terminal — yoki PM2 bilan
cd backend && npm start
cd reader-bot && npm start
cd sender-bot && npm start
```

## Asosiy imkoniyatlar

- ✅ Telegram kanallardan avtomatik o'qish
- ✅ AI yordamida aniq viloyat aniqlash
- ✅ Viloyat bo'yicha obuna tizimi
- ✅ Real-time xabar yetkazish
- ✅ Takroriy xabarlarni filtrlash
- ✅ Chet el va keraksiz xabarlarni filtrlash
- ✅ Admin panel (statistika)
