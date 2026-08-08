import { useEffect, useMemo, useState } from 'react'
import type { RoomMemberView } from '../collab/room'
import type { FroamViewport } from '../collab/types'

type Props = {
  members: readonly RoomMemberView[]
  routeKey: string
  viewport: FroamViewport
  root: HTMLElement | null
}

function findByPath(root: HTMLElement, path: string) {
  const segments = path.split('/').filter(Boolean)
  let current: HTMLElement | null = root
  for (const segment of segments) {
    const [tag, rawIndex] = segment.split(':')
    const index = Number(rawIndex) - 1
    if (!tag || !Number.isInteger(index) || index < 0) return null
    current = Array.from(current.children).filter(
      (child): child is HTMLElement => child instanceof HTMLElement && child.tagName.toLowerCase() === tag,
    )[index] ?? null
    if (!current) return null
  }
  return current
}

function findMemberElement(root: HTMLElement, nodeId: string | null, path: string | null) {
  if (nodeId) {
    const byId = root.querySelector<HTMLElement>(`[data-froam-id="${CSS.escape(nodeId)}"]`)
    if (byId) return byId
  }
  return path ? findByPath(root, path) : null
}

function MemberLabel({ member }: { member: RoomMemberView }) {
  const context = member.action || (member.selectedNodeId || member.selectedPath ? `Editing ${member.selectedNodeId?.slice(0, 12) ?? 'selection'}` : member.tool)
  return <><strong>{member.name}</strong>{context && <small>{context}</small>}</>
}

function MemberAvatar({ member }: { member: RoomMemberView }) {
  return member.avatarUrl
    ? <img className="froam-presence__avatar" src={member.avatarUrl} alt="" referrerPolicy="no-referrer" />
    : <span className="froam-presence__initials" style={{ background: member.color }}>{member.name.slice(0, 2).toUpperCase()}</span>
}

/** Ephemeral multiplayer chrome. Nothing rendered here is persisted. */
export default function FroamPresenceLayer({ members, routeKey, viewport, root }: Props) {
  const [, redraw] = useState(0)
  const visible = useMemo(
    () => members.filter((member) => member.here && member.routeKey === routeKey && member.viewport === viewport),
    [members, routeKey, viewport],
  )

  useEffect(() => {
    let frame = 0
    const update = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => redraw((value) => value + 1))
    }
    window.addEventListener('scroll', update, true)
    window.addEventListener('resize', update)
    const timer = window.setInterval(update, 1_000)
    return () => {
      cancelAnimationFrame(frame)
      window.clearInterval(timer)
      window.removeEventListener('scroll', update, true)
      window.removeEventListener('resize', update)
    }
  }, [])

  useEffect(() => {
    if (!root) return
    const marked: HTMLElement[] = []
    for (const member of visible) {
      if (!member.lockedPath && !member.lockedNodeId) continue
      const element = findMemberElement(root, member.lockedNodeId, member.lockedPath)
      if (!element) continue
      element.dataset.froamLockedBy = member.name
      element.style.setProperty('--froam-lock-color', member.color)
      marked.push(element)
    }
    return () => {
      for (const element of marked) {
        delete element.dataset.froamLockedBy
        element.style.removeProperty('--froam-lock-color')
      }
    }
  }, [root, visible])

  return (
    <div className="froam-presence" data-chef-editor-root="true" aria-hidden="true">
      <div className="froam-presence__rail">
        {visible.map((member) => <div key={member.actor} title={`${member.name}${member.action ? ` · ${member.action}` : ''}`}><MemberAvatar member={member} /></div>)}
      </div>
      {visible.map((member) => {
        const selected = root ? findMemberElement(root, member.selectedNodeId, member.selectedPath) : null
        const rect = selected?.getBoundingClientRect()
        return (
          <div key={member.actor}>
            {rect && (
              <div
                className={`froam-presence__selection${(member.lockedNodeId && member.lockedNodeId === member.selectedNodeId) || member.lockedPath === member.selectedPath ? ' is-locked' : ''}`}
                style={{
                  left: rect.left,
                  top: rect.top,
                  width: rect.width,
                  height: rect.height,
                  borderColor: member.color,
                }}
              >
                <span style={{ background: member.color }}><MemberAvatar member={member} /><MemberLabel member={member} /></span>
              </div>
            )}
            {member.cursor && (
              <div className="froam-presence__cursor" style={{ left: member.cursor.x, top: member.cursor.y, color: member.color }}>
                <MemberAvatar member={member} />
                <span style={{ background: member.color }}><MemberLabel member={member} /></span>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
