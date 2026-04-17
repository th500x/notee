/**
 * 全站共享后端（留言板、认证等）
 *
 * - 与 `backend/ecosystem.config.js` 为同一进程（notee-backend），任选其一即可，勿重复启动。
 * - 本文件 cwd 为仓库根，`script` 为 `./backend/server.js`（与 01/06/05 子项目「根目录 ecosystem」风格一致）。
 * - 若 `.env` 仅放在 `backend/`，请用 `backend/ecosystem.config.js` 在 backend 目录启动，或把环境变量交给 systemd/pm2 注入。
 */
module.exports = {
  apps: [
    {
      name: 'notee-backend',
      script: './backend/server.js',
      cwd: '/www/wwwroot/notee',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        PORT: 3001
      },
      error_file: './logs/notee-backend-error.log',
      out_file: './logs/notee-backend-out.log',
      log_file: './logs/notee-backend.log',
      time: true,
      autorestart: true,
      max_restarts: 10,
      min_uptime: '10s'
    }
  ]
}