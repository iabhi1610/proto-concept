import * as React from "react"
import { toast } from "sonner"
import { create } from "zustand"
import { screenMeta } from "@/product/screens"
import { nextCommentNumber, useTool } from "../store"
import type { Comment } from "../types"
import { fetchComments, openSocket } from "./client"

/** Live viewer counts per share id (from socket presence). */
export const useShareLive = create<{ viewers: Record<string, number> }>(() => ({ viewers: {} }))

export function useShareViewers(shareId?: string) {
  return useShareLive((s) => (shareId ? (s.viewers[shareId] ?? 0) : Object.values(s.viewers).reduce((a, b) => a + b, 0)))
}

/**
 * Adds viewer comments to the document without touching undo history, and applies newer copies of
 * ones we already have (a reply or resolve from either side). Returns those that were new.
 */
function mergeViewerComments(shareId: string, incoming: Comment[]) {
  const fresh: Comment[] = []
  useTool.setState((s) => {
    let comments = s.comments
    let changed = false
    for (const c of incoming) {
      const have = comments.find((x) => x.id === c.id)
      if (have) {
        if ((c.updatedAt ?? 0) > (have.updatedAt ?? 0)) {
          comments = comments.map((x) => (x.id === c.id ? { ...x, replies: c.replies ?? [], status: c.status ?? x.status, updatedAt: c.updatedAt } : x))
          changed = true
        }
        continue
      }
      const merged: Comment = {
        ...c,
        number: nextCommentNumber(comments, "viewer"),
        source: "viewer",
        shareId,
        author: c.author || "Viewer",
        applied: c.applied ?? [],
        unparsed: c.unparsed ?? [],
        warnings: c.warnings ?? [],
        elIds: c.elIds ?? [],
        elNames: c.elNames ?? [],
        states: c.states ?? ["default"],
        kind: "note",
        status: c.status ?? "open",
      }
      comments = [...comments, merged]
      fresh.push(merged)
    }
    return fresh.length || changed ? { comments } : {}
  })
  return fresh
}

function announce(c: Comment) {
  const firstName = c.author.split(" ")[0]
  let where = ""
  try {
    where = ` on ${screenMeta(c.screen).title}`
  } catch {
    /* unknown screen */
  }
  toast(`${firstName} commented${where}`, {
    description: c.text.length > 90 ? `${c.text.slice(0, 88)}…` : c.text,
    action: {
      label: "View",
      onClick: () => useTool.getState().setCommentsOpen(true),
    },
  })
}

/** Editor side: listen to every share link this prototype created and pull in viewer comments live. */
export function useShareSync() {
  const shareIds = useTool((s) => s.shares.map((x) => x.id).join(","))

  React.useEffect(() => {
    const ids = shareIds ? shareIds.split(",") : []
    const sockets = ids.map((id) => {
      fetchComments(id)
        .then((cs) => mergeViewerComments(id, cs))
        .catch(() => {})
      return openSocket(id, "editor", "Owner", (m) => {
        if (m.type === "presence") useShareLive.setState((s) => ({ viewers: { ...s.viewers, [id]: m.viewers } }))
        if (m.type === "comment") mergeViewerComments(id, [m.comment]).forEach(announce)
      })
    })
    return () => sockets.forEach((s) => s.close())
  }, [shareIds])
}
