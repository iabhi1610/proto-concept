import * as React from "react"
import { useTool } from "@/tool/store"

export interface StateDef {
  id: string
  label: string
  /** what this state is for; drives conflict warnings */
  purpose?: "rest" | "interaction" | "feedback" | "inactive" | "selection" | "busy" | "error"
  /** transient states come from pointer/keyboard and are only shown while interacting */
  transient?: boolean
}

export interface ComponentDef {
  name: string
  kind: "button" | "input" | "text" | "frame" | "toggle" | "nav" | "row" | "card" | "chart" | "badge"
  states: StateDef[]
  description?: string
}

const registry = new Map<string, ComponentDef>()

/** Declares a product component and its real state list. The tool reads states from here. */
export function defineComponent<T extends ComponentDef>(def: T): T {
  registry.set(def.name, def)
  return def
}

export const getComponentDef = (name: string | null | undefined) => (name ? registry.get(name) : undefined)
export const allComponentDefs = () => [...registry.values()]

export const S = {
  default: { id: "default", label: "Default", purpose: "rest" },
  hover: { id: "hover", label: "Hover", purpose: "interaction", transient: true },
  focused: { id: "focused", label: "Focused", purpose: "interaction", transient: true },
  pressed: { id: "pressed", label: "Pressed", purpose: "interaction", transient: true },
  disabled: { id: "disabled", label: "Disabled", purpose: "inactive" },
  loading: { id: "loading", label: "Loading", purpose: "busy" },
  active: { id: "active", label: "Active", purpose: "selection" },
  selected: { id: "selected", label: "Selected", purpose: "selection" },
  filled: { id: "filled", label: "Filled", purpose: "rest" },
  error: { id: "error", label: "Error", purpose: "error" },
  on: { id: "on", label: "On", purpose: "selection" },
  off: { id: "off", label: "Off", purpose: "rest" },
  empty: { id: "empty", label: "Empty", purpose: "feedback" },
} satisfies Record<string, StateDef>

/** Generic single-state definitions for plain elements (headings, paragraphs, containers). */
export const TextDef = defineComponent({ name: "Text", kind: "text", states: [S.default] })
export const FrameDef = defineComponent({ name: "Frame", kind: "frame", states: [S.default] })

/**
 * Data attributes that make a plain element inspectable as a single-state Text/Frame/etc.
 * Usage: <h1 {...pc("overview.title", "Text", "Page title")} />
 */
export function pc(id: string | undefined, component = "Frame", label?: string) {
  if (!id) return {}
  return {
    "data-pc-id": id,
    "data-pc-component": component,
    "data-pc-label": label,
  } as Record<string, string | undefined>
}

/**
 * Tracks a component's live state from pointer + keyboard, lets the tool force any state,
 * and returns the attributes + handlers to spread on the root element.
 *
 * `rest` is the non-transient state implied by props (e.g. "disabled", "on", "active").
 */
export function useComponentState(
  def: ComponentDef,
  pcId: string | undefined,
  rest: string = "default",
  label?: string,
) {
  const forcedRaw = useTool((s) => (pcId ? s.forced[pcId] : undefined))
  const forced = forcedRaw && def.states.some((st) => st.id === forcedRaw) ? forcedRaw : undefined
  const [hover, setHover] = React.useState(false)
  const [focus, setFocus] = React.useState(false)
  const [pressed, setPressed] = React.useState(false)

  const has = (id: string) => def.states.some((s) => s.id === id)
  const sticky = rest === "disabled" || rest === "loading" || rest === "error"

  let state = rest
  if (!sticky) {
    if (pressed && has("pressed")) state = "pressed"
    else if (focus && has("focused")) state = "focused"
    else if (hover && has("hover") && rest !== "active" && rest !== "selected") state = "hover"
  }
  if (forced) state = forced

  React.useEffect(() => {
    if (!pressed) return
    const up = () => setPressed(false)
    window.addEventListener("pointerup", up)
    return () => window.removeEventListener("pointerup", up)
  }, [pressed])

  const handlers = {
    onPointerEnter: () => setHover(true),
    onPointerLeave: () => {
      setHover(false)
      setPressed(false)
    },
    onPointerDown: () => setPressed(true),
    onFocus: (e: React.FocusEvent<HTMLElement>) => {
      try {
        setFocus((e.target as HTMLElement).matches(":focus-visible"))
      } catch {
        setFocus(true)
      }
    },
    onBlur: () => setFocus(false),
  }

  const attrs: Record<string, string | undefined> = {
    "data-pc-id": pcId,
    "data-pc-component": def.name,
    "data-pc-state": state,
    "data-pc-rest": rest,
    "data-pc-label": label,
    "data-pc-forced": forced ? "" : undefined,
  }

  return { state, forced: !!forced, attrs, handlers, is: (id: string) => state === id }
}
