// backend/src/index.js

require("dotenv").config();
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const rateLimit = require("express-rate-limit");

const routes = require("./routes");
const db = require("./db");

const app = express();
const PORT = parseInt(process.env.PORT, 10) || 5012;

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(helmet());
app.use(cors({ origin: "*" })); // Production da cheklang
app.use(express.json({ limit: "10kb" }));
app.use(morgan(process.env.NODE_ENV === "production" ? "combined" : "dev"));

// Rate limiting — har daqiqada max 100 so'rov
app.use(
  "/api",
  rateLimit({
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10) || 60_000,
    max: parseInt(process.env.RATE_LIMIT_MAX, 10) || 100,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, error: "Juda ko'p so'rov, keyinroq urinib ko'ring" },
  })
);

// ─── Routes ───────────────────────────────────────────────────────────────────
app.use("/api/v1", routes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ success: false, error: "Endpoint topilmadi" });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error("[Server] Xato:", err.message);
  res.status(500).json({ success: false, error: "Ichki server xatosi" });
});

// ─── Start ────────────────────────────────────────────────────────────────────
const start = async () => {
  // DB ulanishini tekshirish
  try {
    await db.query("SELECT 1");
    console.log("✅ Database ulandi");
  } catch (err) {
    console.error("❌ Database ulanmadi:", err.message);
    console.error("   .env faylida DB_* sozlamalarini tekshiring");
    process.exit(1);
  }

  app.listen(PORT, () => {
    console.log(`🚀 Backend API: http://localhost:${PORT}`);
    console.log(`📊 Statistika: http://localhost:${PORT}/api/v1/stats`);
    console.log(`💓 Health: http://localhost:${PORT}/api/v1/health`);
  });
};

start();
