/**
 * 行情工人。全站 00 后端不在这里启动，启动脚本在仓库根目录 ecosystem.config.cjs。
 *
 * 国内机访问不了币安时不要启动本文件。
 * 海外机确认能访问交易所后：
 *   cd 08-life-resume
 *   pm2 start ecosystem.config.cjs
 */
const path = require('path');

module.exports = {
  apps: [
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
