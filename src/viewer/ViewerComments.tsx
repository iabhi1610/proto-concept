import * as React from "react"
import { AnimatePresence, motion } from "motion/react"
import { autoUpdate, flip, offset, shift, useFloating } from "@floating-ui/react"
import { ArrowUp, X } from "@/lib/icons"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { elInfo, findEl, inspectableFrom, productRoot } from "@/tool/engine/dom"
import { DashedOutline } from "@/tool/overlay/DashedOutline"
import { useLiveBox, useLiveBoxes } from "@/tool/overlay/geometry"
import { postComment } from "@/tool/share/client"
import { uid, useTool } from "@/tool/store"
import type { Comment } from "@/tool/types"
import { useViewer } from "./Viewer"

const BLUE = "#0088FF"

interface Draft {
  elId: string
  anchor: { x: number; y: number }
}

export function ViewerComments() {
  const { commenting, setCommenting, comments } = useViewer()
  const screen = useTool((s) => s.screen)
  const [hoverId, setHoverId] = React.useState<string | null>(null)
  const [draft, setDraft] = React.useState<Draft | null>(null)
  const [peek, setPeek] = React.useState<string | null>(null)

  // Capture-phase interception: in comment mode the product doesn't react to clicks.
  React.useEffect(() => {
    if (!commenting) {
      setHoverId(null)
      return
    }
    const onMove = (e: PointerEvent) => {
      const el = inspectableFrom(e.target)
      setHoverId(el?.dataset.pcId ?? null)
    }
    const block = (e: Event) => {
      const root = productRoot()
      if (root && e.target instanceof Node && root.contains(e.target)) {
        e.preventDefault()
        e.stopPropagation()
      }
    }
    const onClick = (e: MouseEvent) => {
      const root = productRoot()
      if (!root || !(e.target instanceof Node) || !root.contains(e.target)) return
      e.preventDefault()
      e.stopPropagation()
      const el = inspectableFrom(e.target)
      if (!el) {
        setDraft(null)
        return
      }
      const r = el.getBoundingClientRect()
      setDraft({
        elId: el.dataset.pcId!,
        anchor: { x: Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)), y: Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)) },
      })
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (draft) setDraft(null)
        else setCommenting(false)
      }
    }
    document.addEventListener("pointermove", onMove, true)
    document.addEventListener("pointerdown", block, true)
    document.addEventListener("mousedown", block, true)
    document.addEventListener("click", onClick, true)
    document.addEventListener("keydown", onKey)
    return () => {
      document.removeEventListener("pointermove", onMove, true)
      document.removeEventListener("pointerdown", block, true)
      document.removeEventListener("mousedown", block, true)
      document.removeEventListener("click", onClick, true)
      document.removeEventListener("keydown", onKey)
    }
  }, [commenting, draft, setCommenting])

  React.useEffect(() => {
    if (!commenting) setDraft(null)
  }, [commenting])
  React.useEffect(() => setDraft(null), [screen])

  const onScreen = comments.filter((c) => c.screen === screen && c.elIds[0])
  const numbered = comments.map((c, i) => ({ ...c, number: i + 1 }))
  const boxes = useLiveBoxes(onScreen.map((c) => c.elIds[0]))
  const hoverBox = useLiveBox(commenting && hoverId !== draft?.elId ? hoverId : null)
  const hoverEl = hoverId ? findEl(hoverId) : null

  return (
    <>
      {/* hover outline */}
      {commenting && hoverBox && hoverEl && (
        <div className="pointer-events-none fixed z-30" style={{ left: hoverBox.x, top: hoverBox.y, width: hoverBox.w, height: hoverBox.h }}>
          <div className="absolute inset-0 rounded-[3px]" style={{ background: "rgb(59 130 246 / 0.04)" }}>
            <DashedOutline color={BLUE} width={1} inside />
          </div>
          <span
            className="absolute -top-[22px] left-0 whitespace-nowrap rounded-[5px] px-1.5 py-0.5 text-[11px] font-medium text-white shadow-sm"
            style={{ background: BLUE }}
          >
            {elInfo(hoverEl).name}
          </span>
        </div>
      )}

      {/* pins */}
      {commenting && (
        <div className="pointer-events-none fixed inset-0 z-30">
          <AnimatePresence>
            {onScreen.map((c) => {
              const b = boxes[c.elIds[0]]
              if (!b) return null
              const n = numbered.find((x) => x.id === c.id)!.number
              const ax = c.anchor?.x ?? 1
              const ay = c.anchor?.y ?? 0
              return (
                <motion.div
                  key={c.id}
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0, opacity: 0 }}
                  transition={{ type: "spring", stiffness: 520, damping: 26 }}
                  className="pointer-events-auto absolute"
                  style={{ left: b.x + b.w * ax - 11, top: b.y + b.h * ay - 11 }}
                  onPointerEnter={() => setPeek(c.id)}
                  onPointerLeave={() => setPeek((p) => (p === c.id ? null : p))}
                >
                  <span
                    className={cn(
                      "tabular grid size-[22px] cursor-default place-items-center rounded-full border-2 border-white text-[11px] font-semibold text-white shadow-[0_2px_6px_rgb(0_0_0/0.25)]",
                      c.status === "resolved" && "opacity-50",
                    )}
                    style={{ background: BLUE }}
                  >
                    {n}
                  </span>
                  <AnimatePresence>
                    {peek === c.id && (
                      <motion.div
                        initial={{ opacity: 0, y: 4, scale: 0.97 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 4, scale: 0.97 }}
                        transition={{ duration: 0.14 }}
                        className="pc-shadow absolute left-7 top-0 w-[240px] rounded-xl bg-popover p-3 text-popover-foreground"
                      >
                        <div className="flex items-center gap-2">
                          <Initials name={c.author} />
                          <span className="text-[12.5px] font-semibold">{c.author}</span>
                          <span className="ml-auto text-[11px] text-muted-foreground">{timeAgo(c.createdAt)}</span>
                        </div>
                        <p className="mt-1.5 whitespace-pre-wrap text-[12.5px] leading-relaxed text-foreground">{c.text}</p>
                        <span className="mt-1.5 block truncate text-[11px] text-muted-foreground">
                          on {c.elNames[0]}
                          {c.status === "resolved" && <span className="ml-1.5 rounded bg-emerald-500/12 px-1 font-medium text-emerald-600">Resolved</span>}
                        </span>
                        {/* the owner's replies arrive live over the share socket */}
                        {(c.replies?.length ?? 0) > 0 && (
                          <div className="mt-2 flex flex-col gap-1.5 border-l-2 border-border pl-2">
                            {c.replies!.map((r) => (
                              <div key={r.id} className="flex flex-col">
                                <span className="text-[11px] font-semibold">
                                  {r.author}
                                  {r.owner && <span className="ml-1 font-normal text-muted-foreground">· owner</span>}
                                </span>
                                <span className="whitespace-pre-wrap text-[12px] leading-snug">{r.text}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              )
            })}
          </AnimatePresence>
        </div>
      )}

      {/* draft pin + composer */}
      <AnimatePresence>{draft && <Composer key={draft.elId + draft.anchor.x} draft={draft} nextNumber={comments.length + 1} onClose={() => setDraft(null)} />}</AnimatePresence>
    </>
  )
}

function Composer({ draft, nextNumber, onClose }: { draft: Draft; nextNumber: number; onClose: () => void }) {
  const { shareId, name, setName, addComment } = useViewer()
  const box = useLiveBox(draft.elId)
  const el = findEl(draft.elId)
  const [text, setText] = React.useState("")
  const [asking, setAsking] = React.useState(false)
  const [busy, setBusy] = React.useState(false)
  const taRef = React.useRef<HTMLTextAreaElement>(null)

  const { refs, floatingStyles } = useFloating({
    placement: "right-start",
    strategy: "fixed",
    middleware: [offset(14), flip({ fallbackPlacements: ["left-start", "bottom-start", "top-start"] }), shift({ padding: 12 })],
    whileElementsMounted: (ref, fl, update) => autoUpdate(ref, fl, update, { animationFrame: true }),
  })

  React.useLayoutEffect(() => {
    if (el) refs.setReference(el)
  }, [el, refs])
  const ready = !!box && !!el
  React.useEffect(() => {
    if (ready) requestAnimationFrame(() => taRef.current?.focus())
  }, [ready])

  const submit = async (author = name) => {
    if (!text.trim() || !el) return
    if (!author) {
      setAsking(true)
      return
    }
    setBusy(true)
    const info = elInfo(el)
    const comment: Comment = {
      id: uid("vc"),
      number: nextNumber,
      screen: useTool.getState().screen,
      elIds: [draft.elId],
      elNames: [info.name],
      text: text.trim(),
      states: [el.dataset.pcRest ?? "default"],
      allStates: false,
      kind: "note",
      applied: [],
      unparsed: [],
      warnings: [],
      status: "open",
      author,
      source: "viewer",
      createdAt: Date.now(),
      anchor: draft.anchor,
      shareId,
    }
    try {
      addComment(comment)
      await postComment(shareId, comment)
      toast.success("Comment sent", { description: "The designer sees it live." })
      onClose()
    } catch {
      toast.error("Couldn't send comment — check your connection")
    } finally {
      setBusy(false)
    }
  }

  if (!box || !el) return null
  return (
    <>
      <motion.span
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        exit={{ scale: 0 }}
        transition={{ type: "spring", stiffness: 520, damping: 26 }}
        className="pointer-events-none fixed z-40 grid size-[22px] place-items-center rounded-full border-2 border-white text-[11px] font-semibold text-white shadow-[0_2px_6px_rgb(0_0_0/0.25)]"
        style={{ left: box.x + box.w * draft.anchor.x - 11, top: box.y + box.h * draft.anchor.y - 11, background: BLUE }}
      >
        {nextNumber}
      </motion.span>
      <div className="pointer-events-none fixed z-30 rounded-[3px] border-[1.5px]" style={{ left: box.x, top: box.y, width: box.w, height: box.h, borderColor: BLUE }} />
      <div ref={refs.setFloating} style={floatingStyles} className="z-50" data-pc-tool>
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 4 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 4 }}
          transition={{ type: "spring", stiffness: 500, damping: 34 }}
          className="pc-shadow w-[300px] rounded-2xl bg-popover p-3 text-popover-foreground"
        >
          <div className="mb-2 flex items-center gap-2">
            <span className="min-w-0 flex-1 truncate text-[12px] font-medium text-muted-foreground">{elInfo(el).name}</span>
            <button type="button" onClick={onClose} className="grid size-6 place-items-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground" aria-label="Cancel">
              <X className="size-3.5" />
            </button>
          </div>
          <div className="flex items-end gap-2 rounded-xl border border-input bg-background px-3 py-2 focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/30">
            <textarea
              ref={taRef}
              value={text}
              rows={2}
              onChange={(e) => {
                setText(e.target.value)
                e.target.style.height = "auto"
                e.target.style.height = `${Math.min(140, e.target.scrollHeight)}px`
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey || !e.shiftKey)) {
                  e.preventDefault()
                  submit()
                }
                if (e.key === "Escape") onClose()
              }}
              placeholder="Leave feedback on this element…"
              className="min-h-10 flex-1 resize-none bg-transparent text-[13px] leading-relaxed outline-none placeholder:text-muted-foreground"
            />
            <button
              type="button"
              disabled={!text.trim() || busy}
              onClick={() => submit()}
              className="grid size-7 shrink-0 place-items-center rounded-full text-white transition-opacity disabled:opacity-35"
              style={{ background: BLUE }}
              aria-label="Send comment"
            >
              <ArrowUp className="size-4" strokeWidth={2.5} />
            </button>
          </div>
          <div className="mt-2 flex items-center justify-between text-[11px] text-muted-foreground">
            <span>{name ? `Commenting as ${name}` : "You'll be asked for your name"}</span>
            <span>↵ to send</span>
          </div>
        </motion.div>
      </div>
      <NameDialog
        open={asking}
        onCancel={() => setAsking(false)}
        onSave={(n) => {
          setName(n)
          setAsking(false)
          submit(n)
        }}
      />
    </>
  )
}

function NameDialog({ open, onCancel, onSave }: { open: boolean; onCancel: () => void; onSave: (n: string) => void }) {
  const [value, setValue] = React.useState("")
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onCancel()}>
      <DialogContent className="sm:max-w-[360px]" showCloseButton={false}>
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault()
            if (value.trim()) onSave(value.trim())
          }}
        >
          <div className="flex flex-col gap-1">
            <DialogTitle className="text-[15px] font-semibold">What's your name?</DialogTitle>
            <DialogDescription className="text-[12.5px]">So the designer knows who left this feedback.</DialogDescription>
          </div>
          <Input autoFocus value={value} onChange={(e) => setValue(e.target.value)} placeholder="e.g. Maya Chen" className="h-9 text-[13px] md:text-[13px]" />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={onCancel}>
              Cancel
            </Button>
            <Button type="submit" disabled={!value.trim()}>
              Post comment
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function Initials({ name }: { name: string }) {
  const i = name
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase()
  return <span className="grid size-5 place-items-center rounded-full bg-[color-mix(in_oklab,#3b82f6,white_80%)] text-[9.5px] font-semibold text-[#1d4ed8]">{i}</span>
}

function timeAgo(t: number) {
  const s = Math.round((Date.now() - t) / 1000)
  if (s < 45) return "just now"
  if (s < 3600) return `${Math.round(s / 60)}m`
  if (s < 86400) return `${Math.round(s / 3600)}h`
  return `${Math.round(s / 86400)}d`
}
