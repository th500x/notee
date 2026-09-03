/**
 * PM2：真三风云后端（与 01-news-calendar / 06-rental-tracking 同布局）
 *
 * 使用方式（生产示例路径）：
 *   cd /www/wwwroot/notee/33-san-storm
 *   pm2 start ecosystem.config.cjs
 * `cwd` 为 `backend/`（与主站 notee 一致，fork 单进程，日志在 `backend/logs/`）。
 */
module.exports = {
  apps: [
    {
      name: 'san-storm-backend',
      script: './server.js',
      cwd: '/www/wwwroot/notee/33-san-storm/backend',
      instances: 1,
      exec_mode: 'fork',
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
