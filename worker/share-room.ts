import { DurableObject } from "cloudflare:workers"

interface StoredConfig {
  access: "link" | "invite"
  role: "view" | "comment"
  passwordHash: string | null
  expiresAt: string | null
  variantSets: string[]
  invited: string[]
  message: string
}

interface Attachment {
  role: "editor" | "viewer"
  name: string
}

const json = (data: unknown, status = 200) => Response.json(data, { status })

export async function sha256(text: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text))
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("")
}

/**
 * One room per share link: stores the prototype snapshot, its config and viewer comments
 * in SQLite, and fans comments + presence out to every connected socket.
 */
export class ShareRoom extends DurableObject {
  private sql: SqlStorage

  constructor(ctx: DurableObjectState, env: Cloudflare.Env) {
    super(ctx, env)
    this.sql = ctx.storage.sql
    this.sql.exec("CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT)")
    this.sql.exec("CREATE TABLE IF NOT EXISTS comments (id TEXT PRIMARY KEY, data TEXT, created_at INTEGER)")
  }

  private getMeta<T>(key: string): T | null {
    const row = this.sql.exec<{ value: string }>("SELECT value FROM meta WHERE key = ?", key).toArray()[0]
    return row ? (JSON.parse(row.value) as T) : null
  }

  private setMeta(key: string, value: unknown) {
    this.sql.exec("INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)", key, JSON.stringify(value))
  }

  private comments() {
    return this.sql
      .exec<{ data: string }>("SELECT data FROM comments ORDER BY created_at ASC")
      .toArray()
      .map((r) => JSON.parse(r.data))
  }

  private broadcast(msg: unknown) {
    const data = JSON.stringify(msg)
    for (const ws of this.ctx.getWebSockets()) {
      try {
        ws.send(data)
      } catch {
        /* socket closing */
      }
    }
  }

  private presence() {
    const viewers = this.ctx.getWebSockets().filter((ws) => (ws.deserializeAttachment() as Attachment | null)?.role === "viewer").length
    this.broadcast({ type: "presence", viewers })
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url)
    const action = url.pathname.split("/").pop()

    if (request.headers.get("Upgrade") === "websocket") {
      if (!this.getMeta("snapshot")) return new Response("Not found", { status: 404 })
      const pair = new WebSocketPair()
      const [client, server] = Object.values(pair)
      const role = url.searchParams.get("role") === "editor" ? "editor" : "viewer"
      const name = url.searchParams.get("name") ?? ""
      this.ctx.acceptWebSocket(server)
      server.serializeAttachment({ role, name } satisfies Attachment)
      // presence after the handshake completes
      queueMicrotask(() => this.presence())
      return new Response(null, { status: 101, webSocket: client })
    }

    if (action === "create" && request.method === "POST") {
      const body = (await request.json()) as { snapshot: unknown; config: StoredConfig; owner?: string; createdAt: number }
      this.setMeta("snapshot", body.snapshot)
      this.setMeta("config", body.config)
      this.setMeta("owner", body.owner ?? "")
      this.setMeta("createdAt", body.createdAt)
      return json({ ok: true })
    }

    const snapshot = this.getMeta("snapshot")
    const config = this.getMeta<StoredConfig>("config")
    if (!snapshot || !config) return json({ error: "not_found" }, 404)

    if (config.expiresAt && new Date(config.expiresAt).getTime() < Date.now()) return json({ error: "expired", expired: true }, 410)

    if (action === "read" && request.method === "GET") {
      if (config.passwordHash) {
        const pw = request.headers.get("x-share-password") ?? url.searchParams.get("pw") ?? ""
        if (!pw || (await sha256(pw)) !== config.passwordHash) return json({ needsPassword: true, wrong: !!pw }, 401)
      }
      const { passwordHash, ...publicConfig } = config
      return json({
        snapshot,
        config: { ...publicConfig, hasPassword: !!passwordHash },
        owner: this.getMeta("owner"),
        createdAt: this.getMeta("createdAt"),
        comments: this.comments(),
      })
    }

    if (action === "comments" && request.method === "GET") return json({ comments: this.comments() })

    if (action === "comments" && request.method === "POST") {
      const { comment } = (await request.json()) as { comment: { id: string; createdAt?: number } }
      if (!comment?.id) return json({ error: "bad_request" }, 400)
      this.sql.exec(
        "INSERT OR REPLACE INTO comments (id, data, created_at) VALUES (?, ?, ?)",
        comment.id,
        JSON.stringify(comment),
        comment.createdAt ?? Date.now(),
      )
      this.broadcast({ type: "comment", comment })
      return json({ ok: true })
    }

    return json({ error: "not_found" }, 404)
  }

  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer) {
    if (typeof message !== "string") return
    let msg: { type?: string; role?: Attachment["role"]; name?: string; comment?: { id: string; createdAt?: number } }
    try {
      msg = JSON.parse(message)
    } catch {
      return
    }
    if (msg.type === "hello") {
      const prev = (ws.deserializeAttachment() as Attachment | null) ?? { role: "viewer", name: "" }
      ws.serializeAttachment({ role: msg.role ?? prev.role, name: msg.name ?? prev.name })
      this.presence()
    } else if (msg.type === "comment" && msg.comment?.id) {
      this.sql.exec(
        "INSERT OR REPLACE INTO comments (id, data, created_at) VALUES (?, ?, ?)",
        msg.comment.id,
        JSON.stringify(msg.comment),
        msg.comment.createdAt ?? Date.now(),
      )
      this.broadcast({ type: "comment", comment: msg.comment })
    } else if (msg.type === "ping") {
      ws.send(JSON.stringify({ type: "pong" }))
    }
  }

  async webSocketClose(ws: WebSocket, code: number) {
    try {
      ws.close(code, "bye")
    } catch {
      /* already closed */
    }
    this.presence()
  }

  async webSocketError() {
    this.presence()
  }
}
