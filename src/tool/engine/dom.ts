import { FrameDef, TextDef, getComponentDef, type ComponentDef } from "@/product/system/define"

export const PRODUCT_ROOT_ID = "orbit-main"

export const productRoot = () => document.getElementById(PRODUCT_ROOT_ID)

/* ───────────────────────── auto ids ─────────────────────────
 * Like Agentation, any DOM node can be targeted. Nodes the product didn't tag get a stable
 * auto id: "<nearest declared id or root>~<child index path>", e.g. "overview.kpi.users~1.0".
 * The id is written onto the node so the injected stylesheet and pins can find it, and is
 * re-derived from the path if React remounts the node.
 */
const AUTO = "~"
export const isAutoId = (id: string | undefined) => !!id && id.includes(AUTO)

function declaredAncestor(el: HTMLElement, root: HTMLElement): HTMLElement {
  for (let p = el.parentElement; p && p !== root; p = p.parentElement) if (p.dataset.pcId && !p.hasAttribute("data-pc-auto")) return p
  return root
}

function autoIdFor(el: HTMLElement, root: HTMLElement) {
  const anchor = declaredAncestor(el, root)
  const path: number[] = []
  for (let n: Element = el; n !== anchor; n = n.parentElement!) path.unshift([...n.parentElement!.children].indexOf(n))
  return `${anchor === root ? "root" : anchor.dataset.pcId}${AUTO}${path.join(".")}`
}

const TEXT_TAGS = new Set(["span", "p", "h1", "h2", "h3", "h4", "h5", "h6", "label", "kbd", "a", "strong", "b", "em", "small", "td", "th", "mark"])

/** Tags an untagged node in place (idempotent) and returns its id. */
export function ensureId(el: HTMLElement): string {
  if (el.dataset.pcId) return el.dataset.pcId
  const root = productRoot()
  if (!root) return ""
  const id = autoIdFor(el, root)
  const tag = el.tagName.toLowerCase()
  const isSvg = el instanceof SVGElement
  const textOnly = !isSvg && [...el.children].every((c) => c instanceof HTMLBRElement) && !!el.textContent?.trim()
  el.setAttribute("data-pc-id", id)
  el.setAttribute("data-pc-auto", "")
  el.setAttribute("data-pc-component", textOnly || TEXT_TAGS.has(tag) ? "Text" : "Frame")
  if (isSvg) el.setAttribute("data-pc-label", tag === "svg" && el.closest(".recharts-wrapper") ? "Chart canvas" : "Icon")
  else if (tag === "img") el.setAttribute("data-pc-label", "Image")
  return id
}

function resolveAuto(id: string): HTMLElement | null {
  const root = productRoot()
  if (!root) return null
  const [anchorId, path] = id.split(AUTO)
  let n: Element | null = anchorId === "root" ? root : root.querySelector(`[data-pc-id="${CSS.escape(anchorId)}"]`)
  for (const i of path.split(".").map(Number)) {
    n = n?.children[i] ?? null
    if (!n) return null
  }
  if (!(n instanceof HTMLElement || n instanceof SVGElement)) return null
  const el = n as HTMLElement
  if (!el.dataset.pcId) ensureId(el)
  return el.dataset.pcId === id ? el : null
}

export function findEl(id: string): HTMLElement | null {
  const hit = productRoot()?.querySelector<HTMLElement>(`[data-pc-id="${CSS.escape(id)}"]`)
  if (hit) return hit
  return isAutoId(id) ? resolveAuto(id) : null
}

/** Small interactive components are picked whole; containers (cards, rows, frames) can be drilled into. */
const ATOMIC_KINDS = new Set(["button", "input", "toggle", "nav", "badge"])

/**
 * The element a pointer targets, Agentation-style: the deepest node under the cursor
 * (SVG internals collapse to their <svg>; buttons, inputs, nav items stay whole).
 */
export function inspectableFrom(target: EventTarget | null): HTMLElement | null {
  if (!(target instanceof Element)) return null
  const root = productRoot()
  if (!root || !root.contains(target) || target === root) return null
  let el: Element = target
  if (el instanceof SVGElement && !(el instanceof SVGSVGElement)) el = el.ownerSVGElement ?? el
  // recharts nests its svg in wrappers; treat the chart surface as one target
  const atomic = [...ancestors(el, root)].find((a) => {
    const def = getComponentDef(a.dataset.pcComponent)
    return a.dataset.pcId && !a.hasAttribute("data-pc-auto") && def && ATOMIC_KINDS.has(def.kind)
  })
  const pick = (atomic ?? el) as HTMLElement
  if (pick === root || pick.parentElement === root) return null
  ensureId(pick)
  return pick
}

function* ancestors(el: Element, root: HTMLElement) {
  for (let n: Element | null = el; n && n !== root; n = n.parentElement) yield n as HTMLElement
}

/** Parent target for "select parent" (skips wrappers with the same box). */
export function parentTarget(el: HTMLElement): HTMLElement | null {
  const root = productRoot()
  if (!root) return null
  const r = el.getBoundingClientRect()
  for (let p = el.parentElement; p && p !== root && p.parentElement !== root; p = p.parentElement) {
    const pr = p.getBoundingClientRect()
    if (Math.abs(pr.width - r.width) > 1 || Math.abs(pr.height - r.height) > 1 || p.dataset.pcId) {
      ensureId(p)
      return p
    }
  }
  return null
}

/** First meaningful child for keyboard "↓" traversal (skips same-box wrappers; atomic components have none). */
export function childTarget(el: HTMLElement): HTMLElement | null {
  const def = getComponentDef(el.dataset.pcComponent)
  if (!el.hasAttribute("data-pc-auto") && def && ATOMIC_KINDS.has(def.kind)) return null
  if (el instanceof SVGElement) return null
  const r = el.getBoundingClientRect()
  let n: HTMLElement = el
  for (;;) {
    const kids = [...n.children].filter((c): c is HTMLElement => {
      if (!(c instanceof HTMLElement || c instanceof SVGSVGElement)) return false
      const b = c.getBoundingClientRect()
      return b.width > 0 && b.height > 0
    })
    const first = kids[0]
    if (!first) return null
    const b = first.getBoundingClientRect()
    const sameBox = Math.abs(b.width - r.width) <= 1 && Math.abs(b.height - r.height) <= 1 && !first.dataset.pcId
    if (sameBox && kids.length === 1 && !(first instanceof SVGElement)) {
      n = first
      continue
    }
    ensureId(first)
    return first
  }
}

export interface ElInfo {
  id: string
  name: string
  /** the element's own text/label, unadorned */
  label: string
  component: string
  def: ComponentDef
  kind: ComponentDef["kind"]
  tag: string
}

export function elInfo(el: HTMLElement): ElInfo {
  const id = el.dataset.pcId ?? ""
  const component = el.dataset.pcComponent ?? (el.children.length === 0 ? "Text" : "Frame")
  const def = getComponentDef(component) ?? (component === "Text" ? TextDef : FrameDef)
  const label = el.dataset.pcLabel || textLabel(el)
  const tag = el.tagName.toLowerCase()
  const kindName = el.hasAttribute("data-pc-auto") && def.name === "Frame" ? `<${tag}>` : def.name
  return {
    id,
    component: def.name,
    def,
    kind: def.kind,
    tag,
    label,
    name: label ? `${kindName} “${label}”` : kindName,
  }
}

export function infoById(id: string): ElInfo | null {
  const el = findEl(id)
  return el ? elInfo(el) : null
}

function textLabel(el: HTMLElement) {
  const t = ((el as HTMLElement).innerText || el.getAttribute("aria-label") || "").trim().split("\n")[0]
  return t.length > 28 ? `${t.slice(0, 26)}…` : t
}

function cssStep(el: Element) {
  const tag = el.tagName.toLowerCase()
  const cls = [...el.classList].filter((c) => /^[a-z][\w-]*$/.test(c) && c.length < 18).slice(0, 2)
  const same = el.parentElement ? [...el.parentElement.children].filter((c) => c.tagName === el.tagName) : []
  const nth = same.length > 1 ? `:nth-of-type(${same.indexOf(el) + 1})` : ""
  return `${tag}${cls.length ? "." + cls.join(".") : ""}${nth}`
}

/** A CSS selector an agent can grep for, plus a readable path. */
export function selectorFor(el: HTMLElement) {
  const id = el.dataset.pcId ?? ""
  if (el.hasAttribute("data-pc-auto")) {
    const root = productRoot()!
    const anchor = declaredAncestor(el, root)
    const steps: string[] = []
    for (let n: Element = el; n !== anchor && n.parentElement; n = n.parentElement) steps.unshift(cssStep(n))
    const base = anchor === root ? "#orbit-main" : `[data-pc-id="${anchor.dataset.pcId}"]`
    return { attr: `${base} > ${steps.join(" > ")}`, css: cssStep(el) }
  }
  return { attr: `[data-pc-id="${id}"]`, css: cssStep(el) }
}

/**
 * Reads computed styles for an element as if it were in `state`, without visible flicker:
 * transitions are suspended, the state attribute is swapped, read, and restored.
 */
export function readSnapshot(el: HTMLElement, state: string): Record<string, string> {
  const prevState = el.getAttribute("data-pc-state")
  const swap = prevState !== null && prevState !== state
  const prevTransition = el.style.transition
  if (swap) {
    el.style.transition = "none"
    el.setAttribute("data-pc-state", state)
  }
  const cs = getComputedStyle(el)
  const snapshot: Record<string, string> = {}
  for (const p of READ_PROPS) snapshot[p] = cs.getPropertyValue(p)
  if (swap) {
    el.setAttribute("data-pc-state", prevState!)
    void el.offsetWidth
    el.style.transition = prevTransition
  }
  return snapshot
}

export const READ_PROPS = [
  "color",
  "background-color",
  "border-top-color",
  "border-top-width",
  "border-top-style",
  "border-top-left-radius",
  "opacity",
  "font-size",
  "font-weight",
  "font-family",
  "line-height",
  "letter-spacing",
  "text-align",
  "text-transform",
  "text-decoration-line",
  "padding-top",
  "padding-right",
  "padding-bottom",
  "padding-left",
  "gap",
  "row-gap",
  "column-gap",
  "width",
  "height",
  "box-shadow",
  "display",
  "flex-direction",
  "align-items",
  "justify-content",
  "font-style",
  "flex-wrap",
  "overflow",
  "mix-blend-mode",
  "visibility",
  "grid-template-columns",
  "grid-template-rows",
  "grid-auto-flow",
  "justify-items",
  "position",
  "top",
  "left",
  "rotate",
]

export const px = (v: string | undefined) => {
  const n = parseFloat(v ?? "")
  return Number.isFinite(n) ? n : 0
}
