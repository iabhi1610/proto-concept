import * as React from "react"
import { cn } from "@/lib/utils"
import type { ScreenId } from "@/tool/types"
import { screenMeta } from "./screens"
import { ProductContext } from "./shell"

/**
 * Renders one Orbit screen. The live product (`preview={false}`) is the only instance that
 * emits data-pc-id attributes; scaled previews (flow map, thumbnails) pass `preview`.
 */
export function ProductApp({
  screen,
  navigate,
  preview = false,
  className,
  style,
  id,
}: {
  screen: ScreenId
  navigate?: (s: ScreenId) => void
  preview?: boolean
  className?: string
  style?: React.CSSProperties
  id?: string
}) {
  const ctx = React.useMemo(() => ({ screen, navigate: navigate ?? (() => {}), preview }), [screen, navigate, preview])
  const { Component } = screenMeta(screen)
  return (
    <ProductContext.Provider value={ctx}>
      <div id={id} className={cn("orbit-app h-full w-full", className)} style={style}>
        <Component />
      </div>
    </ProductContext.Provider>
  )
}
