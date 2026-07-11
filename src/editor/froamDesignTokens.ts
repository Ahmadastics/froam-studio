/**
 * Froam Design Intelligence — token engine.
 *
 * Reads the host app's REAL design tokens straight from its live
 * stylesheets (the actual --red-500, --space-md, etc. the running app
 * uses), and provides colour maths for the accessibility + design-lint
 * features. This is only possible because Froam edits the live app, not
 * a static mock — the tokens are the truth, not a copy.
 */

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

export function parseColor(input: string): RGB | null {
  const value = input.trim().toLowerCase()
  if (!value || value === 'transparent' || value === 'none') return null

  const rgbMatch = value.match(/rgba?\(([^)]+)\)/)
  if (rgbMatch) {
    const parts = rgbMatch[1].split(/[,\s/]+/).filter(Boolean).map((p) => p.trim())
    const r = Number(parts[0]), g = Number(parts[1]), b = Number(parts[2])
    const a = parts[3] != null ? (parts[3].endsWith('%') ? Number(parts[3]) / 100 : Number(parts[3])) : 1
    if ([r, g, b].some(Number.isNaN)) return null
    return { r, g, b, a: Number.isNaN(a) ? 1 : a }
  }

  const hex = value.match(/^#([0-9a-f]{3,8})$/)
  if (hex) {
    let h = hex[1]
    if (h.length === 3) h = h.split('').map((c) => c + c).join('')
    if (h.length === 6 || h.length === 8) {
      return {
        r: parseInt(h.slice(0, 2), 16),
        g: parseInt(h.slice(2, 4), 16),
        b: parseInt(h.slice(4, 6), 16),
        a: h.length === 8 ? parseInt(h.slice(6, 8), 16) / 255 : 1,
      }
    }
  }
  return null
}

/** Composite a possibly-translucent colour over an opaque backdrop. */
export function flatten(top: RGB, backdrop: RGB): RGB {
  const a = top.a
  return {
    r: Math.round(top.r * a + backdrop.r * (1 - a)),
    g: Math.round(top.g * a + backdrop.g * (1 - a)),
    b: Math.round(top.b * a + backdrop.b * (1 - a)),
    a: 1,
  }
}

function channel(c: number): number {
  const s = c / 255
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
}

export function luminance({ r, g, b }: RGB): number {
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
}

export function contrastRatio(fg: RGB, bg: RGB): number {
  const l1 = luminance(fg)
  const l2 = luminance(bg)
  const [hi, lo] = l1 > l2 ? [l1, l2] : [l2, l1]
  return (hi + 0.05) / (lo + 0.05)
}

export function toHex({ r, g, b }: RGB): string {
  return '#' + [r, g, b].map((c) => Math.max(0, Math.min(255, Math.round(c))).toString(16).padStart(2, '0')).join('')
}

export function colorDistance(a: RGB, b: RGB): number {
  // Perceptual-ish weighting (redmean approximation).
  const rm = (a.r + b.r) / 2
  const dr = a.r - b.r, dg = a.g - b.g, db = a.b - b.b
  return Math.sqrt((2 + rm / 256) * dr * dr + 4 * dg * dg + (2 + (255 - rm) / 256) * db * db)
}

/** Resolve the true painted background behind an element (walks ancestors, composites alpha). */
export function resolvedBackground(el: HTMLElement): RGB {
  let node: HTMLElement | null = el
  const stack: RGB[] = []
  while (node) {
    const bg = parseColor(getComputedStyle(node).backgroundColor)
    if (bg && bg.a > 0) {
      stack.push(bg)
      if (bg.a >= 1) break
    }
    node = node.parentElement
  }
  let base: RGB = { r: 255, g: 255, b: 255, a: 1 }
  const rootBg = parseColor(getComputedStyle(document.body).backgroundColor)
  if (rootBg && rootBg.a >= 1) base = rootBg
  for (let i = stack.length - 1; i >= 0; i--) base = flatten(stack[i], base)
  return base
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
      if (rule instanceof CSSStyleRule && (rule.selectorText === ':root' || rule.selectorText === "[data-theme='light']" || rule.selectorText === '[data-theme="light"]')) {
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
