import type { Stat } from "./ui/surfaces"

/** deterministic pseudo-random so every render (and every share viewer) sees the same data */
function rng(seed: number) {
  let s = seed
  return () => {
    s = (s * 16807) % 2147483647
    return (s - 1) / 2147483646
  }
}

const r = rng(42)
const days = Array.from({ length: 30 }, (_, i) => {
  const d = new Date(2026, 8, 18 + i)
  return d
})

export const activeUsersSeries = days.map((d, i) => {
  const weekday = d.getDay()
  const weekend = weekday === 0 || weekday === 6 ? 0.78 : 1
  const trend = 38000 + i * 340
  const users = Math.round((trend + r() * 4200) * weekend)
  const prev = Math.round(users * (0.82 + r() * 0.12))
  const web = Math.round(users * 0.54)
  const ios = Math.round(users * 0.29)
  return {
    date: d.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    users,
    prev,
    web,
    ios,
    android: users - web - ios,
  }
})

const spark = (base: number, n = 14) => Array.from({ length: n }, (_, i) => base + Math.sin(i / 2) * 8 + i * 1.6 + r() * 10)

export const kpis: Stat[] = [
  { key: "users", label: "Active users", value: "48,213", delta: 12.4, hint: "vs. 42,890 last period", spark: spark(40) },
  { key: "events", label: "Events tracked", value: "8.24M", delta: 8.1, hint: "274k per day on average", spark: spark(60) },
  { key: "conversion", label: "Signup → Activation", value: "3.42%", delta: -0.6, hint: "Goal: 4.00% by Q4", spark: spark(30).reverse() },
  { key: "retention", label: "D30 retention", value: "27.8%", delta: 2.1, hint: "Cohort of Sep 18", spark: spark(20) },
]

export const topEvents = [
  { name: "page_viewed", count: 3_812_440, share: 1 },
  { name: "button_clicked", count: 1_204_118, share: 0.42 },
  { name: "signup_started", count: 214_902, share: 0.21 },
  { name: "report_exported", count: 98_311, share: 0.12 },
  { name: "invite_sent", count: 41_870, share: 0.07 },
]

export const liveUsers = [
  { name: "Maya Chen", where: "Pricing", city: "Lisbon", ago: "now", platform: "Web" },
  { name: "Omar Haddad", where: "Onboarding · Step 3", city: "Dubai", ago: "12s", platform: "iOS" },
  { name: "Lena Fischer", where: "Dashboard", city: "Berlin", ago: "31s", platform: "Web" },
  { name: "Arjun Mehta", where: "Settings · Billing", city: "Bengaluru", ago: "48s", platform: "Android" },
  { name: "Sofia Rossi", where: "Report builder", city: "Milan", ago: "1m", platform: "Web" },
]

export type EventRow = {
  id: string
  name: string
  kind: "pageview" | "custom" | "error" | "identify"
  user: string
  email: string
  props: string
  platform: "Web" | "iOS" | "Android"
  country: string
  time: string
}

export const events: EventRow[] = [
  { id: "e1", name: "page_viewed", kind: "pageview", user: "Maya Chen", email: "maya@lumen.io", props: "/pricing", platform: "Web", country: "PT", time: "14:32:08" },
  { id: "e2", name: "signup_started", kind: "custom", user: "Omar Haddad", email: "omar@sandline.ae", props: "plan: Growth", platform: "iOS", country: "AE", time: "14:32:02" },
  { id: "e3", name: "button_clicked", kind: "custom", user: "Lena Fischer", email: "lena@kraft.de", props: "Create report", platform: "Web", country: "DE", time: "14:31:57" },
  { id: "e4", name: "checkout_failed", kind: "error", user: "Arjun Mehta", email: "arjun@tiffin.in", props: "card_declined", platform: "Android", country: "IN", time: "14:31:44" },
  { id: "e5", name: "user_identified", kind: "identify", user: "Sofia Rossi", email: "sofia@forma.it", props: "role: admin", platform: "Web", country: "IT", time: "14:31:40" },
  { id: "e6", name: "report_exported", kind: "custom", user: "Jonas Berg", email: "jonas@northpeak.se", props: "format: CSV", platform: "Web", country: "SE", time: "14:31:22" },
  { id: "e7", name: "page_viewed", kind: "pageview", user: "Aiko Tanaka", email: "aiko@hoshi.jp", props: "/docs/sdk", platform: "Web", country: "JP", time: "14:31:15" },
  { id: "e8", name: "invite_sent", kind: "custom", user: "Lucas Silva", email: "lucas@pampa.br", props: "seats: 3", platform: "iOS", country: "BR", time: "14:30:58" },
  { id: "e9", name: "page_viewed", kind: "pageview", user: "Grace Okafor", email: "grace@kora.ng", props: "/changelog", platform: "Android", country: "NG", time: "14:30:41" },
  { id: "e10", name: "session_replay_viewed", kind: "custom", user: "Noah Martin", email: "noah@bluefin.ca", props: "duration: 4m", platform: "Web", country: "CA", time: "14:30:33" },
]

export const funnelSteps = [
  { name: "Visited landing page", users: 182_400 },
  { name: "Started signup", users: 41_960 },
  { name: "Verified email", users: 29_870 },
  { name: "Created first project", users: 14_210 },
  { name: "Invited a teammate", users: 6_238 },
]

export const funnelBreakdown = [
  { source: "Organic search", users: 71_200, conv: 4.1, delta: 0.4 },
  { source: "Paid social", users: 48_900, conv: 2.2, delta: -0.8 },
  { source: "Direct", users: 32_400, conv: 5.6, delta: 1.1 },
  { source: "Referral", users: 18_300, conv: 6.9, delta: 0.3 },
  { source: "Newsletter", users: 11_600, conv: 3.8, delta: -0.2 },
]

const rr = rng(7)
export const cohorts = Array.from({ length: 8 }, (_, i) => {
  const size = Math.round(4200 + rr() * 2600)
  const weeks = Array.from({ length: 8 - i }, (_, w) => {
    if (w === 0) return 100
    const base = 100 * Math.pow(0.78, w) * (0.62 + rr() * 0.12) + 14
    return Math.round(Math.min(100, base) * 10) / 10
  })
  const start = new Date(2026, 7, 24 + i * 7)
  return {
    label: start.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    size,
    weeks,
  }
})

export const team = [
  { name: "Abhi Kumar", email: "abhi@orbit.so", role: "Owner" },
  { name: "Priya Nair", email: "priya@orbit.so", role: "Admin" },
  { name: "Daniel Park", email: "daniel@orbit.so", role: "Editor" },
  { name: "Elena Petrova", email: "elena@orbit.so", role: "Viewer" },
]
