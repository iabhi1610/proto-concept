import * as React from "react"
import { AnimatePresence, motion } from "motion/react"
import { cn } from "@/lib/utils"
import { elInfo, findEl } from "../engine/dom"
import { useTool } from "../store"
import { DashedOutline } from "./DashedOutline"
import { useLiveBoxes, type Box } from "./geometry"

const COMMENT = "var(--pc-comment)"
const VARIANT = "var(--pc-variant)"

function Label({ box, text, color }: { box: Box; text: string; color: string }) {
  const above = box.y > 26
  return (
    <div
      className="pointer-events-none fixed z-[41] flex h-5 max-w-[260px] items-center truncate rounded-[5px] px-1.5 font-sans text-[11px] font-medium text-white shadow-sm"
      style={{ left: Math.max(4, box.x), top: above ? box.y - 23 : box.y + box.h + 3, background: color }}
    >
      {text}
    </div>
  )
}

export function Highlights({ marquee }: { marquee: Box | null }) {
  const mode = useTool((s) => s.mode)
  const hoverId = useTool((s) => s.hoverId)
  const selection = useTool((s) => s.selection)
  const active = mode === "comment" || mode === "variants"
  const color = mode === "variants" ? VARIANT : COMMENT
  const ids = React.useMemo(() => (active ? [...new Set([...(hoverId ? [hoverId] : []), ...selection])] : []), [active, hoverId, selection])
  const boxes = useLiveBoxes(ids)
  const hoverBox = hoverId ? boxes[hoverId] : null
  const hoverEl = hoverId ? findEl(hoverId) : null
  const showHover = hoverBox && hoverEl && !selection.includes(hoverId!)
  // glide the outline when a single selection moves (arrow-key traversal), but stay glued while scrolling
  const [glide, setGlide] = React.useState(false)
  const single = selection.length === 1 ? selection[0] : null
  const prevSingle = React.useRef(single)
  React.useEffect(() => {
    const moved = prevSingle.current && single && prevSingle.current !== single
    prevSingle.current = single
    if (!moved) return
    setGlide(true)
    const t = window.setTimeout(() => setGlide(false), 220)
    return () => window.clearTimeout(t)
  }, [single])

  if (!active) return null
  return (
    <>
      {showHover && (
        <>
          <div
            className="pointer-events-none fixed z-[40] rounded-[3px] transition-[left,top,width,height] duration-75"
            style={{
              left: hoverBox.x - 2,
              top: hoverBox.y - 2,
              width: hoverBox.w + 4,
              height: hoverBox.h + 4,
              background: `color-mix(in oklab, ${color}, transparent 94%)`,
            }}
          >
            <DashedOutline color={color} />
          </div>
          <Label box={{ ...hoverBox, x: hoverBox.x - 2, y: hoverBox.y - 2 }} text={elInfo(hoverEl).name} color={color} />
        </>
      )}
      {active &&
        selection.map((id, i) => {
          const b = boxes[id]
          if (!b) return null
          return (
            <div
              key={selection.length === 1 ? "single" : id + i}
              className={cn(
                "pointer-events-none fixed z-[40] rounded-[3px]",
                glide && "transition-[left,top,width,height] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)]",
              )}
              style={{
                left: b.x - 2,
                top: b.y - 2,
                width: b.w + 4,
                height: b.h + 4,
                outline: `2px solid ${color}`,
                background: `color-mix(in oklab, ${color}, transparent 93%)`,
              }}
            />
          )
        })}
      {mode === "comment" && selection.length > 1 && boxes[selection[0]] && (
        <Label box={{ ...boxes[selection[0]]!, x: boxes[selection[0]]!.x - 2, y: boxes[selection[0]]!.y - 2 }} text={`${selection.length} elements grouped`} color={color} />
      )}
      <AnimatePresence>
        {marquee && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="pointer-events-none fixed z-[42] rounded-[4px]"
            style={{
              left: marquee.x,
              top: marquee.y,
              width: marquee.w,
              height: marquee.h,
              border: `1px solid ${color}`,
              background: `color-mix(in oklab, ${color}, transparent 90%)`,
            }}
          />
        )}
      </AnimatePresence>
    </>
  )
}
