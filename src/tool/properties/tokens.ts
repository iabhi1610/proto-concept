import { productRoot } from "../engine/dom"

export type TokenKind = "color" | "space" | "radius" | "fontSize" | "shadow" | "weight"

export interface Token {
  name: string
  /** what gets written into CSS */
  value: string
  /** resolved value for display / matching */
  resolved: string
  kind: TokenKind
}

const COLOR_TOKENS = [
  "foreground",
  "muted-foreground",
  "subtle",
  "background",
  "surface",
  "muted",
  "secondary",
  "border",
  "input",
  "primary",
  "primary-foreground",
  "brand",
  "brand-soft",
  "success",
  "success-soft",
  "danger",
  "danger-soft",
  "warning",
]
const SPACE = ["space-1", "space-2", "space-3", "space-4", "space-5", "space-6", "space-8", "space-10"]
const RADIUS = ["radius-xs", "radius-s", "radius-m", "radius-l", "radius-full"]
const FONT = ["text-caption", "text-small", "text-body", "text-ui", "text-title", "text-heading", "text-display"]
const SHADOW = ["shadow-xs", "shadow-s", "shadow-m", "shadow-l"]

let cache: Token[] | null = null

/** Reads the product's design tokens from its CSS (resolved through a probe so colors compare equal). */
export function productTokens(): Token[] {
  if (cache) return cache
  const root = productRoot()
  if (!root) return []
  const cs = getComputedStyle(root)
  const probe = document.createElement("span")
  probe.style.position = "absolute"
  probe.style.visibility = "hidden"
  root.appendChild(probe)
  const color = (name: string) => {
    probe.style.color = `var(--${name})`
    return getComputedStyle(probe).color
  }
  const raw = (n: string) => cs.getPropertyValue(`--${n}`).trim()
  const out: Token[] = [
    ...COLOR_TOKENS.map((n) => ({ name: n, value: `var(--${n})`, resolved: color(n), kind: "color" as const })),
    ...SPACE.map((n) => ({ name: n, value: `var(--${n})`, resolved: raw(n), kind: "space" as const })),
    ...RADIUS.map((n) => ({ name: n, value: `var(--${n})`, resolved: raw(n), kind: "radius" as const })),
    ...FONT.map((n) => ({ name: n, value: `var(--${n})`, resolved: raw(n), kind: "fontSize" as const })),
    ...SHADOW.map((n) => ({ name: n, value: `var(--${n})`, resolved: raw(n), kind: "shadow" as const })),
    ...[
      ["light", "300"],
      ["regular", "400"],
      ["medium", "500"],
      ["semibold", "600"],
      ["bold", "700"],
    ].map(([n, v]) => ({ name: n, value: v, resolved: v, kind: "weight" as const })),
  ]
  probe.remove()
  cache = out
  return out
}

export const tokensOf = (kind: TokenKind) => productTokens().filter((t) => t.kind === kind)

/** Finds the token whose resolved value equals a computed value (e.g. "rgb(232, 232, 229)" → border). */
export function matchToken(kind: TokenKind, computed: string): Token | undefined {
  const v = computed.trim()
  return tokensOf(kind).find((t) => t.resolved === v || (kind !== "color" && parseFloat(t.resolved) === parseFloat(v) && /px$/.test(t.resolved)))
}

let ctx: CanvasRenderingContext2D | null = null

/** Any CSS color (rgb, oklab, color-mix…) → "#rrggbb" (+ alpha %), via a 1px canvas. */
export function toHex(c: string) {
  if (!c || c === "transparent") return "transparent"
  ctx ??= Object.assign(document.createElement("canvas"), { width: 1, height: 1 }).getContext("2d", { willReadFrequently: true })
  if (!ctx) return c
  ctx.clearRect(0, 0, 1, 1)
  ctx.fillStyle = "#000"
  ctx.fillStyle = c
  ctx.fillRect(0, 0, 1, 1)
  const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data
  if (a === 0) return "transparent"
  const hex = `#${[r, g, b].map((x) => x.toString(16).padStart(2, "0")).join("")}`
  return a < 255 ? `${hex} ${Math.round((a / 255) * 100)}%` : hex
}
