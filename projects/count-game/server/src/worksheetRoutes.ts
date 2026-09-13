import type { Express, Response } from 'express'
import { execFile } from 'child_process'
import { writeFileSync, unlinkSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { tmpdir } from 'os'
import { randomBytes } from 'crypto'
import { authMiddleware, type AuthedRequest } from './auth.js'
import {
  WorksheetStore,
  type WorksheetGroup,
  type WorksheetRow,
} from './WorksheetStore.js'

const __dirname = dirname(fileURLToPath(import.meta.url))

/**
 * Python 脚本路径
 * 开发模式 (tsx): server/src -> 项目根目录为 ../..
 * 生产模式 (tsc): server/dist/src -> 项目根目录为 ../../..
 */
const PYTHON_SCRIPT_CANDIDATES = [
  join(__dirname, '..', '..', 'tools', 'parse_worksheet.py'),
  join(__dirname, '..', '..', '..', 'tools', 'parse_worksheet.py'),
]
const PYTHON_SCRIPT =
  PYTHON_SCRIPT_CANDIDATES.find((p) => existsSync(p)) ?? PYTHON_SCRIPT_CANDIDATES[0]

/** Python 解析超时时间 */
const PARSE_TIMEOUT_MS = 30_000

/** 解析图片请求体 */
interface ParseBody {
  image?: string
}

/** 保存题库请求体 */
interface SaveWorksheetBody {
  date?: string
  title?: string
  source?: string
  questions?: string[]
  rows?: WorksheetRow[]
  groups?: WorksheetGroup[]
}

/** 打卡请求体 */
interface CheckInBody {
  date?: string
  worksheetId?: string
  worksheetTitle?: string
  correctCount?: number
  totalCount?: number
  accuracy?: number
  timeElapsed?: number
}

/** 解析结果 */
interface ParseResult {
  questions?: string[]
  rows?: WorksheetRow[]
  groups?: WorksheetGroup[]
  source?: string
  title?: string
}

/**
 * 注册高照数算相关路由
 *
 * 路由列表：
 *   POST   /api/worksheets/parse     解析工作表图片
 *   POST   /api/worksheets           保存题库
 *   GET    /api/worksheets           获取所有题库
 *   POST   /api/worksheets/checkin   打卡
 *   GET    /api/worksheets/checkins  获取打卡记录和统计
 *   GET    /api/worksheets/:date     按日期获取题库
 *   DELETE /api/worksheets/:id       删除题库
 *
 * 注意：/checkins 和 /checkin 必须注册在 /:date 之前，否则会被参数路由匹配。
 */
export function registerWorksheetRoutes(app: Express): void {
  /** 解析工作表图片（需登录） */
  app.post(
    '/api/worksheets/parse',
    authMiddleware,
    (req: AuthedRequest, res: Response) => {
      const { image } = req.body as ParseBody
      if (!image) {
        res.status(400).json({ error: '缺少图片数据' })
        return
      }

      // 将 base64 图片保存为临时文件
      const tempPath = join(tmpdir(), `worksheet_${randomBytes(8).toString('hex')}.png`)
      try {
        const buffer = Buffer.from(image, 'base64')
        writeFileSync(tempPath, buffer)
      } catch (e) {
        console.error('[worksheetRoutes] 临时文件写入失败:', e)
        res.status(500).json({ error: '图片保存失败' })
        return
      }

      // 调用 Python 脚本解析
      execFile(
        'python',
        [PYTHON_SCRIPT, tempPath],
        {
          timeout: PARSE_TIMEOUT_MS,
          maxBuffer: 10 * 1024 * 1024,
          windowsHide: true,
        },
        (err, stdout, stderr) => {
          // 清理临时文件
          try {
            unlinkSync(tempPath)
          } catch {
            /* 忽略清理错误 */
          }

          if (err) {
            const isTimeout = err.killed === true
            console.error('[worksheetRoutes] Python 解析失败:', err.message)
            if (stderr) console.error('[worksheetRoutes] Python stderr:', stderr)
            res.status(500).json({
              error: isTimeout ? '解析超时，请重试' : '图片解析失败',
              detail: stderr || err.message,
            })
            return
          }

          try {
            const result = JSON.parse(stdout) as ParseResult
            res.json({
              questions: result.questions ?? [],
              rows: result.rows ?? [],
              groups: result.groups ?? [],
            })
          } catch (e) {
            console.error('[worksheetRoutes] 解析结果 JSON 解析失败:', e)
            res.status(500).json({ error: '解析结果格式错误' })
          }
        },
      )
    },
  )

  /** 保存题库（需登录） */
  app.post(
    '/api/worksheets',
    authMiddleware,
    (req: AuthedRequest, res: Response) => {
      const body = req.body as SaveWorksheetBody
      if (
        !body.date ||
        !body.title ||
        !body.questions ||
        !body.rows ||
        !body.groups
      ) {
        res.status(400).json({ error: '参数不合法' })
        return
      }

      const worksheet = WorksheetStore.add({
        date: body.date,
        title: body.title,
        source: body.source ?? '',
        groups: body.groups,
        questions: body.questions,
        rows: body.rows,
      })

      res.json({ worksheet })
    },
  )

  /** 获取所有题库（需登录） */
  app.get('/api/worksheets', authMiddleware, (req: AuthedRequest, res: Response) => {
    const worksheets = WorksheetStore.getAll()
    res.json({ worksheets })
  })

  /** 打卡（需登录） */
  app.post(
    '/api/worksheets/checkin',
    authMiddleware,
    (req: AuthedRequest, res: Response) => {
      const body = req.body as CheckInBody
      if (!body.date || !body.worksheetId || !body.worksheetTitle) {
        res.status(400).json({ error: '参数不合法' })
        return
      }
      if (
        typeof body.correctCount !== 'number' ||
        typeof body.totalCount !== 'number'
      ) {
        res.status(400).json({ error: '参数不合法' })
        return
      }

      const checkin = WorksheetStore.addCheckIn({
        userId: req.user!.id,
        date: body.date,
        worksheetId: body.worksheetId,
        worksheetTitle: body.worksheetTitle,
        correctCount: body.correctCount,
        totalCount: body.totalCount,
        accuracy: body.accuracy ?? 0,
        timeElapsed: body.timeElapsed ?? 0,
      })

      res.json({ checkin })
    },
  )

  /** 获取打卡记录和统计（需登录） */
  app.get(
    '/api/worksheets/checkins',
    authMiddleware,
    (req: AuthedRequest, res: Response) => {
      const checkins = WorksheetStore.getCheckIns(req.user!.id)
      const stats = WorksheetStore.getCheckInStats(req.user!.id)
      res.json({ checkins, stats })
    },
  )

  /** 按日期获取题库（需登录） */
  app.get(
    '/api/worksheets/:date',
    authMiddleware,
    (req: AuthedRequest, res: Response) => {
      const worksheet = WorksheetStore.getByDate(req.params.date)
      res.json({ worksheet })
    },
  )

  /** 删除题库（需登录） */
  app.delete(
    '/api/worksheets/:id',
    authMiddleware,
    (req: AuthedRequest, res: Response) => {
      WorksheetStore.delete(req.params.id)
      res.json({ ok: true })
    },
  )
}
