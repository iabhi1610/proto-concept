import * as React from "react"
import { AlignCenter, AlignLeft, AlignRight, ArrowDown, ArrowRight, CaseLower, CaseSensitive, CaseUpper, Check, ChevronDown, Minus, PadX, PadY, Space, WrapText } from "@/lib/icons"
import { Slider } from "@/components/ui/slider"
import { cn } from "@/lib/utils"
import type { ComponentDef } from "@/product/system/define"
import { applyProps, applyText } from "../actions"
import { buildElementMarkdown, copyText } from "../copy"
import { CustomSection } from "./CustomSection"
import { elInfo, findEl, px, readSnapshot } from "../engine/dom"
import { endPreview, hasOwnText, previewText, readText } from "../engine/textEdit"
import { useTool } from "../store"
import type { EditOp } from "../types"
import {
  AddRow,
  AlignGrid,
  Changed,
  CheckRow,
  ColorField,
  IconBtn,
  MiniSelect,
  RemoveBtn,
  ScrubField,
  Section,
  Seg,
  TextAreaField,
  SizeField,
  TokenInput,
  type Axis,
  type SizeMode,
} from "./fields"
import { matchToken, tokensOf, type TokenKind } from "./tokens"

const FONTS = [
  { value: '"Timeless Sans", ui-sans-serif, system-ui, sans-serif', label: "Timeless Sans" },
  { value: "ui-sans-serif, system-ui, sans-serif", label: "System UI" },
  { value: 'ui-monospace, "SF Mono", Menlo, monospace', label: "Mono" },
  { value: 'Georgia, "Times New Roman", serif', label: "Serif" },
]
const WEIGHTS = ["300", "400", "500", "600", "700"].map((w) => ({ value: w, label: { "300": "Light", "400": "Regular", "500": "Medium", "600": "Semibold", "700": "Bold" }[w]! }))

type SectionId = "typography" | "layout" | "flex" | "radius" | "fill" | "border" | "shadow"

const TITLE: Record<SectionId, string> = {
  typography: "Typography",
  layout: "Layout",
  flex: "Auto layout",
  radius: "Radius",
  fill: "Fill",
  border: "Border",
  shadow: "Shadow",
}

/**
 * Which sections an element gets, always in the same order: Typography → Fill → Border → Layout,
 * then the rest. Text skips box-only sections; anything not set yet (no fill, no border…) collapses
 * to a "+" row at the bottom.
 */
function sectionsFor(kind: ComponentDef["kind"], hasText: boolean): SectionId[] {
  // text gets every section too; box ones start collapsed as "+" rows so any element can grow auto layout, a fill…
  if (kind === "text") return ["typography", "fill", "border", "layout", "flex", "radius", "shadow"]
  // containers (cards, frames, charts) hold many texts, so type isn't theirs to set
  const ownsText = hasText && kind !== "card" && kind !== "frame" && kind !== "chart"
  return [...(ownsText ? (["typography"] as const) : []), "fill", "border", "layout", "flex", "radius", "shadow"]
}

const isSet = {
  flex: (cs: Record<string, string>) => /flex|grid/.test(cs.display),
  fill: (cs: Record<string, string>) => !/rgba\(0, 0, 0, 0\)|transparent/.test(cs["background-color"]),
  border: (cs: Record<string, string>) => cs["border-top-style"] !== "none" && px(cs["border-top-width"]) > 0,
  shadow: (cs: Record<string, string>) => cs["box-shadow"] !== "none",
  radius: (cs: Record<string, string>, kind: string) => px(cs["border-top-left-radius"]) > 0 || (kind !== "text" && (isSet.fill(cs) || isSet.border(cs))),
}

/** Figma-style sizing mode, from what the tool wrote or (failing that) how the element lays out. */
function sizeMode(el: HTMLElement, axis: "width" | "height", written: string | undefined): SizeMode {
  if (written) return written === "100%" ? "fill" : written === "fit-content" || written === "auto" ? "hug" : "fixed"
  const cs = getComputedStyle(el)
  const parent = el.parentElement
  const pcs = parent ? getComputedStyle(parent) : null
  const flexParent = !!pcs && /flex/.test(pcs.display)
  const mainAxis = flexParent && (pcs!.flexDirection.startsWith("row") ? "width" : "height")
  if (axis === "width") {
    if (cs.display.startsWith("inline")) return "hug"
    if (flexParent) return mainAxis === "width" ? (parseFloat(cs.flexGrow) > 0 ? "fill" : "hug") : cs.alignSelf === "stretch" || pcs!.alignItems === "stretch" || pcs!.alignItems === "normal" ? "fill" : "hug"
    return "fill"
  }
  if (flexParent && mainAxis === "height" && parseFloat(cs.flexGrow) > 0) return "fill"
  if (flexParent && mainAxis === "width" && (cs.alignSelf === "stretch" || pcs!.alignItems === "stretch" || pcs!.alignItems === "normal")) return "fill"
  return "hug"
}

const toAxis = (v: string): Axis | null =>
  /^(normal|stretch|flex-start|start|left|baseline)$/.test(v) ? "start" : /center/.test(v) ? "center" : /end|right/.test(v) ? "end" : null
const fromAxis = (a: Axis) => (a === "start" ? "flex-start" : a === "end" ? "flex-end" : "center")

/**
 * Paper / Figma-like inspector scoped to what the selected element is. Values are read from the
 * element in the selected state; every change goes through the same state-scoped op engine.
 */
/** `fill`: grow to the parent's height (v2 inspector) instead of the popover's capped scroll area */
/** What each section edits, so its title can show a dot when any of it changed. */
const SECTION_PROPS: Record<SectionId, string[]> = {
  typography: ["font-family", "font-weight", "font-size", "line-height", "letter-spacing", "color", "text-align", "text-transform"],
  layout: ["width", "height", "min-height", "opacity", "rotate", "left", "top", "position", "overflow"],
  flex: [
    "display", "flex-direction", "flex-wrap", "justify-content", "align-items", "justify-items", "column-gap", "row-gap",
    "grid-template-columns", "grid-template-rows", "grid-auto-flow", "padding-top", "padding-right", "padding-bottom", "padding-left",
  ],
  radius: ["border-radius"],
  fill: ["background-color"],
  border: ["border-color", "border-width", "border-style"],
  shadow: ["box-shadow"],
}

/** Shorthands an edit may write (often from a prompt), spread to the properties the fields read. */
const SHORTHANDS: Record<string, string[]> = {
  padding: ["padding-top", "padding-right", "padding-bottom", "padding-left"],
  gap: ["row-gap", "column-gap"],
  border: ["border-color", "border-width", "border-style"],
  background: ["background-color"],
  "flex-flow": ["flex-direction", "flex-wrap"],
  font: ["font-family", "font-weight", "font-size", "line-height"],
}

/** Every property the element's edits have written for this state (or for all states). */
function changedProps(ops: EditOp[], elId: string, state: string) {
  const out = new Set<string>()
  for (const o of ops) {
    if (o.elId !== elId || (o.state !== state && o.state !== "default")) continue
    for (const k of Object.keys(o.props)) {
      out.add(k)
      for (const p of SHORTHANDS[k] ?? []) out.add(p)
      const side = k.match(/^border-(?:top|right|bottom|left)-(color|width|style)$/)
      if (side) out.add(`border-${side[1]}`)
      if (/^border-(?:top|bottom)-(?:left|right)-radius$/.test(k)) out.add("border-radius")
    }
  }
  return out
}

export function PropertiesPanel({ state, fill }: { state: string; fill?: boolean }) {
  const selection = useTool((s) => s.selection)
  const ops = useTool((s) => s.ops)
  // read synchronously on mount so the panel lays out once at its real height (no placeholder → jump)
  const [cs, setCs] = React.useState<Record<string, string> | null>(() => {
    const first = findEl(selection[0])
    return first ? readSnapshot(first, state) : null
  })
  const [added, setAdded] = React.useState<Set<SectionId>>(new Set())
  const panels = useTool((s) => (selection.length === 1 ? s.customPanels[selection[0]] : undefined))
  const composing = useTool((s) => s.composerOpen)
  const el = findEl(selection[0])
  const info = el ? elInfo(el) : null

  // re-read after edits land in the injected stylesheet (skipped on mount: the initial read covers it)
  const mounted = React.useRef(false)
  React.useEffect(() => {
    if (!mounted.current) {
      mounted.current = true
      return
    }
    if (!el) return
    const raf = requestAnimationFrame(() => setCs(readSnapshot(el, state)))
    return () => cancelAnimationFrame(raf)
  }, [el, state, ops])

  if (!el || !info || !cs) return <div className="h-40" />

  const set = (prop: string, value: string) => applyProps({ [prop]: value })
  const setMany = (props: Record<string, string>) => applyProps(props)
  const tok = (kind: TokenKind, v: string) => matchToken(kind, v)
  const written = (prop: string) => {
    let v: string | undefined
    for (const o of ops) if (o.elId === info.id && (o.state === state || o.state === "default") && o.props[prop] !== undefined) v = o.props[prop]
    return v
  }

  // every property an edit (panel, prompt or text) has changed on this element, for the highlights
  const changed = changedProps(ops, info.id, state)
  const is = (...props: string[]) => props.some((p) => changed.has(p))
  const sectionChanged = (id: SectionId) => is(...SECTION_PROPS[id])

  const kind = info.kind
  const hasText = !!el.innerText?.trim()
  const order = sectionsFor(kind, hasText)
  const active = (id: SectionId) =>
    added.has(id) ||
    id === "typography" ||
    id === "layout" ||
    (id === "flex" && isSet.flex(cs)) ||
    (id === "fill" && isSet.fill(cs)) ||
    (id === "border" && isSet.border(cs)) ||
    (id === "shadow" && isSet.shadow(cs)) ||
    (id === "radius" && isSet.radius(cs, kind))

  const add = (id: SectionId) => {
    setAdded((a) => new Set(a).add(id))
    // inline elements (spans, links) become inline-flex so they keep flowing with the text around them
    if (id === "flex") setMany({ display: cs.display.startsWith("inline") ? "inline-flex" : "flex", "flex-direction": "row", "align-items": "center", "justify-content": "flex-start", gap: "8px" })
    if (id === "fill") set("background-color", tokensOf("color").find((t) => t.name === "muted")?.value ?? "#f4f4f2")
    if (id === "border") setMany({ "border-style": "solid", "border-width": "1px", "border-color": tokensOf("color").find((t) => t.name === "border")?.value ?? "#e5e5e5" })
    if (id === "shadow") set("box-shadow", tokensOf("shadow")[1]?.value ?? "0 1px 3px rgb(0 0 0 / 0.12)")
    if (id === "radius") set("border-radius", tokensOf("radius")[2]?.value ?? "8px")
  }
  const remove = (id: SectionId) => {
    setAdded((a) => {
      const n = new Set(a)
      n.delete(id)
      return n
    })
    if (id === "flex") set("display", "block")
    if (id === "fill") set("background-color", "transparent")
    if (id === "border") setMany({ "border-style": "none", "border-width": "0px" })
    if (id === "shadow") set("box-shadow", "none")
    if (id === "radius") set("border-radius", "0px")
  }

  const wMode = sizeMode(el, "width", written("width"))
  const hMode = sizeMode(el, "height", written("height"))
  const parentRow = !!el.parentElement && /flex/.test(getComputedStyle(el.parentElement).display) && getComputedStyle(el.parentElement).flexDirection.startsWith("row")
  const setSize = (axis: "width" | "height", m: SizeMode) => {
    const along = (axis === "width") === parentRow
    if (m === "fill") setMany({ [axis]: "100%", ...(along ? { "flex-grow": "1" } : { "align-self": "stretch" }) })
    else if (m === "hug") setMany({ [axis]: "fit-content", ...(along ? { "flex-grow": "0" } : {}) })
    else setMany({ [axis]: cs[axis], ...(along ? { "flex-grow": "0" } : {}) })
  }

  const absolute = cs.position === "absolute" || cs.position === "fixed"
  const rotation = px(cs.rotate === "none" ? "0" : cs.rotate)
  // switching to absolute pins the element where it sits now (offsets are from its containing block)
  const toggleAbsolute = (on: boolean) =>
    on
      ? setMany({ position: "absolute", left: `${el.offsetLeft}px`, top: `${el.offsetTop}px`, width: cs.width, "z-index": "1" })
      : setMany({ position: "static", left: "auto", top: "auto" })

  const render: Record<SectionId, () => React.ReactNode> = {
    typography: () => (
      <Section key="typography" title={TITLE.typography} changed={sectionChanged("typography")}>
        <Changed on={is("font-family")}>
          <MiniSelect value={FONTS.find((f) => cs["font-family"].includes(f.label.split(" ")[0]))?.value ?? FONTS[0].value} onChange={(v) => set("font-family", v)} options={FONTS} />
        </Changed>
        <div className="grid grid-cols-2 gap-2">
          <Changed on={is("font-weight")}>
            <MiniSelect value={String(Math.round(px(cs["font-weight"]) / 100) * 100)} onChange={(v) => set("font-weight", v)} options={WEIGHTS} />
          </Changed>
          <Changed on={is("font-size")}>
            <ScrubField label="Aa" kind="fontSize" value={px(cs["font-size"])} token={tok("fontSize", cs["font-size"])} onChange={(v) => set("font-size", v)} min={8} max={96} />
          </Changed>
          <Changed on={is("line-height")}>
            <ScrubField
              label="LH"
              kind="space"
              variable={false}
              value={cs["line-height"] === "normal" ? Math.round(px(cs["font-size"]) * 1.2) : px(cs["line-height"])}
              onChange={(v) => set("line-height", v)}
              max={120}
            />
          </Changed>
          <Changed on={is("letter-spacing")}>
            <ScrubField label="LS" kind="space" variable={false} value={px(cs["letter-spacing"])} min={-5} max={10} step={0.1} onChange={(v) => set("letter-spacing", v)} />
          </Changed>
        </div>
        <Changed on={is("color")}>
          <ColorField value={cs.color} token={tok("color", cs.color)} onChange={(v) => set("color", v)} label="Text color" />
        </Changed>
        <div className="grid grid-cols-[1fr_1.3fr] gap-2">
          <Changed on={is("text-align")}>
          <Seg
            value={cs["text-align"] === "center" ? "center" : cs["text-align"] === "right" || cs["text-align"] === "end" ? "right" : "left"}
            onChange={(v) => setMany({ "text-align": v, ...(isSet.flex(cs) ? { "justify-content": v === "left" ? "flex-start" : v === "right" ? "flex-end" : "center" } : {}) })}
            options={[
              { value: "left", label: <AlignLeft />, title: "Left" },
              { value: "center", label: <AlignCenter />, title: "Center" },
              { value: "right", label: <AlignRight />, title: "Right" },
            ]}
          />
          </Changed>
          <Changed on={is("text-transform")}>
          <Seg
            value={cs["text-transform"] === "uppercase" ? "uppercase" : cs["text-transform"] === "lowercase" ? "lowercase" : cs["text-transform"] === "capitalize" ? "capitalize" : "none"}
            onChange={(v) => set("text-transform", v)}
            options={[
              { value: "none", label: <Minus />, title: "As typed" },
              { value: "uppercase", label: <CaseUpper />, title: "Uppercase" },
              { value: "lowercase", label: <CaseLower />, title: "Lowercase" },
              { value: "capitalize", label: <CaseSensitive />, title: "Title case" },
            ]}
          />
          </Changed>
        </div>
      </Section>
    ),

    layout: () => (
      <Section key="layout" title={TITLE.layout} changed={sectionChanged("layout")}>
        <div className="grid grid-cols-2 gap-2">
          <Changed on={is("width")}>
            <SizeField label="W" value={px(cs.width)} mode={wMode} onValue={(v) => set("width", v)} onMode={(m) => setSize("width", m)} />
          </Changed>
          <Changed on={is("height", "min-height")}>
            <SizeField label="H" value={px(cs.height)} mode={hMode} onValue={(v) => setMany({ height: v, "min-height": v })} onMode={(m) => setSize("height", m)} />
          </Changed>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Changed on={is("opacity")}>
          <ScrubField
            label={<Checker />}
            kind="space"
            variable={false}
            unit="%"
            value={Math.round(px(cs.opacity || "1") * 100)}
            max={100}
            onChange={(v) => set("opacity", String(Math.max(0, Math.min(100, parseFloat(v))) / 100))}
            suffix={<span className="pr-1 text-[12px] text-muted-foreground">%</span>}
          />
          </Changed>
          <Changed on={is("rotate")}>
          <ScrubField
            label={<Angle />}
            kind="space"
            variable={false}
            unit="deg"
            value={rotation}
            min={-360}
            max={360}
            onChange={(v) => set("rotate", /^-?\d+(\.\d+)?$/.test(v.trim()) ? `${v.trim()}deg` : v)}
            suffix={<span className="pr-1 text-[12px] text-muted-foreground">°</span>}
          />
          </Changed>
        </div>
        {absolute && (
          <div className="grid grid-cols-2 gap-2">
            <Changed on={is("left")}>
              <ScrubField label="X" kind="space" variable={false} value={px(cs.left)} min={-4000} max={4000} onChange={(v) => set("left", v)} />
            </Changed>
            <Changed on={is("top")}>
              <ScrubField label="Y" kind="space" variable={false} value={px(cs.top)} min={-4000} max={4000} onChange={(v) => set("top", v)} />
            </Changed>
          </div>
        )}
        <div className="flex flex-col">
          <Changed on={is("position")}>
            <CheckRow checked={absolute} onChange={toggleAbsolute}>
              Absolute position
            </CheckRow>
          </Changed>
          {kind !== "text" && (
            <Changed on={is("overflow")}>
              <CheckRow checked={cs.overflow === "hidden" || cs.overflow === "clip"} onChange={(v) => set("overflow", v ? "hidden" : "visible")}>
                Clip content
              </CheckRow>
            </Changed>
          )}
        </div>
      </Section>
    ),

    flex: () => <AutoLayoutSection key="flex" cs={cs} set={set} setMany={setMany} onRemove={() => remove("flex")} is={is} changed={sectionChanged("flex")} />,

    radius: () => <RadiusSection key="radius" value={px(cs["border-top-left-radius"])} raw={cs["border-top-left-radius"]} onChange={(v) => set("border-radius", v)} onRemove={() => remove("radius")} changed={sectionChanged("radius")} />,

    fill: () => (
      <Section key="fill" title={TITLE.fill} changed={sectionChanged("fill")} right={<RemoveBtn label="Remove fill" onClick={() => remove("fill")} />}>
        <Changed on={is("background-color")}>
          <ColorField value={cs["background-color"]} token={tok("color", cs["background-color"])} onChange={(v) => set("background-color", v)} />
        </Changed>
      </Section>
    ),

    border: () => (
      <Section key="border" title={TITLE.border} changed={sectionChanged("border")} right={<RemoveBtn label="Remove border" onClick={() => remove("border")} />}>
        <Changed on={is("border-color")}>
        <ColorField
          value={cs["border-top-color"]}
          token={tok("color", cs["border-top-color"])}
          onChange={(v) => setMany({ "border-color": v, ...(cs["border-top-style"] === "none" ? { "border-style": "solid", "border-width": "1px" } : {}) })}
        />
        </Changed>
        <div className="grid grid-cols-2 gap-2">
          <Changed on={is("border-width")}>
            <ScrubField label="W" kind="space" variable={false} value={px(cs["border-top-width"])} max={12} step={0.5} onChange={(v) => setMany({ "border-width": v, ...(cs["border-top-style"] === "none" ? { "border-style": "solid" } : {}) })} />
          </Changed>
          <Changed on={is("border-style")}>
          <MiniSelect
            value={cs["border-top-style"]}
            onChange={(v) => set("border-style", v)}
            options={["solid", "dashed", "dotted"].map((s) => ({ value: s, label: s[0].toUpperCase() + s.slice(1) }))}
          />
          </Changed>
        </div>
      </Section>
    ),

    shadow: () => (
      <Section key="shadow" title={TITLE.shadow} changed={sectionChanged("shadow")} right={<RemoveBtn label="Remove shadow" onClick={() => remove("shadow")} />}>
        <Changed on={is("box-shadow")}>
          <TokenInput
            kind="shadow"
            value={cs["box-shadow"] === "none" ? "None" : "Custom"}
            token={tok("shadow", cs["box-shadow"])}
            onCommit={(v) => set("box-shadow", /^none$/i.test(v) ? "none" : v)}
          />
        </Changed>
      </Section>
    ),

  }

  return (
    <div className={cn("no-scrollbar overflow-y-auto", fill ? "h-full" : "max-h-[min(460px,calc(100vh-260px))]")}>
      <CopyBar elIds={selection} />
      {composing ? (
        // writing a Generate custom prompt: everything folds into one row so the prompt has the stage
        <button
          onClick={() => useTool.getState().setComposerOpen(false)}
          className="flex h-10 w-full items-center justify-between px-3 text-[12px] text-muted-foreground transition-colors hover:text-foreground"
        >
          <span>
            {order.length + (panels?.length ?? 0)} sections <span className="text-muted-foreground/70">· collapsed</span>
          </span>
          <ChevronDown className="size-3.5" />
        </button>
      ) : (
        <>
          {selection.length === 1 && hasOwnText(el) && <CopySection el={el} elId={selection[0]} changed={is("$text")} />}
          {/* generated panels lead, newest first */}
          {panels?.map((p) => <CustomSection key={p.id} elId={selection[0]} panel={p} />)}
          {/* fixed order; sections that aren't set yet sit in place as "+" rows */}
          {order.map((id) => (active(id) ? render[id]() : <AddRow key={id} title={TITLE[id]} onAdd={() => add(id)} changed={sectionChanged(id)} />))}
        </>
      )}
    </div>
  )
}

/** The layer's copy, editable here or in place (double-click); each mirrors the other as it's typed. */
function CopySection({ el, elId, changed }: { el: HTMLElement; elId: string; changed: boolean }) {
  const draft = useTool((s) => (s.textDraft?.elId === elId ? s.textDraft.text : null))
  const ops = useTool((s) => s.ops)
  const [value, setValue] = React.useState(() => draft ?? readText(el))
  // the copy when the field took focus; null while it isn't being typed in
  const before = React.useRef<string | null>(null)

  // follow in-place typing, commits and undo / redo, but never while the field itself is being typed in
  React.useEffect(() => {
    if (before.current !== null) return
    if (draft !== null) return setValue(draft)
    const raf = requestAnimationFrame(() => setValue(readText(el)))
    return () => cancelAnimationFrame(raf)
  }, [draft, ops, el])

  const finish = (commit: boolean) => {
    const start = before.current
    if (start === null) return
    before.current = null
    const text = value.trim()
    if (commit && text && text !== start) {
      // lands as the same pinned "Changed text" change a double-click edit makes
      applyText(el, text)
      endPreview(el)
    } else {
      endPreview(el, start)
      setValue(start)
    }
  }
  // switching layers unmounts the field without a blur, so commit on the way out
  const finishRef = React.useRef(finish)
  finishRef.current = finish
  React.useEffect(() => () => finishRef.current(true), [])

  return (
    <Section title="Text" changed={changed}>
      <Changed on={changed}>
      <TextAreaField
        value={value}
        placeholder="Text"
        onFocus={() => {
          before.current = readText(el)
        }}
        onChange={(v) => {
          setValue(v)
          // an empty text node would lose its place next to icons; the page keeps the last copy until there's text again
          if (v.trim()) previewText(el, v)
        }}
        onCommit={() => finish(true)}
        onCancel={() => finish(false)}
      />
      </Changed>
    </Section>
  )
}

function RadiusSection({ value, raw, onChange, onRemove, changed }: { value: number; raw: string; onChange: (v: string) => void; onRemove: () => void; changed: boolean }) {
  const [live, setLive] = React.useState<number | null>(null)
  const v = live ?? Math.min(value, 48)
  return (
    <Section title={TITLE.radius} changed={changed} right={<RemoveBtn label="Remove radius" onClick={onRemove} />}>
      <div className="grid grid-cols-[1fr_120px] items-center gap-3">
        <Slider
          value={[v]}
          min={0}
          max={48}
          step={1}
          onValueChange={([n]) => {
            setLive(n)
            onChange(`${n}px`)
          }}
          onValueCommit={() => setLive(null)}
          className="[&_[data-slot=slider-range]]:bg-[var(--pc-comment)] [&_[data-slot=slider-thumb]]:size-3.5 [&_[data-slot=slider-track]]:bg-[var(--pc-field)]"
        />
        <Changed on={changed}>
          <ScrubField label="" kind="radius" value={live ?? value} token={matchToken("radius", raw)} onChange={onChange} max={999} className="pl-1" />
        </Changed>
      </div>
    </Section>
  )
}


const Angle = () => (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
    <path d="M2.5 13.5h11M2.5 13.5 10 4" />
    <path d="M7 13.5a4.5 4.5 0 0 0-1.4-3.3" />
  </svg>
)

const Checker = () => (
  <span className="size-3 rounded-[3px] bg-[repeating-conic-gradient(currentColor_0_25%,transparent_0_50%)] bg-[length:6px_6px] opacity-70" />
)

/* ───────────────────────── auto layout: real flexbox + grid ───────────────────────── */

const JUSTIFY = [
  { value: "flex-start", label: "Start" },
  { value: "center", label: "Center" },
  { value: "flex-end", label: "End" },
  { value: "space-between", label: "Space between" },
  { value: "space-around", label: "Space around" },
  { value: "space-evenly", label: "Space evenly" },
]
const ALIGN = [
  { value: "flex-start", label: "Start" },
  { value: "center", label: "Center" },
  { value: "flex-end", label: "End" },
  { value: "stretch", label: "Stretch" },
  { value: "baseline", label: "Baseline" },
]
const ITEMS = [
  { value: "start", label: "Start" },
  { value: "center", label: "Center" },
  { value: "end", label: "End" },
  { value: "stretch", label: "Stretch" },
]
/** computed values come back as "normal" / "start"; map them onto the option lists */
const norm = (v: string, list: { value: string }[], fallback: string) => {
  const m: Record<string, string> = { normal: fallback, start: "flex-start", end: "flex-end", left: "flex-start", right: "flex-end", "self-start": "flex-start", "self-end": "flex-end" }
  const x = list.some((o) => o.value === v) ? v : (m[v] ?? fallback)
  return list.some((o) => o.value === x) ? x : list[0].value
}
/** "120px 120px 120px" → 3; "none" → 0 */
const trackCount = (v: string) => (!v || v === "none" ? 0 : v.trim().split(/\s+(?![^(]*\))/).length)
const trackValue = (raw: string) => (/^\d+$/.test(raw.trim()) ? (raw.trim() === "0" ? "none" : `repeat(${raw.trim()}, minmax(0, 1fr))`) : raw)

function AutoLayoutSection({
  cs,
  set,
  setMany,
  onRemove,
  is,
  changed,
}: {
  cs: Record<string, string>
  set: (p: string, v: string) => void
  setMany: (p: Record<string, string>) => void
  onRemove: () => void
  is: (...props: string[]) => boolean
  changed: boolean
}) {
  const grid = /grid/.test(cs.display)
  const inline = cs.display.startsWith("inline")
  const dir = cs["flex-direction"]
  const isCol = dir.startsWith("column")
  const reversed = dir.endsWith("reverse")
  const wraps = cs["flex-wrap"] !== "nowrap"
  const justify = norm(cs["justify-content"], JUSTIFY, "flex-start")
  const align = norm(cs["align-items"], ALIGN, "stretch")
  const spaced = justify.startsWith("space")
  const tok = (v: string) => matchToken("space", v)

  const setDisplay = (d: "flex" | "grid") => {
    if (d === "grid") setMany({ display: inline ? "inline-grid" : "grid", "grid-template-columns": "repeat(2, minmax(0, 1fr))", "column-gap": cs["column-gap"] === "normal" ? "8px" : cs["column-gap"], "row-gap": cs["row-gap"] === "normal" ? "8px" : cs["row-gap"] })
    else setMany({ display: inline ? "inline-flex" : "flex", "flex-direction": "row" })
  }

  const gapPair = (
    <div className="grid grid-cols-2 gap-2">
      <Changed on={is("column-gap")}>
        <ScrubField label={<span title="Column gap">↔</span>} kind="space" value={px(cs["column-gap"])} token={tok(cs["column-gap"])} onChange={(v) => set("column-gap", v)} />
      </Changed>
      <Changed on={is("row-gap")}>
        <ScrubField label={<span title="Row gap">↕</span>} kind="space" value={px(cs["row-gap"])} token={tok(cs["row-gap"])} onChange={(v) => set("row-gap", v)} />
      </Changed>
    </div>
  )

  return (
    <Section
      title={TITLE.flex}
      changed={changed}
      right={
        <div className="flex items-center gap-1">
          <Changed on={is("display")}>
          <Seg
            className="h-6 w-[104px]"
            value={grid ? "grid" : "flex"}
            onChange={setDisplay}
            options={[
              { value: "flex", label: "Flex", title: "display: flex" },
              { value: "grid", label: "Grid", title: "display: grid" },
            ]}
          />
          </Changed>
          <RemoveBtn label="Remove auto layout" onClick={onRemove} />
        </div>
      }
    >
      {!grid ? (
        <>
          <div className="grid grid-cols-[1fr_auto_auto] gap-1">
            <Changed on={is("flex-direction")}>
            <Seg
              value={isCol ? "column" : "row"}
              onChange={(v) => set("flex-direction", reversed ? `${v}-reverse` : v)}
              options={[
                { value: "row", label: <ArrowRight />, title: "flex-direction: row" },
                { value: "column", label: <ArrowDown />, title: "flex-direction: column" },
              ]}
            />
            <IconBtn label="Reverse" active={reversed} onClick={() => set("flex-direction", reversed ? dir.replace("-reverse", "") : `${dir}-reverse`)}>
              <ArrowsReverse />
            </IconBtn>
            </Changed>
            <Changed on={is("flex-wrap")}>
              <IconBtn label="Wrap" active={wraps} onClick={() => set("flex-wrap", wraps ? "nowrap" : "wrap")}>
                <WrapText />
              </IconBtn>
            </Changed>
          </div>
          <div className="grid grid-cols-[84px_1fr] gap-2">
            <Changed on={is("justify-content", "align-items")}>
            <AlignGrid
              x={spaced && !isCol ? null : toAxis(isCol ? align : justify)}
              y={spaced && isCol ? null : toAxis(isCol ? justify : align)}
              onChange={(x, y) => setMany(isCol ? { "align-items": fromAxis(x), "justify-content": fromAxis(y) } : { "justify-content": fromAxis(x), "align-items": fromAxis(y) })}
            />
            </Changed>
            <div className="flex min-w-0 flex-col gap-2">
              <Changed on={is("justify-content")}>
                <MiniSelect value={justify} onChange={(v) => set("justify-content", v)} options={JUSTIFY} prefix={<span className="text-[11px]">Justify</span>} />
              </Changed>
              <Changed on={is("align-items")}>
                <MiniSelect value={align} onChange={(v) => set("align-items", v)} options={ALIGN} prefix={<span className="text-[11px]">Align</span>} />
              </Changed>
            </div>
          </div>
          {wraps ? (
            gapPair
          ) : (
            <Changed on={is(isCol ? "row-gap" : "column-gap")}>
              <ScrubField label={<Space />} kind="space" value={px(cs[isCol ? "row-gap" : "column-gap"])} token={tok(cs[isCol ? "row-gap" : "column-gap"])} onChange={(v) => set("gap", v)} />
            </Changed>
          )}
        </>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2">
            <Changed on={is("grid-template-columns")}>
              <TokenInput
                kind="space"
                variable={false}
                value={String(trackCount(cs["grid-template-columns"]) || "Auto")}
                onCommit={(v) => set("grid-template-columns", trackValue(v))}
                prefix={<span className="text-[12px] text-muted-foreground">Cols</span>}
              />
            </Changed>
            <Changed on={is("grid-template-rows")}>
              <TokenInput
                kind="space"
                variable={false}
                value={String(trackCount(cs["grid-template-rows"]) || "Auto")}
                onCommit={(v) => set("grid-template-rows", /^auto$/i.test(v) ? "none" : trackValue(v))}
                prefix={<span className="text-[12px] text-muted-foreground">Rows</span>}
              />
            </Changed>
          </div>
          {gapPair}
          <div className="grid grid-cols-2 gap-2">
            <Changed on={is("justify-items")}>
              <MiniSelect value={norm(cs["justify-items"], ITEMS, "stretch")} onChange={(v) => set("justify-items", v)} options={ITEMS} prefix={<span className="text-[11px]">Justify</span>} />
            </Changed>
            <Changed on={is("align-items")}>
              <MiniSelect value={norm(cs["align-items"], ITEMS, "stretch")} onChange={(v) => set("align-items", v)} options={ITEMS} prefix={<span className="text-[11px]">Align</span>} />
            </Changed>
          </div>
          <div className="grid grid-cols-[1fr_auto] items-center gap-2">
            <Changed on={is("grid-auto-flow")}>
            <Seg
              value={cs["grid-auto-flow"].startsWith("column") ? "column" : "row"}
              onChange={(v) => set("grid-auto-flow", cs["grid-auto-flow"].includes("dense") ? `${v} dense` : v)}
              options={[
                { value: "row", label: "Flow rows", title: "grid-auto-flow: row" },
                { value: "column", label: "Flow cols", title: "grid-auto-flow: column" },
              ]}
            />
            <CheckRow checked={cs["grid-auto-flow"].includes("dense")} onChange={(d) => set("grid-auto-flow", `${cs["grid-auto-flow"].startsWith("column") ? "column" : "row"}${d ? " dense" : ""}`)}>
              Dense
            </CheckRow>
            </Changed>
          </div>
        </>
      )}
      <div className="grid grid-cols-2 gap-2">
        <Changed on={is("padding-left", "padding-right")}>
          <ScrubField label={<PadX />} kind="space" value={px(cs["padding-left"])} token={tok(cs["padding-left"])} onChange={(v) => setMany({ "padding-left": v, "padding-right": v })} />
        </Changed>
        <Changed on={is("padding-top", "padding-bottom")}>
          <ScrubField label={<PadY />} kind="space" value={px(cs["padding-top"])} token={tok(cs["padding-top"])} onChange={(v) => setMany({ "padding-top": v, "padding-bottom": v })} />
        </Changed>
      </div>
    </Section>
  )
}

const ArrowsReverse = () => (
  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
    <path d="M2.5 5.5h10M10 3l2.5 2.5L10 8M13.5 10.5h-10M6 8l-2.5 2.5L6 13" />
  </svg>
)

/** "4 changes · Copy for agent": hands every edit on the selection to the agent in one paste. */
function CopyBar({ elIds }: { elIds: string[] }) {
  const ops = useTool((s) => s.ops)
  const [copied, setCopied] = React.useState(false)
  const count = React.useMemo(() => {
    const keys = new Set<string>()
    for (const o of ops) if (elIds.includes(o.elId)) for (const k of Object.keys(o.props)) keys.add(`${o.elId}|${o.state}|${k}`)
    return keys.size
  }, [ops, elIds])
  React.useEffect(() => {
    if (!copied) return
    const t = window.setTimeout(() => setCopied(false), 1400)
    return () => window.clearTimeout(t)
  }, [copied])
  if (!count) return null
  return (
    // pinned to the top of the scrolling panel so Copy is always reachable
    <div className="sticky top-0 z-10 flex h-10 items-center justify-between border-b border-border bg-popover px-3">
      <span className="text-[12px] text-muted-foreground">
        {count} {count === 1 ? "change" : "changes"}
      </span>
      <button
        onClick={async () => {
          await copyText(buildElementMarkdown(elIds))
          setCopied(true)
        }}
        className="flex h-6 items-center gap-1 rounded-full bg-[var(--pc-comment)] px-3.5 text-[12px] font-medium text-white transition-[filter,transform] duration-150 hover:brightness-110 active:scale-[0.97] [&_svg]:size-3"
      >
        {copied && <Check />}
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
  )
}
