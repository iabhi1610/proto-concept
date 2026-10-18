import * as React from "react"
import { toast } from "sonner"
import { buildMarkdown, copyText } from "./copy"
import { useTool, V2 } from "./store"

/**
 * `C`: with a commented element (or an open comment) selected → copy just those;
 * otherwise → copy every open comment across screens.
 */
export async function copyComments() {
  const s = useTool.getState()
  const agent = s.comments.filter((c) => c.source !== "viewer")
  let list = agent.filter((c) => c.status === "open")
  let scope = "all"
  if (s.activeCommentId) {
    list = s.comments.filter((c) => c.id === s.activeCommentId)
    scope = "one"
  } else if (s.selection.length) {
    const mine = agent.filter((c) => c.elIds.some((e) => s.selection.includes(e)))
    if (mine.length) {
      list = mine
      scope = "selection"
    }
  }
  if (!list.length) {
    toast("No comments yet", { description: "Press A, click an element and describe a change." })
    return
  }
  await copyText(buildMarkdown(list))
  toast.success(
    scope === "one" ? `Copied comment #${list[0].number} for the agent` : scope === "selection" ? `Copied ${list.length} comment${list.length > 1 ? "s" : ""} on this selection` : `Copied all ${list.length} comments for the agent`,
    { description: "Paste into Claude Code, Cursor or any agent." },
  )
}

const typing = (t: EventTarget | null) => {
  const el = t as HTMLElement | null
  return !!el && (el.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName))
}

export function useShortcuts() {
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const s = useTool.getState()
      const mod = e.metaKey || e.ctrlKey
      const dialog = s.shareOpen || s.paperOpen || s.shortcutsOpen

      if (mod && e.key.toLowerCase() === "z" && !typing(e.target)) {
        e.preventDefault()
        if (e.shiftKey) s.redo()
        else s.undo()
        return
      }
      if (typing(e.target) || dialog || mod || e.altKey) return

      if (e.key === "Escape") {
        if (s.prOpen) return s.setPrOpen(false)
        if (s.commentsOpen) return s.setCommentsOpen(false)
        if (s.selection.length) return s.clearSelection()
        if (s.activeSetId) return s.openSet(null)
        // nothing left to close: step out of the tool entirely (browse + collapsed toolbar)
        if (V2) return s.mode !== "browse" ? s.setMode("browse") : undefined
        if (!s.toolbarCollapsed) return s.setToolbarCollapsed(true)
        return
      }
      switch (e.key.toLowerCase()) {
        case "a":
          s.toggleMode("comment")
          break
        case "v":
          s.toggleMode("variants")
          break
        case "f":
          s.toggleMode("flow")
          break
        case "s":
          s.setShareOpen(true)
          break
        case "p":
          s.openPaper(s.selection.length ? "selection" : "screen")
          break
        case "c":
          void copyComments()
          break
        case "?":
          s.setShortcutsOpen(true)
          break
        default:
          return
      }
      e.preventDefault()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])
}
