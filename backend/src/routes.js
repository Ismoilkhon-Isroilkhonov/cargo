// backend/src/routes.js

const { Router } = require("express");
const cargo = require("./controllers/cargoController");
const user = require("./controllers/userController");

const router = Router();

// ─── Cargo endpoints ──────────────────────────────────────────────────────────
router.post("/cargo", cargo.receiveCargo);
router.get("/cargo/:regionKey", cargo.getCargoByRegion);
router.get("/cargo/unsent/:userId/:regionKey", cargo.getUnsentMessages);
router.post("/cargo/mark-sent", cargo.markSent);

// ─── User endpoints ───────────────────────────────────────────────────────────
router.post("/users", user.upsertUser);
router.get("/users/by-region/:regionKey", user.getUsersByRegion);
router.get("/users/:userId", user.getUser);
router.patch("/users/:userId/region", user.selectRegion);

// ─── Stats ────────────────────────────────────────────────────────────────────
router.get("/stats", cargo.getStats);

// ─── Health check ─────────────────────────────────────────────────────────────
router.get("/health", (req, res) => {
  res.json({ status: "ok", time: new Date() });
});

module.exports = router;
