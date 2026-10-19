import { create } from "zustand"
import type { CustomPanel } from "./engine/customControls"
import { createJSONStorage, persist } from "zustand/middleware"
import { SEEDED_VARIANT_SETS } from "@/product/variants/seeds"
import type { Comment, EditOp, Mode, ScreenId, ShareInfo, Snapshot, VariantSet } from "./types"

/** UI version from the URL: /v2 is the bottom-bar layout with a docked Properties inspector; / and /v1 are the floating toolbar. */
export const UI_VERSION: "v1" | "v2" = typeof window !== "undefined" && /^\/v2(\/|$)/.test(window.location.pathname) ? "v2" : "v1"
export const V2 = UI_VERSION === "v2"
/** v2: height of the bottom bar and width of the Properties inspector */
export const BAR_H = 52
export const INSPECTOR_W = 320

/** The share viewer (/s/:id) runs its own, non-persisted copy of the document. */
export const IS_VIEWER = typeof window !== "undefined" && window.location.pathname.startsWith("/s/")

export const uid = (p = "id") => `${p}_${Math.random().toString(36).slice(2, 9)}${Date.now().toString(36).slice(-3)}`

type Tab = "prompt" | "properties"

interface ToolState {
  /* navigation */
  screen: ScreenId
  setScreen: (s: ScreenId) => void

  /* modes */
  mode: Mode
  setMode: (m: Mode) => void
  toggleMode: (m: Mode) => void
  /** collapsed toolbar = the tool steps away and the product behaves like the normal app */
  toolbarCollapsed: boolean
  /** text to drop into the prompt box next time it opens (e.g. "Iterate over B1 …") */
  promptDraft: string | null
  /** "Generate custom" panels per element (newest first), saved with the project */
  customPanels: Record<string, CustomPanel[]>
  addCustomPanel: (elId: string, p: CustomPanel) => void
  setCustomValue: (elId: string, panelId: string, controlId: string, value: number | boolean | string) => void
  removeCustomPanel: (elId: string, panelId: string) => void
  /** the Generate custom prompt is open (Properties sections fold away while it is) */
  composerOpen: boolean
  setComposerOpen: (v: boolean) => void
  setToolbarCollapsed: (v: boolean) => void
  theme: "light" | "dark"
  toggleTheme: () => void
  /** variants panel: docked sidebar (pushes the product) or floating window */
  variantLayout: "sidebar" | "floating"
  /** shared-comments panel: docked sidebar or floating window */
  commentsLayout: "sidebar" | "floating"
  setCommentsLayout: (v: "sidebar" | "floating") => void
  setVariantLayout: (v: "sidebar" | "floating") => void

  /* selection (Agent Comment mode) */
  hoverId: string | null
  setHover: (id: string | null) => void
  selection: string[]
  /** click point inside the primary element, fractions */
  anchor: { x: number; y: number } | null
  select: (ids: string[], anchor?: { x: number; y: number } | null) => void
  clearSelection: () => void
  /** comment currently being viewed / edited through its pin */
  activeCommentId: string | null
  openComment: (id: string | null) => void

  /** forced state per element id (state dropdown) */
  forced: Record<string, string>
  setForced: (elId: string, state: string | null) => void
  applyAll: boolean
  setApplyAll: (v: boolean) => void
  tab: Tab
  setTab: (t: Tab) => void
  /** comment that Properties edits are being collected into for the current selection */
  propsCommentId: string | null

  /* document (undoable) */
  ops: EditOp[]
  comments: Comment[]
  variantSets: VariantSet[]
  past: Snapshot[]
  future: Snapshot[]
  /** run a mutation as one undoable step */
  commit: (fn: (draft: Snapshot) => Snapshot, opts?: { coalesceKey?: string }) => void
  lastCoalesceKey: string | null
  lastCoalesceAt: number
  undo: () => void
  redo: () => void

  /* variants */
  activeSetId: string | null
  openSet: (id: string | null) => void
  previewOption: { setId: string; optionId: string } | null
  setPreviewOption: (p: { setId: string; optionId: string } | null) => void

  /* panels / dialogs */
  commentsOpen: boolean
  setCommentsOpen: (v: boolean) => void
  shareOpen: boolean
  setShareOpen: (v: boolean) => void
  paperOpen: boolean
  paperScope: "selection" | "screen"
  openPaper: (scope: "selection" | "screen") => void
  closePaper: () => void
  prOpen: boolean
  setPrOpen: (v: boolean) => void
  shortcutsOpen: boolean
  setShortcutsOpen: (v: boolean) => void

  /* share */
  shares: ShareInfo[]
  addShare: (s: ShareInfo) => void
  viewerName: string

  resetDemo: () => void
}

const initialDoc = (): Snapshot => ({
  ops: [],
  comments: [],
  variantSets: SEEDED_VARIANT_SETS.map((s) => ({ ...s, options: [...s.options] })),
})

export const useTool = create<ToolState>()(
  persist(
    (set, get) => ({
      screen: "overview",
      setScreen: (screen) =>
        set({ screen, selection: [], hoverId: null, forced: {}, activeCommentId: null, activeSetId: null, propsCommentId: null }),

      // visitors land with Agent comments picked (the share viewer sets its own mode)
      mode: "comment",
      setMode: (mode) =>
        set({
          mode,
          selection: [],
          hoverId: null,
          forced: {},
          activeCommentId: null,
          propsCommentId: null,
          activeSetId: mode === "variants" ? get().activeSetId : null,
          // picking a tool (A, V, F…) brings a collapsed toolbar back
          ...(mode !== "browse" ? { toolbarCollapsed: false } : {}),
        }),
      toggleMode: (m) => get().setMode(get().mode === m ? "browse" : m),
      toolbarCollapsed: false,
      promptDraft: null,
      customPanels: {},
      addCustomPanel: (elId, p) => set({ customPanels: { ...get().customPanels, [elId]: [p, ...(get().customPanels[elId] ?? [])] } }),
      setCustomValue: (elId, panelId, controlId, value) =>
        set({
          customPanels: {
            ...get().customPanels,
            [elId]: (get().customPanels[elId] ?? []).map((p) =>
              p.id !== panelId ? p : { ...p, controls: p.controls.map((c) => (c.id === controlId ? ({ ...c, value } as typeof c) : c)) },
            ),
          },
        }),
      removeCustomPanel: (elId, panelId) =>
        set({ customPanels: { ...get().customPanels, [elId]: (get().customPanels[elId] ?? []).filter((p) => p.id !== panelId) } }),
      composerOpen: false,
      setComposerOpen: (composerOpen) => set({ composerOpen }),
      setToolbarCollapsed: (v) => {
        if (!v) return set({ toolbarCollapsed: false })
        get().setMode("browse")
        set({ toolbarCollapsed: true, commentsOpen: false, prOpen: false, activeSetId: null, previewOption: null })
      },
      theme: "light",
      toggleTheme: () => set({ theme: get().theme === "light" ? "dark" : "light" }),
      variantLayout: "sidebar",
      commentsLayout: "sidebar",
      setCommentsLayout: (commentsLayout) => set({ commentsLayout }),
      setVariantLayout: (variantLayout) => set({ variantLayout }),

      hoverId: null,
      setHover: (hoverId) => {
        if (get().hoverId !== hoverId) set({ hoverId })
      },
      selection: [],
      anchor: null,
      select: (ids, anchor = null) => {
        const prev = get().selection
        const same = prev.length === ids.length && prev.every((p, i) => p === ids[i])
        if (same) return
        // forced states belong to the previous selection only
        const forced: Record<string, string> = {}
        for (const id of ids) if (get().forced[id]) forced[id] = get().forced[id]
        const keepComment = get().activeCommentId
          ? get().comments.find((c) => c.id === get().activeCommentId)?.elIds.some((e) => ids.includes(e))
          : false
        // one comment per place: selecting exactly what a comment covers opens it
        const existing = keepComment
          ? null
          : [...get().comments].reverse().find((c) => c.kind !== "variant" && c.source !== "viewer" && c.elIds.length === ids.length && c.elIds.every((e) => ids.includes(e)))
        set({
          selection: ids,
          anchor,
          forced,
          applyAll: ids.length > 0 && prev.length > 0 && ids[0] === prev[0] ? get().applyAll : false,
          activeCommentId: keepComment ? get().activeCommentId : (existing?.id ?? null),
          propsCommentId: null,
          composerOpen: false,
        })
      },
      clearSelection: () =>
        set({ selection: [], forced: {}, applyAll: false, activeCommentId: null, propsCommentId: null, anchor: null }),
      activeCommentId: null,
      openComment: (id) => {
        if (!id) return set({ activeCommentId: null })
        const c = get().comments.find((x) => x.id === id)
        if (!c) return
        set({
          activeCommentId: id,
          selection: c.elIds,
          anchor: c.anchor ?? null,
          forced: {},
          applyAll: false,
          propsCommentId: null,
        })
      },

      forced: {},
      setForced: (elId, state) => {
        const forced = { ...get().forced }
        if (state) forced[elId] = state
        else delete forced[elId]
        set({ forced })
      },
      applyAll: false,
      setApplyAll: (applyAll) => set({ applyAll }),
      tab: "prompt",
      setTab: (tab) => set({ tab }),
      propsCommentId: null,

      ...initialDoc(),
      past: [],
      future: [],
      lastCoalesceKey: null,
      lastCoalesceAt: 0,
      commit: (fn, opts) => {
        const s = get()
        const before: Snapshot = { ops: s.ops, comments: s.comments, variantSets: s.variantSets }
        const after = fn(before)
        const now = Date.now()
        const coalesce = !!opts?.coalesceKey && opts.coalesceKey === s.lastCoalesceKey && now - s.lastCoalesceAt < 900
        set({
          ...after,
          past: coalesce ? s.past : [...s.past.slice(-80), before],
          future: [],
          lastCoalesceKey: opts?.coalesceKey ?? null,
          lastCoalesceAt: now,
        })
      },
      undo: () => {
        const s = get()
        const prev = s.past[s.past.length - 1]
        if (!prev) return
        set({
          ...prev,
          past: s.past.slice(0, -1),
          future: [{ ops: s.ops, comments: s.comments, variantSets: s.variantSets }, ...s.future],
          lastCoalesceKey: null,
          propsCommentId: null,
        })
      },
      redo: () => {
        const s = get()
        const next = s.future[0]
        if (!next) return
        set({
          ...next,
          future: s.future.slice(1),
          past: [...s.past, { ops: s.ops, comments: s.comments, variantSets: s.variantSets }],
          lastCoalesceKey: null,
        })
      },

      activeSetId: null,
      openSet: (activeSetId) => set(activeSetId ? { activeSetId, commentsOpen: false } : { activeSetId }),
      previewOption: null,
      setPreviewOption: (previewOption) => set({ previewOption }),

      commentsOpen: false,
      setCommentsOpen: (commentsOpen) => set(commentsOpen ? { commentsOpen, activeSetId: null } : { commentsOpen }),
      shareOpen: false,
      setShareOpen: (shareOpen) => set({ shareOpen }),
      paperOpen: false,
      paperScope: "screen",
      openPaper: (paperScope) => set({ paperOpen: true, paperScope }),
      closePaper: () => set({ paperOpen: false }),
      prOpen: false,
      setPrOpen: (prOpen) => set({ prOpen }),
      shortcutsOpen: false,
      setShortcutsOpen: (shortcutsOpen) => set({ shortcutsOpen }),

      shares: [],
      addShare: (s) => set({ shares: [s, ...get().shares] }),
      viewerName: "",

      resetDemo: () =>
        set({
          ...initialDoc(),
          past: [],
          future: [],
          selection: [],
          forced: {},
          mode: "comment",
          screen: "overview",
          activeCommentId: null,
          activeSetId: null,
          propsCommentId: null,
          commentsOpen: false,
        }),
    }),
    {
      name: IS_VIEWER ? "proto-concept-viewer" : "proto-concept",
      storage: createJSONStorage(() => (IS_VIEWER ? sessionStorage : localStorage)),
      version: 1,
      partialize: (s) => ({
        screen: s.screen,
        theme: s.theme,
        variantLayout: s.variantLayout,
        commentsLayout: s.commentsLayout,
        customPanels: s.customPanels,
        ops: s.ops,
        comments: s.comments,
        variantSets: s.variantSets.map((v) => ({ ...v, generating: false })),
        shares: s.shares,
      }),
    },
  ),
)

/* ───────── selectors / helpers ───────── */

/** width of the docked variants sidebar (the product reflows by this much) */
export const SIDEBAR_W = 392

/** agent comments and shared-link comments are numbered separately */
export const nextCommentNumber = (comments: Comment[], source: Comment["source"] = "editor") =>
  comments.filter((c) => c.source === source).reduce((m, c) => Math.max(m, c.number), 0) + 1

export function useVariantChoice(elId: string): string {
  return useTool((s) => {
    const set = s.variantSets.find((v) => v.elId === elId)
    if (!set) return "original"
    if (s.previewOption && s.previewOption.setId === set.id) return s.previewOption.optionId
    return set.selected
  })
}

// handy for demos / headless verification
if (typeof window !== "undefined") (window as unknown as { __pcStore: typeof useTool }).__pcStore = useTool
