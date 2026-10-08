/**
 * Froam Design Intelligence — token engine.
 *
 * Reads the host app's REAL design tokens straight from its live
 * stylesheets (the actual --red-500, --space-md, etc. the running app
 * uses), and provides colour maths for the accessibility + design-lint
 * features. This is only possible because Froam edits the live app, not
 * a static mock — the tokens are the truth, not a copy.
 */
import { contrastRatio, luminance, parseColor, toHex } from '../project/wcag'

export type TokenKind = 'color' | 'space' | 'radius' | 'shadow' | 'type' | 'font' | 'other'

export type DesignToken = {
  name: string          // --red-500
  value: string         // resolved computed value: rgb(255, 59, 47)
  raw: string           // authored value (may be a var() reference)
  kind: TokenKind
  ramp: string          // 'red', 'space', 'semantic'...
  rgb?: RGB             // present for solid colours
}

export type RGB = { r: number; g: number; b: number; a: number }

export type TokenGroups = {
  colorRamps: { ramp: string; tokens: DesignToken[] }[]
  spacing: DesignToken[]
  radius: DesignToken[]
  shadow: DesignToken[]
  all: DesignToken[]
}

const COLOR_RAMP_ORDER = ['red', 'orange', 'gold', 'green', 'blue', 'magenta', 'semantic', 'ink', 'paper', 'white', 'other']

function classify(name: string): { kind: TokenKind; ramp: string } {
  const body = name.replace(/^--/, '')
  if (body.startsWith('space')) return { kind: 'space', ramp: 'space' }
  if (body.startsWith('radius')) return { kind: 'radius', ramp: 'radius' }
  if (body.startsWith('shadow')) return { kind: 'shadow', ramp: 'shadow' }
  if (body.startsWith('text-') || body.startsWith('leading') || body.startsWith('tracking')) return { kind: 'type', ramp: 'type' }
  if (body.startsWith('font')) return { kind: 'font', ramp: 'font' }
  if (body.startsWith('color-')) return { kind: 'color', ramp: 'semantic' }
  const ramp = body.split('-')[0]
  if (['red', 'orange', 'gold', 'green', 'blue', 'magenta', 'ink', 'paper', 'white'].includes(ramp)) {
    return { kind: 'color', ramp }
  }
  return { kind: 'other', ramp: 'other' }
}

// The colour maths is shared with every other check (project/wcag); what is
// behind an element is read by project/a11y, which handles gradients, photos
// and opacity rather than only solid backgrounds.
export { parseColor, luminance, contrastRatio, toHex }

export function colorDistance(a: RGB, b: RGB): number {
  // Perceptual-ish weighting (redmean approximation).
  const rm = (a.r + b.r) / 2
  const dr = a.r - b.r, dg = a.g - b.g, db = a.b - b.b
  return Math.sqrt((2 + rm / 256) * dr * dr + 4 * dg * dg + (2 + (255 - rm) / 256) * db * db)
}

let cache: { groups: TokenGroups; ts: number } | null = null

export function readDesignTokens(force = false): TokenGroups {
  if (!force && cache && Date.now() - cache.ts < 1500) return cache.groups

  const rootStyle = getComputedStyle(document.documentElement)
  const seen = new Map<string, DesignToken>()

  function ingest(name: string, raw: string) {
    if (!name.startsWith('--') || name.startsWith('--fs-') || seen.has(name)) return
    const value = rootStyle.getPropertyValue(name).trim()
    if (!value) return
    const { kind, ramp } = classify(name)
    const token: DesignToken = { name, value, raw: raw.trim(), kind, ramp }
    if (kind === 'color') {
      const rgb = parseColor(value)
      if (rgb) token.rgb = rgb
      else return
    }
    seen.set(name, token)
  }

  for (const sheet of Array.from(document.styleSheets)) {
    let rules: CSSRuleList
    try { rules = sheet.cssRules } catch { continue }
    for (const rule of Array.from(rules)) {
      if (rule instanceof CSSStyleRule && rule.selectorText === ':root') {
        for (const prop of Array.from(rule.style)) {
          if (prop.startsWith('--')) ingest(prop, rule.style.getPropertyValue(prop))
        }
      }
    }
  }
  for (const prop of Array.from(document.documentElement.style)) {
    if (prop.startsWith('--')) ingest(prop, document.documentElement.style.getPropertyValue(prop))
  }

  const all = Array.from(seen.values())
  const colorByRamp = new Map<string, DesignToken[]>()
  for (const t of all) {
    if (t.kind !== 'color') continue
    if (!colorByRamp.has(t.ramp)) colorByRamp.set(t.ramp, [])
    colorByRamp.get(t.ramp)!.push(t)
  }

  const numAsc = (a: DesignToken, b: DesignToken) => {
    const na = Number(a.name.match(/(\d+)/)?.[1] ?? 0)
    const nb = Number(b.name.match(/(\d+)/)?.[1] ?? 0)
    return na - nb || a.name.localeCompare(b.name)
  }

  const colorRamps = COLOR_RAMP_ORDER
    .filter((r) => colorByRamp.has(r))
    .map((ramp) => ({ ramp, tokens: colorByRamp.get(ramp)!.sort(numAsc) }))

  const groups: TokenGroups = {
    colorRamps,
    spacing: all.filter((t) => t.kind === 'space').sort(numAsc),
    radius: all.filter((t) => t.kind === 'radius').sort(numAsc),
    shadow: all.filter((t) => t.kind === 'shadow').sort(numAsc),
    all,
  }
  cache = { groups, ts: Date.now() }
  return groups
}

/** Nearest solid brand colour token to an arbitrary colour. */
export function nearestColorToken(rgb: RGB, tokens: DesignToken[]): { token: DesignToken; distance: number } | null {
  let best: { token: DesignToken; distance: number } | null = null
  for (const t of tokens) {
    if (!t.rgb || t.rgb.a < 0.98) continue
    const d = colorDistance(rgb, t.rgb)
    if (!best || d < best.distance) best = { token: t, distance: d }
  }
  return best
}
