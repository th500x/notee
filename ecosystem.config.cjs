/**
 * 全站进程（除 06 租赁外）：00 API + ETH 工人 + 今日一句。
 *
 *   cd /www/wwwroot/notee
 *   pm2 start ecosystem.config.cjs
 *   pm2 save
 *
 * 06 租赁仍用：06-rental-tracking/ecosystem.config.cjs
 * 不要再启动 08 / 10 / 根 backend/ 下的旧 ecosystem。
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
    {
      name: '00-eth-worker',
      script: path.join(__dirname, 'workers/00-eth-worker.cjs'),
      cwd: path.join(__dirname, '08-life-resume', 'backend'),
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '256M',
      exp_backoff_restart_delay: 2000,
      env: {
        NODE_ENV: 'production',
        NODE_PATH: path.join(__dirname, '08-life-resume', 'backend', 'node_modules'),
      },
      error_file: path.join(__dirname, '08-life-resume', 'logs', '00-eth-worker-error.log'),
      out_file: path.join(__dirname, '08-life-resume', 'logs', '00-eth-worker-out.log'),
      log_file: path.join(__dirname, '08-life-resume', 'logs', '00-eth-worker-combined.log'),
      time: true,
    },
    {
      name: '10-notee-go-backend',
      script: './server.js',
      cwd: path.join(__dirname, '10-notee-go', 'backend'),
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
