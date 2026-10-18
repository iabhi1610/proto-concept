import * as React from "react"
import { BookOpen, ChevronLeft, ChevronRight, Download, Search, Terminal } from "@/lib/icons"
import { cn } from "@/lib/utils"
import { useVariantChoice } from "@/tool/store"
import { events, type EventRow } from "../data"
import { AppFrame, PageHeader, usePcId } from "../shell"
import { pc } from "../system/define"
import { Button } from "../ui/button"
import { Avatar, Badge, FilterChip, Input, Segmented } from "../ui/controls"
import { TableRow } from "../ui/surfaces"

type Kind = EventRow["kind"]

const KIND_DOT: Record<Kind, string> = {
  pageview: "bg-[#9a9ca3]",
  custom: "bg-brand",
  error: "bg-danger",
  identify: "bg-success",
}

const KIND_LABEL: Record<Kind, string> = {
  pageview: "Pageview",
  custom: "Custom",
  error: "Error",
  identify: "Identify",
}

const FILTERS: { value: "all" | Kind; label: string }[] = [
  { value: "all", label: "All events" },
  { value: "pageview", label: "Pageviews" },
  { value: "custom", label: "Custom" },
  { value: "error", label: "Errors" },
  { value: "identify", label: "Identify" },
]

function EventName({ row, className }: { row: EventRow; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <span className={cn("size-1.5 shrink-0 rounded-full", KIND_DOT[row.kind])} />
      <span className="font-mono text-[12px] text-foreground">{row.name}</span>
    </span>
  )
}

function PropChip({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex h-5 max-w-[150px] items-center truncate rounded-md border border-border bg-muted px-1.5 font-mono text-[11px] text-muted-foreground">
      {children}
    </span>
  )
}

/* ───────────────────────── Variant slot: events table ───────────────────────── */

export function EventsTable({ option, rows = events }: { option?: string; rows?: EventRow[] }) {
  const chosen = useVariantChoice("events.table")
  const v = option ?? chosen
  const id = usePcId()
  const [selected, setSelected] = React.useState<string | null>(null)
  const slot = { ...pc(id("events.table"), "Frame", "Events table"), "data-pc-variant-set": "vs-events" }

  const footer = (
    <div
      {...pc(id("events.pagination"), "Frame", "Pagination")}
      className="flex items-center justify-between border-t border-border px-5 py-3"
    >
      <span className="text-[12px] text-muted-foreground">
        Showing <span className="tabular font-medium text-foreground">1–{rows.length}</span> of{" "}
        <span className="tabular font-medium text-foreground">274,118</span> events today
      </span>
      <div className="flex items-center gap-1.5">
        <Button pcId={id("events.prev")} size="icon-sm" variant="outline" disabled aria-label="Previous page">
          <ChevronLeft />
        </Button>
        <Button pcId={id("events.next")} size="icon-sm" variant="outline" aria-label="Next page">
          <ChevronRight />
        </Button>
      </div>
    </div>
  )

  if (v === "events-empty")
    return (
      <div {...slot} className="flex flex-col items-center rounded-xl border border-border bg-card px-6 py-16 shadow-[0_1px_2px_rgb(22_23_26/0.04)]">
        <div {...pc(id("events.empty.illustration"), "Frame", "Empty illustration")} className="relative mb-6 h-[92px] w-[168px]">
          <div className="absolute left-3 top-6 h-14 w-[132px] rotate-[-6deg] rounded-xl border border-border bg-muted" />
          <div className="absolute left-7 top-2 flex h-16 w-[132px] flex-col justify-center gap-2 rounded-xl border border-border bg-surface px-3 shadow-[0_8px_20px_rgb(22_23_26/0.08)]">
            <div className="flex items-center gap-2">
              <span className="size-2 rounded-full bg-brand" />
              <span className="h-1.5 w-16 rounded-full bg-[#e8e8e5]" />
            </div>
            <div className="flex items-center gap-2">
              <span className="size-2 rounded-full bg-[#d0d0cc]" />
              <span className="h-1.5 w-11 rounded-full bg-[#efefec]" />
            </div>
          </div>
          <div className="absolute right-1 top-0 grid size-9 place-items-center rounded-full bg-brand text-white shadow-[0_6px_16px_rgb(255_106_43/0.35)] ring-4 ring-brand-soft">
            <Terminal className="size-4" />
          </div>
        </div>
        <h3 {...pc(id("events.empty.title"), "Text", "Empty title")} className="text-[16px] font-semibold tracking-[-0.01em] text-foreground">
          No events tracked yet
        </h3>
        <p
          {...pc(id("events.empty.body"), "Text", "Empty body")}
          className="mt-1.5 max-w-[420px] text-balance text-center text-[13px] leading-relaxed text-muted-foreground"
        >
          Install the Orbit SDK and send your first event. It shows up here within seconds, with the user and every property attached.
        </p>
        <div className="mt-5 flex items-center gap-2">
          <Button pcId={id("events.empty.install")} variant="primary">
            <Terminal /> Install SDK
          </Button>
          <Button pcId={id("events.empty.docs")} variant="ghost">
            <BookOpen /> Read docs
          </Button>
        </div>
        <code className="mt-6 rounded-lg border border-border bg-muted px-3 py-1.5 font-mono text-[11.5px] text-muted-foreground">
          npm i @orbit/analytics && orbit.track(&quot;signup_started&quot;)
        </code>
      </div>
    )

  if (v === "events-cards")
    return (
      <div {...slot} className="flex flex-col gap-2">
        {rows.map((r) => (
          <div
            key={r.id}
            {...pc(id(`events.card.${r.id}`), "Card", r.name)}
            className="flex items-center gap-4 rounded-xl border border-border bg-card px-4 py-3 shadow-[0_1px_2px_rgb(22_23_26/0.04)] transition-shadow hover:shadow-[0_2px_4px_rgb(22_23_26/0.04),0_8px_20px_rgb(22_23_26/0.06)]"
          >
            <div
              className={cn(
                "grid size-9 shrink-0 place-items-center rounded-lg",
                r.kind === "error" ? "bg-danger-soft" : r.kind === "identify" ? "bg-success-soft" : r.kind === "custom" ? "bg-brand-soft" : "bg-muted",
              )}
            >
              <span className={cn("size-2 rounded-full", KIND_DOT[r.kind])} />
            </div>
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <div className="flex items-center gap-2">
                <span className="font-mono text-[12.5px] font-medium text-foreground">{r.name}</span>
                <PropChip>{r.props}</PropChip>
              </div>
              <div className="flex items-center gap-1.5 text-[12px] text-muted-foreground">
                <Avatar name={r.user} size={16} className="ring-0" />
                <span className="text-foreground">{r.user}</span>
                <span className="text-[#d0d0cc]">·</span>
                {r.platform}
                <span className="text-[#d0d0cc]">·</span>
                {r.country}
              </div>
            </div>
            <Badge tone={r.kind === "error" ? "danger" : "outline"}>{KIND_LABEL[r.kind]}</Badge>
            <span className="tabular w-[72px] shrink-0 text-right font-mono text-[11.5px] text-subtle">{r.time}</span>
          </div>
        ))}
      </div>
    )

  const dense = v === "events-dense"
  return (
    <div {...slot} className="overflow-hidden rounded-xl border border-border bg-card shadow-[0_1px_2px_rgb(22_23_26/0.04)]">
      <table className="w-full border-collapse text-left">
        <thead>
          <tr className="border-b border-border bg-[#f8f8f6] text-[11.5px] font-medium text-muted-foreground">
            <th className={cn("pl-5 font-medium", dense ? "h-8" : "h-9")}>Event</th>
            <th className="font-medium">User</th>
            <th className="font-medium">Properties</th>
            <th className="font-medium">Platform</th>
            <th className="font-medium">Country</th>
            <th className="pr-5 text-right font-medium">Time</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <TableRow
              key={r.id}
              pcId={id(`events.row.${r.id}`)}
              pcLabel={r.name}
              selected={selected === r.id}
              onClick={() => setSelected(selected === r.id ? null : r.id)}
              className="cursor-pointer"
            >
              <td className={cn("pl-5", dense ? "h-8" : "h-[52px]")}>
                <EventName row={r} />
              </td>
              <td>
                {dense ? (
                  <span className="text-[12px] text-foreground">{r.email}</span>
                ) : (
                  <span className="flex items-center gap-2.5">
                    <Avatar name={r.user} size={24} />
                    <span className="flex flex-col">
                      <span className="text-[12.5px] font-medium leading-tight text-foreground">{r.user}</span>
                      <span className="text-[11.5px] leading-tight text-muted-foreground">{r.email}</span>
                    </span>
                  </span>
                )}
              </td>
              <td>
                <PropChip>{r.props}</PropChip>
              </td>
              <td>
                {dense ? <span className="text-[12px] text-muted-foreground">{r.platform}</span> : <Badge tone="outline">{r.platform}</Badge>}
              </td>
              <td className="text-[12.5px] text-muted-foreground">{r.country}</td>
              <td className={cn("pr-5 text-right text-[12px] text-muted-foreground", dense ? "tabular font-mono text-[11.5px]" : "tabular")}>
                {dense ? r.time : `Today, ${r.time.slice(0, 5)}`}
              </td>
            </TableRow>
          ))}
        </tbody>
      </table>
      {footer}
    </div>
  )
}

/* ───────────────────────── Screen ───────────────────────── */

export function EventsScreen() {
  const [range, setRange] = React.useState<"1h" | "24h" | "7d">("24h")
  const [filter, setFilter] = React.useState<"all" | Kind>("all")
  const [query, setQuery] = React.useState("")
  const id = usePcId()

  const counts = React.useMemo(() => {
    const c: Record<string, number> = { all: events.length }
    for (const e of events) c[e.kind] = (c[e.kind] ?? 0) + 1
    return c
  }, [])

  const rows = events.filter(
    (e) =>
      (filter === "all" || e.kind === filter) &&
      (!query || `${e.name} ${e.user} ${e.email} ${e.props}`.toLowerCase().includes(query.toLowerCase())),
  )

  return (
    <AppFrame crumbs={["Acme Inc", "Web app", "Events"]}>
      <PageHeader
        pcBase="events"
        title="Events"
        subtitle="Every event your product sends, as it happens. 274k today."
        right={
          <div className="flex items-center gap-2.5">
            <Badge pcId={id("events.live")} tone="success" dot>
              Live
            </Badge>
            <Segmented
              pcId={id("events.range")}
              value={range}
              onChange={setRange}
              options={[
                { value: "1h", label: "1H" },
                { value: "24h", label: "24H" },
                { value: "7d", label: "7D" },
              ]}
            />
            <Button pcId={id("events.export")} variant="outline">
              <Download /> Export
            </Button>
          </div>
        }
      />

      <div {...pc(id("events.filters"), "Frame", "Filter bar")} className="flex items-center gap-3">
        <Input
          pcId={id("events.search")}
          pcLabel="Search events"
          icon={<Search />}
          placeholder="Search events, users or properties"
          wrapperClassName="max-w-[320px]"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          trailing={<kbd className="rounded border border-border bg-muted px-1 font-sans text-[10.5px] text-muted-foreground">/</kbd>}
        />
        <div className="flex items-center gap-1.5">
          {FILTERS.map((f) => (
            <FilterChip
              key={f.value}
              pcId={id(`events.filter.${f.value}`)}
              active={filter === f.value}
              count={counts[f.value] ?? 0}
              onClick={() => setFilter(f.value)}
            >
              {f.label}
            </FilterChip>
          ))}
        </div>
      </div>

      <EventsTable rows={rows} />
    </AppFrame>
  )
}
