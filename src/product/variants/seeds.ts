import type { VariantSet } from "@/tool/types"

/**
 * Variant sets that already exist when the demo starts. Each option id is read by the
 * product component that owns the slot (see `useVariantChoice`), which renders real
 * alternate markup for it.
 */
export const SEEDED_VARIANT_SETS: VariantSet[] = [
  {
    id: "vs-kpis",
    elId: "overview.kpis",
    screen: "overview",
    name: "KPI cards",
    component: "StatGroup",
    selected: "original",
    createdAt: 1,
    seeded: true,
    options: [
      { id: "kpi-sparkline", kind: "seed", name: "Sparkline", description: "Each card carries a 14-day trend line under the number." },
      { id: "kpi-strip", kind: "seed", name: "Compact strip", description: "One continuous strip with dividers, saves vertical space." },
      { id: "kpi-hero", kind: "seed", name: "Hero metric", description: "Active users leads as a hero, the rest stack beside it." },
    ],
  },
  {
    id: "vs-actions",
    elId: "overview.actions",
    screen: "overview",
    name: "Header actions",
    component: "ActionGroup",
    selected: "original",
    createdAt: 2,
    seeded: true,
    options: [
      { id: "actions-split", kind: "seed", name: "Split button", description: "Primary 'Create report' with a menu for other templates." },
      { id: "actions-icons", kind: "seed", name: "Icon-first", description: "Secondary actions collapse to icon buttons with tooltips." },
      { id: "actions-brand", kind: "seed", name: "Brand CTA", description: "Orange brand CTA, share demoted to a ghost button." },
    ],
  },
  {
    id: "vs-chart",
    elId: "overview.chart",
    screen: "overview",
    name: "Active users chart",
    component: "ChartCard",
    selected: "original",
    createdAt: 3,
    seeded: true,
    options: [
      { id: "chart-bars", kind: "seed", name: "Bars", description: "Daily bars, easier to compare individual days." },
      { id: "chart-compare", kind: "seed", name: "Compare period", description: "Line chart with the previous period as a dashed ghost." },
      { id: "chart-stacked", kind: "seed", name: "By platform", description: "Stacked area split by Web, iOS and Android." },
    ],
  },
  {
    id: "vs-events",
    elId: "events.table",
    screen: "events",
    name: "Events table",
    component: "DataTable",
    selected: "original",
    createdAt: 4,
    seeded: true,
    options: [
      { id: "events-dense", kind: "seed", name: "Dense", description: "Tighter rows and mono timestamps for power users." },
      { id: "events-cards", kind: "seed", name: "Card list", description: "Each event as a card with the user and properties inline." },
      { id: "events-empty", kind: "seed", name: "Empty state", description: "What the table looks like before any event is tracked." },
    ],
  },
]
