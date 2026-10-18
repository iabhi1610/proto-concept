import * as React from "react"
import { motion } from "motion/react"
import { Check, Eye, Layers, MessageSquarePlus } from "@/lib/icons"
import { cn } from "@/lib/utils"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { screenMeta } from "@/product/screens"
import { OrbitLogo } from "@/product/shell"
import { letterFor } from "@/tool/actions"
import { useTool } from "@/tool/store"
import { useViewer } from "./Viewer"

const Divider = () => <span className="mx-1 h-5 w-px bg-border" />

export function ViewerChrome() {
  const { data, comments, viewers, commenting, setCommenting } = useViewer()
  const allSets = useTool((s) => s.variantSets)
  const screen = useTool((s) => s.screen)
  const sets = allSets.filter((v) => data.config.variantSets.includes(v.id))
  const canComment = data.config.role === "comment"
  const openCount = comments.filter((c) => c.status !== "resolved").length

  return (
    <motion.div
      initial={{ y: 24, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ type: "spring", stiffness: 420, damping: 32, delay: 0.15 }}
      className="pc-glass pc-shadow fixed bottom-5 left-1/2 z-40 flex h-12 -translate-x-1/2 items-center gap-1 rounded-full pl-2 pr-2"
      data-pc-tool
    >
      <div className="flex items-center gap-2 pl-1 pr-2">
        <OrbitLogo className="size-7" />
        <div className="flex flex-col leading-tight">
          <span className="text-[12.5px] font-semibold text-foreground">Orbit Analytics</span>
          <span className="text-[11px] text-muted-foreground">
            {screenMeta(screen).title} · shared via Proto Concept
          </span>
        </div>
      </div>

      {canComment && (
        <>
          <Divider />
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={() => setCommenting(!commenting)}
                className={cn(
                  "relative flex h-9 items-center gap-1.5 rounded-full px-3 text-[12.5px] font-medium transition-colors",
                  commenting ? "bg-[var(--pc-comment)] text-white" : "text-foreground hover:bg-accent",
                )}
              >
                <MessageSquarePlus className="size-4" />
                Comment
                {openCount > 0 && (
                  <span
                    className={cn(
                      "tabular grid h-[18px] min-w-[18px] place-items-center rounded-full px-1 text-[10.5px] font-semibold",
                      commenting ? "bg-white/25 text-white" : "bg-[var(--pc-comment)] text-white",
                    )}
                  >
                    {openCount}
                  </span>
                )}
              </button>
            </TooltipTrigger>
            <TooltipContent side="top">{commenting ? "Exit comment mode (Esc)" : "Click any element to leave feedback"}</TooltipContent>
          </Tooltip>
        </>
      )}

      {sets.length > 0 && (
        <>
          <Divider />
          <Popover>
            <PopoverTrigger asChild>
              <button
                type="button"
                className="flex h-9 items-center gap-1.5 rounded-full px-3 text-[12.5px] font-medium text-foreground transition-colors hover:bg-accent data-[state=open]:bg-accent"
              >
                <Layers className="size-4 text-[var(--pc-variant)]" />
                Variants
                <span className="tabular grid h-[18px] min-w-[18px] place-items-center rounded-full bg-[color-mix(in_oklab,var(--pc-variant),transparent_85%)] px-1 text-[10.5px] font-semibold text-[var(--pc-variant)]">
                  {sets.length}
                </span>
              </button>
            </PopoverTrigger>
            <PopoverContent side="top" sideOffset={12} className="w-[360px] gap-0 p-0">
              <div className="border-b border-border px-4 py-3">
                <div className="text-[13px] font-semibold">Compare variants</div>
                <div className="text-[12px] text-muted-foreground">Switch between the directions the designer is exploring.</div>
              </div>
              <div className="flex max-h-[360px] flex-col gap-3 overflow-y-auto p-3">
                {sets.map((set) => {
                  const letter = letterFor(set.id, allSets)
                  const choices = [{ id: "original", name: "Original" }, ...set.options.map((o, i) => ({ id: o.id, name: o.name, tag: `${letter}${i + 1}` }))]
                  return (
                    <div key={set.id} className="flex flex-col gap-2 rounded-xl border border-border p-3">
                      <div className="flex items-center gap-2">
                        <span className="grid size-5 place-items-center rounded-full bg-[var(--pc-variant)] text-[10.5px] font-semibold text-white">{letter}</span>
                        <span className="flex-1 truncate text-[12.5px] font-medium">{set.name}</span>
                        <span className="text-[11.5px] text-muted-foreground">{screenMeta(set.screen).title}</span>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {choices.map((c) => {
                          const active = set.selected === c.id
                          return (
                            <button
                              key={c.id}
                              type="button"
                              onClick={() => {
                                if (useTool.getState().screen !== set.screen) useTool.getState().setScreen(set.screen)
                                useTool.setState((s) => ({
                                  variantSets: s.variantSets.map((v) => (v.id === set.id ? { ...v, selected: c.id } : v)),
                                }))
                              }}
                              className={cn(
                                "inline-flex h-7 items-center gap-1 rounded-full border px-2.5 text-[12px] font-medium transition-colors",
                                active
                                  ? "border-[var(--pc-variant)] bg-[color-mix(in_oklab,var(--pc-variant),transparent_88%)] text-[var(--pc-variant)]"
                                  : "border-border text-muted-foreground hover:border-foreground/20 hover:text-foreground",
                              )}
                            >
                              {active && <Check className="size-3" />}
                              {"tag" in c && c.tag && <span className="opacity-60">{c.tag}</span>}
                              {c.name}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}
              </div>
            </PopoverContent>
          </Popover>
        </>
      )}

      <Divider />
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="flex h-9 items-center gap-1.5 rounded-full px-3 text-[12.5px] font-medium text-muted-foreground">
            <span className="relative flex size-2">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-500 opacity-60" />
              <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
            </span>
            <Eye className="size-3.5" />
            <span className="tabular">{Math.max(1, viewers)}</span>
          </span>
        </TooltipTrigger>
        <TooltipContent side="top">
          {Math.max(1, viewers)} {Math.max(1, viewers) === 1 ? "person" : "people"} viewing now
        </TooltipContent>
      </Tooltip>
    </motion.div>
  )
}
