/**
 * WCAG colour maths, once. Every Froam surface that asks "can this be read?"
 * — the A11y tab, the page Health scan, "Fix contrast everywhere", the
 * reviewer checks, the page profile the judge reads — computes the answer
 * here, so two of them can never disagree about the same pair of colours.
 *
 * Pure: no DOM, safe in Node. Channels run 0–255; alpha 0–1.
 */

export type Rgb = { r: number; g: number; b: number }
export type Rgba = Rgb & { a: number }

/** WCAG 2.2 1.4.3 (AA): normal text. */
export const WCAG_AA_TEXT = 4.5
/** WCAG 2.2 1.4.3 (AA): large text — 24px, or 18.66px at weight 700+. */
export const WCAG_AA_LARGE_TEXT = 3
/** WCAG 2.2 1.4.6 (AAA): normal text. */
export const WCAG_AAA_TEXT = 7
/** WCAG 2.2 2.5.8 (AA) minimum target size, in CSS pixels. */
export const WCAG_MIN_TARGET_PX = 24

export const WHITE: Rgba = { r: 255, g: 255, b: 255, a: 1 }

const linear = (channel: number) => (channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4)
const gamma = (channel: number) => (channel <= 0.0031308 ? channel * 12.92 : 1.055 * channel ** (1 / 2.4) - 0.055)
const clamp01 = (value: number) => Math.min(1, Math.max(0, value))

/** WCAG relative luminance of a colour whose channels run 0–1. */
export function relativeLuminance01({ r, g, b }: Rgb) {
  return 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b)
}

/** WCAG relative luminance of a 0–255 colour. */
export function luminance({ r, g, b }: Rgb) {
  return relativeLuminance01({ r: r / 255, g: g / 255, b: b / 255 })
}

/** WCAG contrast ratio between two opaque colours, 1–21. */
export function contrastRatio(a: Rgb, b: Rgb) {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (light + 0.05) / (dark + 0.05)
}

/** `top` painted over `bottom` (source-over). Opaque when `bottom` is. */
export function blend(top: Rgba, bottom: Rgba): Rgba {
  const a = top.a + bottom.a * (1 - top.a)
  if (a <= 0) return { r: 0, g: 0, b: 0, a: 0 }
  const mix = (t: number, b: number) => (t * top.a + b * bottom.a * (1 - top.a)) / a
  return { r: mix(top.r, bottom.r), g: mix(top.g, bottom.g), b: mix(top.b, bottom.b), a }
}

export const isLargeText = (fontSizePx: number, fontWeight: number) => fontSizePx >= 24 || (fontSizePx >= 18.66 && fontWeight >= 700)

/** The AA floor for text of this size and weight. */
export const requiredContrast = (fontSizePx: number, fontWeight: number) => (isLargeText(fontSizePx, fontWeight) ? WCAG_AA_LARGE_TEXT : WCAG_AA_TEXT)

export function toHex({ r, g, b }: Rgb) {
  return `#${[r, g, b].map((part) => Math.round(Math.max(0, Math.min(255, part))).toString(16).padStart(2, '0')).join('')}`
}

const NUMBER = String.raw`[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?%?|none`
const FUNCTION = new RegExp(String.raw`^(rgba?|oklch|oklab|color)\(\s*(?:(srgb|srgb-linear)\s+)?(${NUMBER})(?:\s*,\s*|\s+)(${NUMBER})(?:\s*,\s*|\s+)(${NUMBER})(?:\s*(?:,|\/)\s*(${NUMBER}))?\s*\)$`, 'i')

const num = (raw: string, percentOf = 1) => (raw === 'none' ? 0 : raw.endsWith('%') ? (Number.parseFloat(raw) / 100) * percentOf : Number.parseFloat(raw))

function oklabToRgb(L: number, a: number, b: number): Rgb {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3
  const r = 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s
  const g = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s
  const bl = -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s
  return { r: clamp01(gamma(r)) * 255, g: clamp01(gamma(g)) * 255, b: clamp01(gamma(bl)) * 255 }
}

/**
 * Every colour form a computed style emits: hex, rgb()/rgba() in either
 * syntax, color(srgb …), and the CSS Color 4 spaces browsers now keep as
 * authored — oklch() and oklab(), which Tailwind 4 uses for its whole
 * palette. Null for keywords, gradients and spaces it can't convert (an
 * honest "can't read it" beats a wrong number).
 */
export function parseColor(value: string | null | undefined): Rgba | null {
  if (!value) return null
  const text = value.trim().toLowerCase()
  if (!text || text === 'transparent' || text === 'none' || text === 'currentcolor') return null
  const hex = text.match(/^#([0-9a-f]{3,8})$/)
  if (hex) {
    let digits = hex[1]
    if (digits.length === 5 || digits.length === 7) return null
    if (digits.length <= 4) digits = digits.split('').map((d) => d + d).join('')
    const n = (i: number) => Number.parseInt(digits.slice(i, i + 2), 16)
    return { r: n(0), g: n(2), b: n(4), a: digits.length === 8 ? n(6) / 255 : 1 }
  }
  const match = text.match(FUNCTION)
  if (!match) return null
  const [, fn, space, x, y, z, alphaRaw] = match
  const a = alphaRaw === undefined ? 1 : clamp01(num(alphaRaw))
  if (fn === 'rgb' || fn === 'rgba') return { r: num(x, 255), g: num(y, 255), b: num(z, 255), a }
  if (fn === 'color') {
    if (!space) return null
    const toSrgb = space === 'srgb-linear' ? (c: number) => gamma(clamp01(c)) : clamp01
    return { r: toSrgb(num(x)) * 255, g: toSrgb(num(y)) * 255, b: toSrgb(num(z)) * 255, a }
  }
  if (fn === 'oklab') return { ...oklabToRgb(num(x), num(y, 0.4), num(z, 0.4)), a }
  const hue = (num(z) * Math.PI) / 180
  const chroma = num(y, 0.4)
  return { ...oklabToRgb(num(x), Math.cos(hue) * chroma, Math.sin(hue) * chroma), a }
}
