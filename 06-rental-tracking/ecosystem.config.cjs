module.exports = {
  apps: [
    {
      name: '06-rental-tracking-backend',
      script: './backend/server.js',
      cwd: '/www/wwwroot/notee/06-rental-tracking',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
        PORT: 3003
      },
      error_file: './logs/backend-error.log',
      out_file: './logs/backend-out.log',
      log_file: './logs/backend-combined.log',
      time: true
    }
  ]
}
