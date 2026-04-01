/**
 * PM2 进程配置（与 01-news-calendar / 06-rental-tracking 同风格）
 *
 * 使用方式：
 *   cd /www/wwwroot/notee/05-san-storm/backend
 *   pm2 start ecosystem.config.cjs
 */
module.exports = {
  apps: [
    {
      name: 'san-storm-backend',
      script: './server.js',
      cwd: '/www/wwwroot/notee/05-san-storm/backend',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
        PORT: 3005,
      },
      error_file: './logs/backend-error.log',
      out_file: './logs/backend-out.log',
      log_file: './logs/backend-combined.log',
      time: true,
    },
  ],
};
