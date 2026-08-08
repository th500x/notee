/**
 * PM2：今日一句后端（与 05-san-storm / 主站 notee 同布局）
 *
 * 使用方式（生产）：
 *   cd /www/wwwroot/notee/22-one-line/backend && npm install
 *   cd /www/wwwroot/notee/22-one-line
 *   pm2 start ecosystem.config.cjs
 *   # 之后发版：
 *   pm2 restart one-line-backend
 *
 * `cwd` 为 `backend/`，这样 dotenv 默认读到 `backend/.env`；日志在 `backend/logs/`。
 */
module.exports = {
  apps: [
    {
      name: 'one-line-backend',
      script: './server.js',
      cwd: '/www/wwwroot/notee/22-one-line/backend',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '256M',
      env: {
        NODE_ENV: 'production',
        PORT: 3022,
      },
      error_file: './logs/backend-error.log',
      out_file: './logs/backend-out.log',
      log_file: './logs/backend-combined.log',
      time: true,
    },
  ],
};
