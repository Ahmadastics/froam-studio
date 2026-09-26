import { Fragment, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { ArrowDown, CornerDownLeft, FileDiff, RotateCcw, Send, X } from 'lucide-react'
import type { RoomMemberView, RoomRequest } from '../../collab/room'
import type { RoomMessage, RoomMessaging } from './useRoomMessages'
import { PersonAvatar } from './PersonAvatar'

/** Messages from one person closer together than this read as one thought. */
const GROUP_WINDOW_MS = 5 * 60 * 1000

type Activity = {
  kind: 'activity'
  id: string
  at: number
  actor: string | null
  text: ReactNode
  request: RoomRequest
}

type Entry = { kind: 'message'; id: string; at: number; message: RoomMessage } | Activity

const clock = (ts: number) => new Date(ts).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })

function dayLabel(ts: number) {
  const day = new Date(ts)
  const today = new Date()
  const yesterday = new Date(Date.now() - 86_400_000)
  if (day.toDateString() === today.toDateString()) return 'Today'
  if (day.toDateString() === yesterday.toDateString()) return 'Yesterday'
  return day.toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' })
}

/** Links stay links; everything else is text (never HTML). */
function Linkified({ text }: { text: string }) {
  const parts = text.split(/(https?:\/\/[^\s<>"']+)/g)
  return (
    <>
      {parts.map((part, index) =>
        /^https?:\/\//.test(part)
          ? <a key={index} href={part} target="_blank" rel="noopener noreferrer">{part}</a>
          : <Fragment key={index}>{part}</Fragment>,
      )}
    </>
  )
}

/** What happened to requests, told in the same timeline as the talk about them. */
function requestActivity(requests: readonly RoomRequest[], me: string | null, myName: string | null): Activity[] {
  const items: Activity[] = []
  for (const request of requests) {
    const sender = request.actor === me ? 'You' : request.createdBy
    items.push({
      kind: 'activity',
      id: `${request.id}:sent`,
      at: request.createdAt,
      actor: request.actor,
      request,
      text: <>{sender} sent <b>{request.title}</b> for approval</>,
    })
    if (request.decidedAt && request.status !== 'pending') {
      const who = request.decidedBy && request.decidedBy === myName ? 'You' : request.decidedBy ?? 'The owner'
      const verb = request.status === 'approved'
        ? 'approved and published'
        : request.status === 'withdrawn'
          ? 'withdrew'
          : 'asked for changes to'
      items.push({
        kind: 'activity',
        id: `${request.id}:${request.status}`,
        at: request.decidedAt,
        actor: null,
        request,
        text: <>{request.status === 'withdrawn' ? sender : who} {verb} <b>{request.title}</b></>,
      })
    }
  }
  return items
}

/**
 * The room's conversation: messages, and what happened to every request, in
 * one place — so "can you make it shorter?" sits right under the change it
 * is about.
 */
export function RoomMessages({
  messaging,
  me,
  myName,
  person,
  requests,
  active,
  context,
  onClearContext,
  onOpenRequest,
  onOpenPerson,
  prefill,
  canModerate,
  joined,
}: {
  messaging: RoomMessaging
  me: string | null
  /** Decisions are recorded by name; yours read as "You". */
  myName?: string | null
  person: (actor: string) => RoomMemberView | undefined
  requests: readonly RoomRequest[]
  /** The tab is on screen: counts as reading. */
  active: boolean
  /** The request this message will be about, when replying from a request. */
  context: RoomRequest | null
  onClearContext: () => void
  onOpenRequest?: (request: RoomRequest) => void
  onOpenPerson?: (actor: string) => void
  /** Text to put in the composer (e.g. "@Maya "), with a nonce so the same text can be sent twice. */
  prefill?: { text: string; nonce: number } | null
  canModerate: boolean
  joined: boolean
}) {
  const [draft, setDraft] = useState('')
  const [atBottom, setAtBottom] = useState(true)
  const listRef = useRef<HTMLDivElement | null>(null)
  const inputRef = useRef<HTMLTextAreaElement | null>(null)
  const lastCountRef = useRef(0)
  const requestsById = useMemo(() => new Map(requests.map((request) => [request.id, request])), [requests])

  const entries = useMemo<Entry[]>(() => {
    const list: Entry[] = [
      ...messaging.messages.map((message) => ({ kind: 'message' as const, id: message.id, at: message.createdAt, message })),
      ...requestActivity(requests, me, myName ?? null),
    ]
    return list.sort((a, b) => a.at - b.at)
  }, [messaging.messages, requests, me, myName])

  useEffect(() => { if (active && atBottom) messaging.markRead() }, [active, atBottom, messaging])

  useEffect(() => {
    if (!prefill) return
    setDraft((current) => (current.includes(prefill.text) ? current : `${prefill.text}${current}`))
    window.setTimeout(() => inputRef.current?.focus(), 0)
  }, [prefill])

  useEffect(() => { if (context) window.setTimeout(() => inputRef.current?.focus(), 0) }, [context])

  // Follow the conversation while you're at the end of it; if you've scrolled
  // up to read, stay put and offer a way down instead of yanking you.
  useLayoutEffect(() => {
    const list = listRef.current
    if (!list) return
    const grew = entries.length > lastCountRef.current
    const mineLast = entries[entries.length - 1]?.kind === 'message'
      && (entries[entries.length - 1] as { message: RoomMessage }).message.actor === me
    lastCountRef.current = entries.length
    if (grew && (atBottom || mineLast)) list.scrollTop = list.scrollHeight
  }, [entries, atBottom, me])

  useLayoutEffect(() => {
    const list = listRef.current
    if (active && list) list.scrollTop = list.scrollHeight
  }, [active])

  // Grow with what you type, up to a few lines.
  useLayoutEffect(() => {
    const input = inputRef.current
    if (!input) return
    input.style.height = 'auto'
    input.style.height = `${Math.min(input.scrollHeight, 120)}px`
  }, [draft])

  const onScroll = () => {
    const list = listRef.current
    if (!list) return
    setAtBottom(list.scrollHeight - list.scrollTop - list.clientHeight < 24)
  }

  const send = async () => {
    const body = draft.trim()
    if (!body) return
    setDraft('')
    onClearContext()
    await messaging.send(body, context?.id ?? null)
  }

  const pendingProposals = canModerate ? messaging.proposals.filter((proposal) => proposal.status === 'pending') : []

  let lastDay = ''
  let previous: Entry | null = null

  return (
    <div className="froam-chat" data-chef-editor-root="true">
      {pendingProposals.length > 0 && (
        <div className="froam-chat__proposals">
          {pendingProposals.map((proposal) => (
            <div key={proposal.id} className="froam-chat__proposal">
              <RotateCcw size={13} />
              <span><b>{proposal.name}</b> wants to undo someone else’s change</span>
              <button type="button" className="froam-collab__ghost" onClick={() => void messaging.decideProposal(proposal.id, 'declined')}>Keep</button>
              <button type="button" className="froam-collab__secondary" onClick={() => void messaging.decideProposal(proposal.id, 'approved')}>Allow</button>
            </div>
          ))}
        </div>
      )}

      <div className="froam-chat__list" ref={listRef} onScroll={onScroll} aria-live="polite" aria-label="Messages">
        {entries.length === 0 && (
          <div className="froam-chat__empty">
            <strong>Start the conversation</strong>
            <p>Everyone in this room sees what you write here — questions, feedback, “looks great”.</p>
          </div>
        )}
        {entries.map((entry) => {
          const day = dayLabel(entry.at)
          const divider = day !== lastDay ? <div className="froam-chat__day" key={`day-${entry.id}`}><span>{day}</span></div> : null
          lastDay = day

          if (entry.kind === 'activity') {
            previous = entry
            return (
              <Fragment key={entry.id}>
                {divider}
                <div className="froam-chat__activity">
                  <FileDiff size={12} />
                  <span>{entry.text}</span>
                  {onOpenRequest && <button type="button" className="froam-collab__link" onClick={() => onOpenRequest(entry.request)}>View</button>}
                </div>
              </Fragment>
            )
          }

          const { message } = entry
          const mine = message.actor === me
          const author = person(message.actor)
          const name = mine ? 'You' : author?.name ?? message.name
          const prev = previous as Entry | null
          const grouped = !divider
            && prev?.kind === 'message'
            && prev.message.actor === message.actor
            && message.createdAt - prev.message.createdAt < GROUP_WINDOW_MS
            && !message.requestId
          previous = entry
          const about = message.requestId ? requestsById.get(message.requestId) : null

          return (
            <Fragment key={entry.id}>
              {divider}
              <div className={`froam-chat__msg${mine ? ' is-mine' : ''}${grouped ? ' is-grouped' : ''}${message.state ? ` is-${message.state}` : ''}`}>
                {!mine && (
                  grouped ? <span className="froam-chat__gutter" /> : (
                    <button type="button" className="froam-chat__face" onClick={() => onOpenPerson?.(message.actor)} aria-label={`About ${name}`}>
                      <PersonAvatar name={author?.name ?? message.name} color={author?.color} avatarUrl={author?.avatarUrl} size={26} />
                    </button>
                  )
                )}
                <div className="froam-chat__stack">
                  {!grouped && (
                    <div className="froam-chat__meta">
                      {!mine && (
                        <button type="button" className="froam-chat__name" onClick={() => onOpenPerson?.(message.actor)} style={{ color: author?.color ?? undefined }}>
                          {name}
                        </button>
                      )}
                      {!mine && author?.title && <span className="froam-chat__title">{author.title}</span>}
                      <time dateTime={new Date(message.createdAt).toISOString()}>{clock(message.createdAt)}</time>
                    </div>
                  )}
                  {about && (
                    <button type="button" className="froam-chat__about" onClick={() => onOpenRequest?.(about)}>
                      <CornerDownLeft size={11} /> {about.title}
                    </button>
                  )}
                  <div className="froam-chat__bubble"><Linkified text={message.body} /></div>
                  {message.state === 'sending' && <small className="froam-chat__state">Sending…</small>}
                  {message.state === 'failed' && (
                    <small className="froam-chat__state is-failed">
                      Not sent. <button type="button" className="froam-collab__link" onClick={() => void messaging.retry(message)}>Try again</button>
                    </small>
                  )}
                </div>
              </div>
            </Fragment>
          )
        })}
      </div>

      {!atBottom && (
        <button
          type="button"
          className="froam-chat__jump"
          onClick={() => { const list = listRef.current; if (list) list.scrollTop = list.scrollHeight }}
        >
          <ArrowDown size={12} /> {messaging.unread ? `${messaging.unread} new` : 'Latest'}
        </button>
      )}

      <form className="froam-chat__composer" onSubmit={(event) => { event.preventDefault(); void send() }}>
        {context && (
          <div className="froam-chat__context">
            <CornerDownLeft size={11} />
            <span>About <b>{context.title}</b></span>
            <button type="button" className="froam-collab__icon" onClick={onClearContext} aria-label="Not about this request"><X size={11} /></button>
          </div>
        )}
        <div className="froam-chat__field">
          <textarea
            ref={inputRef}
            className="froam-collab__input"
            value={draft}
            rows={1}
            maxLength={2_000}
            disabled={!joined}
            placeholder={joined ? (context ? 'Say what should change…' : 'Message everyone in the room') : 'Join the room to send messages'}
            aria-label="Message the room"
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              // Keys typed here are words, never editor shortcuts.
              if (event.key !== 'Escape') event.stopPropagation()
              if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
                event.preventDefault()
                void send()
              }
            }}
          />
          <button type="submit" className="froam-chat__send" disabled={!joined || !draft.trim()} aria-label="Send">
            <Send size={14} />
          </button>
        </div>
        <small className="froam-chat__hint">Enter to send · Shift+Enter for a new line</small>
      </form>
    </div>
  )
}
