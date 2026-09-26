import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent } from 'react'
import { createPortal } from 'react-dom'
import { ArrowLeft, Camera, Check, Copy, Eye, EyeOff, Link2, MessageSquare, Pencil, RefreshCw, Send, Users, X } from 'lucide-react'
import type { RoomMemberView, RoomRequest } from '../../collab/room'
import type { FroamRole } from '../../collab/types'
import { relativeTime } from '../chef/change-report'
import { shrinkAvatar } from './avatar-image'
import { PersonAvatar } from './PersonAvatar'
import { RoomMessages } from './RoomMessages'
import type { RoomMessaging } from './useRoomMessages'

export type PendingChange = { label: string; before: string | null; after: string | null }

/** What someone tells the room about themselves when they join by link. */
export type JoinProfile = { avatarUrl: string | null; title: string }

type InviteRole = 'editor' | 'contributor' | 'commenter' | 'viewer'
type Tab = 'share' | 'changes' | 'chat' | 'requests'

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

/** A new message peeks out under the button for this long when the panel is closed. */
const PEEK_MS = 6_000

/** Typing in a field is words, not editor shortcuts — but Escape still closes the panel. */
function keepTyping(event: ReactKeyboardEvent<HTMLElement>) {
  if (event.key !== 'Escape') event.stopPropagation()
}

/** The name a fresh studio profile starts with; nobody is actually called that. */
const UNNAMED = 'Froam'

type Props = {
  role: FroamRole | null
  isOwner: boolean
  inRoom: boolean
  /** Has this browser joined the room (so it can talk)? */
  joined: boolean
  myName: string
  /** You, as the room sees you: your profile photo, colour and title. */
  me: RoomMemberView | null
  people: readonly RoomMemberView[]
  /** Invite links by role, once a room is open. A role missing here needs fresh links. */
  links: Partial<Record<InviteRole, string>>
  opening: boolean
  /** Invite links couldn't be made: nothing is serving rooms for this page. */
  shareUnavailable?: boolean
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
  messaging: RoomMessaging
  onEditProfile: () => void
  /** Arrived by an invite link and hasn't said who they are yet. */
  needsName: boolean
  /** Prefills the join card from a studio profile this browser already has. */
  knownProfile?: { name: string; avatarUrl: string | null; title: string } | null
  onJoin: (name: string, profile: JoinProfile) => Promise<void>
}

const ROLE_WELCOME: Partial<Record<FroamRole, string>> = {
  contributor: 'You can edit anything on this page. Nothing goes live until the owner approves it.',
  editor: 'You can edit this page together with the owner, live.',
}

/**
 * Asked once, on arrival by link. This is your profile in the room: the owner
 * sees this face and name on every change you send and every message.
 */
function JoinPrompt({ role, known, onJoin }: {
  role: FroamRole | null
  known?: Props['knownProfile']
  onJoin: Props['onJoin']
}) {
  const [name, setName] = useState(known?.name ?? '')
  const [title, setTitle] = useState(known?.title ?? '')
  const [avatarUrl, setAvatarUrl] = useState<string | null>(known?.avatarUrl ?? null)
  const [photoError, setPhotoError] = useState<string | null>(null)
  const [joining, setJoining] = useState(false)
  const fileRef = useRef<HTMLInputElement | null>(null)

  const pickPhoto = async (file: File | undefined) => {
    if (!file) return
    setPhotoError(null)
    try { setAvatarUrl(await shrinkAvatar(file)) } catch (error) {
      setPhotoError(error instanceof Error ? error.message : 'That image could not be used')
    }
  }

  const join = async () => {
    if (!name.trim()) return
    setJoining(true)
    try { await onJoin(name.trim(), { avatarUrl, title: title.trim() }) } finally { setJoining(false) }
  }

  const shown = name.trim() || 'Your name'
  return (
    <div className="froam-collab__join-backdrop" data-chef-editor-root="true">
      <form
        className="froam-collab__join"
        role="dialog"
        aria-label="Join"
        onSubmit={(event) => { event.preventDefault(); void join() }}
        onKeyDown={(event) => event.stopPropagation()}
      >
        <strong>You’ve been invited</strong>
        <p>{(role && ROLE_WELCOME[role]) ?? 'Join to see this page with the people working on it.'}</p>

        <div className="froam-collab__join-profile">
          <button
            type="button"
            className="froam-collab__photo"
            onClick={() => fileRef.current?.click()}
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => { event.preventDefault(); void pickPhoto(event.dataTransfer.files?.[0]) }}
            aria-label={avatarUrl ? 'Change your photo' : 'Add a photo'}
          >
            <PersonAvatar name={shown} avatarUrl={avatarUrl} size={56} />
            <span className="froam-collab__photo-badge"><Camera size={11} /></span>
          </button>
          <input ref={fileRef} type="file" accept="image/*" hidden onChange={(event) => { void pickPhoto(event.target.files?.[0]); event.target.value = '' }} />
          <div className="froam-collab__join-fields">
            <input className="froam-collab__input" value={name} onChange={(event) => setName(event.target.value)} placeholder="Your name" aria-label="Your name" maxLength={60} autoFocus />
            <input className="froam-collab__input" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="What you do (optional) — e.g. Marketing" aria-label="What you do" maxLength={40} />
          </div>
        </div>
        {photoError && <small className="froam-collab__error">{photoError}</small>}

        <div className="froam-collab__join-preview" aria-hidden="true">
          <small>How the owner will see you</small>
          <div className="froam-collab__who">
            <PersonAvatar name={shown} avatarUrl={avatarUrl} size={26} />
            <span>
              <strong>{shown}</strong>
              <small>{title.trim() || ROLE_LABEL[role ?? 'contributor']} · just now</small>
            </span>
          </div>
        </div>

        <button type="submit" className="froam-collab__primary" disabled={!name.trim() || joining}>{joining ? 'Joining…' : 'Join'}</button>
      </form>
    </div>
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

/** Name, face and what they do — the head of every request and person row. */
function Who({ name, member, detail, onOpen }: {
  name: string
  member?: RoomMemberView | null
  detail: string
  onOpen?: () => void
}) {
  const body = (
    <>
      <PersonAvatar name={member?.name ?? name} color={member?.color} avatarUrl={member?.avatarUrl} size={28} here={member ? member.here : undefined} />
      <span>
        <strong>{member?.name ?? name}</strong>
        <small>{[member?.title, detail].filter(Boolean).join(' · ')}</small>
      </span>
    </>
  )
  return onOpen
    ? <button type="button" className="froam-collab__who is-button" onClick={onOpen}>{body}</button>
    : <div className="froam-collab__who">{body}</div>
}

/** Everything the room knows about one person, and a way to talk to them. */
function ProfileSheet({ member, isMe, requests, onBack, onMessage, onEditProfile, onOpenRequest }: {
  member: RoomMemberView
  isMe: boolean
  requests: readonly RoomRequest[]
  onBack: () => void
  onMessage: () => void
  onEditProfile: () => void
  onOpenRequest?: (request: RoomRequest) => void
}) {
  const theirs = requests.filter((request) => request.actor === member.actor)
  const approved = theirs.filter((request) => request.status === 'approved').length
  const where = member.here
    ? member.routeKey ? `Here now · on ${member.routeKey}` : 'Here now'
    : member.seenAt ? `Away · seen ${relativeTime(member.seenAt)}` : 'Away'
  return (
    <div className="froam-collab__profile" style={{ '--froam-person': member.color } as CSSProperties}>
      <header className="froam-collab__head">
        <button type="button" className="froam-collab__icon" onClick={onBack} aria-label="Back"><ArrowLeft size={14} /></button>
        <span className="froam-collab__muted">{isMe ? 'Your profile' : 'Profile'}</span>
      </header>
      <div className="froam-collab__profile-hero">
        <PersonAvatar name={member.name} color={member.color} avatarUrl={member.avatarUrl} size={64} here={member.here} ring />
        <strong>{isMe ? `${member.name} (you)` : member.name}</strong>
        {member.title && <span className="froam-collab__profile-title">{member.title}</span>}
        <span className="froam-collab__chip">{ROLE_LABEL[member.role]}</span>
      </div>
      <dl className="froam-collab__facts">
        <div><dt>Status</dt><dd>{where}</dd></div>
        {member.joinedAt && <div><dt>Joined</dt><dd>{relativeTime(member.joinedAt)}</dd></div>}
        {(theirs.length > 0 || member.role === 'contributor') && (
          <div><dt>Changes sent</dt><dd>{theirs.length}{theirs.length ? ` · ${approved} approved` : ''}</dd></div>
        )}
      </dl>
      {theirs.length > 0 && (
        <ul className="froam-collab__their-requests">
          {theirs.slice(0, 5).map((request) => (
            <li key={request.id}>
              <button type="button" onClick={() => onOpenRequest?.(request)} disabled={!onOpenRequest}>
                <span>{request.title}</span>
                <small className={`is-${request.status}`}>{STATUS_LABEL[request.status]}</small>
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="froam-collab__actions">
        {isMe
          ? <button type="button" className="froam-collab__primary" onClick={onEditProfile}><Pencil size={12} /> Edit your profile</button>
          : <button type="button" className="froam-collab__primary" onClick={onMessage}><MessageSquare size={13} /> Message {member.name.split(/\s+/)[0]}</button>}
      </div>
    </div>
  )
}

/**
 * Share, talk, and publishing without a developer — everything about working
 * with other people, in one control in the toolbar.
 *
 * The owner invites people by what they may do; everyone in the room talks in
 * Chat; a contributor edits privately and submits; the owner previews a
 * request on the page, then approves (which publishes it) or sends it back.
 * Every request and message carries the sender's profile.
 */
export function FroamCollaborate(props: Props) {
  const { role, isOwner, inRoom, people, requests, messaging } = props
  const isContributor = role === 'contributor'
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState<Tab>(isContributor ? 'changes' : 'share')
  const [title, setTitle] = useState('')
  const [note, setNote] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [copiedRole, setCopiedRole] = useState<InviteRole | null>(null)
  const [replyFor, setReplyFor] = useState<string | null>(null)
  const [reply, setReply] = useState('')
  const [deciding, setDeciding] = useState<string | null>(null)
  const [viewing, setViewing] = useState<string | null>(null)
  const [chatAbout, setChatAbout] = useState<RoomRequest | null>(null)
  const [prefill, setPrefill] = useState<{ text: string; nonce: number } | null>(null)
  const [focusRequest, setFocusRequest] = useState<string | null>(null)
  const [peek, setPeek] = useState<string | null>(null)
  const rootRef = useRef<HTMLDivElement | null>(null)
  const panelRef = useRef<HTMLDivElement | null>(null)
  const openedAtRef = useRef(Date.now())
  const [place, setPlace] = useState<CSSProperties>({})
  const pending = requests.filter((request) => request.status === 'pending')
  const here = people.filter((person) => person.here)

  const everyone = useMemo(() => {
    const map = new Map<string, RoomMemberView>()
    for (const person of people) map.set(person.actor, person)
    if (props.me) map.set(props.me.actor, props.me)
    return map
  }, [people, props.me])
  const person = (actor: string) => everyone.get(actor)

  // A role arrives after the first render (joining takes a moment).
  useEffect(() => { if (isContributor) setTab((current) => (current === 'share' ? 'changes' : current)) }, [isContributor])

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
    if (!open && !peek) return
    const measure = () => {
      const rect = rootRef.current?.getBoundingClientRect()
      if (rect) setPlace({ top: Math.round(rect.bottom + 8), right: Math.max(8, Math.round(window.innerWidth - rect.right)) })
    }
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [open, peek])

  // A new request is what the owner opens this for.
  useEffect(() => { if (isOwner && pending.length) setTab('requests') }, [isOwner, pending.length])

  const toggle = () => {
    if (open) { setOpen(false); return }
    setViewing(null)
    if (messaging.unread > 0 && props.joined) setTab('chat')
    else if (isOwner && pending.length) setTab('requests')
    else if (isContributor) setTab('changes')
    else if (tab === 'chat' && !props.joined) setTab('share')
    setOpen(true)
  }

  // Someone wrote while you weren't looking at the chat: show it for a moment.
  const incoming = messaging.latestIncoming
  useEffect(() => {
    if (!incoming || incoming.createdAt < openedAtRef.current) return
    if (open && tab === 'chat') return
    setPeek(incoming.id)
    const timer = window.setTimeout(() => setPeek((current) => (current === incoming.id ? null : current)), PEEK_MS)
    return () => window.clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [incoming?.id])

  useEffect(() => { if (open && tab === 'chat') setPeek(null) }, [open, tab])

  // Scroll a request into view when something (the chat, a profile) points at it.
  useEffect(() => {
    if (!focusRequest || (tab !== 'requests' && tab !== 'changes')) return
    const node = panelRef.current?.querySelector(`[data-request-id="${CSS.escape(focusRequest)}"]`)
    node?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    const timer = window.setTimeout(() => setFocusRequest(null), 1600)
    return () => window.clearTimeout(timer)
  }, [focusRequest, tab])

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

  const openRequest = (request: RoomRequest) => {
    setViewing(null)
    setTab(isOwner ? 'requests' : 'changes')
    setFocusRequest(request.id)
  }
  const canOpenRequests = isOwner || isContributor

  const discuss = (request: RoomRequest) => {
    setChatAbout(request)
    setTab('chat')
  }

  const messagePerson = (member: RoomMemberView) => {
    setViewing(null)
    setTab('chat')
    setPrefill({ text: `@${member.name.split(/\s+/)[0]} `, nonce: Date.now() })
  }

  const openChatFromPeek = () => {
    setPeek(null)
    setOpen(true)
    setTab('chat')
  }

  const needsFreshLinks = inRoom && isOwner && !props.links.contributor
  const badge = isOwner ? pending.length : isContributor ? props.pendingChanges.length : 0
  const viewingMember = viewing ? person(viewing) : null
  const peekMessage = peek ? messaging.messages.find((message) => message.id === peek) : null
  const peekAuthor = peekMessage ? person(peekMessage.actor) : null
  const portal = typeof document !== 'undefined' ? document.getElementById('froam-editor-portal') ?? document.body : null
  const tabs: Array<{ id: Tab; label: string; count?: number; tone?: 'chat' }> = isContributor
    ? [{ id: 'changes', label: 'Your changes', count: props.pendingChanges.length }, { id: 'chat', label: 'Chat', count: messaging.unread, tone: 'chat' }]
    : [
        { id: 'share', label: 'Share' },
        ...(props.joined ? [{ id: 'chat' as const, label: 'Chat', count: messaging.unread, tone: 'chat' as const }] : []),
        ...(isOwner ? [{ id: 'requests' as const, label: 'Requests', count: pending.length }] : []),
      ]

  const requestCard = (request: RoomRequest, mode: 'owner' | 'sender') => {
    const previewing = props.previewingId === request.id
    const sender = person(request.actor)
    return (
      <article key={request.id} data-request-id={request.id} className={`froam-collab__request is-${request.status}${focusRequest === request.id ? ' is-focused' : ''}`}>
        {mode === 'owner' && (
          <Who
            name={request.createdBy}
            member={sender}
            detail={`${relativeTime(request.createdAt)} · ${request.routeKey}`}
            onOpen={sender ? () => setViewing(sender.actor) : undefined}
          />
        )}
        <div className="froam-collab__request-head">
          <strong>{request.title}</strong>
          <span className="froam-collab__status">{STATUS_LABEL[request.status]}</span>
        </div>
        {mode === 'sender' && (
          <small>{relativeTime(request.decidedAt ?? request.createdAt)}{request.decidedBy ? ` · ${request.decidedBy}` : ''}</small>
        )}
        {request.note && mode === 'owner' && <blockquote>“{request.note}”</blockquote>}
        {mode === 'owner' && <ChangeList changes={request.changes} />}
        {request.published?.detail && request.status === 'approved' && mode === 'owner' && <p className="froam-collab__muted">{request.published.detail}</p>}
        {request.decisionNote && request.status !== 'pending' && (
          <blockquote>{mode === 'owner' ? 'You' : request.decidedBy ?? 'Owner'}: “{request.decisionNote}”</blockquote>
        )}
        {mode === 'owner' && request.status === 'pending' && (
          replyFor === request.id ? (
            <div className="froam-collab__reply">
              <textarea
                className="froam-collab__input"
                value={reply}
                onChange={(event) => setReply(event.target.value)}
                onKeyDown={keepTyping}
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
              {props.joined && <button type="button" className="froam-collab__ghost" onClick={() => discuss(request)}><MessageSquare size={12} /> Discuss</button>}
              <button type="button" className="froam-collab__secondary" onClick={() => setReplyFor(request.id)}>Request changes</button>
              <button type="button" className="froam-collab__primary" disabled={deciding === request.id} onClick={() => void decide(request, 'approved')}>
                <Check size={13} /> {deciding === request.id ? 'Publishing…' : 'Approve & publish'}
              </button>
            </div>
          )
        )}
        {mode === 'owner' && request.status !== 'pending' && props.joined && (
          <div className="froam-collab__actions">
            <button type="button" className="froam-collab__ghost" onClick={() => discuss(request)}><MessageSquare size={12} /> Discuss</button>
          </div>
        )}
        {mode === 'sender' && (
          <div className="froam-collab__actions">
            {props.joined && <button type="button" className="froam-collab__ghost" onClick={() => discuss(request)}><MessageSquare size={12} /> Discuss</button>}
            {request.status === 'pending' && <button type="button" className="froam-collab__ghost" onClick={() => props.onWithdraw(request)}>Withdraw</button>}
          </div>
        )}
      </article>
    )
  }

  return (
    <div className="froam-collab" ref={rootRef} data-chef-editor-root="true">
      {props.needsName && portal && createPortal(<JoinPrompt role={role} known={props.knownProfile} onJoin={props.onJoin} />, portal)}
      <button
        type="button"
        className={`froam-collab__trigger${open ? ' is-open' : ''}`}
        onClick={toggle}
        aria-expanded={open}
        aria-haspopup="dialog"
        title={isContributor ? 'Your suggested changes and chat' : 'Share, chat and review'}
        data-chef-editor-root="true"
      >
        {here.length > 0 && (
          <span className="froam-collab__faces">
            {here.slice(0, 3).map((member) => <PersonAvatar key={member.actor} name={member.name} color={member.color} avatarUrl={member.avatarUrl} size={18} ring />)}
            {here.length > 3 && <span className="froam-collab__more">+{here.length - 3}</span>}
          </span>
        )}
        {isContributor ? <Send size={13} /> : <Users size={13} />}
        <span>{isContributor ? 'Submit' : 'Share'}</span>
        {badge > 0 && (
          <span className="froam-collab__badge" aria-label={isOwner ? `${pending.length} waiting for approval` : `${props.pendingChanges.length} changes`}>{badge}</span>
        )}
        {messaging.unread > 0 && (
          <span className="froam-collab__badge is-chat" aria-label={`${messaging.unread} unread messages`}><MessageSquare size={9} />{messaging.unread}</span>
        )}
      </button>

      {!open && peekMessage && portal && createPortal(
        <button type="button" className="froam-collab__peek" style={place} onClick={openChatFromPeek} data-chef-editor-root="true">
          <PersonAvatar name={peekAuthor?.name ?? peekMessage.name} color={peekAuthor?.color} avatarUrl={peekAuthor?.avatarUrl} size={28} />
          <span>
            <strong>{peekAuthor?.name ?? peekMessage.name}</strong>
            <span>{peekMessage.body}</span>
          </span>
          <span className="froam-collab__peek-reply">Reply</span>
        </button>,
        portal,
      )}

      {open && portal && createPortal(
        <div className="froam-collab__panel" ref={panelRef} style={place} role="dialog" aria-label={isContributor ? 'Your changes and chat' : 'Share, chat and review'} data-chef-editor-root="true">
          {viewingMember ? (
            <ProfileSheet
              member={viewingMember}
              isMe={viewingMember.actor === props.me?.actor}
              requests={requests}
              onBack={() => setViewing(null)}
              onMessage={() => messagePerson(viewingMember)}
              onEditProfile={() => { setOpen(false); props.onEditProfile() }}
              onOpenRequest={canOpenRequests ? openRequest : undefined}
            />
          ) : (
            <>
              <header className="froam-collab__head">
                <div className="froam-collab__tabs" role="tablist">
                  {tabs.map((item) => (
                    <button key={item.id} type="button" role="tab" aria-selected={tab === item.id} className={tab === item.id ? 'is-active' : ''} onClick={() => setTab(item.id)}>
                      {item.label}
                      {item.count ? <span className={`froam-collab__badge${item.tone === 'chat' ? ' is-chat' : ''}`}>{item.count}</span> : null}
                    </button>
                  ))}
                </div>
                <button type="button" className="froam-collab__icon" onClick={() => setOpen(false)} aria-label="Close"><X size={14} /></button>
              </header>

              {tab === 'changes' && isContributor && (
                <>
                  <p className="froam-collab__intro">
                    Edit anything on the page. Nothing goes live until the owner approves it.
                  </p>
                  <section className="froam-collab__section">
                    <h4>Your changes <small>{props.pendingChanges.length}</small></h4>
                    <ChangeList changes={props.pendingChanges} />
                    <input
                      className="froam-collab__input"
                      value={title}
                      onChange={(event) => setTitle(event.target.value)}
                      onKeyDown={keepTyping}
                      placeholder="What is this? e.g. Spring sale copy"
                      aria-label="Title for your changes"
                      maxLength={120}
                    />
                    <textarea
                      className="froam-collab__input"
                      value={note}
                      onChange={(event) => setNote(event.target.value)}
                      onKeyDown={keepTyping}
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
                      {requests.map((request) => requestCard(request, 'sender'))}
                    </section>
                  )}
                  {props.me && (
                    <section className="froam-collab__section">
                      <Who name={props.myName} member={props.me} detail="This is how the owner sees you" onOpen={() => setViewing(props.me!.actor)} />
                    </section>
                  )}
                </>
              )}

              {tab === 'chat' && (
                <RoomMessages
                  messaging={messaging}
                  me={props.me?.actor ?? null}
                  myName={props.me?.name ?? props.myName}
                  person={person}
                  requests={requests}
                  active={open && tab === 'chat'}
                  context={chatAbout}
                  onClearContext={() => setChatAbout(null)}
                  onOpenRequest={canOpenRequests ? openRequest : undefined}
                  onOpenPerson={(actor) => { if (person(actor)) setViewing(actor) }}
                  prefill={prefill}
                  canModerate={isOwner || role === 'editor'}
                  joined={props.joined}
                />
              )}

              {tab === 'share' && !isContributor && (
                !inRoom ? (
                  <section className="froam-collab__section froam-collab__empty">
                    <Link2 size={22} />
                    <strong>Bring people in</strong>
                    <p>Anyone with a link can join — no account needed. You choose what each link can do, and everyone can talk here in Chat.</p>
                    {props.shareUnavailable ? (
                      <div className="froam-collab__unavailable" role="status">
                        <strong>Sharing needs Froam running with your site</strong>
                        <p>Invite links are served by Froam itself, and this page isn’t connected to it. In your project, run:</p>
                        <code>npx @ahmadastic/froam</code>
                        <p>Then open Share there — add <code>--host</code> so people on your network can join.</p>
                      </div>
                    ) : (
                      <button type="button" className="froam-collab__primary" disabled={props.opening} onClick={() => props.onOpenRoom(false)}>
                        {props.opening ? 'Opening…' : 'Create invite links'}
                      </button>
                    )}
                  </section>
                ) : (
                  <>
                    {isOwner && (props.me?.name ?? props.myName) === UNNAMED && (
                      <p className="froam-collab__notice is-profile">
                        People see you as “{UNNAMED}”.{' '}
                        <button type="button" className="froam-collab__link" onClick={() => { setOpen(false); props.onEditProfile() }}>Add your name and photo</button>
                      </p>
                    )}
                    {needsFreshLinks && (
                      <p className="froam-collab__notice">
                        This room predates “Can suggest changes”.{' '}
                        <button type="button" className="froam-collab__link" onClick={() => props.onOpenRoom(true)}>Create new links</button>
                      </p>
                    )}
                    {isOwner && (
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
                        <button type="button" className="froam-collab__ghost" onClick={() => props.onOpenRoom(true)}>
                          <RefreshCw size={12} /> Reset links (old ones stop working)
                        </button>
                      </section>
                    )}
                    <section className="froam-collab__section">
                      <h4>People <small>{here.length + (props.me ? 1 : 0)} here</small></h4>
                      <ul className="froam-collab__people">
                        {props.me && (
                          <li>
                            <Who name={props.myName} member={props.me} detail={`${ROLE_LABEL[props.me.role]} · you`} onOpen={() => setViewing(props.me!.actor)} />
                            <button type="button" className="froam-collab__ghost" onClick={() => { setOpen(false); props.onEditProfile() }}><Pencil size={11} /> Profile</button>
                          </li>
                        )}
                        {people.map((member) => (
                          <li key={member.actor}>
                            <Who
                              name={member.name}
                              member={member}
                              detail={`${ROLE_LABEL[member.role]}${member.here ? (member.routeKey ? ` · on ${member.routeKey}` : ' · here') : ' · away'}`}
                              onOpen={() => setViewing(member.actor)}
                            />
                            {props.joined && (
                              <button type="button" className="froam-collab__icon" onClick={() => messagePerson(member)} aria-label={`Message ${member.name}`}><MessageSquare size={13} /></button>
                            )}
                          </li>
                        ))}
                      </ul>
                      {people.length === 0 && <p className="froam-collab__muted">Nobody else has joined yet. Copy a link above and send it to someone.</p>}
                    </section>
                  </>
                )
              )}

              {tab === 'requests' && isOwner && (
                <section className="froam-collab__section">
                  {requests.length === 0 && <p className="froam-collab__muted">No requests yet. Send a “Can suggest changes” link to someone who isn’t a developer — what they submit lands here, with their name and photo.</p>}
                  {requests.map((request) => requestCard(request, 'owner'))}
                </section>
              )}
            </>
          )}
        </div>,
        portal,
      )}
    </div>
  )
}
