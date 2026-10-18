import * as React from "react"
import { toast } from "sonner"
import { format } from "date-fns"
import {
  CalendarDays,
  Check,
  Copy,
  ExternalLink,
  Globe,
  Link2,
  Lock,
  Send,
  Share2,
  X,
} from "@/lib/icons"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { screenMeta } from "@/product/screens"
import { copyText } from "../copy"
import { createShare } from "../share/client"
import { useShareViewers } from "../share/useShareSync"
import { useTool } from "../store"
import type { ShareConfig } from "../types"

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="flex min-w-0 flex-col">
        <span className="text-[13px] font-medium text-foreground">{label}</span>
        {hint && <span className="text-[12px] text-muted-foreground">{hint}</span>}
      </div>
      {children}
    </div>
  )
}

function CopyField({ value, mono, onCopied }: { value: string; mono?: boolean; onCopied?: () => void }) {
  const [copied, setCopied] = React.useState(false)
  return (
    <div className="flex h-9 items-center gap-1 rounded-lg border border-border bg-muted/50 pl-3 pr-1">
      <span className={cn("min-w-0 flex-1 truncate text-[12.5px] text-foreground", mono && "font-mono text-[12px]")}>{value}</span>
      <Button
        size="sm"
        variant="ghost"
        className="gap-1 text-[12px]"
        onClick={async () => {
          await copyText(value)
          setCopied(true)
          onCopied?.()
          window.setTimeout(() => setCopied(false), 1400)
        }}
      >
        {copied ? <Check className="size-3.5 text-emerald-500" /> : <Copy className="size-3.5" />}
        {copied ? "Copied" : "Copy"}
      </Button>
    </div>
  )
}

/* ───────────────────────── Invite ───────────────────────── */

function EmailChips({ emails, onChange }: { emails: string[]; onChange: (e: string[]) => void }) {
  const [draft, setDraft] = React.useState("")
  const [invalid, setInvalid] = React.useState(false)
  const inputRef = React.useRef<HTMLInputElement>(null)
  const commit = (raw: string) => {
    const parts = raw
      .split(/[,\s;]+/)
      .map((p) => p.trim())
      .filter(Boolean)
    if (!parts.length) return true
    const bad = parts.filter((p) => !EMAIL_RE.test(p))
    const good = parts.filter((p) => EMAIL_RE.test(p) && !emails.includes(p))
    if (good.length) onChange([...emails, ...good])
    setInvalid(bad.length > 0)
    setDraft(bad.join(", "))
    return bad.length === 0
  }
  return (
    <div
      onClick={() => inputRef.current?.focus()}
      className={cn(
        "flex min-h-10 cursor-text flex-wrap items-center gap-1.5 rounded-lg border bg-transparent px-2 py-1.5 transition-colors dark:bg-input/30",
        invalid ? "border-destructive ring-3 ring-destructive/15" : "border-input focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/40",
      )}
    >
      {emails.map((e) => (
        <span key={e} className="inline-flex h-6 items-center gap-1 rounded-md bg-secondary pl-2 pr-1 text-[12px] font-medium text-secondary-foreground">
          {e}
          <button
            type="button"
            aria-label={`Remove ${e}`}
            className="grid size-4 place-items-center rounded text-muted-foreground hover:bg-background hover:text-foreground"
            onClick={(ev) => {
              ev.stopPropagation()
              onChange(emails.filter((x) => x !== e))
            }}
          >
            <X className="size-3" />
          </button>
        </span>
      ))}
      <input
        ref={inputRef}
        value={draft}
        placeholder={emails.length ? "" : "Add emails, separated by commas"}
        onChange={(e) => {
          setInvalid(false)
          const v = e.target.value
          if (/[,;]\s*$/.test(v)) commit(v)
          else setDraft(v)
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === "Tab") {
            if (draft.trim()) {
              e.preventDefault()
              commit(draft)
            }
          } else if (e.key === "Backspace" && !draft && emails.length) {
            onChange(emails.slice(0, -1))
          }
        }}
        onBlur={() => draft && commit(draft)}
        className="h-6 min-w-[100px] flex-1 bg-transparent text-[13px] outline-none placeholder:text-muted-foreground"
      />
    </div>
  )
}

function Person({ name, email, role, you }: { name: string; email: string; role: string; you?: boolean }) {
  const initials = name
    .split(/[\s.@]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("")
  return (
    <div className="flex items-center gap-3 py-1.5">
      <span className="grid size-7 shrink-0 place-items-center rounded-full bg-secondary text-[11px] font-semibold text-secondary-foreground">{initials}</span>
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-[13px] font-medium leading-tight">
          {name} {you && <span className="font-normal text-muted-foreground">(you)</span>}
        </span>
        <span className="truncate text-[12px] leading-tight text-muted-foreground">{email}</span>
      </div>
      <span className="text-[12px] text-muted-foreground">{role}</span>
    </div>
  )
}

/* ───────────────────────── Dialog ───────────────────────── */


export function ShareDialog() {
  const open = useTool((s) => s.shareOpen)
  const setOpen = useTool((s) => s.setShareOpen)
  const screen = useTool((s) => s.screen)
  const variantSets = useTool((s) => s.variantSets)
  const shares = useTool((s) => s.shares)
  const addShare = useTool((s) => s.addShare)
  const latest = shares[0]
  const viewers = useShareViewers(latest?.id)

  const [emails, setEmails] = React.useState<string[]>([])
  const [invited, setInvited] = React.useState<{ email: string; role: ShareConfig["role"] }[]>([])
  const [inviteRole, setInviteRole] = React.useState<ShareConfig["role"]>("comment")
  const [message, setMessage] = React.useState("")
  const [access, setAccess] = React.useState<ShareConfig["access"]>("link")
  const [role, setRole] = React.useState<ShareConfig["role"]>("comment")
  const [pwOn, setPwOn] = React.useState(false)
  const [password, setPassword] = React.useState("")
  const [expiryOn, setExpiryOn] = React.useState(false)
  const [expiry, setExpiry] = React.useState<Date | undefined>(() => new Date(Date.now() + 7 * 864e5))
  const [creating, setCreating] = React.useState(false)
  const [dirty, setDirty] = React.useState(false)

  const touch = <T,>(fn: (v: T) => void) => (v: T) => {
    fn(v)
    setDirty(true)
  }

  const buildConfig = (): ShareConfig => ({
    access,
    role,
    password: pwOn ? password : "",
    expiresAt: expiryOn && expiry ? new Date(new Date(expiry).setHours(23, 59, 59, 0)).toISOString() : null,
    variantSets: variantSets.map((v) => v.id),
    invited: invited.map((i) => i.email),
    message,
  })

  const create = async () => {
    if (pwOn && password.length < 4) {
      toast.error("Password needs at least 4 characters")
      return
    }
    setCreating(true)
    try {
      const s = useTool.getState()
      const snapshot = {
        ops: s.ops,
        screen: s.screen,
        variantSets: s.variantSets.map((v) => ({ ...v, generating: false })),
      }
      const info = await createShare(snapshot, buildConfig())
      addShare(info)
      setDirty(false)
      await copyText(info.url)
      toast.success(latest ? "Link updated and copied" : "Link created and copied", { description: info.url })
    } catch (e) {
      toast.error("Couldn't create link", { description: e instanceof Error ? e.message : undefined })
    } finally {
      setCreating(false)
    }
  }

  const sendInvites = () => {
    if (!emails.length) {
      toast.error("Add at least one email")
      return
    }
    const n = emails.length
    setInvited((prev) => [...prev, ...emails.filter((e) => !prev.some((p) => p.email === e)).map((email) => ({ email, role: inviteRole }))])
    setEmails([])
    setMessage("")
    setDirty(true)
    toast.success(`Invites sent to ${n} ${n === 1 ? "person" : "people"}`, {
      description: latest ? "They'll get a link to this prototype." : "Create a link to give them access.",
    })
  }

  const url = latest?.url ?? ""
  const title = (() => {
    try {
      return screenMeta(screen).title
    } catch {
      return "Overview"
    }
  })()

  const roleLabel = (r: ShareConfig["role"]) => (r === "comment" ? "Can comment" : "Can view")

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-[560px]" onOpenAutoFocus={(e) => e.preventDefault()}>
        <div className="flex items-start gap-3 px-5 pb-3 pt-5">
          <span className="grid size-9 shrink-0 place-items-center rounded-[10px] bg-secondary text-foreground">
            <Share2 className="size-4" />
          </span>
          <div className="flex flex-col gap-0.5">
            <DialogTitle className="text-[15px] font-semibold tracking-[-0.01em]">Share prototype</DialogTitle>
            <DialogDescription className="text-[12.5px] text-muted-foreground">Orbit Analytics · {title}</DialogDescription>
          </div>
        </div>

        <div className="flex max-h-[min(560px,calc(100vh-220px))] flex-col gap-5 overflow-y-auto border-t border-border p-5">
          {/* invite */}
          <div className="flex flex-col gap-2.5">
            <div className="flex items-start gap-2">
              <div className="flex-1">
                <EmailChips emails={emails} onChange={setEmails} />
              </div>
              <Select value={inviteRole} onValueChange={(v) => setInviteRole(v as ShareConfig["role"])}>
                <SelectTrigger className="h-10 w-[132px] text-[13px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="comment">Can comment</SelectItem>
                  <SelectItem value="view">Can view</SelectItem>
                </SelectContent>
              </Select>
              <Button onClick={sendInvites} disabled={!emails.length} className="h-10 gap-1.5">
                <Send className="size-3.5" /> Invite
              </Button>
            </div>
            {emails.length > 0 && (
              <Textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Add a message (optional)"
                className="min-h-[64px] resize-none text-[13px] md:text-[13px]"
              />
            )}
          </div>

          {/* who has access: invited people + general (link) access in one list */}
          <div className="flex flex-col">
            <span className="mb-1 text-[12px] font-medium text-muted-foreground">People with access</span>
            <Person name="Abhi Kumar" email="abhi@orbit.so" role="Owner" you />
            {invited.map((i) => (
              <Person key={i.email} name={i.email.split("@")[0].replace(/[._-]/g, " ")} email={i.email} role={roleLabel(i.role)} />
            ))}
            <div className="mt-1 flex items-center gap-3 py-1.5">
              <span className="grid size-7 shrink-0 place-items-center rounded-full bg-secondary text-muted-foreground">
                {access === "link" ? <Globe className="size-3.5" /> : <Lock className="size-3.5" />}
              </span>
              <Select value={access} onValueChange={touch((v: string) => setAccess(v as ShareConfig["access"]))}>
                <SelectTrigger className="h-8 w-auto gap-1.5 border-none px-1.5 text-[13px] font-medium shadow-none hover:bg-muted">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="link">Anyone with the link</SelectItem>
                  <SelectItem value="invite">Only people invited</SelectItem>
                </SelectContent>
              </Select>
              <span className="flex-1" />
              {access === "link" && (
                <Select value={role} onValueChange={touch((v: string) => setRole(v as ShareConfig["role"]))}>
                  <SelectTrigger className="h-8 w-auto gap-1.5 border-none px-1.5 text-[12.5px] text-muted-foreground shadow-none hover:bg-muted">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent align="end">
                    <SelectItem value="comment">Can comment</SelectItem>
                    <SelectItem value="view">Can view</SelectItem>
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>

          <div className="h-px shrink-0 bg-border" />

          {/* link protection */}
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-2">
              <Field label="Password protection" hint="Viewers enter it once per session">
                <Switch checked={pwOn} onCheckedChange={touch(setPwOn)} />
              </Field>
              {pwOn && (
                <Input
                  type="password"
                  autoFocus
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value)
                    setDirty(true)
                  }}
                  placeholder="Choose a password"
                  className="h-9 text-[13px] md:text-[13px]"
                />
              )}
            </div>
            <div className="flex flex-col gap-2">
              <Field label="Link expiry" hint={expiryOn && expiry ? `Stops working after ${format(expiry, "MMM d, yyyy")}` : "Link never expires"}>
                <Switch checked={expiryOn} onCheckedChange={touch(setExpiryOn)} />
              </Field>
              {expiryOn && (
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="h-9 justify-start gap-2 text-[13px] font-normal">
                      <CalendarDays className="size-3.5 text-muted-foreground" />
                      {expiry ? format(expiry, "EEEE, MMM d, yyyy") : "Pick a date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={expiry}
                      onSelect={(d: Date | undefined) => {
                        setExpiry(d)
                        setDirty(true)
                      }}
                      disabled={{ before: new Date() }}
                    />
                  </PopoverContent>
                </Popover>
              )}
            </div>
          </div>

          {/* the link */}
          {latest ? (
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-[13px] font-medium">Prototype link</span>
                <span className="flex items-center gap-1.5 text-[12px] text-muted-foreground">
                  {latest.config.password && <Lock className="size-3" />}
                  Created {format(latest.createdAt, "MMM d, h:mm a")}
                </span>
              </div>
              <CopyField value={url} />
              <div className="flex items-center justify-between gap-2">
                <span className={cn("text-[12px]", dirty ? "text-[var(--pc-warn)]" : "text-muted-foreground")}>
                  {dirty ? "Settings changed — update the link to apply them." : "Viewers see the prototype as it was when the link was made."}
                </span>
                <Button variant="outline" size="sm" className="shrink-0 gap-1.5" onClick={() => window.open(url, "_blank")}>
                  <ExternalLink className="size-3.5" /> Open viewer
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col rounded-xl border border-dashed border-border px-4 py-3">
              <span className="text-[13px] font-medium">No link yet</span>
              <span className="text-[12px] text-muted-foreground">Creates a live snapshot with your edits and variants.</span>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-border bg-muted/40 px-5 py-3">
          <span className="flex items-center gap-2 text-[12px] text-muted-foreground">
            {latest ? (
              <>
                <span className="relative flex size-2">
                  {viewers > 0 && <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-500 opacity-60" />}
                  <span className={cn("relative inline-flex size-2 rounded-full", viewers > 0 ? "bg-emerald-500" : "bg-muted-foreground/40")} />
                </span>
                {viewers > 0 ? `${viewers} ${viewers === 1 ? "viewer" : "viewers"} online` : "No one viewing right now"}
              </>
            ) : (
              <>
                <Lock className="size-3" /> Private until you create a link
              </>
            )}
          </span>
          <Button
            className="gap-1.5"
            disabled={creating}
            onClick={async () => {
              if (!latest || dirty) return create()
              await copyText(url)
              toast.success("Link copied", { description: url })
            }}
          >
            <Link2 className="size-3.5" />
            {!latest ? "Create & copy link" : dirty ? "Update & copy link" : "Copy link"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
