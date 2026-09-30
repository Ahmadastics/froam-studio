import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react'
import { createPortal } from 'react-dom'
import type { FroamStyleState } from '../project/types'
import { FONT_GROUP_LABELS, groupFontOptions, type FontOption } from './fontSources'
import { describeSelection } from './selection-name'
import type { Look, LookGroup, LookOverrides } from './floating-bar-looks'
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  Bold,
  BringToFront,
  Check,
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
  ImagePlus,
  Italic,
  MoreHorizontal,
  SendToBack,
  Search,
  SlidersHorizontal,
  Sparkles,
  Strikethrough,
  Trash2,
  Type,
  Underline,
  Undo2,
  Ungroup,
  WandSparkles,
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
  | 'open-design'
  | 'animate'

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
  fontOptions: FontOption[]
  selectionCount: number
  isTextLayer?: boolean
  /** The element has words of its own — show the type controls. */
  hasText?: boolean
  isImage?: boolean
  docked?: boolean
  canUndo?: boolean
  onWalk?: (direction: WalkDirection) => void
  onAction: (action: FloatingAction, value?: string) => void
  onStyle: (styles: Record<string, string>, selectionPatch?: SelectionPatch, label?: string) => void
  onSaveLook?: (look: { name: string; states: Partial<Record<FroamStyleState, Record<string, string>>> }) => void
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
/* v4.8: expanded from 6 → 40+ recipes, grouped for browsing. Every look's
   `styles` is applied live via setProperty (camelCase → kebab) and compiles
   verbatim to froam.generated.css, so anything valid here ships. Looks are
   accent-aware: `accent` is the site's own picked accent, and color-mix
   derives shades from it so recipes fit whatever palette they land on. */
/* Ordered by how often a designer reaches for them, not alphabetically.
   'Pattern' was called Texture but holds Stripes/Dots/Grid/Blueprint/Halftone,
   which are patterns; 'Vibe' was called Bold but holds Bauhaus/Y2K/Retro/Comic,
   which are eras rather than weights. The old 'Effect' bucket was four
   unrelated recipes, so each moved to the group its CSS actually belongs to. */
/* Look Studio's recipes live in floating-bar-looks.ts, loaded the first time Styles opens. */
const NO_LOOKS: Look[] = []
const NO_NOTES: Record<string, string> = {}
const NO_GROUPS: readonly LookGroup[] = []
// Uniform corner-radius patch so the editor's own radius controls stay in sync.
const corners = (n: number): SelectionPatch => ({ borderRadiusTL: n, borderRadiusTR: n, borderRadiusBR: n, borderRadiusBL: n })

type Pop = 'palette' | 'looks' | 'align' | 'more' | null

export default function FroamFloatingBar({
  targetRect,
  visible,
  label,
  fontFamily,
  fontSize,
  fontWeight,
  isBold,
  isItalic,
  isUnderline,
  isStrike,
  textAlign,
  color,
  background,
  radius,
  opacity,
  isHidden = false,
  fontOptions,
  selectionCount,
  isTextLayer = false,
  hasText = true,
  isImage = false,
  docked = false,
  canUndo = false,
  onWalk,
  onAction,
  onStyle,
  onSaveLook,
}: Props) {
  const barRef = useRef<HTMLDivElement>(null)
  const [narrow, setNarrow] = useState(false)
  const [position, setPosition] = useState({ left: 12, top: 12 })
  const [openPop, setOpenPop] = useState<Pop>(null)
  const [menuLeft, setMenuLeft] = useState(0)
  const [palette, setPalette] = useState<string[]>([])
  const [paletteMode, setPaletteMode] = useState<'fill' | 'text'>('fill')
  const [lookSearch, setLookSearch] = useState('')
  const [lookGroup, setLookGroup] = useState<'All' | LookGroup>('All')
  const [recipes, setRecipes] = useState<null | { LOOKS: Look[]; LOOK_NOTES: Record<string, string>; LOOK_GROUPS: readonly LookGroup[] }>(null)
  useEffect(() => {
    if (openPop !== 'looks' || recipes) return
    let alive = true
    void import('./floating-bar-looks').then((m) => { if (alive) setRecipes({ LOOKS: m.LOOKS, LOOK_NOTES: m.LOOK_NOTES, LOOK_GROUPS: m.LOOK_GROUPS }) })
    return () => { alive = false }
  }, [openPop, recipes])
  const LOOKS = recipes?.LOOKS ?? NO_LOOKS
  const LOOK_NOTES = recipes?.LOOK_NOTES ?? NO_NOTES
  const LOOK_GROUPS = recipes?.LOOK_GROUPS ?? NO_GROUPS
  const [selectedLookName, setSelectedLookName] = useState('Lift')
  const [lookAccent, setLookAccent] = useState('#14b8a6')
  const [lookFill, setLookFill] = useState(() => normalizeToHex(background) ?? '#ffffff')
  const [lookText, setLookText] = useState(() => normalizeToHex(color) ?? '#111827')
  const [overrideLookFill, setOverrideLookFill] = useState(false)
  const [overrideLookText, setOverrideLookText] = useState(false)
  const [overrideLookRadius, setOverrideLookRadius] = useState(false)
  const [lookRadius, setLookRadius] = useState(Math.max(0, Math.round(radius)))
  const [lookState, setLookState] = useState<FroamStyleState>('base')
  const [lookStateDrafts, setLookStateDrafts] = useState<Partial<Record<FroamStyleState, Record<string, string>>>>({})
  const [lookDockSide, setLookDockSide] = useState<'left' | 'right'>('right')
  const [lookDockStyle, setLookDockStyle] = useState<CSSProperties>({})

  const fontScrub = useScrub((steps) => {
    const next = Math.min(400, Math.max(6, Math.round(fontSize) + steps))
    onStyle({ fontSize: `${next}px` }, { fontSize: next }, 'Changed font size')
  }, 8)

  // v4.1: opacity scrub — accumulate in a ref so fast drags don't lose steps to render lag
  const opacityRef = useRef(opacity)
  useEffect(() => { opacityRef.current = opacity }, [opacity])
  const setOpacity = (next: number) => {
    const clamped = Math.min(1, Math.max(0, Math.round(next * 100) / 100))
    opacityRef.current = clamped
    onStyle({ opacity: String(clamped) }, { opacity: clamped }, 'Changed opacity')
  }

  // A menu closes on Escape or a press anywhere else; the Look Studio dock stays.
  useEffect(() => {
    if (!openPop || openPop === 'looks') return
    const onDown = (event: PointerEvent) => { if (!barRef.current?.contains(event.target as Node)) setOpenPop(null) }
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') { event.stopPropagation(); setOpenPop(null) } }
    window.addEventListener('pointerdown', onDown, true)
    window.addEventListener('keydown', onKey, true)
    return () => {
      window.removeEventListener('pointerdown', onDown, true)
      window.removeEventListener('keydown', onKey, true)
    }
  }, [openPop])

  useLayoutEffect(() => {
    if (docked || !visible || !targetRect || !barRef.current) return

    const placeBar = () => {
      const bar = barRef.current
      if (!bar) return
      const leftPanel = document.querySelector<HTMLElement>('.froam-figma-left:not([hidden])')?.getBoundingClientRect()
      const rightPanel = document.querySelector<HTMLElement>('.froam-dp:not(.froam-sheet .froam-dp)')?.getBoundingClientRect()
      const toolbar = document.querySelector<HTMLElement>('.froam-chrome')?.getBoundingClientRect()
      const safeLeft = leftPanel && leftPanel.width > 0 ? leftPanel.right + VIEWPORT_GAP : VIEWPORT_GAP
      const safeRight = rightPanel && rightPanel.width > 0 ? rightPanel.left - VIEWPORT_GAP : window.innerWidth - VIEWPORT_GAP
      const toolbarAtTop = Boolean(toolbar && toolbar.top <= VIEWPORT_GAP)
      const safeTop = toolbarAtTop && toolbar ? toolbar.bottom + VIEWPORT_GAP : VIEWPORT_GAP
      const safeBottom = !toolbarAtTop && toolbar ? toolbar.top - VIEWPORT_GAP : window.innerHeight - VIEWPORT_GAP
      const availableWidth = Math.max(280, safeRight - safeLeft)
      const nextNarrow = availableWidth < 560

      bar.style.maxWidth = `${availableWidth}px`
      bar.style.width = 'max-content'

      const barRect = bar.getBoundingClientRect()
      const centeredLeft = targetRect.left + targetRect.width / 2 - barRect.width / 2
      const left = Math.min(
        Math.max(safeLeft, centeredLeft),
        Math.max(safeLeft, safeRight - barRect.width),
      )
      // Above the selection when it fits, else below it; never over it.
      const above = targetRect.top - barRect.height - TARGET_GAP
      const below = targetRect.bottom + TARGET_GAP + 22
      const maxTop = Math.max(safeTop, safeBottom - barRect.height)
      const top = above >= safeTop ? Math.min(above, maxTop) : Math.min(Math.max(safeTop, below), maxTop)

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
  }, [docked, narrow, targetRect, visible])

  useLayoutEffect(() => {
    if (openPop !== 'looks') return

    const placeLookDock = () => {
      const leftPanel = document.querySelector<HTMLElement>('.froam-figma-left:not([hidden])')?.getBoundingClientRect()
      const rightPanel = document.querySelector<HTMLElement>('.froam-dp:not(.froam-sheet .froam-dp)')?.getBoundingClientRect()
      const toolbar = document.querySelector<HTMLElement>('.froam-chrome')?.getBoundingClientRect()
      const safeLeft = leftPanel && leftPanel.width > 0 ? leftPanel.right + VIEWPORT_GAP : VIEWPORT_GAP
      const safeRight = rightPanel && rightPanel.width > 0 ? rightPanel.left - VIEWPORT_GAP : window.innerWidth - VIEWPORT_GAP
      const safeTop = toolbar && toolbar.top <= VIEWPORT_GAP ? toolbar.bottom + VIEWPORT_GAP : VIEWPORT_GAP
      const availableWidth = Math.max(280, safeRight - safeLeft)

      if (availableWidth < 620 || window.innerWidth < 720) {
        const panelHeight = Math.min(360, Math.round(window.innerHeight * 0.46))
        setLookDockStyle({
          left: safeLeft,
          top: Math.max(VIEWPORT_GAP, window.innerHeight - panelHeight - VIEWPORT_GAP),
          width: Math.max(280, availableWidth),
          maxHeight: panelHeight,
        })
        return
      }

      const panelWidth = Math.min(380, Math.max(320, Math.round(availableWidth * 0.34)))
      setLookDockStyle({
        left: lookDockSide === 'left' ? safeLeft : safeRight - panelWidth,
        top: safeTop,
        width: panelWidth,
        maxHeight: window.innerHeight - safeTop - VIEWPORT_GAP,
      })
    }

    placeLookDock()
    window.addEventListener('resize', placeLookDock)
    return () => window.removeEventListener('resize', placeLookDock)
  }, [lookDockSide, openPop])

  if (!visible || !targetRect) return null

  const backgroundHex = normalizeToHex(background) ?? '#0b0f14'
  const { kind, detail } = describeSelection(label)
  const showType = hasText || isTextLayer

  function togglePop(which: Exclude<Pop, null>, mode?: 'fill' | 'text') {
    if (mode) setPaletteMode(mode)
    setOpenPop((current) => {
      const next = current === which && (!mode || mode === paletteMode) ? null : which
      if ((next === 'palette' || next === 'looks') && palette.length === 0) {
        const pagePalette = collectPagePalette()
        setPalette(pagePalette)
        if (which === 'looks') setLookAccent(pickAccent(pagePalette))
      }
      if (next === 'looks') {
        setLookFill(normalizeToHex(background) ?? '#ffffff')
        setLookText(normalizeToHex(color) ?? '#111827')
        setLookRadius(Math.max(0, Math.round(radius)))
        const canvasMidpoint = window.innerWidth / 2
        const targetCenter = targetRect ? targetRect.left + targetRect.width / 2 : canvasMidpoint
        setLookDockSide(targetCenter < canvasMidpoint ? 'right' : 'left')
      }
      return next
    })
  }

  function applyChip(hex: string) {
    if (paletteMode === 'text') onAction('color', hex)
    else onAction('bg-color', hex)
    if ('vibrate' in navigator) navigator.vibrate?.(4)
  }

  function customizedLook(look: Look, overrides: LookOverrides = {}) {
    const accent = overrides.accent ?? lookAccent
    const fill = overrides.fill ?? lookFill
    const text = overrides.text ?? lookText
    const nextRadius = overrides.radius ?? lookRadius
    const shouldOverrideFill = overrides.overrideFill ?? overrideLookFill
    const shouldOverrideText = overrides.overrideText ?? overrideLookText
    const shouldOverrideRadius = overrides.overrideRadius ?? overrideLookRadius
    const styles = { ...look.styles(accent) }
    const patch = isTextLayer ? {} : { ...(look.patch ?? {}) }
    if (shouldOverrideFill && look.group !== 'Reset') {
      styles.background = fill
      styles.backgroundImage = 'none'
    }
    if (shouldOverrideText && look.group !== 'Reset') {
      styles.color = text
      if ('WebkitTextFillColor' in styles) styles.WebkitTextFillColor = text
    }
    if (shouldOverrideRadius && look.group !== 'Reset' && !isTextLayer) {
      styles.borderRadius = `${nextRadius}px`
      Object.assign(patch, corners(nextRadius))
    }
    return { styles, patch }
  }

  function applyLook(look: Look, overrides: LookOverrides = {}) {
    const { styles, patch } = customizedLook(look, overrides)
    setSelectedLookName(look.name)
    setLookStateDrafts((current) => ({ ...current, [lookState]: styles }))
    if (lookState === 'base') onStyle(styles, patch, `Look: ${look.name}`)
    else onStyle(Object.fromEntries(Object.entries(styles).map(([property, value]) => [`__froamState:${lookState}:${property}`, value])), undefined, `Look: ${look.name} · ${lookState}`)
    if ('vibrate' in navigator) navigator.vibrate?.(6)
  }

  const selectedLook = LOOKS.find((look) => look.name === selectedLookName) ?? LOOKS[0]
  const visibleLooks = LOOKS.filter((look) => {
    const query = lookSearch.trim().toLowerCase()
    // Search the description too, so "shadow" finds the shadows and
    // "uppercase" finds Eyebrow — the names alone are not searchable words.
    return (lookGroup === 'All' || look.group === lookGroup)
      && (!query || `${look.name} ${look.group} ${LOOK_NOTES[look.name] ?? ''}`.toLowerCase().includes(query))
  })

  const alignIcon = textAlign === 'center' ? <AlignCenter size={15} /> : textAlign === 'right' || textAlign === 'end' ? <AlignRight size={15} /> : textAlign === 'justify' ? <AlignJustify size={15} /> : <AlignLeft size={15} />
  const act = (action: FloatingAction, value?: string) => { setOpenPop(null); onAction(action, value) }
  // Open toward the side with more room, and never past the screen's edge.
  const barHeight = barRef.current?.offsetHeight ?? 40
  const roomBelow = typeof window === 'undefined' ? 600 : window.innerHeight - (position.top + barHeight) - 16
  const roomAbove = position.top - 16
  const menuUp = !docked && roomBelow < 420 && roomAbove > roomBelow
  const menuRoom = Math.max(180, (menuUp ? roomAbove : roomBelow) - 8)
  function anchorAt(button: HTMLElement) {
    const bar = barRef.current?.getBoundingClientRect()
    const own = button.getBoundingClientRect()
    setMenuLeft(bar ? Math.max(0, own.left - bar.left + own.width / 2) : 0)
  }
  const walk = (direction: WalkDirection) => { setOpenPop(null); onWalk?.(direction) }

  return (
    <div
      ref={barRef}
      className={`froam-floating-bar ${narrow ? 'is-narrow' : ''} ${docked ? 'is-docked' : ''}`}
      data-chef-editor-root="true"
      style={docked ? undefined : { left: position.left, top: position.top }}
      role="toolbar"
      aria-label={`${kind} tools`}
    >
      <div className="froam-floating-bar__primary">
        {onWalk && (
          <button type="button" className="froam-floating-bar__btn froam-floating-bar__walker" title="Select the parent (Esc climbs too)" aria-label="Select parent" onClick={() => onWalk('parent')}>
            <CornerLeftUp size={15} />
          </button>
        )}

        <div className="froam-floating-bar__identity" title={label}>
          <strong>{selectionCount > 1 ? `${selectionCount} selected` : kind}</strong>
          {selectionCount <= 1 && detail && <small>{detail}</small>}
        </div>

        {showType && (
          <>
            <span className="froam-floating-bar__sep" />
            <button
              type="button"
              className="froam-floating-bar__btn froam-floating-bar__edit-text"
              title="Edit the words (or double-click them)"
              aria-label="Edit text"
              onClick={() => onAction('edit-text')}
            >
              <Type size={15} />
            </button>
            <select
              className="froam-floating-bar__select froam-floating-bar__font"
              value={fontFamily}
              title="Font"
              aria-label="Font family"
              onChange={(event) => onStyle(
                { fontFamily: event.target.value },
                { fontFamily: event.target.value },
                'Changed font family',
              )}
            >
              {/* Grouped by the job the face does — forty-five names in a flat
                  list is a scroll, not a choice. */}
              {groupFontOptions(fontOptions).map(([role, options]) => (
                <optgroup key={role} label={FONT_GROUP_LABELS[role]}>
                  {options.map((font) => <option key={font.value} value={font.value}>{font.label}</option>)}
                </optgroup>
              ))}
            </select>

            <div className="froam-floating-bar__stepper froam-floating-bar__stepper--scrub" title="Size — drag the number to scrub" {...fontScrub} style={{ touchAction: 'none' }}>
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
            </div>

            <select
              className="froam-floating-bar__select froam-floating-bar__weight"
              value={fontWeight}
              title="Weight"
              aria-label="Font weight"
              onChange={(event) => onStyle(
                { fontWeight: event.target.value },
                { fontWeight: event.target.value },
                'Changed font weight',
              )}
            >
              {[['300', 'Light'], ['400', 'Regular'], ['500', 'Medium'], ['600', 'Semibold'], ['700', 'Bold'], ['800', 'Extra bold'], ['900', 'Black']].map(([weight, name]) => <option key={weight} value={weight}>{name}</option>)}
            </select>

            <span className="froam-floating-bar__sep" />

            <button type="button" className={`froam-floating-bar__btn ${isBold ? 'is-active' : ''}`} title="Bold (Ctrl+B)" aria-label="Bold" aria-pressed={Boolean(isBold)} onClick={() => onAction('bold')}><Bold size={15} /></button>
            <button type="button" className={`froam-floating-bar__btn ${isItalic ? 'is-active' : ''}`} title="Italic (Ctrl+I)" aria-label="Italic" aria-pressed={Boolean(isItalic)} onClick={() => onAction('italic')}><Italic size={15} /></button>
            <button type="button" className={`froam-floating-bar__btn ${isUnderline ? 'is-active' : ''}`} title="Underline (Ctrl+U)" aria-label="Underline" aria-pressed={Boolean(isUnderline)} onClick={() => onAction('underline')}><Underline size={15} /></button>
            <div className="froam-floating-bar__anchor">
              <button type="button" className={`froam-floating-bar__btn froam-floating-bar__btn--menu ${openPop === 'align' ? 'is-open' : ''}`} title="Alignment" aria-label="Text alignment" aria-haspopup="menu" aria-expanded={openPop === 'align'} onClick={(event) => { anchorAt(event.currentTarget); togglePop('align') }}>
                {alignIcon}<ChevronDown size={11} />
              </button>
            </div>
          </>
        )}

        <span className="froam-floating-bar__sep" />

        {/* Colours: the site's own palette first, any colour after. */}
        {showType && (
          <button
            type="button"
            className={`froam-floating-bar__swatch ${openPop === 'palette' && paletteMode === 'text' ? 'is-open' : ''}`}
            title="Text colour"
            aria-label="Text colour"
            onClick={(event) => { anchorAt(event.currentTarget); togglePop('palette', 'text') }}
          >
            <span className="froam-floating-bar__swatch-text" style={{ '--froam-swatch': color } as CSSProperties}>A</span>
          </button>
        )}
        <button
          type="button"
          className={`froam-floating-bar__swatch ${openPop === 'palette' && paletteMode === 'fill' ? 'is-open' : ''}`}
          title={isTextLayer ? 'Text fill' : 'Fill'}
          aria-label={isTextLayer ? 'Text fill' : 'Fill colour'}
          onClick={(event) => { anchorAt(event.currentTarget); togglePop('palette', 'fill') }}
        >
          <span className="froam-floating-bar__swatch-fill" style={{ '--froam-swatch': isTextLayer ? color : background } as CSSProperties} />
        </button>

        {isImage && (
          <button type="button" className="froam-floating-bar__btn" title="Replace image" aria-label="Replace image" onClick={() => onAction('image')}><ImagePlus size={15} /></button>
        )}

        <button
          type="button"
          className={`froam-floating-bar__looks-btn ${openPop === 'looks' ? 'is-active' : ''}`}
          title="Styles — one-tap looks, previewed live"
          onClick={() => togglePop('looks')}
        >
          <Sparkles size={14} /><span>Styles</span>
        </button>

        {docked && (
          <button
            type="button"
            className="froam-floating-bar__btn"
            title="Undo"
            aria-label="Undo"
            disabled={!canUndo}
            onClick={() => onAction('undo')}
          >
            <Undo2 size={15} />
          </button>
        )}

        <div className="froam-floating-bar__anchor">
          <button
            type="button"
            className={`froam-floating-bar__btn ${openPop === 'more' ? 'is-open' : ''}`}
            onClick={() => togglePop('more')}
            aria-haspopup="menu"
            aria-expanded={openPop === 'more'}
            aria-label="More actions"
            title="More"
          >
            <MoreHorizontal size={16} />
          </button>
        </div>
      </div>

      {openPop === 'align' && (
        <div className={`froam-floating-bar__menu is-row${menuUp ? ' is-up' : ''}`} style={{ left: menuLeft }} role="menu" aria-label="Text alignment">
          <button type="button" role="menuitemradio" aria-checked={textAlign === 'left' || textAlign === 'start'} className={textAlign === 'left' || textAlign === 'start' ? 'is-active' : ''} title="Align left" onClick={() => act('align-left')}><AlignLeft size={15} /></button>
          <button type="button" role="menuitemradio" aria-checked={textAlign === 'center'} className={textAlign === 'center' ? 'is-active' : ''} title="Align center" onClick={() => act('align-center')}><AlignCenter size={15} /></button>
          <button type="button" role="menuitemradio" aria-checked={textAlign === 'right' || textAlign === 'end'} className={textAlign === 'right' || textAlign === 'end' ? 'is-active' : ''} title="Align right" onClick={() => act('align-right')}><AlignRight size={15} /></button>
          <button type="button" role="menuitemradio" aria-checked={textAlign === 'justify'} className={textAlign === 'justify' ? 'is-active' : ''} title="Justify" onClick={() => act('align-justify')}><AlignJustify size={15} /></button>
        </div>
      )}
      {openPop === 'more' && (
        <div className={`froam-floating-bar__menu is-list${menuUp ? ' is-up' : ''}`} style={{ maxHeight: docked ? undefined : menuRoom }} role="menu" aria-label="More actions">
          <button type="button" role="menuitem" onClick={() => act('open-design')}><SlidersHorizontal size={14} /><span>All design controls</span></button>
          <button type="button" role="menuitem" onClick={() => act('animate')}><WandSparkles size={14} /><span>Animate…</span></button>
          <button type="button" role="menuitem" onClick={() => act('duplicate')}><Copy size={14} /><span>Duplicate</span><kbd>Ctrl D</kbd></button>
          {!isImage && <button type="button" role="menuitem" onClick={() => act('image')}><ImagePlus size={14} /><span>Add an image</span></button>}
          <div className="froam-floating-bar__menu-divider" />
          <div className="froam-floating-bar__menu-row" role="group" aria-label="Opacity">
            <Contrast size={14} />
            <span>Opacity</span>
            <input type="range" min={0} max={100} value={Math.round(opacity * 100)} aria-label="Opacity" onChange={(event) => setOpacity(Number(event.target.value) / 100)} />
            <output>{Math.round(opacity * 100)}%</output>
          </div>
          {showType && <button type="button" role="menuitemcheckbox" aria-checked={Boolean(isStrike)} onClick={() => act('strike')}><Strikethrough size={14} /><span>Strikethrough</span>{isStrike && <Check size={13} />}</button>}
          <button type="button" role="menuitem" onClick={() => act('clear-bg')}><Eraser size={14} /><span>Remove fill</span></button>
          <button type="button" role="menuitem" onClick={() => act('toggle-hidden')}>{isHidden ? <Eye size={14} /> : <EyeOff size={14} />}<span>{isHidden ? 'Show element' : 'Hide element'}</span></button>
          <div className="froam-floating-bar__menu-divider" />
          <div className="froam-floating-bar__menu-label">Select</div>
          <button type="button" role="menuitem" onClick={() => walk('parent')}><CornerLeftUp size={14} /><span>Parent</span></button>
          <button type="button" role="menuitem" onClick={() => walk('child')}><CornerRightDown size={14} /><span>First inside</span></button>
          <button type="button" role="menuitem" onClick={() => walk('prev')}><ChevronLeft size={14} /><span>Previous</span></button>
          <button type="button" role="menuitem" onClick={() => walk('next')}><ChevronRight size={14} /><span>Next</span></button>
          <div className="froam-floating-bar__menu-divider" />
          <button type="button" role="menuitem" onClick={() => act('bring-front')}><BringToFront size={14} /><span>Bring to front</span></button>
          <button type="button" role="menuitem" onClick={() => act('send-back')}><SendToBack size={14} /><span>Send to back</span></button>
          <button
            type="button"
            role="menuitem"
            title={selectionCount > 1 ? 'Merge selected into one movable stamp' : 'Merge this with overlapping sibling shapes'}
            onClick={() => act('merge')}
          >
            <Combine size={14} /><span>Merge shapes</span>
          </button>
          <button type="button" role="menuitem" onClick={() => act('unmerge')}><Ungroup size={14} /><span>Ungroup</span></button>
          <div className="froam-floating-bar__menu-divider" />
          <button type="button" role="menuitem" className="is-danger" onClick={() => act('delete')}><Trash2 size={14} /><span>Reset styles</span></button>
        </div>
      )}

      {openPop === 'palette' && (
        <div className={`froam-floating-bar__pop is-anchored${menuUp ? ' is-up' : ''}`} style={docked ? undefined : { left: Math.max(4, menuLeft - 136) }} data-chef-editor-root="true">
          <div className="froam-floating-bar__pop-head">
            <span>{paletteMode === 'text' ? 'Text colour' : isTextLayer ? 'Text fill' : 'Fill'}</span>
            <div className="froam-floating-bar__pop-toggle" role="group" aria-label="Apply as">
              <button type="button" className={paletteMode === 'fill' ? 'is-active' : ''} onClick={() => setPaletteMode('fill')}>{isTextLayer ? 'Glyph' : 'Fill'}</button>
              {showType && <button type="button" className={paletteMode === 'text' ? 'is-active' : ''} onClick={() => setPaletteMode('text')}>Text</button>}
            </div>
          </div>
          <small className="froam-floating-bar__pop-note">From this page</small>
          <div className="froam-floating-bar__chips">
            {palette.map((hex) => {
              const readable = paletteMode === 'text' && contrastRatio(hex, backgroundHex) >= 4.5
              return (
                <button
                  key={hex}
                  type="button"
                  className="froam-floating-bar__chip"
                  style={{ '--froam-chip': hex } as CSSProperties}
                  title={`${hex}${readable ? ' — easy to read on this fill' : ''}`}
                  onClick={() => applyChip(hex)}
                >
                  {paletteMode === 'text' && <span style={{ color: hex }}>Aa</span>}
                  {readable && <i className="froam-floating-bar__chip-ok" />}
                </button>
              )
            })}
            {palette.length === 0 && <span className="froam-floating-bar__pop-empty">No colours found on this page yet</span>}
          </div>
          <div className="froam-floating-bar__pop-actions">
            <label className="froam-floating-bar__custom-color">
              <input
                type="color"
                value={normalizeToHex(paletteMode === 'text' ? color : background) ?? '#000000'}
                onChange={(event) => onAction(paletteMode === 'text' ? 'color' : 'bg-color', event.target.value)}
              />
              <span>Any colour…</span>
            </label>
            {paletteMode === 'fill' && <button type="button" onClick={() => act('clear-bg')}><Eraser size={13} /> No fill</button>}
          </div>
        </div>
      )}

      {openPop === 'looks' && recipes && typeof document !== 'undefined' && createPortal(
        <div
          className="froam-floating-bar__pop froam-floating-bar__pop--looks"
          data-chef-editor-root="true"
          role="dialog"
          aria-label="Look Studio live editor"
          style={lookDockStyle}
        >
          <div className="froam-floating-bar__pop-head">
            <span>Styles <small>{LOOKS.length} {isTextLayer ? 'text-safe ' : ''}looks · live preview</small></span>
            <div className="froam-floating-bar__look-window-actions">
              <button type="button" onClick={() => setLookDockSide((side) => side === 'left' ? 'right' : 'left')} title="Move to the other side" aria-label="Move to the other side">
                {lookDockSide === 'left' ? <ChevronRight size={13} /> : <ChevronLeft size={13} />}
              </button>
              <button type="button" className="froam-floating-bar__look-apply" onClick={() => setOpenPop(null)}>Done</button>
            </div>
          </div>
          <label className="froam-floating-bar__look-search">
            <Search size={13} />
            <input value={lookSearch} onChange={(event) => setLookSearch(event.target.value)} placeholder="Search styles…" />
          </label>
          <div className="froam-floating-bar__look-groups" role="tablist" aria-label="Look categories">
            {(['All', ...LOOK_GROUPS] as const).map((group) => (
              <button key={group} type="button" role="tab" aria-selected={lookGroup === group} className={lookGroup === group ? 'is-active' : ''} onClick={() => setLookGroup(group)}>{group}</button>
            ))}
          </div>
          <div className="froam-floating-bar__looks-scroll">
            <div className="froam-floating-bar__looks">
              {visibleLooks.map((look) => (
                <button key={look.name} type="button" className={selectedLookName === look.name ? 'is-active' : ''} onClick={() => applyLook(look)} title={LOOK_NOTES[look.name] ?? `${look.group} · ${look.name}`}>
                  <i style={look.swatch} />
                  <span>{look.name}</span>
                  <small>{look.group}</small>
                </button>
              ))}
              {visibleLooks.length === 0 && <span className="froam-floating-bar__pop-empty">No styles match “{lookSearch}”</span>}
            </div>
          </div>
          <div className="froam-floating-bar__look-editor">
            <div className="froam-floating-bar__look-editor-title"><SlidersHorizontal size={13} /><span>Adjust {selectedLook.name}</span></div>
            <div className="froam-floating-bar__look-states" role="tablist" aria-label="Style state">
              {(['base', 'hover', 'focus', 'active'] as const).map((state) => <button key={state} type="button" role="tab" aria-selected={lookState === state} className={lookState === state ? 'is-active' : ''} onClick={() => setLookState(state)}>{state === 'base' ? 'Normal' : state[0].toUpperCase() + state.slice(1)}</button>)}
            </div>
            <div className="froam-floating-bar__look-colors">
              <label title="Accent used by accent-aware looks"><span>Accent</span><input type="color" value={lookAccent} onChange={(event) => { const next = event.target.value; setLookAccent(next); applyLook(selectedLook, { accent: next }) }} /></label>
              <label className={overrideLookFill ? 'is-enabled' : ''}><input type="checkbox" checked={overrideLookFill} onChange={(event) => { const next = event.target.checked; setOverrideLookFill(next); applyLook(selectedLook, { overrideFill: next }) }} /><span>{isTextLayer ? 'Glyph' : 'Fill'}</span><input type="color" value={lookFill} onChange={(event) => { const next = event.target.value; setLookFill(next); if (overrideLookFill) applyLook(selectedLook, { fill: next }) }} disabled={!overrideLookFill} /></label>
              <label className={overrideLookText ? 'is-enabled' : ''}><input type="checkbox" checked={overrideLookText} onChange={(event) => { const next = event.target.checked; setOverrideLookText(next); applyLook(selectedLook, { overrideText: next }) }} /><span>Text</span><input type="color" value={lookText} onChange={(event) => { const next = event.target.value; setLookText(next); if (overrideLookText) applyLook(selectedLook, { text: next }) }} disabled={!overrideLookText} /></label>
            </div>
            {!isTextLayer && <label className={`froam-floating-bar__look-radius ${overrideLookRadius ? 'is-enabled' : ''}`}>
              <input type="checkbox" checked={overrideLookRadius} onChange={(event) => { const next = event.target.checked; setOverrideLookRadius(next); applyLook(selectedLook, { overrideRadius: next }) }} />
              <span>Corner radius</span>
              <input type="range" min="0" max="64" value={lookRadius} onChange={(event) => { const next = Number(event.target.value); setLookRadius(next); if (overrideLookRadius) applyLook(selectedLook, { radius: next }) }} disabled={!overrideLookRadius} />
              <output>{lookRadius}px</output>
            </label>}
            <p>{isTextLayer ? 'On text, box effects become glyph effects: fill, gradient, stroke and shadow stay on the words.' : 'Every style previews on the selected element as you pick it.'}</p>
            {onSaveLook && <button type="button" className="froam-floating-bar__look-save" onClick={() => onSaveLook({ name: selectedLook.name, states: { ...lookStateDrafts, [lookState]: customizedLook(selectedLook).styles } })}>Save as a reusable style</button>}
          </div>
        </div>,
        document.body,
      )}
    </div>
  )
}
