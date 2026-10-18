import * as React from "react"
import { Copy, Ellipsis, GitPullRequestArrow, Keyboard, MessagesSquare, Moon, MousePointer2, PenTool, RotateCcw, Shapes, Share, Sun, Trash2, Undo2, Workflow } from "@/lib/icons"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuShortcut, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import { deleteAllComments } from "../actions"
import { useShareViewers } from "../share/useShareSync"
import { BAR_H, useTool } from "../store"
import { copyComments } from "../useShortcuts"

/**
 * v2 chrome: a full-width bar fixed to the bottom of the window (the page sits above it).
 * Same tools as the floating toolbar — Proto · State Map (Flow) · Agent comments on the left;
 * Variants · Comments · PR Plan · theme · Share · ⋯ on the right.
 */
export function BottomBar() {
  const mode = useTool((s) => s.mode)
  const toggleMode = useTool((s) => s.toggleMode)
  const theme = useTool((s) => s.theme)
  const comments = useTool((s) => s.comments)
  const sets = useTool((s) => s.variantSets)
  const commentsOpen = useTool((s) => s.commentsOpen)
  const prOpen = useTool((s) => s.prOpen)
  const shareOpen = useTool((s) => s.shareOpen)
  const canUndo = useTool((s) => s.past.length > 0)
  const viewers = useShareViewers()
  const agentOpen = comments.filter((c) => c.source !== "viewer" && c.status === "open").length
  const agentAll = comments.filter((c) => c.source !== "viewer").length
  const sharedOpen = comments.filter((c) => c.source === "viewer" && c.status === "open").length

  return (
    <div
      data-pc-tool
      className="fixed inset-x-0 bottom-0 z-[60] flex items-center justify-between border-t border-border bg-background px-4 text-foreground"
      style={{ height: BAR_H }}
    >
      <div className="flex items-center gap-1">
        <span className="mr-3 flex items-center gap-2 pl-1">
          <img src="/prototypes-logo.png" alt="" draggable={false} className="size-5 select-none object-contain" />
          <span className="text-[15px] font-semibold tracking-[-0.01em]">Proto</span>
        </span>
        <TextTab active={mode === "comment"} label="Agent comments" activeLabel="Annotating" accent="#0088FF" shortcut="A" icon={<MousePointer2 />} onClick={() => toggleMode("comment")} count={mode === "comment" ? 0 : agentOpen} />
        <TextTab active={mode === "variants"} label="Variants" accent="#6155F5" shortcut="V" icon={<Shapes />} onClick={() => toggleMode("variants")} count={sets.length} color="var(--pc-variant)" />
        <TextTab active={mode === "flow"} label="Flow" shortcut="F" icon={<Workflow />} onClick={() => toggleMode("flow")} />
      </div>

      <div className="flex items-center gap-1">
        <TextTab active={commentsOpen} label="Comments" icon={<MessagesSquare />} onClick={() => useTool.getState().setCommentsOpen(!commentsOpen)} count={commentsOpen ? 0 : sharedOpen} />
        <TextTab active={shareOpen} label="Share" shortcut="S" icon={<Share />} onClick={() => useTool.getState().setShareOpen(true)} dot={viewers > 0} />
        <TextTab active={prOpen} label="PR Plan" icon={<GitPullRequestArrow />} onClick={() => useTool.getState().setPrOpen(!prOpen)} />
        <span className="mx-1 h-5 w-px bg-border" />
        <DropdownMenu>
          <Tooltip>
            <TooltipTrigger asChild>
              <DropdownMenuTrigger asChild>
                <button className="grid size-9 place-items-center rounded-lg text-muted-foreground outline-none transition-colors hover:bg-muted hover:text-foreground data-[state=open]:bg-muted data-[state=open]:text-foreground [&_svg]:size-[18px]" aria-label="More">
                  <Ellipsis />
                </button>
              </DropdownMenuTrigger>
            </TooltipTrigger>
            <TooltipContent side="top">More</TooltipContent>
          </Tooltip>
          <DropdownMenuContent side="top" align="end" sideOffset={10} className="z-[70] w-56">
            <DropdownMenuItem onClick={() => useTool.getState().openPaper(useTool.getState().selection.length ? "selection" : "screen")}>
              <PenTool /> Send to Paper / Figma
              <DropdownMenuShortcut>P</DropdownMenuShortcut>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => copyComments()}>
              <Copy /> Copy agent comments
              <DropdownMenuShortcut>C</DropdownMenuShortcut>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={deleteAllComments} disabled={!agentAll} variant="destructive">
              <Trash2 /> Delete all agent comments
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => useTool.getState().undo()} disabled={!canUndo}>
              <Undo2 /> Undo
              <DropdownMenuShortcut>⌘Z</DropdownMenuShortcut>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => useTool.getState().redo()}>
              <Undo2 className="-scale-x-100" /> Redo
              <DropdownMenuShortcut>⇧⌘Z</DropdownMenuShortcut>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => useTool.getState().toggleTheme()}>
              {theme === "light" ? <Moon /> : <Sun />} {theme === "light" ? "Dark chrome" : "Light chrome"}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => useTool.getState().setShortcutsOpen(true)}>
              <Keyboard /> Keyboard shortcuts
              <DropdownMenuShortcut>?</DropdownMenuShortcut>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => window.location.assign("/v1")}>Switch to v1 (floating toolbar)</DropdownMenuItem>
            <DropdownMenuItem variant="destructive" onClick={() => useTool.getState().resetDemo()}>
              <RotateCcw /> Reset demo
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  )
}

function TextTab({
  active,
  label,
  shortcut,
  onClick,
  count,
  color = "var(--pc-comment)",
  icon,
  dot,
  accent = "var(--foreground)",
  activeLabel,
}: {
  active?: boolean
  label: string
  shortcut?: string
  onClick: () => void
  count?: number
  color?: string
  icon?: React.ReactNode
  dot?: boolean
  /** selected fill (white text on it); a mode can also rename itself while on, e.g. "Annotating" */
  accent?: string
  activeLabel?: string
}) {
  const btn = (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "relative flex h-9 items-center gap-2 rounded-lg px-3 text-[14px] transition-colors [&_svg]:size-4",
        active ? "font-medium text-background" : "text-foreground/80 hover:bg-muted/60 hover:text-foreground",
      )}
      style={active ? { background: accent, color: accent === "var(--foreground)" ? "var(--background)" : "#fff" } : undefined}
    >
      {icon && <span className={cn("grid place-items-center", !active && "text-muted-foreground")}>{icon}</span>}
      {active && activeLabel ? activeLabel : label}
      {dot && <span className="absolute left-[22px] top-2 size-1.5 rounded-full bg-emerald-500 outline-2 outline-background" />}
      {!!count && (
        <span
          className="rounded-full px-1.5 text-[11px] font-semibold leading-[18px] tabular-nums"
          style={active ? { background: "#fff", color: accent } : { background: color, color: "#fff" }}
        >
          {count}
        </span>
      )}
    </button>
  )
  if (!shortcut) return btn
  return (
    <Tooltip>
      <TooltipTrigger asChild>{btn}</TooltipTrigger>
      <TooltipContent side="top">
        {label} <kbd className="ml-1 opacity-60">{shortcut}</kbd>
      </TooltipContent>
    </Tooltip>
  )
}
