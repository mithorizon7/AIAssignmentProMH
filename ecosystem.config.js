module.exports = {
  apps: [
    {
      name: 'aigrader',
      script: 'server/index.ts',
      interpreter: 'node',
      interpreter_args: '--loader tsx',
      instances: 'max',
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'development',
        PORT: 5000
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 5000
      },
      // Performance monitoring
      monitoring: false,
      pmx: true,
      
      // Restart policy
      max_restarts: 10,
      min_uptime: '10s',
      max_memory_restart: '1G',
      
      // Logging
      log_file: 'logs/combined.log',
      out_file: 'logs/out.log',
      error_file: 'logs/error.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      
      // Advanced features
      watch: false,
      ignore_watch: ['node_modules', 'logs'],
      
      // Health checks
      health_check_grace_period: 3000,
      
      // Environment-specific settings
      node_args: '--max-old-space-size=2048',
      
      // Graceful shutdown
      kill_timeout: 5000,
      listen_timeout: 3000,
      
      // Cluster mode settings
      instance_var: 'INSTANCE_ID',
      
      // Auto-restart on file changes (disabled for production)
      autorestart: true,
      
      // Exponential backoff restart delay
      exp_backoff_restart_delay: 100,
      
      // Cron-based restart (optional)
      cron_restart: '0 2 * * *', // Restart every day at 2 AM
      
      // Merge logs from all instances
      merge_logs: true,
      
      // Log rotation
      log_type: 'json',
      
      // Error handling
      catch_exceptions: true,
      
      // Source map support
      source_map_support: true,
      
      // Custom environment variables for production
      env_production: {
        NODE_ENV: 'production',
        PORT: 5000,
        TRUST_PROXY: 'true',
        STRUCTURED_LOGGING: 'true'
      }
    }
  ],
  
  deploy: {
    production: {
      user: 'deploy',
      host: 'your-server.com',
      ref: 'origin/main',
      repo: 'git@github.com:your-repo/aigrader.git',
      path: '/var/www/aigrader',
      'post-deploy': 'npm install && npm run build && pm2 reload ecosystem.config.js --env production',
      env: {
        NODE_ENV: 'production'
      }
    }
  }
};