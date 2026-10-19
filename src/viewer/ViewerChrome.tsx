import * as React from "react"
import { motion } from "motion/react"
import { Check, Eye, MessageSquarePlus, Shapes } from "@/lib/icons"
import { cn } from "@/lib/utils"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { screenMeta } from "@/product/screens"
import { letterFor } from "@/tool/actions"
import { useTool } from "@/tool/store"
import { LogoMark } from "@/tool/toolbar/Toolbar"
import { TEAL } from "./ViewerComments"
import { useViewer } from "./Viewer"

const Divider = () => <span aria-hidden className="mx-[3px] h-3 w-px shrink-0 bg-white/15" />

/** Same pill as the editor toolbar: dark, 46px, icon buttons with tooltips. */
const iconBtn =
  "relative grid size-9 shrink-0 place-items-center rounded-full outline-none transition-[background-color,color,transform] duration-150 active:scale-[0.94] [&_svg]:size-[18px]"
const idle = "text-white/85 hover:bg-white/10 hover:text-white data-[state=open]:bg-white data-[state=open]:text-[#1a1a1a]"

function Badge({ n, color }: { n: number; color: string }) {
  if (n <= 0) return null
  return (
    <span
      className="absolute -right-px -top-px z-10 grid h-4 min-w-4 place-items-center rounded-full px-0.5 text-[9px] font-semibold leading-none text-white outline outline-2 outline-[#1A1A1A]"
      style={{ background: color }}
    >
      {n > 9 ? "9+" : n}
    </span>
  )
}

export function ViewerChrome() {
  const { data, comments, viewers, commenting, setCommenting } = useViewer()
  const allSets = useTool((s) => s.variantSets)
  const screen = useTool((s) => s.screen)
  const sets = allSets.filter((v) => data.config.variantSets.includes(v.id))
  const canComment = data.config.role === "comment"
  const openCount = comments.filter((c) => c.status !== "resolved").length
  const watching = Math.max(1, viewers)

  return (
    <motion.div
      initial={{ y: 24, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ type: "spring", stiffness: 420, damping: 32, delay: 0.15 }}
      className="pc-inverse fixed bottom-5 left-1/2 z-40 flex h-[46px] -translate-x-1/2 items-center gap-1.5 rounded-[23px] bg-[#1A1A1A] p-[5px] text-white shadow-[0_2px_8px_#00000033,0_4px_16px_#0000001a]"
      data-pc-tool
    >
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="grid size-9 shrink-0 place-items-center rounded-full">
            <LogoMark />
          </span>
        </TooltipTrigger>
        <TooltipContent side="top" sideOffset={10}>
          Orbit Analytics · {screenMeta(screen).title} — shared via Proto Concept
        </TooltipContent>
      </Tooltip>

      {canComment && (
        <>
          <Divider />
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                aria-label="Comment"
                aria-pressed={commenting}
                onClick={() => setCommenting(!commenting)}
                className={cn(iconBtn, commenting ? "text-white" : idle)}
                style={commenting ? { background: TEAL } : undefined}
              >
                <MessageSquarePlus />
                <Badge n={commenting ? 0 : openCount} color={TEAL} />
              </button>
            </TooltipTrigger>
            <TooltipContent side="top" sideOffset={10}>{commenting ? "Exit comment mode (Esc)" : "Comment — click any element to leave feedback"}</TooltipContent>
          </Tooltip>
        </>
      )}

      {sets.length > 0 && (
        <>
          <Popover>
            <Tooltip>
              <TooltipTrigger asChild>
                <PopoverTrigger asChild>
                  <button type="button" aria-label="Variants" className={cn(iconBtn, idle)}>
                    <Shapes />
                    <Badge n={sets.length} color="#5E52ED" />
                  </button>
                </PopoverTrigger>
              </TooltipTrigger>
              <TooltipContent side="top" sideOffset={10}>Compare variants</TooltipContent>
            </Tooltip>
            <PopoverContent side="top" sideOffset={12} className="pc-inverse w-[360px] gap-0 bg-popover p-0 text-popover-foreground">
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
          <span aria-label={`${watching} viewing`} className="relative grid size-9 shrink-0 place-items-center rounded-full text-white/85 [&_svg]:size-[18px]">
            <Eye />
            <span className="absolute right-1.5 top-1.5 flex size-2">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-500 opacity-60" />
              <span className="relative inline-flex size-2 rounded-full bg-emerald-500 outline outline-2 outline-[#1A1A1A]" />
            </span>
          </span>
        </TooltipTrigger>
        <TooltipContent side="top" sideOffset={10}>
          {watching} {watching === 1 ? "person" : "people"} viewing now
        </TooltipContent>
      </Tooltip>
    </motion.div>
  )
}
