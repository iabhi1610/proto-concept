import * as React from "react"
import { AnimatePresence, motion, useAnimate } from "motion/react"
import {
  Check,
  Copy,
  Ellipsis,
  GitPullRequestArrow,
  Keyboard,
  MessagesSquare,
  Moon,
  MousePointer2,
  PenTool,
  RotateCcw,
  Shapes,
  Share,
  Sun,
  Trash2,
  Workflow,
} from "@/lib/icons"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuShortcut, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import { deleteAllComments } from "../actions"
import { useShareViewers } from "../share/useShareSync"
import { useTool } from "../store"
import { copyComments } from "../useShortcuts"

const spring = { type: "spring", stiffness: 500, damping: 38 } as const
// shadcn paints every descendant of a focused item with the theme accent (dark on light chrome);
// this menu sits on the dark toolbar, so icons stay white and shortcuts stay dimmed on hover
const menuItem =
  "text-white/80 focus:bg-white/10 focus:text-white focus:[&_svg]:text-white! focus:[&_svg_*]:text-white! dark:text-[#16171a] dark:focus:bg-black/[0.05] dark:focus:text-[#16171a] dark:focus:[&_svg]:text-[#16171a]! dark:focus:[&_svg_*]:text-[#16171a]!"
const menuKbd = "text-white/35 group-focus/dropdown-menu-item:text-white/45! dark:text-[#8a8c92] dark:group-focus/dropdown-menu-item:text-[#8a8c92]!"
/** open / close spring for the toolbar row (tuned earlier with DialKit) */
const COLLAPSE = { type: "spring", visualDuration: 0.22, bounce: 0.1 } as const
const CHIP = 46
const PAD = 8
/** a chip this close to the left / right edge opens as a vertical stack */
const EDGE = 80

/** Position of the logo chip. The bar grows away from it toward whichever side has room. */
type Pos = { x: number; y: number }
type Dir = "right" | "left" | "down" | "up"

/** Opens toward the side with room for the tools; prefers right (or down, at a side edge) when both fit. */
function pickDir(p: Pos, len: number): Dir {
  const spaceRight = window.innerWidth - (p.x + CHIP) - PAD
  const spaceLeft = p.x - PAD
  if (spaceLeft < EDGE || spaceRight < EDGE) {
    const spaceDown = window.innerHeight - (p.y + CHIP) - PAD
    const spaceUp = p.y - PAD
    if (spaceDown >= len) return "down"
    if (spaceUp >= len) return "up"
    return spaceDown >= spaceUp ? "down" : "up"
  }
  if (spaceRight >= len) return "right"
  if (spaceLeft >= len) return "left"
  return spaceRight >= spaceLeft ? "right" : "left"
}

/** Menus and tooltips open away from the screen edge the toolbar sits against. */
type Side = "top" | "bottom" | "left" | "right"
const SideContext = React.createContext<Side>("top")
const VerticalContext = React.createContext(false)


function clampPos(pos: Pos, w: number, h = CHIP): Pos {
  const maxX = Math.max(PAD, window.innerWidth - w - PAD)
  const maxY = Math.max(PAD, window.innerHeight - h - PAD)
  return {
    x: Math.min(Math.max(PAD, pos.x), maxX),
    y: Math.min(Math.max(PAD, pos.y), maxY),
  }
}

export function LogoMark({ className }: { className?: string }) {
  return (
    <img src="/prototypes-logo.png" alt="prototypes.fun" draggable={false} className={cn("size-5 select-none object-contain", className)} />
  )
}

function Kbd({ children }: { children: React.ReactNode }) {
  return <kbd className="ml-1.5 rounded border border-background/25 px-1 font-sans text-[10px] opacity-80">{children}</kbd>
}

function Divider() {
  const vertical = React.useContext(VerticalContext)
  return (
    <span
      aria-hidden
      className={cn("shrink-0 bg-white/15 dark:bg-black/10", vertical ? "my-[3px] h-px w-3" : "mx-[3px] h-3 w-px")}
    />
  )
}

function CountBadge({ n, color }: { n: number; color: string }) {
  if (n <= 0) return null
  return (
    <span
      className="absolute -right-px -top-px z-10 grid h-4 min-w-4 place-items-center rounded-full px-0.5 text-[9px] font-semibold leading-none text-white opacity-0 outline outline-2 outline-[#1A1A1A] transition-opacity duration-150 group-data-[settled=true]/row:opacity-100 dark:outline-white"
      style={{ background: color }}
    >
      {n > 9 ? "9+" : n}
    </span>
  )
}

function ToolButton({
  active,
  label,
  shortcut,
  icon,
  onClick,
  badge,
  accent,
  danger,
}: {
  accent?: string
  /** destructive action: turns red on hover */
  danger?: boolean
  active?: boolean
  label: string
  shortcut?: string
  icon: React.ReactNode
  onClick: () => void
  badge?: React.ReactNode
}) {
  const side = React.useContext(SideContext)
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label={label}
          aria-pressed={active}
          onClick={onClick}
          className={cn(
            "relative grid size-9 shrink-0 place-items-center rounded-full outline-none transition-[background-color,color,transform] duration-150 active:scale-[0.94] [&_svg]:size-[18px]",
            active
              ? accent
                ? "text-white"
                : "bg-white text-[#1a1a1a] dark:bg-[#1a1a1a] dark:text-white"
              : danger
                ? "text-white/85 hover:bg-[#ff9592]/15 hover:text-[#ff9592] dark:text-[#1a1a1a]/75 dark:hover:bg-[#ce2c31]/10 dark:hover:text-[#ce2c31]"
                : "text-white/85 hover:bg-white/10 hover:text-white dark:text-[#1a1a1a]/75 dark:hover:bg-black/[0.05] dark:hover:text-[#1a1a1a]",
          )}
          style={active && accent ? { backgroundColor: accent } : undefined}
        >
          {icon}
          {badge}
        </button>
      </TooltipTrigger>
      <TooltipContent side={side} sideOffset={10}>
        {label}
        {shortcut && <Kbd>{shortcut}</Kbd>}
      </TooltipContent>
    </Tooltip>
  )
}

const ACTIONS_W = 80 // 6px gap after the mode button + two 36px buttons 2px apart

/** Copy / Delete all, slid out of the Agent comments button while that mode is on and there are comments. */
function AgentActions({ show, count, onDelete }: { show: boolean; count: number; onDelete: () => void }) {
  const [copied, setCopied] = React.useState(false)
  React.useEffect(() => {
    if (!copied) return
    const t = setTimeout(() => setCopied(false), 1400)
    return () => clearTimeout(t)
  }, [copied])
  const vertical = React.useContext(VerticalContext)
  const axis = vertical ? "height" : "width"
  return (
    <motion.div
      initial={false}
      animate={{ [axis]: show ? ACTIONS_W : 0, opacity: show ? 1 : 0 }}
      transition={{ [axis]: COLLAPSE, opacity: { duration: show ? 0.16 : 0.08, delay: show ? 0.04 : 0 } }}
      inert={!show}
      className={cn("flex shrink-0 items-center gap-0.5 overflow-hidden", vertical ? "flex-col pt-1.5" : "pl-1.5")}
    >
      <ToolButton
        label={copied ? "Copied" : "Copy All Comments"}
        shortcut="C"
        icon={copied ? <Check /> : <Copy />}
        onClick={() => void copyComments({ quiet: true }).then((ok) => ok && setCopied(true))}
      />
      <span data-pc-delete-all className="contents">
        <ToolButton danger label={`Delete all comments (${count})`} icon={<Trash2 />} onClick={onDelete} />
      </span>
    </motion.div>
  )
}

/** "Delete all" confirmation: a small bar that pops out from the toolbar on the side away from the screen edge. */
function ConfirmDeleteBar({ count, shake, onConfirm, onCancel }: { count: number; shake: number; onConfirm: () => void; onCancel: () => void }) {
  const side = React.useContext(SideContext)
  const ref = React.useRef<HTMLDivElement>(null)
  // pressing Delete all again while the question is up shakes it instead of closing it
  const [shakeScope, animate] = useAnimate<HTMLDivElement>()
  const shakeAtOpen = React.useRef(shake)
  React.useEffect(() => {
    if (shake === shakeAtOpen.current || !shakeScope.current) return
    animate(shakeScope.current, { x: [0, -7, 7, -5, 5, -2, 0] }, { duration: 0.38, ease: "easeOut" })
  }, [shake, animate, shakeScope])
  // Esc and clicks anywhere else dismiss it (capture, so Esc doesn't also run the toolbar's Esc chain)
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return
      e.preventDefault()
      e.stopImmediatePropagation()
      onCancel()
    }
    const onDown = (e: PointerEvent) => {
      const t = e.target as Element
      if (ref.current?.contains(t) || t.closest?.("[data-pc-delete-all]")) return
      onCancel()
    }
    window.addEventListener("keydown", onKey, true)
    window.addEventListener("pointerdown", onDown, true)
    return () => {
      window.removeEventListener("keydown", onKey, true)
      window.removeEventListener("pointerdown", onDown, true)
    }
  }, [onCancel])
  React.useEffect(() => ref.current?.querySelector<HTMLButtonElement>("[data-confirm]")?.focus(), [])

  const GAP = 8
  const place: React.CSSProperties =
    side === "top"
      ? { bottom: `calc(100% + ${GAP}px)`, left: "50%", x: "-50%" } as React.CSSProperties
      : side === "bottom"
        ? { top: `calc(100% + ${GAP}px)`, left: "50%", x: "-50%" } as React.CSSProperties
        : side === "right"
          ? { left: `calc(100% + ${GAP}px)`, top: 0 }
          : { right: `calc(100% + ${GAP}px)`, top: 0 }
  // rises out of the toolbar: starts nudged toward it at 95% and settles at 100%
  const from = side === "top" ? { y: 12 } : side === "bottom" ? { y: -12 } : side === "right" ? { x: -12 } : { x: 12 }
  return (
    <motion.div
      ref={ref}
      role="alertdialog"
      aria-label="Delete all comments?"
      initial={{ opacity: 0, scale: 0.95, ...from }}
      animate={{ opacity: 1, scale: 1, x: (place as { x?: string }).x ?? 0, y: 0 }}
      exit={{ opacity: 0, scale: 0.95, ...from, transition: { duration: 0.12, ease: [0.4, 0, 1, 1] } }}
      transition={{ type: "spring", visualDuration: 0.26, bounce: 0.18, opacity: { duration: 0.14 } }}
      style={{ ...place, transformOrigin: side === "top" ? "50% 100%" : side === "bottom" ? "50% 0%" : side === "right" ? "0% 50%" : "100% 50%" }}
      className="absolute z-10"
    >
    <div
      ref={shakeScope}
      className={cn(
        "flex h-9 items-center gap-0.5 whitespace-nowrap rounded-full p-1 pl-3.5 text-[12px]",
        "bg-[#1A1A1A] text-white/85 shadow-[0_2px_8px_#00000033,0_4px_16px_#0000001a]",
        "dark:bg-white dark:text-[#1A1A1A]/80 dark:shadow-[0_0_0_1px_rgb(0_0_0/0.06),0_2px_8px_#0000001a,0_4px_16px_#0000000f]",
      )}
    >
      <span className="mr-1.5">
        {count === 1 ? "Delete 1 comment?" : `Delete all ${count} comments?`}
      </span>
      <button
        type="button"
        data-confirm
        onClick={onConfirm}
        className="h-7 rounded-full bg-[var(--pc-danger-solid)] px-2.5 font-medium text-white outline-none transition-[background-color,transform] duration-150 hover:bg-[#b8262b] focus-visible:ring-2 focus-visible:ring-[#ff9592]/50 active:scale-[0.96] dark:focus-visible:ring-[#ce2c31]/40"
      >
        Yes, I am sure
      </button>
      <button
        type="button"
        onClick={onCancel}
        className="h-7 rounded-full px-2.5 font-medium text-white/85 outline-none transition-[background-color,transform] duration-150 hover:bg-white/10 focus-visible:bg-white/10 active:scale-[0.96] dark:text-[#1A1A1A]/80 dark:hover:bg-black/[0.05] dark:focus-visible:bg-black/[0.05]"
      >
        Not Now
      </button>
    </div>
    </motion.div>
  )
}

/** Agent comments and its actions read as one capsule: a soft fill wraps them while it's open. */
function AgentGroup({ expanded, children }: { expanded: boolean; children: React.ReactNode }) {
  const vertical = React.useContext(VerticalContext)
  const p = expanded ? 2 : 0
  return (
    <motion.div
      initial={false}
      animate={vertical ? { paddingTop: p, paddingLeft: p, paddingRight: p } : { paddingLeft: p, paddingTop: p, paddingBottom: p }}
      transition={COLLAPSE}
      className={cn("relative flex shrink-0 items-center rounded-full", vertical && "flex-col")}
    >
      <motion.span
        aria-hidden
        initial={false}
        animate={{ opacity: expanded ? 1 : 0 }}
        transition={{ duration: expanded ? 0.2 : 0.1 }}
        className="pointer-events-none absolute inset-0 rounded-full bg-white/[0.16] dark:bg-black/[0.06]"
      />
      {children}
    </motion.div>
  )
}

export function Toolbar() {
  const mode = useTool((s) => s.mode)
  const toggleMode = useTool((s) => s.toggleMode)
  const theme = useTool((s) => s.theme)
  const toggleTheme = useTool((s) => s.toggleTheme)
  const comments = useTool((s) => s.comments)
  const sets = useTool((s) => s.variantSets)
  const commentsOpen = useTool((s) => s.commentsOpen)
  const prOpen = useTool((s) => s.prOpen)
  const shareOpen = useTool((s) => s.shareOpen)
  // agent comments (pins, C, delete-all) and shared-link comments (Comments sidebar) are counted apart
  const agentComments = comments.filter((c) => c.source !== "viewer")
  const open = agentComments.filter((c) => c.status === "open")
  const sharedOpen = comments.filter((c) => c.source === "viewer" && c.status === "open").length
  const viewers = useShareViewers()
  const [confirmDelete, setConfirmDelete] = React.useState(false)
  const [shake, setShake] = React.useState(0)
  const cancelDelete = React.useCallback(() => setConfirmDelete(false), [])

  const shellRef = React.useRef<HTMLDivElement>(null)
  const dragDist = React.useRef(0)
  const dragOrigin = React.useRef<{ px: number; py: number; x: number; y: number } | null>(null)
  const posRef = React.useRef<Pos | null>(null)
  const collapsedRef = React.useRef(false)
  const rowRef = React.useRef<HTMLDivElement>(null)
  // length of the tool row along the bar's axis (the same whether it lays out across or down)
  const [rowW, setRowW] = React.useState(0)
  const verticalRef = React.useRef(false)
  const measureRow = React.useCallback((el: HTMLElement) => (verticalRef.current ? el.scrollHeight : el.scrollWidth), [])
  // the first paint shows the bar as-is; later remounts animate open
  const [mounted, setMounted] = React.useState(false)
  React.useEffect(() => setMounted(true), [])
  const collapsed = useTool((s) => s.toolbarCollapsed)
  // the question only stands while the Delete all button it came from is on screen
  const confirming = confirmDelete && mode === "comment" && agentComments.length > 0 && !collapsed
  React.useEffect(() => {
    if (confirmDelete && !confirming) setConfirmDelete(false)
  }, [confirmDelete, confirming])
  const setCollapsed = React.useCallback((v: boolean | ((c: boolean) => boolean)) => {
    const st = useTool.getState()
    st.setToolbarCollapsed(typeof v === "function" ? v(st.toolbarCollapsed) : v)
  }, [])
  // every session starts docked at the bottom center; a position exists only once the bar is collapsed and dragged
  const [pos, setPos] = React.useState<Pos | null>(null)
  const [dir, setDir] = React.useState<Dir>("right")
  const logoRef = React.useRef<HTMLButtonElement>(null)
  posRef.current = pos
  collapsedRef.current = collapsed

  React.useEffect(() => {
    const onResize = () => {
      setPos((p) => {
        if (!p) return p
        const next = clampPos(p, CHIP)
        if (!collapsedRef.current) setDir(pickDir(next, rowRef.current ? measureRow(rowRef.current) : 300))
        return next
      })
    }
    const onMove = (e: PointerEvent) => {
      if (!collapsedRef.current) return
      const origin = dragOrigin.current
      if (!origin) return
      const dx = e.clientX - origin.px
      const dy = e.clientY - origin.py
      dragDist.current = Math.hypot(dx, dy)
      setPos(clampPos({ x: origin.x + dx, y: origin.y + dy }, CHIP))
    }
    const onUp = () => {
      dragOrigin.current = null
    }
    window.addEventListener("resize", onResize)
    window.addEventListener("pointermove", onMove)
    window.addEventListener("pointerup", onUp)
    window.addEventListener("pointercancel", onUp)
    return () => {
      window.removeEventListener("resize", onResize)
      window.removeEventListener("pointermove", onMove)
      window.removeEventListener("pointerup", onUp)
      window.removeEventListener("pointercancel", onUp)
    }
  }, [collapsed, measureRow])

  const beginDrag = React.useCallback((e: React.PointerEvent | PointerEvent) => {
    const current = posRef.current
    if (!collapsedRef.current || !current || e.button > 0) return
    dragDist.current = 0
    dragOrigin.current = { px: e.clientX, py: e.clientY, x: current.x, y: current.y }
  }, [])

  React.useLayoutEffect(() => {
    const el = shellRef.current
    if (!el) return
    const onDown = (e: PointerEvent) => beginDrag(e)
    el.addEventListener("pointerdown", onDown)
    return () => el.removeEventListener("pointerdown", onDown)
  }, [beginDrag, collapsed])

  const pinFromDom = React.useCallback(() => {
    const logo = logoRef.current
    const shell = shellRef.current
    if (!logo || !shell) return
    const l = logo.getBoundingClientRect()
    const r = shell.getBoundingClientRect()
    setPos({ x: l.left - (r.height - l.height) / 2, y: r.top })
  }, [])

  const toggleCollapsed = React.useCallback(() => {
    if (dragDist.current > 4) {
      dragDist.current = 0
      return
    }
    setCollapsed(!collapsed)
  }, [collapsed, setCollapsed])

  // collapse / expand can come from anywhere (logo, Esc, a tool shortcut): before the width animates,
  // pin the logo where it is (first collapse) or pick the side with room to grow into (expand)
  const wasCollapsed = React.useRef(collapsed)
  const toggledAt = React.useRef(0)
  const [settled, setSettled] = React.useState(!collapsed)
  if (collapsed && settled) setSettled(false)
  if (wasCollapsed.current !== collapsed) toggledAt.current = Date.now()
  React.useLayoutEffect(() => {
    if (wasCollapsed.current === collapsed) return
    wasCollapsed.current = collapsed
    if (collapsed) {
      if (!posRef.current) pinFromDom()
    } else if (posRef.current) setDir(pickDir(posRef.current, rowW))
  }, [collapsed, pinFromDom, rowW])

  const openDir: Dir = pos ? dir : "right"
  const vertical = openDir === "down" || openDir === "up"
  verticalRef.current = vertical
  const axis = vertical ? "height" : "width"
  // the row remounts when the bar changes orientation, so the observer re-attaches with it
  React.useLayoutEffect(() => {
    const el = rowRef.current
    if (!el) return
    const ro = new ResizeObserver(() => setRowW(measureRow(el)))
    ro.observe(el)
    setRowW(measureRow(el))
    return () => ro.disconnect()
  }, [measureRow, vertical])
  // left and up grow away from the logo, so the logo sits at the end of the shell and the row's divider trails
  const reversed = openDir === "left" || openDir === "up"
  const side: Side = pos && vertical ? (pos.x + CHIP / 2 < window.innerWidth / 2 ? "right" : "left") : pos && pos.y < 180 ? "bottom" : "top"
  const anchor: React.CSSProperties | undefined = pos
    ? openDir === "left"
      ? { right: window.innerWidth - pos.x - CHIP, top: pos.y }
      : openDir === "up"
        ? { left: pos.x, bottom: window.innerHeight - pos.y - CHIP }
        : { left: pos.x, top: pos.y }
    : undefined

  return (
    <SideContext.Provider value={side}>
    <VerticalContext.Provider value={vertical}>
    <div
      data-pc-toolbar
      data-open-dir={openDir}
      className={cn("fixed z-[60]", pos ? undefined : "bottom-5 left-1/2 -translate-x-1/2")}
      style={anchor}
    >
      <motion.div initial={{ y: 80, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ ...spring, delay: 0.15 }} className="relative">
        <AnimatePresence>
          {confirming && (
            <ConfirmDeleteBar
              count={agentComments.length}
              shake={shake}
              onCancel={cancelDelete}
              onConfirm={() => {
                deleteAllComments()
                setConfirmDelete(false)
              }}
            />
          )}
        </AnimatePresence>
        <div
          ref={shellRef}
          data-pc-tool
          onPointerDown={beginDrag}
          className={cn("touch-none select-none", collapsed && "cursor-grab active:cursor-grabbing")}
        >
      <div
        className={cn(
          "relative flex items-center rounded-[23px]",
          vertical ? (reversed ? "w-[46px] flex-col-reverse" : "w-[46px] flex-col") : reversed ? "h-[46px] flex-row-reverse" : "h-[46px]",
          " bg-[#1A1A1A] p-[5px] text-white shadow-[0_2px_8px_#00000033,0_4px_16px_#0000001a]",
          "dark:bg-white dark:text-[#1A1A1A] dark:shadow-[0_0_0_1px_rgb(0_0_0/0.06),0_2px_8px_#0000001a,0_4px_16px_#0000000f]",
          collapsed ? "overflow-hidden" : "overflow-visible",
        )}
      >
        <button
          ref={logoRef}
          type="button"
          aria-label={collapsed ? "Expand toolbar" : "Collapse toolbar"}
          aria-expanded={!collapsed}
          onClick={toggleCollapsed}
          className="grid size-9 shrink-0 place-items-center rounded-full outline-none transition-[transform,background-color] duration-150 hover:bg-white/10 active:scale-[0.92] dark:hover:bg-black/[0.05]"
        >
          <LogoMark />
        </button>

        <motion.div
          // remounts when the bar turns between a row and a column, so the newly animated axis grows
          // from 0 instead of from the size the content already has in its new layout
          key={vertical ? "column" : "row"}
          initial={mounted ? { [axis]: 0, opacity: 0 } : false}
          animate={{
            [axis]: collapsed ? 0 : rowW || "auto",
            opacity: collapsed ? 0 : 1,
          }}
          transition={{
            // the collapse spring only runs for collapse / expand (and the remount when the bar turns);
            // when tools come and go inside the row (AgentActions animates its own size) the bar just
            // tracks the measured row
            [axis]: Date.now() - toggledAt.current < 400 ? COLLAPSE : { duration: 0 },
            opacity: { duration: collapsed ? 0.08 : 0.16, delay: collapsed ? 0 : 0.02 },
          }}
          // badges sit just outside their buttons, so the row clips (and they stay hidden) until the
          // bar has finished opening; they go the moment it starts closing
          onAnimationComplete={() => !collapsed && setSettled(true)}
          className={cn("min-h-0 min-w-0", settled ? "overflow-visible" : "overflow-hidden")}
          style={{ willChange: vertical ? "height, opacity" : "width, opacity" }}
        >
          <div
            ref={rowRef}
            inert={collapsed}
            data-settled={settled}
            className={cn(
              "group/row flex items-center gap-1.5",
              vertical ? "h-max flex-col" : "w-max",
              vertical ? (reversed ? "pb-1.5" : "pt-1.5") : reversed ? "pr-1.5" : "pl-1.5",
              collapsed ? "pointer-events-none" : undefined,
            )}
          >
            {!reversed && <Divider />}

            <AgentGroup expanded={mode === "comment" && agentComments.length > 0}>
            <ToolButton
              active={mode === "comment"}
              label="Agent comments"
              shortcut="A"
              icon={<MousePointer2 />}
              accent="#0088FF"
              onClick={() => toggleMode("comment")}
              badge={<CountBadge n={mode === "comment" ? 0 : open.length} color="#0077E6" />}
            />
            <AgentActions show={mode === "comment" && agentComments.length > 0} count={agentComments.length} onDelete={() => (confirming ? setShake((n) => n + 1) : setConfirmDelete(true))} />
            </AgentGroup>
            <ToolButton
              active={mode === "variants"}
              label="Variants"
              shortcut="V"
              icon={<Shapes />}
              accent="#6155F5"
              onClick={() => toggleMode("variants")}
              badge={<CountBadge n={sets.length} color="#5E52ED" />}
            />
            <ToolButton active={mode === "flow"} label="Flow" shortcut="F" icon={<Workflow />} onClick={() => toggleMode("flow")} />

            <Divider />

            <ToolButton
              active={shareOpen}
              label="Share"
              shortcut="S"
              icon={<Share />}
              onClick={() => useTool.getState().setShareOpen(true)}
            />
            <div className="relative">
              <ToolButton
                active={commentsOpen}
                label="Comments from shared links"
                icon={<MessagesSquare />}
                onClick={() => useTool.getState().setCommentsOpen(!commentsOpen)}
                badge={
                  sharedOpen > 0 ? (
                    <CountBadge n={commentsOpen ? 0 : sharedOpen} color="#0077E6" />
                  ) : viewers > 0 ? (
                    <span className="absolute right-1.5 top-1.5 size-1.5 rounded-full bg-emerald-500 opacity-0 outline outline-2 outline-[#1A1A1A] transition-opacity duration-150 group-data-[settled=true]/row:opacity-100 dark:outline-white" />
                  ) : undefined
                }
              />
            </div>

            <Divider />

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  aria-label="More"
                  tabIndex={collapsed ? -1 : undefined}
                  className="grid size-9 place-items-center rounded-full text-white/85 outline-none transition-colors duration-200 hover:bg-white/10 hover:text-white dark:text-[#6f7177] dark:hover:bg-black/[0.05] dark:hover:text-[#1A1A1A] data-[state=open]:bg-white data-[state=open]:text-[#1A1A1A] dark:data-[state=open]:bg-[#1A1A1A] dark:data-[state=open]:text-white"
                >
                  <Ellipsis className="size-[18px]" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                side={side}
                align={reversed ? "start" : "end"}
                sideOffset={12}
                className={cn(
                  "z-[70] w-56 border-white/10 bg-[#16171a] text-white shadow-[0_16px_40px_-12px_rgb(0_0_0/0.55)]",
                  "dark:border-black/[0.06] dark:bg-white dark:text-[#16171a] dark:shadow-[0_12px_32px_-12px_rgb(22_23_26/0.18)]",
                )}
              >
                <DropdownMenuItem className={menuItem} onClick={() => useTool.getState().setPrOpen(!prOpen)}>
                  <GitPullRequestArrow /> Raise PR
                </DropdownMenuItem>
                <DropdownMenuItem className={menuItem} onClick={() => useTool.getState().openPaper(useTool.getState().selection.length ? "selection" : "screen")}>
                  <PenTool /> Send to Paper / Figma
                  <DropdownMenuShortcut className={menuKbd}>P</DropdownMenuShortcut>
                </DropdownMenuItem>
                <DropdownMenuItem className={menuItem} onClick={() => copyComments()}>
                  <Copy /> Copy comments
                  <DropdownMenuShortcut className={menuKbd}>C</DropdownMenuShortcut>
                </DropdownMenuItem>
                <DropdownMenuSeparator className="bg-white/10 dark:bg-black/[0.08]" />
                <DropdownMenuItem className={menuItem} onClick={toggleTheme}>
                  {theme === "light" ? <Moon /> : <Sun />}
                  {theme === "light" ? "Dark chrome" : "Light chrome"}
                </DropdownMenuItem>
                <DropdownMenuItem className={menuItem} onClick={() => useTool.getState().setShortcutsOpen(true)}>
                  <Keyboard /> Keyboard shortcuts
                  <DropdownMenuShortcut className={menuKbd}>?</DropdownMenuShortcut>
                </DropdownMenuItem>
                <DropdownMenuSeparator className="bg-white/10 dark:bg-black/[0.08]" />
                <DropdownMenuItem
                  variant="destructive"
                  className="text-[#ff9592]! focus:bg-[#ff9592]/15! focus:text-[#ff9592]! [&_svg]:text-[#ff9592]! dark:text-[#ce2c31]! dark:focus:bg-[#ce2c31]/10! dark:focus:text-[#ce2c31]! dark:[&_svg]:text-[#ce2c31]!"
                  onClick={() => {
                    useTool.getState().resetDemo()
                  }}
                >
                  <RotateCcw /> Reset demo
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            {reversed && <Divider />}
          </div>
        </motion.div>
      </div>
        </div>
      </motion.div>
    </div>
    </VerticalContext.Provider>
    </SideContext.Provider>
  )
}
