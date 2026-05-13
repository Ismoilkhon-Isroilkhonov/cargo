// reader-bot/logger.js

const LEVELS = { debug: 0, info: 1, error: 2 };
const current = LEVELS[process.env.LOG_LEVEL || "info"] ?? 1;

const ts = () => new Date().toISOString().replace("T", " ").slice(0, 19);

const logger = {
  debug: (...args) => current <= 0 && console.log(`[${ts()}] [DEBUG]`, ...args),
  info:  (...args) => current <= 1 && console.log(`[${ts()}] [INFO ]`, ...args),
  error: (...args) => current <= 2 && console.error(`[${ts()}] [ERROR]`, ...args),
};

module.exports = logger;
