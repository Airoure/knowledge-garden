import type { Server, Socket } from 'socket.io'
import { RoomManager } from './RoomManager.js'
import type { BattleConfig } from './types.js'

/**
 * Socket 事件处理器
 *
 * 处理客户端的创建房间、加入房间、重连归位、开始游戏、提交答案、离开房间等事件
 *
 * 身份模型：客户端携带持久化 playerId，服务器以 playerId 管理玩家；
 * socket.id 仅通过 manager.resolvePlayer() 在事件处理时解析为 playerId。
 */
export function registerSocketHandlers(io: Server): void {
  const manager = new RoomManager(io)
  // 启动僵尸房间兜底清理
  manager.startCleanup()

  io.on('connection', (socket: Socket) => {
    console.log(`[连接] ${socket.id}`)

    // ===== 创建房间 =====
    socket.on(
      'battle:create',
      (payload: { playerId: string; name: string; config: BattleConfig }, ack?: (res: unknown) => void) => {
        const { playerId, name, config } = payload
        if (!playerId || !name || !config || !config.operations?.length || !config.totalCount) {
          ack?.({ error: '参数不合法' })
          return
        }

        const room = manager.createRoom(playerId, name, config, socket.id)
        socket.join(room.id)

        const result = {
          roomId: room.id,
          playerId,
          players: room.getPlayersView(),
          config: room.config,
          isHost: true,
        }

        ack?.(result)
        console.log(`[创建房间] ${room.id} by ${name}`)
      },
    )

    // ===== 加入房间 =====
    socket.on(
      'battle:join',
      (payload: { playerId: string; roomId: string; name: string }, ack?: (res: unknown) => void) => {
        const { playerId, roomId, name } = payload
        if (!playerId || !roomId || !name) {
          ack?.({ error: '参数不合法' })
          return
        }

        const normalizedId = roomId.toUpperCase()
        const room = manager.getRoom(normalizedId)
        if (!room) {
          ack?.({ error: '房间不存在' })
          return
        }
        if (!room.isWaiting) {
          ack?.({ error: '游戏已开始，无法加入' })
          return
        }

        const joined = manager.joinRoom(normalizedId, playerId, name, socket.id)
        if (!joined) {
          ack?.({ error: '加入失败' })
          return
        }

        socket.join(room.id)

        const result = {
          roomId: room.id,
          playerId,
          players: room.getPlayersView(),
          config: room.config,
          isHost: false,
        }

        ack?.(result)

        // 广播成员变化给房间内所有人
        manager.emitPlayersUpdate(room)

        console.log(`[加入房间] ${name} → ${room.id}`)
      },
    )

    // ===== 重连归位 =====
    socket.on(
      'battle:rejoin',
      (payload: { playerId: string; roomId: string }, ack?: (res: unknown) => void) => {
        const { playerId, roomId } = payload
        if (!playerId || !roomId) {
          ack?.({ ok: false, error: '参数不合法' })
          return
        }

        const room = manager.rejoin(playerId, roomId.toUpperCase(), socket.id)
        if (!room) {
          ack?.({ ok: false, error: '房间已失效或你不在该房间' })
          return
        }

        // 重新加入 socket.io 房间，恢复广播接收
        socket.join(room.id)

        // 广播成员在线状态变化
        manager.emitPlayersUpdate(room)

        // 返回完整快照，供前端恢复阶段与进度
        ack?.(manager.buildRejoinSnapshot(room, playerId))

        console.log(`[重连归位] ${playerId} → ${room.id}`)
      },
    )

    // ===== 开始游戏 =====
    socket.on('battle:start', (payload: { roomId: string }, ack?: (res: unknown) => void) => {
      const resolved = manager.resolvePlayer(socket.id)
      if (!resolved) {
        ack?.({ error: '你不在房间中' })
        return
      }
      const { room, player } = resolved

      if (player.id !== room.hostId) {
        ack?.({ error: '只有房主可以开始游戏' })
        return
      }
      if (room.connectedPlayerCount < 2) {
        ack?.({ error: '等待对手上线' })
        return
      }

      const questions = room.startGame()
      if (!questions) {
        ack?.({ error: '无法开始游戏' })
        return
      }

      ack?.({ ok: true })

      // 广播给房间内所有玩家
      io.to(room.id).emit('battle:started', {
        questions,
        startTime: room.gameStartTime,
        config: room.config,
      })

      console.log(`[游戏开始] 房间 ${room.id}, ${questions.length} 题`)
    })

    // ===== 提交答案 =====
    socket.on('battle:answer', (payload: { roomId: string; answer: number }, ack?: (res: unknown) => void) => {
      const resolved = manager.resolvePlayer(socket.id)
      if (!resolved) {
        ack?.({ error: '游戏未在进行中' })
        return
      }
      const { room, player } = resolved

      if (!room.isPlaying) {
        ack?.({ error: '游戏未在进行中' })
        return
      }

      const result = room.submitAnswer(player.id, payload.answer)
      if (!result) {
        ack?.({ error: '无法提交答案' })
        return
      }

      // 回复提交者判定结果
      ack?.({
        correct: result.correct,
        correctAnswer: result.correctAnswer,
        playerFinished: result.playerFinished,
      })

      // 广播进度给房间内其他玩家
      const progress = room.getPlayerProgress(player.id)
      if (progress) {
        socket.to(room.id).emit('battle:progress', progress)
      }

      // 如果游戏结束（第一个完成）
      if (result.gameEnded) {
        const results = room.getResults()
        io.to(room.id).emit('battle:game_over', { results })
        console.log(`[游戏结束] 房间 ${room.id}, 胜者: ${results[0]?.name}`)
      }
    })

    // ===== 再来一局 =====
    socket.on(
      'battle:rematch',
      (payload: { playerId: string; roomId: string }, ack?: (res: unknown) => void) => {
        const { playerId, roomId } = payload
        if (!playerId || !roomId) {
          ack?.({ ok: false, error: '参数不合法' })
          return
        }

        const room = manager.rematch(playerId, roomId.toUpperCase())
        if (!room) {
          ack?.({ ok: false, error: '无法再来一局' })
          return
        }

        ack?.({ ok: true })
        console.log(`[再来一局] ${playerId} → ${room.id}`)
      },
    )

    // ===== 离开房间 =====
    socket.on('battle:leave', () => {
      const resolved = manager.resolvePlayer(socket.id)
      if (resolved) {
        const { room, player } = resolved
        manager.removePlayer(player.id)
        console.log(`[离开房间] ${player.name} ← ${room.id}`)
      }
    })

    // ===== 断线（进入宽限期，不立即移除） =====
    socket.on('disconnect', () => {
      const info = manager.handleDisconnect(socket.id)
      if (info) {
        console.log(`[断线] ${info.player.name} ← ${info.room.id}（进入宽限期）`)
      }
    })

    console.log(`[连接建立] ${socket.id}`)
  })
}
