/**
 * PM2 Ecosystem Configuration for Horizontal Scaling
 * 
 * This configuration enables:
 * 1. Cluster mode for multiple worker processes
 * 2. Automatic load balancing across workers
 * 3. Zero-downtime deployments
 * 4. Process monitoring and restart policies
 * 5. Environment-specific scaling configurations
 */

module.exports = {
  apps: [
    {
      // Application Configuration
      name: 'aigrader-api',
      script: './server/index.ts',
      interpreter: 'tsx',
      
      // Horizontal Scaling Configuration
      instances: process.env.PM2_INSTANCES || 'max', // Use all CPU cores by default
      exec_mode: 'cluster', // Enable cluster mode for load balancing
      
      // Environment Configuration
      env: {
        NODE_ENV: 'development',
        PORT: 5000,
        // Ensure consistent environment across all instances
        PM2_CLUSTER_MODE: 'true'
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: process.env.PORT || 5000,
        PM2_CLUSTER_MODE: 'true'
      },
      
      // Performance and Scaling Settings
      max_memory_restart: '500M', // Restart if memory usage exceeds 500MB
      min_uptime: '10s', // Minimum uptime before considering stable
      max_restarts: 10, // Maximum restart attempts
      restart_delay: 4000, // Delay between restarts (4 seconds)
      
      // Health Monitoring
      health_check_grace_period: 3000, // Grace period for health checks
      health_check_fatal_exceptions: true,
      
      // Load Balancing Configuration
      instance_var: 'INSTANCE_ID', // Variable to identify instance
      increment_var: 'PORT_INCREMENT', // For port increments if needed
      
      // Logging Configuration
      log_file: './logs/combined.log',
      out_file: './logs/out.log',
      error_file: './logs/error.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true, // Merge logs from all instances
      
      // Advanced Cluster Features
      listen_timeout: 8000, // Time to wait for worker to listen
      kill_timeout: 5000, // Time to wait before killing process
      wait_ready: true, // Wait for ready signal from app
      
      // Auto-scaling based on CPU usage
      autorestart: true,
      watch: false, // Disable file watching in production
      ignore_watch: ['node_modules', 'logs', 'test'],
      
      // Environment-specific instance scaling
      instances_production: process.env.NODE_ENV === 'production' ? 'max' : 2,
      instances_development: 1,
      
      // Performance Monitoring
      pmx: true, // Enable PMX monitoring
      monitor: {
        http: true, // Monitor HTTP requests
        https: false,
        port: false
      }
    },
    
    // Optional: Separate queue worker process for heavy background tasks
    {
      name: 'aigrader-queue-worker',
      script: './server/queue/queue-worker.js',
      interpreter: 'node',
      instances: Math.max(1, Math.floor(require('os').cpus().length / 2)), // Half the CPU cores
      exec_mode: 'cluster',
      
      env: {
        NODE_ENV: 'development',
        WORKER_TYPE: 'queue',
        REDIS_URL: process.env.REDIS_URL
      },
      env_production: {
        NODE_ENV: 'production',
        WORKER_TYPE: 'queue',
        REDIS_URL: process.env.REDIS_URL
      },
      
      max_memory_restart: '300M',
      min_uptime: '5s',
      max_restarts: 15,
      restart_delay: 2000,
      
      // Queue workers can be more aggressive with restarts
      autorestart: true,
      watch: false,
      
      log_file: './logs/queue-worker.log',
      out_file: './logs/queue-worker-out.log',
      error_file: './logs/queue-worker-error.log',
      merge_logs: true
    }
  ],

  // Deployment Configuration for Production
  deploy: {
    production: {
      user: 'deploy',
      host: ['production-server-1', 'production-server-2'],
      ref: 'origin/main',
      repo: 'https://github.com/your-org/aigrader.git',
      path: '/var/www/aigrader',
      'post-deploy': 'npm install && npm run build && pm2 reload ecosystem.config.js --env production',
      'pre-setup': 'apt update && apt install nodejs npm',
      ssh_options: 'StrictHostKeyChecking=no'
    },
    
    staging: {
      user: 'deploy',
      host: 'staging-server',
      ref: 'origin/develop',
      repo: 'https://github.com/your-org/aigrader.git',
      path: '/var/www/aigrader-staging',
      'post-deploy': 'npm install && npm run build && pm2 reload ecosystem.config.js --env staging',
      'pre-setup': 'apt update && apt install nodejs npm'
    }
  }
};