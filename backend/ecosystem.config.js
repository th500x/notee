/**
 * PM2：共享后端（cwd = 本目录 `backend/`，`script` = `./server.js`）
 *
 * 与仓库根 `ecosystem.config.cjs` 配置的是同一应用（notee-backend），请勿同时启动两份。
 * - 习惯在 `backend` 目录内启动时用本文件（`cd backend && pm2 start ecosystem.config.js`），`.env` 放本目录即可。
 * - 习惯在仓库根启动时用上级 `../ecosystem.config.cjs`（cwd 为仓库根）。
 *
 * 注意：不要在此文件中硬编码敏感信息；使用环境变量或 .env。
 */

require('dotenv').config();

module.exports = {
  apps: [{
    name: 'notee-backend',
    script: './server.js',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '500M',
    env: {
      NODE_ENV: 'production',
      PORT: process.env.PORT || 3001,
      // 从.env文件读取敏感信息
      GLOBAL_PASSWORD_HASH: process.env.GLOBAL_PASSWORD_HASH,
      JWT_SECRET: process.env.JWT_SECRET
    },
    error_file: './logs/notee-backend-error.log',
    out_file: './logs/notee-backend-out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss'
  }]
};
