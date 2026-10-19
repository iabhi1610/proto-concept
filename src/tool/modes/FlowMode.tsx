import * as React from "react"
import { animate, motion, useMotionValue, useTransform, type MotionValue } from "motion/react"
import { cn } from "@/lib/utils"
import { ProductApp } from "@/product/ProductApp"
import { SCREENS } from "@/product/screens"
import { PRODUCT_ROOT_ID } from "../engine/dom"
import { useTool } from "../store"
import type { Mode, ScreenId } from "../types"
import { FLOW_EDGES, LABEL_H, computeLayout, edgePath, type NodePos } from "./flow/layout"

/*
 * Flow mode, Safari-tab-overview style. One motion value, `progress`, drives the whole scene:
 * 0 = the live screen filling the window, 1 = the map of every screen. A trackpad pinch writes it
 * directly (the page follows your fingers, rubber-banding past the map); letting go springs it to
 * whichever end you were heading for. Keys and clicks animate the same value, so every path in and
 * out looks identical.
 *
 * The map is mounted ahead of time (hidden) so the first pinch doesn't wait on five previews.
 */

type Phase = "hidden" | "moving" | "idle"

const SPRING = { type: "spring", stiffness: 260, damping: 30, mass: 0.9 } as const
/** how far one pixel of pinch moves progress */
const PINCH_GAIN = 0.0105
/** past the map the scene keeps shrinking, but resists (rubber band) */
const RUBBER = 0.28

const clamp01 = (v: number) => Math.max(0, Math.min(1, v))

function useViewport() {
  const [size, setSize] = React.useState(() => ({ W: window.innerWidth, H: window.innerHeight }))
  React.useEffect(() => {
    const on = () => setSize({ W: window.innerWidth, H: window.innerHeight })
    window.addEventListener("resize", on)
    return () => window.removeEventListener("resize", on)
  }, [])
  return size
}

const typing = (t: EventTarget | null) => {
  const el = t as HTMLElement | null
  return !!el && (el.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName))
}

export function FlowMode() {
  const mode = useTool((s) => s.mode)
  const screen = useTool((s) => s.screen)
  const { W, H } = useViewport()
  const layout = React.useMemo(() => computeLayout(W, H), [W, H])

  const progress = useMotionValue(0)
  const [phase, setPhaseState] = React.useState<Phase>("hidden")
  const phaseRef = React.useRef<Phase>("hidden")
  const setPhase = (p: Phase) => ((phaseRef.current = p), setPhaseState(p))
  /** the screen we zoomed out of (gets "You are here") */
  const [origin, setOrigin] = React.useState<ScreenId>(screen)
  /** the node that scales between full-window and map size (origin on the way out, the picked screen on the way in) */
  const [subject, setSubject] = React.useState<ScreenId>(screen)
  /** bump to re-snapshot the live page into the origin node */
  const [snap, setSnap] = React.useState(0)
  const prevMode = React.useRef<Mode>("browse")
  const anim = React.useRef<ReturnType<typeof animate> | null>(null)
  const hoverNode = React.useRef<ScreenId | null>(null)
  /** keyboard focus on the map (arrows move it, Enter opens it); starts on the screen you came from */
  const [focusId, setFocusId] = React.useState<ScreenId>(screen)
  const focusRef = React.useRef(focusId)
  focusRef.current = focusId

  // mount the (hidden) map once the app is idle so the first pinch is instant
  const [primed, setPrimed] = React.useState(false)
  React.useEffect(() => {
    const t = window.setTimeout(() => setPrimed(true), 1200)
    return () => window.clearTimeout(t)
  }, [])

  const stop = () => anim.current?.stop()

  /** begin showing the map from the live page */
  const openFrom = React.useCallback((from: ScreenId) => {
    const st = useTool.getState()
    if (st.mode !== "flow") prevMode.current = st.mode
    setOrigin(from)
    setSubject(from)
    setFocusId(from)
    setSnap((n) => n + 1)
    setPrimed(true)
    setPhase("moving")
  }, [])

  /** land on the map */
  const settleIn = React.useCallback(
    (velocity = 0) => {
      stop()
      setPhase("moving")
      if (useTool.getState().mode !== "flow") useTool.getState().setMode("flow")
      anim.current = animate(progress, 1, {
        ...SPRING,
        velocity,
        onComplete: () => setPhase("idle"),
      })
    },
    [progress],
  )

  /** zoom into a screen and hand the window back to the app */
  const settleOut = React.useCallback(
    (to: ScreenId, velocity = 0, restore = false) => {
      stop()
      setSubject(to)
      setPhase("moving")
      anim.current = animate(progress, 0, {
        ...SPRING,
        velocity,
        onComplete: () => {
          const st = useTool.getState()
          if (to !== st.screen) st.setScreen(to)
          const back = restore ? prevMode.current : "browse"
          if (useTool.getState().mode !== back) useTool.getState().setMode(back === "flow" ? "browse" : back)
          setPhase("hidden")
        },
      })
    },
    [progress],
  )

  // F / toolbar: mode flips on → animate in; something else turns flow off → zoom back to origin
  React.useEffect(() => {
    if (mode === "flow" && phaseRef.current === "hidden") {
      openFrom(screen)
      requestAnimationFrame(() => settleIn())
    } else if (mode !== "flow" && phaseRef.current === "idle") {
      settleOut(origin)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode])

  // on the map: arrows move the focus ring to the nearest screen that way, Enter opens it, Esc goes back
  React.useEffect(() => {
    if (phase !== "idle") return
    const onKey = (e: KeyboardEvent) => {
      if (typing(e.target) || e.metaKey || e.ctrlKey || e.altKey) return
      const dirs: Record<string, [number, number]> = { ArrowRight: [1, 0], ArrowLeft: [-1, 0], ArrowDown: [0, 1], ArrowUp: [0, -1] }
      if (dirs[e.key]) {
        e.preventDefault()
        e.stopPropagation()
        const [dx, dy] = dirs[e.key]
        const { pos, nw, nh } = layout
        const c = (id: ScreenId) => ({ x: pos[id].x + nw / 2, y: pos[id].y + nh / 2 })
        const from = c(focusRef.current)
        let best: ScreenId | null = null
        let bestScore = Infinity
        for (const sc of SCREENS) {
          if (sc.id === focusRef.current) continue
          const to = c(sc.id)
          const along = (to.x - from.x) * dx + (to.y - from.y) * dy
          if (along <= 1) continue
          const across = Math.abs((to.x - from.x) * dy + (to.y - from.y) * dx)
          const score = along + across * 2
          if (score < bestScore) (bestScore = score, (best = sc.id))
        }
        if (best) setFocusId(best)
        return
      }
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault()
        e.stopPropagation()
        settleOut(focusRef.current)
        return
      }
      if (e.key !== "Escape") return
      e.preventDefault()
      e.stopPropagation()
      settleOut(origin, 0, true)
    }
    window.addEventListener("keydown", onKey, true)
    return () => window.removeEventListener("keydown", onKey, true)
  }, [phase, origin, settleOut, layout])

  const subjectRef = React.useRef(subject)
  subjectRef.current = subject

  /* ── trackpad pinch: Chrome/Firefox send ctrl+wheel, Safari sends gesture events ── */
  React.useEffect(() => {
    let raw = 0 // un-rubber-banded progress while the fingers are down
    let active = false
    let endTimer = 0
    let lastT = 0
    let vel = 0 // progress per second, for the release spring
    let fromMap = false // which end the gesture started at

    const begin = () => {
      const st = useTool.getState()
      if (st.shareOpen || st.paperOpen || st.shortcutsOpen) return false
      stop()
      fromMap = phaseRef.current === "idle" || progress.get() > 0.5
      if (phaseRef.current === "hidden") {
        openFrom(st.screen)
        raw = 0
      } else {
        // pinching out of the map zooms into the screen under the cursor
        if (phaseRef.current === "idle") setSubject(hoverNode.current ?? focusRef.current)
        raw = progress.get()
        setPhase("moving")
      }
      active = true
      lastT = performance.now()
      vel = 0
      return true
    }
    const move = (delta: number) => {
      const now = performance.now()
      raw = Math.max(-0.05, raw + delta)
      const shown = raw > 1 ? 1 + (raw - 1) * RUBBER : clamp01(raw)
      const dt = Math.max(1, now - lastT) / 1000
      vel = vel * 0.6 + (delta / dt) * 0.4
      lastT = now
      progress.set(shown)
    }
    const end = () => {
      active = false
      const p = progress.get()
      const v = Math.max(-8, Math.min(8, vel))
      // like Safari: a real flick commits, otherwise you need to cover ~40% of the way from where you started
      const FLICK = 3
      const toMap = fromMap ? !(v < -FLICK && p < 0.9) && p > 0.6 : (v > FLICK && p > 0.15) || (v > -FLICK && p > 0.4)
      if (toMap) settleIn(v)
      else settleOut(subjectRef.current, v, true)
    }

    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey || typing(e.target)) return
      e.preventDefault() // stop the browser's own page zoom
      if (!active && !begin()) return
      move(e.deltaY * PINCH_GAIN)
      window.clearTimeout(endTimer)
      endTimer = window.setTimeout(end, 140)
    }

    let gScale = 1
    const onGestureStart = (e: Event) => {
      e.preventDefault()
      gScale = 1
      begin()
    }
    const onGestureChange = (e: Event) => {
      e.preventDefault()
      if (!active) return
      const s = (e as unknown as { scale: number }).scale
      move((gScale - s) * 1.6)
      gScale = s
    }
    const onGestureEnd = (e: Event) => {
      e.preventDefault()
      if (active) end()
    }

    window.addEventListener("wheel", onWheel, { passive: false })
    window.addEventListener("gesturestart", onGestureStart)
    window.addEventListener("gesturechange", onGestureChange)
    window.addEventListener("gestureend", onGestureEnd)
    return () => {
      window.clearTimeout(endTimer)
      window.removeEventListener("wheel", onWheel)
      window.removeEventListener("gesturestart", onGestureStart)
      window.removeEventListener("gesturechange", onGestureChange)
      window.removeEventListener("gestureend", onGestureEnd)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [origin, openFrom, settleIn, settleOut])

  // whole scene keeps shrinking a little past the map (the rubber band)
  const sceneScale = useTransform(progress, (p) => (p > 1 ? 1 - (p - 1) * 0.6 : 1))
  const chromeOpacity = useTransform(progress, [0.55, 1], [0, 1])

  if (!primed) return null
  const { s, nw, nh, pos } = layout
  const idle = phase === "idle"

  return (
    <div
      className="fixed inset-0 z-[45] overflow-hidden bg-pc-canvas"
      style={{
        visibility: phase === "hidden" ? "hidden" : "visible",
        backgroundImage: "radial-gradient(var(--pc-canvas-dot) 1px, transparent 1px)",
        backgroundSize: "22px 22px",
      }}
      aria-hidden={phase === "hidden"}
      onClick={() => idle && settleOut(origin, 0, true)}
    >
      <motion.div className="absolute inset-0" style={{ scale: sceneScale, transformOrigin: "50% 50%" }}>
        {/* edges */}
        <motion.svg className="pointer-events-none absolute inset-0 size-full" style={{ opacity: chromeOpacity }}>
          {FLOW_EDGES.map((e) => {
            const p = edgePath(e, pos, nw, nh)
            const hot = e.from === origin || e.to === origin
            const stroke = hot ? "var(--pc-comment)" : "var(--muted-foreground)"
            return (
              <g key={`${e.from}-${e.to}`}>
                <path d={p.d} fill="none" stroke={stroke} strokeOpacity={hot ? 0.75 : 0.45} strokeWidth={1.5} strokeDasharray={e.dir === "v" ? "4 4" : undefined} />
                <path
                  d="M -7 -4 L 0 0 L -7 4"
                  fill="none"
                  stroke={stroke}
                  strokeOpacity={hot ? 0.85 : 0.55}
                  strokeWidth={1.5}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  transform={`translate(${p.ex} ${p.ey}) rotate(${p.angle})`}
                />
              </g>
            )
          })}
        </motion.svg>
        {FLOW_EDGES.map((e) => {
          const p = edgePath(e, pos, nw, nh)
          return (
            <motion.span
              key={`label-${e.from}-${e.to}`}
              className="pointer-events-none absolute z-[1] -translate-x-1/2 -translate-y-1/2 whitespace-nowrap rounded-full border border-border bg-background px-2 py-0.5 text-[11px] font-medium text-muted-foreground pc-shadow-sm"
              style={{ left: p.mx, top: p.my, opacity: chromeOpacity }}
            >
              {e.label}
            </motion.span>
          )
        })}

        {/* nodes */}
        {SCREENS.map((sc) => (
          <FlowNode
            key={sc.id}
            id={sc.id}
            title={sc.title}
            path={sc.path}
            p={pos[sc.id]}
            s={s}
            nw={nw}
            nh={nh}
            W={W}
            H={H}
            progress={progress}
            idle={idle}
            isOrigin={sc.id === origin}
            isFocused={sc.id === focusId}
            isSubject={sc.id === subject}
            visible={phase !== "hidden"}
            snap={snap}
            onOpen={() => settleOut(sc.id)}
            onHover={(on) => (hoverNode.current = on ? sc.id : hoverNode.current === sc.id ? null : hoverNode.current)}
          />
        ))}
      </motion.div>
    </div>
  )
}

function FlowNode({
  id,
  title,
  path,
  p,
  s,
  nw,
  nh,
  W,
  H,
  progress,
  idle,
  isOrigin,
  isFocused,
  isSubject,
  visible,
  snap,
  onOpen,
  onHover,
}: {
  id: ScreenId
  title: string
  path: string
  p: NodePos
  s: number
  nw: number
  nh: number
  W: number
  H: number
  progress: MotionValue<number>
  idle: boolean
  isOrigin: boolean
  isFocused: boolean
  isSubject: boolean
  visible: boolean
  snap: number
  onOpen: () => void
  onHover: (on: boolean) => void
}) {
  // the subject travels between "fills the window" (progress 0) and its map slot (progress 1);
  // everything else fades and settles in around it
  const x = useTransform(progress, (v) => (isSubject ? -p.x * (1 - v) : 0))
  const y = useTransform(progress, (v) => (isSubject ? -p.y * (1 - v) : 0))
  const scale = useTransform(progress, (v) => (isSubject ? 1 / s + (1 - 1 / s) * v : 0.9 + 0.1 * clamp01(v)))
  const opacity = useTransform(progress, (v) => (isSubject ? 1 : clamp01((v - 0.12) / 0.6)))
  const radius = useTransform(progress, (v) => 12 * clamp01(v))
  const labelOpacity = useTransform(progress, [0.75, 1], [0, 1])

  return (
    <motion.div
      className={cn("absolute", isSubject ? "z-20" : "z-[2]")}
      style={{ left: p.x, top: p.y, width: nw, originX: 0, originY: 0, x, y, scale, opacity, willChange: "transform, opacity" }}
      onPointerEnter={() => onHover(true)}
      onPointerLeave={() => onHover(false)}
    >
      <motion.div
        role="button"
        tabIndex={idle ? 0 : -1}
        aria-label={`Open ${title}`}
        onKeyDown={(e) => {
          if (idle && (e.key === "Enter" || e.key === " ")) {
            e.preventDefault()
            onOpen()
          }
        }}
        onClick={(e) => {
          e.stopPropagation()
          if (idle) onOpen()
        }}
        className={cn(
          "group relative block overflow-hidden bg-background text-left outline-none transition-shadow duration-200",
          "shadow-[0_1px_2px_rgb(0_0_0/0.06),0_10px_30px_-8px_rgb(0_0_0/0.22)]",
          isFocused && idle ? "ring-2 ring-[#3b82f6]" : "ring-1 ring-black/[0.06] dark:ring-white/10",
          idle && "cursor-pointer",
        )}
        style={{ width: nw, height: nh, borderRadius: radius }}
      >
        <div className="pointer-events-none absolute left-0 top-0" style={{ width: W, height: H, transform: `scale(${s})`, transformOrigin: "0 0" }}>
          {/* the live snapshot exists only while the map is showing (it duplicates the page's element ids) */}
          {isOrigin ? visible && <LiveClone key={snap} /> : <ScreenPreview id={id} />}
        </div>
      </motion.div>
      <motion.div className="flex items-center gap-2 pt-2.5" style={{ height: LABEL_H, opacity: labelOpacity }}>
        <span className="text-[12.5px] font-semibold tracking-[-0.01em] text-foreground">{title}</span>
        <span className="font-mono text-[11px] text-muted-foreground">{path}</span>
        {isOrigin && (
          <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-[#3b82f6] px-2 py-px text-[10.5px] font-semibold text-white">
            <span className="size-1.5 rounded-full bg-white" />
            You are here
          </span>
        )}
      </motion.div>
    </motion.div>
  )
}

/** A whole product screen at full size; memoised so gesture state changes never re-render it. */
const ScreenPreview = React.memo(function ScreenPreview({ id }: { id: ScreenId }) {
  return <ProductApp screen={id} preview />
})

/**
 * Pixel-exact copy of the live product (edits, forced states, scroll position) for the screen
 * the user is zooming out of, so the transition starts without any visual jump. Re-taken on
 * every entry (the parent bumps its key).
 */
function LiveClone() {
  const ref = React.useRef<HTMLDivElement>(null)
  React.useLayoutEffect(() => {
    const host = ref.current
    const src = document.getElementById(PRODUCT_ROOT_ID)
    if (!host || !src) return
    const clone = src.cloneNode(true) as HTMLElement
    clone.removeAttribute("id")
    clone.setAttribute("aria-hidden", "true")
    clone.setAttribute("inert", "")
    host.replaceChildren(clone)
    const liveScroll = src.querySelector<HTMLElement>("[data-pc-scroll]")
    const cloneScroll = clone.querySelector<HTMLElement>("[data-pc-scroll]")
    if (liveScroll && cloneScroll) cloneScroll.scrollTop = liveScroll.scrollTop
    return () => host.replaceChildren()
  }, [])
  return <div ref={ref} className="size-full" />
}
