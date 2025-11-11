// PM2 Configuration for SMARTWORLD DEVELOPERS
module.exports = {
  apps: [
    {
      name: 'smartworld-backend',
      script: './backend/server.py',
      interpreter: 'python',
      cwd: 'C:\\CompanyApps\\SmartWorldEmployee',
      instances: 1,
      exec_mode: 'fork',
      watch: false,
      env: {
        PORT: 8001,
        NODE_ENV: 'production',
        MONGO_URL: 'mongodb://localhost:27017/smartworld_employees'
      },
      log_file: 'C:\\CompanyApps\\SmartWorldEmployee\\logs\\backend.log',
      error_file: 'C:\\CompanyApps\\SmartWorldEmployee\\logs\\backend-error.log',
      out_file: 'C:\\CompanyApps\\SmartWorldEmployee\\logs\\backend-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      restart_delay: 4000,
      max_restarts: 5
    },
    {
      name: 'smartworld-frontend',
      script: './production-server.js',
      cwd: 'C:\\CompanyApps\\SmartWorldEmployee',
      instances: 2,
      exec_mode: 'cluster',
      watch: false,
      env: {
        PORT: 80,
        NODE_ENV: 'production'
      },
      log_file: 'C:\\CompanyApps\\SmartWorldEmployee\\logs\\frontend.log',
      error_file: 'C:\\CompanyApps\\SmartWorldEmployee\\logs\\frontend-error.log',
      out_file: 'C:\\CompanyApps\\SmartWorldEmployee\\logs\\frontend-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      restart_delay: 4000,
      max_restarts: 5
    }
  ]
};