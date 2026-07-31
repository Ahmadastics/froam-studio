/**
 * Froam Review — the client's side of a session.
 *
 * Everything here follows one rule from fig. 0.4: **the site is the hero and
 * Froam is a bar at the bottom.** If the first thing a client sees is a review
 * tool, they will think the review tool is the thing you built. They should
 * see their own page, looking finished, with one quiet line saying why they
 * are here — and that line names a person, not a product.
 *
 * Mounted by FroamRuntime, which otherwise renders nothing. Without an invite
 * in the URL none of this exists.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useFroamRoom } from '../collab/useFroamRoom'
import { ROOM_PARAM, TOKEN_PARAM, type RoomComment, type RoomRevision } from '../collab/room'
import { createAnchor } from '../collab/anchor'
import type { FroamAnchor, FroamViewport } from '../collab/types'

type Props = {
  routeKey: string
  viewport: FroamViewport
}

/** Carry the invite across a navigation, or the next page is not a session. */
function urlForRoute(routeKey: string) {
  const url = new URL(window.location.href)
  const room = url.searchParams.get(ROOM_PARAM)
  const token = url.searchParams.get(TOKEN_PARAM)
  const next = new URL(routeKey, window.location.origin)
  if (room) next.searchParams.set(ROOM_PARAM, room)
  if (token) next.searchParams.set(TOKEN_PARAM, token)
  return next.toString()
}

export default function FroamReview({ routeKey, viewport }: Props) {
  const room = useFroamRoom({ where: { routeKey, viewport } })
  const [name, setName] = useState('')
  const [asking, setAsking] = useState(false)
  const [paused, setPaused] = useState(false)
  const [movingTo, setMovingTo] = useState<string | null>(null)
  const [commenting, setCommenting] = useState(false)
  const [draft, setDraft] = useState<{ anchor: FroamAnchor; quoted: string; body: string } | null>(null)
  const [sending, setSending] = useState(false)
  const [notes, setNotes] = useState<RoomComment[]>([])
  const [pending, setPending] = useState<RoomRevision | null>(null)
  const [asked, setAsked] = useState(false)
  const [deciding, setDeciding] = useState(false)

  const canComment = room.role === 'commenter' || room.role === 'owner' || room.role === 'editor'
  // Read inside the tap handler without re-subscribing it on every keystroke.
  const draftRef = useRef(draft)
  draftRef.current = draft

  /**
   * Comment mode is a *mode*, and this is why.
   *
   * On a phone, tapping to leave a note and tapping to follow a link are the
   * same gesture. So while the banner is up we take the tap: the link does not
   * fire, and a note is attached to whatever was under the finger instead.
   * Capture phase, because the page's own handlers must never see it.
   */
  useEffect(() => {
    if (!commenting) return
    const root = document.querySelector<HTMLElement>('[data-froam-root]') ?? document.body

    const take = (event: PointerEvent) => {
      // elementFromPoint, not event.target: it gives the element actually under
      // the finger. A note anchored to a wrapper quotes the whole page back at
      // you and tells the designer nothing about what you meant.
      const under = (event.clientX || event.clientY)
        ? (document.elementFromPoint(event.clientX, event.clientY) as HTMLElement | null)
        : (event.target as HTMLElement | null)
      const target = under ?? (event.target as HTMLElement | null)

      if (!target || target.closest('[data-chef-editor-root]')) return
      if (!root.contains(target) || target === root) return

      // Swallow every tap for as long as the mode is on, including the click
      // that follows the pointerdown which opened the sheet. Tearing the
      // listeners down the moment a draft exists let that click through to the
      // link underneath — the sheet opened *and* the page navigated, which is
      // the exact collision this mode exists to prevent.
      event.preventDefault()
      event.stopPropagation()

      // One note at a time: the tap that opened the sheet must not also
      // re-anchor it out from under whoever is typing.
      if (draftRef.current) return

      const quoted = (target.textContent ?? '').trim().replace(/\s+/g, ' ').slice(0, 120)
      setDraft({ anchor: createAnchor(target, root), quoted, body: '' })
    }

    document.addEventListener('pointerdown', take, true)
    document.addEventListener('pointerup', take, true)
    document.addEventListener('click', take, true)
    return () => {
      document.removeEventListener('pointerdown', take, true)
      document.removeEventListener('pointerup', take, true)
      document.removeEventListener('click', take, true)
    }
  }, [commenting])

  /** Opening the sheet pauses following — you asked for that, and it is right:
   *  being navigated away mid-sentence loses the note. */
  useEffect(() => {
    if (commenting || draft) setPaused(true)
  }, [commenting, draft])

  const presenter = room.presenter
  const following = room.someoneElseIsPresenting && !paused

  /**
   * Following breaks the moment they do anything for themselves. No fight over
   * the scroll position, no being dragged away mid-thought — it is a courtesy,
   * never a cage.
   */
  useEffect(() => {
    if (!room.inRoom || paused) return
    const release = () => setPaused(true)
    window.addEventListener('wheel', release, { passive: true })
    window.addEventListener('touchmove', release, { passive: true })
    window.addEventListener('pointerdown', release)
    return () => {
      window.removeEventListener('wheel', release)
      window.removeEventListener('touchmove', release)
      window.removeEventListener('pointerdown', release)
    }
  }, [room.inRoom, paused])

  /**
   * Follow the presenter's route — never their viewport. They are on a desktop
   * and this is a phone; Froam keeps a design per viewport, so pushing theirs
   * would show a layout that was never meant for this hand.
   */
  useEffect(() => {
    if (!following || !presenter?.routeKey) return
    if (presenter.routeKey === routeKey) { setMovingTo(null); return }

    // Narrate first. Being teleported with no explanation is the worst moment
    // in any shared-screen tool, so the move is announced and then made.
    setMovingTo(presenter.routeKey)
    const timer = window.setTimeout(() => {
      window.location.assign(urlForRoute(presenter.routeKey as string))
    }, 1200)
    return () => window.clearTimeout(timer)
  }, [following, presenter?.routeKey, routeKey])

  const refreshNotes = useCallback(async () => {
    if (!room.client) return
    try {
      setNotes(await room.client.comments(routeKey))
      // The one still waiting on an answer. Older decided revisions are
      // history; only an undecided one is a question being asked of them.
      const list = await room.client.revisions(routeKey)
      setPending(list.find((r) => r.status === 'sent') ?? null)
    } catch { /* offline */ }
  }, [room.client, routeKey])

  useEffect(() => {
    void refreshNotes()
    const timer = window.setInterval(() => { if (!document.hidden) void refreshNotes() }, 6_000)
    return () => window.clearInterval(timer)
  }, [refreshNotes])

  const decide = useCallback(async (decision: 'approved' | 'changes-requested') => {
    if (!pending || !room.client) return
    setDeciding(true)
    try {
      await room.client.decide(pending.id, decision)
      setAsked(false)
      await refreshNotes()
    } finally {
      setDeciding(false)
    }
  }, [pending, room.client, refreshNotes])

  const send = useCallback(async () => {
    if (!draft || !room.client) return
    setSending(true)
    try {
      await room.client.comment({
        routeKey,
        viewport,
        anchor: draft.anchor,
        quoted: draft.quoted || null,
        body: draft.body.trim(),
      })
      setDraft(null)
      await refreshNotes()
    } finally {
      setSending(false)
    }
  }, [draft, room.client, routeKey, viewport, refreshNotes])

  const submit = useCallback(async () => {
    const trimmed = name.trim()
    if (!trimmed) return
    await room.join(trimmed)
    setAsking(false)
  }, [name, room])

  const label = useMemo(() => {
    if (movingTo) return `${presenter?.name ?? 'They'} moved to ${movingTo}`
    if (following) return `Following ${presenter?.name ?? 'them'}`
    if (paused && room.someoneElseIsPresenting) {
      return presenter?.name ? `You left ${presenter.name}’s view` : 'You left their view'
    }
    if (presenter) return `${presenter.name} is here`
    return 'Have a look around'
  }, [movingTo, following, paused, presenter, room.someoneElseIsPresenting])

  const sender = room.room?.members.find((m) => m.role === 'owner')?.name

  if (!room.inRoom) return null

  /**
   * The client's chrome is for people who are not editing.
   *
   * An owner or editor already has the studio, and telling a designer that
   * they sent themselves something to review is nonsense. It also keeps the
   * two surfaces from fighting over one stored identity on a machine where
   * both happen to mount.
   */
  if (room.role === 'owner' || room.role === 'editor') return null

  /* ── Arrival: name yourself once. No account, ever. ── */
  if (room.needsName) {
    return (
      <div className="froam-review" data-chef-editor-root="true">
        {asking ? (
          <div className="froam-review__sheet">
            <label className="froam-review__label" htmlFor="froam-review-name">
              What should we call you?
            </label>
            <div className="froam-review__row">
              <input
                id="froam-review-name"
                className="froam-review__input"
                value={name}
                autoFocus
                placeholder="Your name"
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') void submit() }}
              />
              <button type="button" className="froam-review__go" disabled={!name.trim() || room.joining} onClick={() => void submit()}>
                {room.joining ? '…' : 'Start'}
              </button>
            </div>
            {room.error && <p className="froam-review__error">{room.error}</p>}
          </div>
        ) : (
          <div className="froam-review__bar">
            <div className="froam-review__who">
              <b>{sender ? `${sender} sent this to review` : 'Sent to you for review'}</b>
              <span>Take a look — you can leave notes</span>
            </div>
            <button type="button" className="froam-review__go" onClick={() => setAsking(true)}>Start</button>
          </div>
        )}
      </div>
    )
  }

  /* ── Writing a note ── */
  if (draft) {
    return (
      <div className="froam-review" data-chef-editor-root="true">
        <div className="froam-review__sheet">
          {/* Quote what they tapped, so there is no argument later about which
              bit they meant. */}
          {draft.quoted && <p className="froam-review__quote">“{draft.quoted}”</p>}
          <textarea
            className="froam-review__input froam-review__note"
            autoFocus
            placeholder="What would you change?"
            value={draft.body}
            onChange={(e) => setDraft({ ...draft, body: e.target.value })}
          />
          <div className="froam-review__row">
            <button type="button" className="froam-review__ghost" onClick={() => setDraft(null)}>Cancel</button>
            <button type="button" className="froam-review__go" disabled={!draft.body.trim() || sending} onClick={() => void send()}>
              {sending ? '…' : 'Send'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  /* ── The decision ── */
  if (asked && pending) {
    const open = notes.filter((n) => !n.resolved).length
    return (
      <div className="froam-review" data-chef-editor-root="true">
        <div className="froam-review__sheet">
          <div className="froam-review__label">Happy with this?</div>
          <p className="froam-review__quote">
            {open === 0
              ? `${pending.createdBy} will know either way.`
              : `You asked for ${open} change${open === 1 ? '' : 's'}. ${pending.createdBy} will see ${open === 1 ? 'it' : 'them'} either way.`}
          </p>
          <div className="froam-review__row">
            <button type="button" className="froam-review__ghost" disabled={deciding} onClick={() => void decide('changes-requested')}>
              Not yet
            </button>
            <button type="button" className="froam-review__go" disabled={deciding} onClick={() => void decide('approved')}>
              {deciding ? '…' : 'Approve'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  /* ── In the session ── */
  return (
    <div className="froam-review" data-chef-editor-root="true">
      {commenting ? (
        <div className="froam-review__bar is-commenting">
          <div className="froam-review__who">
            <b>Tap anything you want changed</b>
            <span>{notes.length ? `${notes.length} note${notes.length === 1 ? '' : 's'} so far` : 'Your notes go straight to them'}</span>
          </div>
          <button type="button" className="froam-review__go" onClick={() => setCommenting(false)}>Done</button>
        </div>
      ) : (
        <div className={`froam-review__bar${movingTo ? ' is-moving' : ''}`}>
          <span className={`froam-review__dot${following ? ' is-live' : ''}`} aria-hidden="true" />
          <div className="froam-review__who">
            <b>{label}</b>
            <span>{following ? 'They are showing you the site' : `${room.present.length + 1} here`}</span>
          </div>
          {paused && room.someoneElseIsPresenting && !movingTo && (
            <button type="button" className="froam-review__ghost" onClick={() => setPaused(false)}>Rejoin</button>
          )}
          {canComment && !pending && (
            <button type="button" className="froam-review__go" onClick={() => setCommenting(true)}>
              {notes.length ? `Notes · ${notes.length}` : 'Comment'}
            </button>
          )}
          {/* A revision waiting on them is the most important thing on the
              screen, so it takes the primary slot and comment steps back. */}
          {canComment && pending && (
            <>
              <button type="button" className="froam-review__ghost" onClick={() => setCommenting(true)}>
                {notes.length ? `Notes · ${notes.length}` : 'Comment'}
              </button>
              <button type="button" className="froam-review__go" onClick={() => setAsked(true)}>Review</button>
            </>
          )}
        </div>
      )}
    </div>
  )
}
