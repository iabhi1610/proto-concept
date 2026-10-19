import * as React from "react"
import { AnimatePresence, motion } from "motion/react"
import { Check, Loader2, Pencil, Sparkles } from "@/lib/icons"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import { letterFor } from "../actions"
import { SHARED_TEAL, initialsOf, useTool } from "../store"
import type { Comment } from "../types"
import { DashedOutline } from "./DashedOutline"
import { useLiveBoxes } from "./geometry"

const spring = { type: "spring", stiffness: 520, damping: 28 } as const

/* ───────────────────────── numbered comment pins ───────────────────────── */

export function CommentPins() {
  const mode = useTool((s) => s.mode)
  const screen = useTool((s) => s.screen)
  const comments = useTool((s) => s.comments)
  const activeId = useTool((s) => s.activeCommentId)
  const openComment = useTool((s) => s.openComment)
  const visible = React.useMemo(
    () => (mode === "comment" ? comments.filter((c) => c.screen === screen && c.source !== "viewer") : []),
    [mode, comments, screen],
  )
  const ids = React.useMemo(() => [...new Set(visible.flatMap((c) => c.elIds))], [visible])
  const boxes = useLiveBoxes(ids)

  // stack pins that land on the same element so they don't overlap
  const stackIndex = new Map<string, number>()

  return (
    <AnimatePresence>
      {visible.flatMap((c) =>
        c.elIds.map((elId, i) => {
          const b = boxes[elId]
          if (!b) return null
          const n = stackIndex.get(elId) ?? 0
          stackIndex.set(elId, n + 1)
          // small targets get a corner pin so the number never hides their label
          const useAnchor = i === 0 && c.anchor && b.h >= 56 && b.w >= 140
          const ax = useAnchor ? c.anchor!.x : 1
          const ay = useAnchor ? c.anchor!.y : 0
          const x = b.x + Math.min(Math.max(ax, 0), 1) * b.w + n * 18
          const y = b.y + Math.min(Math.max(ay, 0), 1) * b.h
          return <Pin key={`${c.id}:${elId}`} comment={c} x={x} y={y} active={activeId === c.id} secondary={i > 0} onClick={() => openComment(c.id)} />
        }),
      )}
    </AnimatePresence>
  )
}

function Pin({ comment, x, y, active, secondary, onClick }: { comment: Comment; x: number; y: number; active: boolean; secondary: boolean; onClick: () => void }) {
  const resolved = comment.status === "resolved"
  const viewer = comment.source === "viewer"
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <motion.button
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: active ? 1.12 : 1, opacity: 1 }}
          exit={{ scale: 0, opacity: 0 }}
          transition={spring}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation()
            onClick()
          }}
          data-pc-tool
          className={cn(
            "group/pin fixed z-[44] grid h-[22px] min-w-[22px] -translate-x-1/2 -translate-y-1/2 cursor-pointer place-items-center before:absolute before:-inset-2.5 before:rounded-full before:content-['']  rounded-full rounded-bl-[4px] px-1 font-sans text-[11px] font-semibold tabular-nums text-white",
            "shadow-[0_0_0_2px_white,0_2px_8px_rgb(0_0_0/0.25)] transition-[filter] hover:brightness-110",
            resolved && "bg-neutral-400",
            !resolved && (viewer ? "bg-white !text-[var(--pc-comment)] shadow-[0_0_0_2px_var(--pc-comment),0_2px_8px_rgb(0_0_0/0.2)]" : "bg-[var(--pc-comment)]"),
            secondary && "opacity-80",
            active && "shadow-[0_0_0_2px_white,0_0_0_5px_color-mix(in_oklab,var(--pc-comment),transparent_60%),0_2px_8px_rgb(0_0_0/0.25)]",
          )}
          style={{ left: x, top: y }}
        >
          <span className="[grid-area:1/1] transition-[opacity,scale] duration-150 group-hover/pin:scale-50 group-hover/pin:opacity-0">
            {resolved ? <Check className="size-3" strokeWidth={3} /> : comment.kind === "variant" ? <span className="flex items-center gap-0.5"><Sparkles className="size-2.5" />{comment.number}</span> : comment.number}
          </span>
          <Pencil className="[grid-area:1/1] size-3 scale-50 opacity-0 transition-[opacity,scale] duration-150 group-hover/pin:scale-100 group-hover/pin:opacity-100" />
        </motion.button>
      </TooltipTrigger>
      <TooltipContent side="top" sideOffset={10} className="max-w-[260px] flex-col items-start gap-0.5 py-2">
        <span className="text-[10.5px] font-medium opacity-60">
          #{comment.number} · {comment.author}
          {comment.applied.length ? ` · ${comment.applied.length} change${comment.applied.length > 1 ? "s" : ""} applied` : ""}
        </span>
        <span className="line-clamp-3 text-[12px] leading-snug">{comment.text}</span>
      </TooltipContent>
    </Tooltip>
  )
}

/* ───────────────────────── shared-link comment pins ───────────────────────── */

/** While Comments is open: each viewer's comment as a teal pin with their initials, linked to its card. */
export function SharedPins() {
  const open = useTool((s) => s.commentsOpen && s.mode !== "flow")
  const screen = useTool((s) => s.screen)
  const comments = useTool((s) => s.comments)
  const focusId = useTool((s) => s.sharedFocusId)
  const visible = React.useMemo(
    () => (open ? comments.filter((c) => c.source === "viewer" && c.screen === screen && c.elIds[0]) : []),
    [open, comments, screen],
  )
  const boxes = useLiveBoxes(React.useMemo(() => visible.map((c) => c.elIds[0]), [visible]))

  return (
    <AnimatePresence>
      {visible.map((c) => {
        const b = boxes[c.elIds[0]]
        if (!b) return null
        const ax = Math.min(Math.max(c.anchor?.x ?? 1, 0), 1)
        const ay = Math.min(Math.max(c.anchor?.y ?? 0, 0), 1)
        const resolved = c.status === "resolved"
        const active = focusId === c.id
        return (
          <Tooltip key={c.id}>
            <TooltipTrigger asChild>
              <motion.button
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: active ? 1.12 : 1, opacity: 1 }}
                exit={{ scale: 0, opacity: 0 }}
                transition={spring}
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation()
                  useTool.getState().setSharedFocus(c.id)
                }}
                data-pc-tool
                aria-label={`Comment from ${c.author}`}
                className={cn(
                  "fixed z-[44] grid size-6 -translate-x-1/2 -translate-y-1/2 cursor-pointer place-items-center rounded-full rounded-bl-[5px] font-sans text-[9.5px] font-semibold tracking-[0.02em] text-white before:absolute before:-inset-2.5 before:rounded-full before:content-['']",
                  "shadow-[0_0_0_2px_white,0_2px_8px_rgb(0_0_0/0.25)] transition-[filter] hover:brightness-110",
                  resolved && "opacity-50",
                  active && "shadow-[0_0_0_2px_white,0_0_0_5px_rgb(13_148_136/0.35),0_2px_8px_rgb(0_0_0/0.25)]",
                )}
                style={{ left: b.x + ax * b.w, top: b.y + ay * b.h, background: SHARED_TEAL }}
              >
                {initialsOf(c.author)}
              </motion.button>
            </TooltipTrigger>
            <TooltipContent side="top" sideOffset={10} className="max-w-[260px] flex-col items-start gap-0.5 py-2">
              <span className="text-[10.5px] font-medium opacity-60">{c.author}</span>
              <span className="line-clamp-3 text-[12px] leading-snug">{c.text}</span>
            </TooltipContent>
          </Tooltip>
        )
      })}
    </AnimatePresence>
  )
}

/* ───────────────────────── lettered variant pins ───────────────────────── */

export function VariantPins() {
  const mode = useTool((s) => s.mode)
  const screen = useTool((s) => s.screen)
  const sets = useTool((s) => s.variantSets)
  const activeSetId = useTool((s) => s.activeSetId)
  const hoverId = useTool((s) => s.hoverId)
  const openSet = useTool((s) => s.openSet)
  const visible = React.useMemo(() => (mode === "variants" ? sets.filter((v) => v.screen === screen) : []), [mode, sets, screen])
  const boxes = useLiveBoxes(visible.map((v) => v.elId))

  return (
    <>
      {visible.map((set) => {
        const b = boxes[set.elId]
        if (!b) return null
        const active = activeSetId === set.id
        const hovered = hoverId === set.elId
        return (
          <div
            key={`frame-${set.id}`}
            className="pointer-events-none fixed z-[39] rounded-[6px] transition-[background,outline-color] duration-150"
            style={{
              left: b.x - 3,
              top: b.y - 3,
              width: b.w + 6,
              height: b.h + 6,
              background: `color-mix(in oklab, var(--pc-variant), transparent ${active ? 92 : hovered ? 93 : 96}%)`,
            }}
          >
            <DashedOutline color="var(--pc-variant)" width={active ? 2 : 1.5} radius={6} solid={active || hovered} />
          </div>
        )
      })}
      <AnimatePresence>
        {visible.map((set) => {
          const b = boxes[set.elId]
          if (!b) return null
          const letter = letterFor(set.id, sets)
          const chosen = set.options.find((o) => o.id === set.selected)
          const active = activeSetId === set.id
          return (
            <motion.button
              key={set.id}
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: active ? 1.1 : 1, opacity: 1 }}
              exit={{ scale: 0, opacity: 0 }}
              transition={spring}
              data-pc-tool
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation()
                openSet(set.id)
              }}
              className="fixed z-[44] flex h-[22px] min-w-[22px] cursor-pointer items-center justify-center gap-1 rounded-[6px] bg-[var(--pc-variant)] px-1.5 font-sans text-[11.5px] font-semibold tabular-nums text-white shadow-[0_0_0_2px_white] transition-[filter] before:absolute before:-inset-2.5 before:rounded-[10px] before:content-[''] hover:brightness-110"
              style={{ left: b.x - 10, top: b.y - 11 }}
            >
              {letter}
              {chosen ? set.options.indexOf(chosen) + 1 : null}
              {set.generating && <Loader2 className="size-3 animate-spin" />}
            </motion.button>
          )
        })}
      </AnimatePresence>
    </>
  )
}
