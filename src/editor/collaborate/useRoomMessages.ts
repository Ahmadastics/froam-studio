import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { RoomClient } from '../../collab/room'
import type { FroamChatMessage, FroamRevertProposal, FroamRole, FroamRoomEvent } from '../../collab/types'

/** A message as the panel shows it: sent, still sending, or failed and retryable. */
export type RoomMessage = FroamChatMessage & { state?: 'sending' | 'failed' }

export type RoomMessaging = {
  messages: readonly RoomMessage[]
  /** Owner only: guests asking to undo someone else's change. */
  proposals: readonly FroamRevertProposal[]
  /** Messages from other people that arrived after you last looked. */
  unread: number
  /** The newest message from someone else, for the peek under the Share button. */
  latestIncoming: RoomMessage | null
  send: (body: string, requestId?: string | null) => Promise<boolean>
  retry: (message: RoomMessage) => Promise<boolean>
  markRead: () => void
  decideProposal: (id: string, decision: 'approved' | 'declined') => Promise<void>
}

const readKey = (roomId: string) => `froam-room-read:${roomId}`

function readSeen(roomId: string | null) {
  if (!roomId) return 0
  try { return Number(window.localStorage.getItem(readKey(roomId)) ?? 0) || 0 } catch { return 0 }
}

function byTime(a: FroamChatMessage, b: FroamChatMessage) {
  return a.createdAt - b.createdAt || (a.id < b.id ? -1 : 1)
}

/**
 * The room's conversation, kept live from the event stream.
 *
 * Chat events carry the message itself, so a new message costs no request;
 * the full list is read once on joining and again only to heal a gap.
 */
export function useRoomMessages({ client, events, roomId, role, me }: {
  client: RoomClient | null
  events: readonly FroamRoomEvent[]
  roomId: string | null
  role: FroamRole | null
  me: string | null
}): RoomMessaging {
  const [sent, setSent] = useState<FroamChatMessage[]>([])
  const [local, setLocal] = useState<RoomMessage[]>([])
  const [proposals, setProposals] = useState<FroamRevertProposal[]>([])
  const [seenAt, setSeenAt] = useState(() => readSeen(roomId))
  const joined = Boolean(client?.joined && me)
  const moderates = role === 'owner' || role === 'editor'
  const handledRef = useRef(new WeakSet<FroamRoomEvent>())

  useEffect(() => { setSeenAt(readSeen(roomId)) }, [roomId])

  const load = useCallback(async () => {
    if (!client?.joined) return
    try {
      const [messages, nextProposals] = await Promise.all([
        client.chat(),
        moderates ? client.proposals() : Promise.resolve([]),
      ])
      setSent([...messages].sort(byTime))
      setProposals(nextProposals)
    } catch { /* the next event or reconnect heals it */ }
  }, [client, moderates])

  useEffect(() => { if (joined) void load() }, [joined, load])

  useEffect(() => {
    let incoming: FroamChatMessage[] = []
    let proposalsChanged = false
    for (const event of events) {
      if (handledRef.current.has(event)) continue
      handledRef.current.add(event)
      if (event.type === 'chat' && event.message) incoming.push(event.message)
      if (event.type === 'proposal') proposalsChanged = true
    }
    if (incoming.length) {
      setSent((current) => {
        const known = new Set(current.map((message) => message.id))
        incoming = incoming.filter((message) => !known.has(message.id))
        return incoming.length ? [...current, ...incoming].sort(byTime) : current
      })
    }
    if (proposalsChanged && moderates && client?.joined) {
      void client.proposals().then(setProposals).catch(() => {})
    }
  }, [events, client, moderates, me])

  const deliver = useCallback(async (draft: RoomMessage, requestId?: string | null) => {
    if (!client) return false
    setLocal((current) => [...current.filter((message) => message.id !== draft.id), { ...draft, state: 'sending' }])
    const about = requestId ?? draft.requestId ?? null
    try {
      // One quiet second try: a busy room or a blip on the network shouldn't
      // be the person's problem. Only a second failure asks them.
      const message = await client.sendChat(draft.body, about).catch(async () => {
        await new Promise((resolve) => setTimeout(resolve, 700))
        return client.sendChat(draft.body, about)
      })
      setLocal((current) => current.filter((item) => item.id !== draft.id))
      if (message) setSent((current) => (current.some((item) => item.id === message.id) ? current : [...current, message].sort(byTime)))
      return true
    } catch {
      setLocal((current) => current.map((item) => (item.id === draft.id ? { ...item, state: 'failed' } : item)))
      return false
    }
  }, [client])

  const send = useCallback(async (body: string, requestId?: string | null) => {
    const text = body.trim()
    if (!text || !me) return false
    const draft: RoomMessage = {
      id: `local-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
      actor: me,
      name: '',
      body: text,
      createdAt: Date.now(),
      ...(requestId ? { requestId } : {}),
    }
    return deliver(draft, requestId)
  }, [deliver, me])

  const retry = useCallback((message: RoomMessage) => deliver(message), [deliver])

  const messages = useMemo(() => [...sent, ...local], [sent, local])

  const fromOthers = useMemo(() => sent.filter((message) => message.actor !== me), [sent, me])
  const unread = useMemo(() => fromOthers.filter((message) => message.createdAt > seenAt).length, [fromOthers, seenAt])
  const latestIncoming = fromOthers.length ? fromOthers[fromOthers.length - 1] : null

  const markRead = useCallback(() => {
    const newest = sent.length ? sent[sent.length - 1].createdAt : 0
    if (!roomId || newest <= seenAt) return
    setSeenAt(newest)
    try { window.localStorage.setItem(readKey(roomId), String(newest)) } catch { /* private mode */ }
  }, [roomId, sent, seenAt])

  const decideProposal = useCallback(async (id: string, decision: 'approved' | 'declined') => {
    if (!client) return
    await client.decideProposal(id, decision)
    setProposals(await client.proposals().catch(() => []))
  }, [client])

  return { messages, proposals, unread, latestIncoming, send, retry, markRead, decideProposal }
}
