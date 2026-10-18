import { findEl } from "../engine/dom"
import { uid, useTool } from "../store"
import type { Comment } from "../types"
import { postComment } from "./client"

/*
 * Conversations on comments left through a share link. Changes are written locally (outside the
 * undo history: they're a conversation, not a design edit) and pushed back to the share room,
 * which re-broadcasts them so the viewer sees replies and resolves live.
 */

function update(id: string, fn: (c: Comment) => Comment) {
  let next: Comment | undefined
  useTool.setState((s) => ({
    comments: s.comments.map((c) => (c.id === id ? (next = fn({ ...c, updatedAt: Date.now() })) : c)),
  }))
  if (next?.shareId) void postComment(next.shareId, next).catch(() => {})
}

export function replyToShared(id: string, text: string, author = "Abhi Kumar") {
  const t = text.trim()
  if (!t) return
  update(id, (c) => ({ ...c, replies: [...(c.replies ?? []), { id: uid("r"), author, text: t, createdAt: Date.now(), owner: true }] }))
}

export function toggleSharedResolved(id: string) {
  update(id, (c) => ({ ...c, status: c.status === "open" ? "resolved" : "open" }))
}

/** Switches to the comment's screen and scrolls its element into view. */
export function jumpToShared(c: Comment) {
  const s = useTool.getState()
  if (s.screen !== c.screen) s.setScreen(c.screen)
  requestAnimationFrame(() => requestAnimationFrame(() => findEl(c.elIds[0])?.scrollIntoView({ behavior: "smooth", block: "center" })))
}

/** Opens an agent prompt on the same element, pre-filled with what the viewer asked for. */
export function sendSharedToAgent(c: Comment) {
  const s = useTool.getState()
  if (s.screen !== c.screen) s.setScreen(c.screen)
  useTool.getState().setMode("comment")
  window.setTimeout(() => {
    const ids = c.elIds.filter((id) => findEl(id))
    if (!ids.length) return
    findEl(ids[0])?.scrollIntoView({ behavior: "smooth", block: "center" })
    useTool.getState().select(ids, c.anchor ?? null)
    useTool.getState().setTab("prompt")
    useTool.setState({ promptDraft: `${c.author.split(" ")[0]} says: ${c.text}` })
  }, 60)
}
