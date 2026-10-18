import * as React from "react"
import { FlowMode } from "./modes/FlowMode"
import { PaperFigmaDialog } from "./modes/PaperFigmaDialog"
import { ShareDialog } from "./modes/ShareDialog"
import { VariantsMode } from "./modes/variants/VariantsMode"
import { type Box } from "./overlay/geometry"
import { Highlights } from "./overlay/Highlights"
import { Interaction } from "./overlay/Interaction"
import { CommentPins, VariantPins } from "./overlay/Pins"
import { EditPopover } from "./popover/EditPopover"
import { RaisePRCard, ShortcutsDialog } from "./toolbar/Panels"
import { SharedCommentsSidebar } from "./toolbar/SharedComments"
import { V2 } from "./store"
import { BottomBar } from "./toolbar/BottomBar"
import { PropertiesInspector } from "./properties/PropertiesInspector"
import { Toolbar } from "./toolbar/Toolbar"
import { useShortcuts } from "./useShortcuts"

/**
 * Everything the tool draws over the product. z-order: highlights 39–42 · pins 44 · flow 45 ·
 * popover 48 · side panels 50 · variant search 55 · PR 58 · toolbar 60 · dialogs 70+.
 */
export function ToolLayer() {
  const [marquee, setMarquee] = React.useState<Box | null>(null)
  useShortcuts()
  return (
    <>
      <Interaction onMarquee={setMarquee} />
      <Highlights marquee={marquee} />
      <VariantPins />
      <CommentPins />
      <EditPopover />
      <VariantsMode />
      <SharedCommentsSidebar />
      <FlowMode />
      <RaisePRCard />
      {V2 ? (
        <>
          <PropertiesInspector />
          <BottomBar />
        </>
      ) : (
        <Toolbar />
      )}
      <ShareDialog />
      <PaperFigmaDialog />
      <ShortcutsDialog />
    </>
  )
}
