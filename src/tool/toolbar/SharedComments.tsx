import * as React from "react"
import { AnimatePresence, motion } from "motion/react"
import { Check, MessagesSquare, Share, Sparkles, X } from "@/lib/icons"
import { cn } from "@/lib/utils"
import { screenMeta } from "@/product/screens"
import { useLiveBoxes } from "../overlay/geometry"
import { jumpToShared, replyToShared, sendSharedToAgent, toggleSharedResolved } from "../share/actions"
import { useShareViewers } from "../share/useShareSync"
import { SIDEBAR_W, useTool } from "../store"
import type { Comment } from "../types"
import { DockToggle, panelShell } from "./DockToggle"

const EASE = [0.22, 1, 0.36, 1] as const

/**
 * Comments from people you shared a link with (not agent comments — those live as pins and go out
 * with C). Docks as a sidebar or floats, like the variants panel. Replies and resolves sync live
 * to the share link.
 */
export function SharedCommentsSidebar() {
  const open = useTool((s) => s.commentsOpen && s.mode !== "flow")
  const layout = useTool((s) => s.commentsLayout)
  const setLayout = useTool((s) => s.setCommentsLayout)
  const comments = useTool((s) => s.comments)
  const setOpen = useTool((s) => s.setCommentsOpen)
  const viewers = useShareViewers()
  const [filter, setFilter] = React.useState<"open" | "resolved">("open")
  const [flash, setFlash] = React.useState<string | null>(null)
  const shared = comments.filter((c) => c.source === "viewer")
  const list = shared.filter((c) => c.status === filter).sort((a, b) => b.createdAt - a.createdAt)
  const docked = layout === "sidebar"

  React.useEffect(() => {
    if (!flash) return
    const t = window.setTimeout(() => setFlash(null), 1400)
    return () => window.clearTimeout(t)
  }, [flash])

  return (
    <>
      <FlashOutline id={flash} />
      <AnimatePresence>
        {open && (
          <motion.aside
            key="shared-comments"
            data-pc-tool
            initial={{ x: SIDEBAR_W + 24, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: SIDEBAR_W + 24, opacity: 0, transition: { duration: 0.18, ease: [0.4, 0, 1, 1] } }}
            transition={{ duration: 0.24, ease: EASE }}
            style={{ width: SIDEBAR_W, willChange: "transform" }}
            className={cn(
              "pc-inverse fixed z-[50] flex flex-col overflow-hidden bg-popover text-popover-foreground transition-[top,right,bottom,border-radius] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]",
              panelShell(docked),
            )}
          >
            <div className="flex h-14 shrink-0 items-center gap-2 border-b border-border/70 pl-4 pr-2.5">
              <span className="min-w-0 flex-1 truncate text-[14px] font-semibold tracking-[-0.01em]">Comments</span>
              {viewers > 0 && (
                <span className="flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-600">
                  <span className="size-1.5 animate-pulse rounded-full bg-emerald-500" /> {viewers} viewing
                </span>
              )}
              <DockToggle layout={layout} onChange={setLayout} />
              <button onClick={() => setOpen(false)} className="grid size-7 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground" aria-label="Close">
                <X className="size-4" />
              </button>
            </div>

            <div className="flex gap-1 px-3 pt-2.5">
              {(["open", "resolved"] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={cn("h-7 rounded-lg px-2.5 text-[12px] font-medium capitalize transition-colors", filter === f ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground")}
                >
                  {f}
                  <span className="ml-1 tabular-nums opacity-60">{shared.filter((c) => c.status === f).length}</span>
                </button>
              ))}
            </div>

            <div className="no-scrollbar flex-1 overflow-y-auto px-3 pb-3 pt-2">
              {list.length === 0 ? (
                <Empty resolved={filter === "resolved"} hasAny={shared.length > 0} />
              ) : (
                <div className="flex flex-col gap-2">
                  <AnimatePresence initial={false}>
                    {list.map((c) => (
                      <SharedCard
                        key={c.id}
                        c={c}
                        onJump={() => {
                          jumpToShared(c)
                          setFlash(c.elIds[0] ?? null)
                        }}
                      />
                    ))}
                  </AnimatePresence>
                </div>
              )}
            </div>
          </motion.aside>
        )}
      </AnimatePresence>
    </>
  )
}

function SharedCard({ c, onJump }: { c: Comment; onJump: () => void }) {
  const [replying, setReplying] = React.useState(false)
  const [text, setText] = React.useState("")
  const ref = React.useRef<HTMLTextAreaElement>(null)
  const resolved = c.status === "resolved"
  const send = () => {
    replyToShared(c.id, text)
    setText("")
    setReplying(false)
  }
  return (
    <motion.div
      layout="position"
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, height: 0, marginTop: 0 }}
      transition={{ duration: 0.2, ease: EASE }}
      onClick={onJump}
      className={cn("group cursor-pointer rounded-xl border border-border bg-background p-3 transition-colors hover:border-[color-mix(in_oklab,var(--pc-comment),transparent_55%)]", resolved && "opacity-70")}
    >
      <div className="flex items-center gap-2">
        <Initials name={c.author} />
        <span className="truncate text-[13px] font-semibold">{c.author}</span>
        <span className="shrink-0 text-[11.5px] text-muted-foreground">{timeAgo(c.createdAt)}</span>
        <button
          onClick={(e) => {
            e.stopPropagation()
            toggleSharedResolved(c.id)
          }}
          aria-label={resolved ? "Reopen" : "Resolve"}
          title={resolved ? "Reopen" : "Resolve"}
          className={cn(
            "ml-auto grid size-6 place-items-center rounded-full transition-colors [&_svg]:size-3.5",
            resolved ? "bg-emerald-500 text-white" : "text-muted-foreground hover:bg-muted hover:text-foreground",
          )}
        >
          <Check />
        </button>
      </div>
      <p className="mt-1.5 whitespace-pre-wrap text-[13px] leading-[1.45]">{c.text}</p>
      <span className="mt-1 block truncate text-[11.5px] text-muted-foreground">
        {screenMeta(c.screen).title} · {c.elNames[0] ?? "Page"}
      </span>

      {(c.replies?.length ?? 0) > 0 && (
        <div className="mt-2.5 flex flex-col gap-2 border-l-2 border-border pl-2.5">
          {c.replies!.map((r) => (
            <div key={r.id} className="flex flex-col gap-0.5">
              <span className="flex items-center gap-1.5 text-[11.5px]">
                <span className="font-semibold">{r.author}</span>
                {r.owner && <span className="rounded bg-[color-mix(in_oklab,var(--pc-comment),transparent_88%)] px-1 text-[10px] font-medium text-[var(--pc-comment)]">You</span>}
                <span className="text-muted-foreground">{timeAgo(r.createdAt)}</span>
              </span>
              <span className="whitespace-pre-wrap text-[12.5px] leading-snug">{r.text}</span>
            </div>
          ))}
        </div>
      )}

      <AnimatePresence initial={false}>
        {replying ? (
          <motion.div
            key="reply"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2, ease: EASE }}
            className="overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex flex-col gap-2 pt-2.5">
              <textarea
                ref={ref}
                autoFocus
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => {
                  e.stopPropagation()
                  if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) (e.preventDefault(), send())
                  if (e.key === "Escape") setReplying(false)
                }}
                placeholder={`Reply to ${c.author.split(" ")[0]}…`}
                className="h-[60px] w-full resize-none rounded-lg border border-border bg-background px-2.5 py-2 text-[12.5px] outline-none transition-[border-color,box-shadow] placeholder:text-muted-foreground focus:border-[var(--pc-comment)] focus:shadow-[0_0_0_0.5px_var(--pc-comment)]"
              />
              <div className="flex justify-end gap-1.5">
                <button onClick={() => setReplying(false)} className="h-6 rounded-full bg-muted px-3 text-[12px] font-medium text-foreground/80 hover:bg-accent">
                  Cancel
                </button>
                <button onClick={send} disabled={!text.trim()} className="h-6 rounded-full bg-[var(--pc-comment)] px-3.5 text-[12px] font-medium text-white transition-opacity disabled:opacity-45">
                  Reply
                </button>
              </div>
            </div>
          </motion.div>
        ) : (
          <motion.div key="actions" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="mt-2.5 flex items-center gap-1.5">
            <Pill
              onClick={() => {
                setReplying(true)
                requestAnimationFrame(() => ref.current?.focus())
              }}
            >
              Reply
            </Pill>
            {c.elIds.length > 0 && (
              <Pill onClick={() => sendSharedToAgent(c)}>
                <Sparkles className="size-3 text-[var(--pc-comment)]" /> Send to agent
              </Pill>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

function Pill({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={(e) => {
        e.stopPropagation()
        onClick()
      }}
      className="flex h-6 items-center gap-1 rounded-full border border-border px-2.5 text-[11.5px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
    >
      {children}
    </button>
  )
}

function Empty({ resolved, hasAny }: { resolved: boolean; hasAny: boolean }) {
  return (
    <div className="flex flex-col items-center gap-2 px-6 pt-16 text-center">
      <div className="grid size-10 place-items-center rounded-xl bg-muted">
        <MessagesSquare className="size-5 text-muted-foreground" />
      </div>
      <span className="text-[13px] font-medium">{resolved ? "Nothing resolved yet" : hasAny ? "All caught up" : "No comments yet"}</span>
      {!resolved && !hasAny && (
        <>
          <span className="text-[12px] leading-relaxed text-muted-foreground">Share a link and comments from people viewing it show up here live.</span>
          <button
            onClick={() => useTool.getState().setShareOpen(true)}
            className="mt-1 flex h-7 items-center gap-1.5 rounded-full bg-[var(--pc-comment)] px-3 text-[12px] font-medium text-white [&_svg]:size-3.5"
          >
            <Share /> Share
          </button>
        </>
      )}
    </div>
  )
}

/** Brief outline on the element a comment points at, after jumping to it. */
function FlashOutline({ id }: { id: string | null }) {
  const boxes = useLiveBoxes(id ? [id] : [])
  const b = id ? boxes[id] : undefined
  return (
    <AnimatePresence>
      {b && (
        <motion.div
          key={id}
          className="pointer-events-none fixed z-[41] rounded-md"
          style={{ left: b.x - 4, top: b.y - 4, width: b.w + 8, height: b.h + 8, outline: "2px solid var(--pc-comment)", background: "color-mix(in oklab, var(--pc-comment), transparent 90%)" }}
          initial={{ opacity: 0, scale: 1.04 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25, ease: EASE }}
        />
      )}
    </AnimatePresence>
  )
}

function Initials({ name }: { name: string }) {
  const ini = name
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase()
  return <span className="grid size-6 shrink-0 place-items-center rounded-full bg-[color-mix(in_oklab,var(--pc-comment),transparent_85%)] text-[10px] font-semibold text-[var(--pc-comment)]">{ini}</span>
}

function timeAgo(t: number) {
  const s = Math.max(1, Math.round((Date.now() - t) / 1000))
  if (s < 60) return "now"
  if (s < 3600) return `${Math.round(s / 60)}m`
  if (s < 86400) return `${Math.round(s / 3600)}h`
  return `${Math.round(s / 86400)}d`
}
