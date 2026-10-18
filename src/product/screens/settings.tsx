import * as React from "react"
import { AlertCircle, Copy, Globe, KeyRound, Mail, UserPlus } from "@/lib/icons"
import { team } from "../data"
import { AppFrame, PageHeader, usePcId } from "../shell"
import { pc } from "../system/define"
import { Button } from "../ui/button"
import { Avatar, Badge, Input, Switch } from "../ui/controls"
import { Card } from "../ui/surfaces"

function Section({
  pcId,
  title,
  description,
  children,
  aside,
  tone,
}: {
  pcId?: string
  title: string
  description: string
  children: React.ReactNode
  aside?: React.ReactNode
  tone?: "danger"
}) {
  return (
    <Card pcId={pcId} pcLabel={title} className={tone === "danger" ? "border-[#f8cfd0]" : undefined}>
      <div className="flex items-start justify-between gap-6 border-b border-border px-6 py-4">
        <div className="flex flex-col gap-0.5">
          <h2 className={`text-[14px] font-semibold tracking-[-0.01em] ${tone === "danger" ? "text-danger" : "text-foreground"}`}>{title}</h2>
          <p className="text-[12.5px] text-muted-foreground">{description}</p>
        </div>
        {aside}
      </div>
      <div className="px-6 py-5">{children}</div>
    </Card>
  )
}

function Field({ label, hint, children }: { label: string; hint?: React.ReactNode; children: React.ReactNode }) {
  return (
    <label className="grid grid-cols-[200px_1fr] items-start gap-6">
      <span className="pt-2 text-[13px] font-medium text-foreground">{label}</span>
      <span className="flex max-w-[440px] flex-col gap-1.5">
        {children}
        {hint}
      </span>
    </label>
  )
}

const ROLE_TONE: Record<string, "dark" | "brand" | "neutral" | "outline"> = {
  Owner: "dark",
  Admin: "brand",
  Editor: "neutral",
  Viewer: "outline",
}

export function SettingsScreen() {
  const id = usePcId()
  const [saving, setSaving] = React.useState(false)
  const save = () => {
    setSaving(true)
    window.setTimeout(() => setSaving(false), 1200)
  }

  const toggles = [
    { key: "anonymizeIps", label: "Anonymize IP addresses", desc: "Drop the last octet before storing. Recommended for GDPR.", on: true },
    { key: "filterBots", label: "Filter bots and crawlers", desc: "Exclude known bots, headless browsers and uptime checks.", on: true },
    { key: "sessionReplay", label: "Session replay", desc: "Record 10% of sessions. Inputs are masked by default.", on: false },
    { key: "rawExport", label: "Raw export (Enterprise)", desc: "Stream raw events to your warehouse every hour.", on: false, disabled: true },
  ]

  return (
    <AppFrame crumbs={["Acme Inc", "Web app", "Settings"]}>
      <PageHeader
        pcBase="settings"
        title="Settings"
        subtitle="Project configuration, data collection and team access"
        right={
          <div className="flex items-center gap-2">
            <Button pcId={id("settings.discard")} variant="ghost">
              Discard
            </Button>
            <Button pcId={id("settings.save")} variant="primary" loading={saving} onClick={save}>
              Save changes
            </Button>
          </div>
        }
      />

      <Section pcId={id("settings.project")} title="Project" description="How this project appears across Orbit">
        <div className="flex flex-col gap-4">
          <Field label="Project name">
            <Input pcId={id("settings.projectName")} pcLabel="Project name" defaultValue="Acme web app" placeholder="e.g. Acme web app" />
          </Field>
          <Field
            label="Allowed domain"
            hint={
              <span {...pc(id("settings.domain.error"), "Text", "Domain error")} className="flex items-center gap-1 text-[12px] text-danger">
                <AlertCircle className="size-3.5" /> Domain must start with https://
              </span>
            }
          >
            <Input pcId={id("settings.domain")} pcLabel="Allowed domain" icon={<Globe />} defaultValue="app.acme.com" invalid />
          </Field>
          <Field label="Support email">
            <Input pcId={id("settings.email")} pcLabel="Support email" icon={<Mail />} placeholder="e.g. support@acme.com" />
          </Field>
          <Field label="Timezone" hint={<span className="text-[12px] text-muted-foreground">Used for daily rollups and reports.</span>}>
            <Input pcId={id("settings.timezone")} pcLabel="Timezone" defaultValue="Europe/Lisbon (GMT+1)" />
          </Field>
        </div>
      </Section>

      <Section pcId={id("settings.data")} title="Data collection" description="What Orbit captures from your product">
        <div className="flex flex-col divide-y divide-border">
          {toggles.map((t) => (
            <div key={t.key} className="flex items-center justify-between gap-6 py-3 first:pt-0 last:pb-0">
              <div className="flex flex-col gap-0.5">
                <span className="flex items-center gap-2 text-[13px] font-medium text-foreground">
                  {t.label}
                  {t.disabled && <Badge tone="outline">Upgrade</Badge>}
                </span>
                <span className="text-[12.5px] text-muted-foreground">{t.desc}</span>
              </div>
              <Switch pcId={id(`settings.${t.key}`)} pcLabel={t.label} defaultChecked={t.on} disabled={t.disabled} />
            </div>
          ))}
        </div>
      </Section>

      <Section
        pcId={id("settings.team")}
        title="Team"
        description="4 members · 6 seats on the Growth plan"
        aside={
          <Button pcId={id("settings.invite")} variant="outline" size="sm">
            <UserPlus /> Invite member
          </Button>
        }
      >
        <div className="-my-2 flex flex-col divide-y divide-border">
          {team.map((m) => (
            <div key={m.email} {...pc(id(`settings.member.${m.email.split("@")[0]}`), "Frame", m.name)} className="flex items-center gap-3 py-2.5">
              <Avatar name={m.name} size={30} />
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="text-[13px] font-medium leading-tight text-foreground">{m.name}</span>
                <span className="text-[12px] leading-tight text-muted-foreground">{m.email}</span>
              </div>
              <Badge tone={ROLE_TONE[m.role]}>{m.role}</Badge>
              <Button pcId={id(`settings.member.${m.email.split("@")[0]}.manage`)} variant="ghost" size="sm" disabled={m.role === "Owner"}>
                Manage
              </Button>
            </div>
          ))}
        </div>
      </Section>

      <Section pcId={id("settings.api")} title="API key" description="Use this key to send events from your servers">
        <Field label="Project key" hint={<span className="text-[12px] text-muted-foreground">Rotated 12 days ago by Priya Nair.</span>}>
          <div className="flex items-center gap-2">
            <Input pcId={id("settings.apiKey")} pcLabel="API key" icon={<KeyRound />} defaultValue="orb_live_••••••••••••••••3f9a" disabled className="font-mono text-[12px]" />
            <Button pcId={id("settings.apiKey.copy")} variant="outline">
              <Copy /> Copy
            </Button>
          </div>
        </Field>
      </Section>

      <Section pcId={id("settings.danger")} title="Danger zone" description="These actions can't be undone" tone="danger">
        <div className="flex flex-col divide-y divide-border">
          <div className="flex items-center justify-between gap-6 pb-3">
            <div className="flex flex-col gap-0.5">
              <span className="text-[13px] font-medium text-foreground">Transfer project</span>
              <span className="text-[12.5px] text-muted-foreground">Only available when another workspace has a free seat.</span>
            </div>
            <Button pcId={id("settings.transfer")} variant="outline" disabled>
              Transfer
            </Button>
          </div>
          <div className="flex items-center justify-between gap-6 pt-3">
            <div className="flex flex-col gap-0.5">
              <span className="text-[13px] font-medium text-foreground">Delete project</span>
              <span className="text-[12.5px] text-muted-foreground">Permanently delete Acme web app and 8.2M events.</span>
            </div>
            <Button pcId={id("settings.delete")} variant="danger">
              Delete project
            </Button>
          </div>
        </div>
      </Section>
    </AppFrame>
  )
}
