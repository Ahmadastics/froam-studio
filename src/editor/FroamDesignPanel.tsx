import { useMemo, useState, type ReactNode } from 'react'
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  ChevronDown,
  DraftingCompass,
  Eraser,
  ImagePlus,
  Italic,
  Link,
  Maximize2,
  Palette,
  PencilLine,
  RotateCw,
  Sparkles,
  Square,
  SquareDashedBottom,
  Strikethrough,
  Type,
  Underline,
  Unlink,
  X,
} from 'lucide-react'
import { computeBlueprintData, BlueprintSheet, BLUEPRINT_CATEGORY_COLOR, BLUEPRINT_CATEGORY_LABEL } from './FroamBlueprint'

/* ═══════════════════════════════════════════════════════════════
   Types
   ═══════════════════════════════════════════════════════════════ */
type SelectionState = {
  path: string
  label: string
  text: string
  background: string
  color: string
  borderColor: string
  borderWidth: number
  borderStyle: string
  borderRadiusTL: number
  borderRadiusTR: number
  borderRadiusBR: number
  borderRadiusBL: number
  opacity: number
  marginTop: number
  marginRight: number
  marginBottom: number
  marginLeft: number
  paddingTop: number
  paddingRight: number
  paddingBottom: number
  paddingLeft: number
  width: string
  height: string
  minWidth: string
  maxWidth: string
  minHeight: string
  maxHeight: string
  aspectRatio: string
  fontSize: number
  fontFamily: string
  fontWeight: string
  fontStyle: string
  textAlign: string
  lineHeight: number
  letterSpacing: number
  wordSpacing: number
  textTransform: string
  textDecoration: string
  display: string
  flexDirection: string
  justifyContent: string
  alignItems: string
  flexWrap: string
  gap: number
  gridTemplateColumns: string
  gridTemplateRows: string
  position: string
  zIndex: number
  overflow: string
  cursor: string
  rotate: number
  scaleX: number
  scaleY: number
  skewX: number
  skewY: number
  translateX: number
  translateY: number
  boxShadow: string
  textShadow: string
  mixBlendMode: string
  filter: string
  backdropFilter: string
  imageUrl: string
}

type Props = {
  selection: SelectionState | null
  selectionRect: DOMRect | null
  onApplyStyle: (styles: Record<string, string>, nextSel?: Partial<SelectionState>, label?: string) => void
  onUpdateDraft: (updater: (draft: { text?: string; imageUrl?: string; styles?: Record<string, string> }) => { text?: string; imageUrl?: string; styles?: Record<string, string> }, nextSelection?: Partial<SelectionState>) => void
  onOpenImageUpload: () => void
  onClearImage: () => void
  onClearSelectionDraft: () => void
  // Spacing link state
  marginLinked: boolean
  paddingLinked: boolean
  radiusLinked: boolean
  onToggleMarginLinked: () => void
  onTogglePaddingLinked: () => void
  onToggleRadiusLinked: () => void
  // Size presets
  onApplySizePreset: (preset: 'auto' | 'hug' | 'fill' | 'fullBleed' | 'square' | 'viewportHeight') => void
  // Transform
  onBuildTransformString: (vals: Partial<{ rotate: number; scaleX: number; scaleY: number; skewX: number; skewY: number; translateX: number; translateY: number }>) => string
  // Font options
  fontOptions: { label: string; value: string }[]
  // v4.5 Blueprint (Prototype tab)
  getRootEl: () => HTMLElement | null
  onOpenBlueprint: () => void
}

/* ═══════════════════════════════════════════════════════════════
   Section Header (Figma-style, no accordion — always visible)
   ═══════════════════════════════════════════════════════════════ */
function SectionHeader({
  title,
  icon,
  isOpen,
  onToggle,
  children,
}: {
  title: string
  icon?: ReactNode
  isOpen: boolean
  onToggle: () => void
  children?: ReactNode
}) {
  return (
    <div className="froam-dp__section">
      <button
        type="button"
        className="froam-dp__section-header"
        onClick={onToggle}
        data-chef-editor-root="true"
      >
        <span className="froam-dp__section-title">
          {icon}
          {title}
        </span>
        <ChevronDown
          size={12}
          style={{
            transform: isOpen ? 'rotate(0deg)' : 'rotate(-90deg)',
            transition: 'transform 150ms ease',
            opacity: 0.4,
          }}
        />
      </button>
      {isOpen && (
        <div className="froam-dp__section-body" data-chef-editor-root="true">
          {children}
        </div>
      )}
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════
   Constants
   ═══════════════════════════════════════════════════════════════ */
const displayOptions = ['block', 'flex', 'grid', 'inline-flex', 'inline-block', 'inline', 'none']
const flexDirectionOptions = ['row', 'row-reverse', 'column', 'column-reverse']
const justifyOptions = ['flex-start', 'center', 'flex-end', 'space-between', 'space-around', 'space-evenly']
const alignOptions = ['stretch', 'flex-start', 'center', 'flex-end', 'baseline']
const positionOptions = ['static', 'relative', 'absolute', 'fixed', 'sticky']
const overflowOptions = ['visible', 'hidden', 'scroll', 'auto']
const borderStyleOptions = ['none', 'solid', 'dashed', 'dotted', 'double']
const blendModeOptions = ['normal', 'multiply', 'screen', 'overlay', 'darken', 'lighten', 'color-dodge', 'color-burn']
const textTransformOptions = ['none', 'uppercase', 'lowercase', 'capitalize']
const paletteGroups = [
  { label: 'Brand', colors: ['#ef4444', '#ff6c4f', '#f97316', '#f8c15c', '#22c55e', '#5eead4', '#38bdf8', '#6366f1', '#a855f7', '#ec4899'] },
  { label: 'Ink', colors: ['#030712', '#0f172a', '#111827', '#1f2937', '#334155', '#475569', '#64748b', '#94a3b8', '#cbd5e1', '#f8fafc'] },
  { label: 'Soft', colors: ['#fff7ed', '#ffedd5', '#fef3c7', '#ecfccb', '#dcfce7', '#ccfbf1', '#e0f2fe', '#e0e7ff', '#f3e8ff', '#fce7f3'] },
]

/* ═══════════════════════════════════════════════════════════════
   Prototype tab — the Blueprint lives here (v4.5)
   ═══════════════════════════════════════════════════════════════ */
function DesignPanelTabs({ tab, onTab }: { tab: 'design' | 'prototype'; onTab: (next: 'design' | 'prototype') => void }) {
  return (
    <div className="froam-dp__header" data-chef-editor-root="true">
      <button type="button" className={`froam-dp__tab ${tab === 'design' ? 'is-active' : ''}`} onClick={() => onTab('design')} data-chef-editor-root="true">Design</button>
      <button type="button" className={`froam-dp__tab ${tab === 'prototype' ? 'is-active' : ''}`} onClick={() => onTab('prototype')} data-chef-editor-root="true">Prototype</button>
    </div>
  )
}

function BlueprintTabView({ getRootEl, onOpen }: { getRootEl: () => HTMLElement | null; onOpen: () => void }) {
  // Recomputed each time the Prototype tab mounts, so the picture always
  // reflects the current page — the full prototype, top to bottom.
  const data = useMemo(() => computeBlueprintData(getRootEl()), [getRootEl])

  if (!data) {
    return (
      <div className="froam-dp__proto froam-dp__proto--empty" data-chef-editor-root="true">
        <DraftingCompass size={30} style={{ opacity: 0.35 }} />
        <span>No page to map yet — open a page to draft its blueprint.</span>
      </div>
    )
  }

  const activeCats = (Object.keys(data.counts) as (keyof typeof data.counts)[]).filter((c) => data.counts[c] > 0)

  return (
    <div className="froam-dp__proto" data-chef-editor-root="true">
      <div className="froam-dp__proto-head">
        <div className="froam-dp__proto-title">
          <strong>{data.title}</strong>
          <small>{Math.round(data.docWidth)} × {Math.round(data.docHeight)}px · {data.nodes.length} parts</small>
        </div>
        <button type="button" className="froam-dp__proto-open" onClick={onOpen} title="Open full blueprint" data-chef-editor-root="true">
          <Maximize2 size={13} /> Open
        </button>
      </div>

      <button type="button" className="froam-dp__proto-frame" onClick={onOpen} title="Open full blueprint" data-chef-editor-root="true">
        <BlueprintSheet data={data} mode="mini" />
      </button>

      <div className="froam-dp__proto-legend">
        {activeCats.map((c) => (
          <span key={c} className="froam-dp__proto-chip">
            <i style={{ background: BLUEPRINT_CATEGORY_COLOR[c] }} />
            {data.counts[c]} {BLUEPRINT_CATEGORY_LABEL[c]}
          </span>
        ))}
      </div>

      {data.palette.length > 0 && (
        <div className="froam-dp__proto-swatches">
          {data.palette.map((hex) => <span key={hex} style={{ background: hex }} title={hex} />)}
        </div>
      )}
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════
   Component
   ═══════════════════════════════════════════════════════════════ */
export default function FroamDesignPanel({
  selection,
  selectionRect,
  onApplyStyle,
  onUpdateDraft,
  onOpenImageUpload,
  onClearImage,
  onClearSelectionDraft,
  marginLinked,
  paddingLinked,
  radiusLinked,
  onToggleMarginLinked,
  onTogglePaddingLinked,
  onToggleRadiusLinked,
  onApplySizePreset,
  onBuildTransformString,
  fontOptions,
  getRootEl,
  onOpenBlueprint,
}: Props) {
  const [tab, setTab] = useState<'design' | 'prototype'>('design')
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    position: true,
    layout: true,
    fill: true,
    stroke: true,
    typography: true,
    effects: false,
    spacing: false,
    transform: false,
  })
  const [savedColors, setSavedColors] = useState<string[]>(() => {
    if (typeof window === 'undefined') return ['#ef4444', '#5eead4', '#0f172a', '#ffffff']
    try {
      const parsed = JSON.parse(window.localStorage.getItem('froam-design-colors-v1') || '[]') as string[]
      return parsed.length ? parsed : ['#ef4444', '#5eead4', '#0f172a', '#ffffff']
    } catch {
      return ['#ef4444', '#5eead4', '#0f172a', '#ffffff']
    }
  })
  const [paletteMinimized, setPaletteMinimized] = useState(false)
  const [colorTarget, setColorTarget] = useState<'fill' | 'text' | 'stroke'>('fill')

  const toggle = (id: string) => setOpenSections((p) => ({ ...p, [id]: !p[id] }))
  const rememberColor = (color: string) => {
    const normalized = color.trim()
    if (!normalized) return
    setSavedColors((current) => {
      const next = [normalized, ...current.filter((item) => item.toLowerCase() !== normalized.toLowerCase())].slice(0, 18)
      try { window.localStorage.setItem('froam-design-colors-v1', JSON.stringify(next)) } catch { /* optional */ }
      return next
    })
  }

  if (!selection) {
    return (
      <div className="froam-dp" data-chef-editor-root="true">
        <DesignPanelTabs tab={tab} onTab={setTab} />
        {tab === 'prototype' ? (
          <BlueprintTabView getRootEl={getRootEl} onOpen={onOpenBlueprint} />
        ) : (
          <div className="froam-dp__empty">
            <Square size={32} style={{ opacity: 0.2 }} />
            <span>Select an element on the canvas to inspect and edit its design properties.</span>
          </div>
        )}
      </div>
    )
  }

  const s = selection
  const rect = selectionRect
  const applyPaletteColor = (color: string) => {
    rememberColor(color)
    if (colorTarget === 'text') {
      onApplyStyle({ color }, { color })
      return
    }
    if (colorTarget === 'stroke') {
      const borderStyle = s.borderStyle === 'none' ? 'solid' : s.borderStyle
      const borderWidth = s.borderWidth || 1
      onApplyStyle(
        { borderColor: color, borderStyle, borderWidth: `${borderWidth}px` },
        { borderColor: color, borderStyle, borderWidth },
      )
      return
    }
    onApplyStyle({ backgroundColor: color }, { background: color })
  }

  return (
    <div className="froam-dp" data-chef-editor-root="true">
      {/* Tabs */}
      <DesignPanelTabs tab={tab} onTab={setTab} />

      {tab === 'prototype' ? (
        <BlueprintTabView getRootEl={getRootEl} onOpen={onOpenBlueprint} />
      ) : (
      <>
      {/* Selection info */}
      <div className="froam-dp__selection-info" data-chef-editor-root="true">
        <span className="froam-dp__sel-tag">{s.label}</span>
        <button
          type="button"
          className="froam-dp__sel-clear"
          onClick={onClearSelectionDraft}
          title="Clear styles"
          data-chef-editor-root="true"
        >
          <Eraser size={11} />
        </button>
      </div>

      {/* Scrollable content */}
      <div className="froam-dp__scroll" data-chef-editor-root="true">

        {/* ═══ POSITION & SIZE ═══ */}
        <SectionHeader title="Position & Size" isOpen={openSections.position} onToggle={() => toggle('position')}>
          {/* X, Y, W, H compact grid */}
          <div className="froam-dp__pos-grid">
            <label className="froam-dp__compact-field">
              <span className="froam-dp__compact-label">X</span>
              <input
                type="text"
                className="froam-dp__compact-input"
                value={rect ? Math.round(rect.left) : '—'}
                readOnly
                data-chef-editor-root="true"
              />
            </label>
            <label className="froam-dp__compact-field">
              <span className="froam-dp__compact-label">Y</span>
              <input
                type="text"
                className="froam-dp__compact-input"
                value={rect ? Math.round(rect.top) : '—'}
                readOnly
                data-chef-editor-root="true"
              />
            </label>
            <label className="froam-dp__compact-field">
              <span className="froam-dp__compact-label">W</span>
              <input
                type="text"
                className="froam-dp__compact-input"
                value={s.width}
                onChange={(e) => onApplyStyle({ width: e.target.value }, { width: e.target.value })}
                data-chef-editor-root="true"
              />
            </label>
            <label className="froam-dp__compact-field">
              <span className="froam-dp__compact-label">H</span>
              <input
                type="text"
                className="froam-dp__compact-input"
                value={s.height}
                onChange={(e) => onApplyStyle({ height: e.target.value }, { height: e.target.value })}
                data-chef-editor-root="true"
              />
            </label>
            <label className="froam-dp__compact-field">
              <span className="froam-dp__compact-label"><RotateCw size={10} /></span>
              <input
                type="number"
                className="froam-dp__compact-input"
                value={s.rotate}
                onChange={(e) => {
                  const v = Number(e.target.value)
                  const t = onBuildTransformString({ rotate: v })
                  onApplyStyle({ transform: t }, { rotate: v })
                }}
                data-chef-editor-root="true"
              />
            </label>
            <label className="froam-dp__compact-field">
              <span className="froam-dp__compact-label">⊡</span>
              <input
                type="text"
                className="froam-dp__compact-input"
                value={s.aspectRatio || 'auto'}
                onChange={(e) => onApplyStyle({ aspectRatio: e.target.value }, { aspectRatio: e.target.value })}
                placeholder="auto"
                data-chef-editor-root="true"
              />
            </label>
          </div>

          {/* Size presets */}
          <div className="froam-dp__preset-row">
            <button type="button" className="froam-dp__preset-btn" onClick={() => onApplySizePreset('auto')}>Auto</button>
            <button type="button" className="froam-dp__preset-btn" onClick={() => onApplySizePreset('hug')}>Hug</button>
            <button type="button" className="froam-dp__preset-btn is-accent" onClick={() => onApplySizePreset('fill')}>Fill</button>
            <button type="button" className="froam-dp__preset-btn" onClick={() => onApplySizePreset('fullBleed')}>Bleed</button>
          </div>

          {/* Min/Max */}
          <div className="froam-dp__row-2">
            <label className="froam-dp__compact-field">
              <span className="froam-dp__compact-label">Min W</span>
              <input type="text" className="froam-dp__compact-input" value={s.minWidth} onChange={(e) => onApplyStyle({ minWidth: e.target.value }, { minWidth: e.target.value })} placeholder="—" data-chef-editor-root="true" />
            </label>
            <label className="froam-dp__compact-field">
              <span className="froam-dp__compact-label">Max W</span>
              <input type="text" className="froam-dp__compact-input" value={s.maxWidth} onChange={(e) => onApplyStyle({ maxWidth: e.target.value }, { maxWidth: e.target.value })} placeholder="—" data-chef-editor-root="true" />
            </label>
          </div>
          <div className="froam-dp__row-2">
            <label className="froam-dp__compact-field">
              <span className="froam-dp__compact-label">Min H</span>
              <input type="text" className="froam-dp__compact-input" value={s.minHeight} onChange={(e) => onApplyStyle({ minHeight: e.target.value }, { minHeight: e.target.value })} placeholder="—" data-chef-editor-root="true" />
            </label>
            <label className="froam-dp__compact-field">
              <span className="froam-dp__compact-label">Max H</span>
              <input type="text" className="froam-dp__compact-input" value={s.maxHeight} onChange={(e) => onApplyStyle({ maxHeight: e.target.value }, { maxHeight: e.target.value })} placeholder="—" data-chef-editor-root="true" />
            </label>
          </div>
        </SectionHeader>

        {/* ═══ LAYOUT (Auto Layout) ═══ */}
        <SectionHeader title="Layout" icon={<Square size={12} />} isOpen={openSections.layout} onToggle={() => toggle('layout')}>
          <div className="froam-dp__stack">
            <div className="froam-dp__row-2">
              <label className="froam-dp__compact-field">
                <span className="froam-dp__compact-label">Display</span>
                <select className="froam-dp__compact-select" value={s.display} onChange={(e) => onApplyStyle({ display: e.target.value }, { display: e.target.value })} data-chef-editor-root="true">
                  {displayOptions.map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
              </label>
              <label className="froam-dp__compact-field">
                <span className="froam-dp__compact-label">Position</span>
                <select className="froam-dp__compact-select" value={s.position} onChange={(e) => onApplyStyle({ position: e.target.value }, { position: e.target.value })} data-chef-editor-root="true">
                  {positionOptions.map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
              </label>
            </div>

            {(s.display === 'flex' || s.display === 'inline-flex') && (
              <>
                <div className="froam-dp__row-2">
                  <label className="froam-dp__compact-field">
                    <span className="froam-dp__compact-label">Direction</span>
                    <select className="froam-dp__compact-select" value={s.flexDirection} onChange={(e) => onApplyStyle({ flexDirection: e.target.value }, { flexDirection: e.target.value })} data-chef-editor-root="true">
                      {flexDirectionOptions.map((o) => <option key={o} value={o}>{o}</option>)}
                    </select>
                  </label>
                  <label className="froam-dp__compact-field">
                    <span className="froam-dp__compact-label">Gap</span>
                    <input type="number" className="froam-dp__compact-input" min="0" max="100" value={s.gap} onChange={(e) => { const v = e.target.value; onApplyStyle({ gap: `${v}px` }, { gap: Number(v) }) }} data-chef-editor-root="true" />
                  </label>
                </div>
                <div className="froam-dp__row-2">
                  <label className="froam-dp__compact-field">
                    <span className="froam-dp__compact-label">Justify</span>
                    <select className="froam-dp__compact-select" value={s.justifyContent} onChange={(e) => onApplyStyle({ justifyContent: e.target.value }, { justifyContent: e.target.value })} data-chef-editor-root="true">
                      {justifyOptions.map((o) => <option key={o} value={o}>{o}</option>)}
                    </select>
                  </label>
                  <label className="froam-dp__compact-field">
                    <span className="froam-dp__compact-label">Align</span>
                    <select className="froam-dp__compact-select" value={s.alignItems} onChange={(e) => onApplyStyle({ alignItems: e.target.value }, { alignItems: e.target.value })} data-chef-editor-root="true">
                      {alignOptions.map((o) => <option key={o} value={o}>{o}</option>)}
                    </select>
                  </label>
                </div>
              </>
            )}

            {s.display === 'grid' && (
              <>
                <label className="froam-dp__compact-field">
                  <span className="froam-dp__compact-label">Columns</span>
                  <input type="text" className="froam-dp__compact-input" value={s.gridTemplateColumns} placeholder="1fr 1fr" onChange={(e) => onApplyStyle({ gridTemplateColumns: e.target.value }, { gridTemplateColumns: e.target.value })} data-chef-editor-root="true" />
                </label>
                <div className="froam-dp__row-2">
                  <label className="froam-dp__compact-field">
                    <span className="froam-dp__compact-label">Rows</span>
                    <input type="text" className="froam-dp__compact-input" value={s.gridTemplateRows} placeholder="auto" onChange={(e) => onApplyStyle({ gridTemplateRows: e.target.value }, { gridTemplateRows: e.target.value })} data-chef-editor-root="true" />
                  </label>
                  <label className="froam-dp__compact-field">
                    <span className="froam-dp__compact-label">Gap</span>
                    <input type="number" className="froam-dp__compact-input" min="0" max="100" value={s.gap} onChange={(e) => { const v = e.target.value; onApplyStyle({ gap: `${v}px` }, { gap: Number(v) }) }} data-chef-editor-root="true" />
                  </label>
                </div>
              </>
            )}

            <div className="froam-dp__row-2">
              <label className="froam-dp__compact-field">
                <span className="froam-dp__compact-label">Z-Index</span>
                <input type="number" className="froam-dp__compact-input" value={s.zIndex} onChange={(e) => { const v = e.target.value; onApplyStyle({ zIndex: v }, { zIndex: Number(v) }) }} data-chef-editor-root="true" />
              </label>
              <label className="froam-dp__compact-field">
                <span className="froam-dp__compact-label">Overflow</span>
                <select className="froam-dp__compact-select" value={s.overflow} onChange={(e) => onApplyStyle({ overflow: e.target.value }, { overflow: e.target.value })} data-chef-editor-root="true">
                  {overflowOptions.map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
              </label>
            </div>
          </div>
        </SectionHeader>

        {/* ═══ FILL & COLOR (Figma-style) ═══ */}
        <SectionHeader title="Fill" icon={<Palette size={12} />} isOpen={openSections.fill} onToggle={() => toggle('fill')}>
          <div className="froam-dp__palette-shell" data-chef-editor-root="true">
            <div className="froam-dp__palette-top">
              <span className="froam-dp__palette-title">Color Palette</span>
              <button type="button" className="froam-dp__mini-btn" onClick={() => setPaletteMinimized((v) => !v)} data-chef-editor-root="true">
                {paletteMinimized ? 'Expand' : 'Minimize'}
              </button>
            </div>
            <div className="froam-dp__palette-targets" data-chef-editor-root="true">
              {([
                ['fill', 'Fill'],
                ['text', 'Text'],
                ['stroke', 'Stroke'],
              ] as const).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  className={`froam-dp__palette-target ${colorTarget === id ? 'is-active' : ''}`}
                  onClick={() => setColorTarget(id)}
                  data-chef-editor-root="true"
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="froam-dp__saved-colors" data-chef-editor-root="true">
              {savedColors.map((color) => (
                <button
                  key={color}
                  type="button"
                  className="froam-dp__saved-color"
                  style={{ background: color }}
                  title={`Apply ${color} to ${colorTarget}`}
                  onClick={() => applyPaletteColor(color)}
                  data-chef-editor-root="true"
                />
              ))}
            </div>
            {!paletteMinimized && (
              <div className="froam-dp__palette-groups" data-chef-editor-root="true">
                {paletteGroups.map((group) => (
                  <div key={group.label} className="froam-dp__palette-group">
                    <span className="froam-dp__palette-label">{group.label}</span>
                    <div className="froam-dp__palette-grid">
                      {group.colors.map((color) => (
                        <button
                          key={color}
                          type="button"
                          className="froam-dp__palette-chip"
                          style={{ background: color }}
                          title={`${color} ${colorTarget}`}
                          onClick={() => applyPaletteColor(color)}
                          data-chef-editor-root="true"
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="froam-dp__fill-row">
            <span className="froam-dp__fill-label">Fill</span>
            <div className="froam-dp__color-swatch-wrap">
              <input
                type="color"
                className="froam-dp__color-swatch"
                value={s.background}
                onChange={(e) => { rememberColor(e.target.value); onApplyStyle({ backgroundColor: e.target.value }, { background: e.target.value }) }}
                data-chef-editor-root="true"
              />
            </div>
            <input
              type="text"
              className="froam-dp__hex-input"
              value={s.background}
              onChange={(e) => { rememberColor(e.target.value); onApplyStyle({ backgroundColor: e.target.value }, { background: e.target.value }) }}
              data-chef-editor-root="true"
            />
            <div className="froam-dp__opacity-wrap">
              <input
                type="number"
                className="froam-dp__compact-input"
                min="0"
                max="100"
                value={Math.round(s.opacity * 100)}
                onChange={(e) => { const v = Number(e.target.value) / 100; onApplyStyle({ opacity: `${v}` }, { opacity: v }) }}
                data-chef-editor-root="true"
              />
              <span className="froam-dp__unit">%</span>
            </div>
          </div>
          {/* Text color */}
          <div className="froam-dp__fill-row">
            <span className="froam-dp__fill-label">Text</span>
            <div className="froam-dp__color-swatch-wrap">
              <input
                type="color"
                className="froam-dp__color-swatch"
                value={s.color}
                onChange={(e) => { rememberColor(e.target.value); onApplyStyle({ color: e.target.value }, { color: e.target.value }) }}
                data-chef-editor-root="true"
              />
            </div>
            <input
              type="text"
              className="froam-dp__hex-input"
              value={s.color}
              onChange={(e) => { rememberColor(e.target.value); onApplyStyle({ color: e.target.value }, { color: e.target.value }) }}
              data-chef-editor-root="true"
            />
          </div>
          <div className="froam-dp__btn-row">
            <button type="button" className="froam-dp__mini-btn" onClick={() => onApplyStyle({ backgroundColor: 'transparent' }, { background: '#ffffff' }, 'Cleared fill')} data-chef-editor-root="true">Clear fill</button>
            <button type="button" className="froam-dp__mini-btn" onClick={() => rememberColor(s.background)} data-chef-editor-root="true">Save fill</button>
            <button type="button" className="froam-dp__mini-btn" onClick={() => rememberColor(s.color)} data-chef-editor-root="true">Save text</button>
            <button type="button" className="froam-dp__mini-btn" onClick={() => rememberColor(s.borderColor)} data-chef-editor-root="true">Save stroke</button>
          </div>
          {/* Blend mode */}
          <div className="froam-dp__row-2">
            <label className="froam-dp__compact-field">
              <span className="froam-dp__compact-label">Blend</span>
              <select className="froam-dp__compact-select" value={s.mixBlendMode} onChange={(e) => onApplyStyle({ mixBlendMode: e.target.value }, { mixBlendMode: e.target.value })} data-chef-editor-root="true">
                {blendModeOptions.map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
            </label>
          </div>
          {/* Image buttons */}
          <div className="froam-dp__btn-row">
            <button type="button" className="froam-dp__mini-btn is-accent" onClick={onOpenImageUpload} data-chef-editor-root="true">
              <ImagePlus size={11} /> Image
            </button>
            <button type="button" className="froam-dp__mini-btn" onClick={onClearImage} data-chef-editor-root="true">
              <Eraser size={11} /> Clear
            </button>
          </div>
        </SectionHeader>

        {/* ═══ STROKE ═══ */}
        <SectionHeader title="Stroke" icon={<SquareDashedBottom size={12} />} isOpen={openSections.stroke} onToggle={() => toggle('stroke')}>
          <div className="froam-dp__fill-row">
            <div className="froam-dp__color-swatch-wrap">
              <input
                type="color"
                className="froam-dp__color-swatch"
                value={s.borderColor}
                onChange={(e) => onApplyStyle({ borderColor: e.target.value }, { borderColor: e.target.value })}
                data-chef-editor-root="true"
              />
            </div>
            <input
              type="text"
              className="froam-dp__hex-input"
              value={s.borderColor}
              onChange={(e) => onApplyStyle({ borderColor: e.target.value }, { borderColor: e.target.value })}
              data-chef-editor-root="true"
            />
            <input
              type="number"
              className="froam-dp__compact-input"
              style={{ width: 44 }}
              min="0"
              max="20"
              value={s.borderWidth}
              onChange={(e) => { const v = e.target.value; onApplyStyle({ borderWidth: `${v}px` }, { borderWidth: Number(v) }) }}
              data-chef-editor-root="true"
            />
          </div>
          <div className="froam-dp__row-2">
            <label className="froam-dp__compact-field">
              <span className="froam-dp__compact-label">Style</span>
              <select className="froam-dp__compact-select" value={s.borderStyle} onChange={(e) => onApplyStyle({ borderStyle: e.target.value }, { borderStyle: e.target.value })} data-chef-editor-root="true">
                {borderStyleOptions.map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
            </label>
          </div>
          {/* Corner radius */}
          <div className="froam-dp__radius-row">
            <button type="button" className={`froam-dp__link-btn ${radiusLinked ? 'is-linked' : ''}`} onClick={onToggleRadiusLinked} title="Link corners" data-chef-editor-root="true">
              {radiusLinked ? <Link size={9} /> : <Unlink size={9} />}
            </button>
            <input type="number" className="froam-dp__radius-input" min="0" max="200" value={Math.round(s.borderRadiusTL)} placeholder="TL"
              onChange={(e) => {
                const v = Number(e.target.value)
                if (radiusLinked) onApplyStyle({ borderRadius: `${v}px` }, { borderRadiusTL: v, borderRadiusTR: v, borderRadiusBR: v, borderRadiusBL: v })
                else onApplyStyle({ borderTopLeftRadius: `${v}px` }, { borderRadiusTL: v })
              }}
              data-chef-editor-root="true"
            />
            <input type="number" className="froam-dp__radius-input" min="0" max="200" value={Math.round(s.borderRadiusTR)} placeholder="TR"
              onChange={(e) => {
                const v = Number(e.target.value)
                if (radiusLinked) onApplyStyle({ borderRadius: `${v}px` }, { borderRadiusTL: v, borderRadiusTR: v, borderRadiusBR: v, borderRadiusBL: v })
                else onApplyStyle({ borderTopRightRadius: `${v}px` }, { borderRadiusTR: v })
              }}
              data-chef-editor-root="true"
            />
            <input type="number" className="froam-dp__radius-input" min="0" max="200" value={Math.round(s.borderRadiusBR)} placeholder="BR"
              onChange={(e) => {
                const v = Number(e.target.value)
                if (radiusLinked) onApplyStyle({ borderRadius: `${v}px` }, { borderRadiusTL: v, borderRadiusTR: v, borderRadiusBR: v, borderRadiusBL: v })
                else onApplyStyle({ borderBottomRightRadius: `${v}px` }, { borderRadiusBR: v })
              }}
              data-chef-editor-root="true"
            />
            <input type="number" className="froam-dp__radius-input" min="0" max="200" value={Math.round(s.borderRadiusBL)} placeholder="BL"
              onChange={(e) => {
                const v = Number(e.target.value)
                if (radiusLinked) onApplyStyle({ borderRadius: `${v}px` }, { borderRadiusTL: v, borderRadiusTR: v, borderRadiusBR: v, borderRadiusBL: v })
                else onApplyStyle({ borderBottomLeftRadius: `${v}px` }, { borderRadiusBL: v })
              }}
              data-chef-editor-root="true"
            />
          </div>
        </SectionHeader>

        {/* ═══ TYPOGRAPHY ═══ */}
        <SectionHeader title="Text" icon={<Type size={12} />} isOpen={openSections.typography} onToggle={() => toggle('typography')}>
          <div className="froam-dp__stack">
            {/* Font family */}
            <select className="froam-dp__compact-select froam-dp__full-width" value={s.fontFamily} onChange={(e) => onApplyStyle({ fontFamily: e.target.value }, { fontFamily: e.target.value })} data-chef-editor-root="true">
              {fontOptions.map((f) => <option key={f.label} value={f.value}>{f.label}</option>)}
            </select>

            {/* Size, Weight */}
            <div className="froam-dp__row-2">
              <label className="froam-dp__compact-field">
                <span className="froam-dp__compact-label">Size</span>
                <input type="number" className="froam-dp__compact-input" min="8" max="200" value={s.fontSize} onChange={(e) => { const v = Number(e.target.value); onApplyStyle({ fontSize: `${v}px` }, { fontSize: v }) }} data-chef-editor-root="true" />
              </label>
              <label className="froam-dp__compact-field">
                <span className="froam-dp__compact-label">Weight</span>
                <select className="froam-dp__compact-select" value={s.fontWeight} onChange={(e) => onApplyStyle({ fontWeight: e.target.value }, { fontWeight: e.target.value })} data-chef-editor-root="true">
                  {['100', '200', '300', '400', '500', '600', '700', '800', '900'].map((w) => <option key={w} value={w}>{w}</option>)}
                </select>
              </label>
            </div>

            {/* Line height, Letter spacing */}
            <div className="froam-dp__row-2">
              <label className="froam-dp__compact-field">
                <span className="froam-dp__compact-label">Line H</span>
                <input type="number" className="froam-dp__compact-input" min="0.5" max="4" step="0.1" value={s.lineHeight.toFixed(1)} onChange={(e) => { const v = Number(e.target.value); onApplyStyle({ lineHeight: `${v}` }, { lineHeight: v }) }} data-chef-editor-root="true" />
              </label>
              <label className="froam-dp__compact-field">
                <span className="froam-dp__compact-label">Spacing</span>
                <input type="number" className="froam-dp__compact-input" min="-10" max="30" step="0.5" value={s.letterSpacing} onChange={(e) => { const v = Number(e.target.value); onApplyStyle({ letterSpacing: `${v}px` }, { letterSpacing: v }) }} data-chef-editor-root="true" />
              </label>
            </div>

            {/* Formatting toolbar — B I U S */}
            <div className="froam-dp__format-bar">
              <button type="button" className={`froam-dp__fmt-btn ${Number(s.fontWeight) >= 700 ? 'is-active' : ''}`} onClick={() => onApplyStyle({ fontWeight: Number(s.fontWeight) >= 700 ? '400' : '700' }, { fontWeight: Number(s.fontWeight) >= 700 ? '400' : '700' })} title="Bold" data-chef-editor-root="true">
                <Bold size={13} />
              </button>
              <button type="button" className={`froam-dp__fmt-btn ${s.fontStyle === 'italic' ? 'is-active' : ''}`} onClick={() => onApplyStyle({ fontStyle: s.fontStyle === 'italic' ? 'normal' : 'italic' }, { fontStyle: s.fontStyle === 'italic' ? 'normal' : 'italic' })} title="Italic" data-chef-editor-root="true">
                <Italic size={13} />
              </button>
              <button type="button" className={`froam-dp__fmt-btn ${s.textDecoration.includes('underline') ? 'is-active' : ''}`} onClick={() => onApplyStyle({ textDecorationLine: s.textDecoration.includes('underline') ? 'none' : 'underline' }, { textDecoration: s.textDecoration.includes('underline') ? 'none' : 'underline' })} title="Underline" data-chef-editor-root="true">
                <Underline size={13} />
              </button>
              <button type="button" className={`froam-dp__fmt-btn ${s.textDecoration.includes('line-through') ? 'is-active' : ''}`} onClick={() => onApplyStyle({ textDecorationLine: s.textDecoration.includes('line-through') ? 'none' : 'line-through' }, { textDecoration: s.textDecoration.includes('line-through') ? 'none' : 'line-through' })} title="Strikethrough" data-chef-editor-root="true">
                <Strikethrough size={13} />
              </button>
              <div className="froam-dp__fmt-sep" />
              <button type="button" className={`froam-dp__fmt-btn ${s.textAlign === 'left' || s.textAlign === 'start' ? 'is-active' : ''}`} onClick={() => onApplyStyle({ textAlign: 'left' }, { textAlign: 'left' })} title="Left" data-chef-editor-root="true">
                <AlignLeft size={13} />
              </button>
              <button type="button" className={`froam-dp__fmt-btn ${s.textAlign === 'center' ? 'is-active' : ''}`} onClick={() => onApplyStyle({ textAlign: 'center' }, { textAlign: 'center' })} title="Center" data-chef-editor-root="true">
                <AlignCenter size={13} />
              </button>
              <button type="button" className={`froam-dp__fmt-btn ${s.textAlign === 'right' || s.textAlign === 'end' ? 'is-active' : ''}`} onClick={() => onApplyStyle({ textAlign: 'right' }, { textAlign: 'right' })} title="Right" data-chef-editor-root="true">
                <AlignRight size={13} />
              </button>
            </div>

            {/* Text transform */}
            <label className="froam-dp__compact-field">
              <span className="froam-dp__compact-label">Transform</span>
              <select className="froam-dp__compact-select" value={s.textTransform} onChange={(e) => onApplyStyle({ textTransform: e.target.value }, { textTransform: e.target.value })} data-chef-editor-root="true">
                {textTransformOptions.map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
            </label>

            {/* Text content */}
            <label className="froam-dp__compact-field">
              <span className="froam-dp__compact-label"><PencilLine size={10} /> Content</span>
              <textarea
                className="froam-dp__text-content"
                value={s.text}
                onChange={(e) => {
                  const value = e.target.value
                  onUpdateDraft((draft) => ({ ...draft, text: value }), { text: value })
                }}
                rows={2}
                data-chef-editor-root="true"
              />
            </label>
          </div>
        </SectionHeader>

        {/* ═══ SPACING ═══ */}
        <SectionHeader title="Spacing" icon={<Square size={12} />} isOpen={openSections.spacing} onToggle={() => toggle('spacing')}>
          {/* Margin */}
          <div className="froam-dp__spacing-group">
            <div className="froam-dp__spacing-label-row">
              <span className="froam-dp__spacing-label">Margin</span>
              <button type="button" className={`froam-dp__link-btn ${marginLinked ? 'is-linked' : ''}`} onClick={onToggleMarginLinked} data-chef-editor-root="true">
                {marginLinked ? <Link size={9} /> : <Unlink size={9} />}
              </button>
            </div>
            <div className="froam-dp__spacing-inputs">
              <input type="number" className="froam-dp__spacing-input" value={Math.round(s.marginTop)} placeholder="T" onChange={(e) => { const v = e.target.value; if (marginLinked) onApplyStyle({ margin: `${v}px` }, { marginTop: Number(v), marginRight: Number(v), marginBottom: Number(v), marginLeft: Number(v) }); else onApplyStyle({ marginTop: `${v}px` }, { marginTop: Number(v) }) }} data-chef-editor-root="true" />
              <input type="number" className="froam-dp__spacing-input" value={Math.round(s.marginRight)} placeholder="R" onChange={(e) => { const v = e.target.value; if (marginLinked) onApplyStyle({ margin: `${v}px` }, { marginTop: Number(v), marginRight: Number(v), marginBottom: Number(v), marginLeft: Number(v) }); else onApplyStyle({ marginRight: `${v}px` }, { marginRight: Number(v) }) }} data-chef-editor-root="true" />
              <input type="number" className="froam-dp__spacing-input" value={Math.round(s.marginBottom)} placeholder="B" onChange={(e) => { const v = e.target.value; if (marginLinked) onApplyStyle({ margin: `${v}px` }, { marginTop: Number(v), marginRight: Number(v), marginBottom: Number(v), marginLeft: Number(v) }); else onApplyStyle({ marginBottom: `${v}px` }, { marginBottom: Number(v) }) }} data-chef-editor-root="true" />
              <input type="number" className="froam-dp__spacing-input" value={Math.round(s.marginLeft)} placeholder="L" onChange={(e) => { const v = e.target.value; if (marginLinked) onApplyStyle({ margin: `${v}px` }, { marginTop: Number(v), marginRight: Number(v), marginBottom: Number(v), marginLeft: Number(v) }); else onApplyStyle({ marginLeft: `${v}px` }, { marginLeft: Number(v) }) }} data-chef-editor-root="true" />
            </div>
          </div>
          {/* Padding */}
          <div className="froam-dp__spacing-group">
            <div className="froam-dp__spacing-label-row">
              <span className="froam-dp__spacing-label">Padding</span>
              <button type="button" className={`froam-dp__link-btn ${paddingLinked ? 'is-linked' : ''}`} onClick={onTogglePaddingLinked} data-chef-editor-root="true">
                {paddingLinked ? <Link size={9} /> : <Unlink size={9} />}
              </button>
            </div>
            <div className="froam-dp__spacing-inputs">
              <input type="number" className="froam-dp__spacing-input" value={Math.round(s.paddingTop)} placeholder="T" onChange={(e) => { const v = e.target.value; if (paddingLinked) onApplyStyle({ padding: `${v}px` }, { paddingTop: Number(v), paddingRight: Number(v), paddingBottom: Number(v), paddingLeft: Number(v) }); else onApplyStyle({ paddingTop: `${v}px` }, { paddingTop: Number(v) }) }} data-chef-editor-root="true" />
              <input type="number" className="froam-dp__spacing-input" value={Math.round(s.paddingRight)} placeholder="R" onChange={(e) => { const v = e.target.value; if (paddingLinked) onApplyStyle({ padding: `${v}px` }, { paddingTop: Number(v), paddingRight: Number(v), paddingBottom: Number(v), paddingLeft: Number(v) }); else onApplyStyle({ paddingRight: `${v}px` }, { paddingRight: Number(v) }) }} data-chef-editor-root="true" />
              <input type="number" className="froam-dp__spacing-input" value={Math.round(s.paddingBottom)} placeholder="B" onChange={(e) => { const v = e.target.value; if (paddingLinked) onApplyStyle({ padding: `${v}px` }, { paddingTop: Number(v), paddingRight: Number(v), paddingBottom: Number(v), paddingLeft: Number(v) }); else onApplyStyle({ paddingBottom: `${v}px` }, { paddingBottom: Number(v) }) }} data-chef-editor-root="true" />
              <input type="number" className="froam-dp__spacing-input" value={Math.round(s.paddingLeft)} placeholder="L" onChange={(e) => { const v = e.target.value; if (paddingLinked) onApplyStyle({ padding: `${v}px` }, { paddingTop: Number(v), paddingRight: Number(v), paddingBottom: Number(v), paddingLeft: Number(v) }); else onApplyStyle({ paddingLeft: `${v}px` }, { paddingLeft: Number(v) }) }} data-chef-editor-root="true" />
            </div>
          </div>
        </SectionHeader>

        {/* ═══ EFFECTS ═══ */}
        <SectionHeader title="Effects" icon={<Sparkles size={12} />} isOpen={openSections.effects} onToggle={() => toggle('effects')}>
          <div className="froam-dp__stack">
            <label className="froam-dp__compact-field">
              <span className="froam-dp__compact-label">Box Shadow</span>
              <input type="text" className="froam-dp__compact-input froam-dp__full-width" value={s.boxShadow} placeholder="0 4px 12px rgba(0,0,0,0.2)" onChange={(e) => onApplyStyle({ boxShadow: e.target.value }, { boxShadow: e.target.value })} data-chef-editor-root="true" />
            </label>
            <div className="froam-dp__btn-row">
              <button type="button" className="froam-dp__mini-btn" onClick={() => onApplyStyle({ boxShadow: '0 4px 14px rgba(0,0,0,0.15)' }, { boxShadow: '0 4px 14px rgba(0,0,0,0.15)' })} data-chef-editor-root="true">Soft</button>
              <button type="button" className="froam-dp__mini-btn" onClick={() => onApplyStyle({ boxShadow: '0 10px 30px rgba(0,0,0,0.25)' }, { boxShadow: '0 10px 30px rgba(0,0,0,0.25)' })} data-chef-editor-root="true">Medium</button>
              <button type="button" className="froam-dp__mini-btn" onClick={() => onApplyStyle({ boxShadow: '0 20px 50px rgba(0,0,0,0.4)' }, { boxShadow: '0 20px 50px rgba(0,0,0,0.4)' })} data-chef-editor-root="true">Heavy</button>
              <button type="button" className="froam-dp__mini-btn" onClick={() => onApplyStyle({ boxShadow: 'none' }, { boxShadow: '' })} data-chef-editor-root="true"><X size={10} /></button>
            </div>
            <label className="froam-dp__compact-field">
              <span className="froam-dp__compact-label">Filter</span>
              <input type="text" className="froam-dp__compact-input froam-dp__full-width" value={s.filter} placeholder="blur(4px)" onChange={(e) => onApplyStyle({ filter: e.target.value || 'none' }, { filter: e.target.value })} data-chef-editor-root="true" />
            </label>
            <label className="froam-dp__compact-field">
              <span className="froam-dp__compact-label">Backdrop</span>
              <input type="text" className="froam-dp__compact-input froam-dp__full-width" value={s.backdropFilter} placeholder="blur(12px)" onChange={(e) => onApplyStyle({ backdropFilter: e.target.value || 'none' }, { backdropFilter: e.target.value })} data-chef-editor-root="true" />
            </label>
          </div>
        </SectionHeader>

        {/* ═══ TRANSFORM ═══ */}
        <SectionHeader title="Transform" icon={<RotateCw size={12} />} isOpen={openSections.transform} onToggle={() => toggle('transform')}>
          <div className="froam-dp__stack">
            <div className="froam-dp__row-2">
              <label className="froam-dp__compact-field">
                <span className="froam-dp__compact-label">Scale X</span>
                <input type="number" className="froam-dp__compact-input" step="0.1" value={s.scaleX} onChange={(e) => { const v = Number(e.target.value); const t = onBuildTransformString({ scaleX: v }); onApplyStyle({ transform: t }, { scaleX: v }) }} data-chef-editor-root="true" />
              </label>
              <label className="froam-dp__compact-field">
                <span className="froam-dp__compact-label">Scale Y</span>
                <input type="number" className="froam-dp__compact-input" step="0.1" value={s.scaleY} onChange={(e) => { const v = Number(e.target.value); const t = onBuildTransformString({ scaleY: v }); onApplyStyle({ transform: t }, { scaleY: v }) }} data-chef-editor-root="true" />
              </label>
            </div>
            <div className="froam-dp__row-2">
              <label className="froam-dp__compact-field">
                <span className="froam-dp__compact-label">Translate X</span>
                <input type="number" className="froam-dp__compact-input" value={s.translateX} onChange={(e) => { const v = Number(e.target.value); const t = onBuildTransformString({ translateX: v }); onApplyStyle({ transform: t }, { translateX: v }) }} data-chef-editor-root="true" />
              </label>
              <label className="froam-dp__compact-field">
                <span className="froam-dp__compact-label">Translate Y</span>
                <input type="number" className="froam-dp__compact-input" value={s.translateY} onChange={(e) => { const v = Number(e.target.value); const t = onBuildTransformString({ translateY: v }); onApplyStyle({ transform: t }, { translateY: v }) }} data-chef-editor-root="true" />
              </label>
            </div>
            <div className="froam-dp__row-2">
              <label className="froam-dp__compact-field">
                <span className="froam-dp__compact-label">Skew X</span>
                <input type="number" className="froam-dp__compact-input" value={s.skewX} onChange={(e) => { const v = Number(e.target.value); const t = onBuildTransformString({ skewX: v }); onApplyStyle({ transform: t }, { skewX: v }) }} data-chef-editor-root="true" />
              </label>
              <label className="froam-dp__compact-field">
                <span className="froam-dp__compact-label">Skew Y</span>
                <input type="number" className="froam-dp__compact-input" value={s.skewY} onChange={(e) => { const v = Number(e.target.value); const t = onBuildTransformString({ skewY: v }); onApplyStyle({ transform: t }, { skewY: v }) }} data-chef-editor-root="true" />
              </label>
            </div>
            <button type="button" className="froam-dp__mini-btn" onClick={() => onApplyStyle({ transform: 'none' }, { rotate: 0, scaleX: 1, scaleY: 1, skewX: 0, skewY: 0, translateX: 0, translateY: 0 })} data-chef-editor-root="true">
              <Eraser size={10} /> Reset Transform
            </button>
          </div>
        </SectionHeader>

      </div>
      </>
      )}
    </div>
  )
}
