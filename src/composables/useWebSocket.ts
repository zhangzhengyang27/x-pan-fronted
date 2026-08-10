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
  const host = typeof window !== 'undefined' ? window.location.hostname : '127.0.0.1'
  const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  // 从 panUtil 拿到后端端口（默认 8080）
  const port =
    (window as unknown as { __XPAN_BACKEND_PORT__?: number }).__XPAN_BACKEND_PORT__ || 8080
  return `${proto}//${host}:${port}/ws/notification?token=${encodeURIComponent(token)}`
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
  let pingTimer: number | null = null
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
    if (pingTimer !== null) {
      clearTimeout(pingTimer)
      pingTimer = null
    }
  }

  function startHeartbeat() {
    heartbeatTimer = window.setInterval(() => {
      if (ws && ws.readyState === WebSocket.OPEN) {
        try {
          ws.send(JSON.stringify({ type: 'PONG', ts: Date.now() }))
        } catch {
          // 忽略发送失败
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

/** 自动在组件卸载时断开（适合局部使用） */
export function useWebSocketAuto(token: () => string | null): UseWebSocketReturn {
  const ws = useWebSocket()
  onUnmounted(() => {
    // 不要在这里 disconnect，因为是单例；只解绑事件
  })
  // 首次调用时尝试连接
  const t = token()
  if (t && !ws.isConnected.value) ws.connect(t)
  return ws
}

export default useWebSocket
