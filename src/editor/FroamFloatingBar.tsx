import { useLayoutEffect, useRef, useState, type CSSProperties } from 'react'
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  Bold,
  ChevronDown,
  Combine,
  Copy,
  Eraser,
  Grid2X2,
  ImagePlus,
  Italic,
  LayoutTemplate,
  Maximize,
  Palette,
  RectangleHorizontal,
  Rows3,
  Strikethrough,
  Trash2,
  Type,
  Underline,
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
  fontOptions: Array<{ label: string; value: string }>
  selectionCount: number
  onAction: (action: FloatingAction, value?: string) => void
  onStyle: (styles: Record<string, string>, selectionPatch?: SelectionPatch, label?: string) => void
}

const VIEWPORT_GAP = 12
const TARGET_GAP = 12

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
  return (
    <label className="froam-floating-bar__field">
      <span>{label}</span>
      <div className="froam-floating-bar__number">
        <input
          type="number"
          value={Number.parseFloat(String(value)) || 0}
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
  fontOptions,
  selectionCount,
  onAction,
  onStyle,
}: Props) {
  const barRef = useRef<HTMLDivElement>(null)
  const [expanded, setExpanded] = useState(false)
  const [narrow, setNarrow] = useState(false)
  const [position, setPosition] = useState({ left: 12, top: 12 })

  useLayoutEffect(() => {
    if (!visible || !targetRect || !barRef.current) return

    const placeBar = () => {
      const bar = barRef.current
      if (!bar) return
      const leftPanel = document.querySelector<HTMLElement>('.froam-figma-left')?.getBoundingClientRect()
      const rightPanel = document.querySelector<HTMLElement>('.froam-dp')?.getBoundingClientRect()
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
  }, [expanded, narrow, targetRect, visible])

  if (!visible || !targetRect) return null

  const cleanDimension = (value: string, fallback: number) => Number.parseFloat(value) || fallback
  const widthValue = cleanDimension(width, targetRect.width)
  const heightValue = cleanDimension(height, targetRect.height)

  return (
    <div
      ref={barRef}
      className={`froam-floating-bar ${expanded ? 'is-expanded' : ''} ${narrow ? 'is-narrow' : ''}`}
      data-chef-editor-root="true"
      style={{ left: position.left, top: position.top }}
    >
      <div className="froam-floating-bar__primary">
        <div className="froam-floating-bar__identity" title={label}>
          <Type size={13} />
          <span>{label}</span>
        </div>

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

        <div className="froam-floating-bar__stepper" title="Font size">
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
