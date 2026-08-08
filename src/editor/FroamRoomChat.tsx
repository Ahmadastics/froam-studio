import { useCallback, useEffect, useState } from 'react'
import type { RoomClient } from '../collab/room'
import type { FroamChatMessage, FroamRevertProposal, FroamRole, FroamRoomEvent } from '../collab/types'

type Props = {
  client: RoomClient | null
  events: readonly FroamRoomEvent[]
  role: FroamRole | null
}

export default function FroamRoomChat({ client, events, role }: Props) {
  const [messages, setMessages] = useState<FroamChatMessage[]>([])
  const [proposals, setProposals] = useState<FroamRevertProposal[]>([])
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)

  const refresh = useCallback(async () => {
    if (!client?.joined) return
    try {
      const [nextMessages, nextProposals] = await Promise.all([
        client.chat(),
        role === 'owner' || role === 'editor' ? client.proposals() : Promise.resolve([]),
      ])
      setMessages(nextMessages)
      setProposals(nextProposals)
    } catch { /* reconnect polling will try again */ }
  }, [client, role])

  useEffect(() => { void refresh() }, [refresh, events])

  const send = useCallback(async () => {
    const body = draft.trim()
    if (!body || !client) return
    setSending(true)
    try {
      await client.sendChat(body)
      setDraft('')
      await refresh()
    } finally {
      setSending(false)
    }
  }, [client, draft, refresh])

  const decide = useCallback(async (id: string, decision: 'approved' | 'declined') => {
    if (!client) return
    await client.decideProposal(id, decision)
    await refresh()
  }, [client, refresh])

  if (!client?.joined) return null

  return (
    <div className="froam-room-chat" data-chef-editor-root="true">
      {role === 'owner' && proposals.some((proposal) => proposal.status === 'pending') && (
        <div className="froam-room-chat__messages">
          {proposals.filter((proposal) => proposal.status === 'pending').map((proposal) => (
            <div key={proposal.id} className="froam-room-chat__message froam-proposal">
              <strong>{proposal.name} wants to undo someone else’s change</strong>
              <div className="froam-note__row">
                <button type="button" className="fs-pill is-accent" onClick={() => void decide(proposal.id, 'approved')}>Allow</button>
                <button type="button" className="fs-pill" onClick={() => void decide(proposal.id, 'declined')}>Keep change</button>
              </div>
            </div>
          ))}
        </div>
      )}
      <div className="froam-room-chat__messages" aria-live="polite">
        {messages.length === 0 && <span style={{ color: 'var(--fs-text-tertiary)', fontSize: '.72rem' }}>Room chat is quiet</span>}
        {messages.map((message) => (
          <div key={message.id} className="froam-room-chat__message">
            <strong>{message.name}</strong>
            {message.body}
          </div>
        ))}
      </div>
      <form className="froam-room-chat__composer" onSubmit={(event) => { event.preventDefault(); void send() }}>
        <input className="fs-input" value={draft} maxLength={2_000} placeholder="Message the room" aria-label="Message the room" onChange={(event) => setDraft(event.target.value)} />
        <button type="submit" className="fs-pill is-accent" disabled={sending || !draft.trim()}>Send</button>
      </form>
    </div>
  )
}
