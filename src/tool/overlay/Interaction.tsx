import * as React from "react"
import { findEl, inspectableFrom, productRoot } from "../engine/dom"
import { editing, endTextEdit, startTextEdit, textHostAt } from "../engine/textEdit"
import { applyText } from "../actions"
import { useTool } from "../store"
import type { Box } from "./geometry"

/** Resolves the element a pointer event targets: the deepest inspectable node, in comment and variants mode alike. */
export function targetFor(target: EventTarget | null): HTMLElement | null {
  const root = productRoot()
  if (!root || !(target instanceof Element) || !root.contains(target)) return null
  return inspectableFrom(target)
}

/** Picks elements fully inside a marquee: components first, outermost only. */
function marqueePick(box: Box): string[] {
  const root = productRoot()
  if (!root) return []
  const all = [...root.querySelectorAll<HTMLElement>("[data-pc-id]")]
  const coverage = (el: HTMLElement) => {
    const r = el.getBoundingClientRect()
    if (!r.width || !r.height) return 0
    const w = Math.max(0, Math.min(r.right, box.x + box.w) - Math.max(r.left, box.x))
    const h = Math.max(0, Math.min(r.bottom, box.y + box.h) - Math.max(r.top, box.y))
    return (w * h) / (r.width * r.height)
  }
  let inside = all.filter((el) => coverage(el) > 0.98)
  // nothing fully enclosed (e.g. a card running off-screen): accept mostly-covered elements
  if (!inside.length) inside = all.filter((el) => coverage(el) > 0.6 && !["shell.sidebar", "shell.topbar"].includes(el.dataset.pcId ?? ""))
  const components = inside.filter((el) => !["Frame", "Text"].includes(el.dataset.pcComponent ?? ""))
  const pool = components.length ? components : inside
  const outer = pool.filter((el) => !pool.some((o) => o !== el && o.contains(el)))
  return outer.map((el) => el.dataset.pcId!).slice(0, 12)
}

/**
 * Agentation-style capture layer: while a tool mode is active, the product never sees
 * pointer/click events. Hover → highlight, click → select, shift-click → group, drag → marquee.
 */
export function Interaction({ onMarquee }: { onMarquee: (b: Box | null) => void }) {
  const mode = useTool((s) => s.mode)

  React.useEffect(() => {
    const st = useTool.getState
    if (mode !== "comment" && mode !== "variants") {
      st().setHover(null)
      return
    }
    let start: { x: number; y: number; shift: boolean; ctrl: boolean; target: EventTarget | null } | null = null
    let dragging = false
    const inProduct = (e: Event) => !!productRoot()?.contains(e.target as Node)

    // while text is being edited in place, the product gets its pointer events back
    const inEdit = (e: Event) => !!editing && editing.contains(e.target as Node)

    const move = (e: PointerEvent) => {
      if (inEdit(e)) return
      if (start) {
        if (!dragging && Math.hypot(e.clientX - start.x, e.clientY - start.y) > 6 && mode === "comment") dragging = true
        if (dragging) {
          onMarquee({
            x: Math.min(start.x, e.clientX),
            y: Math.min(start.y, e.clientY),
            w: Math.abs(e.clientX - start.x),
            h: Math.abs(e.clientY - start.y),
          })
          st().setHover(null)
        }
        return
      }
      if (!inProduct(e)) return st().setHover(null)
      st().setHover(targetFor(e.target)?.dataset.pcId ?? null)
    }

    const down = (e: PointerEvent) => {
      if (inEdit(e)) return
      if (editing) endTextEdit(true)
      if (!inProduct(e) || e.button !== 0) return
      e.preventDefault()
      e.stopPropagation()
      start = { x: e.clientX, y: e.clientY, shift: e.shiftKey || e.metaKey, ctrl: e.ctrlKey, target: e.target }
      dragging = false
    }

    const up = (e: PointerEvent) => {
      if (inEdit(e) || !start) return
      e.preventDefault()
      e.stopPropagation()
      const s = st()
      if (dragging) {
        const box = { x: Math.min(start.x, e.clientX), y: Math.min(start.y, e.clientY), w: Math.abs(e.clientX - start.x), h: Math.abs(e.clientY - start.y) }
        const ids = marqueePick(box)
        if (ids.length) s.select(start.shift ? [...new Set([...s.selection, ...ids])] : ids, null)
        onMarquee(null)
      } else {
        const el = targetFor(start.target)
        if (mode === "variants") {
          if (!el) {
            s.clearSelection()
            s.openSet(null)
          } else {
            // any element can be picked; if it is (or sits inside) a variant set, show that set too
            const id = el.dataset.pcId!
            s.select([id], null)
            const set = s.variantSets.find((v) => v.screen === s.screen && (v.elId === id || findEl(v.elId)?.contains(el)))
            s.openSet(set?.id ?? null)
          }
        } else if (!el) {
          s.clearSelection()
        } else {
          const id = el.dataset.pcId!
          const r = el.getBoundingClientRect()
          const anchor = { x: (start.x - r.left) / r.width, y: (start.y - r.top) / r.height }
          if (start.shift && s.selection.length) {
            const next = s.selection.includes(id) ? s.selection.filter((x) => x !== id) : [...s.selection, id]
            s.select(next, s.anchor)
          } else {
            // clicking a commented element's pin area reopens nothing; a plain click starts a fresh prompt
            useTool.setState({ activeCommentId: null })
            s.select([id], anchor)
            // Control-click opens straight into Properties
            s.setTab(start.ctrl ? "properties" : "prompt")
          }
        }
      }
      start = null
      dragging = false
    }

    const dblclick = (e: MouseEvent) => {
      if (!inProduct(e) || inEdit(e)) return
      e.preventDefault()
      e.stopPropagation()
      if (mode !== "comment") return
      const host = textHostAt(e.clientX, e.clientY)
      if (!host) return
      // the popover steps aside while typing; the edit lands as its own pinned change
      useTool.getState().clearSelection()
      useTool.getState().setHover(null)
      startTextEdit(host, (text) => applyText(host, text))
    }

    const swallow = (e: Event) => {
      if (inEdit(e)) return
      if (inProduct(e)) {
        e.preventDefault()
        e.stopPropagation()
      }
    }

    document.addEventListener("pointermove", move, true)
    document.addEventListener("pointerdown", down, true)
    document.addEventListener("pointerup", up, true)
    document.addEventListener("click", swallow, true)
    document.addEventListener("dblclick", dblclick, true)
    document.addEventListener("contextmenu", swallow, true)
    return () => {
      document.removeEventListener("pointermove", move, true)
      document.removeEventListener("pointerdown", down, true)
      document.removeEventListener("pointerup", up, true)
      document.removeEventListener("click", swallow, true)
      document.removeEventListener("dblclick", dblclick, true)
      endTextEdit(true)
      document.removeEventListener("contextmenu", swallow, true)
      onMarquee(null)
    }
  }, [mode, onMarquee])

  return null
}
