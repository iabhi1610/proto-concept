import * as React from "react"
import { ArrowDownRight, ArrowUpRight } from "@/lib/icons"
import { cn } from "@/lib/utils"
import { S, defineComponent, useComponentState } from "../system/define"

/* ───────────────────────── Nav item ───────────────────────── */

export const NavItemDef = defineComponent({
  name: "NavItem",
  kind: "nav",
  description: "Sidebar navigation link",
  states: [S.default, S.hover, S.active],
})

export function NavItem({
  pcId,
  icon,
  label,
  active,
  badge,
  onClick,
}: {
  pcId?: string
  icon: React.ReactNode
  label: string
  active?: boolean
  badge?: React.ReactNode
  onClick?: () => void
}) {
  const { attrs, handlers } = useComponentState(NavItemDef, pcId, active ? "active" : "default", label)
  return (
    <button
      type="button"
      {...attrs}
      {...handlers}
      onClick={onClick}
      className={cn(
        "group flex h-8 w-full items-center gap-2.5 rounded-lg px-2.5 text-[13px] font-medium text-muted-foreground transition-colors duration-150",
        "st-hover:bg-[#ededea] st-hover:text-foreground",
        "st-active:bg-surface st-active:text-foreground st-active:shadow-[0_1px_2px_rgb(22_23_26/0.06),0_0_0_0.5px_rgb(22_23_26/0.08)]",
      )}
    >
      <span className="text-subtle transition-colors group-st-hover:text-foreground group-st-active:text-brand [&_svg]:size-4">{icon}</span>
      <span className="flex-1 text-left">{label}</span>
      {badge}
    </button>
  )
}

/* ───────────────────────── Card frame ───────────────────────── */

export const CardDef = defineComponent({ name: "Card", kind: "card", description: "Content container", states: [S.default] })

export function Card({
  pcId,
  pcLabel,
  className,
  children,
  ...props
}: React.ComponentProps<"div"> & { pcId?: string; pcLabel?: string }) {
  const { attrs } = useComponentState(CardDef, pcId, "default", pcLabel)
  return (
    <div
      {...attrs}
      {...props}
      className={cn("rounded-xl border border-border bg-card shadow-[0_1px_2px_rgb(22_23_26/0.04)]", className)}
    >
      {children}
    </div>
  )
}

/* ───────────────────────── Stat card ───────────────────────── */

export const StatCardDef = defineComponent({
  name: "StatCard",
  kind: "card",
  description: "KPI metric card",
  states: [S.default, S.hover, S.loading],
})

export interface Stat {
  key: string
  label: string
  value: string
  delta: number
  hint: string
  spark: number[]
}

export function Delta({ value, className }: { value: number; className?: string }) {
  const up = value >= 0
  return (
    <span
      className={cn(
        "tabular inline-flex items-center gap-0.5 rounded-md px-1 py-px text-[11.5px] font-semibold",
        up ? "bg-success-soft text-success" : "bg-danger-soft text-danger",
        className,
      )}
    >
      {up ? <ArrowUpRight className="size-3" strokeWidth={2.5} /> : <ArrowDownRight className="size-3" strokeWidth={2.5} />}
      {Math.abs(value).toFixed(1)}%
    </span>
  )
}

export function StatCard({
  stat,
  pcId,
  className,
  children,
  loading,
}: {
  stat: Stat
  pcId?: string
  className?: string
  children?: React.ReactNode
  loading?: boolean
}) {
  const { state, attrs, handlers } = useComponentState(StatCardDef, pcId, loading ? "loading" : "default", stat.label)
  const isLoading = state === "loading"
  return (
    <div
      {...attrs}
      {...handlers}
      className={cn(
        "group relative flex flex-col gap-3 rounded-xl border border-border bg-card p-4 shadow-[0_1px_2px_rgb(22_23_26/0.04)]",
        "transition-[border-color,box-shadow,transform] duration-200",
        "st-hover:border-[#dcdcd8] st-hover:shadow-[0_2px_4px_rgb(22_23_26/0.04),0_8px_20px_rgb(22_23_26/0.06)]",
        className,
      )}
    >
      <div className="flex items-center justify-between">
        <span className="text-[12.5px] font-medium text-muted-foreground">{stat.label}</span>
        {!isLoading && <Delta value={stat.delta} />}
      </div>
      {isLoading ? (
        <div className="flex flex-col gap-2">
          <div className="h-7 w-28 animate-pulse rounded-md bg-muted" />
          <div className="h-3 w-36 animate-pulse rounded bg-muted" />
        </div>
      ) : (
        <div className="flex flex-col gap-1">
          <span className="tabular text-[26px] font-semibold leading-none tracking-[-0.02em] text-foreground">{stat.value}</span>
          <span className="text-[12px] text-subtle">{stat.hint}</span>
        </div>
      )}
      {!isLoading && children}
    </div>
  )
}

/* ───────────────────────── Table row ───────────────────────── */

export const TableRowDef = defineComponent({
  name: "TableRow",
  kind: "row",
  description: "Data table row",
  states: [S.default, S.hover, S.selected],
})

export function TableRow({
  pcId,
  pcLabel,
  selected,
  className,
  children,
  onClick,
}: {
  pcId?: string
  pcLabel?: string
  selected?: boolean
  className?: string
  children: React.ReactNode
  onClick?: () => void
}) {
  const { attrs, handlers } = useComponentState(TableRowDef, pcId, selected ? "selected" : "default", pcLabel)
  return (
    <tr
      {...attrs}
      {...handlers}
      onClick={onClick}
      className={cn(
        "group border-b border-border transition-colors duration-100 last:border-b-0",
        "st-hover:bg-[#f8f8f6]",
        "st-selected:bg-brand-soft/70",
        className,
      )}
    >
      {children}
    </tr>
  )
}

/* ───────────────────────── Chart card ───────────────────────── */

export const ChartCardDef = defineComponent({
  name: "ChartCard",
  kind: "chart",
  description: "Card that hosts a chart",
  states: [S.default, S.loading, S.empty],
})

export function ChartCard({
  pcId,
  title,
  subtitle,
  actions,
  className,
  children,
  empty,
}: {
  pcId?: string
  title: React.ReactNode
  subtitle?: React.ReactNode
  actions?: React.ReactNode
  className?: string
  children: React.ReactNode
  empty?: React.ReactNode
}) {
  const { state, attrs, handlers } = useComponentState(ChartCardDef, pcId, "default", typeof title === "string" ? title : undefined)
  return (
    <div
      {...attrs}
      {...handlers}
      className={cn(
        "flex flex-col rounded-xl border border-border bg-card shadow-[0_1px_2px_rgb(22_23_26/0.04)] transition-[border-color,box-shadow] duration-200",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-4 px-5 pt-4">
        <div className="flex flex-col gap-0.5">
          <div className="text-[14px] font-semibold tracking-[-0.01em] text-foreground">{title}</div>
          {subtitle && <div className="text-[12.5px] text-muted-foreground">{subtitle}</div>}
        </div>
        {actions}
      </div>
      <div className="relative min-h-0 flex-1 px-2 pb-3 pt-2">
        {state === "loading" ? (
          <div className="flex h-full min-h-[220px] items-end gap-1.5 px-3 pb-2">
            {Array.from({ length: 30 }).map((_, i) => (
              <div
                key={i}
                className="flex-1 animate-pulse rounded-t bg-muted"
                style={{ height: `${30 + Math.abs(Math.sin(i * 0.6)) * 55}%`, animationDelay: `${i * 30}ms` }}
              />
            ))}
          </div>
        ) : state === "empty" ? (
          <div className="grid h-full min-h-[220px] place-items-center">
            {empty ?? (
              <div className="flex flex-col items-center gap-1 text-center">
                <span className="text-[13px] font-medium text-foreground">No data for this period</span>
                <span className="text-[12px] text-muted-foreground">Try a wider date range or check your tracking plan.</span>
              </div>
            )}
          </div>
        ) : (
          children
        )}
      </div>
    </div>
  )
}
