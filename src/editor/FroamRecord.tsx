/**
 * The record — who changed what, who approved it, and when (lib/record.mjs).
 *
 * The sheet reads the project's record through the bridge: newest first,
 * grouped by day, each entry one sentence with what changed underneath. At the
 * top it says whether the record checks out (nothing changed or removed since
 * it was written), and the name the owner's own saves go under, which can be
 * set here. The whole record prints as a report, or downloads as a
 * spreadsheet, for whoever asks for it.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { ChevronDown, FileDown, Loader2, Pencil, Printer, ScrollText, ShieldAlert, ShieldCheck, X } from 'lucide-react'
import { bridgeHeaders, bridgeUrl } from '../lib/bridge'

type RecordChange = { label: string; before?: string; after?: string; page?: string }
export type RecordEntry = {
  seq: number
  at: string
  type: string
  by: { name: string; role?: string; via?: string }
  title?: string
  author?: { name: string; role?: string }
  pages?: string[]
  viewport?: string
  changes?: RecordChange[]
  count?: number
  note?: string
  result?: string
  refs?: Record<string, string | number>
  hash: string
  summary: string
}
type Verification = { ok: boolean; count: number; head: string; problem: { line: number; reason: string } | null }
type Listing = { success?: boolean; entries?: RecordEntry[]; verification?: Verification; you?: string; error?: string }

type Props = { open: boolean; onClose: () => void }

const PAGE = 100
const KINDS: ReadonlyArray<readonly [id: string, label: string, match: (type: string) => boolean]> = [
  ['all', 'Everything', () => true],
  ['requests', 'Asked & approved', (type) => type.startsWith('request.')],
  ['saves', 'Saves', (type) => type.startsWith('saved')],
  ['live', 'Go Live', (type) => type.startsWith('live.')],
  ['people', 'People', (type) => type.startsWith('room.')],
]

async function bridgeFetch(path: string, init: RequestInit = {}) {
  return window.fetch(bridgeUrl(path), { cache: 'no-store', ...init, headers: bridgeHeaders({ 'Content-Type': 'application/json', ...(init.headers as Record<string, string> | undefined) }) })
}

const dayOf = (iso: string) => {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  const today = new Date()
  const yesterday = new Date(today.getTime() - 86_400_000)
  if (date.toDateString() === today.toDateString()) return 'Today'
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday'
  return date.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short', year: date.getFullYear() === today.getFullYear() ? undefined : 'numeric' })
}
const timeOf = (iso: string) => {
  const date = new Date(iso)
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
}

export default function FroamRecord({ open, onClose }: Props) {
  const [entries, setEntries] = useState<RecordEntry[]>([])
  const [verification, setVerification] = useState<Verification | null>(null)
  const [you, setYou] = useState<string | null>(null)
  const [phase, setPhase] = useState<'loading' | 'ready' | 'error'>('loading')
  const [problem, setProblem] = useState<string | null>(null)
  const [kind, setKind] = useState('all')
  const [more, setMore] = useState(false)
  const [naming, setNaming] = useState(false)
  const [name, setName] = useState('')
  const [busy, setBusy] = useState<'report' | 'csv' | 'older' | 'name' | null>(null)
  const closeRef = useRef<HTMLButtonElement | null>(null)

  const load = useCallback(async () => {
    setPhase('loading')
    setProblem(null)
    try {
      const response = await bridgeFetch(`/__froam/record?limit=${PAGE}`)
      const data = await response.json().catch(() => null) as Listing | null
      if (!data?.success) throw new Error(data?.error ?? (response.status === 404 ? 'This version of froam dev has no record yet. Update Froam, then open it again.' : 'Froam couldn’t read the record.'))
      setEntries(data.entries ?? [])
      setVerification(data.verification ?? null)
      setYou(data.you ?? null)
      setMore((data.entries?.length ?? 0) >= PAGE)
      setPhase('ready')
    } catch (error) {
      setProblem(error instanceof Error ? error.message : 'Froam couldn’t reach your computer.')
      setPhase('error')
    }
  }, [])

  useEffect(() => {
    if (!open) return
    setKind('all')
    setNaming(false)
    void load()
  }, [open, load])

  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') { event.preventDefault(); onClose() } }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  useEffect(() => { if (open) closeRef.current?.focus() }, [open])

  async function older() {
    const last = entries.at(-1)
    if (!last) return
    setBusy('older')
    try {
      const data = await (await bridgeFetch(`/__froam/record?limit=${PAGE}&before=${last.seq}`)).json() as Listing
      setEntries((shown) => [...shown, ...(data.entries ?? [])])
      setMore((data.entries?.length ?? 0) >= PAGE)
    } catch {
      setProblem('Couldn’t load older entries.')
    } finally {
      setBusy(null)
    }
  }

  /** The report and the spreadsheet come through the bridge with this device's key, then open from here. */
  async function download(format: 'report' | 'csv') {
    setBusy(format)
    // Opened before the wait, or a phone's browser treats it as a pop-up and blocks it.
    const tab = format === 'report' ? window.open('', '_blank') : null
    try {
      const response = await bridgeFetch(`/__froam/record/report${format === 'csv' ? '?format=csv' : ''}`)
      if (!response.ok) throw new Error()
      const blob = new Blob([await response.text()], { type: format === 'csv' ? 'text/csv;charset=utf-8' : 'text/html;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      if (tab) tab.location.href = url
      else {
        // A spreadsheet, or a report whose tab was blocked: saved as a file instead.
        const link = document.createElement('a')
        link.href = url
        link.download = format === 'csv' ? 'froam-record.csv' : 'froam-record.html'
        document.body.appendChild(link)
        link.click()
        link.remove()
      }
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
    } catch {
      tab?.close()
      setProblem(format === 'csv' ? 'The spreadsheet didn’t download.' : 'The report didn’t open.')
    } finally {
      setBusy(null)
    }
  }

  async function saveName() {
    if (!name.trim()) return
    setBusy('name')
    try {
      const data = await (await bridgeFetch('/__froam/record/name', { method: 'POST', body: JSON.stringify({ name }) })).json() as { success?: boolean; you?: string; error?: string }
      if (!data.success) throw new Error(data.error)
      setYou(data.you ?? name.trim())
      setNaming(false)
    } catch (error) {
      setProblem(error instanceof Error && error.message ? error.message : 'That name didn’t save.')
    } finally {
      setBusy(null)
    }
  }

  if (!open) return null
  const matcher = KINDS.find(([id]) => id === kind)?.[2] ?? (() => true)
  const shown = entries.filter((entry) => matcher(entry.type))
  const days: Array<[string, RecordEntry[]]> = []
  for (const entry of shown) {
    const day = dayOf(entry.at)
    const last = days.at(-1)
    if (last && last[0] === day) last[1].push(entry)
    else days.push([day, [entry]])
  }

  return (
    <div className="froam-golive" data-chef-editor-root="true" onClick={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <div className="froam-golive__card froam-record__card" role="dialog" aria-modal="true" aria-labelledby="froam-record-title" data-chef-editor-root="true">
        <div className="froam-golive__head">
          <h2 id="froam-record-title"><ScrollText size={18} /> Record</h2>
          <button ref={closeRef} type="button" className="froam-golive__close" onClick={onClose} aria-label="Close"><X size={16} /></button>
        </div>

        <div className="froam-golive__body">
          <p className="froam-golive__note">Who changed what on this site, who approved it, and when. Kept in your project and sent with every Go Live.</p>
          {phase === 'loading' && <p className="froam-golive__quiet"><Loader2 size={15} className="froam-golive__spin" /> Reading the record…</p>}
          {phase === 'error' && <p className="froam-golive__problem">{problem}</p>}

          {phase === 'ready' && (
            <>
              {verification && verification.count > 0 && (
                <div className={`froam-record__check${verification.ok ? '' : ' is-broken'}`} role="status">
                  {verification.ok ? <ShieldCheck size={16} /> : <ShieldAlert size={16} />}
                  <div>
                    {verification.ok
                      ? <><strong>Checks out.</strong> {verification.count} entr{verification.count === 1 ? 'y' : 'ies'}, each linked to the one before; none changed since it was written.</>
                      : <><strong>Doesn’t check out at line {verification.problem?.line}.</strong> {verification.problem?.reason} Entries before it are intact.</>}
                    <div className="froam-record__hash" title={verification.head}>Latest hash {verification.head.slice(0, 16)}…</div>
                  </div>
                </div>
              )}

              <div className="froam-record__you">
                {naming
                  ? (
                    <form onSubmit={(event) => { event.preventDefault(); void saveName() }}>
                      <label htmlFor="froam-record-name">Your saves are recorded as</label>
                      <div>
                        <input id="froam-record-name" value={name} maxLength={60} autoFocus onChange={(event) => setName(event.target.value)} placeholder="Your full name" />
                        <button type="submit" disabled={!name.trim() || busy === 'name'}>Save</button>
                      </div>
                    </form>
                  )
                  : (
                    <span>
                      Your saves are recorded as <strong>{you ?? 'Owner'}</strong>
                      <button type="button" className="froam-golive__link" onClick={() => { setName(you ?? ''); setNaming(true) }}><Pencil size={12} /> Change</button>
                    </span>
                  )}
              </div>

              {entries.length > 0 && (
                <div className="froam-record__kinds" role="group" aria-label="Show">
                  {KINDS.map(([id, label]) => (
                    <button key={id} type="button" aria-pressed={kind === id} onClick={() => setKind(id)}>{label}</button>
                  ))}
                </div>
              )}

              {entries.length === 0 && (
                <p className="froam-golive__blocked">Nothing recorded yet. Froam writes here the first time someone saves, asks for a change, approves one, or goes live.</p>
              )}
              {entries.length > 0 && shown.length === 0 && <p className="froam-golive__quiet">Nothing of that kind in what’s loaded.</p>}

              {days.map(([day, list]) => (
                <div key={day} className="froam-record__day" role="group" aria-label={day}>
                  <h3>{day}</h3>
                  <ol>
                    {list.map((entry) => <RecordRow key={entry.seq} entry={entry} />)}
                  </ol>
                </div>
              ))}

              {more && (
                <button type="button" className="froam-golive__secondary froam-record__older" disabled={busy === 'older'} onClick={() => { void older() }}>
                  {busy === 'older' ? <Loader2 size={14} className="froam-golive__spin" /> : <ChevronDown size={14} />} Older entries
                </button>
              )}
              {problem && <p className="froam-golive__problem">{problem}</p>}
            </>
          )}
        </div>

        <div className="froam-golive__foot">
          <button type="button" className="froam-golive__secondary" disabled={phase !== 'ready' || !entries.length || busy === 'csv'} onClick={() => { void download('csv') }}>
            {busy === 'csv' ? <Loader2 size={15} className="froam-golive__spin" /> : <FileDown size={15} />} Spreadsheet
          </button>
          <button type="button" className="froam-golive__primary" disabled={phase !== 'ready' || !entries.length || busy === 'report'} onClick={() => { void download('report') }}>
            {busy === 'report' ? <Loader2 size={15} className="froam-golive__spin" /> : <Printer size={15} />} Report to print
          </button>
        </div>
      </div>
    </div>
  )
}

function RecordRow({ entry }: { entry: RecordEntry }) {
  const changes = entry.changes ?? []
  const total = entry.count ?? changes.length
  const tone = entry.type === 'request.approved' || entry.type === 'live.finished' ? 'good'
    : entry.type === 'request.sent-back' || entry.type === 'request.reverted' || entry.type === 'live.failed' ? 'warn'
      : entry.type === 'request.submitted' ? 'ask' : 'plain'
  return (
    <li className="froam-record__entry" data-tone={tone}>
      <time dateTime={entry.at}>{timeOf(entry.at)}</time>
      <div>
        <p>
          {entry.summary}
          {entry.by.role && entry.by.role !== 'owner' && <span className="froam-record__role">{entry.by.role}</span>}
        </p>
        {(entry.by.via || entry.viewport) && <p className="froam-record__meta">{[entry.by.via, entry.viewport && entry.viewport !== 'desktop' ? `${entry.viewport} view` : null, entry.refs?.commit ? `commit ${entry.refs.commit}` : null].filter(Boolean).join(' · ')}</p>}
        {entry.note && <p className="froam-record__note">“{entry.note}”</p>}
        {entry.result && !entry.type.startsWith('live.') && <p className="froam-record__meta">{entry.result}</p>}
        {changes.length > 0 && (
          <details>
            <summary>{total === 1 ? 'What changed' : `What changed (${total})`}</summary>
            <ul>
              {changes.map((change, index) => (
                <li key={index}>
                  <span>{change.label}</span>
                  {(change.before || change.after) && (
                    <span className="froam-record__diff">
                      {change.before && <del>{change.before}</del>}
                      {change.before && change.after && ' → '}
                      {change.after && <ins>{change.after}</ins>}
                    </span>
                  )}
                </li>
              ))}
              {total > changes.length && <li className="froam-golive__more">and {total - changes.length} more</li>}
            </ul>
          </details>
        )}
      </div>
    </li>
  )
}
