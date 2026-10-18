import type { ScreenId } from "@/tool/types"
import { EventsScreen } from "./events"
import { FunnelsScreen } from "./funnels"
import { OverviewScreen } from "./overview"
import { RetentionScreen } from "./retention"
import { SettingsScreen } from "./settings"
import { SignInScreen } from "./signin"

export const SCREENS: { id: ScreenId; title: string; path: string; Component: () => React.JSX.Element }[] = [
  { id: "signin", title: "Sign in", path: "/signin", Component: SignInScreen },
  { id: "overview", title: "Overview", path: "/overview", Component: OverviewScreen },
  { id: "events", title: "Events", path: "/events", Component: EventsScreen },
  { id: "funnels", title: "Funnels", path: "/funnels", Component: FunnelsScreen },
  { id: "retention", title: "Retention", path: "/retention", Component: RetentionScreen },
  { id: "settings", title: "Settings", path: "/settings", Component: SettingsScreen },
]

export const screenMeta = (id: ScreenId) => SCREENS.find((s) => s.id === id)!
