import { Fragment, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { ArrowDown, CornerDownLeft, FileDiff, MapPin, RotateCcw, Send, X } from 'lucide-react'
import type { RoomMemberView, RoomRequest } from '../../collab/room'
import type { FroamMessageAnchor } from '../../collab/types'
import type { RoomMessage, RoomMessaging } from './useRoomMessages'
import { PersonAvatar } from './PersonAvatar'

/** The presence label a person shows while writing a message. */
export const TYPING = 'Typing a message'

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

/** Links stay links, @names stand out; everything else is text (never HTML). */
function Linkified({ text, names = [] }: { text: string; names?: readonly string[] }) {
  const parts = text.split(/(https?:\/\/[^\s<>"']+)/g)
  const mention = names.length
    ? new RegExp(`(@(?:${[...names].sort((a, b) => b.length - a.length).map((name) => name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')}))(?![\\p{L}\\p{N}_])`, 'giu')
    : null
  return (
    <>
      {parts.map((part, index) => {
        if (/^https?:\/\//.test(part)) return <a key={index} href={part} target="_blank" rel="noopener noreferrer">{part}</a>
        if (!mention) return <Fragment key={index}>{part}</Fragment>
        return (
          <Fragment key={index}>
            {part.split(mention).map((piece, at) => (at % 2 === 1 ? <b key={at} className="froam-chat__mention">{piece}</b> : piece))}
          </Fragment>
        )
      })}
    </>
  )
}

/** The @word being typed right before the caret, if any. */
function mentionQuery(text: string, caret: number) {
  const before = text.slice(0, caret)
  const match = /(^|\s)@([\p{L}\p{N}_ .'-]{0,24})$/u.exec(before)
  if (!match) return null
  return { start: before.length - match[2].length - 1, query: match[2].toLowerCase() }
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
  people = [],
  pinTarget = null,
  onShowAnchor,
  onTyping,
  focusMessageId = null,
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
  /** Everyone else in the room: who can be @mentioned, and who is typing. */
  people?: readonly RoomMemberView[]
  /** The element selected on the page, which a message can be pinned to. */
  pinTarget?: FroamMessageAnchor | null
  onShowAnchor?: (anchor: FroamMessageAnchor) => void
  onTyping?: (typing: boolean) => void
  /** Scroll to and highlight this message (a notification or a pin pointed at it). */
  focusMessageId?: string | null
}) {
  const [draft, setDraft] = useState('')
  const [atBottom, setAtBottom] = useState(true)
  const [pinned, setPinned] = useState<FroamMessageAnchor | null>(null)
  const [mention, setMention] = useState<{ start: number; query: string } | null>(null)
  const [mentionIndex, setMentionIndex] = useState(0)
  const names = useMemo(() => [...people.map((member) => member.name), ...people.map((member) => member.name.split(/\s+/)[0])].filter(Boolean), [people])
  const suggestions = useMemo(() => {
    if (!mention) return []
    return people.filter((member) => member.name.toLowerCase().includes(mention.query) || member.name.toLowerCase().split(/\s+/).some((part) => part.startsWith(mention.query))).slice(0, 5)
  }, [mention, people])
  const typing = people.filter((member) => member.here && member.action === TYPING)

  // Tell the room while there's something unsent in the box.
  const typingRef = useRef(false)
  useEffect(() => {
    const now = Boolean(draft.trim())
    if (now !== typingRef.current) {
      typingRef.current = now
      onTyping?.(now)
    }
  }, [draft, onTyping])
  useEffect(() => () => { if (typingRef.current) onTyping?.(false) }, [onTyping])

  useEffect(() => {
    if (!focusMessageId) return
    const node = listRef.current?.querySelector(`[data-message-id="${CSS.escape(focusMessageId)}"]`)
    node?.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }, [focusMessageId, messaging.messages.length])
  const listRef = useRef<HTMLDivElement | null>(null)
  const inputRef = useRef<HTMLTextAreaElement | null>(null)
  const lastCountRef = useRef(0)
  const caretRef = useRef<number | null>(null)
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

  useLayoutEffect(() => {
    const input = inputRef.current
    if (caretRef.current === null || !input) return
    input.focus()
    input.setSelectionRange(caretRef.current, caretRef.current)
    caretRef.current = null
  }, [draft])

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
    setMention(null)
    const anchor = pinned
    setPinned(null)
    onClearContext()
    await messaging.send(body, { requestId: context?.id ?? null, anchor })
  }

  const chooseMention = (member: RoomMemberView) => {
    if (!mention) return
    const input = inputRef.current
    const caret = input?.selectionStart ?? draft.length
    const next = `${draft.slice(0, mention.start)}@${member.name} ${draft.slice(caret)}`
    setDraft(next)
    setMention(null)
    const at = mention.start + member.name.length + 2
    // Placed in the same commit as the new text, so the next key lands after the name.
    caretRef.current = at
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
              <div
                data-message-id={message.id}
                className={`froam-chat__msg${mine ? ' is-mine' : ''}${grouped ? ' is-grouped' : ''}${message.state ? ` is-${message.state}` : ''}${focusMessageId === message.id ? ' is-focused' : ''}${me && message.mentions?.includes(me) ? ' is-mentioning-me' : ''}`}
              >
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
                  {message.anchor && (
                    <button type="button" className="froam-chat__pin" onClick={() => onShowAnchor?.(message.anchor!)} title="Show it on the page">
                      <MapPin size={11} /> {message.anchor.label ?? 'On the page'}{message.anchor.viewport !== 'desktop' ? ` · ${message.anchor.viewport}` : ''}
                    </button>
                  )}
                  <div className="froam-chat__bubble"><Linkified text={message.body} names={[...names, ...(me ? [] : [])]} /></div>
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

      {typing.length > 0 && (
        <div className="froam-chat__typing" aria-live="polite">
          <span className="froam-chat__dots"><i /><i /><i /></span>
          {typing.length === 1 ? `${typing[0].name.split(/\s+/)[0]} is typing…` : `${typing.length} people are typing…`}
        </div>
      )}

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
        {pinned && (
          <div className="froam-chat__context is-pin">
            <MapPin size={11} />
            <span>Pinned to <b>{pinned.label ?? 'the selected element'}</b></span>
            <button type="button" className="froam-collab__icon" onClick={() => setPinned(null)} aria-label="Unpin"><X size={11} /></button>
          </div>
        )}
        {suggestions.length > 0 && (
          <ul className="froam-chat__mentions" role="listbox" aria-label="Mention someone">
            {suggestions.map((member, index) => (
              <li key={member.actor} role="option" aria-selected={index === mentionIndex}>
                <button type="button" className={index === mentionIndex ? 'is-active' : ''} onMouseDown={(event) => { event.preventDefault(); chooseMention(member) }}>
                  <PersonAvatar name={member.name} color={member.color} avatarUrl={member.avatarUrl} size={20} here={member.here} />
                  <span>{member.name}</span>
                  {member.title && <small>{member.title}</small>}
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="froam-chat__field">
          <button
            type="button"
            className={`froam-chat__pin-button${pinned ? ' is-active' : ''}`}
            disabled={!joined || !pinTarget}
            onClick={() => setPinned(pinned ? null : pinTarget)}
            title={pinTarget ? `Pin to ${pinTarget.label ?? 'the selected element'}` : 'Select something on the page to pin a message to it'}
            aria-label="Pin to the selected element"
          >
            <MapPin size={14} />
          </button>
          <textarea
            ref={inputRef}
            className="froam-collab__input"
            value={draft}
            rows={1}
            maxLength={2_000}
            disabled={!joined}
            placeholder={joined ? (context ? 'Say what should change…' : 'Message everyone in the room') : 'Join the room to send messages'}
            aria-label="Message the room"
            onChange={(event) => {
              setDraft(event.target.value)
              const next = mentionQuery(event.target.value, event.target.selectionStart ?? event.target.value.length)
              setMention(next)
              setMentionIndex(0)
            }}
            onKeyDown={(event) => {
              // Keys typed here are words, never editor shortcuts.
              if (event.key !== 'Escape') event.stopPropagation()
              if (suggestions.length) {
                if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                  event.preventDefault()
                  setMentionIndex((index) => (index + (event.key === 'ArrowDown' ? 1 : suggestions.length - 1)) % suggestions.length)
                  return
                }
                if (event.key === 'Enter' || event.key === 'Tab') {
                  event.preventDefault()
                  chooseMention(suggestions[mentionIndex] ?? suggestions[0])
                  return
                }
                if (event.key === 'Escape') { event.stopPropagation(); setMention(null); return }
              }
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
        <small className="froam-chat__hint">Enter to send · Shift+Enter for a new line · @ to mention</small>
      </form>
    </div>
  )
}
