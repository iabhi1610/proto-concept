import { getComponentDef } from "@/product/system/define"
import { screenMeta } from "@/product/screens"
import { elInfo, findEl, selectorFor } from "./engine/dom"
import { foldOps } from "./engine/styleCompiler"
import { useTool } from "./store"
import type { Comment } from "./types"

const stateLabel = (component: string | undefined, id: string) =>
  getComponentDef(component)?.states.find((s) => s.id === id)?.label ?? id[0].toUpperCase() + id.slice(1)

function commentBlock(c: Comment) {
  const s = useTool.getState()
  const lines: string[] = []
  const el = findEl(c.elIds[0])
  const component = el?.dataset.pcComponent
  const title = c.elNames.length > 1 ? `${c.elNames.length} elements: ${c.elNames.join(", ")}` : c.elNames[0]
  lines.push(`### ${c.number}. ${title}${c.source === "viewer" ? ` — from ${c.author} (share viewer)` : ""}`)
  lines.push(`- **Screen:** ${screenMeta(c.screen).title} (\`${screenMeta(c.screen).path}\`)`)
  for (const id of c.elIds) {
    const node = findEl(id)
    lines.push(`- **Target:** \`${node ? selectorFor(node).attr : `[data-pc-id="${id}"]`}\`${node ? ` · \`${selectorFor(node).css}\`` : ""}`)
  }
  if (c.kind !== "note" || c.states.length) {
    const st = c.allStates
      ? `All states (${(getComponentDef(component)?.states ?? []).map((x) => x.label).join(", ")})`
      : c.states.map((x) => stateLabel(component, x)).join(", ")
    lines.push(`- **State:** ${st}`)
  }
  const kind = c.kind === "variant" ? "Create variants" : c.kind === "props" ? "Direct property edits" : "Change request"
  lines.push(`- **${kind}:** “${c.text}”`)

  const mine = s.ops.filter((o) => o.commentId === c.id)
  if (mine.length) {
    lines.push(`- **Already applied in the prototype** (implement this in code):`)
    lines.push("```css")
    for (const [elId, byState] of foldOps(mine)) {
      for (const [state, props] of byState) {
        lines.push(`[data-pc-id="${elId}"]${state === "default" ? "" : `[data-state="${state}"]`} {`)
        for (const [k, v] of Object.entries(props)) lines.push(k === "$text" ? `  text: ${JSON.stringify(v)}` : `  ${k}: ${v};`)
        lines.push("}")
      }
    }
    lines.push("```")
  }
  if (c.unparsed.length) lines.push(`- **Needs the agent:** ${c.unparsed.map((u) => `“${u}”`).join(", ")} (not applied by the prototype)`)
  if (c.kind === "variant") {
    const set = s.variantSets.find((v) => v.elId === c.elIds[0] || c.elIds[0].startsWith(v.elId))
    if (set) lines.push(`- **Variants explored:** ${set.options.map((o) => o.name).join(" · ")} (chosen: ${set.options.find((o) => o.id === set.selected)?.name ?? "Original"})`)
  }
  for (const w of c.warnings) lines.push(`- ⚠️ **${stateLabel(component, w.state)}:** ${w.text}`)
  if (c.status === "resolved") lines.push(`- ✅ Resolved`)
  return lines.join("\n")
}

export function buildMarkdown(comments: Comment[]) {
  const s = useTool.getState()
  const screens = [...new Set(comments.map((c) => screenMeta(c.screen).title))]
  const head = [
    `## Proto Concept → agent feedback (${comments.length} ${comments.length === 1 ? "item" : "items"})`,
    `Product: **Orbit Analytics** · Screens: ${screens.join(", ")}`,
    `Elements are tagged with \`data-pc-id\`. States map to \`data-pc-state\`.`,
    "",
  ]
  const chosen = s.variantSets.filter((v) => v.selected !== "original")
  const tail = chosen.length
    ? [
        "",
        "### Variant choices",
        ...chosen.map((v) => `- ${v.name}: **${v.options.find((o) => o.id === v.selected)?.name}** — ${v.options.find((o) => o.id === v.selected)?.description}`),
      ]
    : []
  return [...head, comments.map(commentBlock).join("\n\n"), ...tail].join("\n")
}

/** Every edit made to these elements (prompt + Properties + text), as one agent-ready block. */
export function buildElementMarkdown(elIds: string[]) {
  const s = useTool.getState()
  const mine = s.ops.filter((o) => elIds.includes(o.elId))
  const lines: string[] = [`## Proto Concept → agent: property changes`, `Screen: **${screenMeta(s.screen).title}** (\`${screenMeta(s.screen).path}\`)`, ""]
  for (const [elId, byState] of foldOps(mine)) {
    const node = findEl(elId)
    const component = node?.dataset.pcComponent
    lines.push(`### ${node ? (node.dataset.pcLabel || component || elId) : elId}`)
    lines.push(`- **Target:** \`${node ? selectorFor(node).attr : `[data-pc-id="${elId}"]`}\`${node ? ` · \`${selectorFor(node).css}\`` : ""}`)
    lines.push("```css")
    for (const [state, props] of byState) {
      lines.push(`${state === "default" ? "/* Default */" : `/* ${stateLabel(component, state)} */`}`)
      lines.push(`[data-pc-id="${elId}"]${state === "default" ? "" : `[data-state="${state}"]`} {`)
      for (const [k, v] of Object.entries(props)) lines.push(k === "$text" ? `  /* text */ content: ${JSON.stringify(v)};` : `  ${k}: ${v};`)
      lines.push("}")
    }
    lines.push("```", "")
  }
  lines.push("Apply these to the component's source styles (they're already live in the prototype).")
  return lines.join("\n")
}

/** Agent request for new variants of an element, from what the designer typed. */
export function buildVariantsPrompt(elId: string, request: string, count: number) {
  const s = useTool.getState()
  const node = findEl(elId)
  const set = s.variantSets.find((v) => v.elId === elId)
  const name = set?.name ?? (node ? elInfo(node).label || elInfo(node).name : elId)
  const component = set?.component ?? node?.dataset.pcComponent ?? "element"
  const lines = [
    `Create ${count} variant${count === 1 ? "" : "s"} of "${name}" (${component}) on the ${screenMeta(s.screen).title} screen (\`${screenMeta(s.screen).path}\`).`,
    `- **Target:** \`${node ? selectorFor(node).attr : `[data-pc-id="${elId}"]`}\`${node ? ` · \`${selectorFor(node).css}\`` : ""}`,
  ]
  if (request.trim()) lines.push(`- **Direction:** ${request.trim()}`)
  if (set?.options.length) lines.push(`- **Already explored:** ${set.options.map((o) => o.name).join(" · ")} (don't repeat these)`)
  lines.push("- Keep the original as option 0 and make the variants switchable so the designer can compare them in place.")
  return lines.join("\n")
}

export async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    const ta = document.createElement("textarea")
    ta.value = text
    ta.style.position = "fixed"
    ta.style.opacity = "0"
    document.body.appendChild(ta)
    ta.select()
    const ok = document.execCommand("copy")
    ta.remove()
    return ok
  }
}
