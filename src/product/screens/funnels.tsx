import * as React from "react"
import { ChevronDown, Clock, Filter, Plus, Users } from "@/lib/icons"
import { funnelBreakdown, funnelSteps } from "../data"
import { AppFrame, PageHeader, usePcId } from "../shell"
import { pc } from "../system/define"
import { Button } from "../ui/button"
import { Badge, Segmented } from "../ui/controls"
import { Card, ChartCard, Delta, StatCard, TableRow } from "../ui/surfaces"

const fmt = (n: number) => n.toLocaleString()
const pct = (a: number, b: number) => `${((a / b) * 100).toFixed(1)}%`

function FunnelChart() {
  const id = usePcId()
  const top = funnelSteps[0].users
  return (
    <div className="flex h-[320px] items-stretch gap-0 px-3 pb-1 pt-9">
      {funnelSteps.map((s, i) => {
        const h = (s.users / top) * 100
        const prev = i > 0 ? funnelSteps[i - 1].users : s.users
        const prevH = (prev / top) * 100
        return (
          <React.Fragment key={s.name}>
            {i > 0 && (
              <div className="flex w-14 shrink-0 flex-col items-center justify-end pb-[58px]">
                <span
                  {...pc(id(`funnels.conv.${i}`), "Badge", `Step ${i} → ${i + 1}`)}
                  className="tabular rounded-full border border-border bg-surface px-1.5 py-0.5 text-[11px] font-semibold text-foreground shadow-[0_1px_2px_rgb(22_23_26/0.06)]"
                >
                  {pct(s.users, prev)}
                </span>
                <span className="mt-1 text-[10.5px] text-subtle">→</span>
              </div>
            )}
            <div {...pc(id(`funnels.step.${i + 1}`), "Frame", s.name)} className="flex min-w-0 flex-1 flex-col">
              <div className="relative flex-1">
                {/* dropped-off portion relative to previous step */}
                <div
                  className="absolute inset-x-0 bottom-0 rounded-t-lg border border-dashed border-[#ffc9ae]"
                  style={{
                    height: `${prevH}%`,
                    background:
                      "repeating-linear-gradient(135deg, rgb(255 106 43 / 0.10) 0 6px, rgb(255 106 43 / 0.02) 6px 12px)",
                  }}
                />
                <div
                  className="absolute inset-x-0 bottom-0 rounded-t-lg bg-brand shadow-[inset_0_1px_0_rgb(255_255_255/0.25)]"
                  style={{ height: `${h}%`, opacity: 1 - i * 0.1 }}
                />
                <span
                  className="tabular absolute inset-x-0 text-center text-[12px] font-semibold text-foreground"
                  style={{ bottom: `calc(${h}% + 6px)` }}
                >
                  {i === 0 ? "100%" : pct(s.users, top)}
                </span>
              </div>
              <div className="flex h-[52px] flex-col justify-center gap-0.5 border-t border-border pt-2">
                <span className="truncate text-[12px] font-medium text-foreground">
                  <span className="text-subtle">{i + 1}.</span> {s.name}
                </span>
                <span className="tabular text-[11.5px] text-muted-foreground">{fmt(s.users)} users</span>
              </div>
            </div>
          </React.Fragment>
        )
      })}
    </div>
  )
}

export function FunnelsScreen() {
  const [view, setView] = React.useState<"conversion" | "time" | "trends">("conversion")
  const id = usePcId()
  const total = funnelSteps[funnelSteps.length - 1].users / funnelSteps[0].users

  return (
    <AppFrame crumbs={["Acme Inc", "Web app", "Funnels"]}>
      <PageHeader
        pcBase="funnels"
        title="Activation funnel"
        subtitle={
          <span className="flex items-center gap-1.5">
            <Filter className="size-3.5" /> Landing → first teammate invited · 5 steps · within 14 days
          </span>
        }
        right={
          <div className="flex items-center gap-2.5">
            <Segmented
              pcId={id("funnels.view")}
              value={view}
              onChange={setView}
              options={[
                { value: "conversion", label: "Conversion" },
                { value: "time", label: "Time to convert" },
                { value: "trends", label: "Trends" },
              ]}
            />
            <Button pcId={id("funnels.switch")} variant="outline">
              All funnels <ChevronDown />
            </Button>
            <Button pcId={id("funnels.new")} variant="primary">
              <Plus /> New funnel
            </Button>
          </div>
        }
      />

      <div {...pc(id("funnels.summary"), "Frame", "Funnel summary")} className="grid grid-cols-3 gap-3">
        <StatCard
          pcId={id("funnels.summary.conversion")}
          stat={{ key: "conv", label: "Overall conversion", value: `${(total * 100).toFixed(2)}%`, delta: 0.4, hint: "6,238 of 182,400 visitors", spark: [] }}
        />
        <StatCard
          pcId={id("funnels.summary.time")}
          stat={{ key: "time", label: "Median time to convert", value: "3d 4h", delta: -6.2, hint: "Slowest step: project → invite", spark: [] }}
        />
        <StatCard
          pcId={id("funnels.summary.drop")}
          stat={{ key: "drop", label: "Biggest drop-off", value: "77.0%", delta: -1.8, hint: "Landing page → Started signup", spark: [] }}
        />
      </div>

      <ChartCard
        pcId={id("funnels.chart")}
        title="Conversion by step"
        subtitle="Unique users who completed each step, in order"
        actions={
          <div className="flex items-center gap-3 pt-1">
            <span className="flex items-center gap-1.5 text-[12px] text-muted-foreground">
              <span className="size-2.5 rounded-sm bg-brand" /> Converted
            </span>
            <span className="flex items-center gap-1.5 text-[12px] text-muted-foreground">
              <span
                className="size-2.5 rounded-sm border border-dashed border-[#ffc9ae]"
                style={{ background: "repeating-linear-gradient(135deg, rgb(255 106 43 / 0.18) 0 2px, transparent 2px 4px)" }}
              />
              Dropped off
            </span>
          </div>
        }
      >
        <FunnelChart />
      </ChartCard>

      <Card pcId={id("funnels.breakdown")} pcLabel="Breakdown by source" className="overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4">
          <div className="flex flex-col gap-0.5">
            <span className="text-[14px] font-semibold tracking-[-0.01em]">Breakdown by source</span>
            <span className="text-[12.5px] text-muted-foreground">Where converting users come from</span>
          </div>
          <Button pcId={id("funnels.breakdown.by")} variant="outline" size="sm">
            <Users /> Source <ChevronDown />
          </Button>
        </div>
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="border-y border-border bg-[#f8f8f6] text-[11.5px] text-muted-foreground">
              <th className="h-9 pl-5 font-medium">Source</th>
              <th className="font-medium">Entered funnel</th>
              <th className="w-[36%] font-medium">Conversion</th>
              <th className="pr-5 text-right font-medium">vs. last period</th>
            </tr>
          </thead>
          <tbody>
            {funnelBreakdown.map((b) => (
              <TableRow key={b.source} pcId={id(`funnels.source.${b.source.toLowerCase().replace(/\s+/g, "-")}`)} pcLabel={b.source}>
                <td className="h-12 pl-5 text-[13px] font-medium text-foreground">{b.source}</td>
                <td className="tabular text-[12.5px] text-muted-foreground">{fmt(b.users)}</td>
                <td>
                  <div className="flex items-center gap-3 pr-6">
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                      <div className="h-full rounded-full bg-brand" style={{ width: `${(b.conv / 7) * 100}%` }} />
                    </div>
                    <span className="tabular w-10 text-right text-[12.5px] font-medium text-foreground">{b.conv.toFixed(1)}%</span>
                  </div>
                </td>
                <td className="pr-5 text-right">
                  <Delta value={b.delta} />
                </td>
              </TableRow>
            ))}
          </tbody>
        </table>
      </Card>

      <div className="flex items-center gap-2 text-[12px] text-muted-foreground">
        <Clock className="size-3.5" /> Updated 2 minutes ago
        <Badge tone="neutral">Sampled 100%</Badge>
      </div>
    </AppFrame>
  )
}
