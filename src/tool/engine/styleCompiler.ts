import type { CssProps, EditOp, VariantSet } from "../types"

const sel = (elId: string) => `[data-pc-id="${elId.replace(/"/g, '\\"')}"]`

export function stateSelector(elId: string, state: string) {
  if (state === "default") return `${sel(elId)}:is([data-pc-state="default"], :not([data-pc-state]))`
  return `${sel(elId)}[data-pc-state="${state}"]`
}

/** Props starting with "$" aren't CSS (e.g. "$text", an inline text edit) and are applied to the DOM instead. */
const block = (props: CssProps) =>
  Object.entries(props)
    .filter(([k]) => !k.startsWith("$"))
    .map(([k, v]) => `  ${k}: ${v} !important;`)
    .join("\n")

/** Folds ordered ops into one prop map per (element, state). Later ops win per property. */
export function foldOps(ops: EditOp[]) {
  const map = new Map<string, Map<string, CssProps>>()
  for (const op of ops) {
    let byState = map.get(op.elId)
    if (!byState) map.set(op.elId, (byState = new Map()))
    byState.set(op.state, { ...(byState.get(op.state) ?? {}), ...op.props })
  }
  return map
}

export function compileCss(ops: EditOp[], variantSets: VariantSet[]) {
  const out: string[] = []
  for (const set of variantSets) {
    const opt = set.options.find((o) => o.id === set.selected)
    if (opt?.kind === "style" && opt.style) out.push(`${sel(set.elId)} {\n${block(opt.style)}\n}`)
  }
  for (const [elId, byState] of foldOps(ops)) {
    for (const [state, props] of byState) out.push(`${stateSelector(elId, state)} {\n${block(props)}\n}`)
  }
  return out.join("\n")
}

/** CSS diff text for the agent hand-off. */
export function cssDiff(props: CssProps) {
  return Object.entries(props)
    .map(([k, v]) => (k === "$text" ? `/* text content */ ${JSON.stringify(v)}` : `${k}: ${v};`))
    .join("\n")
}
