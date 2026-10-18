import type { StateDef } from "@/product/system/define"
import { conflictsFor } from "./engine/conflicts"
import { elInfo, ensureId, findEl, px, readSnapshot } from "./engine/dom"
import { parsePrompt, prettyProp, resolveSpecs, type Flag } from "./engine/parser"
import { nextCommentNumber, uid, useTool } from "./store"
import type { AppliedChange, Comment, CssProps, EditOp, VariantOption, VariantSet, Warning } from "./types"

/* ───────────────────────── states ───────────────────────── */

/** States shared by every element in the selection (a group of mixed components falls back to Default). */
export function statesFor(elIds: string[]): StateDef[] {
  const defs = elIds.map((id) => findEl(id)).filter(Boolean).map((el) => elInfo(el!).def)
  if (!defs.length) return []
  const [first, ...rest] = defs
  return first.states.filter((s) => rest.every((d) => d.states.some((x) => x.id === s.id)))
}

/** The state an element is resting in (ignores hover/focus/press) — the dropdown's default. */
export function restingState(elId: string) {
  const el = findEl(elId)
  return el?.dataset.pcRest ?? "default"
}

const targetStates = (el: HTMLElement, state: string, all: boolean): StateDef[] => {
  const def = elInfo(el).def
  if (all) return def.states
  return [def.states.find((s) => s.id === state) ?? def.states[0]]
}

/* ───────────────────────── prompt → ops + comment ───────────────────────── */

export interface PromptResult {
  comment: Comment
  applied: AppliedChange[]
  unparsed: string[]
  warnings: Warning[]
}

export function applyPrompt(opts: {
  text: string
  elIds: string[]
  state: string
  allStates: boolean
  anchor?: { x: number; y: number } | null
  /** rewrite this comment in place (same number), replacing the edits its old text made */
  replaceId?: string
}): PromptResult | null {
  const s = useTool.getState()
  const els = opts.elIds.map((id) => findEl(id)).filter((e): e is HTMLElement => !!e)
  if (!els.length || !opts.text.trim()) return null

  const kind = elInfo(els[0]).kind
  const parsed = parsePrompt(opts.text, kind)
  const ops: EditOp[] = []
  const warnings: Warning[] = []
  let applied: AppliedChange[] = []
  const prev = opts.replaceId ? s.comments.find((c) => c.id === opts.replaceId) : undefined
  const commentId = prev?.id ?? uid("c")
  const now = Date.now()

  for (const el of els) {
    const id = el.dataset.pcId!
    for (const st of targetStates(el, opts.state, opts.allStates)) {
      const before = readSnapshot(el, st.id)
      const { props, flags, applied: a } = resolveSpecs(parsed.specs, before)
      if (!Object.keys(props).length) continue
      if (!applied.length) applied = a
      ops.push({ id: uid("op"), elId: id, state: st.id, props, source: "prompt", commentId, at: now })
      for (const w of conflictsFor(st, props, flags, before)) warnings.push({ elId: id, state: st.id, text: w })
    }
  }

  const statesTouched = [...new Set(ops.map((o) => o.state))]
  const comment: Comment = {
    id: commentId,
    number: prev?.number ?? nextCommentNumber(s.comments),
    screen: s.screen,
    elIds: els.map((e) => e.dataset.pcId!),
    elNames: els.map((e) => elInfo(e).name),
    text: opts.text.trim(),
    states: statesTouched.length ? statesTouched : [opts.state],
    allStates: opts.allStates,
    kind: ops.length ? "edit" : "note",
    applied,
    unparsed: parsed.unparsed,
    warnings: dedupeWarnings(warnings),
    status: "open",
    author: "You",
    source: "editor",
    createdAt: prev?.createdAt ?? now,
    anchor: prev?.anchor ?? opts.anchor ?? undefined,
  }

  if (prev)
    s.commit((d) => ({
      ...d,
      ops: [...d.ops.filter((o) => !(o.commentId === prev.id && o.source === "prompt")), ...ops],
      comments: d.comments.map((c) => (c.id === prev.id ? comment : c)),
    }))
  else s.commit((d) => ({ ...d, ops: [...d.ops, ...ops], comments: [...d.comments, comment] }))
  return { comment, applied, unparsed: parsed.unparsed, warnings: comment.warnings }
}

function dedupeWarnings(ws: Warning[]) {
  const seen = new Set<string>()
  return ws.filter((w) => {
    const k = `${w.state}|${w.text}`
    if (seen.has(k)) return false
    seen.add(k)
    return true
  })
}

/* ───────────────────────── properties panel → ops ───────────────────────── */

/**
 * Applies a direct property edit to the selection (selected state or all states). Rapid edits to
 * the same property (scrubbing, typing) coalesce into one undo step. Edits are collected into a
 * "props" comment so they get a numbered pin and travel with the agent hand-off.
 */
export function applyProps(props: CssProps, flags: Flag[] = [], opts: { state?: string } = {}) {
  const s = useTool.getState()
  const els = s.selection.map((id) => findEl(id)).filter((e): e is HTMLElement => !!e)
  if (!els.length) return
  const state = opts.state ?? s.forced[s.selection[0]] ?? s.selection.map(restingState)[0]
  const now = Date.now()
  const key = `props:${s.selection.join(",")}:${s.applyAll ? "*" : state}:${Object.keys(props).sort().join(",")}`

  let commentId = s.propsCommentId
  const existing = commentId ? s.comments.find((c) => c.id === commentId) : undefined
  if (!existing) commentId = uid("c")

  const ops: EditOp[] = []
  const warnings: Warning[] = []
  for (const el of els) {
    const id = el.dataset.pcId!
    for (const st of targetStates(el, state, s.applyAll)) {
      const before = readSnapshot(el, st.id)
      ops.push({ id: uid("op"), elId: id, state: st.id, props, source: "props", commentId: commentId!, at: now })
      for (const w of conflictsFor(st, props, inferFlags(props, before, flags), before)) warnings.push({ elId: id, state: st.id, text: w })
    }
  }

  s.commit(
    (d) => {
      // coalescing: replace the previous op for the same key instead of stacking
      const coalescing = s.lastCoalesceKey === key && now - s.lastCoalesceAt < 900
      const lastIds = coalescing ? new Set(d.ops.filter((o) => o.commentId === commentId && o.at === s.lastCoalesceAt).map((o) => o.id)) : new Set<string>()
      const baseOps = coalescing ? d.ops.filter((o) => !lastIds.has(o.id)) : d.ops
      const newOps = ops.map((o) => ({ ...o, at: now }))
      const allOps = [...baseOps, ...newOps]
      const mine = allOps.filter((o) => o.commentId === commentId)
      const merged: CssProps = {}
      for (const o of mine) Object.assign(merged, o.props)
      const applied: AppliedChange[] = Object.entries(merged).map(([prop, value]) => ({ prop, value, label: prettyProp(prop) }))
      const states = [...new Set(mine.map((o) => o.state))]
      const text = `Adjusted ${[...new Set(applied.map((a) => a.label))].slice(0, 4).join(", ")} in Properties`
      const comment: Comment = existing
        ? {
            ...(d.comments.find((c) => c.id === commentId) ?? existing),
            applied,
            states,
            text,
            allStates: s.applyAll,
            warnings: dedupeWarnings([...(existing.warnings ?? []), ...warnings]),
          }
        : {
            id: commentId!,
            number: nextCommentNumber(d.comments),
            screen: s.screen,
            elIds: els.map((e) => e.dataset.pcId!),
            elNames: els.map((e) => elInfo(e).name),
            text,
            states,
            allStates: s.applyAll,
            kind: "props",
            applied,
            unparsed: [],
            warnings: dedupeWarnings(warnings),
            status: "open",
            author: "You",
            source: "editor",
            createdAt: now,
            anchor: s.anchor ?? undefined,
          }
      const comments = d.comments.some((c) => c.id === commentId) ? d.comments.map((c) => (c.id === commentId ? comment : c)) : [...d.comments, comment]
      return { ...d, ops: allOps, comments }
    },
    { coalesceKey: key },
  )
  useTool.setState({ propsCommentId: commentId, lastCoalesceAt: now })
}

function inferFlags(props: CssProps, before: Record<string, string>, extra: Flag[]): Set<Flag> {
  const f = new Set<Flag>(extra)
  if (props.opacity && parseFloat(props.opacity) > px(before.opacity || "1") + 0.05) f.add("contrast-up")
  if (props["font-weight"] && parseFloat(props["font-weight"]) > px(before["font-weight"]) + 50) f.add("prominence-up")
  if (props["box-shadow"] === "none" || props.outline === "none") f.add("remove-ring")
  return f
}

/* ───────────────────────── comments ───────────────────────── */

export function deleteComment(id: string) {
  useTool.getState().commit((d) => ({
    ...d,
    comments: d.comments.filter((c) => c.id !== id),
    ops: d.ops.filter((o) => o.commentId !== id),
  }))
  if (useTool.getState().activeCommentId === id) useTool.setState({ activeCommentId: null })
}

/**
 * Records an inline text edit as an op + "props" comment on that element (one per element: a
 * second edit of the same text updates the first).
 */
export function applyText(el: HTMLElement, text: string) {
  const s = useTool.getState()
  const elId = ensureId(el)
  const now = Date.now()
  const prev = s.comments.find((c) => c.kind === "props" && c.elIds.length === 1 && c.elIds[0] === elId && c.applied.some((a) => a.prop === "$text"))
  const commentId = prev?.id ?? uid("c")
  const op: EditOp = { id: uid("op"), elId, state: "default", props: { $text: text }, source: "props", commentId, at: now }
  const label = text.length > 40 ? `${text.slice(0, 38)}…` : text
  s.commit((d) => {
    const ops = [...d.ops.filter((o) => !(o.commentId === commentId && o.props.$text !== undefined)), op]
    const comment: Comment = prev
      ? { ...prev, text: `Changed text to “${label}”`, applied: [{ prop: "$text", value: text, label: "Text" }] }
      : {
          id: commentId,
          number: nextCommentNumber(d.comments),
          screen: s.screen,
          elIds: [elId],
          elNames: [elInfo(el).name],
          text: `Changed text to “${label}”`,
          states: ["default"],
          allStates: false,
          kind: "props",
          applied: [{ prop: "$text", value: text, label: "Text" }],
          unparsed: [],
          warnings: [],
          status: "open",
          author: "You",
          source: "editor",
          createdAt: now,
        }
    return { ...d, ops, comments: prev ? d.comments.map((c) => (c.id === commentId ? comment : c)) : [...d.comments, comment] }
  })
}

/** Removes every agent comment on every screen and reverts the edits they made (one undo step). Shared-link comments stay. */
export function deleteAllComments() {
  const s = useTool.getState()
  const ids = new Set(s.comments.filter((c) => c.source !== "viewer").map((c) => c.id))
  if (!ids.size) return
  s.commit((d) => ({ ...d, comments: d.comments.filter((c) => !ids.has(c.id)), ops: d.ops.filter((o) => !(o.commentId && ids.has(o.commentId))) }))
  s.clearSelection()
}

export function toggleResolved(id: string) {
  useTool.getState().commit((d) => ({
    ...d,
    comments: d.comments.map((c) => (c.id === id ? { ...c, status: c.status === "open" ? "resolved" : "open" } : c)),
  }))
}

/* ───────────────────────── variants ───────────────────────── */

function permutations(el: HTMLElement): VariantOption[] {
  const { kind } = elInfo(el)
  const cs = readSnapshot(el, el.dataset.pcRest ?? "default")
  const fs = px(cs["font-size"]) || 14
  const o = (name: string, description: string, style: CssProps): VariantOption => ({ id: uid("v"), kind: "style", name, description, style })
  if (kind === "button")
    return [
      o("Soft tint", "Tinted brand fill, no stroke — quieter than the solid button.", { "background-color": "var(--brand-soft)", color: "#d9480f", "border-color": "transparent", "box-shadow": "none" }),
      o("Pill", "Fully rounded with extra horizontal padding.", { "border-radius": "999px", "padding-left": "16px", "padding-right": "16px" }),
      o("Bold outline", "Transparent fill with a strong 1.5px ink stroke.", { "background-color": "transparent", "border-width": "1.5px", "border-color": "var(--foreground)", color: "var(--foreground)", "box-shadow": "none" }),
      o("Brand solid", "Orbit orange as the primary call to action.", { "background-color": "var(--brand)", "border-color": "#f0581a", color: "#fff" }),
      o("Elevated", "Lifted with a medium shadow.", { "box-shadow": "var(--shadow-m)" }),
      o("Compact", "Smaller height and type for dense toolbars.", { height: "28px", "font-size": "12px", "padding-left": "10px", "padding-right": "10px" }),
    ]
  if (kind === "text")
    return [
      o("Display", "Larger, heavier, tighter — a headline treatment.", { "font-size": `${Math.round(fs * 1.35)}px`, "font-weight": "700", "letter-spacing": "-0.03em" }),
      o("Eyebrow", "Small caps label in muted ink.", { "font-size": "11px", "text-transform": "uppercase", "letter-spacing": "0.08em", color: "var(--muted-foreground)", "font-weight": "600" }),
      o("Accent", "Brand-colored emphasis.", { color: "var(--brand)" }),
      o("Light", "Thinner weight, more air.", { "font-weight": "300", "letter-spacing": "0" }),
      o("Italic", "Editorial italic for softer tone.", { "font-style": "italic" }),
      o("Underlined", "Link-like underline.", { "text-decoration-line": "underline", "text-underline-offset": "4px" }),
    ]
  if (kind === "input")
    return [
      o("Filled", "Muted fill instead of a stroke.", { "background-color": "var(--muted)", "border-color": "transparent", "box-shadow": "none" }),
      o("Underline", "Bottom stroke only.", { "border-width": "0 0 1.5px 0", "border-radius": "0px", "box-shadow": "none", "background-color": "transparent" }),
      o("Pill", "Fully rounded field.", { "border-radius": "999px" }),
      o("Large", "Taller field with bigger type.", { height: "44px", "font-size": "15px" }),
    ]
  return [
    o("Elevated", "Floating card with a soft, larger shadow and no stroke.", { "box-shadow": "var(--shadow-l)", "border-color": "transparent" }),
    o("Tinted", "Warm brand tint to group it visually.", { "background-color": "var(--brand-soft)", "border-color": "#ffd9c7" }),
    o("Ink outline", "Strong outline, larger radius.", { "border-width": "1.5px", "border-color": "var(--foreground)", "border-radius": "16px", "box-shadow": "none" }),
    o("Inverted", "Dark surface for emphasis.", { "background-color": "var(--primary)", color: "var(--primary-foreground)", "border-color": "var(--primary)" }),
    o("Roomy", "More padding and radius.", { padding: "24px", "border-radius": "18px" }),
    o("Flat", "No stroke or shadow, muted fill.", { "background-color": "var(--muted)", "border-color": "transparent", "box-shadow": "none" }),
  ]
}

/** Creates (or regenerates) a variant set for an element, with a short "generating" phase. */
export function createVariants(elId: string, count: number, prompt?: string, anchor?: { x: number; y: number } | null) {
  const s = useTool.getState()
  const el = findEl(elId)
  if (!el) return null
  const slot = el.closest<HTMLElement>("[data-pc-variant-set]")
  const seeded = slot ? s.variantSets.find((v) => v.id === slot.dataset.pcVariantSet) : undefined
  const info = elInfo(el)
  const commentId = uid("c")
  let setId: string

  const comment: Comment | null = prompt
    ? {
        id: commentId,
        number: nextCommentNumber(s.comments),
        screen: s.screen,
        elIds: [elId],
        elNames: [info.name],
        text: prompt,
        states: [el.dataset.pcRest ?? "default"],
        allStates: false,
        kind: "variant",
        applied: [],
        unparsed: [],
        warnings: [],
        status: "open",
        author: "You",
        source: "editor",
        createdAt: Date.now(),
        anchor: anchor ?? undefined,
      }
    : null

  if (seeded) {
    setId = seeded.id
    s.commit((d) => ({
      ...d,
      comments: comment ? [...d.comments, comment] : d.comments,
      variantSets: d.variantSets.map((v) => (v.id === seeded.id ? { ...v, generating: true } : v)),
    }))
  } else {
    const existing = s.variantSets.find((v) => v.elId === elId)
    const options = permutations(el).slice(0, Math.max(1, count))
    const set: VariantSet = existing
      ? { ...existing, options: [...existing.options, ...options], generating: true }
      : {
          id: uid("vs"),
          elId,
          screen: s.screen,
          name: info.name,
          component: info.component,
          options,
          selected: "original",
          createdAt: Date.now(),
          generating: true,
        }
    setId = set.id
    s.commit((d) => ({
      ...d,
      comments: comment ? [...d.comments, comment] : d.comments,
      variantSets: existing ? d.variantSets.map((v) => (v.id === set.id ? set : v)) : [...d.variantSets, set],
    }))
  }

  window.setTimeout(() => {
    useTool.setState((st) => ({ variantSets: st.variantSets.map((v) => (v.id === setId ? { ...v, generating: false } : v)) }))
  }, 1600)
  return setId
}

export function chooseVariant(setId: string, optionId: string) {
  useTool.getState().commit((d) => ({
    ...d,
    variantSets: d.variantSets.map((v) => (v.id === setId ? { ...v, selected: optionId } : v)),
  }))
}

/** Removes one variant from a set (undoable); if it was on screen, the original comes back. */
export function deleteVariantOption(setId: string, optionId: string) {
  useTool.getState().commit((d) => ({
    ...d,
    variantSets: d.variantSets.map((v) =>
      v.id === setId ? { ...v, options: v.options.filter((o) => o.id !== optionId), selected: v.selected === optionId ? "original" : v.selected } : v,
    ),
  }))
}

/** Letter (A, B, C…) for a variant set, in creation order per screen. */
export function letterFor(setId: string, sets: VariantSet[]) {
  const set = sets.find((s) => s.id === setId)
  if (!set) return "?"
  const onScreen = sets.filter((s) => s.screen === set.screen).sort((a, b) => a.createdAt - b.createdAt)
  const i = onScreen.findIndex((s) => s.id === setId)
  return String.fromCharCode(65 + (i % 26))
}
