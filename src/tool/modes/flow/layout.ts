import type { ScreenId } from "@/tool/types"

export interface NodePos {
  id: ScreenId
  x: number
  y: number
}

export interface FlowEdge {
  from: ScreenId
  to: ScreenId
  label: string
  /** horizontal edges leave from the right side, vertical ones from the bottom */
  dir: "h" | "v"
}

export const FLOW_EDGES: FlowEdge[] = [
  { from: "signin", to: "overview", label: "Continue", dir: "h" },
  { from: "overview", to: "events", label: "View events", dir: "h" },
  { from: "overview", to: "funnels", label: "Open funnel", dir: "h" },
  { from: "overview", to: "retention", label: "Cohorts", dir: "h" },
  { from: "overview", to: "settings", label: "Settings", dir: "v" },
]

export const LABEL_H = 34
const HEADER = 92
const FOOTER = 96

/**
 * Lays the six screens out as a map that fits the viewport:
 * Sign in → Overview → (Events / Funnels / Retention stacked), Settings under Overview.
 */
export function computeLayout(W: number, H: number) {
  const gapX = Math.max(96, W * 0.085)
  const gapY = 30
  const availW = W - 96
  const availH = H - HEADER - FOOTER
  const sByH = (availH - 2 * gapY - 3 * LABEL_H) / (3 * H)
  const sByW = (availW - 2 * gapX) / (3 * W)
  const s = Math.max(0.08, Math.min(sByH, sByW, 0.3))
  const nw = W * s
  const nh = H * s
  const rowH = nh + LABEL_H
  const totalW = 3 * nw + 2 * gapX
  const x0 = (W - totalW) / 2
  const stackH = 3 * rowH + 2 * gapY
  const yStack = HEADER + Math.max(0, (availH - stackH) / 2)

  const col = (i: number) => x0 + i * (nw + gapX)
  const right: ScreenId[] = ["events", "funnels", "retention"]
  const pos: Record<ScreenId, NodePos> = {} as Record<ScreenId, NodePos>
  right.forEach((id, i) => (pos[id] = { id, x: col(2), y: yStack + i * (rowH + gapY) }))
  const overviewY = pos.funnels.y - (rowH + gapY) / 2
  pos.overview = { id: "overview", x: col(1), y: overviewY }
  pos.settings = { id: "settings", x: col(1), y: overviewY + rowH + gapY }
  pos.signin = { id: "signin", x: col(0), y: overviewY }
  return { s, nw, nh, pos }
}

/** Cubic bezier between two nodes plus its midpoint (for the label). */
export function edgePath(e: FlowEdge, pos: Record<ScreenId, NodePos>, nw: number, nh: number) {
  const a = pos[e.from]
  const b = pos[e.to]
  if (e.dir === "v") {
    const x1 = a.x + nw / 2
    const y1 = a.y + nh + LABEL_H - 2
    const x2 = b.x + nw / 2
    const y2 = b.y - 6
    const my = (y1 + y2) / 2
    return { d: `M ${x1} ${y1} C ${x1} ${my}, ${x2} ${my}, ${x2} ${y2}`, mx: (x1 + x2) / 2, my, ex: x2, ey: y2, angle: 90 }
  }
  const x1 = a.x + nw + 6
  const y1 = a.y + nh / 2
  const x2 = b.x - 8
  const y2 = b.y + nh / 2
  const c = (x2 - x1) * 0.5
  return { d: `M ${x1} ${y1} C ${x1 + c} ${y1}, ${x2 - c} ${y2}, ${x2} ${y2}`, mx: (x1 + x2) / 2, my: (y1 + y2) / 2, ex: x2, ey: y2, angle: 0 }
}
