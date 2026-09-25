import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import { Check, Copy, Eye, EyeOff, Link2, RefreshCw, Send, Users, X } from 'lucide-react'
import type { RoomMemberView, RoomRequest } from '../../collab/room'
import type { FroamRole } from '../../collab/types'
import { relativeTime } from '../chef/change-report'

export type PendingChange = { label: string; before: string | null; after: string | null }

type InviteRole = 'editor' | 'contributor' | 'commenter' | 'viewer'

const INVITES: Array<{ role: InviteRole; title: string; body: string }> = [
  { role: 'contributor', title: 'Can suggest changes', body: 'For teammates who aren’t developers: they edit freely, then send it to you to approve.' },
  { role: 'editor', title: 'Can edit together', body: 'Designers and developers: edit the page with you, live.' },
  { role: 'commenter', title: 'Can comment', body: 'Clients: leave notes and approve designs.' },
  { role: 'viewer', title: 'Can view', body: 'See the page follow along, nothing more.' },
]

const ROLE_LABEL: Record<FroamRole, string> = {
  owner: 'Owner',
  editor: 'Editing',
  contributor: 'Suggesting',
  commenter: 'Commenting',
  viewer: 'Viewing',
}

const STATUS_LABEL: Record<RoomRequest['status'], string> = {
  pending: 'Waiting for approval',
  approved: 'Approved · live',
  'changes-requested': 'Changes requested',
  withdrawn: 'Withdrawn',
}

type Props = {
  role: FroamRole | null
  isOwner: boolean
  inRoom: boolean
  myName: string
  people: readonly RoomMemberView[]
  /** Invite links by role, once a room is open. A role missing here needs fresh links. */
  links: Partial<Record<InviteRole, string>>
  opening: boolean
  onOpenRoom: (fresh: boolean) => void
  onCopyLink: (link: string, role: InviteRole) => void
  requests: readonly RoomRequest[]
  /** Contributor: what they've changed since they joined. */
  pendingChanges: readonly PendingChange[]
  onSubmit: (title: string, note: string) => Promise<boolean>
  onWithdraw: (request: RoomRequest) => void
  /** Owner: show a request on the page without applying it. */
  previewingId: string | null
  onPreview: (request: RoomRequest | null) => void
  onDecide: (request: RoomRequest, decision: 'approved' | 'changes-requested', note: string) => Promise<void>
  onEditName: () => void
  /** Arrived by an invite link and hasn't said who they are yet. */
  needsName: boolean
  onJoin: (name: string) => Promise<void>
}

const ROLE_WELCOME: Partial<Record<FroamRole, string>> = {
  contributor: 'You can edit anything on this page. Nothing goes live until the owner approves it.',
  editor: 'You can edit this page together with the owner, live.',
}

/** Asked once, on arrival by link: the name is what the owner sees on your changes. */
function JoinPrompt({ role, onJoin }: { role: FroamRole | null; onJoin: (name: string) => Promise<void> }) {
  const [name, setName] = useState('')
  const [joining, setJoining] = useState(false)
  const join = async () => {
    if (!name.trim()) return
    setJoining(true)
    try { await onJoin(name.trim()) } finally { setJoining(false) }
  }
  return (
    <div className="froam-collab__join-backdrop" data-chef-editor-root="true">
      <form className="froam-collab__join" role="dialog" aria-label="Join" onSubmit={(event) => { event.preventDefault(); void join() }}>
        <strong>You’ve been invited</strong>
        <p>{(role && ROLE_WELCOME[role]) ?? 'Join to see this page with the people working on it.'}</p>
        <input className="froam-collab__input" value={name} onChange={(event) => setName(event.target.value)} placeholder="Your name" aria-label="Your name" maxLength={60} autoFocus />
        <button type="submit" className="froam-collab__primary" disabled={!name.trim() || joining}>{joining ? 'Joining…' : 'Join'}</button>
      </form>
    </div>
  )
}

function Avatar({ name, color, here = true }: { name: string; color?: string; here?: boolean }) {
  const initials = name.split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase() || '?'
  return (
    <span className={`froam-collab__avatar${here ? '' : ' is-away'}`} style={{ background: color ?? '#64748b' }} title={name} aria-hidden="true">
      {initials}
    </span>
  )
}

function ChangeList({ changes }: { changes: readonly PendingChange[] }) {
  if (!changes.length) return <p className="froam-collab__muted">No changes yet — edit the page and they’ll appear here.</p>
  return (
    <ul className="froam-collab__changes">
      {changes.slice(0, 12).map((change, index) => (
        <li key={`${change.label}-${index}`}>
          <strong>{change.label}</strong>
          {(change.before || change.after) && (
            <span>
              {change.before && <del>{change.before}</del>}
              {change.before && change.after && <span aria-hidden="true"> → </span>}
              {change.after && <ins>{change.after}</ins>}
            </span>
          )}
        </li>
      ))}
      {changes.length > 12 && <li className="froam-collab__muted">and {changes.length - 12} more</li>}
    </ul>
  )
}

/**
 * Share, together, and publishing without a developer.
 *
 * One control in the toolbar: who is here, and what they're waiting on. The
 * owner invites people by what they may do; a contributor edits privately and
 * submits; the owner previews a request on the page, then approves (which
 * publishes it) or sends it back with a note.
 */
export function FroamCollaborate(props: Props) {
  const { role, isOwner, inRoom, people, requests } = props
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState<'share' | 'requests'>('share')
  const [title, setTitle] = useState('')
  const [note, setNote] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [copiedRole, setCopiedRole] = useState<InviteRole | null>(null)
  const [replyFor, setReplyFor] = useState<string | null>(null)
  const [reply, setReply] = useState('')
  const [deciding, setDeciding] = useState<string | null>(null)
  const rootRef = useRef<HTMLDivElement | null>(null)
  const panelRef = useRef<HTMLDivElement | null>(null)
  const [place, setPlace] = useState<CSSProperties>({})
  const isContributor = role === 'contributor'
  const pending = requests.filter((request) => request.status === 'pending')
  const here = people.filter((person) => person.here)

  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(false) }
    const onDown = (event: PointerEvent) => {
      const target = event.target as Node
      if (rootRef.current?.contains(target) || panelRef.current?.contains(target)) return
      setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('pointerdown', onDown, true)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('pointerdown', onDown, true)
    }
  }, [open])

  // The panel is drawn above everything (the floating bar included), under its button.
  useLayoutEffect(() => {
    if (!open) return
    const measure = () => {
      const rect = rootRef.current?.getBoundingClientRect()
      if (rect) setPlace({ top: Math.round(rect.bottom + 8), right: Math.max(8, Math.round(window.innerWidth - rect.right)) })
    }
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [open])

  // A new request is what the owner opens this for.
  useEffect(() => { if (isOwner && pending.length) setTab('requests') }, [isOwner, pending.length])

  const copy = (link: string, inviteRole: InviteRole) => {
    props.onCopyLink(link, inviteRole)
    setCopiedRole(inviteRole)
    window.setTimeout(() => setCopiedRole((current) => (current === inviteRole ? null : current)), 1800)
  }

  const submit = async () => {
    setSubmitting(true)
    const ok = await props.onSubmit(title.trim(), note.trim())
    setSubmitting(false)
    if (ok) { setTitle(''); setNote('') }
  }

  const decide = async (request: RoomRequest, decision: 'approved' | 'changes-requested') => {
    setDeciding(request.id)
    try {
      await props.onDecide(request, decision, decision === 'changes-requested' ? reply.trim() : '')
      setReplyFor(null)
      setReply('')
    } finally {
      setDeciding(null)
    }
  }

  const needsFreshLinks = inRoom && isOwner && !props.links.contributor

  return (
    <div className="froam-collab" ref={rootRef} data-chef-editor-root="true">
      {props.needsName && typeof document !== 'undefined' && createPortal(<JoinPrompt role={role} onJoin={props.onJoin} />, document.getElementById('froam-editor-portal') ?? document.body)}
      <button
        type="button"
        className={`froam-collab__trigger${open ? ' is-open' : ''}`}
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-haspopup="dialog"
        title={isContributor ? 'Your suggested changes' : 'Share and review'}
        data-chef-editor-root="true"
      >
        {here.length > 0 && (
          <span className="froam-collab__faces">
            {here.slice(0, 3).map((person) => <Avatar key={person.actor} name={person.name} color={person.color} />)}
            {here.length > 3 && <span className="froam-collab__more">+{here.length - 3}</span>}
          </span>
        )}
        {isContributor ? <Send size={13} /> : <Users size={13} />}
        <span>{isContributor ? 'Submit' : 'Share'}</span>
        {(isOwner ? pending.length : isContributor ? props.pendingChanges.length : 0) > 0 && (
          <span className="froam-collab__badge" aria-label={isOwner ? `${pending.length} waiting for approval` : `${props.pendingChanges.length} changes`}>
            {isOwner ? pending.length : props.pendingChanges.length}
          </span>
        )}
      </button>

      {open && typeof document !== 'undefined' && createPortal(
        <div className="froam-collab__panel" ref={panelRef} style={place} role="dialog" aria-label={isContributor ? 'Submit your changes' : 'Share and review'} data-chef-editor-root="true">
          {isContributor ? (
            <>
              <header className="froam-collab__head">
                <strong>Suggest changes</strong>
                <button type="button" className="froam-collab__icon" onClick={() => setOpen(false)} aria-label="Close"><X size={14} /></button>
              </header>
              <p className="froam-collab__intro">
                Edit anything on the page. Nothing goes live until the owner approves it.
                <button type="button" className="froam-collab__link" onClick={props.onEditName}>You’re “{props.myName}”</button>
              </p>
              <section className="froam-collab__section">
                <h4>Your changes <small>{props.pendingChanges.length}</small></h4>
                <ChangeList changes={props.pendingChanges} />
                <input
                  className="froam-collab__input"
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder="What is this? e.g. Spring sale copy"
                  aria-label="Title for your changes"
                  maxLength={120}
                />
                <textarea
                  className="froam-collab__input"
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  placeholder="Anything the owner should know (optional)"
                  aria-label="Note for the owner"
                  rows={2}
                />
                <button type="button" className="froam-collab__primary" disabled={!props.pendingChanges.length || submitting} onClick={() => void submit()}>
                  <Send size={13} /> {submitting ? 'Sending…' : 'Submit for approval'}
                </button>
              </section>
              {requests.length > 0 && (
                <section className="froam-collab__section">
                  <h4>Sent</h4>
                  {requests.map((request) => (
                    <article key={request.id} className={`froam-collab__request is-${request.status}`}>
                      <div className="froam-collab__request-head">
                        <strong>{request.title}</strong>
                        <span className="froam-collab__status">{STATUS_LABEL[request.status]}</span>
                      </div>
                      <small>{relativeTime(request.decidedAt ?? request.createdAt)}{request.decidedBy ? ` · ${request.decidedBy}` : ''}</small>
                      {request.decisionNote && <blockquote>“{request.decisionNote}”</blockquote>}
                      {request.status === 'pending' && (
                        <button type="button" className="froam-collab__ghost" onClick={() => props.onWithdraw(request)}>Withdraw</button>
                      )}
                    </article>
                  ))}
                </section>
              )}
            </>
          ) : (
            <>
              <header className="froam-collab__head">
                <div className="froam-collab__tabs" role="tablist">
                  <button type="button" role="tab" aria-selected={tab === 'share'} className={tab === 'share' ? 'is-active' : ''} onClick={() => setTab('share')}>Share</button>
                  {isOwner && (
                    <button type="button" role="tab" aria-selected={tab === 'requests'} className={tab === 'requests' ? 'is-active' : ''} onClick={() => setTab('requests')}>
                      Requests{pending.length ? <span className="froam-collab__badge">{pending.length}</span> : null}
                    </button>
                  )}
                </div>
                <button type="button" className="froam-collab__icon" onClick={() => setOpen(false)} aria-label="Close"><X size={14} /></button>
              </header>

              {tab === 'share' && (
                !inRoom ? (
                  <section className="froam-collab__section froam-collab__empty">
                    <Link2 size={22} />
                    <strong>Bring people in</strong>
                    <p>Anyone with a link can join — no account needed. You choose what each link can do.</p>
                    <button type="button" className="froam-collab__primary" disabled={props.opening} onClick={() => props.onOpenRoom(false)}>
                      {props.opening ? 'Opening…' : 'Create invite links'}
                    </button>
                  </section>
                ) : (
                  <>
                    {needsFreshLinks && (
                      <p className="froam-collab__notice">
                        This room predates “Can suggest changes”.{' '}
                        <button type="button" className="froam-collab__link" onClick={() => props.onOpenRoom(true)}>Create new links</button>
                      </p>
                    )}
                    <section className="froam-collab__section">
                      {INVITES.map((invite) => {
                        const link = props.links[invite.role]
                        return (
                          <div key={invite.role} className="froam-collab__invite">
                            <div>
                              <strong>{invite.title}</strong>
                              <p>{invite.body}</p>
                            </div>
                            <button
                              type="button"
                              className="froam-collab__copy"
                              disabled={!link}
                              onClick={() => link && copy(link, invite.role)}
                              aria-label={`Copy the “${invite.title}” link`}
                            >
                              {copiedRole === invite.role ? <><Check size={12} /> Copied</> : <><Copy size={12} /> Copy link</>}
                            </button>
                          </div>
                        )
                      })}
                      {isOwner && (
                        <button type="button" className="froam-collab__ghost" onClick={() => props.onOpenRoom(true)}>
                          <RefreshCw size={12} /> Reset links (old ones stop working)
                        </button>
                      )}
                    </section>
                    <section className="froam-collab__section">
                      <h4>People <small>{here.length} here</small></h4>
                      {people.length === 0 ? (
                        <p className="froam-collab__muted">Nobody has joined yet.</p>
                      ) : (
                        <ul className="froam-collab__people">
                          {people.map((person) => (
                            <li key={person.actor}>
                              <Avatar name={person.name} color={person.color} here={person.here} />
                              <span className="froam-collab__person">
                                <strong>{person.name}</strong>
                                <small>{ROLE_LABEL[person.role]}{person.here ? (person.routeKey ? ` · on ${person.routeKey}` : ' · here') : ' · away'}</small>
                              </span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </section>
                  </>
                )
              )}

              {tab === 'requests' && isOwner && (
                <section className="froam-collab__section">
                  {requests.length === 0 && <p className="froam-collab__muted">No requests yet. Send a “Can suggest changes” link to someone who isn’t a developer — what they submit lands here.</p>}
                  {requests.map((request) => {
                    const previewing = props.previewingId === request.id
                    return (
                      <article key={request.id} className={`froam-collab__request is-${request.status}`}>
                        <div className="froam-collab__request-head">
                          <strong>{request.title}</strong>
                          <span className="froam-collab__status">{STATUS_LABEL[request.status]}</span>
                        </div>
                        <small>{request.createdBy} · {relativeTime(request.createdAt)} · {request.routeKey}</small>
                        {request.note && <blockquote>“{request.note}”</blockquote>}
                        <ChangeList changes={request.changes} />
                        {request.published?.detail && request.status === 'approved' && <p className="froam-collab__muted">{request.published.detail}</p>}
                        {request.decisionNote && request.status !== 'pending' && <blockquote>You: “{request.decisionNote}”</blockquote>}
                        {request.status === 'pending' && (
                          replyFor === request.id ? (
                            <div className="froam-collab__reply">
                              <textarea
                                className="froam-collab__input"
                                value={reply}
                                onChange={(event) => setReply(event.target.value)}
                                placeholder="What should change?"
                                aria-label="What should change"
                                rows={2}
                                autoFocus
                              />
                              <div className="froam-collab__actions">
                                <button type="button" className="froam-collab__ghost" onClick={() => { setReplyFor(null); setReply('') }}>Cancel</button>
                                <button type="button" className="froam-collab__secondary" disabled={deciding === request.id} onClick={() => void decide(request, 'changes-requested')}>Send back</button>
                              </div>
                            </div>
                          ) : (
                            <div className="froam-collab__actions">
                              <button type="button" className="froam-collab__ghost" onClick={() => props.onPreview(previewing ? null : request)} aria-pressed={previewing}>
                                {previewing ? <><EyeOff size={12} /> Stop preview</> : <><Eye size={12} /> Preview</>}
                              </button>
                              <button type="button" className="froam-collab__secondary" onClick={() => setReplyFor(request.id)}>Request changes</button>
                              <button type="button" className="froam-collab__primary" disabled={deciding === request.id} onClick={() => void decide(request, 'approved')}>
                                <Check size={13} /> {deciding === request.id ? 'Publishing…' : 'Approve & publish'}
                              </button>
                            </div>
                          )
                        )}
                      </article>
                    )
                  })}
                </section>
              )}
            </>
          )}
        </div>,
        document.getElementById('froam-editor-portal') ?? document.body,
      )}
    </div>
  )
}
