import * as React from "react"
import { AnimatePresence, motion } from "motion/react"
import { Bell, Copy, GitBranch, GitPullRequestArrow } from "@/lib/icons"
import { toast } from "sonner"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { useTool } from "../store"

const spring = { type: "spring", stiffness: 420, damping: 36 } as const

/* ───────────────────────── Raise PR — coming soon ───────────────────────── */

export function RaisePRCard() {
  const open = useTool((s) => s.prOpen)
  const setOpen = useTool((s) => s.setPrOpen)
  const comments = useTool((s) => s.comments)
  const ops = useTool((s) => s.ops)
  const ref = React.useRef<HTMLDivElement>(null)
  React.useEffect(() => {
    if (!open) return
    const close = (e: PointerEvent) => {
      const t = e.target as HTMLElement
      if (!ref.current?.contains(t) && !t.closest("[data-pc-tool]")) setOpen(false)
    }
    document.addEventListener("pointerdown", close, true)
    return () => document.removeEventListener("pointerdown", close, true)
  }, [open, setOpen])

  const files = [
    { path: "src/components/stat-card.tsx", add: 6, del: 2 },
    { path: "src/components/button.tsx", add: 3, del: 1 },
    { path: "src/app/overview/page.tsx", add: 12, del: 9 },
  ]
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          ref={ref}
          data-pc-tool
          initial={{ opacity: 0, y: 10, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 10, scale: 0.97 }}
          transition={spring}
          className="pc-inverse pc-shadow fixed bottom-[calc(var(--pc-float-bottom)+4px)] left-1/2 z-[58] w-[380px] -translate-x-1/2 overflow-hidden rounded-2xl border border-border/60 bg-popover text-popover-foreground"
        >
          <div className="relative overflow-hidden border-b border-border/70 bg-muted/50 px-4 pb-3 pt-4">
            <div className="absolute -right-6 -top-6 size-28 rounded-full bg-[radial-gradient(circle,color-mix(in_oklab,var(--pc-comment),transparent_75%),transparent_70%)]" />
            <div className="relative flex items-center gap-2">
              <span className="grid size-8 place-items-center rounded-[10px] bg-primary text-primary-foreground">
                <GitPullRequestArrow className="size-4" />
              </span>
              <div className="flex flex-col">
                <span className="text-[14px] font-semibold tracking-[-0.01em]">Raise PR</span>
                <span className="text-[11.5px] text-muted-foreground">Turn your comments into a reviewed pull request</span>
              </div>
              <span className="ml-auto rounded-full bg-[color-mix(in_oklab,var(--pc-comment),transparent_85%)] px-2 py-0.5 text-[10.5px] font-semibold text-[var(--pc-comment)]">Coming soon</span>
            </div>
          </div>
          <div className="flex flex-col gap-2.5 p-4 opacity-80">
            <div className="flex items-center gap-2 text-[12px]">
              <GitBranch className="size-3.5 text-muted-foreground" />
              <span className="font-mono text-[11.5px]">proto/overview-polish</span>
              <span className="text-muted-foreground">→</span>
              <span className="font-mono text-[11.5px] text-muted-foreground">main</span>
            </div>
            <div className="overflow-hidden rounded-xl border border-border">
              {files.map((f) => (
                <div key={f.path} className="flex items-center gap-2 border-b border-border/70 px-3 py-2 text-[11.5px] last:border-b-0">
                  <span className="flex-1 truncate font-mono">{f.path}</span>
                  <span className="font-mono text-emerald-600">+{f.add}</span>
                  <span className="font-mono text-red-500">−{f.del}</span>
                </div>
              ))}
            </div>
            <span className="text-[11.5px] text-muted-foreground">
              Will include {comments.filter((c) => c.status === "open").length} comments and {ops.length} applied edits, each linked back to its pin.
            </span>
          </div>
          <div className="flex items-center justify-end gap-2 border-t border-border/70 bg-muted/40 px-4 py-2.5">
            <button onClick={() => setOpen(false)} className="h-8 rounded-lg px-3 text-[12.5px] font-medium text-muted-foreground hover:bg-muted hover:text-foreground">
              Close
            </button>
            <button
              onClick={() => {
                setOpen(false)
                toast.success("We'll let you know when Raise PR ships")
              }}
              className="flex h-8 items-center gap-1.5 rounded-lg bg-primary px-3 text-[12.5px] font-medium text-primary-foreground hover:opacity-90"
            >
              <Bell className="size-3.5" /> Notify me
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

/* ───────────────────────── shortcuts ───────────────────────── */

const SHORTCUTS: [string, string][] = [
  ["A", "Agent comments mode"],
  ["V", "Variants mode"],
  ["F", "Flow — zoom out to the screen map"],
  ["S", "Share"],
  ["P", "Send / copy to Paper or Figma"],
  ["C", "Copy comments for the agent (selection or all)"],
  ["⇧ Click", "Add element to group"],
  ["Drag", "Marquee-select elements"],
  ["↵", "Submit prompt (⇧↵ new line)"],
  ["⌘Z / ⇧⌘Z", "Undo / redo (apply-to-all is one step)"],
  ["Esc", "Close popover, then exit mode"],
  ["?", "This sheet"],
]

export function ShortcutsDialog() {
  const open = useTool((s) => s.shortcutsOpen)
  const setOpen = useTool((s) => s.setShortcutsOpen)
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="pc-inverse z-[70] max-w-[420px] bg-popover text-popover-foreground">
        <DialogHeader>
          <DialogTitle>Keyboard shortcuts</DialogTitle>
          <DialogDescription>Everything works without leaving the canvas.</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col">
          {SHORTCUTS.map(([k, d]) => (
            <div key={k} className="flex items-center justify-between border-b border-border/60 py-2 text-[13px] last:border-b-0">
              <span className="text-muted-foreground">{d}</span>
              <kbd className="rounded-md border border-border bg-muted px-1.5 py-0.5 font-sans text-[11.5px] font-medium">{k}</kbd>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}
