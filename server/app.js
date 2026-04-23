import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import api from './routes/api.js'
import { initDb } from './models/db.js'

const app = express()

// 1. 修正端口定义：确保即便环境变量为空，也能回到 3000
const PORT = process.env.PORT || 3000

// 2. 跨域配置：保留 AI 写的灵活性
app.use(
  cors({
    origin: process.env.CORS_ORIGIN || '*',
  })
)

app.use(express.json({ limit: '1mb' }))

// 简单的请求日志
app.use((req, res, next) => {
  const t = new Date().toISOString()
  console.log(`[${t}] ${req.method} ${req.url}`)
  next()
})

// 3. 健康检查：微信云托管非常看重这个接口，用来判断你的服务是否活着
app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'healu-server', timestamp: new Date() })
})

app.use('/api', api)

// 错误处理
app.use((err, _req, res, _next) => {
  console.error('[error]', err)
  res.status(500).json({ error: String(err.message || err) })
})

// 4. 数据库初始化后启动服务
await initDb()

// 5. 修正后的监听：必须监听 0.0.0.0，否则云端可能无法从外部访问
app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ HealU server 启动成功！`);
  console.log(`🔗 本地地址: http://localhost:${PORT}`);
  console.log(`🌍 云端环境端口: ${process.env.PORT || '未检测到，使用默认3000'}`);
});