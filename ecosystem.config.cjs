/**
 * 全站共享后端（留言板、认证等）— PM2 配置
 *
 * 与 `01-news-calendar` / `33-san-storm` / `06-rental-tracking` 同套路：
 * `cwd` = 本进程实际工作目录（此处为 **`backend/`**），`script` = 该目录下的 `server.js`，
 * 这样 `server.js` 里 `dotenv` 默认能读到 **`backend/.env`**。
 *
 * 使用：`cd /www/wwwroot/notee && pm2 start ecosystem.config.cjs`
 * 勿与 `backend/ecosystem.config.js` 重复启动同一应用。
 */
module.exports = {
  apps: [
    {
      name: '00-notee-backend',
      script: './server.js',
      cwd: '/www/wwwroot/notee/backend',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
        PORT: 3001,
      },
      error_file: './logs/notee-backend-error.log',
      out_file: './logs/notee-backend-out.log',
      log_file: './logs/notee-backend.log',
      time: true,
    },
  ],
};
