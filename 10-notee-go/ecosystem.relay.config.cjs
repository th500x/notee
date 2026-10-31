/**
 * PM2：扫码对决中继（坦克乱斗、宠物冲刺等实时对决），端口 3011，只听 127.0.0.1
 * 与今日一句 3010 分开重启，互不拖累。共用 backend/.env 的 JWT_SECRET。
 *
 *   cd /www/wwwroot/notee/10-notee-go
 * 文件名里必须有 .config.cjs。否则 PM2 把它当普通脚本，3011 不会监听。
 *   pm2 start ecosystem.relay.config.cjs
 *   pm2 save
 *
 * 日常发版：pm2 restart 10-notee-go-relay
 * 房间只在内存里：重启会断开所有桌，手机 20 秒内重连回来才能接着打。只按名字重启，不要 pm2 restart all。
 * instances 必须是 1：同一桌的两台手机必须连到同一个进程。
 */
const path = require('path');

module.exports = {
  apps: [
    {
      name: '10-notee-go-relay',
      script: './relay/server.js',
      cwd: path.join(__dirname, 'backend'),
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '128M',
      env: {
        NODE_ENV: 'production',
        RELAY_PORT: 3011,
      },
      error_file: './logs/relay-error.log',
      out_file: './logs/relay-out.log',
      log_file: './logs/relay-combined.log',
      time: true,
    },
  ],
};
