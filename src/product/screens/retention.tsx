import * as React from "react"
import { Download, Info } from "@/lib/icons"
import { cn } from "@/lib/utils"
import { cohorts } from "../data"
import { AppFrame, PageHeader, usePcId } from "../shell"
import { pc } from "../system/define"
import { Button } from "../ui/button"
import { Segmented } from "../ui/controls"
import { ChartCard, StatCard } from "../ui/surfaces"

const WEEKS = 8

/** white → brand, by retention value; first column (100%) is ink */
function cellStyle(v: number, w: number): React.CSSProperties {
  if (w === 0) return { background: "#16171a", color: "#fafafa" }
  const t = Math.max(0, Math.min(1, (v - 20) / 55))
  return {
    background: `color-mix(in oklab, #ff6a2b ${Math.round(6 + t * 90)}%, white)`,
    color: t > 0.72 ? "#ffffff" : "#16171a",
  }
}

const avgAt = (w: number) => {
  const vals = cohorts.map((c) => c.weeks[w]).filter((x): x is number => x !== undefined)
  return vals.reduce((a, b) => a + b, 0) / vals.length
}

export function RetentionScreen() {
  const [period, setPeriod] = React.useState<"weekly" | "monthly">("weekly")
  const id = usePcId()

  return (
    <AppFrame crumbs={["Acme Inc", "Web app", "Retention"]}>
      <PageHeader
        pcBase="retention"
        title="Retention"
        subtitle="Users who came back and did any event, by signup cohort"
        right={
          <div className="flex items-center gap-2.5">
            <Segmented
              pcId={id("retention.period")}
              value={period}
              onChange={setPeriod}
              options={[
                { value: "weekly", label: "Weekly" },
                { value: "monthly", label: "Monthly" },
              ]}
            />
            <Button pcId={id("retention.export")} variant="outline">
              <Download /> Export CSV
            </Button>
          </div>
        }
      />

      <div {...pc(id("retention.summary"), "Frame", "Retention summary")} className="grid grid-cols-3 gap-3">
        <StatCard
          pcId={id("retention.week1")}
          stat={{ key: "w1", label: "Week 1 retention", value: `${avgAt(1).toFixed(1)}%`, delta: 3.2, hint: "Average across 7 cohorts", spark: [] }}
        />
        <StatCard
          pcId={id("retention.week4")}
          stat={{ key: "w4", label: "Week 4 retention", value: `${avgAt(4).toFixed(1)}%`, delta: 1.4, hint: "Average across 4 cohorts", spark: [] }}
        />
        <StatCard
          pcId={id("retention.week7")}
          stat={{ key: "w7", label: "Week 7 retention", value: `${avgAt(7).toFixed(1)}%`, delta: -0.7, hint: "Oldest cohort, Aug 24", spark: [] }}
        />
      </div>

      <ChartCard
        pcId={id("retention.heatmap")}
        title="Cohort retention"
        subtitle="Share of each weekly signup cohort still active N weeks later"
        actions={
          <div className="flex items-center gap-2 pt-1 text-[11.5px] text-muted-foreground">
            <span>20%</span>
            <span className="h-2 w-28 rounded-full" style={{ background: "linear-gradient(90deg, color-mix(in oklab, #ff6a2b 6%, white), #ff6a2b)" }} />
            <span>75%+</span>
          </div>
        }
      >
        <div className="px-3 pb-1 pt-2">
          <div className="grid gap-1" style={{ gridTemplateColumns: `132px 72px repeat(${WEEKS}, minmax(0, 1fr))` }}>
            <div className="flex h-7 items-center pl-2 text-[11.5px] font-medium text-muted-foreground">Cohort</div>
            <div className="flex h-7 items-center text-[11.5px] font-medium text-muted-foreground">Users</div>
            {Array.from({ length: WEEKS }).map((_, w) => (
              <div key={w} className="flex h-7 items-center justify-center text-[11.5px] font-medium text-muted-foreground">
                Week {w}
              </div>
            ))}

            {cohorts.map((c, ci) => (
              <React.Fragment key={c.label}>
                <div {...pc(id(`retention.cohort.${ci}`), "Text", `Cohort ${c.label}`)} className="flex h-10 items-center pl-2 text-[12.5px] font-medium text-foreground">
                  Week of {c.label}
                </div>
                <div className="tabular flex h-10 items-center text-[12px] text-muted-foreground">{c.size.toLocaleString()}</div>
                {Array.from({ length: WEEKS }).map((_, w) => {
                  const v = c.weeks[w]
                  if (v === undefined) return <div key={w} className="h-10 rounded-md bg-[repeating-linear-gradient(135deg,#f4f4f2_0_4px,transparent_4px_8px)]" />
                  return (
                    <div
                      key={w}
                      {...(w <= 1 ? pc(id(`retention.cell.${ci}.${w}`), "Frame", `${c.label} · week ${w}`) : {})}
                      className={cn("tabular grid h-10 place-items-center rounded-md text-[12px] font-medium transition-transform hover:scale-[1.04]")}
                      style={cellStyle(v, w)}
                    >
                      {v.toFixed(w === 0 ? 0 : 1)}%
                    </div>
                  )
                })}
              </React.Fragment>
            ))}

            <div className="flex h-10 items-center pl-2 text-[12.5px] font-semibold text-foreground">Average</div>
            <div className="tabular flex h-10 items-center text-[12px] text-muted-foreground">
              {Math.round(cohorts.reduce((a, c) => a + c.size, 0) / cohorts.length).toLocaleString()}
            </div>
            {Array.from({ length: WEEKS }).map((_, w) => (
              <div key={w} className="tabular grid h-10 place-items-center rounded-md border border-border bg-surface text-[12px] font-semibold text-foreground">
                {avgAt(w).toFixed(w === 0 ? 0 : 1)}%
              </div>
            ))}
          </div>
        </div>
      </ChartCard>

      <div
        {...pc(id("retention.insight"), "Card", "Insight")}
        className="flex items-start gap-3 rounded-xl border border-[#ffd9c7] bg-brand-soft px-4 py-3"
      >
        <Info className="mt-0.5 size-4 shrink-0 text-brand" />
        <p className="text-[12.5px] leading-relaxed text-foreground">
          <span className="font-semibold">Cohorts from Sep 28 onward retain 4.1 pts better in week 1.</span>{" "}
          <span className="text-muted-foreground">That lines up with the new onboarding checklist shipping on Sep 27.</span>
        </p>
      </div>
    </AppFrame>
  )
}
