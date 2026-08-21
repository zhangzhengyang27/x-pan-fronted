/**
 * useWebSocket —— X-Pan 实时通知订阅（TypeScript 版）
 *
 * 用法：
 *   const ws = useWebSocket()
 *   ws.on('OFFLINE_TASK_UPDATE', (payload) => { ... })
 *   ws.connect(token)
 *   // 组件卸载时：
 *   ws.disconnect()
 */

import { ref, onUnmounted, type Ref } from 'vue'
import panUtil from '@/utils/common'

export type WsMessageType =
  | 'CONNECTED'
  | 'PING'
  | 'PONG'
  | 'OFFLINE_TASK_UPDATE'
  | 'OFFLINE_TASK_REMOVED'
  | 'SHARE_STATS_UPDATE'
  | 'UPLOAD_FINISHED'
  | 'SYSTEM_NOTICE'

export interface WsMessage<T = unknown> {
  type: WsMessageType
  payload: T
  ts: number
}

type Handler<T = unknown> = (payload: T, msg: WsMessage<T>) => void

interface UseWebSocketReturn {
  isConnected: Ref<boolean>
  lastMessageAt: Ref<number>
  reconnectAttempts: Ref<number>
  onlineCount: Ref<number>
  connect: (token: string) => void
  disconnect: () => void
  send: (data: string | object) => void
  on: <T = unknown>(type: WsMessageType, handler: Handler<T>) => () => void
  once: <T = unknown>(type: WsMessageType, handler: Handler<T>) => void
}

const MAX_RECONNECT = 8
const HEARTBEAT_INTERVAL = 25 // < 服务器 30s

let _singleton: UseWebSocketReturn | null = null

function buildWsUrl(token: string): string {
  // 优先使用构建期注入的 VITE_WS_URL（与 README 约定一致），便于部署时直接指定 WS 地址
  const wsEnv = import.meta.env?.VITE_WS_URL
  if (wsEnv) {
    const sep = wsEnv.includes('?') ? '&' : '?'
    return `${wsEnv}${sep}token=${encodeURIComponent(token)}`
  }
  const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  const host = window.location.host // 同源（保留当前页端口），dev 走 vite 代理，prod 走 nginx 反代
  return `${proto}//${host}/ws/notification?token=${encodeURIComponent(token)}`
}

export function useWebSocket(): UseWebSocketReturn {
  // 单例：保证整个应用只有一个 WS 连接，多个组件共享
  if (_singleton) return _singleton

  const isConnected = ref(false)
  const lastMessageAt = ref(0)
  const reconnectAttempts = ref(0)
  const onlineCount = ref(0)

  let ws: WebSocket | null = null
  let reconnectTimer: number | null = null
  let heartbeatTimer: number | null = null
  let pongCheckTimer: number | null = null
  const handlers = new Map<WsMessageType, Set<Handler>>()

  function clearTimers() {
    if (reconnectTimer !== null) {
      clearTimeout(reconnectTimer)
      reconnectTimer = null
    }
    if (heartbeatTimer !== null) {
      clearInterval(heartbeatTimer)
      heartbeatTimer = null
    }
    if (pongCheckTimer !== null) {
      clearTimeout(pongCheckTimer)
      pongCheckTimer = null
    }
  }

  // 周期性发送 PING（服务端回 PONG = msg.type 'PONG'）
  function startHeartbeat() {
    heartbeatTimer = window.setInterval(() => {
      if (!ws || ws.readyState !== WebSocket.OPEN) return
      try {
        ws.send(JSON.stringify({ type: 'PING', ts: Date.now() }))
      } catch {
        // 忽略发送失败
      }
    }, HEARTBEAT_INTERVAL * 1000)

    // 超时未收到任何服务端消息（含 PONG）则判定静默断线，主动断开触发重连
    pongCheckTimer = window.setInterval(() => {
      const gap = Date.now() - lastMessageAt.value
      if (ws && ws.readyState === WebSocket.OPEN && gap > HEARTBEAT_INTERVAL * 1000 * 2) {
        console.warn('[WS] 心跳超时，未收到服务端消息，主动断开')
        try {
          ws.close(4000, 'heartbeat timeout')
        } catch {
          // 忽略
        }
      }
    }, HEARTBEAT_INTERVAL * 1000)
  }

  function scheduleReconnect(token: string) {
    if (reconnectAttempts.value >= MAX_RECONNECT) {
      console.warn('[WS] 达到最大重连次数，停止重连')
      return
    }
    const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.value), 30_000)
    reconnectAttempts.value++
    console.log(`[WS] 将在 ${delay}ms 后尝试重连（${reconnectAttempts.value}/${MAX_RECONNECT}）`)
    reconnectTimer = window.setTimeout(() => connect(token), delay)
  }

  function connect(token: string) {
    if (!token) {
      console.warn('[WS] 无 token，跳过连接')
      return
    }
    if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
      return // 已连接/连接中，不重复
    }

    try {
      ws = new WebSocket(buildWsUrl(token))
    } catch (e) {
      console.error('[WS] 创建连接失败', e)
      scheduleReconnect(token)
      return
    }

    ws.onopen = () => {
      console.log('[WS] 连接已建立')
      isConnected.value = true
      reconnectAttempts.value = 0
      startHeartbeat()
    }

    ws.onmessage = (evt) => {
      lastMessageAt.value = Date.now()
      let msg: WsMessage
      try {
        msg = JSON.parse(evt.data)
      } catch {
        return
      }
      const set = handlers.get(msg.type as WsMessageType)
      if (set) {
        for (const h of set) {
          try {
            h(msg.payload, msg)
          } catch (e) {
            console.error('[WS] handler error', e)
          }
        }
      }
    }

    ws.onerror = (e) => {
      console.warn('[WS] 错误', e)
    }

    ws.onclose = (e) => {
      console.log(`[WS] 关闭: code=${e.code}, reason=${e.reason}`)
      isConnected.value = false
      clearTimers()
      scheduleReconnect(token)
    }
  }

  function disconnect() {
    clearTimers()
    if (ws) {
      try {
        ws.close(1000, 'client disconnect')
      } catch {
        // 忽略关闭失败
      }
      ws = null
    }
    isConnected.value = false
  }

  function send(data: string | object) {
    if (!ws || ws.readyState !== WebSocket.OPEN) return
    try {
      ws.send(typeof data === 'string' ? data : JSON.stringify(data))
    } catch (e) {
      console.warn('[WS] send 失败', e)
    }
  }

  function on<T = unknown>(type: WsMessageType, handler: Handler<T>) {
    let set = handlers.get(type)
    if (!set) {
      set = new Set()
      handlers.set(type, set)
    }
    set.add(handler as Handler)
    return () => set!.delete(handler as Handler)
  }

  function once<T = unknown>(type: WsMessageType, handler: Handler<T>) {
    const off = on<T>(type, (payload, msg) => {
      off()
      handler(payload, msg)
    })
  }

  _singleton = {
    isConnected,
    lastMessageAt,
    reconnectAttempts,
    onlineCount,
    connect,
    disconnect,
    send,
    on,
    once
  }

  return _singleton
}

/**
 * 自动连接 + 在组件卸载时解绑所有通过本函数注册的事件（适合局部使用）。
 * 因为是单例连接，卸载时不会断开 WS，只会移除本次注册的事件处理器，避免 handler 泄漏。
 *
 * 用法：
 *   const ws = useWebSocketAuto(() => getToken(), (w) => {
 *     const off = w.on('OFFLINE_TASK_UPDATE', (p) => { ... })
 *     return () => off() // 可选：返回额外的清理函数
 *   })
 */
export function useWebSocketAuto(
  token: () => string | null,
  setup?: (ws: UseWebSocketReturn) => (() => void) | void
): UseWebSocketReturn {
  const ws = useWebSocket()
  const extraCleanups: Array<() => void> = []
  if (setup) {
    const result = setup(ws)
    if (typeof result === 'function') extraCleanups.push(result)
  }
  onUnmounted(() => {
    // 单例连接不关闭，仅解绑本次注册的事件，防止 handler 累积泄漏
    extraCleanups.forEach((fn) => fn())
  })
  const t = token()
  if (t && !ws.isConnected.value) ws.connect(t)
  return ws
}

export default useWebSocket
