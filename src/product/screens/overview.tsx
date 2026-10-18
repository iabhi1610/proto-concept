import * as React from "react"
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import { CalendarDays, ChevronDown, Download, FileBarChart, Plus, Share2, Sparkles } from "@/lib/icons"
import { cn } from "@/lib/utils"
import { useVariantChoice } from "@/tool/store"
import { activeUsersSeries, kpis, liveUsers, topEvents } from "../data"
import { AppFrame, PageHeader, usePcId } from "../shell"
import { pc } from "../system/define"
import { Button } from "../ui/button"
import { Avatar, Badge, Segmented } from "../ui/controls"
import { Card, ChartCard, Delta, StatCard } from "../ui/surfaces"

/* ───────────────────────── Variant slot: header actions ───────────────────────── */

export function OverviewActions({ option }: { option?: string }) {
  const chosen = useVariantChoice("overview.actions")
  const v = option ?? chosen
  const id = usePcId()
  const slot = { ...pc(id("overview.actions"), "Frame", "Header actions"), "data-pc-variant-set": "vs-actions" }

  if (v === "actions-split")
    return (
      <div {...slot} className="flex items-center gap-2">
        <Button pcId={id("overview.actions.share")} variant="ghost" size="icon" aria-label="Share">
          <Share2 />
        </Button>
        <div className="flex items-center">
          <Button pcId={id("overview.actions.create")} variant="primary" className="rounded-r-none border-r-white/15">
            <Plus /> Create report
          </Button>
          <Button pcId={id("overview.actions.menu")} variant="primary" size="icon" className="w-7 rounded-l-none" aria-label="More">
            <ChevronDown />
          </Button>
        </div>
      </div>
    )
  if (v === "actions-icons")
    return (
      <div {...slot} className="flex items-center gap-1">
        <Button pcId={id("overview.actions.export")} variant="ghost" size="icon" aria-label="Export">
          <Download />
        </Button>
        <Button pcId={id("overview.actions.share")} variant="ghost" size="icon" aria-label="Share">
          <Share2 />
        </Button>
        <span className="mx-1 h-5 w-px bg-border" />
        <Button pcId={id("overview.actions.create")} variant="primary">
          <Plus /> New
        </Button>
      </div>
    )
  if (v === "actions-brand")
    return (
      <div {...slot} className="flex items-center gap-2">
        <Button pcId={id("overview.actions.share")} variant="ghost">
          <Share2 /> Share
        </Button>
        <Button pcId={id("overview.actions.create")} variant="brand">
          <Sparkles /> Create report
        </Button>
      </div>
    )
  return (
    <div {...slot} className="flex items-center gap-2">
      <Button pcId={id("overview.actions.share")} variant="outline">
        <Share2 /> Share
      </Button>
      <Button pcId={id("overview.actions.create")} variant="primary">
        <Plus /> Create report
      </Button>
    </div>
  )
}

/* ───────────────────────── Variant slot: KPI cards ───────────────────────── */

function Sparkline({ data, className, color = "var(--brand)" }: { data: number[]; className?: string; color?: string }) {
  const max = Math.max(...data)
  const min = Math.min(...data)
  const pts = data.map((d, i) => `${(i / (data.length - 1)) * 100},${28 - ((d - min) / (max - min || 1)) * 24 - 2}`).join(" ")
  const gid = React.useId()
  return (
    <svg viewBox="0 0 100 28" preserveAspectRatio="none" className={cn("h-8 w-full", className)}>
      <defs>
        <linearGradient id={gid} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor={color} stopOpacity="0.18" />
          <stop offset="1" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={`0,28 ${pts} 100,28`} fill={`url(#${gid})`} />
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.6" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
    </svg>
  )
}

export function OverviewKpis({ option }: { option?: string }) {
  const chosen = useVariantChoice("overview.kpis")
  const v = option ?? chosen
  const id = usePcId()
  const slot = { ...pc(id("overview.kpis"), "Frame", "KPI cards"), "data-pc-variant-set": "vs-kpis" }

  if (v === "kpi-strip")
    return (
      <div {...slot} className="grid grid-cols-4 divide-x divide-border rounded-xl border border-border bg-card shadow-[0_1px_2px_rgb(22_23_26/0.04)]">
        {kpis.map((k) => (
          <div key={k.key} {...pc(id(`overview.kpi.${k.key}`), "Frame", k.label)} className="flex flex-col gap-1.5 px-5 py-3.5">
            <span className="text-[12px] font-medium text-muted-foreground">{k.label}</span>
            <div className="flex items-baseline gap-2">
              <span className="tabular text-[20px] font-semibold tracking-[-0.02em]">{k.value}</span>
              <Delta value={k.delta} />
            </div>
          </div>
        ))}
      </div>
    )
  if (v === "kpi-hero") {
    const [hero, ...rest] = kpis
    return (
      <div {...slot} className="grid grid-cols-[1.4fr_1fr] gap-3">
        <StatCard pcId={id(`overview.kpi.${hero.key}`)} stat={hero} className="justify-between bg-primary text-primary-foreground [&_span]:!text-inherit">
          <Sparkline data={hero.spark} className="h-14" color="#ff6a2b" />
        </StatCard>
        <div className="grid grid-rows-3 gap-2">
          {rest.map((k) => (
            <div
              key={k.key}
              {...pc(id(`overview.kpi.${k.key}`), "Frame", k.label)}
              className="flex items-center justify-between rounded-xl border border-border bg-card px-4 shadow-[0_1px_2px_rgb(22_23_26/0.04)]"
            >
              <span className="text-[12.5px] font-medium text-muted-foreground">{k.label}</span>
              <div className="flex items-center gap-2">
                <span className="tabular text-[16px] font-semibold">{k.value}</span>
                <Delta value={k.delta} />
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }
  return (
    <div {...slot} className="grid grid-cols-4 gap-3">
      {kpis.map((k) => (
        <StatCard key={k.key} pcId={id(`overview.kpi.${k.key}`)} stat={k}>
          {v === "kpi-sparkline" && <Sparkline data={k.spark} color={k.delta >= 0 ? "#0f9d6b" : "#e5484d"} />}
        </StatCard>
      ))}
    </div>
  )
}

/* ───────────────────────── Variant slot: chart ───────────────────────── */

function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: { name: string; value: number; color: string }[]; label?: string }) {
  if (!active || !payload?.length) return null
  return (
    <div className="min-w-36 rounded-lg border border-border bg-surface px-3 py-2 text-[12px] shadow-[0_8px_24px_rgb(22_23_26/0.12)]">
      <div className="mb-1 font-medium text-foreground">{label}</div>
      {payload.map((p) => (
        <div key={p.name} className="flex items-center justify-between gap-4 text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="size-2 rounded-full" style={{ background: p.color }} />
            {p.name}
          </span>
          <span className="tabular font-medium text-foreground">{p.value.toLocaleString()}</span>
        </div>
      ))}
    </div>
  )
}

const axisProps = {
  tickLine: false,
  axisLine: false,
  tick: { fill: "#9a9ca3", fontSize: 11, fontFamily: "Timeless Sans" },
} as const

function ChartBody({ v, height }: { v: string; height: number }) {
  const data = activeUsersSeries
  const fmt = (n: number) => `${Math.round(n / 1000)}k`
  return (
    // debounced: when the page width animates (docked variants sidebar) the chart redraws a few times, not every frame
    <ResponsiveContainer width="100%" height={height} debounce={90}>
      {v === "chart-bars" ? (
        <BarChart data={data} margin={{ left: 0, right: 12, top: 8 }}>
          <CartesianGrid vertical={false} stroke="#efefec" />
          <XAxis dataKey="date" {...axisProps} interval={4} />
          <YAxis {...axisProps} tickFormatter={fmt} width={40} />
          <Tooltip content={<ChartTooltip />} cursor={{ fill: "#f4f4f2" }} />
          <Bar dataKey="users" name="Active users" fill="#ff6a2b" radius={[4, 4, 0, 0]} isAnimationActive={false} />
        </BarChart>
      ) : v === "chart-compare" ? (
        <LineChart data={data} margin={{ left: 0, right: 12, top: 8 }}>
          <CartesianGrid vertical={false} stroke="#efefec" />
          <XAxis dataKey="date" {...axisProps} interval={4} />
          <YAxis {...axisProps} tickFormatter={fmt} width={40} />
          <Tooltip content={<ChartTooltip />} />
          <Line dataKey="prev" name="Previous period" stroke="#b8bac0" strokeDasharray="4 4" dot={false} strokeWidth={1.5} isAnimationActive={false} />
          <Line dataKey="users" name="This period" stroke="#16171a" dot={false} strokeWidth={2} isAnimationActive={false} />
        </LineChart>
      ) : v === "chart-stacked" ? (
        <AreaChart data={data} margin={{ left: 0, right: 12, top: 8 }}>
          <CartesianGrid vertical={false} stroke="#efefec" />
          <XAxis dataKey="date" {...axisProps} interval={4} />
          <YAxis {...axisProps} tickFormatter={fmt} width={40} />
          <Tooltip content={<ChartTooltip />} />
          <Area dataKey="android" name="Android" stackId="1" stroke="#ffd9c7" fill="#ffd9c7" fillOpacity={1} isAnimationActive={false} />
          <Area dataKey="ios" name="iOS" stackId="1" stroke="#ffb08a" fill="#ffb08a" fillOpacity={1} isAnimationActive={false} />
          <Area dataKey="web" name="Web" stackId="1" stroke="#ff6a2b" fill="#ff6a2b" fillOpacity={1} isAnimationActive={false} />
        </AreaChart>
      ) : (
        <AreaChart data={data} margin={{ left: 0, right: 12, top: 8 }}>
          <defs>
            <linearGradient id="orbit-area" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0" stopColor="#ff6a2b" stopOpacity={0.22} />
              <stop offset="1" stopColor="#ff6a2b" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke="#efefec" />
          <XAxis dataKey="date" {...axisProps} interval={4} />
          <YAxis {...axisProps} tickFormatter={fmt} width={40} />
          <Tooltip content={<ChartTooltip />} cursor={{ stroke: "#d0d0cc", strokeDasharray: "3 3" }} />
          <Area dataKey="users" name="Active users" stroke="#ff6a2b" strokeWidth={2} fill="url(#orbit-area)" isAnimationActive={false} />
        </AreaChart>
      )}
    </ResponsiveContainer>
  )
}

const LEGENDS: Record<string, { label: string; color: string; dashed?: boolean }[]> = {
  original: [{ label: "Active users", color: "#ff6a2b" }],
  "chart-bars": [{ label: "Daily active users", color: "#ff6a2b" }],
  "chart-compare": [
    { label: "This period", color: "#16171a" },
    { label: "Previous period", color: "#b8bac0", dashed: true },
  ],
  "chart-stacked": [
    { label: "Web", color: "#ff6a2b" },
    { label: "iOS", color: "#ffb08a" },
    { label: "Android", color: "#ffd9c7" },
  ],
}

export function OverviewChart({ option, height = 260 }: { option?: string; height?: number }) {
  const chosen = useVariantChoice("overview.chart")
  const v = option ?? chosen
  const id = usePcId()
  return (
    <div data-pc-variant-set="vs-chart" data-pc-slot={id("overview.chart")}>
      <ChartCard
        pcId={id("overview.chart")}
        title="Active users"
        subtitle={
          <span className="flex items-center gap-2">
            <span className="tabular text-[22px] font-semibold tracking-[-0.02em] text-foreground">48,213</span>
            <Delta value={12.4} />
            <span className="text-subtle">vs. previous 30 days</span>
          </span>
        }
        actions={
          <div className="flex items-center gap-3 pt-1">
            {(LEGENDS[v] ?? LEGENDS.original).map((l) => (
              <span key={l.label} className="flex items-center gap-1.5 text-[12px] text-muted-foreground">
                <span
                  className={cn("h-0.5 w-3 rounded-full", l.dashed && "border-t-2 border-dashed bg-transparent")}
                  style={{ background: l.dashed ? undefined : l.color, borderColor: l.color }}
                />
                {l.label}
              </span>
            ))}
          </div>
        }
      >
        <ChartBody v={v} height={height} />
      </ChartCard>
    </div>
  )
}

/* ───────────────────────── Screen ───────────────────────── */

export function OverviewScreen() {
  const [range, setRange] = React.useState<"7d" | "30d" | "90d" | "12m">("30d")
  const id = usePcId()
  return (
    <AppFrame crumbs={["Acme Inc", "Web app", "Overview"]}>
      <PageHeader
        pcBase="overview"
        title="Overview"
        subtitle={
          <span className="flex items-center gap-1.5">
            <CalendarDays className="size-3.5" /> Sep 18 – Oct 17, 2026 · compared to previous period
          </span>
        }
        right={
          <div className="flex items-center gap-2.5">
            <Segmented
              pcId={id("overview.range")}
              value={range}
              onChange={setRange}
              options={[
                { value: "7d", label: "7D" },
                { value: "30d", label: "30D" },
                { value: "90d", label: "90D" },
                { value: "12m", label: "12M" },
              ]}
            />
            <OverviewActions />
          </div>
        }
      />

      <OverviewKpis />
      <OverviewChart />

      <div className="grid grid-cols-[1.35fr_1fr] gap-3">
        <Card pcId={id("overview.topEvents")} pcLabel="Top events" className="flex flex-col">
          <div className="flex items-center justify-between px-5 pt-4">
            <div className="flex items-center gap-2">
              <FileBarChart className="size-4 text-subtle" />
              <span className="text-[14px] font-semibold tracking-[-0.01em]">Top events</span>
            </div>
            <Button pcId={id("overview.topEvents.viewAll")} variant="ghost" size="sm">
              View all
            </Button>
          </div>
          <div className="flex flex-col gap-1 px-3 pb-3 pt-2">
            {topEvents.map((e) => (
              <div
                key={e.name}
                {...pc(id(`overview.topEvents.${e.name}`), "Frame", e.name)}
                className="flex h-9 items-center gap-3 rounded-lg px-2"
              >
                <span className="min-w-0 flex-1 font-mono text-[12px] text-foreground">{e.name}</span>
                <span className="relative h-1 w-[72px] shrink-0 overflow-hidden rounded-full bg-muted">
                  <span className="absolute inset-y-0 left-0 rounded-full bg-brand/45" style={{ width: `${e.share * 100}%` }} />
                </span>
                <span className="tabular w-[4.5rem] text-right text-[12.5px] font-medium text-foreground">{e.count.toLocaleString()}</span>
              </div>
            ))}
          </div>
        </Card>

        <Card pcId={id("overview.live")} pcLabel="Live users" className="flex flex-col">
          <div className="flex items-center justify-between px-5 pt-4">
            <span className="text-[14px] font-semibold tracking-[-0.01em]">Live right now</span>
            <Badge tone="success" dot>
              Live
            </Badge>
          </div>
          <div className="flex flex-col px-3 pb-3 pt-2">
            {liveUsers.map((u) => (
              <div key={u.name} className="flex h-11 items-center gap-3 rounded-lg px-2 transition-colors hover:bg-muted">
                <Avatar name={u.name} size={26} />
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-[12.5px] font-medium leading-tight">{u.name}</span>
                  <span className="truncate text-[11.5px] leading-tight text-muted-foreground">
                    {u.where} · {u.city}
                  </span>
                </div>
                <Badge tone="outline">{u.platform}</Badge>
                <span className="tabular w-8 text-right text-[11.5px] text-subtle">{u.ago}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </AppFrame>
  )
}
