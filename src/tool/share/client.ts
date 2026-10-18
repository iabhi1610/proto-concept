import type { Comment, EditOp, ScreenId, ShareConfig, ShareInfo, VariantSet } from "../types"

export interface ShareSnapshot {
  ops: EditOp[]
  variantSets: VariantSet[]
  screen: ScreenId
}

export interface PublicShareConfig extends Omit<ShareConfig, "password"> {
  hasPassword: boolean
}

export interface SharePayload {
  snapshot: ShareSnapshot
  config: PublicShareConfig
  owner: string
  createdAt: number
  comments: Comment[]
}

export type FetchShareResult =
  | { status: "ok"; data: SharePayload }
  | { status: "password"; wrong: boolean }
  | { status: "expired" }
  | { status: "missing" }
  | { status: "error"; message: string }

export type ShareMessage =
  | { type: "comment"; comment: Comment }
  | { type: "presence"; viewers: number }
  | { type: "pong" }

export const shareUrl = (id: string) => `${location.origin}/s/${id}`

export async function createShare(snapshot: ShareSnapshot, config: ShareConfig, owner = "Abhi Kumar"): Promise<ShareInfo> {
  const res = await fetch("/api/shares", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ snapshot, config, owner }),
  })
  if (!res.ok) throw new Error(`Could not create link (${res.status})`)
  const { id } = (await res.json()) as { id: string }
  // never keep the plain password around client-side
  return { id, url: shareUrl(id), createdAt: Date.now(), config: { ...config, password: config.password ? "••••" : "" } }
}

export async function fetchShare(id: string, password?: string): Promise<FetchShareResult> {
  try {
    const res = await fetch(`/api/shares/${id}`, { headers: password ? { "x-share-password": password } : undefined })
    if (res.status === 401) {
      const body = (await res.json()) as { wrong?: boolean }
      return { status: "password", wrong: !!body.wrong }
    }
    if (res.status === 410) return { status: "expired" }
    if (res.status === 404) return { status: "missing" }
    if (!res.ok) return { status: "error", message: `HTTP ${res.status}` }
    return { status: "ok", data: (await res.json()) as SharePayload }
  } catch (e) {
    return { status: "error", message: e instanceof Error ? e.message : "Network error" }
  }
}

export async function fetchComments(id: string): Promise<Comment[]> {
  const res = await fetch(`/api/shares/${id}/comments`)
  if (!res.ok) return []
  return ((await res.json()) as { comments: Comment[] }).comments ?? []
}

export async function postComment(id: string, comment: Comment) {
  const res = await fetch(`/api/shares/${id}/comments`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ comment }),
  })
  if (!res.ok) throw new Error(`Could not post comment (${res.status})`)
}

/** Opens a share-room socket that reconnects with backoff until `close()` is called. */
export function openSocket(id: string, role: "editor" | "viewer", name: string, onMessage: (m: ShareMessage) => void) {
  let ws: WebSocket | null = null
  let closed = false
  let attempt = 0
  let ping = 0
  let timer = 0

  const connect = () => {
    if (closed) return
    const proto = location.protocol === "https:" ? "wss" : "ws"
    ws = new WebSocket(`${proto}://${location.host}/api/shares/${id}/ws?role=${role}&name=${encodeURIComponent(name)}`)
    ws.onopen = () => {
      attempt = 0
      ws?.send(JSON.stringify({ type: "hello", role, name }))
      ping = window.setInterval(() => ws?.readyState === WebSocket.OPEN && ws.send(JSON.stringify({ type: "ping" })), 25_000)
    }
    ws.onmessage = (e) => {
      try {
        onMessage(JSON.parse(e.data as string) as ShareMessage)
      } catch {
        /* ignore malformed */
      }
    }
    ws.onclose = () => {
      window.clearInterval(ping)
      if (closed) return
      attempt += 1
      timer = window.setTimeout(connect, Math.min(10_000, 500 * 2 ** attempt))
    }
    ws.onerror = () => ws?.close()
  }
  connect()

  return {
    hello: (newName: string) => ws?.readyState === WebSocket.OPEN && ws.send(JSON.stringify({ type: "hello", role, name: newName })),
    close: () => {
      closed = true
      window.clearTimeout(timer)
      window.clearInterval(ping)
      ws?.close()
    },
  }
}
