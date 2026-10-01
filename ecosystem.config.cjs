/**
 * 全站 00 后端的启动脚本在仓库根目录。
 * 只启动管理员口令 + 人生片段（端口 3000），不启动行情工人。
 *
 *   cd /www/wwwroot/notee
 *   pm2 start ecosystem.config.cjs
 *
 * 行情工人仍在 08-life-resume/ecosystem.config.cjs，国内机不要启动。
 * 不要再启动 backend/ 里的旧留言板进程。
 */
const path = require('path');

module.exports = {
  apps: [
    {
      name: '00-notee-backend',
      script: './backend/server.js',
      cwd: path.join(__dirname, '08-life-resume'),
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      exp_backoff_restart_delay: 2000,
      max_memory_restart: '512M',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
      },
      error_file: './logs/backend-error.log',
      out_file: './logs/backend-out.log',
      log_file: './logs/backend-combined.log',
      time: true,
    },
  ],
};
