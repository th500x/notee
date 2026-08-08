const path = require('path');

module.exports = {
  apps: [
    {
      name: 'one-line-backend',
      script: './backend/server.js',
      cwd: path.join(__dirname),
      instances: 1,
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
