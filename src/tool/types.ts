export type ScreenId = "signin" | "overview" | "events" | "funnels" | "retention" | "settings"

export type Mode = "browse" | "comment" | "variants" | "flow"

/** kebab-case CSS property → value */
export type CssProps = Record<string, string>

export interface EditOp {
  id: string
  elId: string
  /** state id ("default", "hover", …) */
  state: string
  props: CssProps
  source: "prompt" | "props"
  commentId?: string
  at: number
}

export interface AppliedChange {
  prop: string
  value: string
  label: string
}

export interface Warning {
  elId: string
  state: string
  text: string
}

export interface Comment {
  id: string
  number: number
  screen: ScreenId
  elIds: string[]
  elNames: string[]
  text: string
  /** state ids the change was applied to */
  states: string[]
  allStates: boolean
  kind: "edit" | "variant" | "props" | "note"
  applied: AppliedChange[]
  unparsed: string[]
  warnings: Warning[]
  status: "open" | "resolved"
  author: string
  source: "editor" | "viewer"
  createdAt: number
  /** click point inside the first element, as fractions of its box */
  anchor?: { x: number; y: number }
  shareId?: string
  /** shared-link conversation: replies from the owner and viewers */
  replies?: Reply[]
  /** last change (reply / resolve); the newer copy wins when both sides sync */
  updatedAt?: number
}

export interface Reply {
  id: string
  author: string
  text: string
  createdAt: number
  /** written by the prototype's owner (from the editor) */
  owner?: boolean
}

export interface VariantOption {
  id: string
  name: string
  description: string
  /** seeded options render real alternate markup; style options are CSS permutations */
  kind: "seed" | "style"
  style?: CssProps
}

export interface VariantSet {
  id: string
  elId: string
  screen: ScreenId
  name: string
  component: string
  options: VariantOption[]
  /** "original" or an option id */
  selected: string
  createdAt: number
  generating?: boolean
  seeded?: boolean
}

export interface ShareConfig {
  access: "link" | "invite"
  role: "view" | "comment"
  password: string
  expiresAt: string | null
  variantSets: string[]
  invited: string[]
  message: string
}

export interface ShareInfo {
  id: string
  url: string
  createdAt: number
  config: ShareConfig
}

export interface Snapshot {
  ops: EditOp[]
  comments: Comment[]
  variantSets: VariantSet[]
}
