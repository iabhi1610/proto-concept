import type { EditOp } from "../types"
import { findEl, productRoot } from "./dom"

/*
 * Inline text editing. A text change is stored as an op with the non-CSS prop "$text", so it
 * undoes, deletes and travels to the agent like any other edit. Overrides are written into the
 * element's own text node (React keeps its reference), and the original is kept on the element
 * so removing the op restores it.
 */

const ORIG = "data-pc-orig-text"

/** The text node an element's copy lives in: its first non-blank direct text child. */
function textNodeOf(el: HTMLElement): Text | null {
  for (const n of el.childNodes) if (n instanceof Text && n.data.trim()) return n
  return null
}

export function readText(el: HTMLElement) {
  return (textNodeOf(el)?.data ?? el.textContent ?? "").trim()
}

/** Whether the element holds copy of its own (not just text inside its children), so it can be rewritten safely. */
export function hasOwnText(el: HTMLElement) {
  return !!textNodeOf(el)
}

function writeText(el: HTMLElement, text: string) {
  const node = textNodeOf(el)
  if (node) {
    // keep surrounding whitespace so inline spacing next to icons survives
    const lead = node.data.match(/^\s*/)![0]
    const trail = node.data.match(/\s*$/)![0]
    const next = `${lead}${text}${trail}`
    if (node.data !== next) node.data = next
  } else if (el.textContent !== text) el.textContent = text
}

/** Applies every "$text" op to the DOM and restores elements whose override went away. */
export function applyTextOverrides(ops: EditOp[]) {
  const root = productRoot()
  if (!root) return
  const want = new Map<string, string>()
  for (const o of ops) if (o.props.$text !== undefined) want.set(o.elId, o.props.$text)
  for (const el of root.querySelectorAll<HTMLElement>(`[${ORIG}]`)) {
    if (el === editing || el === previewing) continue
    if (!want.has(el.dataset.pcId ?? "")) {
      writeText(el, el.getAttribute(ORIG)!)
      el.removeAttribute(ORIG)
    }
  }
  for (const [id, text] of want) {
    const el = findEl(id)
    if (!el || el === editing || el === previewing) continue
    if (!el.hasAttribute(ORIG)) el.setAttribute(ORIG, readText(el))
    writeText(el, text)
  }
}

/* ───────────────────────── editing session ───────────────────────── */

export let editing: HTMLElement | null = null
let finish: ((commit: boolean) => void) | null = null

/** The element owning the text under a point, if it's editable copy inside the product. */
export function textHostAt(x: number, y: number): HTMLElement | null {
  const root = productRoot()
  const range = document.caretRangeFromPoint?.(x, y)
  const node = range?.startContainer
  if (!root || !(node instanceof Text) || !node.data.trim()) return null
  const host = node.parentElement
  if (!host || !root.contains(host) || host === root || host.closest("svg")) return null
  return host
}

/**
 * Makes `host` editable in place with its text selected. Enter or clicking away commits,
 * Escape cancels. `onCommit` receives the new text only when it changed; `onInput` gets every
 * keystroke and `onEnd` runs once the session closes either way.
 */
export function startTextEdit(
  host: HTMLElement,
  onCommit: (text: string) => void,
  { onInput, onEnd }: { onInput?: (text: string) => void; onEnd?: () => void } = {},
) {
  finish?.(true)
  const before = readText(host)
  const locked = [...host.children].filter((c): c is HTMLElement => c instanceof HTMLElement || c instanceof SVGElement) as HTMLElement[]
  locked.forEach((c) => c.setAttribute("contenteditable", "false"))
  host.setAttribute("contenteditable", "plaintext-only")
  host.setAttribute("data-pc-editing", "")
  host.spellcheck = false
  editing = host
  host.focus({ preventScroll: true })
  const node = textNodeOf(host)
  const sel = window.getSelection()
  const range = document.createRange()
  if (node) {
    const lead = node.data.match(/^\s*/)![0].length
    range.setStart(node, lead)
    range.setEnd(node, node.data.trimEnd().length)
  } else range.selectNodeContents(host)
  sel?.removeAllRanges()
  sel?.addRange(range)

  const onKey = (e: KeyboardEvent) => {
    e.stopPropagation()
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      done(true)
    } else if (e.key === "Escape") {
      e.preventDefault()
      done(false)
    }
  }
  const onBlur = () => done(true)
  const onType = () => onInput?.(readText(host))
  const done = (commit: boolean) => {
    if (editing !== host) return
    host.removeEventListener("keydown", onKey, true)
    host.removeEventListener("blur", onBlur)
    host.removeEventListener("input", onType)
    host.removeAttribute("contenteditable")
    host.removeAttribute("data-pc-editing")
    locked.forEach((c) => c.removeAttribute("contenteditable"))
    window.getSelection()?.removeAllRanges()
    const after = readText(host)
    editing = null
    finish = null
    if (commit && after && after !== before) {
      if (!host.hasAttribute(ORIG)) host.setAttribute(ORIG, before)
      onCommit(after)
    } else writeText(host, before)
    onEnd?.()
  }
  host.addEventListener("keydown", onKey, true)
  host.addEventListener("blur", onBlur)
  host.addEventListener("input", onType)
  finish = done
}

/* ───────────────────────── Properties text field ───────────────────────── */

/** Element whose copy the Properties field is rewriting live; overrides leave it alone until it commits. */
let previewing: HTMLElement | null = null

/** Writes copy straight into the page while the field is being typed in (outside history until committed). */
export function previewText(el: HTMLElement, text: string) {
  if (!el.hasAttribute(ORIG)) el.setAttribute(ORIG, readText(el))
  previewing = el
  writeText(el, text)
}

/** Closes a field session: puts `restore` back (cancel / no change) and hands the element back to the overrides. */
export function endPreview(el: HTMLElement, restore?: string) {
  if (restore !== undefined) writeText(el, restore)
  if (previewing === el) previewing = null
}

/** Ends an in-progress edit (e.g. when the user clicks elsewhere). */
export function endTextEdit(commit = true) {
  finish?.(commit)
}
