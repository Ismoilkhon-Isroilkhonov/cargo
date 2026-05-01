// ecosystem.config.js
// PM2 bilan barcha 3 ta serverni boshqarish uchun

module.exports = {
  apps: [
    {
      name: "cargo-backend",
      cwd: "./backend",
      script: "src/index.js",
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: "300M",
      env: {
        NODE_ENV: "production",
      },
      error_file: "./logs/backend-err.log",
      out_file: "./logs/backend-out.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss",
    },
    {
      name: "cargo-reader-bot",
      cwd: "./reader-bot",
      script: "index.js",
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: "200M",
      env: {
        NODE_ENV: "production",
      },
      error_file: "./logs/reader-err.log",
      out_file: "./logs/reader-out.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss",
    },
    {
      name: "cargo-sender-bot",
      cwd: "./sender-bot",
      script: "index.js",
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: "200M",
      env: {
        NODE_ENV: "production",
      },
      error_file: "./logs/sender-err.log",
      out_file: "./logs/sender-out.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss",
    },
  ],
};
