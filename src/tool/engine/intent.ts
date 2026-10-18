/** Detects "create variants…"-style requests so the prompt can switch into variant generation. */

const WORD_NUMS: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, couple: 2, few: 3, some: 3, several: 4 }

/** a number, a word number, or a range of them: "3", "three", "3-4", "3 – 4", "3 to 4", "3 or 4", "three to four" */
const N = String.raw`(?:\d+|one|two|three|four|five|six)`
const COUNT = String.raw`${N}(?:\s*(?:-|–|—|to|or)\s*${N})?`
const NOUN = String.raw`(?:variants?|variations?|iterations?|alternatives?|versions?|options?|directions?|takes?|explorations?)`
const FILLER = String.raw`(?:me|us|a|an|the|some|more|few|couple of|a few|a couple of|${COUNT}|several|different|new|alternative|other|quick|more)`

const RE = new RegExp(
  String.raw`\b(?:create|make|generate|give me|show me|explore|try|design|draft|spin up|come up with|suggest|need|want)\b(?:\s+${FILLER}){0,4}\s+${NOUN}\b`,
  "i",
)
/** no verb needed when a count leads: "3-4 variants of this", "4 versions" */
const COUNTED = new RegExp(String.raw`\b${COUNT}\s+(?:\w+\s+)?${NOUN}\b`, "i")
const SHORT = /\b(?:variants?|variations?|iterations?|alternatives?)\s+(?:of|for)\b/i

export interface VariantIntent {
  start: number
  end: number
  count: number
  phrase: string
}

const toNum = (s: string) => (/^\d+$/.test(s) ? parseInt(s, 10) : (WORD_NUMS[s.toLowerCase()] ?? 0))

export function detectVariantIntent(text: string): VariantIntent | null {
  const m = RE.exec(text) ?? COUNTED.exec(text) ?? SHORT.exec(text)
  if (!m) return null
  const phrase = m[0]
  // a range ("3-4", "3 to 4") asks for up to its upper bound
  const range = phrase.match(new RegExp(String.raw`\b(${N})\s*(?:-|–|—|to|or)\s*(${N})\b`, "i"))
  const single = phrase.match(new RegExp(String.raw`\b(${N}|couple|few|some|several)\b`, "i"))
  let count = range ? Math.max(toNum(range[1]), toNum(range[2])) : single ? toNum(single[1]) : 3
  if (!count) count = 3
  count = Math.max(1, Math.min(6, count))
  return { start: m.index, end: m.index + phrase.length, count, phrase }
}
