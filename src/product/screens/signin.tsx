import * as React from "react"
import { ArrowRight, Lock, Mail } from "@/lib/icons"
import { OrbitLogo, useProduct, usePcId } from "../shell"
import { pc } from "../system/define"
import { Button } from "../ui/button"
import { Avatar, Input } from "../ui/controls"

function GoogleG() {
  return (
    <svg viewBox="0 0 24 24" className="size-4">
      <path fill="#4285F4" d="M23.5 12.27c0-.85-.08-1.67-.22-2.45H12v4.64h6.45a5.52 5.52 0 0 1-2.39 3.62v3h3.87c2.26-2.09 3.57-5.17 3.57-8.81Z" />
      <path fill="#34A853" d="M12 24c3.24 0 5.96-1.07 7.93-2.92l-3.87-3c-1.07.72-2.45 1.15-4.06 1.15-3.13 0-5.78-2.11-6.72-4.95H1.28v3.1A12 12 0 0 0 12 24Z" />
      <path fill="#FBBC05" d="M5.28 14.28a7.2 7.2 0 0 1 0-4.56v-3.1H1.28a12 12 0 0 0 0 10.76l4-3.1Z" />
      <path fill="#EA4335" d="M12 4.77c1.76 0 3.34.6 4.59 1.8l3.43-3.44A11.94 11.94 0 0 0 12 0 12 12 0 0 0 1.28 6.62l4 3.1C6.22 6.88 8.87 4.77 12 4.77Z" />
    </svg>
  )
}

export function SignInScreen() {
  const id = usePcId()
  const { navigate } = useProduct()
  const [loading, setLoading] = React.useState(false)
  const go = () => {
    setLoading(true)
    window.setTimeout(() => {
      setLoading(false)
      navigate("overview")
    }, 900)
  }

  return (
    <div
      className="relative flex h-full w-full flex-col items-center justify-center overflow-hidden"
      style={{
        backgroundColor: "var(--background)",
        backgroundImage: "radial-gradient(rgb(22 23 26 / 0.07) 1px, transparent 1px)",
        backgroundSize: "18px 18px",
      }}
    >
      <div
        className="pointer-events-none absolute left-1/2 top-[38%] size-[720px] -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{ background: "radial-gradient(circle, rgb(255 106 43 / 0.10) 0%, rgb(251 251 250 / 0.9) 45%, transparent 70%)" }}
      />

      <div className="relative flex w-[380px] flex-col items-center">
        <OrbitLogo className="size-10 shadow-[0_8px_24px_rgb(22_23_26/0.18)]" />
        <h1 {...pc(id("signin.title"), "Text", "Sign-in title")} className="mt-5 text-[22px] font-semibold tracking-[-0.025em] text-foreground">
          Sign in to Orbit
        </h1>
        <p {...pc(id("signin.subtitle"), "Text", "Sign-in subtitle")} className="mt-1 text-[13px] text-muted-foreground">
          Product analytics your whole team can read.
        </p>

        <div
          {...pc(id("signin.card"), "Card", "Sign-in card")}
          className="mt-7 flex w-full flex-col gap-3 rounded-2xl border border-border bg-surface p-6 shadow-[0_1px_2px_rgb(22_23_26/0.04),0_12px_32px_-8px_rgb(22_23_26/0.12)]"
        >
          <Button pcId={id("signin.google")} variant="outline" size="lg" className="w-full">
            <GoogleG /> Continue with Google
          </Button>
          <div className="flex items-center gap-3 py-1 text-[11.5px] text-subtle">
            <span className="h-px flex-1 bg-border" />
            or
            <span className="h-px flex-1 bg-border" />
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="text-[12.5px] font-medium text-foreground">Work email</span>
            <Input pcId={id("signin.email")} pcLabel="Work email" icon={<Mail />} type="email" defaultValue="abhi@orbit.so" placeholder="e.g. you@company.com" />
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="flex items-center justify-between text-[12.5px] font-medium text-foreground">
              Password
              <span className="text-[12px] font-normal text-muted-foreground hover:text-foreground">Forgot?</span>
            </span>
            <Input pcId={id("signin.password")} pcLabel="Password" icon={<Lock />} type="password" defaultValue="orbitdemo" placeholder="••••••••" />
          </div>
          <Button pcId={id("signin.continue")} variant="primary" size="lg" className="mt-1 w-full" loading={loading} onClick={go}>
            Continue <ArrowRight />
          </Button>
        </div>

        <p className="mt-5 text-[12.5px] text-muted-foreground">
          New to Orbit? <span className="font-medium text-foreground underline decoration-border underline-offset-4">Create an account</span>
        </p>

        <div
          {...pc(id("signin.social"), "Frame", "Social proof")}
          className="mt-10 flex items-center gap-3 rounded-full border border-border bg-surface/80 py-1.5 pl-1.5 pr-4 shadow-[0_1px_2px_rgb(22_23_26/0.04)] backdrop-blur"
        >
          <div className="flex -space-x-1">
            {["Maya Chen", "Omar Haddad", "Lena Fischer"].map((n) => (
              <Avatar key={n} name={n} size={24} />
            ))}
          </div>
          <span className="text-[12px] text-muted-foreground">
            <span className="font-medium text-foreground">2,400+ teams</span> ship with Orbit
          </span>
        </div>
      </div>

      <div className="absolute inset-x-0 bottom-6 flex justify-center gap-5 text-[11.5px] text-subtle">
        <span>Terms</span>
        <span>Privacy</span>
        <span>Status</span>
        <span>© 2026 Orbit Labs</span>
      </div>
    </div>
  )
}
