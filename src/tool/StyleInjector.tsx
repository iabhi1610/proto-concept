import * as React from "react"
import { findEl, isAutoId, productRoot } from "./engine/dom"
import { compileCss } from "./engine/styleCompiler"
import { applyTextOverrides } from "./engine/textEdit"
import { useTool } from "./store"

/** Compiles every edit op + chosen style variant into one stylesheet scoped by data-pc-id. */
export function StyleInjector() {
  const ops = useTool((s) => s.ops)
  const comments = useTool((s) => s.comments)
  const variantSets = useTool((s) => s.variantSets)
  const preview = useTool((s) => s.previewOption)
  const screen = useTool((s) => s.screen)
  const css = React.useMemo(() => {
    const sets = preview
      ? variantSets.map((v) => (v.id === preview.setId ? { ...v, selected: preview.optionId } : v))
      : variantSets
    return compileCss(ops, sets)
  }, [ops, variantSets, preview])

  // Auto-id'd nodes lose their attribute when React remounts them (screen switch, list re-render);
  // re-tag every referenced one from its path whenever the product DOM changes.
  React.useEffect(() => {
    const ids = [...new Set([...ops.map((o) => o.elId), ...comments.flatMap((c) => c.elIds), ...variantSets.map((v) => v.elId)])].filter(isAutoId)
    if (!ids.length) return
    let raf = 0
    const retag = () => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => ids.forEach((id) => findEl(id)))
    }
    retag()
    const root = productRoot()
    const mo = root ? new MutationObserver(retag) : null
    if (root) mo!.observe(root, { childList: true, subtree: true })
    return () => {
      cancelAnimationFrame(raf)
      mo?.disconnect()
    }
  }, [ops, comments, variantSets, screen])

  // inline text edits live in the DOM, not the stylesheet; re-apply them whenever React re-renders copy
  React.useEffect(() => {
    let raf = 0
    const apply = () => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => applyTextOverrides(ops))
    }
    applyTextOverrides(ops)
    const root = productRoot()
    const mo = root ? new MutationObserver(apply) : null
    if (root) mo!.observe(root, { childList: true, subtree: true, characterData: true })
    return () => {
      cancelAnimationFrame(raf)
      mo?.disconnect()
    }
  }, [ops, screen])

  return <style data-proto-concept-edits>{css}</style>
}
