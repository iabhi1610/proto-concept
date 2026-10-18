import * as React from "react"
import { findEl } from "../engine/dom"

export interface Box {
  x: number
  y: number
  w: number
  h: number
}

const toBox = (r: DOMRect): Box => ({ x: r.left, y: r.top, w: r.width, h: r.height })
const same = (a: Box | null, b: Box | null) =>
  a === b || (!!a && !!b && Math.abs(a.x - b.x) < 0.5 && Math.abs(a.y - b.y) < 0.5 && Math.abs(a.w - b.w) < 0.5 && Math.abs(a.h - b.h) < 0.5)

/**
 * Live viewport boxes for inspectable elements, re-measured every animation frame and only
 * re-rendering when something actually moved (scroll, resize, edits that change layout).
 */
export function useLiveBoxes(ids: string[], lookup: (id: string) => HTMLElement | null = findEl): Record<string, Box | null> {
  const key = ids.join("|")
  const [boxes, setBoxes] = React.useState<Record<string, Box | null>>({})
  React.useEffect(() => {
    let raf = 0
    let last: Record<string, Box | null> = {}
    const tick = () => {
      const next: Record<string, Box | null> = {}
      let changed = false
      for (const id of ids) {
        const el = lookup(id)
        const b = el && el.isConnected ? toBox(el.getBoundingClientRect()) : null
        next[id] = b && b.w + b.h > 0 ? b : null
        if (!same(next[id], last[id] ?? null)) changed = true
      }
      if (changed || Object.keys(last).length !== ids.length) {
        last = next
        setBoxes(next)
      }
      raf = requestAnimationFrame(tick)
    }
    tick()
    return () => cancelAnimationFrame(raf)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])
  return boxes
}

export function useLiveBox(id: string | null, lookup?: (id: string) => HTMLElement | null) {
  const boxes = useLiveBoxes(id ? [id] : [], lookup)
  return id ? boxes[id] ?? null : null
}

export function unionBox(boxes: (Box | null | undefined)[]): Box | null {
  const bs = boxes.filter((b): b is Box => !!b)
  if (!bs.length) return null
  const x = Math.min(...bs.map((b) => b.x))
  const y = Math.min(...bs.map((b) => b.y))
  const r = Math.max(...bs.map((b) => b.x + b.w))
  const btm = Math.max(...bs.map((b) => b.y + b.h))
  return { x, y, w: r - x, h: btm - y }
}
