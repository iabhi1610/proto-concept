import * as React from "react"
import { ProductContext } from "@/product/shell"
import { EventsTable } from "@/product/screens/events"
import { OverviewActions, OverviewChart, OverviewKpis } from "@/product/screens/overview"
import { findEl } from "../../engine/dom"
import type { VariantOption, VariantSet } from "../../types"

/** last measured preview height per set/option, so a deferred preview's placeholder has the right size */
export const previewHeights = new Map<string, number>()

const previewCtx = { screen: "overview" as const, navigate: () => {}, preview: true }

const SEEDED: Partial<Record<string, (option: string) => React.ReactNode>> = {
  "vs-kpis": (o) => <OverviewKpis option={o} />,
  "vs-actions": (o) => <OverviewActions option={o} />,
  "vs-chart": (o) => <OverviewChart option={o} height={200} />,
  "vs-events": (o) => <EventsTable option={o} />,
}

/**
 * Renders an element at its live width and scales it to fit the card. Seeded sets render real
 * alternate markup; style sets clone the live DOM node and apply the variant's CSS inline.
 */
export function VariantPreview({ set, option, maxHeight = 150 }: { set: VariantSet; option: VariantOption | "original"; maxHeight?: number }) {
  const outer = React.useRef<HTMLDivElement>(null)
  const inner = React.useRef<HTMLDivElement>(null)
  /** React never renders into this; it only holds the cloned node, so it goes away with style previews */
  const cloneHost = React.useRef<HTMLDivElement>(null)
  const [scale, setScale] = React.useState(0.5)
  const [h, setH] = React.useState(80)
  const live = findEl(set.elId)
  const naturalW = Math.max(120, Math.round(live?.getBoundingClientRect().width ?? 600))
  const optionId = option === "original" ? "original" : option.id
  const seeded = SEEDED[set.id]

  // style variants: clone the live node into the preview
  React.useLayoutEffect(() => {
    if (seeded || !cloneHost.current) return
    const host = cloneHost.current
    host.replaceChildren()
    const src = findEl(set.elId)
    if (!src) return
    const clone = src.cloneNode(true) as HTMLElement
    clone.removeAttribute("data-pc-id")
    clone.querySelectorAll("[data-pc-id]").forEach((n) => n.removeAttribute("data-pc-id"))
    clone.setAttribute("data-pc-state", src.dataset.pcRest ?? "default")
    clone.style.margin = "0"
    if (option !== "original" && option.style) for (const [k, v] of Object.entries(option.style)) clone.style.setProperty(k, v, "important")
    host.appendChild(clone)
  }, [seeded, set.elId, optionId, option])

  React.useLayoutEffect(() => {
    const o = outer.current
    const i = inner.current
    if (!o || !i) return
    const fit = () => {
      const avail = o.clientWidth - 24
      const ih = i.scrollHeight
      const s = Math.min(1, avail / naturalW, (maxHeight - 24) / Math.max(ih, 1))
      setScale(s)
      const next = Math.min(maxHeight, ih * s + 24)
      setH(next)
      previewHeights.set(`${set.id}:${optionId}`, next)
    }
    fit()
    const ro = new ResizeObserver(fit)
    ro.observe(i)
    ro.observe(o)
    return () => ro.disconnect()
  }, [naturalW, maxHeight, optionId, set.id])

  return (
    <div ref={outer} className="relative w-full overflow-hidden" style={{ height: h }}>
      <div
        className="orbit-app absolute left-1/2 top-3 origin-top !bg-transparent"
        style={{ width: naturalW, transform: `translateX(-50%) scale(${scale})`, pointerEvents: "none" }}
      >
        <ProductContext.Provider value={previewCtx}>
          <div ref={inner}>{seeded ? seeded(optionId) : <div ref={cloneHost} />}</div>
        </ProductContext.Provider>
      </div>
    </div>
  )
}
