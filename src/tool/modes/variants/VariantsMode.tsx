import * as React from "react"
import { AnimatePresence, motion } from "motion/react"
import { ArrowLeft, Check, ChevronDown, Copy, Ellipsis, ImageGlyph, Plus, RefreshCw, Search, Trash2, Wand2, X } from "@/lib/icons"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import { screenMeta } from "@/product/screens"
import { chooseVariant, deleteVariantOption, letterFor } from "../../actions"
import { buildVariantsPrompt, copyText } from "../../copy"
import { findEl } from "../../engine/dom"
import { detectVariantIntent } from "../../engine/intent"
import { SIDEBAR_W, useTool } from "../../store"
import { DockToggle, panelShell } from "../../toolbar/DockToggle"
import type { VariantSet } from "../../types"
import { previewHeights, VariantPreview } from "./VariantPreview"

const spring = { type: "spring", stiffness: 380, damping: 34 } as const

export function VariantsMode() {
  const mode = useTool((s) => s.mode)
  return (
    <AnimatePresence>
      {mode === "variants" && (
        <VariantSheet key="sheet" />
      )}
    </AnimatePresence>
  )
}

/* ───────────────────────── right sidebar with previews ───────────────────────── */

function VariantSheet() {
  const activeSetId = useTool((s) => s.activeSetId)
  const sets = useTool((s) => s.variantSets)
  const openSet = useTool((s) => s.openSet)
  const setPreviewOption = useTool((s) => s.setPreviewOption)
  const set = sets.find((s) => s.id === activeSetId)
  const layout = useTool((s) => s.variantLayout)
  const docked = layout === "sidebar"

  React.useEffect(() => () => setPreviewOption(null), [setPreviewOption])

  return (
    <AnimatePresence>
      {set && (
        <motion.aside
          key="variant-sheet"
          data-pc-tool
          initial={{ x: SIDEBAR_W + 24, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: SIDEBAR_W + 24, opacity: 0, transition: { duration: 0.18, ease: [0.4, 0, 1, 1] } }}
          transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
          style={{ width: SIDEBAR_W, willChange: "transform" }}
          className={cn(
            "fixed z-[50] flex flex-col overflow-hidden bg-popover text-popover-foreground transition-[top,right,bottom,border-radius] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]",
            panelShell(docked),
          )}
        >
          <SheetBody set={set} sets={sets} onClose={() => openSet(null)} />
        </motion.aside>
      )}
    </AnimatePresence>
  )
}

function SheetBody({ set, sets, onClose }: { set: VariantSet; sets: VariantSet[]; onClose: () => void }) {
  const setPreviewOption = useTool((s) => s.setPreviewOption)
  const layout = useTool((s) => s.variantLayout)
  const setLayout = useTool((s) => s.setVariantLayout)
  const letter = letterFor(set.id, sets)
  const cards: ("original" | VariantSet["options"][number])[] = ["original", ...set.options]
  // drill-in: one card's sources replace the list until Back (scoped to the set it was opened from)
  const [sourcesOf, setSourcesOf] = React.useState<{ setId: string; index: number; code: string; name: string } | null>(null)
  const sources = sourcesOf?.setId === set.id ? sourcesOf : null
  // screens picked with "Use as reference" (visual only for now), kept while the panel is open
  const [picked, setPicked] = React.useState<Set<string>>(new Set())
  const scrollRef = React.useRef<HTMLDivElement>(null)
  const showSources = (next: typeof sourcesOf) => {
    setPreviewOption(null)
    setSourcesOf(next)
    scrollRef.current?.scrollTo({ top: 0 })
  }

  return (
    <>
      <div className="relative flex h-14 shrink-0 items-center gap-2 border-b border-border/70 pl-3 pr-2.5">
        <SetSwitcher set={set} sets={sets} letter={letter} />
        <DockToggle layout={layout} onChange={setLayout} />
        <button onClick={onClose} className="grid size-7 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground" aria-label="Close">
          <X className="size-4" />
        </button>
      </div>

      <div ref={scrollRef} className="no-scrollbar flex-1 overflow-y-auto p-3" onMouseLeave={() => setPreviewOption(null)}>
        <AnimatePresence mode="popLayout">
          {sources && !set.generating ? (
            <SourcesView
              key="sources"
              code={sources.code}
              name={sources.name}
              apps={sourceApps(sources.index)}
              isPicked={(app) => picked.has(`${set.id}:${sources.code}:${app}`)}
              onToggle={(app) =>
                setPicked((p) => {
                  const k = `${set.id}:${sources.code}:${app}`
                  const n = new Set(p)
                  if (!n.delete(k)) n.add(k)
                  return n
                })
              }
              onBack={() => showSources(null)}
            />
          ) : set.generating ? (
            <motion.div key="gen" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col gap-2.5">
              <div className="flex items-center gap-2 px-1 pb-1 text-[12px] font-medium text-[var(--pc-variant)]">
                <Wand2 className="size-3.5 animate-pulse" /> Generating variants of {set.component}…
              </div>
              {Array.from({ length: Math.max(3, Math.min(4, set.options.length)) }).map((_, i) => (
                <div key={i} className="overflow-hidden rounded-xl border border-border">
                  <div className="pc-shimmer h-[118px] bg-muted/60" style={{ animationDelay: `${i * 120}ms` }} />
                  <div className="flex flex-col gap-1.5 p-3">
                    <div className="h-3 w-24 rounded bg-muted" />
                    <div className="h-2.5 w-48 rounded bg-muted" />
                  </div>
                </div>
              ))}
            </motion.div>
          ) : (
            <motion.div key="list" className="flex flex-col gap-2.5">
              {cards.map((o, i) => {
                const code = o === "original" ? "Original" : `${letter}${i}`
                const name = o === "original" ? "Original" : o.name
                return (
                  <OptionCard
                    key={`${set.id}:${o === "original" ? "original" : o.id}`}
                    set={set}
                    option={o}
                    code={code}
                    index={i}
                    onSources={() => showSources({ setId: set.id, index: i, code, name })}
                  />
                )
              })}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <PromptBar set={set} />
    </>
  )
}

/** Agent hand-off for one variant: what it is, where it goes, and the CSS when it's a style variant. */
function variantPrompt(set: VariantSet, option: "original" | VariantSet["options"][number], code: string) {
  const lines = [
    `Implement variant ${code} of "${set.name}" (${set.component}) on the ${screenMeta(set.screen).title} screen.`,
    `Target: [data-pc-id="${set.elId}"]`,
  ]
  if (option === "original") lines.push("Keep the original design (what's in the product today).")
  else {
    lines.push(`Variant: ${option.name} — ${option.description}`)
    if (option.style) lines.push("```css", ...Object.entries(option.style).map(([k, v]) => `${k}: ${v};`), "```")
  }
  return lines.join("\n")
}

// hover feedback on cards is instant: no transitions on anything that reacts to the pointer
function OptionCard({
  set,
  option,
  code,
  index,
  onSources,
}: {
  set: VariantSet
  option: "original" | VariantSet["options"][number]
  code: string
  index: number
  onSources: () => void
}) {
  const setPreviewOption = useTool((s) => s.setPreviewOption)
  const id = option === "original" ? "original" : option.id
  const applied = set.selected === id
  const [copied, setCopied] = React.useState(false)
  React.useEffect(() => {
    if (!copied) return
    const t = window.setTimeout(() => setCopied(false), 1400)
    return () => window.clearTimeout(t)
  }, [copied])

  const addToScreen = () => {
    chooseVariant(set.id, id)
    setPreviewOption(null)
  }

  const iterate = () => {
    // put this variant on screen, then hand the prompt box a starting line for the next round
    chooseVariant(set.id, id)
    setPreviewOption(null)
    useTool.getState().select([set.elId], null)
    useTool.setState({ promptDraft: `Iterate over ${code}${option === "original" ? "" : ` (${option.name})`}: ` })
  }

  const copyPrompt = async () => {
    await copyText(variantPrompt(set, option, code))
    setCopied(true)
  }
  const isOriginal = option === "original"
  // the card itself adds to screen on click, so every control inside keeps its click to itself
  const own = (fn: () => void) => (e: React.MouseEvent) => {
    e.stopPropagation()
    fn()
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1], delay: Math.min(index, 4) * 0.03 }}
      onMouseEnter={() => setPreviewOption({ setId: set.id, optionId: id })}
      // the whole card is the Add to screen target
      onClick={applied ? undefined : addToScreen}
      className={cn(
        "group/card relative flex w-full flex-col overflow-hidden rounded-[14px] border border-border bg-background text-left",
        !applied && "cursor-pointer",
        // the one on screen: a purple ring
        applied && "border-[var(--pc-variant)] shadow-[0_0_0_1px_var(--pc-variant)]",
      )}
    >
      <div className="relative shrink-0 border-b border-border/70 bg-[#f6f6f4] dark:bg-[#ececea]">
        <DeferredPreview set={set} option={option} index={index} />
        {/* code tag inside the preview: quiet at rest, solid with a check when it's on screen */}
        <span
          className={cn(
            "absolute left-2 top-2 flex h-5 items-center gap-0.5 rounded-[5px] px-1.5 font-mono text-[11px] font-semibold leading-none",
            applied
              ? "bg-[var(--pc-variant)] text-white [&_svg]:size-3"
              : "bg-white text-[var(--pc-variant)] shadow-[0_0_0_1px_rgb(0_0_0/0.08)]",
          )}
        >
          {applied && <Check />}
          {code}
        </span>
      </div>
      <div className="flex flex-col gap-2.5 px-3 pb-2.5 pt-3">
        <div className="flex min-w-0 flex-col gap-0.5">
          <div className="flex items-center gap-1.5">
            <span className="truncate text-[13px] font-semibold leading-[1.5]">{isOriginal ? "Original" : option.name}</span>
            {!isOriginal && (
              <button
                onClick={own(onSources)}
                className="shrink-0 rounded-full bg-muted px-2 py-px text-[11px] font-medium leading-[1.5] text-muted-foreground hover:bg-[color-mix(in_oklab,var(--muted),var(--foreground)_8%)] hover:text-foreground"
              >
                {sourceApps(index).length} sources
              </button>
            )}
          </div>
          <span className="truncate text-[13px] leading-[1.375] text-muted-foreground">{isOriginal ? "What's in the product today." : option.description}</span>
        </div>
        <div className="flex items-center gap-0.5">
          {applied ? (
            <span className="flex h-7 items-center gap-1 px-1 text-[12.5px] font-medium text-[var(--pc-variant)] [&_svg]:size-3.5">
              <Check /> On screen
            </span>
          ) : (
            // a quiet text button at rest that turns solid while the card is hovered (instantly)
            <button
              onClick={own(addToScreen)}
              className="-ml-1 flex h-7 items-center gap-1 rounded-full px-2 text-[12.5px] font-medium text-[var(--pc-variant)] group-hover/card:bg-[var(--pc-variant)] group-hover/card:px-3 group-hover/card:text-white group-focus-within/card:bg-[var(--pc-variant)] group-focus-within/card:px-3 group-focus-within/card:text-white active:scale-[0.97] [&_svg]:size-3.5"
            >
              <Plus /> Add to screen
            </button>
          )}
          <span className="flex-1" />
          <CardIcon label="Iterate over" onClick={own(iterate)}>
            <RefreshCw />
          </CardIcon>
          <CardIcon label={copied ? "Copied" : "Copy prompt"} onClick={own(copyPrompt)}>
            {copied ? <Check /> : <Copy />}
          </CardIcon>
          <DropdownMenu modal={false}>
            <DropdownMenuTrigger asChild>
              <button
                aria-label="More"
                onClick={(e) => e.stopPropagation()}
                className="grid size-7 place-items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground data-[state=open]:bg-muted data-[state=open]:text-foreground [&_svg]:size-4"
              >
                <Ellipsis />
              </button>
            </DropdownMenuTrigger>
            {/* portalled, but React still bubbles its clicks to the card: stop them here */}
            <DropdownMenuContent align="end" sideOffset={6} className="w-44" onClick={(e) => e.stopPropagation()}>
              <DropdownMenuItem onSelect={iterate}>
                <RefreshCw /> Iterate over
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => void copyPrompt()}>
                <Copy /> Copy prompt
              </DropdownMenuItem>
              {!isOriginal && (
                <DropdownMenuItem onSelect={onSources}>
                  <ImageGlyph /> View sources
                </DropdownMenuItem>
              )}
              {!isOriginal && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem variant="destructive" onSelect={() => deleteVariantOption(set.id, option.id)}>
                    <Trash2 /> Delete variant
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </motion.div>
  )
}

function CardIcon({ label, onClick, children }: { label: string; onClick: (e: React.MouseEvent) => void; children: React.ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          aria-label={label}
          onClick={onClick}
          className="grid size-7 place-items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground [&_svg]:size-3.5"
        >
          {children}
        </button>
      </TooltipTrigger>
      <TooltipContent side="top">{label}</TooltipContent>
    </Tooltip>
  )
}

/* ───────────────────────── sources (drill-in) ───────────────────────── */

/** Placeholder sources until real Mobbin screens are wired in: three apps per card, rotating through the list. */
const SOURCE_APPS = ["Intercom", "Front", "Midday", "Linear", "Attio", "Notion", "Stripe", "Vercel"]
const sourceApps = (index: number) => [0, 1, 2].map((k) => SOURCE_APPS[(index * 3 + k) % SOURCE_APPS.length])

/** One card's reference screens, filling the panel: app name, screenshot, and a "Use as reference" pick. */
function SourcesView({
  code,
  name,
  apps,
  isPicked,
  onToggle,
  onBack,
}: {
  code: string
  name: string
  apps: string[]
  isPicked: (app: string) => boolean
  onToggle: (app: string) => void
  onBack: () => void
}) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 16 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 16, transition: { duration: 0.12 } }}
      transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
      className="flex flex-col gap-5"
    >
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-1.5">
          <button
            onClick={onBack}
            className="-ml-1 flex h-7 items-center gap-1 rounded-md pl-1 pr-2 text-[12px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground [&_svg]:size-3.5"
          >
            <ArrowLeft /> Back
          </button>
          <span className="text-[12px] text-muted-foreground">Sources · {code}</span>
        </div>
        <span className="px-1 text-[13px] font-semibold">{name}</span>
      </div>
      {apps.map((app) => {
        const on = isPicked(app)
        return (
          <div key={app} className="flex flex-col gap-2">
            <span className="px-1 text-[14px] font-semibold">{app}</span>
            <SourcePlaceholder />
            <button
              role="checkbox"
              aria-checked={on}
              onClick={() => onToggle(app)}
              className="flex items-center justify-between rounded-md px-1 py-1 text-[13px] text-muted-foreground transition-colors hover:text-foreground"
            >
              Use as reference
              <span
                className={cn(
                  "grid size-5 place-items-center rounded-full transition-colors [&_svg]:size-3",
                  on ? "bg-[var(--pc-variant)] text-white" : "shadow-[inset_0_0_0_1.5px_currentColor]",
                )}
              >
                {on && <Check />}
              </span>
            </button>
          </div>
        )
      })}
    </motion.div>
  )
}

/** Stand-in for a Mobbin screenshot: a quiet app-window skeleton (sidebar, toolbar, rows). */
function SourcePlaceholder() {
  return (
    <div className="relative flex aspect-[16/10] overflow-hidden rounded-md border border-border bg-[#f6f6f4] dark:bg-[#ececea]">
      <div className="flex w-[22%] flex-col gap-1.5 border-r border-black/[0.06] p-2">
        <div className="h-2 w-3/4 rounded-full bg-black/[0.08]" />
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-1.5 rounded-full bg-black/[0.05]" style={{ width: `${60 + ((i * 17) % 35)}%` }} />
        ))}
      </div>
      <div className="flex flex-1 flex-col gap-2 p-2.5">
        <div className="flex items-center justify-between">
          <div className="h-2 w-1/3 rounded-full bg-black/[0.08]" />
          <div className="h-3 w-10 rounded bg-black/[0.08]" />
        </div>
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center gap-2 rounded bg-white/70 px-2 py-1.5 dark:bg-white">
            <div className="size-2 rounded-full bg-black/[0.08]" />
            <div className="h-1.5 rounded-full bg-black/[0.06]" style={{ width: `${45 + ((i * 23) % 40)}%` }} />
          </div>
        ))}
      </div>
      <span className="absolute bottom-1.5 right-1.5 rounded bg-black/[0.06] px-1.5 py-0.5 text-[10px] font-medium text-black/40">Placeholder</span>
    </div>
  )
}

/** Jumps to a set: switches screen if needed, opens it and scrolls its element into view. */
function focusSet(set: VariantSet) {
  const st = useTool.getState()
  if (st.screen !== set.screen) {
    st.setScreen(set.screen)
    useTool.setState({ mode: "variants" })
  }
  useTool.getState().openSet(set.id)
  requestAnimationFrame(() => requestAnimationFrame(() => findEl(set.elId)?.scrollIntoView({ behavior: "smooth", block: "center" })))
}

/** The set name doubles as a switcher: chevron → searchable list of every variant set. */
function SetSwitcher({ set, sets, letter }: { set: VariantSet; sets: VariantSet[]; letter: string }) {
  const screen = useTool((s) => s.screen)
  const [open, setOpen] = React.useState(false)
  const [q, setQ] = React.useState("")
  const [active, setActive] = React.useState(0)
  const ref = React.useRef<HTMLDivElement>(null)
  const input = React.useRef<HTMLInputElement>(null)

  const list = sets
    .filter((v) => `${letterFor(v.id, sets)} ${v.name} ${v.component} ${screenMeta(v.screen).title}`.toLowerCase().includes(q.trim().toLowerCase()))
    .sort((a, b) => Number(b.screen === screen) - Number(a.screen === screen))

  React.useEffect(() => {
    if (!open) return
    setQ("")
    setActive(0)
    requestAnimationFrame(() => input.current?.focus())
    const close = (e: PointerEvent) => !ref.current?.contains(e.target as Node) && setOpen(false)
    document.addEventListener("pointerdown", close, true)
    return () => document.removeEventListener("pointerdown", close, true)
  }, [open])

  const pick = (v: VariantSet) => {
    setOpen(false)
    if (v.id !== set.id) focusSet(v)
  }

  return (
    <div ref={ref} className="min-w-0 flex-1">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex h-9 max-w-full items-center gap-2.5 rounded-lg pl-1 pr-2 transition-colors hover:bg-muted"
      >
        <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-[var(--pc-variant)] text-[13px] font-semibold text-white">{letter}</span>
        <span className="min-w-0 truncate text-[14px] font-semibold tracking-[-0.01em]">{set.name}</span>
        <ChevronDown className={cn("size-3.5 shrink-0 text-muted-foreground transition-transform duration-200", open && "rotate-180")} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
            className="pc-shadow absolute inset-x-2 top-[52px] z-20 flex origin-top flex-col overflow-hidden rounded-xl border border-border/60 bg-popover"
          >
            <div className="flex h-10 items-center gap-2 border-b border-border/70 px-3">
              <Search className="size-3.5 shrink-0 text-muted-foreground" />
              <input
                ref={input}
                value={q}
                onChange={(e) => {
                  setQ(e.target.value)
                  setActive(0)
                }}
                onKeyDown={(e) => {
                  e.stopPropagation()
                  if (e.key === "ArrowDown") {
                    e.preventDefault()
                    setActive((a) => Math.min(a + 1, list.length - 1))
                  } else if (e.key === "ArrowUp") {
                    e.preventDefault()
                    setActive((a) => Math.max(a - 1, 0))
                  } else if (e.key === "Enter" && list[active]) pick(list[active])
                  else if (e.key === "Escape") setOpen(false)
                }}
                placeholder="Search variants…"
                className="h-full min-w-0 flex-1 bg-transparent text-[13px] outline-none placeholder:text-muted-foreground"
              />
            </div>
            <div className="no-scrollbar max-h-[320px] overflow-y-auto p-1">
              {list.length === 0 && <div className="px-3 py-6 text-center text-[12px] text-muted-foreground">No variants match “{q}”</div>}
              {list.map((v, i) => {
                const l = letterFor(v.id, sets)
                return (
                  <button
                    key={v.id}
                    onMouseEnter={() => setActive(i)}
                    onClick={() => pick(v)}
                    className={cn("flex h-9 w-full items-center gap-2.5 rounded-lg px-2 text-left", i === active && "bg-muted")}
                  >
                    <span className="grid size-5 shrink-0 place-items-center rounded-[5px] bg-[var(--pc-variant)] text-[11px] font-semibold text-white">{l}</span>
                    <span className="min-w-0 flex-1 truncate text-[13px] font-medium">{v.name}</span>
                    {v.screen !== screen && <span className="shrink-0 text-[11.5px] text-muted-foreground">{screenMeta(v.screen).title}</span>}
                    {v.id === set.id && <Check className="size-3.5 shrink-0 text-[var(--pc-variant)]" />}
                  </button>
                )
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

/**
 * The sheet's single CTA. "Generate more variants" opens into a prompt box in place; what you write becomes an
 * agent request for the next round ("3-4 bolder takes" also sets how many). Esc or Cancel folds it back.
 */
function PromptBar({ set }: { set: VariantSet }) {
  const [open, setOpen] = React.useState(false)
  const [text, setText] = React.useState("")
  const ref = React.useRef<HTMLTextAreaElement>(null)
  React.useEffect(() => {
    setOpen(false)
    setText("")
  }, [set.id])

  const [copied, setCopied] = React.useState(false)
  const submit = async () => {
    const t = text.trim()
    const count = detectVariantIntent(t)?.count ?? Math.max(1, Math.min(6, parseInt(t.match(/\b(\d)\b/)?.[1] ?? "3", 10)))
    await copyText(buildVariantsPrompt(set.elId, t, count))
    setCopied(true)
    window.setTimeout(() => {
      setCopied(false)
      setText("")
      setOpen(false)
    }, 900)
  }

  return (
    <motion.div layout transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }} className="shrink-0 border-t border-border/70 bg-muted/40 p-3">
      <AnimatePresence mode="popLayout" initial={false}>
        {!open ? (
          <motion.button
            key="cta"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={() => {
              setOpen(true)
              requestAnimationFrame(() => ref.current?.focus())
            }}
            disabled={set.generating}
            className="flex h-9 w-full items-center justify-center gap-1.5 rounded-full bg-[var(--pc-variant)] text-[13px] font-medium text-white transition hover:brightness-110 disabled:opacity-60"
          >
            <Plus className="size-3.5" /> Generate more variants
          </motion.button>
        ) : (
          <motion.div
            key="box"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 6 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            className="flex flex-col gap-2"
          >
            <textarea
              ref={ref}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                e.stopPropagation()
                if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                  e.preventDefault()
                  submit()
                }
                if (e.key === "Escape") setOpen(false)
              }}
              placeholder={`Describe new variants of ${set.name}, e.g. 3 bolder takes`}
              className="h-[76px] w-full resize-none rounded-xl border border-border bg-background px-3 py-2.5 text-[13px] leading-[1.4] outline-none transition-[border-color,box-shadow] placeholder:text-muted-foreground focus:border-[var(--pc-variant)] focus:shadow-[0_0_0_0.5px_var(--pc-variant)]"
            />
            <div className="flex justify-end gap-1.5">
              <button
                onClick={() => setOpen(false)}
                className="h-7 rounded-full bg-muted px-3 text-[12px] font-medium text-foreground/80 transition-colors hover:bg-accent"
              >
                Cancel
              </button>
              <button
                onClick={submit}
                disabled={set.generating}
                className="flex h-7 items-center gap-1 rounded-full bg-[var(--pc-variant)] px-3.5 text-[12px] font-medium text-white transition hover:brightness-110 disabled:opacity-60 [&_svg]:size-3"
              >
                {copied ? <Check /> : <Copy />} {copied ? "Copied" : "Copy Prompt"}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

/**
 * Live previews render real product markup (charts included), which is too heavy to mount in the
 * same frame the sidebar opens. Each card shows a same-size placeholder first and swaps in its
 * preview one at a time once the slide has finished.
 */
function DeferredPreview({ set, option, index }: { set: VariantSet; option: "original" | VariantSet["options"][number]; index: number }) {
  const key = `${set.id}:${option === "original" ? "original" : option.id}`
  const [ready, setReady] = React.useState(false)
  React.useEffect(() => {
    setReady(false)
    const t = window.setTimeout(() => setReady(true), 200 + index * 50)
    return () => window.clearTimeout(t)
  }, [key, index])
  if (ready) return <VariantPreview set={set} option={option} />
  return <div className="pc-shimmer w-full bg-muted/40" style={{ height: previewHeights.get(key) ?? 110 }} />
}
