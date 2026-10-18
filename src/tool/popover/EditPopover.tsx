import * as React from "react"
import { AnimatePresence, LayoutGroup, motion } from "motion/react"
import { AlertTriangle, SlidersHorizontal, Sparkles, X } from "@/lib/icons"
import { Select, SelectContent, SelectItem, SelectSeparator, SelectTrigger, SelectValue } from "@/components/ui/select"
import { cn } from "@/lib/utils"
import { applyPrompt, applyProps, createVariants, restingState, statesFor } from "../actions"
import { buildVariantsPrompt, copyText } from "../copy"
import { childTarget, elInfo, findEl, parentTarget } from "../engine/dom"
import { generatePanel, panelProps } from "../engine/customControls"
import { detectVariantIntent } from "../engine/intent"
import { unionBox, useLiveBoxes, type Box } from "../overlay/geometry"
import { PropertiesPanel } from "../properties/PropertiesPanel"
import { BAR_H, INSPECTOR_W, SIDEBAR_W, useTool, V2 } from "../store"
import { PromptInput } from "./PromptInput"

const W = 312
const GAP = 14
const spring = { type: "spring", stiffness: 420, damping: 36, mass: 0.8 } as const
/** ease-out (quint-ish): quick start, long soft landing */
const EASE_OUT = [0.22, 1, 0.36, 1] as const
const tabEase = { duration: 0.32, ease: EASE_OUT }
const appear = { type: "spring", stiffness: 720, damping: 44, mass: 0.6 } as const

/** Places the popover beside the selection without covering it: right → left → below → above → best corner. */
function place(u: Box, h: number, rightInset = 0) {
  const vw = window.innerWidth - rightInset
  const vh = window.innerHeight
  const bottomSafe = vh - (V2 ? BAR_H + 12 : 76)
  const clampY = (y: number) => Math.max(12, Math.min(y, bottomSafe - h))
  const clampX = (x: number) => Math.max(12, Math.min(x, vw - W - 12))
  if (u.x + u.w + GAP + W <= vw - 12) return { x: u.x + u.w + GAP, y: clampY(u.y) }
  if (u.x - GAP - W >= 12) return { x: u.x - GAP - W, y: clampY(u.y) }
  if (u.y + u.h + GAP + h <= bottomSafe) return { x: clampX(u.x), y: u.y + u.h + GAP }
  if (u.y - GAP - h >= 12) return { x: clampX(u.x), y: u.y - GAP - h }
  return { x: vw - W - 16, y: clampY(16) }
}

export function EditPopover() {
  const mode = useTool((s) => s.mode)
  const selection = useTool((s) => s.selection)
  const open = (mode === "comment" || mode === "variants") && selection.length > 0
  const boxes = useLiveBoxes(open ? selection : [])
  const union = unionBox(selection.map((id) => boxes[id]))
  const [h, setH] = React.useState(320)
  const ro = React.useRef<ResizeObserver | null>(null)
  const measure = React.useCallback((node: HTMLDivElement | null) => {
    ro.current?.disconnect()
    if (!node) return
    ro.current = new ResizeObserver(([e]) => setH(e.contentRect.height))
    ro.current.observe(node)
  }, [])
  const panelOpen = useTool((s) => s.commentsOpen)
  // holding Shift ghosts the popover so elements underneath can be shift-clicked into the group
  const [ghost, setGhost] = React.useState(false)
  React.useEffect(() => {
    // a held Shift (not Shift+letter while typing) ghosts after a short beat
    let t = 0
    const down = (e: KeyboardEvent) => {
      window.clearTimeout(t)
      if (e.key === "Shift" && !e.repeat) t = window.setTimeout(() => setGhost(true), 160)
      else setGhost(false)
    }
    const up = (e: KeyboardEvent) => {
      if (e.key !== "Shift") return
      window.clearTimeout(t)
      setGhost(false)
    }
    const blur = () => {
      window.clearTimeout(t)
      setGhost(false)
    }
    window.addEventListener("keydown", down)
    window.addEventListener("keyup", up)
    window.addEventListener("blur", blur)
    return () => {
      window.removeEventListener("keydown", down)
      window.removeEventListener("keyup", up)
      window.removeEventListener("blur", blur)
    }
  }, [])
  // keep clear of the comments panel and the variants sheet (docked or floating, both sit on the right)
  const sheetOpen = useTool((s) => s.mode === "variants" && !!s.activeSetId)
  const inspector = V2 && mode === "comment" && !panelOpen
  const pos = union ? place(union, h, panelOpen || sheetOpen ? SIDEBAR_W + 12 : inspector ? INSPECTOR_W + 12 : 0) : null

  return (
    <AnimatePresence>
      {open && pos && (
        <motion.div
          key="edit-popover"
          data-pc-tool
          initial={{ opacity: 0, scale: 0.97, x: pos.x, y: pos.y + 4 }}
          animate={{ opacity: ghost ? 0.18 : 1, scale: 1, x: pos.x, y: pos.y }}
          exit={{ opacity: 0, scale: 0.98, transition: { duration: 0.08 } }}
          transition={{ ...appear, opacity: { duration: 0.1 } }}
          className={cn("fixed left-0 top-0 z-[48] origin-top-left", ghost && "pointer-events-none")}
          style={{ width: W }}
        >
          <div ref={measure} className="flex flex-col gap-2">
            <div className="pc-inverse pc-shadow overflow-hidden rounded-2xl bg-popover text-popover-foreground">
              <PopoverBody />
            </div>
            <CustomComposer />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

const ALL = "__all__"
/** warnings the user closed; they stay closed for that element + state for the session */
const dismissedWarnings = new Set<string>()
const warnKey = (w: { elId: string; state: string; text: string }) => `${w.elId}|${w.state}|${w.text}`

const isField = (n: Element | null) =>
  !!n && (n instanceof HTMLInputElement || n instanceof HTMLTextAreaElement || n instanceof HTMLSelectElement || (n as HTMLElement).isContentEditable)

function PopoverBody() {
  const selection = useTool((s) => s.selection)
  // in Variants mode the popover is only a prompt: whatever you write becomes variants of the element
  const variantsMode = useTool((s) => s.mode === "variants")
  const forced = useTool((s) => s.forced)
  const setForced = useTool((s) => s.setForced)
  const applyAll = useTool((s) => s.applyAll)
  const setApplyAll = useTool((s) => s.setApplyAll)
  const storedTab = useTool((s) => s.tab)
  // prompt only in Variants mode, and in v2 (Properties lives in the docked inspector there)
  const tab = variantsMode || V2 ? "prompt" : storedTab
  const setTab = useTool((s) => s.setTab)
  const ops = useTool((s) => s.ops)
  const comments = useTool((s) => s.comments)
  const activeCommentId = useTool((s) => s.activeCommentId)
  const anchor = useTool((s) => s.anchor)
  const clearSelection = useTool((s) => s.clearSelection)
  const [text, setText] = React.useState("")
  const [copiedPrompt, setCopiedPrompt] = React.useState(false)
  const inputRef = React.useRef<HTMLTextAreaElement>(null)
  const textRef = React.useRef(text)
  textRef.current = text

  const els = selection.map((id) => findEl(id)).filter((e): e is HTMLElement => !!e)
  const primary = els[0] ? elInfo(els[0]) : undefined
  const states = React.useMemo(() => statesFor(selection), [selection])
  const rest = restingState(selection[0])
  const current = forced[selection[0]] ?? (states.some((s) => s.id === rest) ? rest : states[0]?.id ?? "default")
  const single = states.length <= 1
  const intent = React.useMemo(() => detectVariantIntent(text), [text])

  // freeze the shown state while editing so pointer hover doesn't fight the dropdown
  React.useEffect(() => {
    const st = useTool.getState()
    for (const id of selection) if (!st.forced[id]) st.setForced(id, restingState(id))
  }, [selection])

  /* ── keyboard: ↑ parent · ↓ back into the child you came from (or first child) · Tab switches tabs ── */
  const trail = React.useRef<string[]>([])
  const expected = React.useRef<string | null>(null)
  React.useEffect(() => {
    // a click elsewhere starts a fresh trail; only arrow moves keep it
    if (selection[0] !== expected.current) trail.current = []
    expected.current = null
  }, [selection])

  React.useEffect(() => {
    const go = (id: string) => {
      expected.current = id
      useTool.getState().select([id], null)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return
      const st = useTool.getState()
      if (st.shareOpen || st.paperOpen || st.shortcutsOpen) return
      const focus = document.activeElement
      if (focus?.closest('[role="listbox"],[role="menu"],[role="dialog"]')) return

      if (e.key === "Tab") {
        if (st.mode === "variants" || V2) return
        if (!focus?.closest("[data-pc-popover]") && isField(focus)) return
        e.preventDefault()
        e.stopPropagation()
        const next = st.tab === "prompt" ? "properties" : "prompt"
        st.setTab(next)
        if (next === "prompt") requestAnimationFrame(() => inputRef.current?.focus())
        else (focus as HTMLElement | null)?.blur?.()
        return
      }
      if ((e.key !== "ArrowUp" && e.key !== "ArrowDown") || e.shiftKey) return
      // arrows keep moving the caret once something is typed, and keep stepping number fields
      if (focus === inputRef.current ? textRef.current.length > 0 : isField(focus)) return
      if (st.selection.length !== 1) return
      const el = findEl(st.selection[0])
      if (!el) return
      e.preventDefault()
      e.stopPropagation()
      if (e.key === "ArrowUp") {
        const p = parentTarget(el)
        if (!p?.dataset.pcId) return
        trail.current.push(st.selection[0])
        go(p.dataset.pcId)
      } else {
        const back = trail.current.at(-1)
        const backEl = back ? findEl(back) : null
        if (back && backEl && el.contains(backEl)) {
          trail.current.pop()
          return go(back)
        }
        trail.current = []
        const c = childTarget(el)
        if (c?.dataset.pcId) go(c.dataset.pcId)
      }
    }
    window.addEventListener("keydown", onKey, true)
    return () => window.removeEventListener("keydown", onKey, true)
  }, [])

  const modified = React.useMemo(() => {
    const set = new Set<string>()
    for (const o of ops) if (selection.includes(o.elId)) set.add(o.state)
    return set
  }, [ops, selection])

  const related = comments.filter((c) => c.source !== "viewer" && c.elIds.some((e) => selection.includes(e)))
  const warnings = related
    .filter((c) => c.status === "open")
    .flatMap((c) => c.warnings)
    .filter((w) => selection.includes(w.elId) && (applyAll || w.state === current) && !dismissedWarnings.has(warnKey(w)))
  const active = !variantsMode && activeCommentId ? comments.find((c) => c.id === activeCommentId) : undefined
  const [, bump] = React.useReducer((n: number) => n + 1, 0)
  const dismiss = (ws: typeof warnings) => {
    ws.forEach((w) => dismissedWarnings.add(warnKey(w)))
    bump()
  }


  // the open comment lives in the text box itself; editing it rewrites that comment
  const activeText = active?.text ?? ""
  React.useEffect(() => {
    setText(activeText)
    requestAnimationFrame(() => {
      const ta = inputRef.current
      if (ta) ta.setSelectionRange(ta.value.length, ta.value.length)
    })
    // only when a different comment opens, not when its text is saved
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active?.id])

  // a draft handed over from elsewhere (Iterate over…) lands in the box with the caret at its end;
  // declared after the comment effect above so it wins on the same mount
  const draft = useTool((s) => s.promptDraft)
  React.useEffect(() => {
    if (draft === null) return
    setText(draft)
    useTool.setState({ promptDraft: null })
    requestAnimationFrame(() => {
      const ta = inputRef.current
      if (!ta) return
      ta.focus()
      ta.setSelectionRange(draft.length, draft.length)
    })
  }, [draft])

  if (!primary) return null

  const pickState = (id: string) => selection.forEach((el) => setForced(el, id))

  const submit = () => {
    if (!text.trim()) return
    if (variantsMode) {
      // the request goes to the agent: "3-4 variants…" sets the count; a bare number works too; otherwise three
      const count = intent?.count ?? Math.max(1, Math.min(6, parseInt(text.match(/\b(\d)\b/)?.[1] ?? "3", 10)))
      void copyText(buildVariantsPrompt(selection[0], text, count)).then(() => {
        setCopiedPrompt(true)
        window.setTimeout(() => {
          setCopiedPrompt(false)
          setText("")
          clearSelection()
        }, 800)
      })
      return
    }
    if (intent) {
      const setId = createVariants(selection[0], intent.count, text.trim(), anchor)
      setText("")
      const st = useTool.getState()
      st.setMode("variants")
      if (setId) st.openSet(setId)
      return
    }
    const res = applyPrompt({ text, elIds: selection, state: current, allStates: applyAll, anchor, replaceId: active?.id })
    if (!res) return
    setText("")
    clearSelection()
  }

  // Delete removes this element's comment (or every comment and edit on it) and reverts the changes
  const deletable = !variantsMode && (!!active || related.length > 0 || ops.some((o) => selection.includes(o.elId)))
  const remove = () => {
    const ids = new Set(active ? [active.id] : related.map((c) => c.id))
    useTool.getState().commit((d) => ({
      ...d,
      comments: d.comments.filter((c) => !ids.has(c.id)),
      ops: d.ops.filter((o) => !(o.commentId && ids.has(o.commentId)) && (active ? true : !selection.includes(o.elId))),
    }))
    useTool.setState({ activeCommentId: null })
  }

  const title =
    selection.length > 1 ? `${selection.length} elements` : primary.component === "Text" && primary.label ? `“${primary.label}”` : primary.name

  return (
    <div
      className="flex flex-col"
      data-pc-popover
      style={variantsMode ? ({ "--pc-comment": "var(--pc-variant)" } as React.CSSProperties) : undefined}
    >
      {/* header */}
      <div className="flex h-10 items-center gap-1.5 pl-3 pr-2">
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.span
            key={title}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.14 }}
            className="min-w-0 flex-1 truncate text-[12px] font-medium text-muted-foreground"
          >
            {title}
          </motion.span>
        </AnimatePresence>
        {!single && !variantsMode && (
          <Select
            value={applyAll ? ALL : current}
            onValueChange={(v) => {
              if (v === ALL) return setApplyAll(true)
              setApplyAll(false)
              pickState(v)
            }}
          >
            <SelectTrigger
              size="sm"
              className="h-6 w-auto gap-1 rounded-lg border-none bg-transparent px-2 text-[12px] text-muted-foreground shadow-none hover:bg-muted hover:text-foreground dark:bg-transparent dark:hover:bg-muted"
            >
              <SelectValue>
                <span className="flex items-center gap-1.5">
                  {applyAll ? `All ${states.length} states` : states.find((s) => s.id === current)?.label}
                  {!applyAll && modified.has(current) && <span className="size-1.5 rounded-full bg-[var(--pc-comment)]" />}
                </span>
              </SelectValue>
            </SelectTrigger>
            <SelectContent position="popper" align="end" className="pc-inverse z-[70] min-w-[150px]">
              <SelectItem value={ALL} className="text-[12px]">
                All states
              </SelectItem>
              <SelectSeparator />
              {states.map((s) => (
                <SelectItem key={s.id} value={s.id} className="text-[12px]">
                  <span className="flex w-full items-center gap-2">
                    {s.label}
                    {modified.has(s.id) && <span className="size-1.5 rounded-full bg-[var(--pc-comment)]" aria-label="modified" />}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* tabs (comment mode only) */}
      <div className={cn("px-3", (variantsMode || V2) && "hidden")}>
        <LayoutGroup id="pc-tabs">
          <div className="grid h-7 grid-cols-2 rounded-lg bg-muted p-0.5 outline outline-[0.5px] outline-[var(--pc-track-border)]">
            {(
              [
                ["prompt", "Prompt", <Sparkles key="i" className="size-3" />],
                ["properties", "Properties", <SlidersHorizontal key="i" className="size-3" />],
              ] as const
            ).map(([id, label, icon]) => (
              <button
                key={id}
                onClick={() => {
                  setTab(id)
                  if (id === "prompt") requestAnimationFrame(() => inputRef.current?.focus())
                }}
                className={cn(
                  "relative flex items-center justify-center rounded-md text-[12px] transition-colors",
                  tab === id ? "text-foreground" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {tab === id && <motion.span layoutId="pc-tab-pill" transition={tabEase} className="absolute inset-0 rounded-md bg-[var(--pc-pill)] shadow-[0_1px_2px_rgb(0_0_0/0.3)]" />}
                <span className="relative flex items-center gap-1.5">
                  {icon}
                  {label}
                </span>
              </button>
            ))}
          </div>
        </LayoutGroup>
      </div>

      <AnimatePresence initial={false}>
        {warnings.length > 0 && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden px-3">
            <div className="relative mt-2.5 flex flex-col gap-1 rounded-xl bg-[color-mix(in_oklab,var(--pc-warn),transparent_90%)] py-2 pl-2.5 pr-8">
              <button
                onClick={() => dismiss(warnings)}
                aria-label="Dismiss"
                className="absolute right-1.5 top-1.5 grid size-5 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-[color-mix(in_oklab,var(--pc-warn),transparent_80%)] hover:text-foreground"
              >
                <X className="size-3" />
              </button>
              {[...new Map(warnings.map((w) => [w.state + w.text, w])).values()].slice(0, 2).map((w) => (
                <div key={w.state + w.text} className="flex gap-1.5 text-[11.5px] leading-snug text-foreground">
                  <AlertTriangle className="mt-0.5 size-3 shrink-0 text-[var(--pc-warn)]" />
                  <span>
                    {applyAll && <b className="font-semibold">{states.find((s) => s.id === w.state)?.label}: </b>}
                    {w.text}
                  </span>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <TabBody
        tab={tab}
        properties={variantsMode || V2 ? null : <PropertiesPanel key={selection.join("|")} state={current} />}
        prompt={
            <div className="flex flex-col gap-2.5 p-3">
              <PromptInput
                value={text}
                onChange={setText}
                onSubmit={submit}
                intent={variantsMode ? null : intent}
                componentName={primary.component}
                inputRef={inputRef}
                autoFocus
                placeholder={variantsMode ? "Describe the variants you want, e.g. 3 bolder takes" : undefined}
              />
              <div className="flex items-center gap-1.5">
                {deletable && (
                  <button
                    onClick={remove}
                    className="h-6 rounded-full bg-[color-mix(in_oklab,var(--pc-danger),transparent_86%)] px-3 text-[12px] font-medium text-[var(--pc-danger)] transition-[background-color,transform] duration-150 hover:bg-[color-mix(in_oklab,var(--pc-danger),transparent_78%)] active:scale-[0.97]"
                  >
                    Delete
                  </button>
                )}
                <button
                  onClick={clearSelection}
                  className="ml-auto h-6 rounded-full bg-muted px-3 text-[12px] font-medium text-foreground/80 transition-[background-color,transform] duration-150 hover:bg-[var(--pc-pill)] active:scale-[0.97]"
                >
                  Cancel
                </button>
                <button
                  onClick={submit}
                  disabled={!text.trim() || (!!active && text.trim() === active.text)}
                  className={cn(
                    "h-6 rounded-full px-3.5 text-[12px] font-medium text-white transition-[background-color,opacity,transform] duration-150 active:scale-[0.97] disabled:opacity-45",
                    intent || variantsMode ? "bg-[var(--pc-variant)]" : "bg-[var(--pc-comment)]",
                  )}
                >
                  {variantsMode ? (copiedPrompt ? "Copied" : "Copy Prompt") : intent ? "Create" : active ? "Save" : "Add"}
                </button>
              </div>
            </div>
        }
      />

      {/* footer */}
      <div className="flex h-[39px] items-center justify-between border-t border-[var(--pc-footer)] bg-[var(--pc-footer)] px-3 text-[11.5px] text-[var(--pc-dim)]">
        <span className="flex items-center gap-1">
          <Key>↑</Key>
          <Key>↓</Key>
          <span className="ml-1">to traverse layers</span>
        </span>
        <span className={cn("flex items-center gap-1.5", (variantsMode || V2) && "hidden")}>
          <Key wide>tab</Key>
          {tab === "prompt" ? "Properties" : "Prompt"}
        </span>
      </div>
    </div>
  )
}

function Key({ children, wide }: { children: React.ReactNode; wide?: boolean }) {
  return (
    <kbd className={cn("grid h-5 place-items-center rounded-[5px] bg-[var(--pc-key)] font-sans text-[10px] text-foreground/90 shadow-[inset_0_0_0_1px_var(--border)]", wide ? "px-1.5" : "w-5")}>
      {children}
    </kbd>
  )
}

/**
 * Prompt and Properties both stay mounted; switching only cross-slides them while the popover's
 * height eases to the active one, so a switch never rebuilds the (heavy) Properties panel.
 * Properties is built in the background shortly after the popover opens, ready before you press Tab.
 */
function TabBody({ tab, prompt, properties }: { tab: string; prompt: React.ReactNode; properties: React.ReactNode | null }) {
  const promptRef = React.useRef<HTMLDivElement>(null)
  const propsRef = React.useRef<HTMLDivElement>(null)
  const [heights, setHeights] = React.useState<{ prompt: number; properties: number }>({ prompt: 0, properties: 0 })
  const [propsReady, setPropsReady] = React.useState(tab === "properties")
  React.useEffect(() => {
    if (propsReady) return
    if (tab === "properties") return setPropsReady(true)
    const t = window.setTimeout(() => setPropsReady(true), 180)
    return () => window.clearTimeout(t)
  }, [tab, propsReady])

  React.useLayoutEffect(() => {
    const ro = new ResizeObserver((entries) => {
      setHeights((h) => {
        const next = { ...h }
        for (const e of entries) {
          const v = e.borderBoxSize?.[0]?.blockSize ?? e.contentRect.height
          if (e.target === promptRef.current) next.prompt = v
          if (e.target === propsRef.current) next.properties = v
        }
        return next
      })
    })
    if (promptRef.current) ro.observe(promptRef.current)
    if (propsRef.current) ro.observe(propsRef.current)
    return () => ro.disconnect()
  }, [propsReady, properties === null])

  const onProps = tab === "properties" && !!properties
  const h = onProps ? heights.properties : heights.prompt
  const pane = (active: boolean, dir: number) => ({
    animate: { opacity: active ? 1 : 0, x: active ? 0 : dir * 24 },
    transition: { ...tabEase, opacity: { duration: active ? 0.2 : 0.14, ease: EASE_OUT } },
    style: { willChange: "transform, opacity" } as React.CSSProperties,
  })
  return (
    <motion.div animate={{ height: h || "auto" }} initial={false} transition={tabEase} className="relative overflow-hidden">
      <motion.div
        ref={promptRef}
        initial={false}
        {...pane(!onProps, -1)}
        inert={onProps}
        className={cn("inset-x-0 top-0", onProps ? "pointer-events-none absolute" : "relative")}
      >
        {prompt}
      </motion.div>
      {properties && propsReady && (
        <motion.div
          ref={propsRef}
          initial={false}
          {...pane(onProps, 1)}
          inert={!onProps}
          className={cn("inset-x-0 top-0", onProps ? "relative" : "pointer-events-none absolute")}
        >
          {properties}
        </motion.div>
      )}
    </motion.div>
  )
}

/**
 * "Generate custom": a detached pill under the popover (Properties tab only). It grows into a prompt;
 * the idea becomes a saved panel of DialKit-style controls at the top of Properties.
 */
/** `inline`: rendered inside the v2 inspector instead of floating under the popover */
export function CustomComposer({ inline }: { inline?: boolean }) {
  const show = useTool((s) => s.mode === "comment" && s.selection.length === 1 && (inline || (!V2 && s.tab === "properties")))
  const open = useTool((s) => s.composerOpen)
  const setOpen = useTool((s) => s.setComposerOpen)
  const [text, setText] = React.useState("")
  const ref = React.useRef<HTMLTextAreaElement>(null)
  React.useEffect(() => {
    if (open) requestAnimationFrame(() => ref.current?.focus())
    else setText("")
  }, [open])

  const generate = () => {
    const prompt = text.trim()
    if (!prompt) return
    const st = useTool.getState()
    const elId = st.selection[0]
    const panel = generatePanel(prompt, statesFor([elId]).map((x) => x.id))
    st.addCustomPanel(elId, panel)
    // show the state the controls edit (e.g. Hover), then write their starting values
    if (panel.state !== "default") st.setForced(elId, panel.state)
    applyProps(panelProps(panel), [], { state: panel.state })
    setOpen(false)
  }

  return (
    <AnimatePresence initial={false}>
      {show && (
        <motion.div
          layout
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6, transition: { duration: 0.1 } }}
          transition={{ ...tabEase, layout: tabEase }}
          className={cn("pc-inverse overflow-hidden bg-popover text-popover-foreground", !inline && "pc-shadow", open ? "rounded-2xl" : "rounded-full")}
        >
          <AnimatePresence mode="popLayout" initial={false}>
            {!open ? (
              <motion.button
                key="pill"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.12 }}
                onClick={() => setOpen(true)}
                className="flex h-11 w-full items-center gap-2.5 pl-4 pr-2 text-[13px] font-medium text-foreground/90 transition-colors hover:text-foreground"
              >
                <Sparkles className="size-4 text-[var(--pc-comment)]" />
                <span className="flex-1 text-left">Generate custom controls</span>
                <span
                  title="Describe a feel (e.g. “springy hover lift”) and get DialKit-style controls for it"
                  className="grid size-6 place-items-center rounded-full bg-[var(--pc-pill)] text-[11px] font-semibold text-foreground/70"
                >
                  ?
                </span>
              </motion.button>
            ) : (
              <motion.div
                key="box"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.16, delay: 0.04 }}
                className="flex flex-col gap-2.5 p-3"
              >
                <textarea
                  ref={ref}
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  onKeyDown={(e) => {
                    e.stopPropagation()
                    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) (e.preventDefault(), generate())
                    if (e.key === "Escape") setOpen(false)
                  }}
                  placeholder="Describe the controls you want, e.g. springy hover lift with a soft glow"
                  className="h-[72px] w-full resize-none rounded-lg border border-[var(--pc-field-border)] bg-[var(--pc-field)] p-2 text-[12px] leading-[15px] text-foreground outline-none transition-[border-color,box-shadow] placeholder:text-[var(--pc-placeholder)] focus:border-[var(--pc-comment)] focus:shadow-[0_0_0_0.5px_var(--pc-comment)]"
                />
                <div className="flex items-center justify-end gap-1.5">
                  <button
                    onClick={() => setOpen(false)}
                    className="h-6 rounded-full bg-muted px-3 text-[12px] font-medium text-foreground/80 transition-colors hover:bg-[var(--pc-pill)]"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={generate}
                    disabled={!text.trim()}
                    className="flex h-6 items-center gap-1 rounded-full bg-[var(--pc-comment)] px-3.5 text-[12px] font-medium text-white transition-opacity disabled:opacity-45 [&_svg]:size-3"
                  >
                    <Sparkles /> Generate
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
