import type { StateDef } from "@/product/system/define"
import type { CssProps } from "../types"
import type { Flag } from "./parser"
import { px } from "./dom"

/**
 * A change can be valid CSS and still fight what a state is for. We apply it anyway
 * and surface a small inline warning.
 */
export function conflictsFor(state: StateDef, props: CssProps, flags: Set<Flag>, before: Record<string, string>): string[] {
  const out: string[] = []
  const opacityUp = props.opacity !== undefined && parseFloat(props.opacity) > px(before.opacity || "1") + 0.05
  const purpose = state.purpose ?? "rest"

  if (purpose === "inactive") {
    if (flags.has("contrast-up") || opacityUp)
      out.push(`${state.label} should read as unavailable — this raises its contrast, so it may look clickable.`)
    else if (flags.has("prominence-up")) out.push(`${state.label} is getting more visual weight than an inactive control usually has.`)
  }
  if (state.id === "focused" && (flags.has("remove-ring") || props["box-shadow"] === "none" || props.outline === "none"))
    out.push("Removing the focus ring makes keyboard focus invisible (WCAG 2.4.7).")
  if (purpose === "busy" && (flags.has("hide") || props.opacity === "0"))
    out.push(`${state.label} hides its content — people won't see that something is in progress.`)
  if (purpose === "rest" && props.opacity !== undefined && parseFloat(props.opacity) < 0.55)
    out.push(`At ${Math.round(parseFloat(props.opacity) * 100)}% opacity the ${state.label} state may be mistaken for Disabled.`)
  if (purpose === "error" && props["border-color"] && !/danger|red|#e5|#ef|#f4|#dc|rose/.test(props["border-color"]))
    out.push("Error usually keeps a red stroke — this color may hide the problem.")
  if (state.id === "hover" && flags.has("contrast-down")) out.push("Hover is getting less contrast than Default; the feedback may feel inverted.")
  if (purpose === "selection" && flags.has("prominence-down")) out.push(`${state.label} should stand out from Default — this makes it quieter.`)
  return out
}
