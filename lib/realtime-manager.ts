'use client'

import { env } from '@/lib/env'

type MessageHandler = (payload: unknown) => void

type Subscription = {
  channel: string
  handler: MessageHandler
}

type ConnectionState = {
  connected: boolean
  stale: boolean
  connectedSince: string | null
  messagesReceived: number
  reconnects: number
  subscriptions: string[]
}

type StateListener = (state: ConnectionState) => void

const MAX_RECONNECT_DELAY = 30_000
const INITIAL_RECONNECT_DELAY = 1_000
const PING_INTERVAL = 15_000
const STALE_THRESHOLD = 35_000

class RealtimeManager {
  private ws: WebSocket | null = null
  private subscriptions: Map<string, Set<MessageHandler>> = new Map()
  private reconnectAttempts = 0
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private pingInterval: ReturnType<typeof setInterval> | null = null
  private lastPong = Date.now()
  private stateListeners: Set<StateListener> = new Set()
  private destroyed = false

  state: ConnectionState = {
    connected: false,
    stale: false,
    connectedSince: null,
    messagesReceived: 0,
    reconnects: 0,
    subscriptions: [],
  }

  private emitState() {
    this.stateListeners.forEach((fn) => fn(this.state))
  }

  onStateChange(fn: StateListener) {
    this.stateListeners.add(fn)
    fn(this.state)
    return () => this.stateListeners.delete(fn)
  }

  private updateState(partial: Partial<ConnectionState>) {
    this.state = { ...this.state, ...partial }
    this.emitState()
  }

  private getReconnectDelay() {
    const delay = Math.min(
      INITIAL_RECONNECT_DELAY * 2 ** this.reconnectAttempts,
      MAX_RECONNECT_DELAY
    )
    return delay + Math.random() * 1000
  }

  private connect() {
    if (this.destroyed || this.ws?.readyState === WebSocket.OPEN) return

    try {
      this.ws = new WebSocket(env.wsBaseUrl)
    } catch {
      this.scheduleReconnect()
      return
    }

    this.ws.onopen = () => {
      this.reconnectAttempts = 0
      this.updateState({
        connected: true,
        stale: false,
        connectedSince: new Date().toISOString(),
      })
      this.resubscribeAll()
      this.startPing()
    }

    this.ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data)
        this.handleMessage(msg)
      } catch {
        // ignore malformed frames
      }
    }

    this.ws.onclose = () => {
      this.stopPing()
      this.updateState({ connected: false, stale: true })
      this.scheduleReconnect()
    }

    this.ws.onerror = () => {
      this.ws?.close()
    }
  }

  private handleMessage(msg: Record<string, unknown>) {
    this.updateState({ messagesReceived: this.state.messagesReceived + 1 })

    // Protocol-level messages
    if (msg.type === 'pong') {
      this.lastPong = Date.now()
      this.updateState({ stale: false })
      return
    }

    if (msg.type === 'subscribed' && typeof msg.channel === 'string') {
      return
    }

    if (msg.type === 'unsubscribed' && typeof msg.channel === 'string') {
      return
    }

    if (msg.type === 'error') {
      return
    }

    // Channel-based updates
    const channel = msg.channel as string | undefined
    if (channel && this.subscriptions.has(channel)) {
      const handlers = this.subscriptions.get(channel)!
      handlers.forEach((handler) => handler(msg.payload ?? msg))
      return
    }

    // Legacy quote broadcasts (no channel)
    if (msg.quote || msg.type === 'quote') {
      const payload = msg.quote ?? msg.payload
      this.subscriptions.get('quotes')?.forEach((fn) => fn(payload))
      return
    }

    // Legacy notification broadcasts
    if (msg.type === 'notification') {
      this.subscriptions.get('notifications')?.forEach((fn) => fn(msg.payload))
      return
    }
  }

  private startPing() {
    this.stopPing()
    this.lastPong = Date.now()
    this.pingInterval = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: 'ping' }))
        if (Date.now() - this.lastPong > STALE_THRESHOLD) {
          this.updateState({ stale: true })
        }
      }
    }, PING_INTERVAL)
  }

  private stopPing() {
    if (this.pingInterval) {
      clearInterval(this.pingInterval)
      this.pingInterval = null
    }
  }

  private scheduleReconnect() {
    if (this.destroyed) return
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer)
    this.reconnectAttempts++
    this.updateState({ reconnects: this.reconnectAttempts })
    const delay = this.getReconnectDelay()
    this.reconnectTimer = setTimeout(() => this.connect(), delay)
  }

  private resubscribeAll() {
    this.subscriptions.forEach((_, channel) => {
      this.sendSubscription(channel, true)
    })
  }

  private sendSubscription(channel: string, subscribe: boolean) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        type: subscribe ? 'subscribe' : 'unsubscribe',
        channel,
      }))
    }
  }

  subscribe(channel: string, handler: MessageHandler): () => void {
    if (!this.subscriptions.has(channel)) {
      this.subscriptions.set(channel, new Set())
      this.sendSubscription(channel, true)
      this.updateState({ subscriptions: Array.from(this.subscriptions.keys()) })
    }
    this.subscriptions.get(channel)!.add(handler)

    return () => {
      const handlers = this.subscriptions.get(channel)
      if (!handlers) return
      handlers.delete(handler)
      if (handlers.size === 0) {
        this.subscriptions.delete(channel)
        this.sendSubscription(channel, false)
        this.updateState({ subscriptions: Array.from(this.subscriptions.keys()) })
      }
    }
  }

  connectIfNeeded() {
    if (!this.ws || this.ws.readyState === WebSocket.CLOSED || this.ws.readyState === WebSocket.CLOSING) {
      this.connect()
    }
  }

  disconnect() {
    this.destroyed = true
    this.stopPing()
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
    this.ws?.close()
    this.ws = null
    this.subscriptions.clear()
    this.updateState({
      connected: false,
      stale: true,
      subscriptions: [],
    })
  }
}

export const realtimeManager = new RealtimeManager()
