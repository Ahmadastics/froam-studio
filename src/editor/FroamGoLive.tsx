/**
 * Go Live — what was saved, onto the real site (lib/go-live.mjs does it).
 *
 * The sheet says plainly where it goes and what goes, before anything
 * happens: a commit and a push are seen by everyone who visits the site, so
 * nothing leaves without "Put it live". It names what rides along (earlier
 * commits not pushed yet) and what stays behind (other changed files), and
 * it only says "Live" once the bridge has read the change back off the site.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { AlertTriangle, Check, ExternalLink, Globe, Loader2, Rocket, X } from 'lucide-react'
import { bridgeHeaders, bridgeUrl } from '../lib/bridge'

export type GoLiveJob = {
  id: string
  mode: 'git' | 'publish'
  step: string
  message: string
  url?: string | null
  done: boolean
  ok?: boolean
  outcome?: 'live' | 'pushed' | 'preview' | 'failed'
  /** What the link at the end opens, when it isn't the site (a build log). */
  linkLabel?: string
}

type PlanFile = { path: string; change: 'new' | 'changed' | 'removed'; label: string }
type Plan = {
  mode: 'git' | 'publish' | 'none'
  token: string
  blocked?: string | null
  busy?: boolean
  canCheck?: boolean
  where?: {
    repo?: string; branch?: string; production?: boolean | null; defaultBranch?: string | null; host?: string | null; hostReported?: boolean
    url?: string | null; urlSource?: string | null; project?: string; remote?: string; newBranch?: boolean
    remotes?: Array<{ name: string; repo: string; deploys: string | null }>; chosenBy?: 'you' | 'saved' | 'host' | 'upstream' | 'only' | 'guess'; needsChoice?: boolean
    github?: { reachable: boolean; reason: string | null } | null
  }
  files?: PlanFile[]
  earlier?: Array<{ hash: string; subject: string }>
  earlierCount?: number
  others?: number
  offline?: boolean
  total?: number
  warnings?: string[]
}

type Props = {
  open: boolean
  onClose: () => void
  /** Save what this device has first, so what goes live is what's on screen. */
  saveFirst: () => Promise<void>
  /** The job as the bridge last announced it (/__froam/events). */
  job: GoLiveJob | null
  onJob: (job: GoLiveJob | null) => void
}

type Step = readonly [id: string, label: string]
const GIT_STEPS: readonly Step[] = [['commit', 'Commit what Froam saved'], ['push', 'Send it to your repo'], ['deploy', 'Your host builds it'], ['check', 'Check the live site']]
const PUBLISH_STEPS: readonly Step[] = [['build', 'Get the site ready'], ['login', 'Check you’re signed in'], ['publish', 'Upload it'], ['check', 'Check the live site']]
const SHOWN_FILES = 8

async function bridgeJson<T>(path: string, init: RequestInit = {}): Promise<{ status: number; data: T | null }> {
  const response = await window.fetch(bridgeUrl(path), { cache: 'no-store', ...init, headers: bridgeHeaders({ 'Content-Type': 'application/json', ...(init.headers as Record<string, string> | undefined) }) })
  return { status: response.status, data: await response.json().catch(() => null) as T | null }
}

export default function FroamGoLive({ open, onClose, saveFirst, job, onJob }: Props) {
  const [plan, setPlan] = useState<Plan | null>(null)
  const [phase, setPhase] = useState<'loading' | 'plan' | 'error'>('loading')
  const [problem, setProblem] = useState<string | null>(null)
  const [address, setAddress] = useState('')
  const [editingAddress, setEditingAddress] = useState(false)
  const [starting, setStarting] = useState(false)
  const [startedId, setStartedId] = useState<string | null>(null)
  // A remote picked here, when the repo has more than one; sent with the plan and the go.
  const [remoteChoice, setRemoteChoice] = useState<string | null>(null)
  // Which steps the job has been through, so finished steps read as done and skipped ones as skipped.
  const [seenSteps, setSeenSteps] = useState<string[]>([])
  const primaryRef = useRef<HTMLButtonElement | null>(null)

  const loadPlan = useCallback(async (save: boolean, remote: string | null = null) => {
    setPhase('loading')
    setProblem(null)
    try {
      if (save) await saveFirst()
      const { status, data } = await bridgeJson<{ success?: boolean; plan?: Plan; job?: GoLiveJob | null; error?: string }>(`/__froam/live${remote ? `?remote=${encodeURIComponent(remote)}` : ''}`)
      if (!data?.success || !data.plan) throw new Error(data?.error ?? (status === 403 ? 'Only your computer, or a phone paired with it, can put the site live.' : 'Froam couldn’t work out what would go live.'))
      setPlan(data.plan)
      if (data.job && !data.job.done) { onJob(data.job); setStartedId(data.job.id) }
      setPhase('plan')
    } catch (error) {
      setProblem(error instanceof Error ? error.message : 'Froam couldn’t reach your computer.')
      setPhase('error')
    }
  }, [saveFirst, onJob])

  useEffect(() => {
    if (!open) return
    setStartedId(job && !job.done ? job.id : null)
    setRemoteChoice(null)
    setSeenSteps([])
    void loadPlan(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  // The events stream carries progress; this catches up if it dropped (a phone waking up).
  useEffect(() => {
    if (!open || !startedId || job?.done) return
    const timer = window.setInterval(async () => {
      try {
        const { data } = await bridgeJson<{ job?: GoLiveJob | null }>('/__froam/live/job')
        if (data?.job) onJob(data.job)
      } catch { /* next tick */ }
    }, 3000)
    return () => window.clearInterval(timer)
  }, [open, startedId, job?.done, onJob])

  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') { event.preventDefault(); onClose() } }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  useEffect(() => { if (open && phase === 'plan') primaryRef.current?.focus() }, [open, phase])

  useEffect(() => {
    if (job?.step) setSeenSteps((seen) => (seen.includes(job.step) ? seen : [...seen, job.step]))
  }, [job?.step])

  async function goLive() {
    if (!plan) return
    setStarting(true)
    setProblem(null)
    try {
      const { status, data } = await bridgeJson<{ success?: boolean; job?: GoLiveJob; error?: string; plan?: Plan | null }>('/__froam/live', { method: 'POST', body: JSON.stringify({ token: plan.token, ...(remoteChoice ? { remote: remoteChoice } : {}) }) })
      if (data?.success && data.job) {
        onJob(data.job)
        setStartedId(data.job.id)
      } else {
        if (data?.plan) setPlan(data.plan)
        setProblem(status === 409 && data?.plan ? 'Something changed since you looked — here’s what would go now.' : data?.error ?? 'It didn’t start.')
      }
    } catch {
      setProblem('Froam couldn’t reach your computer. Is froam dev still running?')
    } finally {
      setStarting(false)
    }
  }

  async function saveAddress() {
    const { data } = await bridgeJson<{ success?: boolean; error?: string }>('/__froam/live/site', { method: 'POST', body: JSON.stringify({ url: address }) })
    if (!data?.success) { setProblem(data?.error ?? 'That address didn’t save.'); return }
    setAddress('')
    setEditingAddress(false)
    void loadPlan(false, remoteChoice)
  }

  if (!open) return null
  const current = startedId && job?.id === startedId ? job : null
  const steps = (current?.mode ?? plan?.mode) === 'publish' ? PUBLISH_STEPS : GIT_STEPS
  const stepAt = current ? steps.findIndex(([id]) => id === current.step) : -1
  const lastSeen = steps.reduce((at, [id], index) => (seenSteps.includes(id) ? index : at), -1)
  const stepState = (id: string, index: number) => {
    if (!current) return 'todo'
    if (!current.done) return index < stepAt ? 'done' : index === stepAt ? 'now' : seenSteps.includes(id) ? 'done' : 'todo'
    if (!current.ok) return index < lastSeen ? 'done' : index === lastSeen ? 'failed' : 'todo'
    return index <= lastSeen && seenSteps.includes(id) ? 'done' : index < lastSeen ? 'done' : 'skipped'
  }
  const files = plan?.files ?? []
  const where = plan?.where ?? {}
  // More than one remote and nothing to say which a host builds from: the person picks, Froam doesn't guess.
  const asking = Boolean(where.needsChoice && !remoteChoice)

  return (
    <div className="froam-golive" data-chef-editor-root="true" onClick={(event) => { if (event.target === event.currentTarget && !(current && !current.done)) onClose() }}>
      <div className="froam-golive__card" role="dialog" aria-modal="true" aria-labelledby="froam-golive-title" data-chef-editor-root="true">
        <div className="froam-golive__head">
          <h2 id="froam-golive-title">
            {current?.done && current.outcome === 'live' ? <Check size={18} className="froam-golive__ok" /> : current?.done && !current.ok ? <AlertTriangle size={18} className="froam-golive__warn" /> : <Rocket size={18} />}
            {current ? (current.done ? (current.ok ? (current.outcome === 'live' ? 'Live' : current.outcome === 'preview' ? 'Preview ready' : 'Sent') : 'Didn’t go live') : 'Going live…') : 'Put this live?'}
          </h2>
          <button type="button" className="froam-golive__close" onClick={onClose} aria-label="Close"><X size={16} /></button>
        </div>

        <div className="froam-golive__body" aria-live="polite">
          {!current && phase === 'loading' && <p className="froam-golive__quiet"><Loader2 size={15} className="froam-golive__spin" /> Saving, and checking what’s ready to go…</p>}
          {!current && phase === 'error' && <p className="froam-golive__problem">{problem}</p>}

          {!current && phase === 'plan' && plan && (
            <>
              {plan.mode === 'git' && (where.remotes?.length ?? 0) > 1 && (
                <div className={`froam-golive__remote${asking ? ' is-asking' : ''}`}>
                  <label htmlFor="froam-golive-remote">{asking ? 'This repo has more than one remote. Which one does your site deploy from?' : 'Send to'}</label>
                  <select
                    id="froam-golive-remote"
                    value={remoteChoice ?? (asking ? '' : where.remote)}
                    onChange={(event) => { setRemoteChoice(event.target.value); void loadPlan(false, event.target.value) }}
                  >
                    {asking && <option value="" disabled>Pick one</option>}
                    {where.remotes!.map((remote) => (
                      <option key={remote.name} value={remote.name}>{remote.name} — {remote.repo}{remote.deploys ? ` · ${remote.deploys} deploys from here` : ''}</option>
                    ))}
                  </select>
                </div>
              )}

              {plan.mode !== 'none' && (
                <div className="froam-golive__where">
                  <Globe size={15} />
                  <div>
                    {plan.mode === 'git'
                      ? <><strong>{where.repo}</strong> · {where.branch}{where.newBranch ? <span> (new there)</span> : null}{where.host ? <div className="froam-golive__host">{where.hostReported ? `${where.host} deploys your site from ${where.defaultBranch ?? 'here'}` : `This project deploys with ${where.host}`}</div> : null}</>
                      : <><strong>{where.host}</strong> · {where.project}</>}
                    {where.url && (
                      <div className="froam-golive__url">
                        {where.url.replace(/^https?:\/\//, '')}
                        {where.urlSource && <span className="froam-golive__source"> · from {where.urlSource}</span>}
                        {plan.mode === 'git' && !editingAddress && <button type="button" className="froam-golive__link" onClick={() => { setAddress(where.url ?? ''); setEditingAddress(true) }}>Not right?</button>}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {plan.blocked
                ? <p className="froam-golive__blocked">{plan.blocked}</p>
                : (
                  <>
                    {files.length > 0 && (
                      <div className="froam-golive__section">
                        <h3>What goes</h3>
                        <ul className="froam-golive__files">
                          {files.slice(0, SHOWN_FILES).map((file) => (
                            <li key={file.path} title={file.path}><span>{file.label}</span><i data-change={file.change}>{file.change}</i></li>
                          ))}
                          {files.length > SHOWN_FILES && <li className="froam-golive__more">and {files.length - SHOWN_FILES} more</li>}
                        </ul>
                      </div>
                    )}
                    {plan.mode === 'git' && where.production === false && (
                      <p className="froam-golive__note is-warning">{where.branch} isn’t your live branch{where.defaultBranch ? ` (${where.defaultBranch})` : ''}. On most hosts this makes a preview, not your site.</p>
                    )}
                    {(plan.earlier?.length ?? 0) > 0 && (() => {
                      const count = Math.max(plan.earlierCount ?? 0, plan.earlier!.length)
                      const shown = plan.earlier!.slice(0, 5)
                      return (
                        <div className="froam-golive__note is-warning">
                          Also sends {count === 1 ? 'an earlier commit' : `${count} earlier commits`} of yours that {where.repo} doesn’t have yet:
                          <ul>
                            {shown.map((commit) => <li key={commit.hash}>{commit.subject}</li>)}
                            {count > shown.length && <li className="froam-golive__more">and {count - shown.length} more</li>}
                          </ul>
                        </div>
                      )
                    })()}
                    {plan.mode === 'git' && where.github && !where.github.reachable && where.github.reason && (
                      <p className="froam-golive__note">Froam can’t follow what {where.host ?? 'your host'} does with it: {where.github.reason}{where.url ? ' It will read your site’s address instead.' : ''}</p>
                    )}
                    {(plan.others ?? 0) > 0 && <p className="froam-golive__note">{plan.others} other changed file{plan.others === 1 ? '' : 's'} in your project stay{plan.others === 1 ? 's' : ''} as {plan.others === 1 ? 'it is' : 'they are'}: only what Froam saved goes.</p>}
                    {plan.offline && <p className="froam-golive__note">Couldn’t reach {where.repo} to look for newer work. If there is some, the push is refused and nothing is lost.</p>}
                    {plan.warnings?.map((warning) => <p key={warning} className="froam-golive__note is-warning">{warning}</p>)}
                  </>
                )}

              {plan.mode === 'git' && (!where.url || editingAddress) && !plan.blocked && (
                <form className="froam-golive__address" onSubmit={(event) => { event.preventDefault(); void saveAddress() }}>
                  <label htmlFor="froam-golive-address">Your site’s address, so Froam can tell you when it’s live</label>
                  <div>
                    <input id="froam-golive-address" type="url" inputMode="url" placeholder="https://your-site.com" value={address} onChange={(event) => setAddress(event.target.value)} />
                    <button type="submit" disabled={!address.trim()}>Save</button>
                  </div>
                </form>
              )}
              {problem && <p className="froam-golive__problem">{problem}</p>}
            </>
          )}

          {current && (
            <>
              <ol className="froam-golive__steps">
                {steps.map(([id, label], index) => {
                  const state = stepState(id, index)
                  return (
                    <li key={id} data-state={state}>
                      {state === 'done' ? <Check size={14} /> : state === 'now' ? <Loader2 size={14} className="froam-golive__spin" /> : state === 'failed' ? <AlertTriangle size={14} /> : <span className="froam-golive__dot" />}
                      <span>{label}</span>
                    </li>
                  )
                })}
              </ol>
              <p className={current.done && !current.ok ? 'froam-golive__problem' : 'froam-golive__quiet'}>{current.message}</p>
              {current.done && current.url && (
                <a className="froam-golive__open" href={current.url} target="_blank" rel="noreferrer">
                  {current.linkLabel ?? `Open ${current.url.replace(/^https?:\/\//, '')}`} <ExternalLink size={13} />
                </a>
              )}
            </>
          )}
        </div>

        <div className="froam-golive__foot">
          {current?.done || (!current && (phase === 'error' || plan?.blocked))
            ? (
              <>
                {current?.done && !current.ok && <button type="button" className="froam-golive__secondary" onClick={() => { setStartedId(null); onJob(null); void loadPlan(false) }}>Try again</button>}
                <button type="button" className="froam-golive__primary" onClick={onClose}>Done</button>
              </>
            )
            : current
              ? <span className="froam-golive__quiet">You can close this; Froam keeps going and tells you when it’s done.</span>
              : (
                <>
                  <button type="button" className="froam-golive__secondary" onClick={onClose}>Not now</button>
                  <button ref={primaryRef} type="button" className="froam-golive__primary" disabled={phase !== 'plan' || starting || Boolean(plan?.busy) || asking} onClick={() => { void goLive() }}>
                    {starting ? <Loader2 size={15} className="froam-golive__spin" /> : <Rocket size={15} />}
                    Put it live
                  </button>
                </>
              )}
        </div>
      </div>
    </div>
  )
}
