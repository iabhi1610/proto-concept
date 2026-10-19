import * as React from "react"
import { AnimatePresence, motion } from "motion/react"
import { Check, ChevronDown, Copy, Plus, Search, Trash2, Wand2, X } from "@/lib/icons"
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
            "pc-inverse fixed z-[50] flex flex-col overflow-hidden bg-popover text-popover-foreground transition-[top,right,bottom,border-radius] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]",
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

  return (
    <>
      <div className="relative flex h-14 shrink-0 items-center gap-2 border-b border-border/70 pl-3 pr-2.5">
        <SetSwitcher set={set} sets={sets} letter={letter} />
        <DockToggle layout={layout} onChange={setLayout} />
        <button onClick={onClose} className="grid size-7 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground" aria-label="Close">
          <X className="size-4" />
        </button>
      </div>

      <div className="no-scrollbar flex-1 overflow-y-auto p-3" onMouseLeave={() => setPreviewOption(null)}>
        <AnimatePresence mode="popLayout">
          {set.generating ? (
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
              {cards.map((o, i) => (
                <OptionCard key={`${set.id}:${o === "original" ? "original" : o.id}`} set={set} option={o} code={o === "original" ? "Original" : `${letter}${i}`} index={i} />
              ))}
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

function OptionCard({ set, option, code, index }: { set: VariantSet; option: "original" | VariantSet["options"][number]; code: string; index: number }) {
  const setPreviewOption = useTool((s) => s.setPreviewOption)
  const id = option === "original" ? "original" : option.id
  const applied = set.selected === id
  const [copied, setCopied] = React.useState(false)
  React.useEffect(() => {
    if (!copied) return
    const t = window.setTimeout(() => setCopied(false), 1400)
    return () => window.clearTimeout(t)
  }, [copied])

  const iterate = () => {
    // put this variant on screen, then hand the prompt box a starting line for the next round
    chooseVariant(set.id, id)
    setPreviewOption(null)
    useTool.getState().select([set.elId], null)
    useTool.setState({ promptDraft: `Iterate over ${code}${option === "original" ? "" : ` (${option.name})`}: ` })
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1], delay: Math.min(index, 4) * 0.03 }}
      onMouseEnter={() => setPreviewOption({ setId: set.id, optionId: id })}
      className="group/card relative flex w-full flex-col overflow-hidden rounded-[14px] border border-border bg-background text-left"
    >
      <div className="border-b border-border/70 bg-[#f6f6f4] dark:bg-[#ececea]">
        <DeferredPreview set={set} option={option} index={index} />
      </div>
      <div className="flex flex-col gap-2 p-3">
        <div className="flex items-center gap-2.5">
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="text-[13px] font-semibold leading-[1.5]">{option === "original" ? "Original" : option.name}</span>
            <span className="text-[13px] leading-[1.375] text-muted-foreground">{option === "original" ? "What's in the product today." : option.description}</span>
          </div>
          {applied ? (
            <span className="flex shrink-0 items-center gap-1 px-2 py-0.5 text-[11px] font-medium text-[var(--pc-variant)]">
              <Check className="size-3" /> On screen
            </span>
          ) : (
            // only on hover: the card stays calm until you're looking at it
            <span className="opacity-0 transition-opacity duration-150 group-hover/card:opacity-100 group-focus-within/card:opacity-100">
              <CardPill onClick={() => (chooseVariant(set.id, id), setPreviewOption(null))}>Add to screen</CardPill>
            </span>
          )}
        </div>
        <div className="flex gap-2 border-t border-black/[0.12] pt-2 dark:border-white/[0.12]">
          {option !== "original" && (
            <button
              aria-label="Delete variant"
              title="Delete variant"
              onClick={(e) => {
                e.stopPropagation()
                deleteVariantOption(set.id, option.id)
              }}
              className="-my-0.5 grid size-6 place-items-center rounded-full text-[#e5484d]/60 transition-colors hover:bg-[#e5484d]/10 hover:text-[#e5484d] [&_svg]:size-3.5"
            >
              <Trash2 />
            </button>
          )}
          <span className="flex-1" />
          <CardPill onClick={iterate}>Iterate over</CardPill>
          <CardPill
            onClick={async () => {
              await copyText(variantPrompt(set, option, code))
              setCopied(true)
            }}
          >
            {copied ? "Copied" : "Copy Prompt"}
          </CardPill>
        </div>
      </div>
      {/* corner tag: solid when this one is on screen */}
      <span
        className={cn(
          "absolute -top-px left-0 min-w-[39px] rounded-br-[4px] rounded-tl-[4px] px-1.5 py-0.5 text-center text-[11px] font-medium leading-[1.2]",
          applied ? "bg-[var(--pc-variant)] text-white" : "bg-[#e8deff] text-[var(--pc-variant)]",
        )}
      >
        {code}
      </span>
    </motion.div>
  )
}

function CardPill({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={(e) => {
        e.stopPropagation()
        onClick()
      }}
      className="shrink-0 rounded-full border border-border px-2 py-0.5 text-[11px] font-medium leading-[1.5] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
    >
      {children}
    </button>
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
