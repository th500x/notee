const path = require('path');

module.exports = {
  apps: [
    {
      name: 'life-resume-backend',
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
      name: 'eth-ma-cross-worker',
      script: './backend/workers/ethMaCrossWorker.js',
      cwd: path.join(__dirname),
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '256M',
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
