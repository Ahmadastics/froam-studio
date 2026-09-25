import { useEffect, useRef, useState, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ChevronDown, Sparkles, X, Zap } from 'lucide-react'
import { getRoot } from './dom'

export function AccordionSection({
  id,
  icon,
  title,
  isOpen,
  onToggle,
  children,
}: {
  id: string
  icon: ReactNode
  title: string
  isOpen: boolean
  onToggle: () => void
  children: ReactNode
}) {
  return (
    <div className="froam-accordion" data-chef-editor-root="true">
      <button
        type="button"
        className="froam-accordion__trigger"
        aria-expanded={isOpen}
        aria-controls={`froam-section-${id}`}
        onClick={onToggle}
        data-chef-editor-root="true"
      >
        <span className="froam-accordion__trigger-left">
          {icon}
          {title}
        </span>
        <ChevronDown size={14} className="froam-accordion__chevron" aria-hidden="true" />
      </button>
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            className="froam-accordion__body"
            id={`froam-section-${id}`}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
          >
            <div className="froam-accordion__content" data-chef-editor-root="true">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export function Toast({ message, visible }: { message: string; visible: boolean }) {
  return (
    <div className={`fs-toast ${visible ? 'is-visible' : ''}`} data-chef-editor-root="true">
      <Zap size={14} aria-hidden="true" />
      {message}
    </div>
  )
}

export const WELCOME_TIPS_KEY = 'froam:welcome-tips-dismissed:v1'

export function FroamWelcomeTips({ open }: { open: boolean }) {
  const [dismissed, setDismissed] = useState(() => {
    try { return window.localStorage.getItem(WELCOME_TIPS_KEY) === '1' } catch { return true }
  })
  if (!open || dismissed) return null
  const dismiss = () => {
    setDismissed(true)
    try { window.localStorage.setItem(WELCOME_TIPS_KEY, '1') } catch { /* storage unavailable */ }
  }
  return (
    <div className="fs-welcome-tips" data-chef-editor-root="true" role="note" aria-label="Froam quick tips">
      <div className="fs-welcome-tips__title">
        <Sparkles size={13} aria-hidden="true" />
        <span>Welcome to Froam</span>
        <button type="button" className="fs-welcome-tips__close" onClick={dismiss} aria-label="Dismiss tips">
          <X size={12} aria-hidden="true" />
        </button>
      </div>
      <ul className="fs-welcome-tips__list">
        <li><b>Click any element</b> on the page to select and restyle it</li>
        <li><kbd>Ctrl+K</kbd> opens the command palette</li>
        <li><kbd>Ctrl+Shift+S</kbd> saves the design to your repo, git-ready</li>
      </ul>
      <button type="button" className="fs-welcome-tips__cta" onClick={dismiss}>Got it</button>
    </div>
  )
}

export const SCAN_DONE_KEY = 'froam:scan-done:v1'

export const BLUEPRINT_SEEN_KEY = 'froam:blueprint-seen:v1'

export type ScanCategory = 'heading' | 'media' | 'action' | 'container' | 'text'

export interface ScanTarget {
  top: number
  left: number
  width: number
  height: number
  category: ScanCategory
}

export const SCAN_CATEGORY_COLOR: Record<ScanCategory, string> = {
  heading: '#5eead4',
  media: '#ff8168',
  action: '#fbbf24',
  container: 'rgba(125, 211, 235, 0.75)',
  text: 'rgba(190, 205, 220, 0.6)',
}

export function scanCategoryOf(el: Element): ScanCategory | null {
  const tag = el.tagName.toLowerCase()
  if (/^h[1-6]$/.test(tag)) return 'heading'
  if (tag === 'img' || tag === 'svg' || tag === 'picture' || tag === 'video' || tag === 'canvas') return 'media'
  if (tag === 'button' || tag === 'a' || tag === 'input' || tag === 'select' || tag === 'textarea') return 'action'
  if (tag === 'p' || tag === 'li' || tag === 'blockquote' || tag === 'span') return 'text'
  if (['section', 'header', 'footer', 'main', 'article', 'nav', 'aside', 'form', 'ul', 'ol', 'div'].includes(tag)) return 'container'
  return null
}

export function collectScanTargets(): ScanTarget[] {
  const root = getRoot()
  if (!root) return []
  const vw = window.innerWidth
  const vh = window.innerHeight
  const selector = 'h1,h2,h3,h4,h5,h6,p,img,svg,picture,video,canvas,button,a,input,select,textarea,section,header,footer,main,article,nav,aside,form,ul,ol,li,blockquote,div,span'
  const nodes = root.querySelectorAll(selector)
  const targets: ScanTarget[] = []
  for (let i = 0; i < nodes.length; i += 1) {
    const el = nodes[i]
    if (el.closest('[data-chef-editor-root]')) continue
    const category = scanCategoryOf(el)
    if (!category) continue
    const r = el.getBoundingClientRect()
    if (r.width < 18 || r.height < 12) continue
    if (r.bottom < 4 || r.top > vh - 4 || r.right < 4 || r.left > vw - 4) continue
    if ((category === 'container' || category === 'text') && (r.width < 48 || r.height < 24)) continue
    targets.push({ top: r.top, left: r.left, width: r.width, height: r.height, category })
    if (targets.length >= 130) break
  }
  targets.sort((a, b) => a.top - b.top)
  return targets
}

export function FroamScan({ active, onDone }: { active: boolean; onDone: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const hudRef = useRef<HTMLDivElement | null>(null)
  const rafRef = useRef(0)
  const doneRef = useRef(onDone)
  doneRef.current = onDone

  useEffect(() => {
    if (!active) return undefined
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) { doneRef.current(); return undefined }

    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const vw = window.innerWidth
    const vh = window.innerHeight
    canvas.width = Math.round(vw * dpr)
    canvas.height = Math.round(vh * dpr)
    ctx.scale(dpr, dpr)

    const targets = collectScanTargets()
    const SWEEP = reduce ? 0 : 1300
    const HOLD = reduce ? 620 : 420
    const FADE = 380
    const START_DELAY = reduce ? 0 : 150
    const trail = 130
    const total = START_DELAY + SWEEP + HOLD + FADE
    const start = performance.now()
    let skipped = false

    const drawTarget = (x: number, y: number, w: number, h: number, color: string, alpha: number) => {
      const s = Math.max(4, Math.min(11, w / 2, h / 2))
      ctx.fillStyle = color
      ctx.globalAlpha = alpha * 0.05
      ctx.fillRect(x, y, w, h)
      ctx.strokeStyle = color
      ctx.lineWidth = 1
      ctx.globalAlpha = alpha * 0.3
      ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1)
      ctx.globalAlpha = alpha
      ctx.lineWidth = 1.75
      ctx.beginPath()
      ctx.moveTo(x, y + s); ctx.lineTo(x, y); ctx.lineTo(x + s, y)
      ctx.moveTo(x + w - s, y); ctx.lineTo(x + w, y); ctx.lineTo(x + w, y + s)
      ctx.moveTo(x + w, y + h - s); ctx.lineTo(x + w, y + h); ctx.lineTo(x + w - s, y + h)
      ctx.moveTo(x + s, y + h); ctx.lineTo(x, y + h); ctx.lineTo(x, y + h - s)
      ctx.stroke()
      ctx.globalAlpha = 1
    }

    const frame = (now: number) => {
      const t = skipped ? total : now - start
      ctx.clearRect(0, 0, vw, vh)

      const sweepT = SWEEP === 0 ? 1 : Math.max(0, Math.min(1, (t - START_DELAY) / SWEEP))
      const scanY = -trail + (vh + trail) * sweepT

      let backdrop = 1
      const fadeStart = START_DELAY + SWEEP + HOLD
      if (t < 260) backdrop = Math.max(0, t / 260)
      else if (t >= fadeStart) backdrop = Math.max(0, 1 - (t - fadeStart) / FADE)

      ctx.globalAlpha = 0.42 * backdrop
      const grad = ctx.createLinearGradient(0, 0, 0, vh)
      grad.addColorStop(0, 'rgba(6,10,16,0.92)')
      grad.addColorStop(1, 'rgba(4,7,12,0.97)')
      ctx.fillStyle = grad
      ctx.fillRect(0, 0, vw, vh)
      ctx.globalAlpha = 1

      let crossed = 0
      const seen: Record<ScanCategory, number> = { heading: 0, media: 0, action: 0, container: 0, text: 0 }
      for (const tg of targets) {
        if (tg.top > scanY) continue
        crossed += 1
        seen[tg.category] += 1
        const since = Math.max(0, Math.min(1, (scanY - tg.top) / 60))
        drawTarget(tg.left, tg.top, tg.width, tg.height, SCAN_CATEGORY_COLOR[tg.category], (0.35 + 0.65 * since) * backdrop)
      }

      if (!reduce && t >= START_DELAY && t <= START_DELAY + SWEEP) {
        const trailGrad = ctx.createLinearGradient(0, scanY - trail, 0, scanY)
        trailGrad.addColorStop(0, 'rgba(94,234,212,0)')
        trailGrad.addColorStop(1, 'rgba(94,234,212,0.18)')
        ctx.fillStyle = trailGrad
        ctx.fillRect(0, scanY - trail, vw, trail)
        ctx.strokeStyle = 'rgba(150,255,238,0.95)'
        ctx.lineWidth = 2
        ctx.shadowColor = 'rgba(94,234,212,0.9)'
        ctx.shadowBlur = 16
        ctx.beginPath()
        ctx.moveTo(0, scanY)
        ctx.lineTo(vw, scanY)
        ctx.stroke()
        ctx.shadowBlur = 0
      }

      const hud = hudRef.current
      if (hud) {
        hud.style.opacity = String(backdrop)
        const countEl = hud.querySelector('[data-scan-count]')
        const labelEl = hud.querySelector('[data-scan-label]')
        const breakEl = hud.querySelector('[data-scan-break]')
        if (countEl) countEl.textContent = String(crossed)
        if (labelEl) labelEl.textContent = t >= START_DELAY + SWEEP ? 'elements mapped' : 'scanning…'
        if (breakEl) breakEl.textContent = `${seen.heading} headings · ${seen.media} media · ${seen.action} actions · ${seen.container} containers · ${seen.text} text`
      }

      if (t >= total) {
        ctx.clearRect(0, 0, vw, vh)
        doneRef.current()
        return
      }
      rafRef.current = requestAnimationFrame(frame)
    }

    const skip = () => { skipped = true }
    canvas.addEventListener('pointerdown', skip)
    rafRef.current = requestAnimationFrame(frame)

    return () => {
      cancelAnimationFrame(rafRef.current)
      canvas.removeEventListener('pointerdown', skip)
    }
  }, [active])

  if (!active) return null

  return (
    <div className="fs-scan" data-chef-editor-root="true" aria-hidden="true">
      <canvas ref={canvasRef} className="fs-scan__canvas" />
      <div ref={hudRef} className="fs-scan__hud">
        <span className="fs-scan__count"><b data-scan-count>0</b> <span data-scan-label>scanning…</span></span>
        <span className="fs-scan__break" data-scan-break />
        <span className="fs-scan__skip">click to skip</span>
      </div>
    </div>
  )
}

export function MeasurementOverlay({ rect }: { rect: DOMRect | null }) {
  if (!rect) return null
  const w = Math.round(rect.width)
  const h = Math.round(rect.height)
  return (
    <div
      className="fs-measure"
      data-chef-editor-root="true"
      style={{
        left: rect.left,
        top: rect.top,
        width: rect.width,
        height: rect.height,
      }}
    >
      <span className="fs-measure__badge">{w} × {h}</span>
    </div>
  )
}

/** Click feedback: a ripple from the exact point clicked and a flash across the element it selected. */
export function ClickPulseOverlay({ pulse }: { pulse: { key: number; x: number; y: number; rect: DOMRect } | null }) {
  if (!pulse) return null
  const { rect } = pulse
  return (
    <div key={pulse.key} className="froam-click-pulse" data-chef-editor-root="true" aria-hidden="true">
      <span
        className="froam-click-pulse__flash"
        style={{ left: rect.left - 2, top: rect.top - 2, width: rect.width + 4, height: rect.height + 4 }}
      />
      <span className="froam-click-pulse__ring" style={{ left: pulse.x, top: pulse.y }} />
    </div>
  )
}

export function SelectionHandoffOverlay({
  rect,
  label,
  mode,
  count,
  pulseKey,
}: {
  rect: DOMRect | null
  label: string
  mode: string
  count: number
  pulseKey: number
}) {
  if (!rect) return null
  const top = Math.max(10, rect.top - 36)
  const left = Math.min(Math.max(10, rect.left), Math.max(10, window.innerWidth - 210))

  return (
    <div
      key={pulseKey}
      className="froam-selection-handoff"
      data-chef-editor-root="true"
      style={{ left, top }}
    >
      <span className="froam-selection-handoff__dot" />
      <span className="froam-selection-handoff__mode">{mode}</span>
      <span className="froam-selection-handoff__label">{count > 1 ? `${count} selected` : label}</span>
    </div>
  )
}
