import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"

/** Switches a right-hand panel between a docked sidebar (the page makes room) and a floating window. */
export function DockToggle({ layout, onChange }: { layout: "sidebar" | "floating"; onChange: (v: "sidebar" | "floating") => void }) {
  const docked = layout === "sidebar"
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          onClick={() => onChange(docked ? "floating" : "sidebar")}
          className="grid size-7 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
          aria-label={docked ? "Float window" : "Dock as sidebar"}
        >
          {docked ? <FloatIcon /> : <DockIcon />}
        </button>
      </TooltipTrigger>
      <TooltipContent side="bottom">{docked ? "Float window" : "Dock as sidebar"}</TooltipContent>
    </Tooltip>
  )
}

const DockIcon = () => (
  <svg viewBox="0 0 16 16" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.3">
    <rect x="1.75" y="2.75" width="12.5" height="10.5" rx="2" />
    <path d="M10 2.75v10.5" />
    <path d="M11.6 5.5h1M11.6 7.5h1" strokeLinecap="round" />
  </svg>
)
const FloatIcon = () => (
  <svg viewBox="0 0 16 16" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.3">
    <rect x="1.75" y="2.75" width="12.5" height="10.5" rx="2" />
    <rect x="8.25" y="5" width="4" height="6" rx="1" fill="currentColor" fillOpacity="0.25" />
  </svg>
)

/** Shared look for both right-hand panels in their two layouts. */
export const panelShell = (docked: boolean) =>
  docked
    ? "top-0 right-0 bottom-[var(--pc-bar)] border-l border-border"
    : "bottom-[var(--pc-float-bottom)] right-3 top-3 rounded-2xl border border-border/60 pc-shadow"
