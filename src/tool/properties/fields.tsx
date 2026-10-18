import * as React from "react"
import { createPortal } from "react-dom"
import { Minus, Plus } from "@/lib/icons"
import { cn } from "@/lib/utils"
import { tokensOf, toHex, type Token, type TokenKind } from "./tokens"

/** Field surface shared with the Prompt tab's text box: tinted fill, hairline border, 1.5px focus ring. */
export const FIELD =
  "rounded-lg bg-[var(--pc-field)] shadow-[inset_0_0_0_1px_var(--pc-field-border)] transition-shadow duration-150"
const FIELD_FOCUS = "focus-within:shadow-[inset_0_0_0_1.5px_var(--pc-comment)]"
/** Segmented track, same as the Prompt / Properties switcher. */
export const TRACK = "rounded-lg bg-muted p-0.5 outline outline-[0.5px] outline-[var(--pc-track-border)]"

/* ───────────────────────── token list ───────────────────────── */

function TokenList({
  anchor,
  items,
  active,
  onPick,
  onHover,
  current,
}: {
  anchor: DOMRect
  items: Token[]
  active: number
  onPick: (t: Token) => void
  onHover: (i: number) => void
  current?: string
}) {
  const below = anchor.bottom + 240 < window.innerHeight
  const w = Math.max(200, anchor.width)
  return createPortal(
    <div
      data-pc-tool
      data-pc-token-list
      className="pc-inverse pc-shadow fixed z-[80] overflow-hidden rounded-xl bg-popover p-1 text-popover-foreground"
      style={{
        width: w,
        left: Math.min(anchor.left, window.innerWidth - w - 8),
        top: below ? anchor.bottom + 4 : undefined,
        bottom: below ? undefined : window.innerHeight - anchor.top + 4,
      }}
      onPointerDown={(e) => e.preventDefault()}
    >
      <div className="px-2 pb-1 pt-1 text-[11px] font-medium text-muted-foreground">Variables</div>
      <div className="no-scrollbar max-h-[220px] overflow-y-auto">
        {items.map((t, i) => (
          <button
            key={t.name}
            onMouseEnter={() => onHover(i)}
            onClick={() => onPick(t)}
            className={cn("flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[12px]", i === active && "bg-accent")}
          >
            {t.kind === "color" ? (
              <span className="size-3.5 shrink-0 rounded-[4px] ring-1 ring-inset ring-[var(--pc-field-border)]" style={{ background: t.resolved }} />
            ) : (
              <VarGlyph className="size-3.5 shrink-0 text-muted-foreground" />
            )}
            <span className={cn("flex-1 truncate", current === t.value && "font-medium text-[var(--pc-comment)]")}>{t.name}</span>
            <span className="truncate text-[11px] text-muted-foreground">
              {t.kind === "color" ? toHex(t.resolved) : t.kind === "shadow" ? "" : t.resolved}
            </span>
          </button>
        ))}
      </div>
    </div>,
    document.body,
  )
}

/** Figma-style variable glyph (a hexagon). */
export function VarGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" className={className} fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round">
      <path d="M8 1.75 13.4 4.9v6.2L8 14.25 2.6 11.1V4.9L8 1.75Z" />
      <circle cx="8" cy="8" r="1.6" />
    </svg>
  )
}

/**
 * Text field that takes raw values or variables. The hexagon button at its end opens the variable
 * list for the field's kind; typing letters (or "$") filters the same list — like Figma / Paper.
 */
export function TokenInput({
  kind,
  value,
  display,
  token,
  onCommit,
  className,
  prefix,
  suffix,
  inputClassName,
  numeric,
  variable = true,
}: {
  kind: TokenKind
  value: string
  display?: string
  token?: Token
  onCommit: (v: string) => void
  className?: string
  prefix?: React.ReactNode
  suffix?: React.ReactNode
  inputClassName?: string
  numeric?: boolean
  /** show the variable picker button */
  variable?: boolean
}) {
  const wrap = React.useRef<HTMLDivElement>(null)
  const ref = React.useRef<HTMLInputElement>(null)
  const [draft, setDraft] = React.useState<string | null>(null)
  const [picker, setPicker] = React.useState(false)
  /** set when a value was already committed by Enter / pick, so the following blur doesn't re-commit a stale draft */
  const committed = React.useRef(false)
  const [active, setActive] = React.useState(0)
  const editing = draft !== null
  const query = (draft ?? "").replace(/^\$|^--|^var\(--/, "").toLowerCase()
  const typedTokens = editing && /^[$a-z-]/i.test(draft ?? "") && !/^#/.test(draft ?? "")
  const all = tokensOf(kind)
  const items = picker ? all : typedTokens ? all.filter((t) => t.name.includes(query)) : []
  const rect = items.length ? wrap.current?.getBoundingClientRect() : undefined

  React.useEffect(() => {
    if (!picker) return
    const close = (e: PointerEvent) => {
      const t = e.target as Element
      if (!wrap.current?.contains(t) && !t.closest?.("[data-pc-token-list]")) setPicker(false)
    }
    const esc = (e: KeyboardEvent) => e.key === "Escape" && (e.stopPropagation(), setPicker(false))
    document.addEventListener("pointerdown", close, true)
    document.addEventListener("keydown", esc, true)
    return () => {
      document.removeEventListener("pointerdown", close, true)
      document.removeEventListener("keydown", esc, true)
    }
  }, [picker])

  const commit = (v: string) => {
    setDraft(null)
    const raw = v.trim()
    if (!raw) return
    const tok = all.find((t) => t.name === raw.replace(/^\$/, ""))
    if (tok) return onCommit(tok.value)
    if (numeric && /^-?\d+(\.\d+)?$/.test(raw)) return onCommit(`${raw}px`)
    onCommit(raw)
  }
  const pick = (t: Token) => {
    committed.current = true
    setDraft(null)
    setPicker(false)
    onCommit(t.value)
    ref.current?.blur()
  }

  return (
    <div ref={wrap} className={cn("group/field relative flex h-7 min-w-0 items-center gap-1.5 pl-2 pr-1", FIELD, FIELD_FOCUS, className)}>
      {prefix}
      {!editing && token ? (
        <button
          onClick={() => setPicker((p) => !p)}
          className="mr-auto flex min-w-0 max-w-full items-center gap-1 truncate rounded-[5px] bg-[var(--pc-pill)] px-1.5 py-px text-left text-[12px]"
        >
          {kind === "color" && <span className="size-2.5 shrink-0 rounded-[3px] ring-1 ring-inset ring-[var(--pc-field-border)]" style={{ background: token.resolved }} />}
          <span className="truncate">{token.name}</span>
        </button>
      ) : (
        <input
          ref={ref}
          value={draft ?? display ?? value}
          onFocus={(e) => {
            committed.current = false
            setDraft(e.target.value)
            requestAnimationFrame(() => e.target.select())
          }}
          onChange={(e) => {
            setDraft(e.target.value)
            setActive(0)
          }}
          onBlur={() => {
            if (!committed.current && draft !== null) commit(draft)
            committed.current = false
          }}
          onKeyDown={(e) => {
            e.stopPropagation()
            if (e.key === "ArrowDown" && items.length) {
              e.preventDefault()
              setActive((a) => (a + 1) % items.length)
            } else if (e.key === "ArrowUp" && items.length) {
              e.preventDefault()
              setActive((a) => (a - 1 + items.length) % items.length)
            } else if (e.key === "Enter") {
              e.preventDefault()
              committed.current = true
              if (items.length) pick(items[Math.min(active, items.length - 1)])
              else commit(draft ?? "")
              ref.current?.blur()
            } else if (e.key === "Escape") {
              committed.current = true
              setDraft(null)
              ref.current?.blur()
            }
          }}
          className={cn("h-full min-w-0 flex-1 bg-transparent text-[12px] tabular-nums text-foreground outline-none", inputClassName)}
          spellCheck={false}
        />
      )}
      {suffix}
      {variable && all.length > 0 && (
        <button
          type="button"
          aria-label="Variables"
          onPointerDown={(e) => e.preventDefault()}
          onClick={() => setPicker((p) => !p)}
          className={cn(
            "grid size-5 shrink-0 place-items-center rounded-[5px] text-muted-foreground transition-[opacity,color,background-color] hover:bg-[var(--pc-pill)] hover:text-foreground",
            token || picker ? "text-[var(--pc-comment)] opacity-100" : "opacity-0 group-hover/field:opacity-100",
          )}
        >
          <VarGlyph className="size-3.5" />
        </button>
      )}
      {rect && (
        <TokenList
          anchor={rect}
          items={items}
          current={token?.value}
          active={Math.min(active, items.length - 1)}
          onHover={setActive}
          onPick={pick}
        />
      )}
    </div>
  )
}

/* ───────────────────────── scrub number ───────────────────────── */

/** Number field whose label scrubs the value on drag (shift = ×10), DialKit / Figma style. */
export function ScrubField({
  label,
  value,
  kind,
  token,
  onChange,
  min = 0,
  max = 999,
  step = 1,
  unit = "px",
  className,
  variable,
  suffix,
}: {
  label: React.ReactNode
  value: number
  kind: TokenKind
  token?: Token
  onChange: (v: string) => void
  min?: number
  max?: number
  step?: number
  unit?: string
  className?: string
  variable?: boolean
  suffix?: React.ReactNode
}) {
  const [live, setLive] = React.useState<number | null>(null)
  const shown = live ?? value
  const startDrag = (e: React.PointerEvent) => {
    e.preventDefault()
    const x0 = e.clientX
    const v0 = value
    const target = e.currentTarget as HTMLElement
    target.setPointerCapture(e.pointerId)
    document.body.style.cursor = "ew-resize"
    const move = (ev: PointerEvent) => {
      const mult = ev.shiftKey ? 10 : 1
      const next = Math.max(min, Math.min(max, +(v0 + Math.round((ev.clientX - x0) / 2) * step * mult).toFixed(2)))
      setLive(next)
      onChange(`${next}${unit}`)
    }
    const up = () => {
      document.body.style.cursor = ""
      setLive(null)
      target.removeEventListener("pointermove", move)
      target.removeEventListener("pointerup", up)
    }
    target.addEventListener("pointermove", move)
    target.addEventListener("pointerup", up)
  }
  return (
    <TokenInput
      kind={kind}
      numeric={unit === "px"}
      variable={variable}
      token={live === null ? token : undefined}
      value={`${Math.abs(shown) >= 10 ? Math.round(shown) : +shown.toFixed(2)}`}
      onCommit={onChange}
      className={className}
      suffix={suffix}
      prefix={
        <span onPointerDown={startDrag} className="grid h-full min-w-3.5 shrink-0 cursor-ew-resize select-none place-items-center text-[12px] text-muted-foreground [&_svg]:size-3.5">
          {label}
        </span>
      }
    />
  )
}

/* ───────────────────────── size (W / H) ───────────────────────── */

export type SizeMode = "fixed" | "hug" | "fill"
const SIZE_LABEL: Record<SizeMode, string> = { fixed: "Fixed", hug: "Hug", fill: "Fill" }

/** Paper-style W / H: a number when fixed, the word "Hug" / "Fill" otherwise, with a mode menu. */
export function SizeField({
  label,
  value,
  mode,
  onValue,
  onMode,
}: {
  label: string
  value: number
  mode: SizeMode
  onValue: (v: string) => void
  onMode: (m: SizeMode) => void
}) {
  return (
    <ScrubField
      label={label}
      kind="space"
      variable={false}
      value={value}
      max={4000}
      onChange={(v) => {
        if (/^hug$/i.test(v)) return onMode("hug")
        if (/^fill$/i.test(v)) return onMode("fill")
        onValue(v)
      }}
      className={cn(mode !== "fixed" && "[&_input]:text-transparent")}
      suffix={
        <>
          {mode !== "fixed" && <span className="pointer-events-none absolute left-[26px] text-[12px] text-foreground">{SIZE_LABEL[mode]}</span>}
          <span className="relative grid size-5 shrink-0 place-items-center text-muted-foreground">
            <Chevron />
            <select
              aria-label={`${label} sizing`}
              value={mode}
              onChange={(e) => onMode(e.target.value as SizeMode)}
              className="absolute inset-0 cursor-pointer opacity-0"
            >
              <option value="fixed">Fixed</option>
              <option value="hug">Hug contents</option>
              <option value="fill">Fill container</option>
            </select>
          </span>
        </>
      }
    />
  )
}

/* ───────────────────────── color ───────────────────────── */

export function ColorField({ value, token, onChange, label }: { value: string; token?: Token; onChange: (v: string) => void; label?: string }) {
  const hex = toHex(value)
  const pickerRef = React.useRef<HTMLInputElement>(null)
  return (
    <TokenInput
      kind="color"
      value={hex.replace(/^#/, "").toUpperCase()}
      token={token}
      onCommit={(v) => onChange(/^[0-9a-f]{3,8}$/i.test(v) ? `#${v}` : v)}
      className="flex-1 pl-1"
      prefix={
        <button
          onClick={() => pickerRef.current?.click()}
          className="relative size-5 shrink-0 overflow-hidden rounded-[5px] ring-1 ring-inset ring-[var(--pc-field-border)]"
          style={{ background: hex === "transparent" ? "repeating-conic-gradient(#bbb 0 25%, #fff 0 50%) 0 0 / 6px 6px" : value }}
          aria-label={label ?? "Pick color"}
        >
          <input
            ref={pickerRef}
            type="color"
            value={hex.startsWith("#") ? hex.slice(0, 7) : "#000000"}
            onChange={(e) => onChange(e.target.value)}
            className="absolute inset-0 cursor-pointer opacity-0"
          />
        </button>
      }
    />
  )
}

/* ───────────────────────── segmented / select / toggles ───────────────────────── */

export function Seg<T extends string>({
  value,
  options,
  onChange,
  className,
}: {
  value: T
  options: { value: T; label: React.ReactNode; title?: string }[]
  onChange: (v: T) => void
  className?: string
}) {
  return (
    <div className={cn("flex h-7 items-center gap-0.5", TRACK, className)}>
      {options.map((o) => (
        <button
          key={o.value}
          title={o.title}
          onClick={() => onChange(o.value)}
          className={cn(
            "grid h-full flex-1 place-items-center rounded-md px-1.5 text-[12px] text-muted-foreground transition-colors [&_svg]:size-3.5",
            value === o.value ? "bg-[var(--pc-pill)] text-foreground shadow-[0_1px_2px_rgb(0_0_0/0.3)]" : "hover:text-foreground",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

const Chevron = () => (
  <svg viewBox="0 0 10 10" className="pointer-events-none size-2.5">
    <path d="M2 4l3 3 3-3" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
  </svg>
)

export function MiniSelect({
  value,
  options,
  onChange,
  prefix,
  className,
}: {
  value: string
  options: { value: string; label: string }[]
  onChange: (v: string) => void
  prefix?: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn("relative flex h-7 min-w-0 items-center", FIELD, FIELD_FOCUS, className)}>
      {prefix && <span className="pointer-events-none pl-2 text-muted-foreground [&_svg]:size-3.5">{prefix}</span>}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn("h-full min-w-0 flex-1 appearance-none bg-transparent pr-6 text-[12px] text-foreground outline-none", prefix ? "pl-1.5" : "pl-2")}
      >
        {!options.some((o) => o.value === value) && <option value={value}>{value}</option>}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <span className="pointer-events-none absolute right-2 text-muted-foreground">
        <Chevron />
      </span>
    </div>
  )
}

/** Square icon button used in section headers and beside fields. */
export function IconBtn({ label, active, onClick, children }: { label: string; active?: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "grid size-7 shrink-0 place-items-center rounded-lg transition-colors [&_svg]:size-3.5",
        active ? "bg-[var(--pc-pill)] text-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground",
      )}
    >
      {children}
    </button>
  )
}

export function CheckRow({ checked, onChange, children }: { checked: boolean; onChange: (v: boolean) => void; children: React.ReactNode }) {
  return (
    <label className="flex h-6 w-fit cursor-pointer select-none items-center gap-2 text-[12px] text-foreground/85">
      <span
        className={cn(
          "grid size-4 place-items-center rounded-[5px] transition-colors",
          checked ? "bg-[var(--pc-comment)] text-white" : "bg-[var(--pc-field)] shadow-[inset_0_0_0_1px_var(--pc-field-border)]",
        )}
      >
        {checked && (
          <svg viewBox="0 0 12 12" className="size-2.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M2.5 6.5 5 9l4.5-6" />
          </svg>
        )}
      </span>
      <input type="checkbox" className="sr-only" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {children}
    </label>
  )
}

/* ───────────────────────── 3×3 alignment ───────────────────────── */

export type Axis = "start" | "center" | "end"
const AXES: Axis[] = ["start", "center", "end"]

/** Paper / Figma alignment pad: x and y are in screen terms; the caller maps them to justify / align. */
export function AlignGrid({ x, y, onChange }: { x: Axis | null; y: Axis | null; onChange: (x: Axis, y: Axis) => void }) {
  return (
    <div className={cn("grid h-full min-h-[76px] grid-cols-3 grid-rows-3 p-1", FIELD)}>
      {AXES.map((ry) =>
        AXES.map((rx) => {
          const on = rx === x && ry === y
          return (
            <button
              key={`${rx}${ry}`}
              aria-label={`Align ${ry} ${rx}`}
              onClick={() => onChange(rx, ry)}
              className="group/dot grid place-items-center rounded-md transition-colors hover:bg-[var(--pc-pill)]"
            >
              {on ? (
                <span className="flex h-2.5 w-3 flex-col justify-between">
                  <span className="h-[3px] rounded-full bg-[var(--pc-comment)]" />
                  <span className="h-[3px] w-2/3 rounded-full bg-[var(--pc-comment)]" />
                </span>
              ) : (
                <span className="size-[3px] rounded-full bg-muted-foreground/70 group-hover/dot:bg-foreground" />
              )}
            </button>
          )
        }),
      )}
    </div>
  )
}

/* ───────────────────────── sections ───────────────────────── */

export function Section({ title, children, right }: { title: string; children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2 border-t border-border px-3 pb-3 pt-2 first:border-t-0">
      <div className="flex h-7 items-center justify-between">
        <span className="text-[12px] font-medium text-foreground">{title}</span>
        <div className="-mr-1 flex items-center">{right}</div>
      </div>
      {children}
    </div>
  )
}

/** An empty section (no fill, no border…) collapsed to its title with a "+" to add it. */
export function AddRow({ title, onAdd }: { title: string; onAdd: () => void }) {
  return (
    <button
      onClick={onAdd}
      className="group/add flex h-10 w-full items-center justify-between border-t border-border px-3 text-[12px] text-muted-foreground transition-colors first:border-t-0 hover:text-foreground"
    >
      {title}
      <span className="-mr-1 grid size-7 place-items-center rounded-lg transition-colors group-hover/add:bg-muted [&_svg]:size-3.5">
        <Plus />
      </span>
    </button>
  )
}

export function RemoveBtn({ onClick, label = "Remove" }: { onClick: () => void; label?: string }) {
  return (
    <IconBtn label={label} onClick={onClick}>
      <Minus />
    </IconBtn>
  )
}
