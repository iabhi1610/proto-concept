import * as React from "react"
import { motion } from "motion/react"
import { Toaster } from "@/components/ui/sonner"
import { TooltipProvider } from "@/components/ui/tooltip"
import { ProductApp } from "@/product/ProductApp"
import { PRODUCT_ROOT_ID } from "./engine/dom"
import { useShareSync } from "./share/useShareSync"
import { BAR_H, INSPECTOR_W, SIDEBAR_W, useTool, V2 } from "./store"
import { StyleInjector } from "./StyleInjector"
import { ToolLayer } from "./ToolLayer"

export function Editor() {
  const screen = useTool((s) => s.screen)
  const setScreen = useTool((s) => s.setScreen)
  const theme = useTool((s) => s.theme)
  const mode = useTool((s) => s.mode)
  // docked panels take real space: the product reflows beside them instead of under them
  const rightInset = useTool((s) => {
    if ((s.mode === "variants" && !!s.activeSetId && s.variantLayout === "sidebar") || (s.commentsOpen && s.mode !== "flow" && s.commentsLayout === "sidebar"))
      return SIDEBAR_W
    // v2: the Properties inspector is docked for the whole of comment mode (Figma-style)
    if (V2 && s.mode === "comment" && !s.commentsOpen) return INSPECTOR_W
    return 0
  })
  useShareSync()

  React.useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark")
  }, [theme])
  // v2's bottom bar: panels end above it, floating windows keep a gap
  React.useEffect(() => {
    const r = document.documentElement.style
    r.setProperty("--pc-bar", V2 ? `${BAR_H}px` : "0px")
    r.setProperty("--pc-float-bottom", V2 ? `${BAR_H + 12}px` : "76px")
  }, [])
  React.useEffect(() => {
    document.body.classList.remove("pc-mode-comment", "pc-mode-variants", "pc-mode-flow")
    if (mode !== "browse") document.body.classList.add(`pc-mode-${mode}`)
  }, [mode])

  return (
    <TooltipProvider delayDuration={250}>
      <div className="relative h-full w-full overflow-hidden bg-pc-canvas">
        <motion.div
          style={{ height: V2 ? `calc(100% - ${BAR_H}px)` : "100%" }}
          initial={false}
          animate={{ marginRight: rightInset }}
          transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
        >
          <ProductApp id={PRODUCT_ROOT_ID} screen={screen} navigate={setScreen} />
        </motion.div>
        <StyleInjector />
        <ToolLayer />
        <Toaster position="top-right" offset={16} />
      </div>
    </TooltipProvider>
  )
}
