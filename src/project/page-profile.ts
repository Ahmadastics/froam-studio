/**
 * Froam Page Profile — the measuring instrument.
 *
 * Aggregates per-node scan evidence into one bounded, page-level description
 * of an interface: its palette, type scale, spacing grid, surfaces, section
 * flow and internal consistency.
 *
 * This exists so that "is this design coherent" and "did a change improve it"
 * become computable rather than a matter of opinion. It is the ground truth
 * every judge tier is scored against.
 *
 * Derived statistics only. It never retains source, copy, markup or assets —
 * a profile is a fingerprint of decisions, not a reproduction of a page.
 */
import type { FroamScanRecord, FroamSemanticRole } from './types'
import type { FroamViewport } from '../collab/types'

export const FROAM_PAGE_PROFILE_SCHEMA_VERSION = 1 as const

/** Roles that represent a user action. Accent discipline is measured against these. */
export const FROAM_ACTION_ROLES: readonly FroamSemanticRole[] = ['cta', 'button', 'input', 'form']

export type FroamOklch = { l: number; c: number; h: number }

export type FroamPaletteEntry = {
  oklch: FroamOklch
  /** Representative sRGB, for display only. Never authoritative. */
  hex: string
  /** Share of estimated painted area, 0–1. */
  areaShare: number
  role: 'surface' | 'raised' | 'ink' | 'muted' | 'accent' | 'border' | 'other'
  /** Semantic roles this colour was observed painting. */
  appearsOn: FroamSemanticRole[]
  /** How the colour was used, which decides how area was estimated. */
  channel: 'background' | 'text'
  nodeCount: number
}

export type FroamTypeStep = {
  px: number
  weight: number
  lineHeight: number
  usedBy: FroamSemanticRole[]
  count: number
}

export type FroamSectionArchetype =
  | 'hero' | 'proof' | 'feature-grid' | 'split' | 'testimonial'
  | 'pricing' | 'faq' | 'cta' | 'footer' | 'unknown'

export type FroamSectionProfile = {
  index: number
  archetype: FroamSectionArchetype
  confidence: number
  grid: { columns: number; gapPx: number; maxWidthPx: number }
  heightRatio: number
  childRoles: FroamSemanticRole[]
}

export type FroamContrastPair = {
  nodeId: string
  ratio: number
  required: number
  largeText: boolean
  role: FroamSemanticRole
}

export type FroamTargetMeasurement = {
  nodeId: string
  role: FroamSemanticRole
  tag: string
  width: number
  height: number
  /** Smaller dimension, which is what the standard constrains. */
  shortestSide: number
}

/** WCAG 2.5.8 AA minimum target size, in CSS pixels. */
export const FROAM_MIN_TARGET_PX = 24

export type FroamPageProfile = {
  schemaVersion: typeof FROAM_PAGE_PROFILE_SCHEMA_VERSION
  origin: string
  routeKey: string
  capturedAt: number
  viewport: FroamViewport

  color: {
    palette: FroamPaletteEntry[]
    /** Fraction of accent-painted nodes that are action roles, 0–1. */
    accentDiscipline: number
    /** Worst text contrast ratio actually rendered. Infinity when no text. */
    contrastFloor: number
    /** Every text pair that failed its WCAG AA threshold. */
    contrastFailures: FroamContrastPair[]
    /** Text nodes evaluated, so failure counts have an honest denominator. */
    contrastSamples: number
    /** Text whose backdrop is a gradient or image, so contrast cannot be computed. */
    contrastUnmeasurable: number
    modeSignal: 'light' | 'dark' | 'mixed'
  }

  type: {
    families: Array<{ stack: string; role: 'display' | 'body' | 'mono'; areaShare: number }>
    scale: FroamTypeStep[]
    /** Median ratio between consecutive steps, or null when no scale holds. */
    ratio: number | null
    /** Spread of consecutive ratios. High spread means the scale is nominal only. */
    ratioSpread: number
    /** Body line length in characters, approximate. */
    measureCh: number
  }

  space: {
    base: number
    scale: number[]
    /** Fraction of spacing values landing on the base grid, 0–1. */
    adherence: number
    sectionGapPx: number[]
    density: 'tight' | 'balanced' | 'airy'
  }

  surface: { radii: number[]; shadowTiers: number; borderWeights: number[] }

  interaction: {
    /** Interactive elements measured, after exemptions. */
    targetSamples: number
    /** Targets whose shortest side is under the WCAG 2.5.8 minimum. */
    undersizedTargets: FroamTargetMeasurement[]
    /** Shortest side across all measured targets. Infinity when none. */
    smallestTargetPx: number
    /** Inline links inside running text, exempt from the size rule but counted for honesty. */
    exemptInlineTargets: number
    /** Undersized targets passing the WCAG 2.5.8 spacing exception. */
    exemptSpacedTargets: number
  }

  flow: { sections: FroamSectionProfile[]; signature: string }

  components: Array<{ signature: string; role: FroamSemanticRole; instances: number; variance: number }>

  quality: {
    /** Fraction of colour usages falling outside the resolved palette, 0–1. */
    tokenDrift: number
    /** 1 − spacing adherence. */
    spacingDrift: number
    accessibilityWarnings: number
    uniqueColors: number
    uniqueSizes: number
  }

  provenance: {
    derivedOnly: true
    sourceCaptured: false
    copyCaptured: false
    assetsCaptured: false
    nodesObserved: number
    nodesRendered: number
    /** Rendered / observed. Low coverage makes a profile unsafe to compare. */
    coverage: number
  }
}

// ── colour ──────────────────────────────────────────────────────────────────

/** Parse the colour forms computed styles actually emit. Returns null for gradients and keywords. */
export function parseCssColor(value: string | undefined): { r: number; g: number; b: number; a: number } | null {
  if (!value) return null
  const text = value.trim().toLowerCase()
  if (!text || text === 'transparent' || text === 'none' || text === 'currentcolor') return null
  const rgb = text.match(/^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)(?:[\s,/]+([\d.%]+))?\s*\)$/)
  if (rgb) {
    const alphaRaw = rgb[4]
    const a = alphaRaw === undefined ? 1 : alphaRaw.endsWith('%') ? Number.parseFloat(alphaRaw) / 100 : Number.parseFloat(alphaRaw)
    return { r: Number(rgb[1]) / 255, g: Number(rgb[2]) / 255, b: Number(rgb[3]) / 255, a: Number.isFinite(a) ? a : 1 }
  }
  const hex = text.match(/^#([0-9a-f]{3,8})$/)
  if (hex) {
    const digits = hex[1]
    const expand = (part: string) => Number.parseInt(part.length === 1 ? part + part : part, 16) / 255
    if (digits.length === 3 || digits.length === 4) return { r: expand(digits[0]), g: expand(digits[1]), b: expand(digits[2]), a: digits.length === 4 ? expand(digits[3]) : 1 }
    if (digits.length === 6 || digits.length === 8) return { r: expand(digits.slice(0, 2)), g: expand(digits.slice(2, 4)), b: expand(digits.slice(4, 6)), a: digits.length === 8 ? expand(digits.slice(6, 8)) : 1 }
  }
  return null
}

const linearize = (channel: number) => channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
const delinearize = (channel: number) => channel <= 0.0031308 ? channel * 12.92 : 1.055 * channel ** (1 / 2.4) - 0.055

/** sRGB → OKLab. Clustering in sRGB treats #111 and #131214 as different decisions; OKLab does not. */
export function rgbToOklab(rgb: { r: number; g: number; b: number }): { L: number; a: number; b: number } {
  const r = linearize(rgb.r), g = linearize(rgb.g), b = linearize(rgb.b)
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b)
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b)
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b)
  return {
    L: 0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s,
    a: 1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s,
    b: 0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s,
  }
}

export function oklabToRgb(lab: { L: number; a: number; b: number }): { r: number; g: number; b: number } {
  const l = (lab.L + 0.3963377774 * lab.a + 0.2158037573 * lab.b) ** 3
  const m = (lab.L - 0.1055613458 * lab.a - 0.0638541728 * lab.b) ** 3
  const s = (lab.L - 0.0894841775 * lab.a - 1.2914855480 * lab.b) ** 3
  const clamp = (value: number) => Math.min(1, Math.max(0, value))
  return {
    r: clamp(delinearize(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s)),
    g: clamp(delinearize(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s)),
    b: clamp(delinearize(-0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s)),
  }
}

export function oklabToOklch(lab: { L: number; a: number; b: number }): FroamOklch {
  const c = Math.hypot(lab.a, lab.b)
  const h = c < 1e-6 ? 0 : (Math.atan2(lab.b, lab.a) * 180 / Math.PI + 360) % 360
  return { l: lab.L, c, h }
}

export function oklchToOklab(oklch: FroamOklch) {
  const radians = oklch.h * Math.PI / 180
  return { L: oklch.l, a: Math.cos(radians) * oklch.c, b: Math.sin(radians) * oklch.c }
}

const toHex = (rgb: { r: number; g: number; b: number }) =>
  `#${[rgb.r, rgb.g, rgb.b].map((channel) => Math.round(channel * 255).toString(16).padStart(2, '0')).join('')}`

export function oklchToHex(oklch: FroamOklch) { return toHex(oklabToRgb(oklchToOklab(oklch))) }

/** WCAG 2.x relative luminance. Deliberately not OKLab — the standard defines this exact formula. */
export function relativeLuminance(rgb: { r: number; g: number; b: number }) {
  return 0.2126 * linearize(rgb.r) + 0.7152 * linearize(rgb.g) + 0.0722 * linearize(rgb.b)
}

export function contrastRatio(foreground: { r: number; g: number; b: number }, background: { r: number; g: number; b: number }) {
  const a = relativeLuminance(foreground), b = relativeLuminance(background)
  const light = Math.max(a, b), dark = Math.min(a, b)
  return (light + 0.05) / (dark + 0.05)
}

/** Composite a possibly translucent colour over an opaque backdrop. */
function flatten(colour: { r: number; g: number; b: number; a: number }, backdrop: { r: number; g: number; b: number }) {
  if (colour.a >= 1) return { r: colour.r, g: colour.g, b: colour.b }
  return {
    r: colour.r * colour.a + backdrop.r * (1 - colour.a),
    g: colour.g * colour.a + backdrop.g * (1 - colour.a),
    b: colour.b * colour.a + backdrop.b * (1 - colour.a),
  }
}

/** WCAG AA threshold: 3.0 for large text (≥24px, or ≥18.66px at weight ≥700), else 4.5. */
export function contrastRequirement(fontSizePx: number, fontWeight: number) {
  return fontSizePx >= 24 || (fontSizePx >= 18.66 && fontWeight >= 700) ? 3 : 4.5
}

// ── scan record access ──────────────────────────────────────────────────────

type SignalValues = Record<string, unknown>
const signal = (record: FroamScanRecord, kind: string): SignalValues =>
  (record.signals.find((item) => item.kind === kind)?.values ?? {}) as SignalValues

const num = (value: unknown, fallback = 0) => {
  const parsed = typeof value === 'number' ? value : Number.parseFloat(String(value ?? ''))
  return Number.isFinite(parsed) ? parsed : fallback
}

type NodeView = {
  id: string
  role: FroamSemanticRole
  tag: string
  text: string
  parentId?: string
  childIds: string[]
  rect: { x: number; y: number; width: number; height: number }
  area: number
  ownArea: number
  visible: boolean
  background: ReturnType<typeof parseCssColor>
  backgroundImage: string
  colour: ReturnType<typeof parseCssColor>
  fontSize: number
  fontWeight: number
  lineHeight: number
  fontFamily: string
  radius: number
  shadow: string
  border: string
  padding: string
  margin: string
  gap: number
  display: string
  gridTemplateColumns: string
  accessibilityWarnings: number
  focusable: boolean
  signature: string
}

function toNodeViews(records: readonly FroamScanRecord[]): NodeView[] {
  const views = new Map<string, NodeView>()
  for (const record of records) {
    const identity = signal(record, 'identity'), structure = signal(record, 'structure')
    const layout = signal(record, 'layout'), appearance = signal(record, 'appearance')
    const semantics = signal(record, 'semantics'), responsive = signal(record, 'responsive')
    const accessibility = signal(record, 'accessibility'), behavior = signal(record, 'behavior')
    const rectRaw = (layout.rect ?? {}) as Record<string, unknown>
    const rect = { x: num(rectRaw.x), y: num(rectRaw.y), width: num(rectRaw.width), height: num(rectRaw.height) }
    const id = String(identity.nodeId ?? record.node.nodeId)
    const fontSize = num(appearance.fontSize, 16)
    const lineHeightRaw = String(appearance.lineHeight ?? '')
    views.set(id, {
      id,
      role: (semantics.role as FroamSemanticRole) ?? 'unknown',
      tag: String(structure.tag ?? ''),
      text: String(semantics.textContent ?? ''),
      parentId: structure.parentNodeId ? String(structure.parentNodeId) : undefined,
      childIds: Array.isArray(structure.childNodeIds) ? (structure.childNodeIds as string[]).map(String) : [],
      rect,
      area: Math.max(0, rect.width) * Math.max(0, rect.height),
      ownArea: 0,
      visible: responsive.visible !== false && rect.width > 0 && rect.height > 0,
      background: parseCssColor(appearance.backgroundColor as string),
      backgroundImage: String(appearance.backgroundImage ?? 'none'),
      colour: parseCssColor(appearance.color as string),
      fontSize,
      fontWeight: num(appearance.fontWeight, 400),
      lineHeight: lineHeightRaw === 'normal' ? fontSize * 1.2 : num(lineHeightRaw, fontSize * 1.2),
      fontFamily: String(appearance.fontFamily ?? '').trim(),
      radius: num(appearance.borderRadius),
      shadow: String(appearance.boxShadow ?? 'none'),
      border: String(appearance.border ?? ''),
      padding: String(layout.padding ?? ''),
      margin: String(layout.margin ?? ''),
      gap: num(layout.gapPx ?? layout.gap),
      display: String(layout.display ?? ''),
      gridTemplateColumns: String(layout.gridTemplateColumns ?? 'none'),
      accessibilityWarnings: Array.isArray(accessibility.warnings) ? (accessibility.warnings as unknown[]).length : 0,
      focusable: behavior.focusable === true || accessibility.focusable === true,
      signature: String(structure.signature ?? ''),
    })
  }
  // Own area approximates painted area: a container covered by its children
  // paints little. Only children that actually paint occlude, weighted by their
  // alpha — a transparent section does not hide the page background behind it,
  // and treating it as if it did hands the palette to whichever nested element
  // happens to have a fill.
  for (const view of views.values()) {
    const occluded = view.childIds.reduce((total, childId) => {
      const child = views.get(childId)
      if (!child?.visible || !child.background || child.background.a <= 0) return total
      return total + child.area * child.background.a
    }, 0)
    view.ownArea = Math.max(0, view.area - occluded)
  }
  return [...views.values()]
}

/** Tags that are interactive regardless of what the semantic heuristic made of their copy. */
const ACTION_TAGS = new Set(['a', 'button', 'input', 'select', 'textarea', 'summary'])

/**
 * Whether a node represents a user action.
 *
 * Tag-first, because the scan's semantic role is a copy heuristic: a link
 * reading "Pricing" is 'unknown' while the identical element reading "Get
 * started" is 'cta'. For questions about where action colour belongs, the
 * element type is the reliable signal and the copy is not.
 */
function isActionNode(view: NodeView) {
  return ACTION_TAGS.has(view.tag) || FROAM_ACTION_ROLES.includes(view.role) || view.focusable
}

/**
 * Nearest ancestor with an opaque-enough background, flattened. Defaults to white.
 *
 * `certain` is false when a gradient or image sits anywhere in the resolved
 * stack. A computed style reports `backgroundImage` but not the pixels it
 * paints, so the true backdrop under that text is unknown.
 *
 * This matters more than it sounds. The first real site scanned reported 65 of
 * 160 text elements failing contrast, several at 1.01:1 — white text on a
 * gradient hero, where only the transparent `backgroundColor` was visible to
 * the resolver, so white was being compared against white. Reporting a
 * violation that cannot be substantiated is worse than reporting nothing:
 * it is the fastest way for an audit to lose a reader's trust.
 */
function effectiveBackground(view: NodeView, byId: Map<string, NodeView>): { rgb: { r: number; g: number; b: number }; certain: boolean } {
  const stack: Array<{ r: number; g: number; b: number; a: number }> = []
  let cursor: NodeView | undefined = view
  let guard = 0
  let certain = true
  while (cursor && guard++ < 64) {
    if (cursor.backgroundImage && cursor.backgroundImage !== 'none') certain = false
    if (cursor.background && cursor.background.a > 0) {
      stack.push(cursor.background)
      if (cursor.background.a >= 1) break
    }
    cursor = cursor.parentId ? byId.get(cursor.parentId) : undefined
  }
  let result = { r: 1, g: 1, b: 1 }
  for (let index = stack.length - 1; index >= 0; index -= 1) result = flatten(stack[index], result)
  return { rgb: result, certain }
}

// ── clustering ──────────────────────────────────────────────────────────────

type ColourSample = { lab: { L: number; a: number; b: number }; weight: number; role: FroamSemanticRole; channel: 'background' | 'text' }

/**
 * Greedy perceptual clustering. Threshold is OKLab ΔE — below it, two values
 * are one design decision.
 *
 * Backgrounds cluster tighter than text on purpose. An elevation system is
 * built from 1–3% lightness steps: #ffffff against #fafafa is ΔE 0.0155, a
 * deliberate surface/raised distinction that a text-grade threshold would
 * silently average into one off-white. The same difference between two text
 * colours is invisible and should merge.
 */
export const OKLAB_MERGE_THRESHOLD = 0.035
export const OKLAB_MERGE_THRESHOLD_BACKGROUND = 0.01

function clusterColours(samples: ColourSample[], threshold = OKLAB_MERGE_THRESHOLD, backgroundThreshold = OKLAB_MERGE_THRESHOLD_BACKGROUND) {
  const clusters: Array<{ lab: { L: number; a: number; b: number }; weight: number; roles: Map<FroamSemanticRole, number>; channel: 'background' | 'text'; count: number }> = []
  for (const sample of [...samples].sort((a, b) => b.weight - a.weight)) {
    const limit = sample.channel === 'background' ? backgroundThreshold : threshold
    const match = clusters.find((cluster) => cluster.channel === sample.channel
      && Math.hypot(cluster.lab.L - sample.lab.L, cluster.lab.a - sample.lab.a, cluster.lab.b - sample.lab.b) <= limit)
    if (match) {
      const total = match.weight + sample.weight
      match.lab = total > 0
        ? { L: (match.lab.L * match.weight + sample.lab.L * sample.weight) / total, a: (match.lab.a * match.weight + sample.lab.a * sample.weight) / total, b: (match.lab.b * match.weight + sample.lab.b * sample.weight) / total }
        : match.lab
      match.weight = total
      match.count += 1
      match.roles.set(sample.role, (match.roles.get(sample.role) ?? 0) + 1)
    } else {
      clusters.push({ lab: sample.lab, weight: sample.weight, roles: new Map([[sample.role, 1]]), channel: sample.channel, count: 1 })
    }
  }
  return clusters.sort((a, b) => b.weight - a.weight)
}

/** Cluster numbers by relative tolerance, weighted by occurrence. */
function clusterNumbers(values: number[], tolerance: number) {
  const clusters: Array<{ value: number; count: number }> = []
  for (const value of [...values].sort((a, b) => a - b)) {
    const match = clusters.find((cluster) => Math.abs(cluster.value - value) <= Math.max(0.5, cluster.value * tolerance))
    if (match) {
      match.value = (match.value * match.count + value) / (match.count + 1)
      match.count += 1
    } else clusters.push({ value, count: 1 })
  }
  return clusters
}

const median = (values: number[]) => {
  if (!values.length) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const middle = sorted.length >> 1
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2
}

function parseLengths(value: string) {
  return value.split(/\s+/).map((part) => Number.parseFloat(part)).filter((part) => Number.isFinite(part) && part > 0)
}

// ── section flow ────────────────────────────────────────────────────────────

function classifySection(childRoles: FroamSemanticRole[], input: { index: number; total: number; columns: number; heightRatio: number; cardCount: number; hasForm: boolean; linkDensity: number }): { archetype: FroamSectionArchetype; confidence: number } {
  const has = (role: FroamSemanticRole) => childRoles.includes(role)
  if (input.index === input.total - 1 && (has('footer') || input.linkDensity > 0.35)) return { archetype: 'footer', confidence: has('footer') ? 0.9 : 0.55 }
  if (input.index === 0 && has('heading') && (has('cta') || has('button')) && input.heightRatio > 0.15) return { archetype: 'hero', confidence: 0.72 }
  if (input.cardCount >= 3 && input.columns >= 2) return { archetype: 'feature-grid', confidence: 0.68 }
  if (input.hasForm) return { archetype: 'cta', confidence: 0.6 }
  if (input.cardCount === 2 || input.columns === 2) return { archetype: 'split', confidence: 0.5 }
  if ((has('cta') || has('button')) && childRoles.length <= 4) return { archetype: 'cta', confidence: 0.48 }
  if (has('media') && !has('heading')) return { archetype: 'proof', confidence: 0.35 }
  return { archetype: 'unknown', confidence: 0 }
}

// ── profile ─────────────────────────────────────────────────────────────────

export type FroamProfileInput = {
  records: readonly FroamScanRecord[]
  origin: string
  routeKey: string
  viewport: FroamViewport
  capturedAt?: number
}

export function buildPageProfile(input: FroamProfileInput): FroamPageProfile {
  const all = toNodeViews(input.records)
  const byId = new Map(all.map((view) => [view.id, view]))
  const rendered = all.filter((view) => view.visible)
  const capturedAt = input.capturedAt ?? (input.records[0]?.capturedAt ?? 0)

  // ── colour ────────────────────────────────────────────────────────────────
  // Backgrounds weight by own painted area; text weights by approximate ink.
  // Node counting would report a palette of whatever is most repeated rather
  // than whatever is most seen.
  const samples: ColourSample[] = []
  let colourUsages = 0
  const rawColours = new Set<string>()
  for (const view of rendered) {
    if (view.background && view.background.a > 0 && view.ownArea > 0) {
      const backdrop = view.parentId ? effectiveBackground(byId.get(view.parentId) ?? view, byId).rgb : { r: 1, g: 1, b: 1 }
      const flat = flatten(view.background, backdrop)
      samples.push({ lab: rgbToOklab(flat), weight: view.ownArea * view.background.a, role: view.role, channel: 'background' })
      rawColours.add(toHex(flat))
      colourUsages += 1
    }
    const leaf = view.childIds.length === 0
    if (leaf && view.colour && view.colour.a > 0 && view.text.length > 0) {
      const flat = flatten(view.colour, effectiveBackground(view, byId).rgb)
      samples.push({ lab: rgbToOklab(flat), weight: view.text.length * view.fontSize, role: view.role, channel: 'text' })
      rawColours.add(toHex(flat))
      colourUsages += 1
    }
  }
  const clusters = clusterColours(samples)
  const totalWeight = clusters.reduce((sum, cluster) => sum + cluster.weight, 0) || 1

  const backgrounds = clusters.filter((cluster) => cluster.channel === 'background')
  const texts = clusters.filter((cluster) => cluster.channel === 'text')
  const surfaceCluster = backgrounds[0]
  const surfaceRgb = surfaceCluster ? oklabToRgb(surfaceCluster.lab) : { r: 1, g: 1, b: 1 }

  // Accent: chromatic, small, and landing on action roles. Chroma alone would
  // pick a large brand-coloured hero background.
  const accentCluster = clusters
    .filter((cluster) => oklabToOklch(cluster.lab).c >= 0.06 && cluster.weight / totalWeight < 0.25)
    .sort((a, b) => {
      const actionShare = (cluster: typeof a) => [...cluster.roles].filter(([role]) => FROAM_ACTION_ROLES.includes(role)).reduce((sum, [, count]) => sum + count, 0) / Math.max(1, cluster.count)
      return (actionShare(b) - actionShare(a)) || (oklabToOklch(b.lab).c - oklabToOklch(a.lab).c)
    })[0]

  // Ink is the strongest voice on the page, not the most frequent one. Picking
  // the heaviest text cluster hands the role to whichever grey there is most
  // of: a page with one black headline and paragraphs of #9a9a9a would report
  // the failing grey as its ink and the headline as an outlier. Contrast
  // against the surface is the right discriminator, with a weight floor so a
  // single stray label cannot claim the role.
  const INK_WEIGHT_FLOOR = 0.05
  const textWeightTotal = texts.reduce((sum, cluster) => sum + cluster.weight, 0) || 1
  const inkCandidates = texts.filter((cluster) => cluster.weight / textWeightTotal >= INK_WEIGHT_FLOOR)
  const inkCluster = (inkCandidates.length ? inkCandidates : texts)
    .map((cluster) => ({ cluster, contrast: contrastRatio(oklabToRgb(cluster.lab), surfaceRgb) }))
    .sort((a, b) => b.contrast - a.contrast)[0]?.cluster
  const surfaceLightness = surfaceCluster ? surfaceCluster.lab.L : 1
  const inkDarkerThanSurface = inkCluster ? inkCluster.lab.L < surfaceLightness : true
  const palette: FroamPaletteEntry[] = clusters.map((cluster) => {
    const oklch = oklabToOklch(cluster.lab)
    let role: FroamPaletteEntry['role'] = 'other'
    if (cluster === surfaceCluster) role = 'surface'
    else if (cluster === accentCluster) role = 'accent'
    else if (cluster === inkCluster) role = 'ink'
    else if (cluster.channel === 'background') role = 'raised'
    // Muted is text that reads quieter than ink in the same direction. Text on
    // the far side of the surface is inverse text sitting on a dark or accent
    // panel — calling white-on-red "muted" would be backwards.
    else if (cluster.channel === 'text') {
      const sameSideAsInk = inkDarkerThanSurface ? cluster.lab.L < surfaceLightness : cluster.lab.L > surfaceLightness
      role = sameSideAsInk ? 'muted' : 'other'
    }
    return {
      oklch,
      hex: oklchToHex(oklch),
      areaShare: cluster.weight / totalWeight,
      role,
      appearsOn: [...cluster.roles.keys()],
      channel: cluster.channel,
      nodeCount: cluster.count,
    }
  })

  // Accent discipline is measured over the nodes that actually carry the colour,
  // with action-ness decided by tag as well as role.
  //
  // The first live scan exposed why. scan.ts only promotes an <a> to 'cta' when
  // its copy matches buy/start/join/sign-up, so an ordinary link is 'unknown' —
  // and on a page whose accent *is* its link colour, counting roles alone
  // reported perfect discipline as 0%. Any site with a conventional link colour
  // would have been scored wrong.
  const accentNodesFound: NodeView[] = []
  if (accentCluster) {
    for (const view of rendered) {
      const candidates: Array<{ colour: NonNullable<typeof view.background>; channel: 'background' | 'text' }> = []
      if (view.background && view.background.a > 0 && view.ownArea > 0) candidates.push({ colour: view.background, channel: 'background' })
      if (view.childIds.length === 0 && view.colour && view.colour.a > 0 && view.text.length > 0) candidates.push({ colour: view.colour, channel: 'text' })
      for (const candidate of candidates) {
        if (candidate.channel !== accentCluster.channel) continue
        const backdrop = candidate.channel === 'background' && view.parentId
          ? effectiveBackground(byId.get(view.parentId) ?? view, byId).rgb
          : effectiveBackground(view, byId).rgb
        const lab = rgbToOklab(flatten(candidate.colour, backdrop))
        const distance = Math.hypot(lab.L - accentCluster.lab.L, lab.a - accentCluster.lab.a, lab.b - accentCluster.lab.b)
        const limit = accentCluster.channel === 'background' ? OKLAB_MERGE_THRESHOLD_BACKGROUND : OKLAB_MERGE_THRESHOLD
        if (distance <= limit) { accentNodesFound.push(view); break }
      }
    }
  }
  const accentActionNodes = accentNodesFound.filter((view) => isActionNode(view)).length
  const accentDiscipline = accentNodesFound.length > 0 ? accentActionNodes / accentNodesFound.length : 1

  const contrastFailures: FroamContrastPair[] = []
  let contrastFloor = Infinity
  let contrastSamples = 0
  let contrastUnmeasurable = 0
  for (const view of rendered) {
    if (view.childIds.length > 0 || !view.colour || view.colour.a <= 0 || !view.text.trim()) continue
    const resolved = effectiveBackground(view, byId)
    if (!resolved.certain) { contrastUnmeasurable += 1; continue }
    const background = resolved.rgb
    const ratio = contrastRatio(flatten(view.colour, background), background)
    const required = contrastRequirement(view.fontSize, view.fontWeight)
    contrastSamples += 1
    contrastFloor = Math.min(contrastFloor, ratio)
    if (ratio < required) contrastFailures.push({ nodeId: view.id, ratio: Math.round(ratio * 100) / 100, required, largeText: required === 3, role: view.role })
  }

  // Mode is a property of the surfaces a page is built on, so only backgrounds
  // carrying real area vote. Every accent is dark or light relative to its
  // surface; letting a 4%-area button count would report a white page with a
  // red CTA as mixed-mode.
  const surfaceLuminance = relativeLuminance(surfaceRgb)
  const MODE_AREA_FLOOR = 0.15
  const backgroundLuminances = backgrounds
    .filter((cluster) => cluster.weight / totalWeight >= MODE_AREA_FLOOR)
    .slice(0, 4)
    .map((cluster) => relativeLuminance(oklabToRgb(cluster.lab)))
  const modeSignal: FroamPageProfile['color']['modeSignal'] =
    backgroundLuminances.length > 1 && backgroundLuminances.some((value) => value > 0.5) && backgroundLuminances.some((value) => value <= 0.5)
      ? 'mixed'
      : surfaceLuminance > 0.5 ? 'light' : 'dark'

  // ── type ──────────────────────────────────────────────────────────────────
  const textNodes = rendered.filter((view) => view.childIds.length === 0 && view.text.trim().length > 0)
  const sizeClusters = clusterNumbers(textNodes.map((view) => view.fontSize), 0.04).sort((a, b) => a.value - b.value)
  const scale: FroamTypeStep[] = sizeClusters.map((cluster) => {
    const members = textNodes.filter((view) => Math.abs(view.fontSize - cluster.value) <= Math.max(0.5, cluster.value * 0.04))
    return {
      px: Math.round(cluster.value * 100) / 100,
      weight: Math.round(median(members.map((view) => view.fontWeight))),
      lineHeight: Math.round(median(members.map((view) => view.lineHeight)) * 100) / 100,
      usedBy: [...new Set(members.map((view) => view.role))],
      count: cluster.count,
    }
  })
  const consecutiveRatios = scale.slice(1).map((step, index) => step.px / scale[index].px).filter((ratio) => Number.isFinite(ratio) && ratio > 1)
  const ratioMedian = consecutiveRatios.length ? median(consecutiveRatios) : null
  const ratioSpread = consecutiveRatios.length > 1
    ? Math.sqrt(consecutiveRatios.reduce((sum, ratio) => sum + (ratio - (ratioMedian ?? 0)) ** 2, 0) / consecutiveRatios.length)
    : 0
  // A "scale" whose steps disagree wildly is not a scale. Report null rather than a mean of noise.
  const ratio = ratioMedian !== null && ratioSpread <= 0.25 ? Math.round(ratioMedian * 1000) / 1000 : null

  const familyWeights = new Map<string, number>()
  for (const view of textNodes) if (view.fontFamily) familyWeights.set(view.fontFamily, (familyWeights.get(view.fontFamily) ?? 0) + view.text.length * view.fontSize)
  const familyTotal = [...familyWeights.values()].reduce((sum, value) => sum + value, 0) || 1
  const displayRoles: FroamSemanticRole[] = ['heading', 'hero']
  const families = [...familyWeights].sort((a, b) => b[1] - a[1]).map(([stack, weight]) => {
    const members = textNodes.filter((view) => view.fontFamily === stack)
    const displayShare = members.filter((view) => displayRoles.includes(view.role)).length / Math.max(1, members.length)
    const role: 'display' | 'body' | 'mono' = /mono|courier|consolas/i.test(stack) ? 'mono' : displayShare > 0.5 ? 'display' : 'body'
    return { stack, role, areaShare: weight / familyTotal }
  })

  // Measure describes running text only. Including short unclassified nodes
  // pulls the median toward the width of a footer link — a 1100px paragraph
  // and two 60px labels report as "11 characters per line", which is both
  // wrong and confidently stated.
  const MEASURE_MIN_CHARS = 40
  const bodyNodes = textNodes.filter((view) => view.role === 'paragraph' && view.text.length >= MEASURE_MIN_CHARS)
  // 0.5em is the conventional average glyph advance for proportional Latin text.
  const measureCh = bodyNodes.length ? Math.round(median(bodyNodes.map((view) => view.rect.width / Math.max(1, view.fontSize * 0.5)))) : 0

  // ── space ─────────────────────────────────────────────────────────────────
  const spacingValues: number[] = []
  for (const view of rendered) {
    spacingValues.push(...parseLengths(view.padding), ...parseLengths(view.margin))
    if (view.gap > 0) spacingValues.push(view.gap)
  }
  const candidateBases = [8, 4, 6, 10, 5, 12, 3]
  const scored = candidateBases.map((base) => ({
    base,
    adherence: spacingValues.length ? spacingValues.filter((value) => Math.abs(value / base - Math.round(value / base)) * base <= 0.5).length / spacingValues.length : 0,
  }))
  // Prefer the coarsest base that explains the data: 4 always beats 8 numerically
  // because every multiple of 8 is a multiple of 4.
  const best = scored.reduce((winner, candidate) => candidate.adherence > winner.adherence + 0.02 || (Math.abs(candidate.adherence - winner.adherence) <= 0.02 && candidate.base > winner.base) ? candidate : winner, scored[0])
  const spacingScale = clusterNumbers(spacingValues, 0.05).filter((cluster) => cluster.count > 1).map((cluster) => Math.round(cluster.value * 10) / 10).sort((a, b) => a - b)

  // ── surfaces ──────────────────────────────────────────────────────────────
  const radii = clusterNumbers(rendered.map((view) => view.radius).filter((value) => value > 0), 0.1).map((cluster) => Math.round(cluster.value * 10) / 10).sort((a, b) => a - b)
  const shadowTiers = new Set(rendered.map((view) => view.shadow).filter((shadow) => shadow && shadow !== 'none')).size
  const borderWeights = [...new Set(rendered.map((view) => Number.parseFloat(view.border)).filter((value) => Number.isFinite(value) && value > 0))].sort((a, b) => a - b)

  // ── interaction ───────────────────────────────────────────────────────────
  // WCAG 2.5.8 AA constrains the shortest side of a target to 24 CSS px. The
  // standard exempts targets sitting inside a sentence, so an inline link in a
  // paragraph is measured, exempted and counted rather than silently skipped —
  // a check that quietly drops its hard cases reports a cleaner page than exists.
  const undersizedTargets: FroamTargetMeasurement[] = []
  const targets = rendered.filter((view) => isActionNode(view))
  let exemptInlineTargets = 0
  let exemptSpacedTargets = 0
  let smallestTargetPx = Infinity
  const measured: NodeView[] = []
  for (const view of targets) {
    const parent = view.parentId ? byId.get(view.parentId) : undefined
    // The standard's inline exception covers a target "in a sentence". Any
    // text-bearing ancestor whose copy exceeds the link's own qualifies; the
    // earlier paragraph-only test missed links inside headings and list items,
    // which is most of the real web.
    const inlineInProse = view.tag === 'a' && Boolean(parent) && parent!.text.length > view.text.length + 8 && view.text.length > 0
    if (inlineInProse) { exemptInlineTargets += 1; continue }
    measured.push(view)
    smallestTargetPx = Math.min(smallestTargetPx, Math.min(view.rect.width, view.rect.height))
  }

  // WCAG 2.5.8's spacing exception: an undersized target passes when a 24px
  // circle centred on it does not touch another target's circle. Without this,
  // every ordinary navigation bar reports as a pile of violations — a check
  // that fires on well-built pages is one nobody reads twice.
  const centreOf = (view: NodeView) => ({ x: view.rect.x + view.rect.width / 2, y: view.rect.y + view.rect.height / 2 })
  for (const view of measured) {
    const shortestSide = Math.min(view.rect.width, view.rect.height)
    if (shortestSide >= FROAM_MIN_TARGET_PX) continue
    const centre = centreOf(view)
    const crowded = measured.some((other) => {
      if (other === view) return false
      const otherCentre = centreOf(other)
      return Math.hypot(centre.x - otherCentre.x, centre.y - otherCentre.y) < FROAM_MIN_TARGET_PX
    })
    if (!crowded) { exemptSpacedTargets += 1; continue }
    undersizedTargets.push({
      nodeId: view.id,
      role: view.role,
      tag: view.tag,
      width: Math.round(view.rect.width * 10) / 10,
      height: Math.round(view.rect.height * 10) / 10,
      shortestSide: Math.round(shortestSide * 10) / 10,
    })
  }
  const targetSamples = measured.length

  // ── flow ──────────────────────────────────────────────────────────────────
  const documentRoot = rendered.filter((view) => !view.parentId || !byId.has(view.parentId)).sort((a, b) => b.area - a.area)[0]
    ?? rendered.sort((a, b) => b.area - a.area)[0]

  // Real pages nest. The scan root is <body>, and beneath it sit wrapper divs
  // from a framework, a layout shell and a theme provider before anything that
  // resembles a section. Reading direct children of the root found exactly one
  // section on the first real site scanned, which silently emptied the entire
  // flow axis — and with it three of the six pretext tasks.
  //
  // So descend through pass-through containers until reaching a node whose
  // children actually look like a stack of sections.
  const sectionLike = (view: NodeView | undefined, parent: NodeView): view is NodeView =>
    Boolean(view?.visible && view.rect.height >= Math.max(40, (parent.rect.height || 1) * 0.03) && view.rect.width >= (parent.rect.width || 1) * 0.6)
  const SECTION_TAGS = new Set(['section', 'header', 'footer', 'main', 'article', 'nav', 'aside'])

  const childrenOf = (view: NodeView) => view.childIds.map((id) => byId.get(id)).filter((child): child is NodeView => Boolean(child?.visible))

  let sectionParent = documentRoot
  for (let depth = 0; depth < 12 && sectionParent; depth += 1) {
    const children = childrenOf(sectionParent)
    const qualifying = children.filter((child) => sectionLike(child, sectionParent))
    // A semantic landmark among the children is decisive; otherwise two or more
    // full-width blocks is the signal that this is the section stack.
    if (qualifying.some((child) => SECTION_TAGS.has(child.tag)) || qualifying.length >= 2) break
    const widest = [...children].sort((a, b) => b.area - a.area)[0]
    // Only follow a child that is essentially the whole parent — a genuine
    // wrapper. Anything smaller means the stack is here, however thin.
    if (!widest || widest.area < sectionParent.area * 0.5) break
    sectionParent = widest
  }

  const rootHeight = sectionParent?.rect.height || 1
  const rootWidth = sectionParent?.rect.width || 1
  // An empty or fully-hidden scan leaves no root at all. Returning no sections
  // is the correct answer; dereferencing one is not.
  const sectionNodes = sectionParent
    ? childrenOf(sectionParent).filter((view) => sectionLike(view, sectionParent)).sort((a, b) => a.rect.y - b.rect.y)
    : []

  const sections: FroamSectionProfile[] = sectionNodes.map((section, index) => {
    const descendants: NodeView[] = []
    const walk = (view: NodeView, depth: number) => {
      if (depth > 6) return
      for (const childId of view.childIds) {
        const child = byId.get(childId)
        if (!child?.visible) continue
        descendants.push(child)
        walk(child, depth + 1)
      }
    }
    walk(section, 0)
    const childRoles = [...new Set(descendants.map((view) => view.role).filter((role) => role !== 'unknown'))]
    const columns = section.gridTemplateColumns !== 'none' && section.gridTemplateColumns
      ? section.gridTemplateColumns.trim().split(/\s+/).length
      : new Set(section.childIds.map((id) => byId.get(id)).filter((view) => view?.visible).map((view) => Math.round(view!.rect.y / 8))).size === 1
        ? section.childIds.filter((id) => byId.get(id)?.visible).length
        : 1
    const linkDensity = descendants.length ? descendants.filter((view) => view.tag === 'a').length / descendants.length : 0
    const classification = classifySection(childRoles, {
      index, total: sectionNodes.length, columns,
      heightRatio: section.rect.height / rootHeight,
      cardCount: descendants.filter((view) => view.role === 'card').length,
      hasForm: descendants.some((view) => view.role === 'form'),
      linkDensity,
    })
    return {
      index,
      archetype: classification.archetype,
      confidence: classification.confidence,
      grid: { columns, gapPx: section.gap, maxWidthPx: Math.round(section.rect.width) },
      heightRatio: Math.round((section.rect.height / rootHeight) * 1000) / 1000,
      childRoles,
    }
  })
  const sectionGapPx = sections.slice(1).map((section, index) => {
    const current = sectionNodes[index + 1], previous = sectionNodes[index]
    return Math.round(current.rect.y - (previous.rect.y + previous.rect.height))
  }).filter((gap) => gap >= 0)

  const paddingTotal = rendered.reduce((sum, view) => sum + parseLengths(view.padding).reduce((inner, value) => inner + value, 0), 0)
  const densityRatio = paddingTotal / Math.max(1, rendered.length)
  const density: FroamPageProfile['space']['density'] = densityRatio < 8 ? 'tight' : densityRatio > 28 ? 'airy' : 'balanced'

  // ── components ────────────────────────────────────────────────────────────
  const signatureGroups = new Map<string, NodeView[]>()
  for (const view of rendered) {
    if (!view.signature) continue
    signatureGroups.set(view.signature, [...(signatureGroups.get(view.signature) ?? []), view])
  }
  const components = [...signatureGroups.entries()]
    .filter(([, members]) => members.length >= 2)
    .map(([signatureKey, members]) => {
      // Variance: how much instances of the same structure disagree on padding.
      const paddings = members.map((view) => parseLengths(view.padding).reduce((sum, value) => sum + value, 0))
      const mean = paddings.reduce((sum, value) => sum + value, 0) / Math.max(1, paddings.length)
      const deviation = mean > 0 ? Math.sqrt(paddings.reduce((sum, value) => sum + (value - mean) ** 2, 0) / paddings.length) / mean : 0
      return { signature: signatureKey, role: members[0].role, instances: members.length, variance: Math.round(Math.min(1, deviation) * 1000) / 1000 }
    })
    .sort((a, b) => b.instances - a.instances)

  // ── quality ───────────────────────────────────────────────────────────────
  const paletteSize = Math.min(palette.length, 8)
  const inPaletteWeight = palette.slice(0, paletteSize).reduce((sum, entry) => sum + entry.areaShare, 0)
  const tokenDrift = Math.round(Math.max(0, 1 - inPaletteWeight) * 1000) / 1000
  const spacingDrift = Math.round((1 - best.adherence) * 1000) / 1000

  return {
    schemaVersion: FROAM_PAGE_PROFILE_SCHEMA_VERSION,
    origin: input.origin,
    routeKey: input.routeKey,
    capturedAt,
    viewport: input.viewport,
    color: {
      palette,
      accentDiscipline: Math.round(accentDiscipline * 1000) / 1000,
      contrastFloor: Number.isFinite(contrastFloor) ? Math.round(contrastFloor * 100) / 100 : Infinity,
      contrastFailures,
      contrastSamples,
      contrastUnmeasurable,
      modeSignal,
    },
    type: { families, scale, ratio, ratioSpread: Math.round(ratioSpread * 1000) / 1000, measureCh },
    space: {
      base: best.base,
      scale: spacingScale,
      adherence: Math.round(best.adherence * 1000) / 1000,
      sectionGapPx,
      density,
    },
    surface: { radii, shadowTiers, borderWeights },
    interaction: {
      targetSamples,
      undersizedTargets,
      smallestTargetPx: Number.isFinite(smallestTargetPx) ? Math.round(smallestTargetPx * 10) / 10 : Infinity,
      exemptInlineTargets,
      exemptSpacedTargets,
    },
    flow: { sections, signature: sections.map((section) => section.archetype === 'feature-grid' ? `feature-grid:${section.grid.columns}` : section.archetype).join('>') },
    components,
    quality: {
      tokenDrift,
      spacingDrift,
      accessibilityWarnings: rendered.reduce((sum, view) => sum + view.accessibilityWarnings, 0),
      uniqueColors: rawColours.size,
      uniqueSizes: sizeClusters.length,
    },
    provenance: {
      derivedOnly: true,
      sourceCaptured: false,
      copyCaptured: false,
      assetsCaptured: false,
      nodesObserved: all.length,
      nodesRendered: rendered.length,
      coverage: all.length ? Math.round((rendered.length / all.length) * 1000) / 1000 : 0,
    },
  }
}
