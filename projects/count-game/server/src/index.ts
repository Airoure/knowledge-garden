import express from 'express'
import { createServer } from 'http'
import { Server } from 'socket.io'
import { registerSocketHandlers } from './socketHandlers.js'
import { registerAuthRoutes } from './auth.js'
import { registerRecordRoutes } from './recordRoutes.js'
import { registerWorksheetRoutes } from './worksheetRoutes.js'

const PORT = 3001

const app = express()
const httpServer = createServer(app)

// 允许的前端来源（与 Socket.io CORS 保持一致）
const ALLOWED_ORIGINS = ['http://localhost:5173', 'http://localhost:5174', 'http://localhost:5175']

// CORS 中间件（Express HTTP API 跨域）
app.use((req, res, next) => {
  const origin = req.headers.origin
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin)
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  }
  // 预检请求直接返回
  if (req.method === 'OPTIONS') {
    res.sendStatus(204)
    return
  }
  next()
})

// 解析 JSON 请求体
app.use(express.json({ limit: '50mb' }))

// 认证路由（注册 / 登录 / 获取当前用户）
registerAuthRoutes(app)

// 做题记录路由（保存 / 查询 / 统计）
registerRecordRoutes(app)

// 高照数算路由（题库解析 / 管理 / 打卡）
registerWorksheetRoutes(app)

// 健康检查接口
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'sushu-daochang-server' })
})

const io = new Server(httpServer, {
  cors: {
    origin: ['http://localhost:5173', 'http://localhost:5174', 'http://localhost:5175'],
    methods: ['GET', 'POST'],
  },
})

registerSocketHandlers(io)

httpServer.listen(PORT, () => {
  console.log(`╔══════════════════════════════════════╗`)
  console.log(`║  数感道场 · 对战服务器`)
  console.log(`║  端口: ${PORT}`)
  console.log(`║  WebSocket: ws://localhost:${PORT}`)
  console.log(`╚══════════════════════════════════════╝`)
})
