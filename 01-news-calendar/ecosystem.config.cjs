module.exports = {
  apps: [
    {
      name: 'news-calendar-backend',
      script: './backend/server.js',
      cwd: '/www/wwwroot/notee/01-news-calendar',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
        PORT: 3002
      },
      error_file: './logs/backend-error.log',
      out_file: './logs/backend-out.log',
      log_file: './logs/backend-combined.log',
      time: true
    }
  ]
}