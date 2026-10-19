import * as React from "react"
import { Sparkles } from "@/lib/icons"
import { applyProps, statesFor } from "../actions"
import { generatePanel, panelProps } from "../engine/customControls"
import { useTool } from "../store"

/**
 * "Generate custom controls": a small outlined button pinned to the top of Properties. It opens into a
 * prompt in place; the idea becomes a saved panel of DialKit-style controls right below it.
 */
export function CustomComposer() {
  const open = useTool((s) => s.composerOpen)
  const setOpen = useTool((s) => s.setComposerOpen)
  const [text, setText] = React.useState("")
  const ref = React.useRef<HTMLTextAreaElement>(null)
  React.useEffect(() => {
    if (open) requestAnimationFrame(() => ref.current?.focus())
    else setText("")
  }, [open])

  const generate = () => {
    const prompt = text.trim()
    if (!prompt) return
    const st = useTool.getState()
    const elId = st.selection[0]
    const panel = generatePanel(prompt, statesFor([elId]).map((x) => x.id))
    st.addCustomPanel(elId, panel)
    // show the state the controls edit (e.g. Hover), then write their starting values
    if (panel.state !== "default") st.setForced(elId, panel.state)
    applyProps(panelProps(panel), [], { state: panel.state })
    setOpen(false)
  }

  return (
    // pinned to the top of the scrolling panel so it's always reachable
    <div className="sticky top-0 z-10 border-b border-border bg-popover px-3 py-2">
      {!open ? (
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setOpen(true)}
            className="flex h-7 items-center gap-1.5 rounded-full px-3 text-[12px] font-medium text-foreground/85 shadow-[inset_0_0_0_1px_var(--pc-field-border)] transition-[background-color,color,transform] duration-150 hover:bg-muted hover:text-foreground active:scale-[0.97] [&_svg]:size-3.5"
          >
            <Sparkles /> Generate custom controls
          </button>
          <span
            title="Describe a feel (e.g. “springy hover lift”) and get DialKit-style controls for it"
            className="grid size-5 cursor-help place-items-center rounded-full text-[11px] font-semibold text-muted-foreground"
          >
            ?
          </span>
        </div>
      ) : (
        <div className="flex flex-col gap-2.5 py-1">
          <textarea
            ref={ref}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              e.stopPropagation()
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) (e.preventDefault(), generate())
              if (e.key === "Escape") setOpen(false)
            }}
            placeholder="Describe the controls you want, e.g. springy hover lift with a soft glow"
            className="h-[72px] w-full resize-none rounded-lg border border-[var(--pc-field-border)] bg-[var(--pc-field)] p-2 text-[12px] leading-[15px] text-foreground outline-none transition-[border-color,box-shadow] placeholder:text-[var(--pc-placeholder)] focus:border-[var(--pc-comment)] focus:shadow-[0_0_0_0.5px_var(--pc-comment)]"
          />
          <div className="flex items-center justify-end gap-1.5">
            <button
              onClick={() => setOpen(false)}
              className="h-6 rounded-full bg-muted px-3 text-[12px] font-medium text-foreground/80 transition-colors hover:bg-[var(--pc-pill)]"
            >
              Cancel
            </button>
            <button
              onClick={generate}
              disabled={!text.trim()}
              className="flex h-6 items-center gap-1 rounded-full bg-[var(--pc-comment)] px-3.5 text-[12px] font-medium text-white transition-opacity disabled:opacity-45 [&_svg]:size-3"
            >
              <Sparkles /> Generate
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
