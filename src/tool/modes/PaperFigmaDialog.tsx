import * as React from "react"
import { AnimatePresence, motion } from "motion/react"
import { ArrowLeft, ArrowRight, Check, Copy, ExternalLink, FilePlus2, Link2, Loader2, RefreshCw, ScanSearch } from "@/lib/icons"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Progress } from "@/components/ui/progress"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { cn } from "@/lib/utils"
import { screenMeta } from "@/product/screens"
import { elInfo, findEl, productRoot } from "../engine/dom"
import { useTool } from "../store"
import { copyForDesignTool, previewDataUrl } from "./paper/capture"

type Dest = "paper" | "figma"
type Step = "compose" | "pick" | "detect" | "progress" | "done"

export function PaperMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" className={cn("size-4", className)} fill="none">
      <path d="M3.5 1.75h6.25L12.5 4.5v9.75H3.5z" fill="currentColor" fillOpacity="0.08" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
      <path d="M9.75 1.75V4.5h2.75" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
      <path d="M5.75 8h4.5M5.75 10.5h3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  )
}

export function FigmaMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" className={cn("size-4", className)}>
      <circle cx="5.5" cy="3.5" r="2.25" fill="currentColor" fillOpacity="0.85" />
      <circle cx="10.5" cy="3.5" r="2.25" fill="currentColor" fillOpacity="0.55" />
      <circle cx="5.5" cy="8" r="2.25" fill="currentColor" fillOpacity="0.7" />
      <circle cx="10.5" cy="8" r="2.25" fill="#8b5cf6" />
      <circle cx="5.5" cy="12.5" r="2.25" fill="currentColor" fillOpacity="0.4" />
    </svg>
  )
}

const FILES = [
  { id: "product", name: "Orbit — Product", edited: "Edited 12 min ago", by: ["PN", "DP", "AK"], color: "#ff6a2b", hasScreen: true },
  { id: "explorations", name: "Orbit — Explorations", edited: "Edited yesterday", by: ["AK", "EP"], color: "#8b5cf6", hasScreen: false },
  { id: "ds", name: "Orbit Design System", edited: "Edited 3 days ago", by: ["DP"], color: "#16171a", hasScreen: false },
]

const AVATAR_BG = ["#ffd9c7", "#d6e4ff", "#d9f2e6", "#f1dcff"]

const PROGRESS_STEPS = (w: number, h: number, layers: number) => [
  { label: "Preparing layers", detail: `${layers} layers` },
  { label: `Uploading ${w}×${h}`, detail: "PNG + HTML" },
  { label: "Mapping tokens", detail: "18 tokens matched" },
  { label: "Done", detail: "" },
]

const slide = {
  initial: { opacity: 0, x: 16 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -16 },
  transition: { duration: 0.18, ease: [0.22, 1, 0.36, 1] as const },
}

export function PaperFigmaDialog() {
  const open = useTool((s) => s.paperOpen)
  const close = useTool((s) => s.closePaper)
  const paperScope = useTool((s) => s.paperScope)
  const selection = useTool((s) => s.selection)
  const screen = useTool((s) => s.screen)
  const ops = useTool((s) => s.ops)
  const comments = useTool((s) => s.comments)
  const variantSets = useTool((s) => s.variantSets)

  const [dest, setDest] = React.useState<Dest>("paper")
  const [scope, setScope] = React.useState<"selection" | "screen">("screen")
  const [step, setStep] = React.useState<Step>("compose")
  const [file, setFile] = React.useState(FILES[0].id)
  const [strategy, setStrategy] = React.useState<"update" | "new">("update")
  const [preview, setPreview] = React.useState<string | null>(null)
  const [copyState, setCopyState] = React.useState<"idle" | "busy" | "done">("idle")
  const [progress, setProgress] = React.useState(0)

  React.useEffect(() => {
    if (!open) return
    setStep("compose")
    setScope(paperScope === "selection" && selection.length ? "selection" : "screen")
    setCopyState("idle")
    setProgress(0)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const targets = React.useCallback((): HTMLElement[] => {
    if (scope === "selection") return selection.map((id) => findEl(id)).filter((e): e is HTMLElement => !!e)
    const root = productRoot()
    return root ? [root] : []
  }, [scope, selection])

  const meta = screenMeta(screen)
  const els = open ? targets() : []
  const first = els[0]
  const name = scope === "screen" ? meta.title : els.length > 1 ? `${els.length} elements` : first ? elInfo(first).name : "Selection"
  const size = React.useMemo(() => {
    if (!els.length) return { w: 0, h: 0 }
    const rs = els.map((e) => e.getBoundingClientRect())
    return { w: Math.round(Math.max(...rs.map((r) => r.width))), h: Math.round(rs.reduce((s, r) => s + r.height, 0) + (rs.length - 1) * 24) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, scope, selection.join("|")])

  // live thumbnail
  React.useEffect(() => {
    if (!open || step !== "compose") return
    let cancelled = false
    let url: string | null = null
    setPreview(null)
    const t = window.setTimeout(async () => {
      const list = targets()
      if (!list.length) return
      try {
        url = await previewDataUrl(list)
        if (!cancelled) setPreview(url)
      } catch {
        /* preview is best-effort */
      }
    }, 180)
    return () => {
      cancelled = true
      window.clearTimeout(t)
      if (url) URL.revokeObjectURL(url)
    }
  }, [open, step, scope, targets])

  const summary = React.useMemo(() => {
    const onScreen = comments.filter((c) => c.screen === screen)
    const ids = new Set(onScreen.flatMap((c) => c.elIds))
    const layers = new Set(ops.filter((o) => ids.has(o.elId)).map((o) => o.elId)).size
    const variants = variantSets.filter((v) => v.screen === screen && v.selected !== "original").length
    return { layers, variants, comments: onScreen.length }
  }, [comments, ops, variantSets, screen])

  const destName = dest === "paper" ? "Paper" : "Figma"
  const fileObj = FILES.find((f) => f.id === file)!
  const exists = scope === "screen" ? fileObj.hasScreen : fileObj.id === "product"

  const copy = async () => {
    const list = targets()
    if (!list.length) return
    setCopyState("busy")
    try {
      await copyForDesignTool(list)
      setCopyState("done")
      toast.success(`Copied — paste into ${destName} (⌘V)`, { description: `${name} · ${size.w}×${size.h}` })
      window.setTimeout(() => setCopyState("idle"), 1800)
    } catch (e) {
      setCopyState("idle")
      toast.error("Couldn't write to the clipboard", { description: e instanceof Error ? e.message : String(e) })
    }
  }

  const run = () => {
    setStep("progress")
    setProgress(0)
    const start = performance.now()
    const total = 2600
    const tick = () => {
      const p = Math.min(100, ((performance.now() - start) / total) * 100)
      setProgress(p)
      if (p < 100) requestAnimationFrame(tick)
      else window.setTimeout(() => setStep("done"), 250)
    }
    requestAnimationFrame(tick)
  }

  const layersCount = Math.max(1, els.reduce((n, e) => n + e.querySelectorAll("*").length, 0))
  const steps = PROGRESS_STEPS(size.w, size.h, layersCount)
  const activeStep = Math.min(steps.length - 1, Math.floor((progress / 100) * (steps.length - 1) + 0.0001))
  const frameName = strategy === "new" && exists ? `${name} (v2)` : name
  const link = `https://${dest === "paper" ? "paper.design" : "www.figma.com"}/file/orbit-${file}#${encodeURIComponent(frameName.toLowerCase().replace(/\s+/g, "-"))}`

  return (
    <Dialog open={open} onOpenChange={(o) => !o && close()}>
      <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-[520px]" data-pc-tool="">
        <DialogHeader className="gap-1 px-5 pb-4 pt-5">
          <div className="flex items-center gap-2.5">
            <span className="relative flex">
              <span className="grid size-7 place-items-center rounded-lg border border-border bg-background text-foreground">
                <PaperMark />
              </span>
              <span className="-ml-2 grid size-7 place-items-center rounded-lg border border-border bg-background text-foreground ring-2 ring-popover">
                <FigmaMark />
              </span>
            </span>
            <DialogTitle className="text-[15px] font-semibold tracking-[-0.01em]">Send to Paper / Figma</DialogTitle>
          </div>
          <DialogDescription className="text-[12.5px]">
            {step === "compose" && "Copy a frame to paste anywhere, or push it straight into a design file."}
            {step === "pick" && `Choose the ${destName} file to send “${name}” to.`}
            {step === "detect" && `Checking ${fileObj.name} for an existing frame.`}
            {step === "progress" && `Sending “${frameName}” to ${destName}…`}
            {step === "done" && `“${frameName}” is in ${fileObj.name}.`}
          </DialogDescription>
        </DialogHeader>

        <div className="relative min-h-[220px] border-t border-border">
          <AnimatePresence mode="wait" initial={false}>
            {step === "compose" && (
              <motion.div key="compose" {...slide} className="flex flex-col gap-4 px-5 py-4">
                <Row label="Destination">
                  <ToggleGroup type="single" variant="outline" size="sm" spacing={0} value={dest} onValueChange={(v) => v && setDest(v as Dest)}>
                    <ToggleGroupItem value="paper" className="gap-1.5 px-3 data-[state=on]:bg-accent">
                      <PaperMark /> Paper
                    </ToggleGroupItem>
                    <ToggleGroupItem value="figma" className="gap-1.5 px-3 data-[state=on]:bg-accent">
                      <FigmaMark /> Figma
                    </ToggleGroupItem>
                  </ToggleGroup>
                </Row>
                <Row label="What to send">
                  <ToggleGroup type="single" variant="outline" size="sm" spacing={0} value={scope} onValueChange={(v) => v && setScope(v as "selection" | "screen")}>
                    <ToggleGroupItem value="selection" disabled={!selection.length} className="gap-1.5 px-3 data-[state=on]:bg-accent">
                      Selection
                      <span className="tabular rounded bg-muted px-1 text-[10.5px] text-muted-foreground">{selection.length}</span>
                    </ToggleGroupItem>
                    <ToggleGroupItem value="screen" className="px-3 data-[state=on]:bg-accent">
                      Entire screen
                    </ToggleGroupItem>
                  </ToggleGroup>
                </Row>

                <div className="flex flex-col gap-2">
                  <div
                    className="relative grid h-[210px] place-items-center overflow-hidden rounded-lg border border-border"
                    style={{
                      backgroundColor: "var(--background)",
                      backgroundImage:
                        "linear-gradient(45deg, var(--muted) 25%, transparent 25%), linear-gradient(-45deg, var(--muted) 25%, transparent 25%), linear-gradient(45deg, transparent 75%, var(--muted) 75%), linear-gradient(-45deg, transparent 75%, var(--muted) 75%)",
                      backgroundSize: "14px 14px",
                      backgroundPosition: "0 0, 0 7px, 7px -7px, -7px 0",
                    }}
                  >
                    <AnimatePresence mode="wait">
                      {preview ? (
                        <motion.img
                          key={preview}
                          src={preview}
                          alt={`Preview of ${name}`}
                          className="max-h-[184px] max-w-[440px] rounded-[3px] object-contain shadow-[0_1px_2px_rgb(0_0_0/0.08),0_8px_24px_-8px_rgb(0_0_0/0.25)]"
                          initial={{ opacity: 0, scale: 0.98 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0 }}
                          transition={{ duration: 0.2 }}
                        />
                      ) : (
                        <motion.div key="loading" className="flex items-center gap-2 text-[12px] text-muted-foreground" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                          <Loader2 className="size-3.5 animate-spin" /> Rendering preview…
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                  <div className="flex items-center justify-between text-[12px]">
                    <span className="truncate font-medium text-foreground">{name}</span>
                    <span className="tabular text-muted-foreground">
                      {size.w} × {size.h}
                    </span>
                  </div>
                </div>
              </motion.div>
            )}

            {step === "pick" && (
              <motion.div key="pick" {...slide} className="flex flex-col gap-1.5 px-3 py-3">
                {FILES.map((f) => {
                  const on = f.id === file
                  return (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => setFile(f.id)}
                      className={cn(
                        "flex items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors",
                        on ? "border-foreground/20 bg-accent" : "border-transparent hover:bg-accent/60",
                      )}
                    >
                      <span className="grid size-9 place-items-center rounded-md text-white" style={{ background: f.color }}>
                        {dest === "paper" ? <PaperMark className="text-white" /> : <FigmaMark className="text-white" />}
                      </span>
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className="truncate text-[13px] font-medium text-foreground">{f.name}</span>
                        <span className="text-[11.5px] text-muted-foreground">{f.edited}</span>
                      </span>
                      <span className="flex -space-x-1.5">
                        {f.by.map((b, i) => (
                          <span
                            key={b}
                            className="grid size-5 place-items-center rounded-full text-[8.5px] font-semibold text-[#16171a]/80 ring-2 ring-popover"
                            style={{ background: AVATAR_BG[i % AVATAR_BG.length] }}
                          >
                            {b}
                          </span>
                        ))}
                      </span>
                      <span className={cn("ml-1 grid size-4 place-items-center rounded-full border", on ? "border-foreground bg-foreground text-background" : "border-border")}>
                        {on && <Check className="size-2.5" strokeWidth={3} />}
                      </span>
                    </button>
                  )
                })}
              </motion.div>
            )}

            {step === "detect" && (
              <motion.div key="detect" {...slide} className="flex flex-col gap-3 px-5 py-4">
                <div className={cn("flex items-start gap-2.5 rounded-lg border px-3 py-2.5 text-[12.5px]", exists ? "border-[#3b82f6]/25 bg-[#3b82f6]/[0.06]" : "border-border bg-muted/50")}>
                  <ScanSearch className={cn("mt-px size-4 shrink-0", exists ? "text-[#3b82f6]" : "text-muted-foreground")} />
                  <span className="text-foreground">
                    {exists ? (
                      scope === "screen" ? (
                        <>
                          <b className="font-semibold">‘{name}’</b> already exists in {fileObj.name}.
                        </>
                      ) : (
                        <>
                          A frame named <b className="font-semibold">‘{name}’</b> exists in {fileObj.name}.
                        </>
                      )
                    ) : (
                      <>
                        No frame named ‘{name}’ in {fileObj.name} — a new frame will be created.
                      </>
                    )}
                  </span>
                </div>
                {exists && (
                  <div className="grid gap-2">
                    <Choice
                      on={strategy === "update"}
                      onClick={() => setStrategy("update")}
                      icon={<RefreshCw className="size-4" />}
                      title="Update existing frame"
                      badge="Recommended"
                      detail={
                        summary.layers || summary.variants
                          ? `${summary.layers} ${summary.layers === 1 ? "layer" : "layers"} changed · ${summary.variants} ${summary.variants === 1 ? "variant" : "variants"} · ${summary.comments} comments`
                          : "No local edits — the frame will be refreshed from the prototype"
                      }
                    />
                    <Choice
                      on={strategy === "new"}
                      onClick={() => setStrategy("new")}
                      icon={<FilePlus2 className="size-4" />}
                      title="Create new frame"
                      detail={`‘${name} (v2)’ placed next to the original`}
                    />
                  </div>
                )}
              </motion.div>
            )}

            {step === "progress" && (
              <motion.div key="progress" {...slide} className="flex flex-col gap-4 px-5 py-5">
                <div className="flex flex-col gap-2.5">
                  {steps.map((s, i) => {
                    const done = i < activeStep || progress >= 100
                    const active = i === activeStep && progress < 100
                    return (
                      <div key={s.label} className="flex items-center gap-2.5 text-[13px]">
                        <span
                          className={cn(
                            "grid size-5 place-items-center rounded-full border transition-colors",
                            done ? "border-foreground bg-foreground text-background" : active ? "border-foreground/30" : "border-border",
                          )}
                        >
                          {done ? <Check className="size-3" strokeWidth={3} /> : active ? <Loader2 className="size-3 animate-spin" /> : null}
                        </span>
                        <span className={cn("flex-1", done || active ? "text-foreground" : "text-muted-foreground")}>{s.label}</span>
                        {s.detail && <span className="text-[12px] text-muted-foreground">{s.detail}</span>}
                      </div>
                    )
                  })}
                </div>
                <div className="flex flex-col gap-1.5">
                  <Progress value={progress} className="h-1.5" />
                  <div className="flex justify-between text-[11.5px] text-muted-foreground">
                    <span>
                      {fileObj.name} · {frameName}
                    </span>
                    <span className="tabular">{Math.round(progress)}%</span>
                  </div>
                </div>
              </motion.div>
            )}

            {step === "done" && (
              <motion.div key="done" {...slide} className="flex flex-col items-center gap-3 px-5 py-7 text-center">
                <motion.span
                  className="grid size-12 place-items-center rounded-full bg-[#10b981]/12 text-[#10b981]"
                  initial={{ scale: 0.6, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: "spring", stiffness: 380, damping: 18 }}
                >
                  <svg viewBox="0 0 24 24" className="size-6" fill="none">
                    <motion.path
                      d="M5 12.5l4.5 4.5L19 7.5"
                      stroke="currentColor"
                      strokeWidth="2.4"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      initial={{ pathLength: 0 }}
                      animate={{ pathLength: 1 }}
                      transition={{ delay: 0.12, duration: 0.35, ease: "easeOut" }}
                    />
                  </svg>
                </motion.span>
                <div className="flex flex-col gap-1">
                  <span className="text-[15px] font-semibold tracking-[-0.01em] text-foreground">
                    {exists && strategy === "update" ? "Frame updated" : "Frame created"}
                  </span>
                  <span className="text-[12.5px] text-muted-foreground">
                    ‘{frameName}’ · {size.w}×{size.h} · {fileObj.name}
                  </span>
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <Button
                    variant="outline"
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(link)
                        toast.success("Link copied")
                      } catch {
                        toast.error("Couldn't copy the link")
                      }
                    }}
                  >
                    <Link2 /> Copy link
                  </Button>
                  <Button onClick={() => window.open(dest === "paper" ? "https://paper.design" : "https://www.figma.com", "_blank", "noopener")}>
                    Open in {destName} <ExternalLink />
                  </Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="flex items-center justify-between gap-2 border-t border-border bg-muted/40 px-5 py-3">
          {step === "compose" ? (
            <>
              <Button variant="outline" onClick={copy} disabled={copyState === "busy" || !els.length}>
                {copyState === "busy" ? <Loader2 className="animate-spin" /> : copyState === "done" ? <Check /> : <Copy />}
                {copyState === "done" ? "Copied" : "Copy to clipboard"}
              </Button>
              <Button onClick={() => setStep("pick")} disabled={!els.length}>
                Send to {destName} <ArrowRight />
              </Button>
            </>
          ) : step === "pick" ? (
            <>
              <Button variant="ghost" onClick={() => setStep("compose")}>
                <ArrowLeft /> Back
              </Button>
              <Button onClick={() => setStep("detect")}>
                Continue <ArrowRight />
              </Button>
            </>
          ) : step === "detect" ? (
            <>
              <Button variant="ghost" onClick={() => setStep("pick")}>
                <ArrowLeft /> Back
              </Button>
              <Button onClick={run}>{exists && strategy === "update" ? "Update frame" : "Create frame"}</Button>
            </>
          ) : step === "progress" ? (
            <>
              <span className="text-[12px] text-muted-foreground">Keep this open — it only takes a moment.</span>
              <Button variant="ghost" disabled>
                <Loader2 className="animate-spin" /> Sending
              </Button>
            </>
          ) : (
            <>
              <Button variant="ghost" onClick={() => setStep("compose")}>
                Send another
              </Button>
              <Button variant="outline" onClick={close}>
                Done
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-[12.5px] font-medium text-muted-foreground">{label}</span>
      {children}
    </div>
  )
}

function Choice({
  on,
  onClick,
  icon,
  title,
  detail,
  badge,
}: {
  on: boolean
  onClick: () => void
  icon: React.ReactNode
  title: string
  detail: string
  badge?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-start gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors",
        on ? "border-foreground/25 bg-accent" : "border-border hover:bg-accent/50",
      )}
    >
      <span className={cn("mt-0.5", on ? "text-foreground" : "text-muted-foreground")}>{icon}</span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="flex items-center gap-2 text-[13px] font-medium text-foreground">
          {title}
          {badge && (
            <Badge variant="secondary" className="h-4 px-1.5 text-[10px]">
              {badge}
            </Badge>
          )}
        </span>
        <span className="text-[12px] text-muted-foreground">{detail}</span>
      </span>
      <span className={cn("mt-0.5 grid size-4 place-items-center rounded-full border", on ? "border-foreground bg-foreground text-background" : "border-border")}>
        {on && <Check className="size-2.5" strokeWidth={3} />}
      </span>
    </button>
  )
}
