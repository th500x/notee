module.exports = {
  apps: [
    {
      name: 'notee-news-calendar',
      script: './news-calendar/backend/server.js',
      cwd: '/www/wwwroot/notee',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        PORT: 3001
      },
      error_file: './logs/news-calendar-error.log',
      out_file: './logs/news-calendar-out.log',
      log_file: './logs/news-calendar.log',
      time: true,
      autorestart: true,
      max_restarts: 10,
      min_uptime: '10s'
    },
    {
      name: 'notee-guestbook',
      script: './backend/server.js',
      cwd: '/www/wwwroot/notee',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        PORT: 3002
      },
      error_file: './logs/guestbook-error.log',
      out_file: './logs/guestbook-out.log',
      log_file: './logs/guestbook.log',
      time: true,
      autorestart: true,
      max_restarts: 10,
      min_uptime: '10s'
    }
  ]
}