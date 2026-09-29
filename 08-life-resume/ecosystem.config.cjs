/**
 * 全站 00 后端 + 行情工人。
 *
 * 00-notee-backend：管理员口令与人生片段，端口 3001。
 * 08-eth-ma-cross-worker：独立进程。国内机访问不了币安时不要启动这一项。
 *
 * 启动 API：pm2 start ecosystem.config.cjs --only 00-notee-backend
 * 连同工人：pm2 start ecosystem.config.cjs
 *
 * 不要再启动仓库根 backend/ 里的旧进程，也不要和根目录 ecosystem 各起一份 00。
 */
const path = require('path');

module.exports = {
  apps: [
    {
      name: '00-notee-backend',
      script: './backend/server.js',
      cwd: path.join(__dirname),
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      exp_backoff_restart_delay: 2000,
      max_memory_restart: '512M',
      env: {
        NODE_ENV: 'production',
        PORT: 3001,
      },
      error_file: './logs/backend-error.log',
      out_file: './logs/backend-out.log',
      log_file: './logs/backend-combined.log',
      time: true,
    },
    {
      name: '08-eth-ma-cross-worker',
      script: './backend/workers/ethMaCrossWorker.js',
      cwd: path.join(__dirname),
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '256M',
      exp_backoff_restart_delay: 2000,
      env: {
        NODE_ENV: 'production',
      },
      error_file: './logs/eth-ma-cross-error.log',
      out_file: './logs/eth-ma-cross-out.log',
      log_file: './logs/eth-ma-cross-combined.log',
      time: true,
    },
  ],
};
