import * as React from "react"
import { ArrowRight, Clock3, Link2Off, Lock, TriangleAlert } from "@/lib/icons"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Toaster } from "@/components/ui/sonner"
import { TooltipProvider } from "@/components/ui/tooltip"
import { ProductApp } from "@/product/ProductApp"
import { OrbitLogo } from "@/product/shell"
import { PRODUCT_ROOT_ID } from "@/tool/engine/dom"
import { fetchShare, openSocket, type SharePayload } from "@/tool/share/client"
import { useTool } from "@/tool/store"
import { StyleInjector } from "@/tool/StyleInjector"
import type { Comment } from "@/tool/types"
import { ViewerChrome } from "./ViewerChrome"
import { ViewerComments } from "./ViewerComments"

type Status = { kind: "loading" } | { kind: "password"; wrong: boolean } | { kind: "expired" } | { kind: "missing" } | { kind: "error"; message: string } | { kind: "ready"; data: SharePayload }

const pwKey = (id: string) => `pc-share-pw:${id}`

export function Viewer({ shareId }: { shareId: string }) {
  const [status, setStatus] = React.useState<Status>({ kind: "loading" })

  const load = React.useCallback(
    async (pw?: string) => {
      const res = await fetchShare(shareId, pw)
      if (res.status === "ok") {
        if (pw) sessionStorage.setItem(pwKey(shareId), pw)
        const { snapshot } = res.data
        useTool.setState({
          ops: snapshot.ops ?? [],
          variantSets: (snapshot.variantSets ?? []).map((v) => ({ ...v, generating: false })),
          screen: snapshot.screen ?? "overview",
          comments: [],
          mode: "browse",
          selection: [],
          forced: {},
          past: [],
          future: [],
        })
        setStatus({ kind: "ready", data: res.data })
      } else if (res.status === "password") setStatus({ kind: "password", wrong: res.wrong })
      else if (res.status === "expired") setStatus({ kind: "expired" })
      else if (res.status === "missing") setStatus({ kind: "missing" })
      else setStatus({ kind: "error", message: res.message })
    },
    [shareId],
  )

  React.useEffect(() => {
    document.documentElement.classList.remove("dark")
    document.title = "Orbit Analytics · Shared prototype"
    load(sessionStorage.getItem(pwKey(shareId)) ?? undefined)
  }, [load, shareId])

  if (status.kind === "ready") return <ViewerApp shareId={shareId} data={status.data} />

  return (
    <div className="grid h-full place-items-center bg-[#f6f6f4] px-4">
      {status.kind === "loading" && (
        <div className="flex flex-col items-center gap-3">
          <OrbitLogo className="size-9 animate-pulse" />
          <span className="text-[13px] text-muted-foreground">Opening prototype…</span>
        </div>
      )}
      {status.kind === "password" && <PasswordGate wrong={status.wrong} onSubmit={(pw) => load(pw)} />}
      {status.kind === "expired" && (
        <GateCard icon={<Clock3 className="size-5" />} title="This link has expired" body="Ask the person who shared it for a fresh link." />
      )}
      {status.kind === "missing" && (
        <GateCard icon={<Link2Off className="size-5" />} title="Link not found" body="It may have been removed, or the address is incomplete." />
      )}
      {status.kind === "error" && (
        <GateCard
          icon={<TriangleAlert className="size-5" />}
          title="Couldn't open this prototype"
          body={status.message}
          action={
            <Button variant="outline" onClick={() => load()}>
              Try again
            </Button>
          }
        />
      )}
    </div>
  )
}

function GateCard({ icon, title, body, action }: { icon: React.ReactNode; title: string; body: string; action?: React.ReactNode }) {
  return (
    <div className="flex w-full max-w-[380px] flex-col items-center gap-4 rounded-2xl border border-black/[0.06] bg-white p-8 text-center shadow-[0_1px_2px_rgb(0_0_0/0.04),0_12px_32px_-8px_rgb(0_0_0/0.12)]">
      <span className="grid size-11 place-items-center rounded-full bg-[#f4f4f2] text-[#16171a]">{icon}</span>
      <div className="flex flex-col gap-1">
        <h1 className="text-[16px] font-semibold tracking-[-0.01em] text-[#16171a]">{title}</h1>
        <p className="text-[13px] leading-relaxed text-[#6b6d73]">{body}</p>
      </div>
      {action}
      <span className="mt-1 text-[11.5px] text-[#9a9ca3]">Shared via Proto Concept</span>
    </div>
  )
}

function PasswordGate({ wrong, onSubmit }: { wrong: boolean; onSubmit: (pw: string) => Promise<void> }) {
  const [pw, setPw] = React.useState("")
  const [busy, setBusy] = React.useState(false)
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault()
        if (!pw) return
        setBusy(true)
        await onSubmit(pw)
        setBusy(false)
      }}
      className="flex w-full max-w-[380px] flex-col items-center gap-5 rounded-2xl border border-black/[0.06] bg-white p-8 shadow-[0_1px_2px_rgb(0_0_0/0.04),0_12px_32px_-8px_rgb(0_0_0/0.12)]"
    >
      <div className="relative">
        <OrbitLogo className="size-11" />
        <span className="absolute -bottom-1 -right-1 grid size-5 place-items-center rounded-full bg-white shadow-[0_0_0_1px_rgb(0_0_0/0.08)]">
          <Lock className="size-3 text-[#16171a]" />
        </span>
      </div>
      <div className="flex flex-col items-center gap-1 text-center">
        <h1 className="text-[16px] font-semibold tracking-[-0.01em] text-[#16171a]">Orbit Analytics prototype</h1>
        <p className="text-[13px] text-[#6b6d73]">This link is password protected.</p>
      </div>
      <div className="flex w-full flex-col gap-2">
        <Input
          type="password"
          autoFocus
          value={pw}
          onChange={(e) => setPw(e.target.value)}
          placeholder="Enter password"
          aria-invalid={wrong || undefined}
          className="h-10 bg-white text-[14px] md:text-[14px]"
        />
        {wrong && <span className="text-[12px] text-destructive">That password didn't work. Try again.</span>}
      </div>
      <Button type="submit" disabled={!pw || busy} className="h-10 w-full gap-1.5 text-[14px]">
        {busy ? "Checking…" : "View prototype"} <ArrowRight className="size-4" />
      </Button>
      <span className="text-[11.5px] text-[#9a9ca3]">Shared via Proto Concept</span>
    </form>
  )
}

/* ───────────────────────── Ready ───────────────────────── */

export interface ViewerCtx {
  shareId: string
  data: SharePayload
  name: string
  setName: (n: string) => void
  comments: Comment[]
  addComment: (c: Comment) => void
  viewers: number
  commenting: boolean
  setCommenting: (v: boolean) => void
  embed: boolean
}

export const ViewerContext = React.createContext<ViewerCtx | null>(null)
export const useViewer = () => React.useContext(ViewerContext)!

function ViewerApp({ shareId, data }: { shareId: string; data: SharePayload }) {
  const screen = useTool((s) => s.screen)
  const setScreen = useTool((s) => s.setScreen)
  const [name, setNameState] = React.useState(() => localStorage.getItem("pc-viewer-name") ?? "")
  const [comments, setComments] = React.useState<Comment[]>(() => data.comments ?? [])
  const [viewers, setViewers] = React.useState(0)
  // a comment link opens straight into comment mode
  const [commenting, setCommenting] = React.useState(data.config.role === "comment")
  const socketRef = React.useRef<ReturnType<typeof openSocket> | null>(null)
  const embed = new URLSearchParams(location.search).has("embed")

  const addComment = React.useCallback((c: Comment) => {
    // a newer copy (owner replied or resolved) replaces the one we have
    setComments((prev) => {
      const have = prev.find((x) => x.id === c.id)
      if (!have) return [...prev, c]
      return (c.updatedAt ?? 0) > (have.updatedAt ?? 0) ? prev.map((x) => (x.id === c.id ? c : x)) : prev
    })
  }, [])

  React.useEffect(() => {
    const sock = openSocket(shareId, "viewer", localStorage.getItem("pc-viewer-name") ?? "Guest", (m) => {
      if (m.type === "presence") setViewers(m.viewers)
      if (m.type === "comment") addComment(m.comment)
    })
    socketRef.current = sock
    return () => sock.close()
  }, [shareId, addComment])

  const setName = React.useCallback((n: string) => {
    localStorage.setItem("pc-viewer-name", n)
    setNameState(n)
    socketRef.current?.hello(n)
  }, [])

  const ctx: ViewerCtx = { shareId, data, name, setName, comments, addComment, viewers, commenting, setCommenting, embed }

  return (
    <ViewerContext.Provider value={ctx}>
      <TooltipProvider delayDuration={250}>
        <div className="relative h-full w-full overflow-hidden bg-[#f6f6f4]">
          <ProductApp id={PRODUCT_ROOT_ID} screen={screen} navigate={setScreen} />
          <StyleInjector />
          {data.config.role === "comment" && <ViewerComments />}
          {!embed && <ViewerChrome />}
          <Toaster position="top-right" offset={16} theme="dark" className="toaster group pc-inverse" />
        </div>
      </TooltipProvider>
    </ViewerContext.Provider>
  )
}
