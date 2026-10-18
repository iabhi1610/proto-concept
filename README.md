# Proto Concept

A demo of a new prototyping tool that sits on top of a live product UI (here, a mock analytics app called Orbit Analytics). It combines Agentation-style element comments, DialKit-style controls and Figma/Paper-like properties.

**Live:** https://proto-concept.iabhi1610.workers.dev (floating toolbar) · [/v2](https://proto-concept.iabhi1610.workers.dev/v2) (bottom bar + docked inspector)

## What's in it

- **Agent comments (A):** hover and click any element, describe a change, and it applies live with a numbered pin. Shift-click to group elements. ↑ ↓ move between layers. Double-click text to edit it in place. **C** copies comments for an agent.
- **Properties:** a Figma/Paper-style inspector (typography, fill, border, layout, flexbox and grid auto layout, radius, shadow) with design-token variables. "Generate custom controls" turns a prompt into DialKit-style sliders.
- **Variants (V):** lettered variant sets with live previews, docked or floating sidebar, and prompts to explore more.
- **Flow (F):** pinch the trackpad, or press F, to zoom out to a map of every screen, Safari tab-overview style.
- **Share (S):** real share links on Cloudflare (Durable Object + WebSockets). Viewers comment, and replies and resolves sync live.
- **Paper / Figma (P):** copy a screen or selection as HTML and PNG.

## Run it

```bash
pnpm install
pnpm dev            # Vite + the Cloudflare Worker locally
pnpm build && npx wrangler deploy
```

### Fonts

The UI is set in **Timeless Sans**. Its license doesn't allow redistributing the font files or putting them in a public repository, so they aren't included here. Download the family from [timeless.co](https://timeless.co) and put the `TimelessSans-Sans*.woff2` files (plus the license PDF) in `public/fonts/`. Without them the app falls back to the system font.

## Stack

Vite, React 19, TypeScript, Tailwind v4, shadcn/ui, Motion, Zustand, Recharts, GitHub Octicons, and Cloudflare Workers + Durable Objects.
