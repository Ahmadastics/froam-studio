import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Accessibility,
  Check,
  Component,
  Crosshair,
  Droplet,
  Palette,
  PenLine,
  ScanLine,
  ShieldCheck,
  Sparkles,
  SquareStack,
  Type as TypeIcon,
  Wand2,
} from 'lucide-react'
import { componentAncestry, nearestComponent } from './froamReactFiber'
import {
  nearestColorToken,
  parseColor,
  readDesignTokens,
  toHex,
  type DesignToken,
  type RGB,
} from './froamDesignTokens'
import { INTERACTIVE_SELECTOR, contrastOn, imageAlternative, readTextContrast, undersizedTargets } from '../project/a11y'
import './FroamIntel.css'

// Matches GlobalChefEditor.applyStyle; the middle "next selection" arg is
// never passed from here, so it's typed loosely and left undefined.
type ApplyStyle = (styles: Record<string, string>, nextSel?: never, label?: string) => void

type Props = {
  selectedElement: HTMLElement | null
  selectionPath: string
  applyStyle: ApplyStyle
  onSelectElement: (el: HTMLElement) => void
  onFixElement: (el: HTMLElement, styles: Record<string, string>, label: string) => void
  onToast: (msg: string) => void
  rootEl: HTMLElement | null
}

type Target = 'fill' | 'text' | 'border'
type Tab = 'tokens' | 'a11y' | 'health'

type LintIssue = {
  id: string
  el: HTMLElement
  type: 'off-token' | 'contrast' | 'tap-target' | 'alt'
  /** `info` is listed but costs no health points: something to look at, not a failure. */
  severity: 'high' | 'medium' | 'low' | 'info'
  label: string
  detail: string
  fix?: { styles: Record<string, string>; label: string }
}

const TARGET_PROP: Record<Target, string> = { fill: 'backgroundColor', text: 'color', border: 'borderColor' }

/**
 * Health score with per-category caps so one noisy category can't zero the
 * page, and a floor so a genuinely-messy page still reads as a number worth
 * improving rather than a scary 0.
 */
function scoreIssues(issues: LintIssue[]): number {
  const high = issues.filter((i) => i.severity === 'high').length
  const med = issues.filter((i) => i.severity === 'medium').length
  const low = issues.filter((i) => i.severity === 'low').length
  const deduction = Math.min(38, high * 3) + Math.min(30, med * 2.2) + Math.min(14, low)
  return Math.max(12, Math.round(100 - deduction))
}

/** Graded against what this text needs: large text passes AA at 3:1, so it isn't a warning there. */
function ratingLabel(ratio: number, required: number): { grade: string; tone: 'pass' | 'warn' | 'fail' } {
  if (ratio >= 7) return { grade: 'AAA', tone: 'pass' }
  if (ratio >= 4.5) return { grade: 'AA', tone: 'pass' }
  if (ratio >= 3) return { grade: 'AA Large', tone: ratio >= required ? 'pass' : 'fail' }
  return { grade: 'Fail', tone: 'fail' }
}

function isFroamOwn(el: HTMLElement): boolean {
  return !!el.closest('[data-chef-editor-root], [class*="froam-"], [class*="global-chef"]')
}

export default function FroamIntel({ selectedElement, selectionPath, applyStyle, onSelectElement, onFixElement, onToast, rootEl }: Props) {
  const [tab, setTab] = useState<Tab>('tokens')
  const [target, setTarget] = useState<Target>('fill')
  const [tokenTick, setTokenTick] = useState(0)
  const tokens = useMemo(() => readDesignTokens(true), [tokenTick])
  const solidColorTokens = useMemo(
    () => tokens.colorRamps.flatMap((r) => r.tokens).filter((t) => t.rgb && t.rgb.a >= 0.98),
    [tokens],
  )

  // Refresh token cache whenever the panel is shown or theme flips.
  useEffect(() => {
    const obs = new MutationObserver(() => setTokenTick((t) => t + 1))
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
    return () => obs.disconnect()
  }, [])

  function applyToken(token: DesignToken) {
    if (!selectedElement) { onToast('Select an element first'); return }
    const prop = TARGET_PROP[target]
    const styles: Record<string, string> = { [prop]: `var(${token.name})` }
    if (target === 'border') {
      const cs = getComputedStyle(selectedElement)
      if (parseFloat(cs.borderWidth) === 0) { styles.borderWidth = '1px'; styles.borderStyle = 'solid' }
    }
    applyStyle(styles, undefined, `Token: ${token.name} → ${target}`)
    onToast(`${target} = ${token.name}`)
  }

  function applySpaceToken(token: DesignToken, kind: 'padding' | 'gap' | 'radius') {
    if (!selectedElement) { onToast('Select an element first'); return }
    const prop = kind === 'radius' ? 'borderRadius' : kind === 'gap' ? 'gap' : 'padding'
    applyStyle({ [prop]: `var(${token.name})` }, undefined, `Token: ${token.name} → ${kind}`)
    onToast(`${kind} = ${token.name}`)
  }

  const component = useMemo(() => (selectedElement ? nearestComponent(selectedElement) : null), [selectedElement])
  const ancestry = useMemo(() => (selectedElement ? componentAncestry(selectedElement) : []), [selectedElement])

  return (
    <div className="froam-intel" data-chef-editor-root="true">
      {component && (
        <div className="froam-intel__component">
          <div className="froam-intel__component-id">
            <Component size={13} />
            <span className="froam-intel__component-name">{'<' + component.name + '>'}</span>
            {component.rootEl && component.rootEl !== selectedElement && (
              <button
                type="button"
                className="froam-intel__component-jump"
                title="Select this component's root element"
                onClick={() => onSelectElement(component.rootEl!)}
              >
                <Crosshair size={11} /> root
              </button>
            )}
          </div>
          {ancestry.length > 1 && (
            <div className="froam-intel__breadcrumb">
              {ancestry.slice().reverse().map((name, i) => (
                <span key={name + i} className="froam-intel__crumb">{name}</span>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="froam-intel__tabs" role="tablist" aria-label="Design intelligence">
        <button type="button" role="tab" aria-selected={tab === 'tokens'} className={`froam-intel__tab ${tab === 'tokens' ? 'is-active' : ''}`} onClick={() => setTab('tokens')}>
          <Palette size={13} /> Tokens
        </button>
        <button type="button" role="tab" aria-selected={tab === 'a11y'} className={`froam-intel__tab ${tab === 'a11y' ? 'is-active' : ''}`} onClick={() => setTab('a11y')}>
          <Accessibility size={13} /> A11y
        </button>
        <button type="button" role="tab" aria-selected={tab === 'health'} className={`froam-intel__tab ${tab === 'health' ? 'is-active' : ''}`} onClick={() => setTab('health')}>
          <ShieldCheck size={13} /> Health
        </button>
      </div>

      {tab === 'tokens' && (
        <TokensTab
          tokens={tokens}
          target={target}
          setTarget={setTarget}
          onApplyColor={applyToken}
          onApplySpace={applySpaceToken}
          hasSelection={!!selectedElement}
        />
      )}
      {tab === 'a11y' && (
        <A11yTab selectedElement={selectedElement} solidColorTokens={solidColorTokens} applyStyle={applyStyle} onToast={onToast} />
      )}
      {tab === 'health' && (
        <HealthTab rootEl={rootEl} solidColorTokens={solidColorTokens} onSelectElement={onSelectElement} onFixElement={onFixElement} selectionPath={selectionPath} onToast={onToast} />
      )}
    </div>
  )
}

/* ─────────────────────────── Tokens ─────────────────────────── */

function TokensTab({
  tokens, target, setTarget, onApplyColor, onApplySpace, hasSelection,
}: {
  tokens: ReturnType<typeof readDesignTokens>
  target: Target
  setTarget: (t: Target) => void
  onApplyColor: (t: DesignToken) => void
  onApplySpace: (t: DesignToken, k: 'padding' | 'gap' | 'radius') => void
  hasSelection: boolean
}) {
  return (
    <div className="froam-intel__body">
      {!hasSelection && <p className="froam-intel__hint">Select an element, then tap a token to apply it on-brand.</p>}

      <div className="froam-intel__seg" role="group" aria-label="Apply colour to">
        {(['fill', 'text', 'border'] as Target[]).map((t) => (
          <button key={t} type="button" className={`froam-intel__seg-btn ${target === t ? 'is-active' : ''}`} onClick={() => setTarget(t)} aria-pressed={target === t}>
            {t === 'fill' ? <Droplet size={12} /> : t === 'text' ? <TypeIcon size={12} /> : <SquareStack size={12} />}
            {t}
          </button>
        ))}
      </div>

      {tokens.colorRamps.map(({ ramp, tokens: ramps }) => (
        <div key={ramp} className="froam-intel__group">
          <div className="froam-intel__group-label">{ramp}</div>
          <div className="froam-intel__swatches">
            {ramps.map((t) => (
              <button
                key={t.name}
                type="button"
                className="froam-intel__swatch"
                style={{ ['--sw' as string]: t.value }}
                title={`${t.name} · ${t.value}`}
                aria-label={`Apply ${t.name}`}
                onClick={() => onApplyColor(t)}
              >
                <span className="froam-intel__swatch-chip" />
                <span className="froam-intel__swatch-name">{t.name.replace(/^--/, '')}</span>
              </button>
            ))}
          </div>
        </div>
      ))}

      {tokens.spacing.length > 0 && (
        <div className="froam-intel__group">
          <div className="froam-intel__group-label">spacing → padding</div>
          <div className="froam-intel__chips">
            {tokens.spacing.map((t) => (
              <button key={t.name} type="button" className="froam-intel__chip" onClick={() => onApplySpace(t, 'padding')} title={`${t.name} · ${t.value}`}>
                {t.name.replace(/^--space-/, '')} <em>{t.value}</em>
              </button>
            ))}
          </div>
          <div className="froam-intel__chips froam-intel__chips--sub">
            {tokens.spacing.map((t) => (
              <button key={t.name} type="button" className="froam-intel__chip froam-intel__chip--ghost" onClick={() => onApplySpace(t, 'gap')} title={`gap: ${t.value}`}>
                gap {t.name.replace(/^--space-/, '')}
              </button>
            ))}
          </div>
        </div>
      )}

      {tokens.radius.length > 0 && (
        <div className="froam-intel__group">
          <div className="froam-intel__group-label">radius</div>
          <div className="froam-intel__chips">
            {tokens.radius.map((t) => (
              <button key={t.name} type="button" className="froam-intel__chip" onClick={() => onApplySpace(t, 'radius')} title={`${t.name} · ${t.value}`}>
                {t.name.replace(/^--radius-/, '')} <em>{t.value}</em>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

/* ─────────────────────────── A11y ─────────────────────────── */

function A11yTab({
  selectedElement, solidColorTokens, applyStyle, onToast,
}: {
  selectedElement: HTMLElement | null
  solidColorTokens: DesignToken[]
  applyStyle: ApplyStyle
  onToast: (m: string) => void
}) {
  // The same reading the Health scan, the reviewer checks and "Fix contrast
  // everywhere" use (project/a11y), so the tab never disagrees with them.
  const measured = useMemo(() => (selectedElement ? readTextContrast(selectedElement) : null), [selectedElement])
  const reading = measured?.status === 'measured'
    ? { fg: measured.rendered, bg: measured.ground, ratio: measured.ratio, required: measured.required, ...ratingLabel(measured.ratio, measured.required) }
    : null

  function suggestAccessibleToken(): DesignToken | null {
    if (measured?.status !== 'measured') return null
    let best: { t: DesignToken; ratio: number } | null = null
    for (const t of solidColorTokens) {
      if (!t.rgb) continue
      const r = contrastOn(t.rgb, measured.grounds, measured.opacity).ratio
      if (r >= measured.required && (!best || r < best.ratio)) best = { t, ratio: r } // smallest passing = closest tonal shift
    }
    return best?.t ?? null
  }

  if (!selectedElement) {
    return <div className="froam-intel__body"><p className="froam-intel__hint">Select any text element to check its live contrast against the real background behind it.</p></div>
  }
  if (!reading) {
    const why = measured?.status === 'unmeasurable'
      ? `${measured.detail}, so there is no single contrast ratio to give — check it by eye.`
      : measured?.status === 'exempt' && measured.reason === 'disabled'
        ? 'This control is disabled. WCAG leaves inactive controls out of the contrast requirement.'
        : 'Select an element that holds text of its own to check its contrast.'
    return <div className="froam-intel__body"><p className="froam-intel__hint">{why}</p></div>
  }

  const suggestion = reading.tone === 'fail' ? suggestAccessibleToken() : null

  return (
    <div className="froam-intel__body">
      <div className={`froam-intel__contrast froam-intel__contrast--${reading.tone}`}>
        <div className="froam-intel__contrast-ratio">{reading.ratio.toFixed(2)}<span>:1</span></div>
        <div className="froam-intel__contrast-grade">{reading.tone === 'pass' ? <Check size={13} /> : null}{reading.grade}</div>
      </div>

      <div className="froam-intel__contrast-preview" style={{ background: toHex(reading.bg), color: toHex(reading.fg) }}>
        <span style={{ fontSize: 13 }}>Normal text — the quick brown fox</span>
        <span style={{ fontSize: 19, fontWeight: 700 }}>Large text 19px bold</span>
      </div>

      <ul className="froam-intel__checks">
        <li className={reading.ratio >= 4.5 ? 'is-pass' : 'is-fail'}><span>AA · normal text</span><b>≥ 4.5</b></li>
        <li className={reading.ratio >= 3 ? 'is-pass' : 'is-fail'}><span>AA · large text</span><b>≥ 3.0</b></li>
        <li className={reading.ratio >= 7 ? 'is-pass' : 'is-fail'}><span>AAA · normal text</span><b>≥ 7.0</b></li>
      </ul>

      {suggestion && (
        <button type="button" className="froam-intel__fix" onClick={() => { applyStyle({ color: `var(${suggestion.name})` }, undefined, 'A11y fix'); onToast(`Text → ${suggestion.name}`) }}>
          <Wand2 size={13} /> Fix with {suggestion.name.replace(/^--/, '')}
        </button>
      )}
      <p className="froam-intel__foot">Measured against the actual painted background — something no static mock can see.</p>
    </div>
  )
}

/* ─────────────────────────── Health ─────────────────────────── */

function HealthTab({
  rootEl, solidColorTokens, onSelectElement, onFixElement, selectionPath, onToast,
}: {
  rootEl: HTMLElement | null
  solidColorTokens: DesignToken[]
  onSelectElement: (el: HTMLElement) => void
  onFixElement: (el: HTMLElement, styles: Record<string, string>, label: string) => void
  selectionPath: string
  onToast: (m: string) => void
}) {
  const [issues, setIssues] = useState<LintIssue[] | null>(null)
  const [scanning, setScanning] = useState(false)
  const idRef = useRef(0)

  function scan() {
    if (!rootEl) { onToast('No page root'); return }
    setScanning(true)
    idRef.current++
    // Defer so the spinner paints.
    requestAnimationFrame(() => {
      const found: LintIssue[] = []
      const els = Array.from(rootEl.querySelectorAll<HTMLElement>('*')).filter((el) => !isFroamOwn(el)).slice(0, 500)
      const tokenValues = new Set(solidColorTokens.map((t) => t.rgb ? `${t.rgb.r},${t.rgb.g},${t.rgb.b}` : ''))

      for (const el of els) {
        const cs = getComputedStyle(el)
        const rect = el.getBoundingClientRect()
        if (rect.width === 0 || rect.height === 0) continue

        // Off-token background colours (only meaningful, saturated fills)
        const bg = parseColor(cs.backgroundColor)
        if (bg && bg.a >= 0.9) {
          const key = `${bg.r},${bg.g},${bg.b}`
          const sat = Math.max(bg.r, bg.g, bg.b) - Math.min(bg.r, bg.g, bg.b)
          if (!tokenValues.has(key) && sat > 40) {
            const near = nearestColorToken(bg, solidColorTokens)
            if (near && near.distance < 60) {
              found.push({
                id: `t${idRef.current}-${found.length}`, el, type: 'off-token', severity: 'medium',
                label: 'Off-token colour', detail: `${toHex(bg)} ≈ ${near.token.name}`,
                fix: { styles: { backgroundColor: `var(${near.token.name})` }, label: `Snap to ${near.token.name.replace(/^--/, '')}` },
              })
            }
          }
        }

        // Contrast of the words an element holds itself, against everything
        // really painted behind them (project/a11y). Text over a photo has no
        // single ratio: it is listed for a look, not given a made-up number.
        const reading = readTextContrast(el)
        if (reading.status === 'measured' && !reading.passes) {
          found.push({
            id: `t${idRef.current}-${found.length}`, el, type: 'contrast', severity: 'high',
            label: 'Low contrast',
            detail: `${(Math.floor(reading.ratio * 100) / 100).toFixed(2)}:1 — needs ${reading.required.toFixed(1)}${reading.fixableByColour ? '' : ` · faded to ${Math.round(reading.opacity * 100)}%`}`,
          })
        } else if (reading.status === 'unmeasurable' && reading.reason !== 'colour') {
          found.push({
            id: `t${idRef.current}-${found.length}`, el, type: 'contrast', severity: 'info',
            label: 'Check contrast by eye', detail: reading.reason === 'photo' ? 'Text over a photo' : 'Gradient-filled text',
          })
        }

        // Missing alt. alt="" is how an image is marked decorative — not missing.
        if (el instanceof HTMLImageElement && imageAlternative(el) === 'missing') {
          found.push({
            id: `t${idRef.current}-${found.length}`, el, type: 'alt', severity: 'low',
            label: 'Image missing alt', detail: el.currentSrc?.split('/').pop()?.slice(0, 28) ?? 'image',
          })
        }
      }

      // Targets under WCAG 2.5.8's 24×24, at every screen size, after its
      // inline and spacing exceptions — 44×44 is the AAA goal, not the floor.
      const controls = Array.from(rootEl.querySelectorAll<HTMLElement>(INTERACTIVE_SELECTOR)).filter((el) => !isFroamOwn(el))
      for (const { element, width, height } of undersizedTargets(controls)) {
        const styles: Record<string, string> = { minWidth: '24px', minHeight: '24px' }
        if (getComputedStyle(element).display === 'inline') styles.display = 'inline-block'
        found.push({
          id: `t${idRef.current}-${found.length}`, el: element, type: 'tap-target', severity: 'medium',
          label: 'Small target', detail: `${width}×${height} — min 24×24`,
          fix: { styles, label: 'Make it 24×24' },
        })
      }

      const dedup = found.slice(0, 60)
      setIssues(dedup)
      setScanning(false)
      const score = dedup.length ? scoreIssues(dedup) : 100
      const failures = dedup.filter((issue) => issue.severity !== 'info').length
      onToast(failures ? `Health ${score}/100 · ${failures} issues` : dedup.length ? `Health ${score}/100 · ${dedup.length} to check by eye` : 'Health 100/100 — clean')
    })
  }

  const score = issues ? (issues.length ? scoreIssues(issues) : 100) : null
  const scoreTone = score == null ? '' : score >= 90 ? 'pass' : score >= 70 ? 'warn' : 'fail'

  function fixIssue(issue: LintIssue) {
    if (!issue.fix) return
    onFixElement(issue.el, issue.fix.styles, issue.fix.label)
    onToast(issue.fix.label)
    setIssues((prev) => prev ? prev.filter((i) => i.id !== issue.id) : prev)
  }

  return (
    <div className="froam-intel__body">
      <div className="froam-intel__health-head">
        {score != null && (
          <div className={`froam-intel__score froam-intel__score--${scoreTone}`}>
            <div className="froam-intel__score-num">{score}</div>
            <div className="froam-intel__score-cap">health</div>
          </div>
        )}
        <button type="button" className="froam-intel__scan" onClick={scan} disabled={scanning}>
          {scanning ? <Sparkles size={13} className="froam-spin" /> : <ScanLine size={13} />}
          {scanning ? 'Scanning…' : issues ? 'Re-scan page' : 'Scan this page'}
        </button>
      </div>

      {issues && issues.length === 0 && (
        <div className="froam-intel__clean"><ShieldCheck size={20} /> No issues found. Ship it.</div>
      )}

      {issues && issues.length > 0 && (
        <ul className="froam-intel__issues">
          {issues.map((issue) => (
            <li key={issue.id} className={`froam-intel__issue froam-intel__issue--${issue.severity}`}>
              <button type="button" className="froam-intel__issue-main" onClick={() => onSelectElement(issue.el)} title="Select this element">
                <span className="froam-intel__issue-dot" />
                <span className="froam-intel__issue-text">
                  <b>{issue.label}</b>
                  <em>{issue.detail}</em>
                </span>
              </button>
              {issue.fix && (
                <button type="button" className="froam-intel__issue-fix" onClick={() => fixIssue(issue)} title={issue.fix.label}>
                  <PenLine size={12} />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      {!issues && <p className="froam-intel__hint">Scans the real rendered page for off-brand colours, contrast failures, small tap targets and missing alt text — live, on the running app.</p>}
      <input type="hidden" value={selectionPath} readOnly />
    </div>
  )
}
