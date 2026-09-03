const path = require('path');

module.exports = {
  apps: [
    {
      name: '11-life-resume-backend',
      script: './backend/server.js',
      cwd: path.join(__dirname),
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
      env: {
        NODE_ENV: 'production',
        PORT: 3011,
      },
      error_file: './logs/backend-error.log',
      out_file: './logs/backend-out.log',
      log_file: './logs/backend-combined.log',
      time: true,
    },
    {
      name: '11-eth-ma-cross-worker',
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
