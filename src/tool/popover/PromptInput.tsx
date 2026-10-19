import * as React from "react"
import { cn } from "@/lib/utils"
import type { VariantIntent } from "../engine/intent"
import { useTool } from "../store"

/**
 * Plain prompt box. Variant requests ("create 3 variants…") get an inline tag on the request
 * ("3 variants"), painted by a mirror layer behind the textarea.
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
          className={cn(
            "pointer-events-none absolute inset-0 overflow-hidden whitespace-pre-wrap break-words p-2 text-[12px] leading-[15px]",
            intent ? "text-foreground" : "text-transparent",
          )}
        >
          {intent ? (
            <>
              {value.slice(0, intent.start)}
              {/* tag: tinted purple with text that keeps ≥ 6:1 contrast on both popover themes */}
              <mark className="rounded-[4px] bg-[#e7e5fe] text-[#4b3fd6] shadow-[0_0_0_2px_#e7e5fe] dark:bg-[#3b3670] dark:text-[#d4d0ff] dark:shadow-[0_0_0_2px_#3b3670]">
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
            // while a tag shows, the mirror paints the text and the textarea only keeps the caret
            intent && "text-transparent caret-foreground",
          )}
        />
      </div>

    </div>
  )
}
