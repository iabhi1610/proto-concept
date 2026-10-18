import * as React from "react"
import { Sparkles } from "@/lib/icons"
import { Switch } from "@/components/ui/switch"
import { cn } from "@/lib/utils"
import { applyProps } from "../actions"
import { controlProps, type CustomControl, type CustomPanel } from "../engine/customControls"
import { useTool } from "../store"
import { FIELD, RemoveBtn, Section, Seg } from "./fields"

/** A generated panel: named DialKit-style controls, each writing real CSS to the element. */
export function CustomSection({ elId, panel }: { elId: string; panel: CustomPanel }) {
  const setValue = useTool((s) => s.setCustomValue)
  const remove = useTool((s) => s.removeCustomPanel)
  const change = (c: CustomControl, v: number | boolean | string) => {
    setValue(elId, panel.id, c.id, v)
    applyProps(controlProps(c, v), [], { state: panel.state })
  }
  return (
    <Section
      title={panel.title}
      right={
        <div className="flex items-center gap-1">
          {panel.state !== "default" && <span className="rounded-md bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">on {panel.state}</span>}
          <RemoveBtn label="Remove custom controls" onClick={() => remove(elId, panel.id)} />
        </div>
      }
    >
      <span className="-mt-1.5 flex items-center gap-1 truncate text-[11.5px] text-muted-foreground [&_svg]:size-3">
        <Sparkles className="shrink-0 text-[var(--pc-comment)]" /> “{panel.prompt}”
      </span>
      <div className="flex flex-col gap-1.5">
        {panel.controls.map((c) =>
          c.kind === "slider" ? (
            <DialSlider key={c.id} control={c} onChange={(v) => change(c, v)} />
          ) : c.kind === "toggle" ? (
            <label key={c.id} className={cn("flex h-8 cursor-pointer items-center justify-between px-2.5 text-[12px]", FIELD)}>
              <span className="text-foreground/85">{c.label}</span>
              <Switch size="sm" checked={c.value} onCheckedChange={(v) => change(c, v)} className="data-checked:bg-[var(--pc-comment)]" />
            </label>
          ) : (
            <div key={c.id} className="flex flex-col gap-1">
              <span className="px-0.5 text-[11.5px] text-muted-foreground">{c.label}</span>
              <Seg value={c.value} onChange={(v) => change(c, v)} options={c.options.map((o) => ({ value: o.value, label: o.label }))} />
            </div>
          ),
        )}
      </div>
    </Section>
  )
}

/** DialKit-style slider: the whole bar is the handle; fill shows the value, label left, value right. */
function DialSlider({ control, onChange }: { control: Extract<CustomControl, { kind: "slider" }>; onChange: (v: number) => void }) {
  const ref = React.useRef<HTMLDivElement>(null)
  const [live, setLive] = React.useState<number | null>(null)
  const v = live ?? control.value
  const { min, max, step } = control
  const pct = ((v - min) / (max - min)) * 100
  const zero = min < 0 ? ((0 - min) / (max - min)) * 100 : 0

  const valueAt = (clientX: number) => {
    const r = ref.current!.getBoundingClientRect()
    const t = Math.max(0, Math.min(1, (clientX - r.left) / r.width))
    return +(Math.round((min + t * (max - min)) / step) * step).toFixed(3)
  }
  const onDown = (e: React.PointerEvent) => {
    e.preventDefault()
    const el = e.currentTarget as HTMLElement
    el.setPointerCapture(e.pointerId)
    const set = (x: number) => {
      const n = valueAt(x)
      setLive(n)
      onChange(n)
    }
    set(e.clientX)
    const move = (ev: PointerEvent) => set(ev.clientX)
    const up = () => {
      setLive(null)
      el.removeEventListener("pointermove", move)
      el.removeEventListener("pointerup", up)
    }
    el.addEventListener("pointermove", move)
    el.addEventListener("pointerup", up)
  }
  const nudge = (d: number) => onChange(Math.max(min, Math.min(max, +(v + d * step).toFixed(3))))

  return (
    <div
      ref={ref}
      role="slider"
      tabIndex={0}
      aria-label={control.label}
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={v}
      onPointerDown={onDown}
      onKeyDown={(e) => {
        if (e.key === "ArrowRight" || e.key === "ArrowUp") (e.preventDefault(), e.stopPropagation(), nudge(e.shiftKey ? 10 : 1))
        if (e.key === "ArrowLeft" || e.key === "ArrowDown") (e.preventDefault(), e.stopPropagation(), nudge(e.shiftKey ? -10 : -1))
      }}
      className={cn("relative flex h-8 cursor-ew-resize touch-none select-none items-center justify-between overflow-hidden px-2.5 text-[12px] outline-none focus-visible:shadow-[inset_0_0_0_1.5px_var(--pc-comment)]", FIELD)}
    >
      <span
        className="pointer-events-none absolute inset-y-0 bg-[var(--pc-pill)] transition-[left,width] duration-75"
        style={{ left: `${Math.min(zero, pct)}%`, width: `${Math.abs(pct - zero)}%` }}
      />
      <span className="relative text-foreground/85">{control.label}</span>
      <span className="relative tabular-nums text-muted-foreground">
        {Number.isInteger(v) ? v : v.toFixed(1)}
        {control.unit}
      </span>
    </div>
  )
}
