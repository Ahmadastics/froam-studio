import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react'
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  Blend,
  Bold,
  BringToFront,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Combine,
  Contrast,
  Copy,
  CornerLeftUp,
  CornerRightDown,
  Eraser,
  Eye,
  EyeOff,
  Grid2X2,
  ImagePlus,
  Italic,
  Layers,
  LayoutTemplate,
  Maximize,
  Palette,
  SendToBack,
  Pipette,
  RectangleHorizontal,
  Rows3,
  Sparkles,
  Strikethrough,
  Trash2,
  Type,
  Underline,
  Undo2,
  Ungroup,
} from 'lucide-react'

type FloatingAction =
  | 'bold'
  | 'italic'
  | 'underline'
  | 'strike'
  | 'align-left'
  | 'align-center'
  | 'align-right'
  | 'align-justify'
  | 'color'
  | 'bg-color'
  | 'clear-bg'
  | 'image'
  | 'duplicate'
  | 'merge'
  | 'unmerge'
  | 'delete'
  | 'edit-text'
  | 'undo'
  | 'toggle-hidden'
  | 'bring-front'
  | 'send-back'

type WalkDirection = 'parent' | 'prev' | 'next' | 'child'

type SelectionPatch = Record<string, string | number>

type Props = {
  targetRect: DOMRect | null
  visible: boolean
  label: string
  fontFamily: string
  fontSize: number
  fontWeight: string
  lineHeight: number
  letterSpacing: number
  wordSpacing: number
  textTransform: string
  isBold?: boolean
  isItalic?: boolean
  isUnderline?: boolean
  isStrike?: boolean
  textAlign?: string
  color: string
  background: string
  width: string
  height: string
  display: string
  flexDirection: string
  justifyContent: string
  alignItems: string
  gap: number
  padding: number
  radius: number
  overflow: string
  opacity: number
  isHidden?: boolean
  mixBlendMode: string
  zIndex: number
  fontOptions: Array<{ label: string; value: string }>
  selectionCount: number
  docked?: boolean
  canUndo?: boolean
  onWalk?: (direction: WalkDirection) => void
  onAction: (action: FloatingAction, value?: string) => void
  onStyle: (styles: Record<string, string>, selectionPatch?: SelectionPatch, label?: string) => void
}

const VIEWPORT_GAP = 12
const TARGET_GAP = 12
const SCRUB_SLOP = 6

/* ─── v4: scrub-to-adjust ───
   Press any numeric control and drag horizontally to change it — the
   phone answer to precision editing. Slop-gated so plain taps still
   focus the input / press the buttons. */
function useScrub(onSteps: (steps: number) => void, pixelsPerStep = 8) {
  const stateRef = useRef<{ pointerId: number; lastX: number; acc: number; active: boolean } | null>(null)

  function handlePointerDown(event: ReactPointerEvent) {
    if (event.button !== 0 && event.pointerType === 'mouse') return
    stateRef.current = { pointerId: event.pointerId, lastX: event.clientX, acc: 0, active: false }
  }

  function handlePointerMove(event: ReactPointerEvent) {
    const state = stateRef.current
    if (!state || state.pointerId !== event.pointerId) return
    const dx = event.clientX - state.lastX
    if (!state.active) {
      state.acc += dx
      state.lastX = event.clientX
      if (Math.abs(state.acc) < SCRUB_SLOP) return
      state.active = true
      state.acc = 0
      try { event.currentTarget.setPointerCapture(event.pointerId) } catch { /* pointer already gone */ }
      return
    }
    state.acc += dx
    state.lastX = event.clientX
    const steps = Math.trunc(state.acc / pixelsPerStep)
    if (steps !== 0) {
      state.acc -= steps * pixelsPerStep
      onSteps(steps)
      if ('vibrate' in navigator) navigator.vibrate?.(2)
    }
  }

  function handlePointerUp(event: ReactPointerEvent) {
    const state = stateRef.current
    if (!state) return
    try {
      if (state.active && event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId)
      }
    } catch { /* pointer already gone */ }
    stateRef.current = null
  }

  return {
    onPointerDown: handlePointerDown,
    onPointerMove: handlePointerMove,
    onPointerUp: handlePointerUp,
    onPointerCancel: handlePointerUp,
  }
}

/* ─── v4: page palette ───
   The best mobile color picker is no picker: read the colors the site
   already uses, rank them by frequency, offer them as one-tap chips. */
function normalizeToHex(value: string): string | null {
  const match = value.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)(?:\s*,\s*([\d.]+))?\s*\)/)
  if (!match) return value.startsWith('#') ? value.toLowerCase() : null
  if (match[4] !== undefined && Number.parseFloat(match[4]) < 0.4) return null
  const toHex = (channel: string) => Number(channel).toString(16).padStart(2, '0')
  return `#${toHex(match[1])}${toHex(match[2])}${toHex(match[3])}`
}

export function collectPagePalette(): string[] {
  // Scan the whole page, not just the froam root — brand colors live in headers/footers too
  const counts = new Map<string, number>()
  const elements = document.body.querySelectorAll<HTMLElement>('*')
  let scanned = 0
  for (const element of elements) {
    if (scanned > 1500) break
    if (element.closest('[data-chef-editor-root="true"]')) continue
    scanned += 1
    const computed = window.getComputedStyle(element)
    for (const raw of [computed.color, computed.backgroundColor, computed.borderTopColor]) {
      const hex = normalizeToHex(raw)
      if (!hex) continue
      counts.set(hex, (counts.get(hex) ?? 0) + 1)
    }
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10).map(([hex]) => hex)
}

function relativeLuminance(hex: string): number {
  const channels = [1, 3, 5].map((offset) => {
    const channel = Number.parseInt(hex.slice(offset, offset + 2), 16) / 255
    return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2]
}

function contrastRatio(hexA: string, hexB: string): number {
  const a = relativeLuminance(hexA)
  const b = relativeLuminance(hexB)
  const [lighter, darker] = a >= b ? [a, b] : [b, a]
  return (lighter + 0.05) / (darker + 0.05)
}

function saturationOf(hex: string): number {
  const r = Number.parseInt(hex.slice(1, 3), 16) / 255
  const g = Number.parseInt(hex.slice(3, 5), 16) / 255
  const b = Number.parseInt(hex.slice(5, 7), 16) / 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  return max === 0 ? 0 : (max - min) / max
}

function pickAccent(palette: string[]): string {
  return palette.find((hex) => {
    const lum = relativeLuminance(hex)
    return saturationOf(hex) > 0.35 && lum > 0.05 && lum < 0.8
  }) ?? '#14b8a6'
}

/* ─── v4: quick looks — one-tap style recipes ─── */
type Look = {
  name: string
  swatch: CSSProperties
  styles: (accent: string) => Record<string, string>
  patch?: SelectionPatch
}

const LOOKS: Look[] = [
  {
    name: 'Lift',
    swatch: { background: '#1f2937', boxShadow: '0 4px 10px rgba(0,0,0,0.55)', borderRadius: 6 },
    styles: () => ({ boxShadow: '0 14px 34px rgba(0, 0, 0, 0.22)', borderRadius: '16px' }),
    patch: { borderRadiusTL: 16, borderRadiusTR: 16, borderRadiusBR: 16, borderRadiusBL: 16 },
  },
  {
    name: 'Glass',
    swatch: { background: 'rgba(255,255,255,0.14)', border: '1px solid rgba(255,255,255,0.4)', borderRadius: 6 },
    styles: () => ({
      background: 'rgba(255, 255, 255, 0.08)',
      backdropFilter: 'blur(14px)',
      border: '1px solid rgba(255, 255, 255, 0.18)',
      borderRadius: '16px',
    }),
    patch: { borderRadiusTL: 16, borderRadiusTR: 16, borderRadiusBR: 16, borderRadiusBL: 16 },
  },
  {
    name: 'Outline',
    swatch: { background: 'transparent', border: '1.5px solid currentColor', borderRadius: 6 },
    styles: () => ({ background: 'transparent', border: '1.5px solid currentColor', borderRadius: '12px' }),
  },
  {
    name: 'Pill',
    swatch: { background: '#334155', borderRadius: 999 },
    styles: () => ({ borderRadius: '999px', paddingTop: '10px', paddingBottom: '10px', paddingLeft: '20px', paddingRight: '20px' }),
    patch: { borderRadiusTL: 999, borderRadiusTR: 999, borderRadiusBR: 999, borderRadiusBL: 999 },
  },
  {
    name: 'Pop',
    swatch: { background: 'var(--fs-accent, #14b8a6)', borderRadius: 6 },
    styles: (accent) => ({ background: accent, color: '#ffffff', fontWeight: '700', borderRadius: '12px' }),
    patch: { fontWeight: '700' },
  },
  {
    name: 'Reset look',
    swatch: { background: 'transparent', border: '1px dashed rgba(255,255,255,0.35)', borderRadius: 6 },
    styles: () => ({ boxShadow: 'none', border: 'none', backdropFilter: 'none' }),
  },
]

function NumericField({
  label,
  value,
  min,
  max,
  step = 1,
  unit,
  onChange,
}: {
  label: string
  value: string | number
  min?: number
  max?: number
  step?: number
  unit?: string
  onChange: (value: number) => void
}) {
  const numericValue = Number.parseFloat(String(value)) || 0
  const clamp = (next: number) => Math.min(max ?? Number.POSITIVE_INFINITY, Math.max(min ?? Number.NEGATIVE_INFINITY, next))
  const scrub = useScrub((steps) => onChange(clamp(numericValue + steps * step)), 6)
  return (
    <label className="froam-floating-bar__field froam-floating-bar__field--scrub">
      <span {...scrub} style={{ touchAction: 'none', cursor: 'ew-resize' }}>{label}</span>
      <div className="froam-floating-bar__number">
        <input
          type="number"
          value={numericValue}
          min={min}
          max={max}
          step={step}
          onChange={(event) => onChange(Number(event.target.value))}
        />
        {unit && <small>{unit}</small>}
      </div>
    </label>
  )
}

export default function FroamFloatingBar({
  targetRect,
  visible,
  label,
  fontFamily,
  fontSize,
  fontWeight,
  lineHeight,
  letterSpacing,
  wordSpacing,
  textTransform,
  isBold,
  isItalic,
  isUnderline,
  isStrike,
  textAlign,
  color,
  background,
  width,
  height,
  display,
  flexDirection,
  justifyContent,
  alignItems,
  gap,
  padding,
  radius,
  overflow,
  opacity,
  isHidden = false,
  mixBlendMode,
  zIndex,
  fontOptions,
  selectionCount,
  docked = false,
  canUndo = false,
  onWalk,
  onAction,
  onStyle,
}: Props) {
  const barRef = useRef<HTMLDivElement>(null)
  const [expanded, setExpanded] = useState(false)
  const [narrow, setNarrow] = useState(false)
  const [position, setPosition] = useState({ left: 12, top: 12 })
  const [openPop, setOpenPop] = useState<'palette' | 'looks' | null>(null)
  const [palette, setPalette] = useState<string[]>([])
  const [paletteMode, setPaletteMode] = useState<'fill' | 'text'>('fill')

  const fontScrub = useScrub((steps) => {
    const next = Math.min(400, Math.max(6, Math.round(fontSize) + steps))
    onStyle({ fontSize: `${next}px` }, { fontSize: next }, 'Changed font size')
  }, 8)

  // v4.1: opacity scrub — accumulate in a ref so fast drags don't lose steps to render lag
  const opacityRef = useRef(opacity)
  useEffect(() => { opacityRef.current = opacity }, [opacity])
  const opacityScrub = useScrub((steps) => {
    const next = Math.min(1, Math.max(0, Math.round((opacityRef.current + steps * 0.02) * 100) / 100))
    opacityRef.current = next
    onStyle({ opacity: String(next) }, { opacity: next }, 'Changed opacity')
  }, 6)

  useLayoutEffect(() => {
    if (docked || !visible || !targetRect || !barRef.current) return

    const placeBar = () => {
      const bar = barRef.current
      if (!bar) return
      const leftPanel = document.querySelector<HTMLElement>('.froam-figma-left')?.getBoundingClientRect()
      const rightPanel = document.querySelector<HTMLElement>('.froam-dp:not(.froam-sheet .froam-dp)')?.getBoundingClientRect()
      const safeLeft = leftPanel ? leftPanel.right + VIEWPORT_GAP : VIEWPORT_GAP
      const safeRight = rightPanel ? rightPanel.left - VIEWPORT_GAP : window.innerWidth - VIEWPORT_GAP
      const availableWidth = Math.max(280, safeRight - safeLeft)
      const nextNarrow = availableWidth < 760

      bar.style.maxWidth = `${availableWidth}px`
      bar.style.width = expanded ? `${Math.min(920, availableWidth)}px` : 'max-content'

      const constrainedRect = bar.getBoundingClientRect()
      const centeredLeft = targetRect.left + targetRect.width / 2 - constrainedRect.width / 2
      const left = Math.min(
        Math.max(safeLeft, centeredLeft),
        Math.max(safeLeft, safeRight - constrainedRect.width),
      )
      const above = targetRect.top - constrainedRect.height - TARGET_GAP
      const below = targetRect.bottom + TARGET_GAP
      const maxTop = Math.max(VIEWPORT_GAP, window.innerHeight - constrainedRect.height - VIEWPORT_GAP)
      const top = above >= VIEWPORT_GAP ? above : Math.min(below, maxTop)

      bar.style.left = `${left}px`
      bar.style.top = `${top}px`
      if (narrow !== nextNarrow) setNarrow(nextNarrow)
      setPosition((current) => (
        Math.abs(current.left - left) < 0.5 && Math.abs(current.top - top) < 0.5
          ? current
          : { left, top }
      ))
    }

    placeBar()
    const resizeObserver = new ResizeObserver(placeBar)
    resizeObserver.observe(barRef.current)
    window.addEventListener('resize', placeBar)
    return () => {
      resizeObserver.disconnect()
      window.removeEventListener('resize', placeBar)
    }
  }, [docked, expanded, narrow, targetRect, visible])

  if (!visible || !targetRect) return null

  const cleanDimension = (value: string, fallback: number) => Number.parseFloat(value) || fallback
  const widthValue = cleanDimension(width, targetRect.width)
  const heightValue = cleanDimension(height, targetRect.height)
  const backgroundHex = normalizeToHex(background) ?? '#0b0f14'

  function togglePop(which: 'palette' | 'looks') {
    setOpenPop((current) => {
      const next = current === which ? null : which
      if (next && palette.length === 0) setPalette(collectPagePalette())
      return next
    })
  }

  function applyChip(hex: string) {
    if (paletteMode === 'text') onAction('color', hex)
    else onAction('bg-color', hex)
    if ('vibrate' in navigator) navigator.vibrate?.(4)
  }

  function applyLook(look: Look) {
    const accent = pickAccent(palette.length ? palette : collectPagePalette())
    onStyle(look.styles(accent), look.patch, `Look: ${look.name}`)
    if ('vibrate' in navigator) navigator.vibrate?.(6)
    setOpenPop(null)
  }

  return (
    <div
      ref={barRef}
      className={`froam-floating-bar ${expanded ? 'is-expanded' : ''} ${narrow ? 'is-narrow' : ''} ${docked ? 'is-docked' : ''}`}
      data-chef-editor-root="true"
      style={docked ? undefined : { left: position.left, top: position.top }}
    >
      <div className="froam-floating-bar__primary">
        {/* v4: selection walker — precise selection without precise fingers */}
        {onWalk && (
          <div className="froam-floating-bar__group froam-floating-bar__walker" role="group" aria-label="Walk selection">
            <button type="button" className="froam-floating-bar__btn" title="Select parent" onClick={() => onWalk('parent')}><CornerLeftUp size={13} /></button>
            <button type="button" className="froam-floating-bar__btn" title="Previous sibling" onClick={() => onWalk('prev')}><ChevronLeft size={13} /></button>
            <button type="button" className="froam-floating-bar__btn" title="Next sibling" onClick={() => onWalk('next')}><ChevronRight size={13} /></button>
            <button type="button" className="froam-floating-bar__btn" title="Select first child" onClick={() => onWalk('child')}><CornerRightDown size={13} /></button>
          </div>
        )}

        <div className="froam-floating-bar__identity" title={label}>
          <Type size={13} />
          <span>{label}</span>
        </div>

        {/* v4: one tap to edit copy — double-tap is misery on phones */}
        <button
          type="button"
          className="froam-floating-bar__btn froam-floating-bar__edit-text"
          title="Edit text"
          onClick={() => onAction('edit-text')}
        >
          <span className="froam-floating-bar__aa">Aa</span>
        </button>

        <select
          className="froam-floating-bar__select froam-floating-bar__font"
          value={fontFamily}
          title="Font family"
          aria-label="Font family"
          onChange={(event) => onStyle(
            { fontFamily: event.target.value },
            { fontFamily: event.target.value },
            'Changed font family',
          )}
        >
          {fontOptions.map((font) => <option key={font.value} value={font.value}>{font.label}</option>)}
        </select>

        <div className="froam-floating-bar__stepper froam-floating-bar__stepper--scrub" title="Font size — drag the number to scrub" {...fontScrub} style={{ touchAction: 'none' }}>
          <button type="button" onClick={() => onStyle({ fontSize: `${Math.max(6, fontSize - 1)}px` }, { fontSize: Math.max(6, fontSize - 1) })}>−</button>
          <input
            type="number"
            value={Math.round(fontSize)}
            min={6}
            max={400}
            aria-label="Font size"
            onChange={(event) => {
              const next = Math.max(6, Number(event.target.value))
              onStyle({ fontSize: `${next}px` }, { fontSize: next }, 'Changed font size')
            }}
          />
          <button type="button" onClick={() => onStyle({ fontSize: `${Math.min(400, fontSize + 1)}px` }, { fontSize: Math.min(400, fontSize + 1) })}>+</button>
        </div>

        <select
          className="froam-floating-bar__select froam-floating-bar__weight"
          value={fontWeight}
          title="Font weight"
          aria-label="Font weight"
          onChange={(event) => onStyle(
            { fontWeight: event.target.value },
            { fontWeight: event.target.value },
            'Changed font weight',
          )}
        >
          {['300', '400', '500', '600', '700', '800', '900'].map((weight) => <option key={weight} value={weight}>{weight}</option>)}
        </select>

        <span className="froam-floating-bar__sep" />

        <div className="froam-floating-bar__group">
          <button type="button" className={`froam-floating-bar__btn ${isBold ? 'is-active' : ''}`} title="Bold" onClick={() => onAction('bold')}><Bold size={13} /></button>
          <button type="button" className={`froam-floating-bar__btn ${isItalic ? 'is-active' : ''}`} title="Italic" onClick={() => onAction('italic')}><Italic size={13} /></button>
          <button type="button" className={`froam-floating-bar__btn ${isUnderline ? 'is-active' : ''}`} title="Underline" onClick={() => onAction('underline')}><Underline size={13} /></button>
          <button type="button" className={`froam-floating-bar__btn ${isStrike ? 'is-active' : ''}`} title="Strikethrough" onClick={() => onAction('strike')}><Strikethrough size={13} /></button>
        </div>

        <span className="froam-floating-bar__sep" />

        <div className="froam-floating-bar__group">
          <button type="button" className={`froam-floating-bar__btn ${textAlign === 'left' || textAlign === 'start' ? 'is-active' : ''}`} title="Align left" onClick={() => onAction('align-left')}><AlignLeft size={13} /></button>
          <button type="button" className={`froam-floating-bar__btn ${textAlign === 'center' ? 'is-active' : ''}`} title="Align center" onClick={() => onAction('align-center')}><AlignCenter size={13} /></button>
          <button type="button" className={`froam-floating-bar__btn ${textAlign === 'right' || textAlign === 'end' ? 'is-active' : ''}`} title="Align right" onClick={() => onAction('align-right')}><AlignRight size={13} /></button>
          <button type="button" className={`froam-floating-bar__btn ${textAlign === 'justify' ? 'is-active' : ''}`} title="Justify" onClick={() => onAction('align-justify')}><AlignJustify size={13} /></button>
        </div>

        <span className="froam-floating-bar__sep" />

        <div className="froam-floating-bar__group">
          <button
            type="button"
            className="froam-floating-bar__btn froam-floating-bar__btn--merge"
            title={selectionCount > 1 ? 'Merge selected into one movable stamp' : 'Merge this with overlapping sibling shapes'}
            onClick={() => onAction('merge')}
          >
            <Combine size={13} />
          </button>
          <button
            type="button"
            className="froam-floating-bar__btn"
            title="Ungroup merged stamp"
            onClick={() => onAction('unmerge')}
          >
            <Ungroup size={13} />
          </button>
        </div>

        <span className="froam-floating-bar__sep" />

        {/* v4: page palette — the site's own colors as one-tap chips */}
        <button
          type="button"
          className={`froam-floating-bar__btn ${openPop === 'palette' ? 'is-active' : ''}`}
          title="Page palette — colors from this site"
          onClick={() => togglePop('palette')}
        >
          <Pipette size={13} />
        </button>

        {/* v4: quick looks — one-tap style recipes */}
        <button
          type="button"
          className={`froam-floating-bar__btn ${openPop === 'looks' ? 'is-active' : ''}`}
          title="Quick looks — one-tap styles"
          onClick={() => togglePop('looks')}
        >
          <Sparkles size={13} />
        </button>

        <label className="froam-floating-bar__color-btn" title="Text color" style={{ '--froam-swatch': color } as CSSProperties}>
          <Type size={11} />
          <input type="color" className="froam-floating-bar__color-input" value={color} onChange={(event) => onAction('color', event.target.value)} />
        </label>
        <label className="froam-floating-bar__color-btn" title="Background" style={{ '--froam-swatch': background } as CSSProperties}>
          <Palette size={11} />
          <input type="color" className="froam-floating-bar__color-input" value={background} onChange={(event) => onAction('bg-color', event.target.value)} />
        </label>
        <button
          type="button"
          className="froam-floating-bar__btn"
          title="Clear fill"
          onClick={() => onAction('clear-bg')}
        >
          <Eraser size={13} />
        </button>

        <span className="froam-floating-bar__sep" />

        {/* v4.1: opacity scrub — drag the % to fade any element */}
        <div
          className="froam-floating-bar__opacity"
          title="Opacity — drag to fade"
          {...opacityScrub}
          style={{ touchAction: 'none' }}
        >
          <Contrast size={13} />
          <span>{Math.round(opacity * 100)}%</span>
        </div>

        {/* v4.1: show / hide any element */}
        <button
          type="button"
          className={`froam-floating-bar__btn ${isHidden ? 'is-active' : ''}`}
          title={isHidden ? 'Show element' : 'Hide element'}
          onClick={() => onAction('toggle-hidden')}
        >
          {isHidden ? <EyeOff size={13} /> : <Eye size={13} />}
        </button>

        {docked && (
          <>
            <span className="froam-floating-bar__sep" />
            <button
              type="button"
              className="froam-floating-bar__btn"
              title="Undo"
              disabled={!canUndo}
              onClick={() => onAction('undo')}
            >
              <Undo2 size={13} />
            </button>
          </>
        )}

        <button
          type="button"
          className={`froam-floating-bar__expand ${expanded ? 'is-active' : ''}`}
          onClick={() => setExpanded((current) => !current)}
          aria-expanded={expanded}
          title="More typography and layout controls"
        >
          <span>More</span>
          <ChevronDown size={13} />
        </button>
      </div>

      {openPop === 'palette' && (
        <div className="froam-floating-bar__pop" data-chef-editor-root="true">
          <div className="froam-floating-bar__pop-head">
            <span>Page palette</span>
            <div className="froam-floating-bar__pop-toggle" role="group" aria-label="Apply as">
              <button type="button" className={paletteMode === 'fill' ? 'is-active' : ''} onClick={() => setPaletteMode('fill')}>Fill</button>
              <button type="button" className={paletteMode === 'text' ? 'is-active' : ''} onClick={() => setPaletteMode('text')}>Text</button>
            </div>
          </div>
          <div className="froam-floating-bar__chips">
            {palette.map((hex) => {
              const readable = paletteMode === 'text' && contrastRatio(hex, backgroundHex) >= 4.5
              return (
                <button
                  key={hex}
                  type="button"
                  className="froam-floating-bar__chip"
                  style={{ '--froam-chip': hex } as CSSProperties}
                  title={`${hex}${readable ? ' — readable on current fill' : ''}`}
                  onClick={() => applyChip(hex)}
                >
                  {paletteMode === 'text' && <span style={{ color: hex }}>Aa</span>}
                  {readable && <i className="froam-floating-bar__chip-ok" />}
                </button>
              )
            })}
            {palette.length === 0 && <span className="froam-floating-bar__pop-empty">No colors found yet</span>}
          </div>
        </div>
      )}

      {openPop === 'looks' && (
        <div className="froam-floating-bar__pop" data-chef-editor-root="true">
          <div className="froam-floating-bar__pop-head">
            <span>Quick looks</span>
          </div>
          <div className="froam-floating-bar__looks">
            {LOOKS.map((look) => (
              <button key={look.name} type="button" onClick={() => applyLook(look)}>
                <i style={look.swatch} />
                <span>{look.name}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {expanded && (
        <div className="froam-floating-bar__advanced">
          <section>
            <header><Type size={13} /> Typography</header>
            <div className="froam-floating-bar__fields">
              <NumericField label="Line" value={lineHeight} min={0.5} max={5} step={0.05} onChange={(next) => onStyle({ lineHeight: String(next) }, { lineHeight: next }, 'Changed line height')} />
              <NumericField label="Tracking" value={letterSpacing} min={-20} max={100} step={0.1} unit="px" onChange={(next) => onStyle({ letterSpacing: `${next}px` }, { letterSpacing: next }, 'Changed letter spacing')} />
              <NumericField label="Words" value={wordSpacing} min={-20} max={100} step={0.5} unit="px" onChange={(next) => onStyle({ wordSpacing: `${next}px` }, { wordSpacing: next }, 'Changed word spacing')} />
              <label className="froam-floating-bar__field">
                <span>Case</span>
                <select value={textTransform} onChange={(event) => onStyle({ textTransform: event.target.value }, { textTransform: event.target.value }, 'Changed text case')}>
                  <option value="none">Original</option>
                  <option value="uppercase">UPPER</option>
                  <option value="lowercase">lower</option>
                  <option value="capitalize">Title</option>
                </select>
              </label>
            </div>
          </section>

          <section>
            <header><Maximize size={13} /> Size & shape</header>
            <div className="froam-floating-bar__fields">
              <NumericField label="Width" value={widthValue} min={1} max={5000} unit="px" onChange={(next) => onStyle({ width: `${next}px` }, { width: `${next}px` }, 'Changed width')} />
              <NumericField label="Height" value={heightValue} min={1} max={5000} unit="px" onChange={(next) => onStyle({ height: `${next}px` }, { height: `${next}px` }, 'Changed height')} />
              <NumericField label="Padding" value={padding} min={0} max={400} unit="px" onChange={(next) => onStyle({ padding: `${next}px` }, { paddingTop: next, paddingRight: next, paddingBottom: next, paddingLeft: next }, 'Changed padding')} />
              <NumericField label="Radius" value={radius} min={0} max={1000} unit="px" onChange={(next) => onStyle({ borderRadius: `${next}px` }, { borderRadiusTL: next, borderRadiusTR: next, borderRadiusBR: next, borderRadiusBL: next }, 'Changed radius')} />
            </div>
            <div className="froam-floating-bar__preset-row">
              <button type="button" onClick={() => onStyle({ width: 'auto' }, { width: 'auto' }, 'Width: auto')}>Auto W</button>
              <button type="button" onClick={() => onStyle({ height: 'auto' }, { height: 'auto' }, 'Height: auto')}>Auto H</button>
              <button type="button" onClick={() => onStyle({ width: '100%', maxWidth: '100%' }, { width: '100%', maxWidth: '100%' }, 'Fill parent')}>Fill</button>
              <button type="button" onClick={() => onStyle({ width: 'max-content', height: 'auto', maxWidth: '100%' }, { width: 'max-content', height: 'auto' }, 'Hug content')}>Hug</button>
            </div>
          </section>

          <section>
            <header><LayoutTemplate size={13} /> Layout</header>
            <div className="froam-floating-bar__segmented">
              <button type="button" className={display === 'block' ? 'is-active' : ''} onClick={() => onStyle({ display: 'block' }, { display: 'block' }, 'Layout: block')}><RectangleHorizontal size={13} /> Block</button>
              <button type="button" className={display.includes('flex') ? 'is-active' : ''} onClick={() => onStyle({ display: 'flex' }, { display: 'flex' }, 'Layout: flex')}><Rows3 size={13} /> Flex</button>
              <button type="button" className={display === 'grid' ? 'is-active' : ''} onClick={() => onStyle({ display: 'grid' }, { display: 'grid' }, 'Layout: grid')}><Grid2X2 size={13} /> Grid</button>
            </div>
            <div className="froam-floating-bar__fields">
              <label className="froam-floating-bar__field">
                <span>Direction</span>
                <select value={flexDirection} onChange={(event) => onStyle({ display: 'flex', flexDirection: event.target.value }, { display: 'flex', flexDirection: event.target.value }, 'Changed flex direction')}>
                  <option value="row">Row</option>
                  <option value="column">Column</option>
                  <option value="row-reverse">Row reverse</option>
                  <option value="column-reverse">Column reverse</option>
                </select>
              </label>
              <label className="froam-floating-bar__field">
                <span>Justify</span>
                <select value={justifyContent} onChange={(event) => onStyle({ justifyContent: event.target.value }, { justifyContent: event.target.value }, 'Changed distribution')}>
                  <option value="flex-start">Start</option>
                  <option value="center">Center</option>
                  <option value="flex-end">End</option>
                  <option value="space-between">Between</option>
                  <option value="space-around">Around</option>
                  <option value="space-evenly">Evenly</option>
                </select>
              </label>
              <label className="froam-floating-bar__field">
                <span>Align</span>
                <select value={alignItems} onChange={(event) => onStyle({ alignItems: event.target.value }, { alignItems: event.target.value }, 'Changed alignment')}>
                  <option value="stretch">Stretch</option>
                  <option value="flex-start">Start</option>
                  <option value="center">Center</option>
                  <option value="flex-end">End</option>
                  <option value="baseline">Baseline</option>
                </select>
              </label>
              <NumericField label="Gap" value={gap} min={0} max={400} unit="px" onChange={(next) => onStyle({ gap: `${next}px` }, { gap: next }, 'Changed gap')} />
              <label className="froam-floating-bar__field">
                <span>Overflow</span>
                <select value={overflow} onChange={(event) => onStyle({ overflow: event.target.value }, { overflow: event.target.value }, 'Changed overflow')}>
                  <option value="visible">Visible</option>
                  <option value="hidden">Hidden</option>
                  <option value="auto">Auto</option>
                  <option value="scroll">Scroll</option>
                </select>
              </label>
            </div>
          </section>

          <section>
            <header><Layers size={13} /> Depth &amp; blend</header>
            <div className="froam-floating-bar__fields">
              <NumericField label="Z-index" value={zIndex} min={-999} max={9999} onChange={(next) => onStyle({ zIndex: String(next) }, { zIndex: next }, 'Changed z-index')} />
              <label className="froam-floating-bar__field">
                <span>Blend</span>
                <select value={mixBlendMode} onChange={(event) => onStyle({ mixBlendMode: event.target.value }, { mixBlendMode: event.target.value }, 'Changed blend mode')}>
                  <option value="normal">Normal</option>
                  <option value="multiply">Multiply</option>
                  <option value="screen">Screen</option>
                  <option value="overlay">Overlay</option>
                  <option value="darken">Darken</option>
                  <option value="lighten">Lighten</option>
                  <option value="color-dodge">Color dodge</option>
                  <option value="color-burn">Color burn</option>
                  <option value="hard-light">Hard light</option>
                  <option value="soft-light">Soft light</option>
                  <option value="difference">Difference</option>
                  <option value="exclusion">Exclusion</option>
                  <option value="hue">Hue</option>
                  <option value="saturation">Saturation</option>
                  <option value="color">Color</option>
                  <option value="luminosity">Luminosity</option>
                </select>
              </label>
            </div>
            <div className="froam-floating-bar__preset-row">
              <button type="button" onClick={() => onAction('bring-front')}><BringToFront size={12} /> Front</button>
              <button type="button" onClick={() => onAction('send-back')}><SendToBack size={12} /> Back</button>
            </div>
          </section>

          <section className="froam-floating-bar__actions">
            <button type="button" onClick={() => onAction('image')}><ImagePlus size={13} /> Image</button>
            <button type="button" onClick={() => onAction('duplicate')}><Copy size={13} /> Duplicate</button>
            <button type="button" className="is-danger" onClick={() => onAction('delete')}><Trash2 size={13} /> Reset styles</button>
          </section>
        </div>
      )}
    </div>
  )
}
