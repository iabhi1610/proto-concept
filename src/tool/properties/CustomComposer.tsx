import * as React from "react"
import { Plus, Sparkles } from "@/lib/icons"
import { applyProps, statesFor } from "../actions"
import { generatePanel, panelProps } from "../engine/customControls"
import { useTool } from "../store"

/** The AI sparkle, filled with a blue gradient. */
export function AiSparkle({ className }: { className?: string }) {
  const id = React.useId()
  return (
    <span className={className}>
      <svg width="0" height="0" className="absolute" aria-hidden>
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#0066FF" />
            <stop offset="100%" stopColor="#4FD8FF" />
          </linearGradient>
        </defs>
      </svg>
      <Sparkles style={{ fill: `url(#${id})` }} />
    </span>
  )
}

/**
 * "Generate custom controls": the last row of Properties, laid out like the other "+" rows. It opens
 * into a prompt in place; the idea becomes a saved panel of DialKit-style controls just above it.
 */
export function CustomComposer() {
  const open = useTool((s) => s.composerOpen)
  const setOpen = useTool((s) => s.setComposerOpen)
  const [text, setText] = React.useState("")
  const ref = React.useRef<HTMLTextAreaElement>(null)
  React.useEffect(() => {
    if (!open) return setText("")
    requestAnimationFrame(() => {
      ref.current?.focus()
      ref.current?.scrollIntoView({ block: "nearest", behavior: "smooth" })
    })
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
    <div className="border-t border-border first:border-t-0">
      {!open ? (
        <button
          onClick={() => setOpen(true)}
          title="Describe a feel (e.g. “springy hover lift”) and get DialKit-style controls for it"
          className="group/add flex h-10 w-full items-center justify-between px-3 text-[12px] text-muted-foreground transition-colors hover:text-foreground"
        >
          <span className="flex items-center gap-1.5">
            <AiSparkle className="grid [&_svg]:size-3.5" />
            Generate custom controls
          </span>
          <span className="-mr-1 grid size-7 place-items-center rounded-lg transition-colors group-hover/add:bg-muted [&_svg]:size-3.5">
            <Plus />
          </span>
        </button>
      ) : (
        <div className="flex flex-col gap-2.5 px-3 py-3">
          <span className="flex items-center gap-1.5 text-[12px] font-medium text-foreground">
            <AiSparkle className="grid [&_svg]:size-3.5" />
            Generate custom controls
          </span>
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
