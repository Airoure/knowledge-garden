import type { Express, Request, Response } from 'express'
import { authMiddleware, type AuthedRequest } from './auth.js'
import { RecordStore, type GameMode, type Operation, type Difficulty } from './RecordStore.js'

/** 保存记录的请求体 */
interface SaveRecordBody {
  mode: GameMode
  operations: Operation[]
  difficulty: Difficulty
  totalCount: number
  correctCount: number
  accuracy: number
  timeElapsed: number
  rank?: number
  playerCount?: number
}

/** 注册做题记录相关路由 */
export function registerRecordRoutes(app: Express): void {
  /** 保存一条做题记录（需登录） */
  app.post('/api/records', authMiddleware, (req: AuthedRequest, res: Response) => {
    const body = req.body as Partial<SaveRecordBody>
    if (!body.mode || !body.operations || !body.difficulty) {
      res.status(400).json({ error: '参数不合法' })
      return
    }
    if (typeof body.totalCount !== 'number' || typeof body.correctCount !== 'number') {
      res.status(400).json({ error: '参数不合法' })
      return
    }

    const record = RecordStore.add({
      userId: req.user!.id,
      mode: body.mode,
      operations: body.operations,
      difficulty: body.difficulty,
      totalCount: body.totalCount,
      correctCount: body.correctCount,
      accuracy: body.accuracy ?? 0,
      timeElapsed: body.timeElapsed ?? 0,
      rank: body.rank,
      playerCount: body.playerCount,
    })

    res.json({ record })
  })

  /** 查询当前用户的历史记录（需登录） */
  app.get('/api/records', authMiddleware, (req: AuthedRequest, res: Response) => {
    const limitStr = req.query.limit as string | undefined
    const limit = limitStr ? Math.min(parseInt(limitStr, 10) || 50, 200) : 50
    const records = RecordStore.getByUser(req.user!.id, limit)
    res.json({ records })
  })

  /** 查询当前用户的统计数据（需登录） */
  app.get('/api/records/stats', authMiddleware, (req: AuthedRequest, res: Response) => {
    const stats = RecordStore.getStats(req.user!.id)
    res.json({ stats })
  })
}
