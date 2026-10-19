import * as React from "react"
import { AnimatePresence, motion } from "motion/react"
import { SlidersHorizontal } from "@/lib/icons"
import { restingState, statesFor } from "../actions"
import { elInfo, findEl } from "../engine/dom"
import { INSPECTOR_W, useTool } from "../store"
import { ChangesBar, PropertiesPanel } from "./PropertiesPanel"

/**
 * v2: Figma-style inspector docked on the right for the whole of comment mode. It shows the
 * selection's properties (the floating popover keeps only the prompt), with Add comment at its foot.
 */
export function PropertiesInspector() {
  const show = useTool((s) => s.mode === "comment" && !s.commentsOpen)
  const selection = useTool((s) => s.selection)
  const forced = useTool((s) => s.forced)
  const applyAll = useTool((s) => s.applyAll)
  const el = selection.length ? findEl(selection[0]) : null
  const info = el ? elInfo(el) : null
  const states = React.useMemo(() => statesFor(selection), [selection])
  const rest = selection[0] ? restingState(selection[0]) : "default"
  const current = (selection[0] && forced[selection[0]]) ?? (states.some((s) => s.id === rest) ? rest : (states[0]?.id ?? "default"))
  const title = selection.length > 1 ? `${selection.length} elements` : info ? (info.component === "Text" && info.label ? `“${info.label}”` : info.name) : ""

  return (
    <AnimatePresence>
      {show && (
        <motion.aside
          key="inspector"
          data-pc-tool
          initial={{ x: INSPECTOR_W, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: INSPECTOR_W, opacity: 0, transition: { duration: 0.18, ease: [0.4, 0, 1, 1] } }}
          transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
          style={{ width: INSPECTOR_W, willChange: "transform" }}
          className="fixed right-0 top-0 bottom-[var(--pc-bar)] z-[50] flex flex-col overflow-hidden border-l border-border bg-background text-foreground"
        >
          <div className="flex h-11 shrink-0 items-center gap-2 border-b border-border px-3">
            <span className="min-w-0 flex-1 truncate text-[12.5px] font-medium">{title || "Properties"}</span>
            {info && (
              <span className="shrink-0 rounded-md bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">
                {applyAll ? "All states" : (states.find((s) => s.id === current)?.label ?? "Default")}
              </span>
            )}
          </div>
          {info ? (
            <>
              <div className="min-h-0 flex-1">
                <PropertiesPanel key={selection.join("|")} state={current} fill />
              </div>
              <div className="shrink-0 border-t border-border p-2.5">
                <ChangesBar elIds={selection} />
              </div>
            </>
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 px-8 text-center">
              <span className="grid size-10 place-items-center rounded-xl bg-muted text-muted-foreground [&_svg]:size-5">
                <SlidersHorizontal />
              </span>
              <span className="text-[13px] font-medium">Select an element</span>
              <span className="text-[12px] leading-relaxed text-muted-foreground">Its properties show up here. Click anything on the page, or use ↑ ↓ to move between layers.</span>
            </div>
          )}
        </motion.aside>
      )}
    </AnimatePresence>
  )
}
