import * as React from "react"
import {
  Bell,
  ChevronsUpDown,
  CircleHelp,
  Filter,
  Gauge,
  LayoutGrid,
  LogOut,
  Repeat2,
  Search,
  Settings2,
  Sparkles,
  Zap,
} from "@/lib/icons"
import { cn } from "@/lib/utils"
import type { ScreenId } from "@/tool/types"
import { pc } from "./system/define"
import { Avatar, Badge } from "./ui/controls"
import { NavItem } from "./ui/surfaces"

export interface ProductCtx {
  screen: ScreenId
  navigate: (s: ScreenId) => void
  /** true for scaled previews (flow map, variant thumbnails): no ids, no interaction */
  preview: boolean
}

export const ProductContext = React.createContext<ProductCtx>({ screen: "overview", navigate: () => {}, preview: false })
export const useProduct = () => React.useContext(ProductContext)

/** pc ids are only emitted for the live product so the overlay can find exactly one node */
export function usePcId() {
  const { preview } = useProduct()
  return React.useCallback((id: string) => (preview ? undefined : id), [preview])
}

export function OrbitLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={cn("size-6", className)} fill="none">
      <rect width="24" height="24" rx="7" fill="#16171A" />
      <circle cx="12" cy="12" r="4.2" fill="#FF6A2B" />
      <ellipse cx="12" cy="12" rx="8.2" ry="3.4" transform="rotate(-28 12 12)" stroke="#fff" strokeOpacity="0.9" strokeWidth="1.3" />
    </svg>
  )
}

const NAV: { id: ScreenId; label: string; icon: React.ReactNode }[] = [
  { id: "overview", label: "Overview", icon: <LayoutGrid /> },
  { id: "events", label: "Events", icon: <Zap /> },
  { id: "funnels", label: "Funnels", icon: <Filter /> },
  { id: "retention", label: "Retention", icon: <Repeat2 /> },
]

export function Sidebar() {
  const { screen, navigate } = useProduct()
  const id = usePcId()
  return (
    <aside
      {...pc(id("shell.sidebar"), "Frame", "Sidebar")}
      className="flex w-[232px] shrink-0 flex-col border-r border-sidebar-border bg-sidebar px-3 pb-3 pt-3.5"
    >
      <button
        {...pc(id("shell.workspace"), "Frame", "Workspace switcher")}
        className="flex items-center gap-2.5 rounded-lg px-1.5 py-1 text-left transition-colors hover:bg-[#ededea]"
      >
        <OrbitLogo />
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="text-[13px] font-semibold leading-tight text-foreground">Acme Inc</span>
          <span className="text-[11.5px] leading-tight text-muted-foreground">Web app · Production</span>
        </div>
        <ChevronsUpDown className="size-3.5 text-subtle" />
      </button>

      <div className="mt-4 flex h-8 items-center gap-2 rounded-lg border border-border bg-surface px-2.5 text-[12.5px] text-subtle shadow-[0_1px_2px_rgb(22_23_26/0.03)]">
        <Search className="size-3.5" />
        <span className="flex-1">Search</span>
        <kbd className="rounded border border-border bg-muted px-1 font-sans text-[10.5px] text-muted-foreground">⌘K</kbd>
      </div>

      <div className="mt-5 px-2.5 text-[11px] font-medium uppercase tracking-[0.06em] text-subtle">Analytics</div>
      <nav className="mt-1.5 flex flex-col gap-0.5">
        {NAV.map((n) => (
          <NavItem
            key={n.id}
            pcId={id(`nav.${n.id}`)}
            icon={n.icon}
            label={n.label}
            active={screen === n.id}
            onClick={() => navigate(n.id)}
            badge={n.id === "events" ? <span className="size-1.5 rounded-full bg-success" /> : undefined}
          />
        ))}
      </nav>

      <div className="mt-5 px-2.5 text-[11px] font-medium uppercase tracking-[0.06em] text-subtle">Workspace</div>
      <nav className="mt-1.5 flex flex-col gap-0.5">
        <NavItem pcId={id("nav.insights")} icon={<Sparkles />} label="AI insights" badge={<Badge tone="brand">New</Badge>} />
        <NavItem pcId={id("nav.health")} icon={<Gauge />} label="Data health" />
        <NavItem
          pcId={id("nav.settings")}
          icon={<Settings2 />}
          label="Settings"
          active={screen === "settings"}
          onClick={() => navigate("settings")}
        />
      </nav>

      <div className="mt-auto flex flex-col gap-3">
        <div
          {...pc(id("shell.usage"), "Card", "Usage card")}
          className="rounded-xl border border-border bg-surface p-3 shadow-[0_1px_2px_rgb(22_23_26/0.04)]"
        >
          <div className="flex items-center justify-between text-[12px]">
            <span className="font-medium text-foreground">Events this month</span>
            <span className="tabular text-muted-foreground">82%</span>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
            <div className="h-full w-[82%] rounded-full bg-brand" />
          </div>
          <div className="mt-2 text-[11.5px] text-muted-foreground">8.2M of 10M · resets Nov 1</div>
        </div>
        <button
          onClick={() => navigate("signin")}
          className="group flex items-center gap-2.5 rounded-lg px-1.5 py-1 text-left transition-colors hover:bg-[#ededea]"
        >
          <Avatar name="Abhi Kumar" size={26} />
          <div className="flex min-w-0 flex-1 flex-col">
            <span className="text-[12.5px] font-medium leading-tight text-foreground">Abhi Kumar</span>
            <span className="text-[11.5px] leading-tight text-muted-foreground">abhi@orbit.so</span>
          </div>
          <LogOut className="size-3.5 text-subtle opacity-0 transition-opacity group-hover:opacity-100" />
        </button>
      </div>
    </aside>
  )
}

export function TopBar({ crumbs }: { crumbs: string[] }) {
  const id = usePcId()
  return (
    <div
      {...pc(id("shell.topbar"), "Frame", "Top bar")}
      className="flex h-12 shrink-0 items-center justify-between border-b border-border bg-background/80 px-7 backdrop-blur"
    >
      <div className="flex items-center gap-1.5 text-[12.5px]">
        {crumbs.map((c, i) => (
          <React.Fragment key={c}>
            {i > 0 && <span className="text-[#d0d0cc]">/</span>}
            <span className={i === crumbs.length - 1 ? "font-medium text-foreground" : "text-muted-foreground"}>{c}</span>
          </React.Fragment>
        ))}
      </div>
      <div className="flex items-center gap-1">
        <span className="mr-2 inline-flex items-center gap-1.5 rounded-full bg-success-soft px-2 py-0.5 text-[11.5px] font-medium text-success">
          <span className="relative flex size-1.5">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-success opacity-60" />
            <span className="relative inline-flex size-1.5 rounded-full bg-success" />
          </span>
          1,284 online
        </span>
        <button className="grid size-8 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
          <CircleHelp className="size-4" />
        </button>
        <button className="relative grid size-8 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
          <Bell className="size-4" />
          <span className="absolute right-2 top-2 size-1.5 rounded-full bg-brand ring-2 ring-background" />
        </button>
      </div>
    </div>
  )
}

export function PageHeader({
  pcBase,
  title,
  subtitle,
  right,
}: {
  pcBase: string
  title: string
  subtitle: React.ReactNode
  right?: React.ReactNode
}) {
  const id = usePcId()
  return (
    <div className="flex items-end justify-between gap-6">
      <div className="flex flex-col gap-1">
        <h1
          {...pc(id(`${pcBase}.title`), "Text", "Page title")}
          className="text-[24px] font-semibold leading-[1.15] tracking-[-0.025em] text-foreground"
        >
          {title}
        </h1>
        <p {...pc(id(`${pcBase}.subtitle`), "Text", "Page subtitle")} className="text-[13px] text-muted-foreground">
          {subtitle}
        </p>
      </div>
      {right}
    </div>
  )
}

export function AppFrame({ crumbs, children }: { crumbs: string[]; children: React.ReactNode }) {
  return (
    <div className="flex h-full w-full overflow-hidden">
      <Sidebar />
      <main className="flex min-w-0 flex-1 flex-col">
        <TopBar crumbs={crumbs} />
        <div data-pc-scroll className="min-h-0 flex-1 overflow-y-auto">
          <div className="mx-auto flex w-full max-w-[1240px] flex-col gap-6 px-7 pb-28 pt-7">{children}</div>
        </div>
      </main>
    </div>
  )
}
