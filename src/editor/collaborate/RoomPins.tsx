import { useEffect, useState } from 'react'
import { resolveAnchor } from '../../collab/anchor'
import { findElementByPath, tagOfPath } from '../../collab/paths'
import type { RoomMemberView } from '../../collab/room'
import type { FroamAnchor } from '../../collab/types'
import { PersonAvatar } from './PersonAvatar'
import type { RoomMessage } from './useRoomMessages'

type Pin = { key: string; top: number; left: number; messages: RoomMessage[] }

/**
 * The element a message is pinned to: where its path says, when that is still
 * the same kind of element; otherwise wherever its fingerprint is found.
 */
export function findPinned(anchor: { path: string; nodeId?: string; fingerprint: FroamAnchor['fingerprint'] }, root: HTMLElement): HTMLElement | null {
  const atPath = findElementByPath(root, anchor.path)
  if (atPath && (!anchor.fingerprint.tag || atPath.tagName.toLowerCase() === anchor.fingerprint.tag || atPath.tagName.toLowerCase() === tagOfPath(anchor.path))) return atPath
  const found = resolveAnchor({ path: anchor.path, nodeId: anchor.nodeId, fingerprint: anchor.fingerprint } as FroamAnchor, root)
  return found.status === 'orphaned' ? null : found.element
}

/**
 * Messages pinned to things on the page, drawn on the things.
 *
 * "Make this shorter" is only useful next to "this". Each pinned element gets
 * one marker — the face of whoever pinned there last, and a count when
 * there's more than one — and clicking it opens the conversation at that
 * message. Only the page and screen size on screen show pins.
 */
export function RoomPins({ messages, routeKey, viewport, getRoot, person, onOpen }: {
  messages: readonly RoomMessage[]
  routeKey: string
  viewport: string
  getRoot: () => HTMLElement | null
  person: (actor: string) => RoomMemberView | undefined
  onOpen: (messageId: string) => void
}) {
  const [pins, setPins] = useState<Pin[]>([])

  useEffect(() => {
    const pinned = messages.filter((message) => message.anchor && message.anchor.routeKey === routeKey && message.anchor.viewport === viewport)
    if (!pinned.length) { setPins([]); return }
    let frame = 0
    const place = () => {
      frame = 0
      const root = getRoot()
      if (!root) return
      const byElement = new Map<Element, { rect: DOMRect; messages: RoomMessage[] }>()
      for (const message of pinned) {
        const element = findPinned(message.anchor!, root)
        if (!element) continue
        const entry = byElement.get(element) ?? { rect: element.getBoundingClientRect(), messages: [] }
        entry.messages.push(message)
        byElement.set(element, entry)
      }
      const next: Pin[] = []
      for (const { rect, messages: here } of byElement.values()) {
        if (rect.bottom < 0 || rect.top > window.innerHeight || rect.width === 0) continue
        next.push({ key: here[0].id, top: Math.max(4, rect.top - 12), left: Math.min(window.innerWidth - 28, rect.right - 12), messages: here })
      }
      setPins(next)
    }
    const schedule = () => { if (!frame) frame = window.requestAnimationFrame(place) }
    schedule()
    window.addEventListener('scroll', schedule, true)
    window.addEventListener('resize', schedule)
    const timer = window.setInterval(schedule, 1_000)
    return () => {
      window.removeEventListener('scroll', schedule, true)
      window.removeEventListener('resize', schedule)
      window.clearInterval(timer)
      if (frame) window.cancelAnimationFrame(frame)
    }
  }, [messages, routeKey, viewport, getRoot])

  if (!pins.length) return null
  return (
    <div className="froam-pins" data-chef-editor-root="true">
      {pins.map((pin) => {
        const last = pin.messages[pin.messages.length - 1]
        const author = person(last.actor)
        return (
          <button
            key={pin.key}
            type="button"
            className="froam-pin"
            style={{ top: pin.top, left: pin.left, ['--froam-avatar-color' as string]: author?.color ?? '#64748b' }}
            onClick={() => onOpen(last.id)}
            title={`${author?.name ?? last.name}: ${last.body}`}
            aria-label={`${pin.messages.length} message${pin.messages.length === 1 ? '' : 's'} pinned here`}
            data-chef-editor-root="true"
          >
            <PersonAvatar name={author?.name ?? last.name} color={author?.color} avatarUrl={author?.avatarUrl} size={22} />
            {pin.messages.length > 1 && <span className="froam-pin__count">{pin.messages.length}</span>}
          </button>
        )
      })}
    </div>
  )
}
