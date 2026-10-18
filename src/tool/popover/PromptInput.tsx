import * as React from "react"
import { AnimatePresence, motion } from "motion/react"
import { Sparkles } from "@/lib/icons"
import { cn } from "@/lib/utils"
import type { VariantIntent } from "../engine/intent"
import { useTool } from "../store"

/**
 * Plain prompt box. Variant requests ("create 3 variants…") get an iMessage-style inline
 * highlight, rendered by a mirror layer behind a transparent textarea.
 */
export function PromptInput({
  value,
  onChange,
  onSubmit,
  intent,
  componentName,
  inputRef,
  autoFocus,
  placeholder = "Describe a change, or ask for variants",
}: {
  value: string
  onChange: (v: string) => void
  onSubmit: () => void
  intent: VariantIntent | null
  componentName: string
  inputRef: React.RefObject<HTMLTextAreaElement | null>
  autoFocus?: boolean
  placeholder?: string
}) {
  const mirror = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    if (autoFocus) requestAnimationFrame(() => inputRef.current?.focus())
  }, [autoFocus, inputRef])

  return (
    <div className="flex flex-col gap-2">
      <div className="relative rounded-lg border border-[var(--pc-field-border)] bg-[var(--pc-field)] transition-[border-color,box-shadow] duration-150 focus-within:border-[var(--pc-comment)] focus-within:shadow-[0_0_0_0.5px_var(--pc-comment)]">
        {/* mirror: same metrics as the textarea, paints the intent highlight */}
        <div
          ref={mirror}
          aria-hidden
          className="pointer-events-none absolute inset-0 overflow-hidden whitespace-pre-wrap break-words p-2 text-[12px] leading-[15px] text-transparent"
        >
          {intent ? (
            <>
              {value.slice(0, intent.start)}
              <mark className="rounded-[5px] bg-[color-mix(in_oklab,var(--pc-variant),transparent_80%)] text-transparent shadow-[0_0_0_2px_color-mix(in_oklab,var(--pc-variant),transparent_80%)]">
                {value.slice(intent.start, intent.end)}
              </mark>
              {value.slice(intent.end)}
            </>
          ) : (
            value
          )}
        </div>
        <textarea
          ref={inputRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onScroll={(e) => mirror.current && (mirror.current.scrollTop = e.currentTarget.scrollTop)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault()
              onSubmit()
            }
            if (e.key === "Escape") {
              e.currentTarget.blur()
              useTool.getState().clearSelection()
            }
          }}
          placeholder={placeholder}
          className={cn(
            "relative block h-[84px] w-full resize-none bg-transparent p-2 text-[12px] leading-[15px] text-foreground outline-none placeholder:text-[var(--pc-placeholder)]",
            intent && "caret-[var(--pc-variant)]",
          )}
        />
      </div>

      <AnimatePresence initial={false}>
        {intent && (
          <motion.button
            type="button"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ type: "spring", stiffness: 420, damping: 34 }}
            onClick={onSubmit}
            className="flex items-center gap-2 overflow-hidden rounded-xl bg-[color-mix(in_oklab,var(--pc-variant),transparent_92%)] px-2.5 py-1.5 text-left text-[12px] text-foreground"
          >
            <Sparkles className="size-3.5 text-[var(--pc-variant)]" />
            <span className="flex-1">
              Create <b className="font-semibold">{intent.count} variant{intent.count > 1 ? "s" : ""}</b> of {componentName}
            </span>
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  )
}
