import { toCanvas, toPng } from "html-to-image"

const FILTER = (node: HTMLElement) => !(node instanceof HTMLElement && node.dataset?.pcTool !== undefined)

/** PNG of one or more elements; several elements are stacked vertically on one transparent canvas. */
export async function capturePng(els: HTMLElement[], pixelRatio = 2): Promise<Blob> {
  if (els.length === 1) {
    const url = await toPng(els[0], { pixelRatio, cacheBust: false, filter: FILTER })
    return (await fetch(url)).blob()
  }
  const canvases = await Promise.all(els.map((el) => toCanvas(el, { pixelRatio, filter: FILTER })))
  const gap = 24 * pixelRatio
  const w = Math.max(...canvases.map((c) => c.width))
  const h = canvases.reduce((sum, c) => sum + c.height, 0) + gap * (canvases.length - 1)
  const out = document.createElement("canvas")
  out.width = w
  out.height = h
  const ctx = out.getContext("2d")!
  let y = 0
  for (const c of canvases) {
    ctx.drawImage(c, 0, y)
    y += c.height + gap
  }
  return new Promise((res, rej) => out.toBlob((b) => (b ? res(b) : rej(new Error("Could not encode PNG"))), "image/png"))
}

export async function previewDataUrl(els: HTMLElement[]) {
  const blob = await capturePng(els, 1)
  return URL.createObjectURL(blob)
}

const PROPS = [
  "display",
  "position",
  "top",
  "right",
  "bottom",
  "left",
  "flex-direction",
  "flex-wrap",
  "flex-grow",
  "flex-shrink",
  "flex-basis",
  "align-items",
  "align-self",
  "justify-content",
  "gap",
  "grid-template-columns",
  "grid-template-rows",
  "width",
  "height",
  "min-width",
  "min-height",
  "box-sizing",
  "padding",
  "margin",
  "overflow",
  "font-family",
  "font-size",
  "font-weight",
  "font-style",
  "line-height",
  "letter-spacing",
  "text-align",
  "text-transform",
  "text-decoration-line",
  "white-space",
  "color",
  "background-color",
  "background-image",
  "border-top",
  "border-right",
  "border-bottom",
  "border-left",
  "border-radius",
  "box-shadow",
  "opacity",
  "transform",
  "fill",
  "stroke",
]

/**
 * A self-contained HTML copy of the target: every element carries its computed style inline,
 * which is what design tools read when you paste rich HTML.
 */
export function inlineHtml(els: HTMLElement[]) {
  const parts = els.map((el) => {
    const clone = el.cloneNode(true) as HTMLElement
    const src = [el, ...el.querySelectorAll<HTMLElement>("*")]
    const dst = [clone, ...clone.querySelectorAll<HTMLElement>("*")]
    src.forEach((node, i) => {
      const target = dst[i]
      if (!target) return
      const cs = getComputedStyle(node)
      const decl = PROPS.map((p) => {
        const v = cs.getPropertyValue(p)
        return v && v !== "none" && v !== "normal" && v !== "auto" && v !== "0px" ? `${p}:${v}` : ""
      })
        .filter(Boolean)
        .join(";")
      target.setAttribute("style", decl)
      target.removeAttribute("class")
      for (const a of [...target.attributes]) if (a.name.startsWith("data-") || a.name.startsWith("on")) target.removeAttribute(a.name)
    })
    const r = el.getBoundingClientRect()
    clone.style.width = `${Math.round(r.width)}px`
    clone.style.height = `${Math.round(r.height)}px`
    clone.style.position = "relative"
    return clone.outerHTML
  })
  return `<meta charset="utf-8"><div data-source="proto-concept" style="display:flex;flex-direction:column;gap:24px;font-family:'Timeless Sans',system-ui,sans-serif">${parts.join("")}</div>`
}

/** Writes PNG + HTML to the clipboard. The PNG is passed as a promise so the user gesture is kept. */
export async function copyForDesignTool(els: HTMLElement[]) {
  const html = inlineHtml(els)
  const png = capturePng(els, 2)
  const item = new ClipboardItem({
    "image/png": png,
    "text/html": new Blob([html], { type: "text/html" }),
  })
  await navigator.clipboard.write([item])
}
