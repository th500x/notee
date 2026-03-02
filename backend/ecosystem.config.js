/**
 * PM2 Ecosystem 配置文件
 * 
 * 注意：不要在此文件中硬编码敏感信息！
 * 使用环境变量或.env文件
 */

require('dotenv').config();

module.exports = {
  apps: [{
    name: 'notee-backend',
    script: './server.js',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '500M',
    env: {
      NODE_ENV: 'production',
      PORT: process.env.PORT || 3001,
      // 从.env文件读取敏感信息
      GLOBAL_PASSWORD_HASH: process.env.GLOBAL_PASSWORD_HASH,
      JWT_SECRET: process.env.JWT_SECRET
    },
    error_file: './logs/notee-backend-error.log',
    out_file: './logs/notee-backend-out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss'
  }]
};
