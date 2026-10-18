/**
 * Plain-language → CSS. A deliberately local, rule-based "agent" for the demo:
 * splits a prompt into clauses, carries the subject across clauses ("make the border 2px and darker"),
 * and turns each clause into change specs that are resolved per element/state against computed styles.
 */
import type { ComponentDef } from "@/product/system/define"
import type { AppliedChange, CssProps } from "../types"
import { toHex } from "../properties/tokens"
import { px } from "./dom"

export type Flag = "contrast-up" | "contrast-down" | "hide" | "remove-ring" | "prominence-up" | "prominence-down"

export interface ChangeSpec {
  resolve: (cs: Record<string, string>) => Record<string, string | undefined>
  flags?: Flag[]
}

export interface Parsed {
  specs: ChangeSpec[]
  unparsed: string[]
}

type Subject = "border" | "bg" | "text" | "radius" | "opacity" | "padding" | "gap" | "shadow" | "width" | "height" | "size" | "weight" | "tracking" | "leading" | "ring" | null

const COLORS: Record<string, string> = {
  red: "#ef4444",
  orange: "#f97316",
  amber: "#f59e0b",
  yellow: "#eab308",
  lime: "#84cc16",
  green: "#22c55e",
  emerald: "#10b981",
  teal: "#14b8a6",
  cyan: "#06b6d4",
  sky: "#0ea5e9",
  blue: "#3b82f6",
  indigo: "#6366f1",
  violet: "#8b5cf6",
  purple: "#a855f7",
  pink: "#ec4899",
  rose: "#f43f5e",
  gray: "#6b7280",
  grey: "#6b7280",
  slate: "#64748b",
  black: "#000000",
  white: "#ffffff",
  brand: "var(--brand)",
  primary: "var(--primary)",
  muted: "var(--muted)",
  danger: "var(--danger)",
  success: "var(--success)",
  transparent: "transparent",
}

const COLOR_WORDS = Object.keys(COLORS).join("|")
const COLOR_RE = new RegExp(
  `(#[0-9a-f]{3,8}\\b|var\\(--[\\w-]+\\)|--[\\w-]+|rgba?\\([^)]*\\)|(?:(light|dark|pale|deep)\\s+)?\\b(${COLOR_WORDS})\\b)`,
  "i",
)

function parseColor(s: string): string | null {
  const m = s.match(COLOR_RE)
  if (!m) return null
  const raw = m[1].toLowerCase()
  if (raw.startsWith("#") || raw.startsWith("rgb") || raw.startsWith("var(")) return raw
  if (raw.startsWith("--")) return `var(${raw})`
  const base = COLORS[m[3].toLowerCase()]
  const mod = m[2]?.toLowerCase()
  if (mod === "light" || mod === "pale") return `color-mix(in oklab, ${base}, white 55%)`
  if (mod === "dark" || mod === "deep") return `color-mix(in oklab, ${base}, black 35%)`
  return base
}

const NUM_RE = /(-?\d+(?:\.\d+)?)\s*(px|%|em|rem|pt|deg)?/i
function parseNum(s: string): { n: number; unit: string } | null {
  const m = s.match(NUM_RE)
  return m ? { n: parseFloat(m[1]), unit: (m[2] ?? "").toLowerCase() } : null
}
const len = (v: { n: number; unit: string }) => (v.unit === "rem" || v.unit === "em" || v.unit === "%" ? `${v.n}${v.unit}` : `${v.n}px`)

const darken = (c: string, amt = 30) => `color-mix(in oklab, ${c}, black ${amt}%)`
const lighten = (c: string, amt = 45) => `color-mix(in oklab, ${c}, white ${amt}%)`
function isDark(c: string) {
  const hex = toHex(c)
  if (!hex.startsWith("#")) return false
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
  return 0.2126 * r + 0.7152 * g + 0.0722 * b < 0.45
}
const isTransparent = (c: string) => !c || c === "transparent" || /rgba\(.*,\s*0\)$/.test(c) || /\/ 0\)$/.test(c)

const SUBJECTS: [RegExp, Subject][] = [
  [/\b(focus ring|ring|outline)\b/i, "ring"],
  [/\b(border|stroke|outline|edge)s?\b/i, "border"],
  [/\b(background|bg|fill|surface)\b/i, "bg"],
  [/\b(corner|corners|radius|rounded(ness)?|roundness)\b/i, "radius"],
  [/\b(opacity|transparen(t|cy)|alpha)\b/i, "opacity"],
  [/\b(padding|inner spacing|breathing room)\b/i, "padding"],
  [/\b(gap|spacing between|space between)\b/i, "gap"],
  [/\b(shadow|elevation|drop shadow)\b/i, "shadow"],
  [/\b(width|wide|wider|narrower)\b/i, "width"],
  [/\b(height|tall|taller|shorter)\b/i, "height"],
  [/\b(font weight|weight)\b/i, "weight"],
  [/\b(letter[- ]spacing|tracking|kerning)\b/i, "tracking"],
  [/\b(line[- ]height|leading)\b/i, "leading"],
  [/\b(font size|text size|type size)\b/i, "size"],
  [/\b(text|font|label|copy|title|heading|color|colour|type)\b/i, "text"],
]

function subjectOf(clause: string): Subject {
  for (const [re, s] of SUBJECTS) if (re.test(clause)) return s
  return null
}

const MORE = /\b(more|increase|bigger|larger|thicker|stronger|heavier|higher|raise|boost|up)\b/i
const LESS = /\b(less|reduce|decrease|smaller|thinner|weaker|lighter weight|lower|tighter|down|subtler|softer)\b/i
const REMOVE = /\b(remove|no|none|without|drop|kill|get rid of|hide)\b/i
const DARKER = /\b(darker|darken|deeper)\b/i
const LIGHTER = /\b(lighter|lighten|paler|softer color)\b/i

function clauseSpecs(clause: string, subject: Subject, kind: ComponentDef["kind"]): ChangeSpec[] | null {
  const c = clause.toLowerCase()
  const num = parseNum(c)
  const color = parseColor(c)

  /* subject-free intents first */
  if (/\b(increase|more|higher|boost|max(imum)?)\s+contrast\b|\bcontrast\s+(up|higher)\b/.test(c))
    return [
      {
        flags: ["contrast-up"],
        // push text away from its background's luminance
        resolve: (cs) => ({ color: isDark(cs["background-color"]) ? "#ffffff" : darken(cs.color, 55), opacity: "1" }),
      },
    ]
  if (/\b(reduce|less|lower|decrease)\s+contrast\b/.test(c))
    return [{ flags: ["contrast-down"], resolve: (cs) => ({ color: lighten(cs.color, 40) }) }]
  if (/^(hide|remove)\s+(it|this|that|element|component)\b|\bhide (it|this)\b/.test(c)) return [{ flags: ["hide"], resolve: () => ({ display: "none" }) }]
  if (/\b(uppercase|all caps|caps)\b/.test(c)) return [{ resolve: () => ({ "text-transform": "uppercase", "letter-spacing": "0.04em" }) }]
  if (/\blowercase\b/.test(c)) return [{ resolve: () => ({ "text-transform": "lowercase" }) }]
  if (/\b(capitalize|title case)\b/.test(c)) return [{ resolve: () => ({ "text-transform": "capitalize" }) }]
  if (/\bitalic\b/.test(c)) return [{ resolve: () => ({ "font-style": "italic" }) }]
  if (/\bunderline\b/.test(c)) return [{ resolve: () => ({ "text-decoration-line": REMOVE.test(c) ? "none" : "underline", "text-underline-offset": "3px" }) }]
  if (/\b(center|centre)(ed)?\b/.test(c) && subject !== "bg") return [{ resolve: () => ({ "text-align": "center", "justify-content": "center" }) }]
  if (/\balign(ed)? (left|right)\b|\b(left|right)[- ]align/.test(c)) {
    const side = /right/.test(c) ? "right" : "left"
    return [{ resolve: () => ({ "text-align": side, "justify-content": side === "right" ? "flex-end" : "flex-start" }) }]
  }
  if (/\bfull[- ]width\b/.test(c)) return [{ resolve: () => ({ width: "100%" }) }]
  if (/\b(pill|fully rounded|capsule)\b/.test(c)) return [{ resolve: () => ({ "border-radius": "999px" }) }]
  if (/\b(square( corners)?|sharp( corners)?|no radius)\b/.test(c)) return [{ resolve: () => ({ "border-radius": "0px" }) }]
  if (/\b(flat|flatten)\b/.test(c)) return [{ flags: ["prominence-down"], resolve: () => ({ "box-shadow": "none" }) }]
  if (/\b(bold|semibold|semi-bold|medium|regular|normal weight|light weight|thin)\b/.test(c) && subject !== "border") {
    const w = /semi-?bold/.test(c) ? "600" : /\bbold\b/.test(c) ? "700" : /medium/.test(c) ? "500" : /light|thin/.test(c) ? "300" : "400"
    return [{ flags: Number(w) >= 600 ? ["prominence-up"] : undefined, resolve: () => ({ "font-weight": w }) }]
  }
  if (/\b(fade|dim|ghost(ed)?|muted)\b/.test(c) && !subject) return [{ flags: ["prominence-down"], resolve: () => ({ opacity: "0.6" }) }]
  if (/\b(opaque|full opacity|fully visible)\b/.test(c)) return [{ flags: ["contrast-up"], resolve: () => ({ opacity: "1" }) }]

  switch (subject) {
    case "ring": {
      if (REMOVE.test(c)) return [{ flags: ["remove-ring"], resolve: () => ({ "box-shadow": "none", outline: "none" }) }]
      const col = color ?? "var(--brand)"
      const w = num ? num.n : 3
      return [{ resolve: () => ({ "box-shadow": `0 0 0 ${w}px color-mix(in oklab, ${col}, transparent 70%)`, outline: "none" }) }]
    }
    case "border": {
      const specs: ChangeSpec[] = []
      if (REMOVE.test(c)) return [{ resolve: () => ({ "border-width": "0px" }) }]
      if (num && num.unit !== "%")
        specs.push({
          resolve: (cs) => ({
            "border-width": len(num),
            ...(cs["border-top-style"] === "none" ? { "border-style": "solid" } : {}),
          }),
        })
      else if (/\bthick(er)?\b/.test(c)) specs.push({ resolve: (cs) => ({ "border-width": `${Math.max(1, px(cs["border-top-width"])) + 1}px`, "border-style": "solid" }) })
      else if (/\bthin(ner)?\b/.test(c)) specs.push({ resolve: (cs) => ({ "border-width": `${Math.max(0, px(cs["border-top-width"]) - 1)}px` }) })
      if (/\bdashed\b/.test(c)) specs.push({ resolve: () => ({ "border-style": "dashed" }) })
      if (/\bdotted\b/.test(c)) specs.push({ resolve: () => ({ "border-style": "dotted" }) })
      if (color) specs.push({ resolve: (cs) => ({ "border-color": color, ...(cs["border-top-style"] === "none" ? { "border-style": "solid", "border-width": "1px" } : {}) }) })
      else if (DARKER.test(c)) specs.push({ flags: ["contrast-up"], resolve: (cs) => ({ "border-color": darken(cs["border-top-color"], 35) }) })
      else if (LIGHTER.test(c)) specs.push({ flags: ["contrast-down"], resolve: (cs) => ({ "border-color": lighten(cs["border-top-color"]) }) })
      if (!specs.length && /\badd\b/.test(c)) specs.push({ resolve: () => ({ "border-width": "1px", "border-style": "solid", "border-color": "var(--border)" }) })
      return specs.length ? specs : null
    }
    case "bg": {
      if (REMOVE.test(c) || /\btransparent\b/.test(c)) return [{ flags: ["prominence-down"], resolve: () => ({ "background-color": "transparent", "background-image": "none" }) }]
      if (/\bgradient\b/.test(c)) {
        const col = color ?? "var(--brand)"
        return [{ flags: ["prominence-up"], resolve: () => ({ "background-image": `linear-gradient(180deg, color-mix(in oklab, ${col}, white 18%), ${col})` }) }]
      }
      if (color) return [{ resolve: () => ({ "background-color": color }) }]
      if (DARKER.test(c)) return [{ flags: ["contrast-up"], resolve: (cs) => ({ "background-color": darken(isTransparent(cs["background-color"]) ? "#f4f4f2" : cs["background-color"], 12) }) }]
      if (LIGHTER.test(c)) return [{ flags: ["contrast-down"], resolve: (cs) => ({ "background-color": lighten(cs["background-color"], 35) }) }]
      if (/\b(tint|tinted|subtle)\b/.test(c)) return [{ resolve: () => ({ "background-color": "var(--brand-soft)" }) }]
      return null
    }
    case "radius": {
      if (num) return [{ resolve: () => ({ "border-radius": len(num) }) }]
      if (MORE.test(c) || /\bround(er|ed)\b/.test(c)) return [{ resolve: (cs) => ({ "border-radius": `${px(cs["border-top-left-radius"]) + 4}px` }) }]
      if (LESS.test(c) || /\bsharper\b/.test(c)) return [{ resolve: (cs) => ({ "border-radius": `${Math.max(0, px(cs["border-top-left-radius"]) - 4)}px` }) }]
      return null
    }
    case "opacity": {
      if (num) {
        const v = num.unit === "%" || num.n > 1 ? num.n / 100 : num.n
        return [{ flags: undefined, resolve: () => ({ opacity: String(Math.max(0, Math.min(1, +v.toFixed(2)))) }) }]
      }
      if (LESS.test(c) || /\b(more transparent)\b/.test(c)) return [{ flags: ["prominence-down"], resolve: (cs) => ({ opacity: String(+(px(cs.opacity || "1") * 0.6).toFixed(2)) }) }]
      if (MORE.test(c)) return [{ flags: ["contrast-up"], resolve: (cs) => ({ opacity: String(Math.min(1, +(px(cs.opacity || "1") + 0.3).toFixed(2))) }) }]
      return null
    }
    case "padding": {
      const axis = /\b(horizontal|x|sides|left and right)\b/.test(c) ? "x" : /\b(vertical|y|top and bottom)\b/.test(c) ? "y" : "all"
      const apply = (fn: (v: number) => number) => (cs: Record<string, string>): CssProps => {
        const t = px(cs["padding-top"]), r = px(cs["padding-right"]), b = px(cs["padding-bottom"]), l = px(cs["padding-left"])
        if (axis === "x") return { "padding-left": `${fn(l)}px`, "padding-right": `${fn(r)}px` }
        if (axis === "y") return { "padding-top": `${fn(t)}px`, "padding-bottom": `${fn(b)}px` }
        return { padding: `${fn(t)}px ${fn(r)}px ${fn(b)}px ${fn(l)}px` }
      }
      if (num) return [{ resolve: apply(() => num.n) }]
      if (MORE.test(c) || /\b(roomier|spacious|airy)\b/.test(c)) return [{ resolve: apply((v) => v + 4) }]
      if (LESS.test(c) || /\b(compact|tight)\b/.test(c)) return [{ resolve: apply((v) => Math.max(0, v - 4)) }]
      return null
    }
    case "gap": {
      if (num) return [{ resolve: () => ({ gap: len(num) }) }]
      if (MORE.test(c)) return [{ resolve: (cs) => ({ gap: `${px(cs.gap) + 4}px` }) }]
      if (LESS.test(c)) return [{ resolve: (cs) => ({ gap: `${Math.max(0, px(cs.gap) - 4)}px` }) }]
      return null
    }
    case "shadow": {
      if (REMOVE.test(c)) return [{ flags: ["prominence-down"], resolve: () => ({ "box-shadow": "none" }) }]
      if (/\b(big|bigger|large|stronger|heavy|dramatic|lg|xl)\b/.test(c)) return [{ flags: ["prominence-up"], resolve: () => ({ "box-shadow": "var(--shadow-l)" }) }]
      if (/\b(subtle|small|soft|light|sm|xs)\b/.test(c)) return [{ resolve: () => ({ "box-shadow": "var(--shadow-s)" }) }]
      return [{ flags: ["prominence-up"], resolve: () => ({ "box-shadow": "var(--shadow-m)" }) }]
    }
    case "width": {
      if (num) return [{ resolve: () => ({ width: len(num) }) }]
      if (/\bwider\b/.test(c) || MORE.test(c)) return [{ resolve: (cs) => ({ width: `${px(cs.width) + 24}px` }) }]
      if (/\bnarrower\b/.test(c) || LESS.test(c)) return [{ resolve: (cs) => ({ width: `${Math.max(16, px(cs.width) - 24)}px` }) }]
      return null
    }
    case "height": {
      if (num) return [{ resolve: () => ({ height: len(num), "min-height": len(num) }) }]
      if (/\btaller\b/.test(c) || MORE.test(c)) return [{ resolve: (cs) => ({ height: `${px(cs.height) + 4}px` }) }]
      if (/\bshorter\b/.test(c) || LESS.test(c)) return [{ resolve: (cs) => ({ height: `${Math.max(12, px(cs.height) - 4)}px` }) }]
      return null
    }
    case "weight": {
      if (num) return [{ resolve: () => ({ "font-weight": String(Math.round(num.n / 100) * 100) }) }]
      if (MORE.test(c) || /\bheavier\b/.test(c)) return [{ flags: ["prominence-up"], resolve: (cs) => ({ "font-weight": String(Math.min(800, px(cs["font-weight"]) + 100)) }) }]
      if (LESS.test(c)) return [{ resolve: (cs) => ({ "font-weight": String(Math.max(300, px(cs["font-weight"]) - 100)) }) }]
      return null
    }
    case "tracking": {
      if (num) return [{ resolve: () => ({ "letter-spacing": num.unit ? `${num.n}${num.unit}` : `${num.n}px` }) }]
      if (/\b(tight|tighter|less)\b/.test(c)) return [{ resolve: () => ({ "letter-spacing": "-0.02em" }) }]
      if (/\b(wide|wider|loose|more)\b/.test(c)) return [{ resolve: () => ({ "letter-spacing": "0.04em" }) }]
      return null
    }
    case "leading": {
      if (num) return [{ resolve: () => ({ "line-height": num.unit ? len(num) : String(num.n) }) }]
      if (MORE.test(c) || /\bloose\b/.test(c)) return [{ resolve: () => ({ "line-height": "1.6" }) }]
      if (LESS.test(c) || /\btight\b/.test(c)) return [{ resolve: () => ({ "line-height": "1.15" }) }]
      return null
    }
    case "size":
    case "text": {
      const specs: ChangeSpec[] = []
      if (num && num.unit !== "%" && (subject === "size" || /\b(size|px|pt)\b/.test(c)))
        specs.push({ resolve: () => ({ "font-size": num.unit === "pt" ? `${num.n}pt` : len(num) }) })
      else if (/\b(bigger|larger|increase size|bump)\b/.test(c)) specs.push({ flags: ["prominence-up"], resolve: (cs) => ({ "font-size": `${Math.round(px(cs["font-size"]) * 1.15)}px` }) })
      else if (/\b(smaller|decrease size|shrink)\b/.test(c)) specs.push({ resolve: (cs) => ({ "font-size": `${Math.max(9, Math.round(px(cs["font-size"]) * 0.88))}px` }) })
      if (color) specs.push({ resolve: () => ({ color }) })
      else if (DARKER.test(c)) specs.push({ flags: ["contrast-up"], resolve: (cs) => ({ color: darken(cs.color, 40) }) })
      else if (LIGHTER.test(c)) specs.push({ flags: ["contrast-down"], resolve: (cs) => ({ color: lighten(cs.color, 40) }) })
      return specs.length ? specs : null
    }
  }

  /* no subject: general intents */
  if (color && /\b(make|turn|change|color|colour|paint|set)\b/.test(c))
    return [{ resolve: (cs) => (kind === "text" || isTransparent(cs["background-color"]) ? { color } : { "background-color": color }) }]
  if (DARKER.test(c))
    return [
      {
        flags: ["contrast-up"],
        resolve: (cs) => (isTransparent(cs["background-color"]) || kind === "text" ? { color: darken(cs.color, 40) } : { "background-color": darken(cs["background-color"], 18) }),
      },
    ]
  if (LIGHTER.test(c))
    return [
      {
        flags: ["contrast-down"],
        resolve: (cs) => (isTransparent(cs["background-color"]) || kind === "text" ? { color: lighten(cs.color, 40) } : { "background-color": lighten(cs["background-color"], 40) }),
      },
    ]
  if (/\b(bigger|larger|scale up|grow)\b/.test(c))
    return [{ flags: ["prominence-up"], resolve: (cs) => (kind === "text" || kind === "button" ? { "font-size": `${Math.round(px(cs["font-size"]) * 1.12)}px` } : { scale: "1.04" }) }]
  if (/\b(smaller|scale down|shrink)\b/.test(c))
    return [{ resolve: (cs) => (kind === "text" || kind === "button" ? { "font-size": `${Math.round(px(cs["font-size"]) * 0.9)}px` } : { scale: "0.96" }) }]
  if (/\b(pop|stand out|prominent|emphasi[sz]e|highlight)\b/.test(c))
    return [{ flags: ["prominence-up", "contrast-up"], resolve: () => ({ "box-shadow": "var(--shadow-m)", "border-color": "var(--brand)" }) }]
  return null
}

export function parsePrompt(text: string, kind: ComponentDef["kind"]): Parsed {
  const clauses = text
    .replace(/\s+/g, " ")
    .split(/\s*(?:,|;|\.\s|\band then\b|\bthen\b|\band\b|\balso\b|\bplus\b|\bwith\b)\s*/i)
    .map((c) => c.trim())
    .filter(Boolean)
  const specs: ChangeSpec[] = []
  const unparsed: string[] = []
  let subject: Subject = null
  for (const clause of clauses) {
    const own = subjectOf(clause)
    const subj: Subject = own ?? subject
    const got = clauseSpecs(clause, subj, kind)
    if (got?.length) {
      specs.push(...got)
      subject = subj
    } else {
      // retry without the carried subject (e.g. "and make it bold")
      const fresh = own ? null : clauseSpecs(clause, null, kind)
      if (fresh?.length) specs.push(...fresh)
      else if (clause.split(" ").length > 0 && !/^(please|it|this|the|a)$/i.test(clause)) unparsed.push(clause)
    }
  }
  return { specs, unparsed }
}

const PRETTY: Record<string, string> = {
  $text: "Text",
  "mix-blend-mode": "Blend mode",
  overflow: "Clip content",
  "flex-wrap": "Wrap",
  "grid-template-columns": "Grid columns",
  "grid-template-rows": "Grid rows",
  "grid-auto-flow": "Grid flow",
  "justify-items": "Justify items",
  position: "Position",
  top: "Y",
  left: "X",
  rotate: "Rotation",
  "column-gap": "Column gap",
  "row-gap": "Row gap",
  visibility: "Visibility",
  "background-color": "Fill",
  "background-image": "Fill",
  "border-color": "Stroke color",
  "border-width": "Stroke",
  "border-style": "Stroke style",
  "border-radius": "Radius",
  "box-shadow": "Shadow",
  color: "Text color",
  "font-size": "Font size",
  "font-weight": "Weight",
  "letter-spacing": "Tracking",
  "line-height": "Line height",
  opacity: "Opacity",
  padding: "Padding",
  "padding-left": "Padding L",
  "padding-right": "Padding R",
  "padding-top": "Padding T",
  "padding-bottom": "Padding B",
  gap: "Gap",
  width: "Width",
  height: "Height",
  "min-height": "Min height",
  "text-transform": "Case",
  "text-align": "Align",
  "justify-content": "Justify",
  display: "Display",
  scale: "Scale",
  outline: "Outline",
  "font-style": "Style",
  "text-decoration-line": "Decoration",
  "text-underline-offset": "Underline offset",
}

export const prettyProp = (p: string) => PRETTY[p] ?? p

export function prettyValue(v: string) {
  return v
    .replace(/color-mix\(in oklab, (.+?), black (\d+)%\)/g, "$1 ▼$2%")
    .replace(/color-mix\(in oklab, (.+?), white (\d+)%\)/g, "$1 ▲$2%")
    .replace(/var\(--([\w-]+)\)/g, "$$$1")
}

export function resolveSpecs(specs: ChangeSpec[], cs: Record<string, string>) {
  const props: CssProps = {}
  const flags = new Set<Flag>()
  for (const s of specs) {
    for (const [k, v] of Object.entries(s.resolve(cs))) if (v !== undefined) props[k] = v
    s.flags?.forEach((f) => flags.add(f))
  }
  const applied: AppliedChange[] = Object.entries(props).map(([prop, value]) => ({ prop, value, label: prettyProp(prop) }))
  return { props, flags, applied }
}
