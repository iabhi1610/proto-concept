import { sha256 } from "./share-room"

export { ShareRoom } from "./share-room"

interface Env {
  SHARE_ROOM: DurableObjectNamespace
  ASSETS: Fetcher
}

const json = (data: unknown, status = 200) => Response.json(data, { status })

const ALPHABET = "abcdefghijkmnpqrstuvwxyz23456789"
function shortId(n = 8) {
  const bytes = crypto.getRandomValues(new Uint8Array(n))
  return [...bytes].map((b) => ALPHABET[b % ALPHABET.length]).join("")
}

interface CreateBody {
  snapshot: unknown
  owner?: string
  config: {
    access?: "link" | "invite"
    role?: "view" | "comment"
    password?: string
    expiresAt?: string | null
    variantSets?: string[]
    invited?: string[]
    message?: string
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)
    const parts = url.pathname.split("/").filter(Boolean) // ["api", "shares", id?, sub?]

    if (parts[0] !== "api") return env.ASSETS.fetch(request)
    if (parts[1] !== "shares") return json({ error: "not_found" }, 404)

    // POST /api/shares
    if (parts.length === 2 && request.method === "POST") {
      let body: CreateBody
      try {
        body = (await request.json()) as CreateBody
      } catch {
        return json({ error: "bad_request" }, 400)
      }
      if (!body?.snapshot || !body.config) return json({ error: "bad_request" }, 400)
      const id = shortId()
      const c = body.config
      const config = {
        access: c.access ?? "link",
        role: c.role ?? "comment",
        passwordHash: c.password ? await sha256(c.password) : null,
        expiresAt: c.expiresAt ?? null,
        variantSets: c.variantSets ?? [],
        invited: c.invited ?? [],
        message: c.message ?? "",
      }
      const stub = env.SHARE_ROOM.get(env.SHARE_ROOM.idFromName(id))
      await stub.fetch(`https://room/${id}/create`, {
        method: "POST",
        body: JSON.stringify({ snapshot: body.snapshot, config, owner: body.owner ?? "", createdAt: Date.now() }),
      })
      return json({ id })
    }

    const id = parts[2]
    if (!id || !/^[a-z0-9]{4,32}$/i.test(id)) return json({ error: "not_found" }, 404)
    const stub = env.SHARE_ROOM.get(env.SHARE_ROOM.idFromName(id))

    // GET /api/shares/:id/ws
    if (parts[3] === "ws") {
      if (request.headers.get("Upgrade") !== "websocket") return json({ error: "expected_websocket" }, 426)
      return stub.fetch(new Request(`https://room/${id}/ws${url.search}`, request))
    }

    // GET /api/shares/:id
    if (parts.length === 3 && request.method === "GET") {
      const headers = new Headers()
      const pw = request.headers.get("x-share-password")
      if (pw) headers.set("x-share-password", pw)
      return stub.fetch(`https://room/${id}/read${url.search}`, { headers })
    }

    // GET|POST /api/shares/:id/comments
    if (parts[3] === "comments") {
      return stub.fetch(`https://room/${id}/comments`, {
        method: request.method,
        body: request.method === "POST" ? await request.text() : undefined,
      })
    }

    return json({ error: "not_found" }, 404)
  },
} satisfies ExportedHandler<Env>
