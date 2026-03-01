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
        PORT: 3002
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