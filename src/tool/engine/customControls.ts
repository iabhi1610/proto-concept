import type { CssProps } from "../types"

/*
 * "Generate custom": turns a plain-language idea ("make the hover feel springy") into a small
 * DialKit-style panel of named controls, each wired to real CSS. Local and rule-based like the
 * prompt parser: recipes are matched by keyword and combined; templates use {v} for the control's
 * value (with an optional multiplier, {v*0.5}).
 *
 * Recipes write to separate properties (translate / scale / rotate, box-shadow vs filter vs
 * outline) so controls from different recipes never overwrite each other.
 */

export type CustomControl =
  | { id: string; kind: "slider"; label: string; min: number; max: number; step: number; unit: string; value: number; props: CssProps }
  | { id: string; kind: "toggle"; label: string; value: boolean; on: CssProps; off: CssProps }
  | { id: string; kind: "select"; label: string; value: string; options: { value: string; label: string; props: CssProps }[] }

export interface CustomPanel {
  id: string
  title: string
  prompt: string
  /** state the controls edit (e.g. "hover" for "on hover…" prompts when the component has one) */
  state: string
  /** CSS the panel needs once (e.g. a transition so motion controls are visible) */
  base: CssProps
  controls: CustomControl[]
  createdAt: number
}

const uid = () => Math.random().toString(36).slice(2, 9)
const slider = (label: string, min: number, max: number, value: number, unit: string, props: CssProps, step = 1): CustomControl => ({
  id: uid(),
  kind: "slider",
  label,
  min,
  max,
  step,
  unit,
  value,
  props,
})
const toggle = (label: string, value: boolean, on: CssProps, off: CssProps): CustomControl => ({ id: uid(), kind: "toggle", label, value, on, off })
const select = (label: string, value: string, options: { value: string; label: string; props: CssProps }[]): CustomControl => ({ id: uid(), kind: "select", label, value, options })

interface Recipe {
  test: RegExp
  base?: CssProps
  controls: () => CustomControl[]
}

const MOTION_BASE = { "transition-property": "translate, scale, rotate, box-shadow, filter, background-color, color, opacity, border-radius", "transition-duration": "240ms" }

const RECIPES: Recipe[] = [
  {
    test: /\b(lift|raise|float|elevat|hover)/i,
    base: MOTION_BASE,
    controls: () => [
      slider("Lift", 0, 12, 3, "px", { translate: "0 -{v}px" }),
      slider("Shadow depth", 0, 40, 16, "px", { "box-shadow": "0 {v*0.4}px {v}px rgb(0 0 0 / 0.14)" }),
    ],
  },
  {
    test: /\b(spring|bounc|smooth|anima|transition|feel|snappy|fluid|motion)/i,
    base: MOTION_BASE,
    controls: () => [
      slider("Duration", 0, 800, 280, "ms", { "transition-duration": "{v}ms" }, 10),
      select("Easing", "spring", [
        { value: "spring", label: "Spring", props: { "transition-timing-function": "cubic-bezier(0.34, 1.56, 0.64, 1)" } },
        { value: "ease-out", label: "Out", props: { "transition-timing-function": "cubic-bezier(0.22, 1, 0.36, 1)" } },
        { value: "ease-in-out", label: "In-out", props: { "transition-timing-function": "ease-in-out" } },
        { value: "linear", label: "Linear", props: { "transition-timing-function": "linear" } },
      ]),
    ],
  },
  {
    test: /\b(pop|scale|grow|zoom|bigger|press)/i,
    base: MOTION_BASE,
    controls: () => [slider("Scale", 80, 120, 103, "%", { scale: "{v*0.01}" })],
  },
  {
    test: /\b(tilt|rotat|playful|skew)/i,
    controls: () => [slider("Tilt", -15, 15, 2, "°", { rotate: "{v}deg" })],
  },
  {
    test: /\b(glow|neon|light up|halo)/i,
    controls: () => [
      slider("Glow", 0, 32, 12, "px", { filter: "drop-shadow(0 0 {v}px color-mix(in oklab, var(--brand), transparent 40%))" }),
    ],
  },
  {
    test: /\b(glass|frost|blur|translucent)/i,
    controls: () => [
      slider("Blur", 0, 24, 10, "px", { "backdrop-filter": "blur({v}px)", "-webkit-backdrop-filter": "blur({v}px)" }),
      slider("Tint", 0, 100, 60, "%", { "background-color": "rgb(255 255 255 / {v*0.01})" }),
    ],
  },
  {
    test: /\b(round|soft|pill|radius|corner)/i,
    controls: () => [slider("Roundness", 0, 32, 14, "px", { "border-radius": "{v}px" })],
  },
  {
    test: /\b(dens|compact|spacious|airy|roomy|padding|breath|tight)/i,
    controls: () => [slider("Padding", 0, 40, 16, "px", { padding: "{v}px" }), slider("Gap", 0, 32, 8, "px", { gap: "{v}px" })],
  },
  {
    test: /\b(ring|outline|focus|border)/i,
    controls: () => [
      slider("Ring", 0, 6, 2, "px", { outline: "{v}px solid color-mix(in oklab, var(--brand), transparent 30%)", "outline-offset": "2px" }),
      toggle("Dashed", false, { "outline-style": "dashed" }, { "outline-style": "solid" }),
    ],
  },
  {
    test: /\b(gradient|vibrant|colorful|brand)/i,
    controls: () => [
      slider("Gradient angle", 0, 360, 135, "°", {
        "background-image": "linear-gradient({v}deg, color-mix(in oklab, var(--brand), white 75%), color-mix(in oklab, var(--brand), white 92%))",
      }),
    ],
  },
  {
    test: /\b(fade|dim|quiet|subtle|muted|opacity)/i,
    controls: () => [slider("Opacity", 0, 100, 70, "%", { opacity: "{v*0.01}" })],
  },
  {
    test: /\b(loud|bold|emphas|heavy|strong|headline|weight)/i,
    controls: () => [
      select("Weight", "600", [
        { value: "400", label: "Regular", props: { "font-weight": "400" } },
        { value: "500", label: "Medium", props: { "font-weight": "500" } },
        { value: "600", label: "Semibold", props: { "font-weight": "600" } },
        { value: "700", label: "Bold", props: { "font-weight": "700" } },
      ]),
      slider("Tracking", -4, 8, -1, "%", { "letter-spacing": "{v*0.01}em" }),
    ],
  },
  {
    test: /\b(caps|uppercase|label|eyebrow)/i,
    controls: () => [
      toggle("Uppercase", true, { "text-transform": "uppercase" }, { "text-transform": "none" }),
      slider("Tracking", 0, 20, 8, "%", { "letter-spacing": "{v*0.01}em" }),
    ],
  },
]

/** Fallback when nothing in the prompt matches: the most useful general-purpose dials. */
const GENERIC = (): CustomControl[] => [
  slider("Scale", 90, 110, 100, "%", { scale: "{v*0.01}" }),
  slider("Roundness", 0, 24, 8, "px", { "border-radius": "{v}px" }),
  slider("Shadow depth", 0, 40, 12, "px", { "box-shadow": "0 {v*0.4}px {v}px rgb(0 0 0 / 0.14)" }),
  slider("Opacity", 0, 100, 100, "%", { opacity: "{v*0.01}" }),
]

const FILLER = /^(a|an|the|with|and|of|for|to|on|in|that|make|it|more|some)$/i

/** "springy hover lift with a soft glow" → "Springy hover lift" */
const title = (prompt: string) => {
  const words = prompt.trim().replace(/[.!?]+$/, "").split(/\s+/).slice(0, 4)
  while (words.length > 1 && FILLER.test(words[words.length - 1])) words.pop()
  const t = words.join(" ")
  return t ? t[0].toUpperCase() + t.slice(1) : "Custom"
}

export function generatePanel(prompt: string, states: string[]): CustomPanel {
  const hits = RECIPES.filter((r) => r.test.test(prompt))
  const controls: CustomControl[] = []
  const seen = new Set<string>()
  for (const r of hits) for (const c of r.controls()) if (!seen.has(c.label)) (seen.add(c.label), controls.push(c))
  const base = Object.assign({}, ...hits.map((r) => r.base ?? {})) as CssProps
  const wantsHover = /\bhover/i.test(prompt) && states.includes("hover")
  return {
    id: uid(),
    title: title(prompt),
    prompt: prompt.trim(),
    state: wantsHover ? "hover" : "default",
    base,
    controls: (controls.length ? controls : GENERIC()).slice(0, 6),
    createdAt: Date.now(),
  }
}

/** Fills a template's {v} / {v*k} slots with a control value. */
const fill = (tpl: string, v: number) =>
  tpl.replace(/\{v(?:\*([\d.]+))?\}/g, (_, k) => String(+(v * (k ? parseFloat(k) : 1)).toFixed(3)))

/** The CSS a control writes at a given value. */
export function controlProps(c: CustomControl, value: number | boolean | string): CssProps {
  if (c.kind === "slider") return Object.fromEntries(Object.entries(c.props).map(([k, t]) => [k, fill(t, value as number)]))
  if (c.kind === "toggle") return value ? c.on : c.off
  return c.options.find((o) => o.value === value)?.props ?? {}
}

/** Everything a panel writes at its current values (used once on generate). */
export function panelProps(p: CustomPanel): CssProps {
  return Object.assign({ ...p.base }, ...p.controls.map((c) => controlProps(c, c.value)))
}
