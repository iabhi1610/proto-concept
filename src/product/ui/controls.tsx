import * as React from "react"
import { cn } from "@/lib/utils"
import { S, defineComponent, useComponentState } from "../system/define"

/* ───────────────────────── Input ───────────────────────── */

export const InputDef = defineComponent({
  name: "Input",
  kind: "input",
  description: "Single-line text field",
  states: [S.default, S.hover, S.focused, S.filled, S.error, S.disabled],
})

type InputProps = Omit<React.ComponentProps<"input">, "size"> & {
  pcId?: string
  pcLabel?: string
  icon?: React.ReactNode
  trailing?: React.ReactNode
  invalid?: boolean
  size?: "sm" | "md"
  wrapperClassName?: string
}

export function Input({
  pcId,
  pcLabel,
  icon,
  trailing,
  invalid,
  disabled,
  size = "md",
  className,
  wrapperClassName,
  defaultValue,
  value,
  onChange,
  ...props
}: InputProps) {
  const [inner, setInner] = React.useState(String(defaultValue ?? ""))
  const current = value !== undefined ? String(value) : inner
  const rest = disabled ? "disabled" : invalid ? "error" : current ? "filled" : "default"
  const { state, attrs, handlers } = useComponentState(InputDef, pcId, rest, pcLabel)
  return (
    <div
      {...attrs}
      {...handlers}
      className={cn(
        "group flex w-full items-center gap-2 rounded-lg border border-input bg-surface text-foreground shadow-[0_1px_2px_rgb(22_23_26/0.04)]",
        "transition-[border-color,box-shadow,background-color] duration-150",
        size === "sm" ? "h-7 px-2 text-[12px]" : "h-9 px-3 text-[13px]",
        "st-hover:border-[#d2d2ce]",
        "st-focused:border-brand st-focused:ring-[3px] st-focused:ring-brand/20",
        "st-error:border-danger st-error:ring-[3px] st-error:ring-danger/15",
        "st-disabled:bg-muted st-disabled:text-subtle st-disabled:shadow-none",
        wrapperClassName,
      )}
    >
      {icon && <span className="text-subtle [&_svg]:size-4">{icon}</span>}
      <input
        {...props}
        disabled={state === "disabled"}
        value={state === "filled" && !current ? String(props.placeholder ?? "Sample value").replace(/^e\.g\.\s*/, "") : current}
        onChange={(e) => {
          if (value === undefined) setInner(e.target.value)
          onChange?.(e)
        }}
        className={cn(
          "h-full min-w-0 flex-1 bg-transparent outline-none placeholder:text-subtle disabled:cursor-not-allowed",
          className,
        )}
      />
      {trailing}
    </div>
  )
}

/* ───────────────────────── Switch ───────────────────────── */

export const SwitchDef = defineComponent({
  name: "Switch",
  kind: "toggle",
  description: "Binary setting toggle",
  states: [S.off, S.on, S.focused, S.disabled],
})

export function Switch({
  pcId,
  pcLabel,
  defaultChecked = false,
  disabled,
  onCheckedChange,
}: {
  pcId?: string
  pcLabel?: string
  defaultChecked?: boolean
  disabled?: boolean
  onCheckedChange?: (v: boolean) => void
}) {
  const [checked, setChecked] = React.useState(defaultChecked)
  const rest = disabled ? "disabled" : checked ? "on" : "off"
  const { state, attrs, handlers } = useComponentState(SwitchDef, pcId, rest, pcLabel)
  const on = state === "on" || (state !== "off" && checked)
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      {...attrs}
      {...handlers}
      disabled={state === "disabled"}
      onClick={() => {
        setChecked(!checked)
        onCheckedChange?.(!checked)
      }}
      className={cn(
        "group relative inline-flex h-[22px] w-[38px] shrink-0 items-center rounded-full border border-transparent p-[2px] outline-none",
        "transition-[background-color,box-shadow] duration-200",
        on ? "bg-brand" : "bg-[#dededa]",
        "st-focused:ring-[3px] st-focused:ring-brand/25",
        "st-disabled:opacity-45",
      )}
    >
      <span
        className={cn(
          "block size-4 rounded-full bg-white shadow-[0_1px_2px_rgb(0_0_0/0.18),0_0_0_0.5px_rgb(0_0_0/0.04)] transition-transform duration-200",
          on ? "translate-x-4" : "translate-x-0",
        )}
      />
    </button>
  )
}

/* ───────────────────────── Segmented control ───────────────────────── */

export const SegmentDef = defineComponent({
  name: "SegmentItem",
  kind: "nav",
  description: "Item inside a segmented control",
  states: [S.default, S.hover, S.selected],
})

export function Segmented<T extends string>({
  pcId,
  options,
  value,
  onChange,
  className,
}: {
  pcId?: string
  options: { value: T; label: React.ReactNode }[]
  value: T
  onChange: (v: T) => void
  className?: string
}) {
  return (
    <div
      data-pc-id={pcId}
      data-pc-component="Frame"
      data-pc-label="Segmented control"
      className={cn("inline-flex h-8 items-center gap-0.5 rounded-lg border border-border bg-muted p-0.5", className)}
    >
      {options.map((o) => (
        <SegmentItem
          key={o.value}
          pcId={pcId ? `${pcId}.${o.value}` : undefined}
          selected={o.value === value}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </SegmentItem>
      ))}
    </div>
  )
}

function SegmentItem({
  pcId,
  selected,
  children,
  onClick,
}: {
  pcId?: string
  selected: boolean
  children: React.ReactNode
  onClick: () => void
}) {
  const { attrs, handlers } = useComponentState(SegmentDef, pcId, selected ? "selected" : "default")
  return (
    <button
      type="button"
      {...attrs}
      {...handlers}
      onClick={onClick}
      className={cn(
        "h-full rounded-[6px] px-2.5 text-[12px] font-medium text-muted-foreground transition-[background-color,color,box-shadow] duration-150",
        "st-hover:text-foreground",
        "st-selected:bg-surface st-selected:text-foreground st-selected:shadow-[0_1px_2px_rgb(22_23_26/0.08),0_0_0_0.5px_rgb(22_23_26/0.06)]",
      )}
    >
      {children}
    </button>
  )
}

/* ───────────────────────── Filter chip ───────────────────────── */

export const ChipDef = defineComponent({
  name: "FilterChip",
  kind: "button",
  description: "Toggleable filter pill",
  states: [S.default, S.hover, S.active],
})

export function FilterChip({
  pcId,
  active,
  count,
  children,
  onClick,
}: {
  pcId?: string
  active?: boolean
  count?: number
  children: React.ReactNode
  onClick?: () => void
}) {
  const { attrs, handlers } = useComponentState(ChipDef, pcId, active ? "active" : "default")
  return (
    <button
      type="button"
      {...attrs}
      {...handlers}
      onClick={onClick}
      className={cn(
        "group inline-flex h-7 items-center gap-1.5 rounded-full border border-border bg-surface px-3 text-[12px] font-medium text-muted-foreground transition-colors duration-150",
        "st-hover:border-input st-hover:text-foreground",
        "st-active:border-primary st-active:bg-primary st-active:text-primary-foreground",
      )}
    >
      {children}
      {count !== undefined && (
        <span className="tabular rounded-full bg-muted px-1.5 text-[10.5px] text-muted-foreground group-st-active:bg-white/15 group-st-active:text-white">
          {count}
        </span>
      )}
    </button>
  )
}

/* ───────────────────────── Badge ───────────────────────── */

export const BadgeDef = defineComponent({
  name: "Badge",
  kind: "badge",
  description: "Static status label",
  states: [S.default],
})

const badgeTones = {
  neutral: "bg-muted text-muted-foreground border-border",
  brand: "bg-brand-soft text-[#d9480f] border-[#ffd9c7]",
  success: "bg-success-soft text-success border-[#c7ecdc]",
  danger: "bg-danger-soft text-danger border-[#f8cfd0]",
  dark: "bg-primary text-primary-foreground border-primary",
  outline: "bg-surface text-foreground border-border",
}

export function Badge({
  pcId,
  tone = "neutral",
  children,
  className,
  dot,
}: {
  pcId?: string
  tone?: keyof typeof badgeTones
  children: React.ReactNode
  className?: string
  dot?: boolean
}) {
  const { attrs } = useComponentState(BadgeDef, pcId)
  return (
    <span
      {...attrs}
      className={cn(
        "inline-flex h-5 items-center gap-1 whitespace-nowrap rounded-md border px-1.5 text-[11px] font-medium",
        badgeTones[tone],
        className,
      )}
    >
      {dot && <span className="size-1.5 rounded-full bg-current" />}
      {children}
    </span>
  )
}

/* ───────────────────────── Avatar ───────────────────────── */

export const AvatarDef = defineComponent({ name: "Avatar", kind: "badge", states: [S.default] })

const avatarColors = ["#ffd9c7", "#d6e4ff", "#d9f2e6", "#f1dcff", "#ffe8a3", "#e3e3df"]

export function Avatar({ name, pcId, size = 24, className }: { name: string; pcId?: string; size?: number; className?: string }) {
  const { attrs } = useComponentState(AvatarDef, pcId)
  const initials = name
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase()
  const color = avatarColors[name.length % avatarColors.length]
  return (
    <span
      {...attrs}
      className={cn("inline-grid shrink-0 place-items-center rounded-full font-semibold text-[#16171a]/80 ring-2 ring-surface", className)}
      style={{ width: size, height: size, fontSize: size * 0.4, background: color }}
    >
      {initials}
    </span>
  )
}
