/**
 * PM2：真三风云后端（与 01-news-calendar / 06-rental-tracking 同布局）
 *
 * 使用方式（生产示例路径）：
 *   cd /www/wwwroot/notee/05-san-storm
 *   pm2 start ecosystem.config.cjs
 */
module.exports = {
  apps: [
    {
      name: 'san-storm-backend',
      script: './backend/server.js',
      cwd: '/www/wwwroot/notee/05-san-storm',
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
