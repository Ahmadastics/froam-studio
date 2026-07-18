/* ===============================================================
   FROAM STUDIO v4 — bottom sheet (mobile chrome)
   Swipeable container with three detents: peek / half / full.
   Drag happens ONLY on the header so the body can scroll freely.
   =============================================================== */
import { useRef, useState, type ReactNode, type PointerEvent as ReactPointerEvent } from 'react'

export type SheetDetent = 'peek' | 'half' | 'full'

const PEEK_HEIGHT = 84
const TAP_SLOP = 6
const FLICK_VELOCITY = 0.5 // px per ms

function detentHeight(detent: SheetDetent, viewport: number): number {
  switch (detent) {
    case 'peek':
      return PEEK_HEIGHT
    case 'half':
      return Math.round(viewport * 0.46)
    case 'full':
      return Math.max(240, viewport - 56)
  }
}

function nearestDetent(height: number, viewport: number): SheetDetent {
  let best: SheetDetent = 'peek'
  let bestDistance = Number.POSITIVE_INFINITY
  for (const detent of ['peek', 'half', 'full'] as const) {
    const distance = Math.abs(detentHeight(detent, viewport) - height)
    if (distance < bestDistance) {
      bestDistance = distance
      best = detent
    }
  }
  return best
}

function stepDetent(detent: SheetDetent, direction: 'up' | 'down'): SheetDetent {
  const order: SheetDetent[] = ['peek', 'half', 'full']
  const index = order.indexOf(detent)
  const next = direction === 'up' ? Math.min(order.length - 1, index + 1) : Math.max(0, index - 1)
  return order[next]
}

type Props = {
  detent: SheetDetent
  onDetentChange: (detent: SheetDetent) => void
  title: string
  subtitle?: string
  children: ReactNode
}

export default function FroamBottomSheet({ detent, onDetentChange, title, subtitle, children }: Props) {
  const sheetRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<{
    startY: number
    startHeight: number
    lastY: number
    lastT: number
    velocity: number
    moved: boolean
  } | null>(null)
  const [dragging, setDragging] = useState(false)

  function handlePointerDown(event: ReactPointerEvent) {
    if (!sheetRef.current) return
    event.preventDefault()
    dragRef.current = {
      startY: event.clientY,
      startHeight: sheetRef.current.getBoundingClientRect().height,
      lastY: event.clientY,
      lastT: performance.now(),
      velocity: 0,
      moved: false,
    }
    setDragging(true)
    try { event.currentTarget.setPointerCapture(event.pointerId) } catch { /* pointer already gone */ }
  }

  function handlePointerMove(event: ReactPointerEvent) {
    const drag = dragRef.current
    if (!drag || !sheetRef.current) return
    const now = performance.now()
    const dt = Math.max(1, now - drag.lastT)
    drag.velocity = (event.clientY - drag.lastY) / dt
    drag.lastY = event.clientY
    drag.lastT = now
    const delta = drag.startY - event.clientY
    if (Math.abs(delta) > TAP_SLOP) drag.moved = true
    const next = Math.min(window.innerHeight - 40, Math.max(56, drag.startHeight + delta))
    sheetRef.current.style.height = `${Math.round(next)}px`
  }

  function handlePointerUp(event: ReactPointerEvent) {
    const drag = dragRef.current
    if (!drag) return
    dragRef.current = null
    setDragging(false)
    try {
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId)
      }
    } catch { /* pointer already gone */ }
    const sheet = sheetRef.current
    const currentHeight = sheet?.getBoundingClientRect().height ?? detentHeight(detent, window.innerHeight)
    if (sheet) sheet.style.height = ''

    if (!drag.moved) {
      // Plain tap on the header cycles peek → half → full → peek
      onDetentChange(detent === 'full' ? 'peek' : stepDetent(detent, 'up'))
      return
    }
    if (Math.abs(drag.velocity) > FLICK_VELOCITY) {
      onDetentChange(stepDetent(detent, drag.velocity < 0 ? 'up' : 'down'))
      return
    }
    onDetentChange(nearestDetent(currentHeight, window.innerHeight))
  }

  return (
    <div
      ref={sheetRef}
      className={[
        'froam-sheet',
        `froam-sheet--${detent}`,
        dragging ? 'is-dragging' : '',
      ].filter(Boolean).join(' ')}
      data-chef-editor-root="true"
      role="region"
      aria-label={title}
    >
      <div
        className="froam-sheet__header"
        data-chef-editor-root="true"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        <span className="froam-sheet__grabber" aria-hidden="true" />
        <div className="froam-sheet__titlebar" data-chef-editor-root="true">
          <span className="froam-sheet__title">{title}</span>
          {subtitle && <span className="froam-sheet__subtitle">{subtitle}</span>}
        </div>
      </div>
      <div className="froam-sheet__body" data-chef-editor-root="true">
        {children}
      </div>
    </div>
  )
}
