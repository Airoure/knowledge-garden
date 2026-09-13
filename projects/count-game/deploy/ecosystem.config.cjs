/**
 * PM2 进程管理配置
 *
 * 用法：pm2 start deploy/ecosystem.config.cjs
 * 查看：pm2 list
 * 日志：pm2 logs sushu-daochang-server
 * 重启：pm2 restart sushu-daochang-server
 * 停止：pm2 stop sushu-daochang-server
 */

module.exports = {
  apps: [
    {
      name: 'sushu-daochang-server',
      script: './server/dist/index.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '256M',
      env: {
        NODE_ENV: 'production',
        PORT: 3001,
      },
      error_file: './logs/error.log',
      out_file: './logs/output.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
    },
  ],
}
