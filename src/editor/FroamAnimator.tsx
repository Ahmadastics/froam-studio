import { useState, useRef, useCallback, useEffect } from 'react'
import {
  Play,
  Pause,
  Plus,
  Trash2,
  RotateCw,
  Copy,
  ChevronDown,
  Zap,
  Clock,
  MoveHorizontal,
} from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'

/* ═══════════════════════════════════════════════════════════════
   Types
   ═══════════════════════════════════════════════════════════════ */
type AnimatableProperty =
  | 'opacity'
  | 'transform'
  | 'backgroundColor'
  | 'color'
  | 'boxShadow'
  | 'borderRadius'
  | 'width'
  | 'height'
  | 'clipPath'
  | 'filter'

type Keyframe = {
  id: string
  offset: number  // 0-100 percentage
  properties: Partial<Record<AnimatableProperty, string>>
}

type AnimationConfig = {
  name: string
  duration: number    // ms
  delay: number       // ms
  iterations: number  // 0 = infinite
  direction: 'normal' | 'reverse' | 'alternate' | 'alternate-reverse'
  easing: string
  trigger: 'load' | 'hover' | 'click' | 'scroll'
  fillMode: 'none' | 'forwards' | 'backwards' | 'both'
  keyframes: Keyframe[]
}

type Props = {
  selectedElement: HTMLElement | null
  selectionLabel: string
  onApplyAnimation: (css: string, inline: string) => void
  onToast: (msg: string) => void
}

/* ═══════════════════════════════════════════════════════════════
   Constants
   ═══════════════════════════════════════════════════════════════ */
const PROPERTY_OPTIONS: { id: AnimatableProperty; label: string }[] = [
  { id: 'opacity', label: 'Opacity' },
  { id: 'transform', label: 'Transform' },
  { id: 'backgroundColor', label: 'Background' },
  { id: 'color', label: 'Color' },
  { id: 'boxShadow', label: 'Box Shadow' },
  { id: 'borderRadius', label: 'Border Radius' },
  { id: 'width', label: 'Width' },
  { id: 'height', label: 'Height' },
  { id: 'clipPath', label: 'Clip Path' },
  { id: 'filter', label: 'Filter' },
]

const EASING_PRESETS: { label: string; value: string }[] = [
  { label: 'Ease', value: 'ease' },
  { label: 'Ease In', value: 'ease-in' },
  { label: 'Ease Out', value: 'ease-out' },
  { label: 'Ease In-Out', value: 'ease-in-out' },
  { label: 'Linear', value: 'linear' },
  { label: 'Bounce', value: 'cubic-bezier(0.34, 1.56, 0.64, 1)' },
  { label: 'Elastic', value: 'cubic-bezier(0.68, -0.55, 0.265, 1.55)' },
  { label: 'Snap', value: 'cubic-bezier(0.5, 0, 0, 1)' },
  { label: 'Smooth', value: 'cubic-bezier(0.4, 0, 0.2, 1)' },
]

const TEMPLATE_ANIMATIONS: { label: string; config: Partial<AnimationConfig> }[] = [
  {
    label: 'Fade In',
    config: {
      name: 'froam-fade-in',
      duration: 600,
      keyframes: [
        { id: '1', offset: 0, properties: { opacity: '0' } },
        { id: '2', offset: 100, properties: { opacity: '1' } },
      ],
    },
  },
  {
    label: 'Slide Up',
    config: {
      name: 'froam-slide-up',
      duration: 500,
      keyframes: [
        { id: '1', offset: 0, properties: { opacity: '0', transform: 'translateY(30px)' } },
        { id: '2', offset: 100, properties: { opacity: '1', transform: 'translateY(0)' } },
      ],
    },
  },
  {
    label: 'Scale In',
    config: {
      name: 'froam-scale-in',
      duration: 400,
      keyframes: [
        { id: '1', offset: 0, properties: { transform: 'scale(0.8)', opacity: '0' } },
        { id: '2', offset: 100, properties: { transform: 'scale(1)', opacity: '1' } },
      ],
    },
  },
  {
    label: 'Bounce',
    config: {
      name: 'froam-bounce',
      duration: 800,
      easing: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
      keyframes: [
        { id: '1', offset: 0, properties: { transform: 'translateY(0)' } },
        { id: '2', offset: 50, properties: { transform: 'translateY(-20px)' } },
        { id: '3', offset: 100, properties: { transform: 'translateY(0)' } },
      ],
    },
  },
  {
    label: 'Pulse',
    config: {
      name: 'froam-pulse',
      duration: 1200,
      iterations: 0,
      keyframes: [
        { id: '1', offset: 0, properties: { transform: 'scale(1)', opacity: '1' } },
        { id: '2', offset: 50, properties: { transform: 'scale(1.05)', opacity: '0.8' } },
        { id: '3', offset: 100, properties: { transform: 'scale(1)', opacity: '1' } },
      ],
    },
  },
  {
    label: 'Shake',
    config: {
      name: 'froam-shake',
      duration: 500,
      keyframes: [
        { id: '1', offset: 0, properties: { transform: 'translateX(0)' } },
        { id: '2', offset: 20, properties: { transform: 'translateX(-8px)' } },
        { id: '3', offset: 40, properties: { transform: 'translateX(8px)' } },
        { id: '4', offset: 60, properties: { transform: 'translateX(-4px)' } },
        { id: '5', offset: 80, properties: { transform: 'translateX(4px)' } },
        { id: '6', offset: 100, properties: { transform: 'translateX(0)' } },
      ],
    },
  },
  {
    label: 'Rotate In',
    config: {
      name: 'froam-rotate-in',
      duration: 600,
      keyframes: [
        { id: '1', offset: 0, properties: { transform: 'rotate(-180deg) scale(0.5)', opacity: '0' } },
        { id: '2', offset: 100, properties: { transform: 'rotate(0) scale(1)', opacity: '1' } },
      ],
    },
  },
  {
    label: 'Glow',
    config: {
      name: 'froam-glow',
      duration: 2000,
      iterations: 0,
      direction: 'alternate',
      keyframes: [
        { id: '1', offset: 0, properties: { boxShadow: '0 0 4px rgba(94, 234, 212, 0.3)' } },
        { id: '2', offset: 100, properties: { boxShadow: '0 0 24px rgba(94, 234, 212, 0.8), 0 0 48px rgba(94, 234, 212, 0.4)' } },
      ],
    },
  },
]

/* ═══════════════════════════════════════════════════════════════
   Helpers
   ═══════════════════════════════════════════════════════════════ */
function makeId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}

function buildKeyframesCSS(config: AnimationConfig): string {
  const sorted = [...config.keyframes].sort((a, b) => a.offset - b.offset)
  const frames = sorted.map((kf) => {
    const props = Object.entries(kf.properties)
      .map(([key, val]) => {
        const cssKey = key.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`)
        return `    ${cssKey}: ${val};`
      })
      .join('\n')
    return `  ${kf.offset}% {\n${props}\n  }`
  }).join('\n')
  return `@keyframes ${config.name} {\n${frames}\n}`
}

function buildInlineAnimation(config: AnimationConfig): string {
  const iter = config.iterations === 0 ? 'infinite' : config.iterations
  return `${config.name} ${config.duration}ms ${config.easing} ${config.delay}ms ${iter} ${config.direction} ${config.fillMode}`
}

function defaultConfig(): AnimationConfig {
  return {
    name: `froam-anim-${Math.random().toString(36).slice(2, 6)}`,
    duration: 600,
    delay: 0,
    iterations: 1,
    direction: 'normal',
    easing: 'ease',
    trigger: 'load',
    fillMode: 'both',
    keyframes: [
      { id: makeId(), offset: 0, properties: { opacity: '0' } },
      { id: makeId(), offset: 100, properties: { opacity: '1' } },
    ],
  }
}

/* ═══════════════════════════════════════════════════════════════
   Component
   ═══════════════════════════════════════════════════════════════ */
export default function FroamAnimator({ selectedElement, selectionLabel, onApplyAnimation, onToast }: Props) {
  const [config, setConfig] = useState<AnimationConfig>(defaultConfig)
  const [previewing, setPreviewing] = useState(false)
  const [expandedKeyframe, setExpandedKeyframe] = useState<string | null>(null)
  const [showTemplates, setShowTemplates] = useState(true)
  const previewTimerRef = useRef<number>(0)
  const mountedRef = useRef(true)

  // Clean up preview on unmount
  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      window.clearTimeout(previewTimerRef.current)
    }
  }, [])

  const updateConfig = useCallback((patch: Partial<AnimationConfig>) => {
    setConfig((prev) => ({ ...prev, ...patch }))
  }, [])

  const addKeyframe = useCallback(() => {
    const existing = config.keyframes.map((k) => k.offset)
    let newOffset = 50
    // Find a gap
    while (existing.includes(newOffset) && newOffset < 100) newOffset += 5
    if (newOffset >= 100) newOffset = 99
    setConfig((prev) => ({
      ...prev,
      keyframes: [...prev.keyframes, { id: makeId(), offset: newOffset, properties: {} }],
    }))
  }, [config.keyframes])

  const removeKeyframe = useCallback((id: string) => {
    setConfig((prev) => ({
      ...prev,
      keyframes: prev.keyframes.filter((k) => k.id !== id),
    }))
  }, [])

  const updateKeyframe = useCallback((id: string, patch: Partial<Keyframe>) => {
    setConfig((prev) => ({
      ...prev,
      keyframes: prev.keyframes.map((k) => k.id === id ? { ...k, ...patch } : k),
    }))
  }, [])

  const updateKeyframeProp = useCallback((kfId: string, prop: AnimatableProperty, value: string) => {
    setConfig((prev) => ({
      ...prev,
      keyframes: prev.keyframes.map((k) =>
        k.id === kfId
          ? { ...k, properties: { ...k.properties, [prop]: value } }
          : k
      ),
    }))
  }, [])

  const removeKeyframeProp = useCallback((kfId: string, prop: AnimatableProperty) => {
    setConfig((prev) => ({
      ...prev,
      keyframes: prev.keyframes.map((k) => {
        if (k.id !== kfId) return k
        const next = { ...k.properties }
        delete next[prop]
        return { ...k, properties: next }
      }),
    }))
  }, [])

  const previewAnimation = useCallback(() => {
    if (!selectedElement) { onToast('Select an element first'); return }
    setPreviewing(true)

    // Inject keyframes style
    const styleId = 'froam-preview-keyframes'
    let styleEl = document.getElementById(styleId) as HTMLStyleElement | null
    if (!styleEl) {
      styleEl = document.createElement('style')
      styleEl.id = styleId
      document.head.appendChild(styleEl)
    }
    styleEl.textContent = buildKeyframesCSS(config)

    // Apply animation
    const inlineAnim = buildInlineAnimation(config)
    // eslint-disable-next-line react-hooks/immutability
    selectedElement.style.animation = inlineAnim

    // Clear after duration (or 5s for infinite)
    const timeout = config.iterations === 0
      ? 5000
      : config.duration * config.iterations + config.delay + 200
    window.clearTimeout(previewTimerRef.current)
    previewTimerRef.current = window.setTimeout(() => {
      selectedElement.style.animation = ''
      styleEl?.remove()
      if (mountedRef.current) setPreviewing(false)
    }, timeout)

    onToast('Previewing animation…')
  }, [selectedElement, config, onToast])

  const stopPreview = useCallback(() => {
    // eslint-disable-next-line react-hooks/immutability
    if (selectedElement) selectedElement.style.animation = ''
    document.getElementById('froam-preview-keyframes')?.remove()
    window.clearTimeout(previewTimerRef.current)
    setPreviewing(false)
  }, [selectedElement])

  const applyAnimation = useCallback(() => {
    const css = buildKeyframesCSS(config)
    const inline = buildInlineAnimation(config)
    onApplyAnimation(css, inline)
    onToast('Animation applied')
  }, [config, onApplyAnimation, onToast])

  const loadTemplate = useCallback((tpl: typeof TEMPLATE_ANIMATIONS[number]) => {
    const base = defaultConfig()
    setConfig({ ...base, ...tpl.config, keyframes: tpl.config.keyframes ?? base.keyframes })
    setShowTemplates(false)
    onToast(`Loaded: ${tpl.label}`)
  }, [onToast])

  const copyCSS = useCallback(async () => {
    const css = buildKeyframesCSS(config) + '\n\n' + `.element {\n  animation: ${buildInlineAnimation(config)};\n}`
    await navigator.clipboard.writeText(css)
    onToast('Animation CSS copied')
  }, [config, onToast])

  const sortedKeyframes = [...config.keyframes].sort((a, b) => a.offset - b.offset)

  return (
    <div className="fs-animator" data-chef-editor-root="true">
      <div className="fs-export__section-title" style={{ marginBottom: 6 }}>
        <Zap size={12} />
        {selectedElement ? `Animating ${selectionLabel}` : 'Select an element to animate'}
      </div>

      {/* Templates */}
      {showTemplates && (
        <div className="fs-animator__templates">
          <div className="fs-export__section-title" style={{ marginBottom: 6 }}>
            <Zap size={12} />
            Quick Templates
          </div>
          <div className="fs-animator__template-grid">
            {TEMPLATE_ANIMATIONS.map((tpl) => (
              <button
                key={tpl.label}
                type="button"
                className="fs-animator__template-btn"
                onClick={() => loadTemplate(tpl)}
              >
                {tpl.label}
              </button>
            ))}
          </div>
          <button
            type="button"
            className="fs-pill"
            onClick={() => setShowTemplates(false)}
            style={{ marginTop: 6, width: '100%', justifyContent: 'center' }}
          >
            Custom animation
          </button>
        </div>
      )}

      {!showTemplates && (
        <>
          {/* Config */}
          <div className="fs-stack" style={{ gap: 6 }}>
            <label className="fs-field">
              <span className="fs-field__label">Name</span>
              <input
                type="text"
                className="fs-input"
                value={config.name}
                onChange={(e) => updateConfig({ name: e.target.value.replace(/[^a-zA-Z0-9-_]/g, '') })}
              />
            </label>

            <div className="fs-grid-2">
              <label className="fs-field">
                <span className="fs-field__label">Duration (ms)</span>
                <input type="number" className="fs-input" min="50" max="10000" step="50" value={config.duration} onChange={(e) => updateConfig({ duration: Number(e.target.value) })} />
              </label>
              <label className="fs-field">
                <span className="fs-field__label">Delay (ms)</span>
                <input type="number" className="fs-input" min="0" max="5000" step="50" value={config.delay} onChange={(e) => updateConfig({ delay: Number(e.target.value) })} />
              </label>
            </div>

            <div className="fs-grid-2">
              <label className="fs-field">
                <span className="fs-field__label">Iterations</span>
                <input type="number" className="fs-input" min="0" max="100" value={config.iterations} onChange={(e) => updateConfig({ iterations: Number(e.target.value) })} />
                <span style={{ fontSize: '0.62rem', color: 'var(--fs-text-tertiary)' }}>0 = infinite</span>
              </label>
              <label className="fs-field">
                <span className="fs-field__label">Direction</span>
                <select className="fs-select" value={config.direction} onChange={(e) => updateConfig({ direction: e.target.value as AnimationConfig['direction'] })}>
                  <option value="normal">Normal</option>
                  <option value="reverse">Reverse</option>
                  <option value="alternate">Alternate</option>
                  <option value="alternate-reverse">Alt-Reverse</option>
                </select>
              </label>
            </div>

            <div className="fs-grid-2">
              <label className="fs-field">
                <span className="fs-field__label">Easing</span>
                <select className="fs-select" value={config.easing} onChange={(e) => updateConfig({ easing: e.target.value })}>
                  {EASING_PRESETS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
                </select>
              </label>
              <label className="fs-field">
                <span className="fs-field__label">Trigger</span>
                <select className="fs-select" value={config.trigger} onChange={(e) => updateConfig({ trigger: e.target.value as AnimationConfig['trigger'] })}>
                  <option value="load">On Load</option>
                  <option value="hover">On Hover</option>
                  <option value="click">On Click</option>
                  <option value="scroll">On Scroll</option>
                </select>
              </label>
            </div>
          </div>

          {/* Timeline */}
          <div className="fs-animator__timeline">
            <div className="fs-export__section-title" style={{ marginBottom: 4 }}>
              <Clock size={12} />
              Keyframes
              <button type="button" className="fs-pill" onClick={addKeyframe} style={{ marginLeft: 'auto', padding: '2px 8px' }}>
                <Plus size={10} /> Add
              </button>
            </div>

            {/* Visual timeline bar */}
            <div className="fs-animator__track">
              <div className="fs-animator__track-bar" />
              {sortedKeyframes.map((kf) => (
                <div
                  key={kf.id}
                  className={`fs-animator__track-dot ${expandedKeyframe === kf.id ? 'is-active' : ''}`}
                  style={{ left: `${kf.offset}%` }}
                  title={`${kf.offset}%`}
                  onClick={() => setExpandedKeyframe(expandedKeyframe === kf.id ? null : kf.id)}
                />
              ))}
            </div>

            {/* Keyframe editors */}
            {sortedKeyframes.map((kf) => (
              <div key={kf.id} className="fs-animator__keyframe">
                <button
                  type="button"
                  className="fs-animator__keyframe-header"
                  onClick={() => setExpandedKeyframe(expandedKeyframe === kf.id ? null : kf.id)}
                >
                  <MoveHorizontal size={11} />
                  <span>{kf.offset}%</span>
                  <span style={{ color: 'var(--fs-text-tertiary)', fontSize: '0.62rem' }}>
                    {Object.keys(kf.properties).length} props
                  </span>
                  <ChevronDown size={11} style={{ marginLeft: 'auto', transform: expandedKeyframe === kf.id ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
                </button>

                <AnimatePresence initial={false}>
                  {expandedKeyframe === kf.id && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.18 }}
                      className="fs-animator__keyframe-body"
                    >
                      <label className="fs-field">
                        <span className="fs-field__label">Offset (%)</span>
                        <input type="number" className="fs-input" min="0" max="100" value={kf.offset} onChange={(e) => updateKeyframe(kf.id, { offset: Number(e.target.value) })} />
                      </label>

                      {/* Existing properties */}
                      {Object.entries(kf.properties).map(([prop, val]) => (
                        <div key={prop} className="fs-animator__prop-row">
                          <span className="fs-animator__prop-name">{prop}</span>
                          <input
                            type="text"
                            className="fs-input"
                            value={val}
                            onChange={(e) => updateKeyframeProp(kf.id, prop as AnimatableProperty, e.target.value)}
                            style={{ flex: 1 }}
                          />
                          <button type="button" className="fs-animator__prop-remove" onClick={() => removeKeyframeProp(kf.id, prop as AnimatableProperty)}>
                            <Trash2 size={10} />
                          </button>
                        </div>
                      ))}

                      {/* Add property */}
                      <select
                        className="fs-select"
                        value=""
                        onChange={(e) => {
                          if (e.target.value) {
                            updateKeyframeProp(kf.id, e.target.value as AnimatableProperty, '')
                            e.target.value = ''
                          }
                        }}
                      >
                        <option value="">+ Add property…</option>
                        {PROPERTY_OPTIONS.filter((p) => !(p.id in kf.properties)).map((p) => (
                          <option key={p.id} value={p.id}>{p.label}</option>
                        ))}
                      </select>

                      <button type="button" className="fs-pill is-danger" onClick={() => removeKeyframe(kf.id)} style={{ marginTop: 4 }}>
                        <Trash2 size={10} /> Remove keyframe
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ))}
          </div>

          {/* Actions */}
          <div className="fs-pill-group" style={{ marginTop: 8 }}>
            <button type="button" className={`fs-pill ${previewing ? 'is-danger' : 'is-accent'}`} onClick={previewing ? stopPreview : previewAnimation}>
              {previewing ? <Pause size={12} /> : <Play size={12} />}
              {previewing ? 'Stop' : 'Preview'}
            </button>
            <button type="button" className="fs-pill is-accent" onClick={applyAnimation}>
              <Zap size={12} /> Apply
            </button>
            <button type="button" className="fs-pill" onClick={copyCSS}>
              <Copy size={12} /> Copy CSS
            </button>
            <button type="button" className="fs-pill" onClick={() => { setConfig(defaultConfig()); setShowTemplates(true) }}>
              <RotateCw size={12} /> Reset
            </button>
          </div>
        </>
      )}
    </div>
  )
}
