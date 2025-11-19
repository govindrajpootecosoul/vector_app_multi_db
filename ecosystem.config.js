/**
 * PM2 Ecosystem Configuration
 * 
 * This file configures PM2 for process management on VPS servers.
 * 
 * Usage:
 *   pm2 start ecosystem.config.js
 *   pm2 stop ecosystem.config.js
 *   pm2 restart ecosystem.config.js
 *   pm2 logs
 *   pm2 monit
 */

module.exports = {
  apps: [
    {
      name: 'thrive-app-backend',
      script: 'dist/server.js',
      instances: 1, // Use 'max' for cluster mode, or number for specific instances
      exec_mode: 'fork', // 'fork' for single instance, 'cluster' for multiple
      watch: false, // Set to true for development, false for production
      max_memory_restart: '500M', // Restart if memory exceeds 500MB
      env: {
        NODE_ENV: 'production',
        PORT: 3111
      },
      error_file: './logs/pm2-error.log',
      out_file: './logs/pm2-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      autorestart: true,
      max_restarts: 10,
      min_uptime: '10s',
      // Graceful shutdown
      kill_timeout: 5000,
      wait_ready: true,
      listen_timeout: 10000
    }
  ]
};

