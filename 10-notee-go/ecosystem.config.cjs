/**
 * PM2：今日一句后端（App 侧独立进程，不并入仓库根 ecosystem）
 *
 *   cd /www/wwwroot/notee/10-notee-go
 *   pm2 start ecosystem.config.cjs
 *   pm2 save
 *
 * 日常发版：pm2 restart 10-notee-go-backend
 */
const path = require('path');

module.exports = {
  apps: [
    {
      name: '10-notee-go-backend',
      script: './server.js',
      cwd: path.join(__dirname, 'backend'),
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '256M',
      env: {
        NODE_ENV: 'production',
        PORT: 3010,
      },
      error_file: './logs/backend-error.log',
      out_file: './logs/backend-out.log',
      log_file: './logs/backend-combined.log',
      time: true,
    },
  ],
};
