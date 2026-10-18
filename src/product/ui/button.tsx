import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"
import { S, defineComponent, useComponentState } from "../system/define"

export const ButtonDef = defineComponent({
  name: "Button",
  kind: "button",
  description: "Orbit action button",
  states: [S.default, S.hover, S.focused, S.pressed, S.disabled, S.loading],
})

export const IconButtonDef = defineComponent({
  name: "IconButton",
  kind: "button",
  description: "Square icon-only button",
  states: [S.default, S.hover, S.focused, S.pressed, S.disabled],
})

export const buttonVariants = cva(
  [
    "relative inline-flex shrink-0 select-none items-center justify-center gap-1.5 whitespace-nowrap border font-medium outline-none",
    "transition-[background-color,border-color,color,box-shadow,transform,opacity] duration-150 ease-out",
    "st-focused:ring-[3px] st-focused:ring-brand/25 st-focused:border-brand",
    "st-pressed:translate-y-px st-disabled:pointer-events-none st-disabled:opacity-45 st-loading:pointer-events-none",
    "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  ].join(" "),
  {
    variants: {
      variant: {
        primary:
          "border-primary bg-primary text-primary-foreground shadow-[inset_0_1px_0_rgb(255_255_255/0.14),0_1px_2px_rgb(22_23_26/0.24)] st-hover:bg-[#2b2c31] st-pressed:bg-black",
        brand:
          "border-[#f0581a] bg-brand text-brand-foreground shadow-[inset_0_1px_0_rgb(255_255_255/0.22),0_1px_2px_rgb(240_88_26/0.35)] st-hover:bg-[#f45f20] st-pressed:bg-[#e2520f]",
        outline:
          "border-border bg-surface text-foreground shadow-[0_1px_2px_rgb(22_23_26/0.05)] st-hover:border-input st-hover:bg-[#f7f7f5] st-pressed:bg-muted",
        ghost: "border-transparent bg-transparent text-muted-foreground st-hover:bg-muted st-hover:text-foreground st-pressed:bg-[#ececea]",
        subtle: "border-transparent bg-secondary text-foreground st-hover:bg-[#ebebe8] st-pressed:bg-[#e4e4e1]",
        danger:
          "border-[#d93d42] bg-danger text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.18),0_1px_2px_rgb(229_72_77/0.3)] st-hover:bg-[#d93d42]",
      },
      size: {
        sm: "h-7 rounded-[7px] px-2.5 text-[12px] [&_svg:not([class*='size-'])]:size-3.5",
        md: "h-8 rounded-lg px-3 text-[13px]",
        lg: "h-10 rounded-[10px] px-4 text-[14px]",
        icon: "size-8 rounded-lg",
        "icon-sm": "size-7 rounded-[7px] [&_svg:not([class*='size-'])]:size-3.5",
      },
    },
    defaultVariants: { variant: "outline", size: "md" },
  },
)

type ButtonProps = Omit<React.ComponentProps<"button">, "children"> &
  VariantProps<typeof buttonVariants> & {
    pcId?: string
    pcLabel?: string
    loading?: boolean
    children?: React.ReactNode
  }

export function Button({ className, variant, size, pcId, pcLabel, loading, disabled, children, ...props }: ButtonProps) {
  const rest = disabled ? "disabled" : loading ? "loading" : "default"
  const isIcon = size === "icon" || size === "icon-sm"
  const { state, attrs, handlers } = useComponentState(isIcon ? IconButtonDef : ButtonDef, pcId, rest, pcLabel)
  const isLoading = state === "loading"
  return (
    <button
      {...attrs}
      {...handlers}
      disabled={state === "disabled" || undefined}
      aria-busy={isLoading || undefined}
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    >
      <span className={cn("inline-flex items-center gap-1.5", isLoading && "invisible")}>{children}</span>
      {isLoading && (
        <span className="absolute inset-0 grid place-items-center">
          <Spinner />
        </span>
      )}
    </button>
  )
}

export function Spinner({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" className={cn("size-4 animate-spin", className)} fill="none">
      <circle cx="8" cy="8" r="6" stroke="currentColor" strokeOpacity="0.25" strokeWidth="2" />
      <path d="M14 8a6 6 0 0 0-6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}
