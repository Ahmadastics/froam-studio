import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'

/* ===============================================================
   FROAM STUDIO — SPACING HANDLES
   Padding, margin and gap, on the canvas, by hand. Hover the
   selection and its spacing shows as zones; drag a handle and the
   real page reflows under your pointer.

   What no other editor does: drags snap to the spacing scale the
   site already uses. Froam reads the padding, margins and gaps on
   the page, finds the values it repeats (its rhythm), and pulls a
   drag onto them — so a hand-tuned edit lands on the site's own
   system instead of on an arbitrary 8px grid. Ctrl/⌘ drags free.

   Shift moves all four sides together; Alt moves the opposite side
   with it.
   =============================================================== */

export type SpacingKind = 'padding' | 'margin' | 'gap'
type Side = 'top' | 'right' | 'bottom' | 'left'
type Axis = 'row' | 'column'

type Box = { top: number; right: number; bottom: number; left: number }

type Handle =
  | { kind: 'padding' | 'margin'; side: Side }
  | { kind: 'gap'; axis: Axis; index: number }

type Props = {
  target: HTMLElement | null
  /** Changes whenever the selection moves or reflows; the handles re-measure on it. */
  rect: DOMRect | null
  visible: boolean
  /** Before the first pixel moves: lock, remember originals. Return false to refuse. */
  onStart: () => boolean
  /** Live: write these styles straight onto the element. */
  onPreview: (styles: Record<string, string>) => void
  /** Pointer up: commit what the drag ended on. */
  onCommit: (styles: Record<string, string>, label: string) => void
}

const SIDES: readonly Side[] = ['top', 'right', 'bottom', 'left']
const OPPOSITE: Record<Side, Side> = { top: 'bottom', bottom: 'top', left: 'right', right: 'left' }
const cap = (side: Side) => side[0].toUpperCase() + side.slice(1)
const px = (value: string) => {
  const n = parseFloat(value)
  return Number.isFinite(n) ? n : 0
}

/* ── the site's rhythm ── */

const FALLBACK_SCALE = [0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 80, 96, 128]
let rhythmCache: { at: number; values: number[] } | null = null

/**
 * The spacing values this page repeats. Reads padding, margin and gap off
 * up to 1,500 visible elements and keeps the values used three or more
 * times. A page with no clear rhythm gets a 4/8 scale instead.
 */
export function pageRhythm(root: ParentNode = document.body): number[] {
  if (rhythmCache && performance.now() - rhythmCache.at < 8000) return rhythmCache.values
  const counts = new Map<number, number>()
  const add = (raw: string) => {
    const value = Math.round(px(raw))
    if (value > 0 && value <= 200) counts.set(value, (counts.get(value) ?? 0) + 1)
  }
  let seen = 0
  for (const el of root.querySelectorAll<HTMLElement>('body *')) {
    if (seen > 1500) break
    if (el.closest('[data-chef-editor-root="true"], #froam-editor-portal')) continue
    const cs = getComputedStyle(el)
    if (cs.display === 'none') continue
    seen += 1
    add(cs.paddingTop); add(cs.paddingRight); add(cs.paddingBottom); add(cs.paddingLeft)
    add(cs.marginTop); add(cs.marginBottom)
    if (cs.display.includes('flex') || cs.display.includes('grid')) { add(cs.rowGap); add(cs.columnGap) }
  }
  const frequent = [...counts.entries()].filter(([, count]) => count >= 3).sort((a, b) => b[1] - a[1]).slice(0, 14).map(([value]) => value)
  const values = frequent.length >= 4 ? [0, ...frequent.sort((a, b) => a - b)] : FALLBACK_SCALE
  rhythmCache = { at: performance.now(), values }
  return values
}

/** Pull `value` onto the scale when it's within reach; report whether it landed on it. */
export function snapToRhythm(value: number, scale: readonly number[], reach = 4): { value: number; snapped: boolean } {
  let best = value
  let distance = Infinity
  for (const step of scale) {
    const d = Math.abs(step - value)
    if (d < distance) { distance = d; best = step }
  }
  return distance <= reach ? { value: best, snapped: true } : { value: Math.round(value), snapped: false }
}

/* ── geometry ── */

type Measured = {
  border: DOMRect
  scale: number
  padding: Box
  margin: Box
  borderWidth: Box
  gaps: { axis: Axis; index: number; rect: { left: number; top: number; width: number; height: number }; value: number }[]
  rowGap: number
  columnGap: number
}

function measure(target: HTMLElement): Measured {
  const cs = getComputedStyle(target)
  const border = target.getBoundingClientRect()
  // In a phone or tablet preview the page is scaled; CSS pixels are what we write.
  // (offsetWidth is rounded to a whole pixel, so only a real zoom counts.)
  const ratio = target.offsetWidth ? border.width / target.offsetWidth : 1
  const scale = Math.abs(ratio - 1) < 0.03 ? 1 : ratio
  const box = (prefix: string, suffix = ''): Box => ({
    top: px(cs.getPropertyValue(`${prefix}-top${suffix}`)),
    right: px(cs.getPropertyValue(`${prefix}-right${suffix}`)),
    bottom: px(cs.getPropertyValue(`${prefix}-bottom${suffix}`)),
    left: px(cs.getPropertyValue(`${prefix}-left${suffix}`)),
  })
  const gaps: Measured['gaps'] = []
  const isFlex = cs.display.includes('flex')
  const isGrid = cs.display.includes('grid')
  if (isFlex || isGrid) {
    const kids = [...target.children].filter((child): child is HTMLElement => {
      if (!(child instanceof HTMLElement)) return false
      const ks = getComputedStyle(child)
      return ks.display !== 'none' && ks.position !== 'absolute' && ks.position !== 'fixed'
    }).map((child) => child.getBoundingClientRect()).filter((r) => r.width > 0 && r.height > 0)
    for (let i = 0; i < kids.length - 1 && gaps.length < 24; i += 1) {
      const a = kids[i]
      const b = kids[i + 1]
      const sameRow = Math.abs(a.top - b.top) < Math.min(a.height, b.height) / 2
      if (sameRow && b.left >= a.right - 1) {
        gaps.push({ axis: 'row', index: i, value: (b.left - a.right) / scale, rect: { left: a.right, top: Math.min(a.top, b.top), width: Math.max(2, b.left - a.right), height: Math.max(a.bottom, b.bottom) - Math.min(a.top, b.top) } })
      } else if (b.top >= a.bottom - 1) {
        gaps.push({ axis: 'column', index: i, value: (b.top - a.bottom) / scale, rect: { left: Math.min(a.left, b.left), top: a.bottom, width: Math.max(a.right, b.right) - Math.min(a.left, b.left), height: Math.max(2, b.top - a.bottom) } })
      }
    }
  }
  return {
    border, scale,
    padding: box('padding'),
    margin: box('margin'),
    borderWidth: box('border', '-width'),
    gaps,
    rowGap: px(cs.rowGap),
    columnGap: px(cs.columnGap),
  }
}

/** A zone's rectangle in screen pixels. */
function zoneRect(m: Measured, kind: 'padding' | 'margin', side: Side) {
  const { border: b, scale: s } = m
  if (kind === 'padding') {
    const bw = m.borderWidth
    const inner = { left: b.left + bw.left * s, top: b.top + bw.top * s, right: b.right - bw.right * s, bottom: b.bottom - bw.bottom * s }
    const p = m.padding
    if (side === 'top') return { left: inner.left, top: inner.top, width: inner.right - inner.left, height: p.top * s }
    if (side === 'bottom') return { left: inner.left, top: inner.bottom - p.bottom * s, width: inner.right - inner.left, height: p.bottom * s }
    if (side === 'left') return { left: inner.left, top: inner.top + p.top * s, width: p.left * s, height: inner.bottom - inner.top - (p.top + p.bottom) * s }
    return { left: inner.right - p.right * s, top: inner.top + p.top * s, width: p.right * s, height: inner.bottom - inner.top - (p.top + p.bottom) * s }
  }
  const mg = { top: Math.max(0, m.margin.top), right: Math.max(0, m.margin.right), bottom: Math.max(0, m.margin.bottom), left: Math.max(0, m.margin.left) }
  if (side === 'top') return { left: b.left, top: b.top - mg.top * s, width: b.width, height: mg.top * s }
  if (side === 'bottom') return { left: b.left, top: b.bottom, width: b.width, height: mg.bottom * s }
  if (side === 'left') return { left: b.left - mg.left * s, top: b.top, width: mg.left * s, height: b.height }
  return { left: b.right, top: b.top, width: mg.right * s, height: b.height }
}

/**
 * Where a handle's pill sits: in the middle of its zone, so a padding pill
 * stays in the padding (off the content, which keeps its clicks and hover)
 * and a margin pill stays in the margin (off the neighbour). Both keep clear
 * of the resize handles on the border itself.
 */
function pillPosition(m: Measured, kind: 'padding' | 'margin', side: Side) {
  const { border: b, scale: s } = m
  const CLEAR = 9
  const horizontal = side === 'top' || side === 'bottom'
  const center = horizontal ? b.left + b.width / 2 : b.top + b.height / 2
  // Pills sit off-centre (padding a third along, margin two thirds) so they never stack.
  const along = horizontal ? b.left + b.width * (kind === 'padding' ? 0.36 : 0.64) : b.top + b.height * (kind === 'padding' ? 0.36 : 0.64)
  const pos = b.width < 120 || b.height < 60 ? center : along
  if (kind === 'padding') {
    const depth = Math.max(CLEAR, (m.borderWidth[side] + m.padding[side] / 2) * s)
    if (side === 'top') return { x: pos, y: b.top + Math.min(depth, b.height / 2 - 4) }
    if (side === 'bottom') return { x: pos, y: b.bottom - Math.min(depth, b.height / 2 - 4) }
    if (side === 'left') return { x: b.left + Math.min(depth, b.width / 2 - 4), y: pos }
    return { x: b.right - Math.min(depth, b.width / 2 - 4), y: pos }
  }
  const depth = Math.max(CLEAR + 3, (Math.max(0, m.margin[side]) / 2) * s)
  if (side === 'top') return { x: pos, y: b.top - depth }
  if (side === 'bottom') return { x: pos, y: b.bottom + depth }
  if (side === 'left') return { x: b.left - depth, y: pos }
  return { x: b.right + depth, y: pos }
}

type Drag = {
  handle: Handle
  startX: number
  startY: number
  start: Measured
  scale: number[]
  last: Record<string, string>
  value: number
  snapped: boolean
  all: boolean
  mirror: boolean
}

export default function FroamSpacingHandles({ target, rect, visible, onStart, onPreview, onCommit }: Props) {
  const [measured, setMeasured] = useState<Measured | null>(null)
  const [near, setNear] = useState(false)
  const [hot, setHot] = useState<Handle | null>(null)
  const [drag, setDrag] = useState<Drag | null>(null)
  const dragRef = useRef<Drag | null>(null)

  // Re-measure whenever the selection's box changes (scroll, reflow, an edit).
  useEffect(() => {
    if (!visible || !target || !target.isConnected) { setMeasured(null); return }
    setMeasured(measure(target))
  }, [visible, target, rect])

  // Show the zones while the pointer is over (or just around) the selection.
  useEffect(() => {
    if (!visible || !measured) return
    const onMove = (event: PointerEvent) => {
      if (event.pointerType !== 'mouse') return
      const b = measured.border
      const pad = 28
      const inside = event.clientX >= b.left - pad && event.clientX <= b.right + pad && event.clientY >= b.top - pad && event.clientY <= b.bottom + pad
      setNear((current) => (current === inside ? current : inside))
    }
    window.addEventListener('pointermove', onMove, { passive: true })
    return () => window.removeEventListener('pointermove', onMove)
  }, [measured, visible])

  const styleFor = useCallback((d: Drag, value: number): Record<string, string> => {
    const v = `${Math.max(d.handle.kind === 'margin' ? -400 : 0, Math.round(value))}px`
    // gap is written whole (row then column), so it never fights a gap the design already sets.
    if (d.handle.kind === 'gap') return { gap: d.handle.axis === 'row' ? `${Math.round(d.start.rowGap)}px ${v}` : `${v} ${Math.round(d.start.columnGap)}px` }
    const prop = d.handle.kind
    if (d.all) return Object.fromEntries(SIDES.map((side) => [`${prop}${cap(side)}`, v]))
    const out: Record<string, string> = { [`${prop}${cap(d.handle.side)}`]: v }
    if (d.mirror) out[`${prop}${cap(OPPOSITE[d.handle.side])}`] = v
    return out
  }, [])

  const startValue = (m: Measured, handle: Handle) => {
    if (handle.kind === 'gap') return handle.axis === 'row' ? m.columnGap : m.rowGap
    return handle.kind === 'padding' ? m.padding[handle.side] : m.margin[handle.side]
  }

  function onPointerDown(handle: Handle, event: ReactPointerEvent) {
    if (!measured || !target) return
    event.preventDefault()
    event.stopPropagation()
    if (!onStart()) return
    ;(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId)
    const next: Drag = {
      handle, startX: event.clientX, startY: event.clientY, start: measured, scale: pageRhythm(),
      last: {}, value: startValue(measured, handle), snapped: false, all: event.shiftKey, mirror: event.altKey,
    }
    dragRef.current = next
    setDrag(next)
    document.body.style.userSelect = 'none'
  }

  function onPointerMove(event: ReactPointerEvent) {
    const d = dragRef.current
    if (!d || !target) return
    event.preventDefault()
    const s = d.start.scale
    const dx = (event.clientX - d.startX) / s
    const dy = (event.clientY - d.startY) / s
    let delta = 0
    const h = d.handle
    if (h.kind === 'gap') delta = h.axis === 'row' ? dx : dy
    else {
      // Padding grows toward the middle; margin grows away from the box.
      const inward = { top: dy, bottom: -dy, left: dx, right: -dx }[h.side]
      delta = h.kind === 'padding' ? inward : -inward
    }
    const raw = startValue(d.start, h) + delta
    const free = event.ctrlKey || event.metaKey
    const { value, snapped } = free ? { value: Math.round(raw), snapped: false } : snapToRhythm(raw, d.scale)
    const updated: Drag = { ...d, value: h.kind === 'margin' ? value : Math.max(0, value), snapped, all: event.shiftKey, mirror: event.altKey }
    const styles = styleFor(updated, updated.value)
    // Sides a modifier stopped covering go back to where they started.
    for (const key of Object.keys(d.last)) if (!(key in styles)) styles[key] = ''
    onPreview(styles)
    updated.last = Object.fromEntries(Object.entries(styles).filter(([, v]) => v !== ''))
    dragRef.current = updated
    setDrag(updated)
    setMeasured(measure(target))
  }

  function finish(event: ReactPointerEvent) {
    const d = dragRef.current
    if (!d) return
    if ((event.currentTarget as HTMLElement).hasPointerCapture(event.pointerId)) (event.currentTarget as HTMLElement).releasePointerCapture(event.pointerId)
    dragRef.current = null
    setDrag(null)
    document.body.style.userSelect = ''
    const h = d.handle
    const what = h.kind === 'gap' ? 'gap' : `${d.all ? '' : `${d.mirror ? `${h.side} and ${OPPOSITE[h.side]} ` : `${h.side} `}`}${h.kind}`
    if (Object.keys(d.last).length) onCommit(d.last, `Spacing: ${what} ${Math.round(d.value)}px`)
    if (target) setMeasured(measure(target))
  }

  // A drag that loses its window (alt-tab, blur) still commits.
  useEffect(() => {
    if (!drag) return
    const cancel = () => {
      const d = dragRef.current
      if (!d) return
      dragRef.current = null
      setDrag(null)
      document.body.style.userSelect = ''
      if (Object.keys(d.last).length) onCommit(d.last, `Spacing: ${d.handle.kind} ${Math.round(d.value)}px`)
    }
    window.addEventListener('blur', cancel)
    return () => window.removeEventListener('blur', cancel)
  }, [drag, onCommit])

  const isHot = useCallback((kind: SpacingKind, side?: Side, gapIndex?: number) => {
    const active = drag?.handle ?? hot
    if (!active || active.kind !== kind) return false
    if (kind === 'gap') return active.kind === 'gap' && (gapIndex === undefined || active.index === gapIndex)
    if (active.kind === 'gap' || !side) return false
    if (drag?.all) return true
    return active.side === side || (!!drag?.mirror && OPPOSITE[active.side] === side)
  }, [drag, hot])

  const label = useMemo(() => {
    if (!drag || !measured) return null
    const h = drag.handle
    let x = 0
    let y = 0
    if (h.kind === 'gap') {
      const g = measured.gaps.find((gap) => gap.index === h.index) ?? measured.gaps[0]
      if (!g) return null
      x = g.rect.left + g.rect.width / 2
      y = g.rect.top + g.rect.height / 2
    } else {
      const p = pillPosition(measured, h.kind, h.side)
      x = p.x
      y = p.y
    }
    const what = h.kind === 'gap' ? 'Gap' : `${h.kind === 'padding' ? 'Padding' : 'Margin'}${drag.all ? '' : ` ${h.side}${drag.mirror ? ` + ${OPPOSITE[h.side]}` : ''}`}`
    return { x, y, text: `${what} ${Math.round(drag.value)}`, snapped: drag.snapped }
  }, [drag, measured])

  if (!visible || !measured || !target) return null
  const show = near || !!drag || !!hot
  const tiny = measured.border.width < 28 || measured.border.height < 20
  // Padding handles live inside the box. On a button-sized element they would sit on the label and
  // swallow the hover that previews its states, so small elements get margin and gap handles only.
  const roomy = measured.border.width >= 96 && measured.border.height >= 56

  return (
    <div className={`froam-spacing ${show ? 'is-near' : ''} ${drag ? 'is-dragging' : ''}`} data-chef-editor-root="true" aria-hidden={!show}>
      {/* Zones */}
      {(['padding', 'margin'] as const).map((kind) => SIDES.map((side) => {
        const r = zoneRect(measured, kind, side)
        if (r.width < 1 || r.height < 1) return null
        return <div key={`${kind}-${side}`} className={`froam-spacing__zone froam-spacing__zone--${kind} ${isHot(kind, side) ? 'is-hot' : ''}`} style={{ left: r.left, top: r.top, width: r.width, height: r.height }} />
      }))}
      {measured.gaps.map((g) => (
        <div key={`gap-${g.index}`} className={`froam-spacing__zone froam-spacing__zone--gap ${isHot('gap', undefined, g.index) || (drag?.handle.kind === 'gap') ? 'is-hot' : ''}`} style={{ left: g.rect.left, top: g.rect.top, width: g.rect.width, height: g.rect.height }} />
      ))}

      {/* Pills */}
      {!tiny && (roomy ? (['padding', 'margin'] as const) : (['margin'] as const)).map((kind) => SIDES.map((side) => {
        const p = pillPosition(measured, kind, side)
        const horizontal = side === 'top' || side === 'bottom'
        const value = kind === 'padding' ? measured.padding[side] : measured.margin[side]
        const handle: Handle = { kind, side }
        return (
          <div
            key={`pill-${kind}-${side}`}
            role="slider"
            aria-label={`${kind === 'padding' ? 'Padding' : 'Margin'} ${side}`}
            aria-valuenow={Math.round(value)}
            className={`froam-spacing__pill froam-spacing__pill--${kind} ${horizontal ? 'is-h' : 'is-v'} ${isHot(kind, side) ? 'is-hot' : ''}`}
            style={{ left: p.x, top: p.y, cursor: horizontal ? 'ns-resize' : 'ew-resize' }}
            title={`${kind === 'padding' ? 'Padding' : 'Margin'} ${side}: ${Math.round(value)}px — drag. Shift: all sides · Alt: both sides · Ctrl: no snapping`}
            onPointerEnter={() => setHot(handle)}
            onPointerLeave={() => setHot((current) => (current && current.kind !== 'gap' && current.kind === kind && current.side === side ? null : current))}
            onPointerDown={(event) => onPointerDown(handle, event)}
            onPointerMove={onPointerMove}
            onPointerUp={finish}
            onPointerCancel={finish}
          />
        )
      }))}
      {measured.gaps.map((g) => {
        const handle: Handle = { kind: 'gap', axis: g.axis, index: g.index }
        return (
          <div
            key={`gap-pill-${g.index}`}
            role="slider"
            aria-label="Gap"
            aria-valuenow={Math.round(g.value)}
            className={`froam-spacing__pill froam-spacing__pill--gap ${g.axis === 'row' ? 'is-v' : 'is-h'} ${isHot('gap', undefined, g.index) ? 'is-hot' : ''}`}
            style={{ left: g.rect.left + g.rect.width / 2, top: g.rect.top + g.rect.height / 2, cursor: g.axis === 'row' ? 'ew-resize' : 'ns-resize' }}
            title={`Gap: ${Math.round(g.value)}px — drag to change the space between every item`}
            onPointerEnter={() => setHot(handle)}
            onPointerLeave={() => setHot(null)}
            onPointerDown={(event) => onPointerDown(handle, event)}
            onPointerMove={onPointerMove}
            onPointerUp={finish}
            onPointerCancel={finish}
          />
        )
      })}

      {label && (
        <div className={`froam-spacing__label ${label.snapped ? 'is-snapped' : ''}`} style={{ left: label.x, top: label.y }}>
          {label.text}
          {label.snapped && <span>on your scale</span>}
        </div>
      )}
    </div>
  )
}
