/**
 * Froam Generation — build a page that obeys a measured design system.
 *
 * This is the half of "recreate" that is worth having. It does not reproduce a
 * scanned page; it produces a *new* page that runs on the same system — the same
 * palette roles, the same type scale, the same spacing base, the same section
 * rhythm — carrying neutral placeholder content.
 *
 * That boundary is not a compromise, it is the product. "Give me a page built on
 * this system, with my content" is the thing people pay for. "Give me a copy of
 * that company's homepage" is the thing that ends a company. The distinction is
 * also structural rather than a matter of restraint: a profile contains no copy,
 * no markup and no assets, so reproducing the original is not something this
 * function could do if it tried.
 *
 * Generation exists mainly to be *measured*. Emit a page from a profile,
 * re-scan it, profile it again, and the distance between the two profiles is a
 * number — see profileDistance. That number falling is what "Froam is learning
 * to build" means, as opposed to a feeling about some screenshots.
 */
import type { FroamPageProfile, FroamSectionArchetype } from './page-profile'

export const FROAM_GENERATOR_VERSION = 'froam-generator-v1'

export type FroamGenerateOptions = {
  /** Page title. Never taken from a scanned page. */
  title?: string
  /** Sections to emit. Defaults to the profile's own flow. */
  flow?: FroamSectionArchetype[]
  /** Seed for the placeholder text lengths, so output is deterministic. */
  seed?: number
}

/** Neutral filler. Deliberately generic — no scanned copy exists to leak. */
const WORDS = [
  'clarity', 'system', 'surface', 'rhythm', 'measure', 'signal', 'balance', 'contrast',
  'structure', 'interval', 'weight', 'density', 'motion', 'anchor', 'threshold', 'scale',
]

function filler(wordCount: number, seed: number) {
  const words: string[] = []
  let state = seed >>> 0
  for (let index = 0; index < wordCount; index += 1) {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0
    words.push(WORDS[state % WORDS.length])
  }
  const sentence = words.join(' ')
  return sentence.charAt(0).toUpperCase() + sentence.slice(1) + '.'
}

const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (char) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char] as string))

type Tokens = {
  surface: string
  raised: string
  ink: string
  muted: string
  accent: string
  onAccent: string
  base: number
  radius: number
  steps: number[]
  bodyFont: string
  displayFont: string
  measureCh: number
  sectionPad: number
  /** Padding inside cards and panels, scaled to the target's measured density. */
  cardPad: number
  /** Horizontal section padding, also density-scaled — see the note in resolveTokens. */
  gutter: number
  gap: number
}

/**
 * Resolve a profile into the concrete values a page needs.
 *
 * Every fallback here is a deliberate, plain default rather than an invented
 * measurement — a page generated from a thin profile should look unremarkable,
 * not confidently wrong.
 */
export function resolveTokens(profile: FroamPageProfile): Tokens {
  const hexFor = (role: string) => profile.color.palette.find((entry) => entry.role === role)?.hex
  const dark = profile.color.modeSignal === 'dark'
  const steps = profile.type.scale.map((step) => step.px).filter((px) => px >= 10)
  const base = profile.space.base > 0 ? profile.space.base : 8
  // Section padding is taken from the upper end of the observed spacing scale,
  // snapped to the base, because that is where layout spacing actually lives.
  const large = profile.space.scale.filter((value) => value >= base * 2)
  const sectionPad = Math.round((large[large.length - 1] ?? base * 6) / base) * base
  return {
    surface: hexFor('surface') ?? (dark ? '#111111' : '#ffffff'),
    raised: hexFor('raised') ?? (dark ? '#1c1c1c' : '#f7f7f7'),
    ink: hexFor('ink') ?? (dark ? '#f2f2f2' : '#111111'),
    muted: hexFor('muted') ?? (dark ? '#a0a0a0' : '#5f5f5f'),
    accent: hexFor('accent') ?? '#3366cc',
    onAccent: dark ? '#111111' : '#ffffff',
    base,
    radius: profile.surface.radii[0] ?? 0,
    steps: steps.length >= 3 ? steps : [16, 20, 25, 31],
    bodyFont: profile.type.families.find((family) => family.role === 'body')?.stack
      ?? profile.type.families[0]?.stack ?? 'system-ui, sans-serif',
    displayFont: profile.type.families.find((family) => family.role === 'display')?.stack
      ?? profile.type.families[0]?.stack ?? 'system-ui, sans-serif',
    measureCh: profile.type.measureCh >= 30 && profile.type.measureCh <= 110 ? profile.type.measureCh : 66,
    sectionPad: Math.max(base * 2, Math.min(sectionPad, base * 12)),
    // Density is measured from container padding, so a generated page has to
    // carry the target's density in its containers or it reports 'balanced'
    // whatever the target was. This was the largest remaining round-trip gap.
    cardPad: profile.space.density === 'airy' ? base * 12 : profile.space.density === 'tight' ? base * 2 : base * 4,
    // Horizontal padding was a hardcoded base * 4 on every section, so half of
    // every container's contributed padding ignored the target entirely and the
    // median pinned to 'balanced' no matter what was measured. Density is a
    // median over container padding; a constant in that set is a constant vote.
    gutter: profile.space.density === 'airy' ? base * 8 : profile.space.density === 'tight' ? base * 2 : base * 4,
    gap: Math.max(base * 2, Math.round((profile.space.sectionGapPx[0] ?? base * 3) / base) * base),
  }
}

const stepAt = (steps: number[], fromTop: number) => steps[Math.max(0, steps.length - 1 - fromTop)] ?? steps[0]

/**
 * A grey placeholder that reads as media to the scanner.
 *
 * Round-tripping the generator exposed why this matters: proof strips and
 * testimonial avatars were emitted as plain `<div>`s with a background colour,
 * which carry no media role, so `proof` came back as `unknown` and
 * `testimonial` came back as `feature-grid` every single time. Real logo strips
 * and avatars are images; emitting an `<svg>` is both more honest and what makes
 * the section legible to the same pipeline that measured it.
 */
const mediaBlock = (width: string, height: string, fill: string, radius: number) =>
  `<svg width="${width}" height="${height}" viewBox="0 0 100 40" role="img" aria-label="placeholder" ` +
  `style="display:block;border-radius:${radius}px"><rect width="100" height="40" fill="${fill}" opacity="0.45"/></svg>`

function section(archetype: FroamSectionArchetype, tokens: Tokens, index: number, columns: number, seed: number): string {
  const h1 = stepAt(tokens.steps, 0)
  const h2 = stepAt(tokens.steps, 1)
  const h3 = stepAt(tokens.steps, 2)
  const body = tokens.steps.find((px) => px >= 14 && px <= 19) ?? tokens.steps[0]
  // Use more of the measured scale than four sizes. A generated page that only
  // ever emits h1/h2/h3/body reports three type steps against a target's twelve,
  // and the count mismatch dominated the distance. Eyebrows, captions and small
  // print are where a real scale's middle lives.
  const small = tokens.steps.find((px) => px >= 12 && px < 14) ?? body
  const lead = tokens.steps.find((px) => px > body && px < h3) ?? body
  const pad = tokens.sectionPad
  const card = (inner: string) =>
    `<div class="card" style="background:${tokens.raised};padding:${tokens.cardPad}px;border-radius:${tokens.radius}px">${inner}</div>`
  // A <button> carries its role by tag. An <a> only registers as an action when
  // its copy happens to match scan.ts's buy/start/join heuristic, which is why
  // every generated cta section came back as 'content'.
  const button = (label: string) =>
    `<button type="button" style="display:inline-block;background:${tokens.accent};color:${tokens.onAccent};border:0;` +
    `padding:${tokens.base * 2}px ${tokens.base * 3}px;border-radius:${tokens.radius}px;font-size:${body}px;font-weight:600;cursor:pointer">${escapeHtml(label)}</button>`
  const eyebrow = (text: string) =>
    `<p style="font-size:${small}px;line-height:1.4;color:${tokens.muted};margin:0 0 ${tokens.base}px;text-transform:uppercase;letter-spacing:.08em">${escapeHtml(text)}</p>`
  const heading = (level: 1 | 2 | 3, size: number, text: string) =>
    `<h${level} style="font-family:${tokens.displayFont};font-size:${size}px;line-height:1.2;color:${tokens.ink};margin:0 0 ${tokens.base * 2}px">${escapeHtml(text)}</h${level}>`
  const paragraph = (words: number, colour = tokens.muted) =>
    `<p style="font-size:${body}px;line-height:1.6;color:${colour};max-width:${tokens.measureCh}ch;margin:0 0 ${tokens.base * 2}px">${escapeHtml(filler(words, seed + index))}</p>`
  const grid = (count: number, cols: number, inner: (position: number) => string) =>
    `<div class="grid" style="display:grid;grid-template-columns:repeat(${cols},1fr);gap:${tokens.base * 3}px">` +
    Array.from({ length: count }, (_, position) => inner(position)).join('') + '</div>'

  const open = (extra = '') => `<section style="padding:${pad}px ${tokens.gutter}px;${extra}">`
  const close = '</section>'

  switch (archetype) {
    case 'hero':
      return open() + eyebrow(filler(2, seed + 9)) + heading(1, h1, filler(6, seed))
        + `<p style="font-size:${lead}px;line-height:1.5;color:${tokens.muted};max-width:${tokens.measureCh}ch;margin:0 0 ${tokens.base * 3}px">${escapeHtml(filler(22, seed))}</p>`
        + button('Get started') + close
    case 'feature-grid':
      return open() + heading(2, h2, filler(4, seed + 1))
        + grid(Math.max(3, columns), Math.max(2, Math.min(columns, 4)), (position) =>
          card(heading(3, h3, filler(3, seed + position)) + paragraph(16))) + close
    case 'pricing':
      return open() + heading(2, h2, filler(3, seed + 2))
        + grid(3, 3, (position) => card(
          heading(3, h3, filler(2, seed + position))
          + `<p style="font-size:${h2}px;color:${tokens.ink};margin:0 0 ${tokens.base * 2}px">$${(position + 1) * 12}/mo</p>`
          + paragraph(12) + button('Choose plan'))) + close
    case 'testimonial':
      return open() + grid(3, 3, (position) => card(
        `<div style="margin-bottom:${tokens.base * 2}px">` + mediaBlock(`${tokens.base * 6}px`, `${tokens.base * 6}px`, tokens.muted, 999) + `</div>`
        + paragraph(20, tokens.ink) + eyebrow(filler(2, seed + position)))) + close
    case 'proof':
      return open() + `<div style="display:flex;gap:${tokens.base * 5}px;align-items:center;justify-content:center;flex-wrap:wrap">`
        + Array.from({ length: 5 }, () => mediaBlock(`${tokens.base * 14}px`, `${tokens.base * 4}px`, tokens.muted, tokens.radius)).join('')
        + '</div>' + close
    case 'split':
      return open() + grid(2, 2, (position) => `<div style="min-height:${tokens.base * 36}px">` + (position === 0
        ? heading(2, h2, filler(4, seed + 3)) + paragraph(26)
        : mediaBlock('100%', `${tokens.base * 36}px`, tokens.raised, tokens.radius)) + '</div>') + close
    case 'faq':
      return open() + heading(2, h2, filler(3, seed + 4))
        + Array.from({ length: 4 }, (_, position) =>
          `<details style="border-top:1px solid ${tokens.muted};padding:${tokens.base * 2}px 0">`
          + `<summary style="font-size:${body}px;color:${tokens.ink};cursor:pointer">${escapeHtml(filler(5, seed + position))}</summary>`
          + paragraph(18) + '</details>').join('') + close
    case 'cta':
      return open(`background:${tokens.raised}`) + heading(2, h2, filler(4, seed + 5)) + paragraph(14) + button('Talk to us') + close
    case 'footer':
      return `<footer style="padding:${pad}px ${tokens.gutter}px;background:${tokens.raised}">`
        + grid(4, 4, (position) => `<div>${heading(3, body, filler(2, seed + position))}`
          + Array.from({ length: 4 }, (_, link) =>
            `<a href="#" style="display:block;padding:${tokens.base}px 0;font-size:${body}px;color:${tokens.muted};text-decoration:none">${escapeHtml(filler(2, seed + position + link))}</a>`).join('')
          + '</div>') + '</footer>'
    case 'content':
    default:
      return open() + heading(2, h2, filler(4, seed + index)) + paragraph(34) + close
  }
}

/**
 * Emit a self-contained page built on a profile's design system.
 *
 * Deliberately inline-styled and dependency-free: the output has to be
 * scannable by the same pipeline that produced the profile, and a build step
 * between generation and measurement is a place for the two to disagree.
 */
export function generatePageFromProfile(profile: FroamPageProfile, options: FroamGenerateOptions = {}): string {
  const tokens = resolveTokens(profile)
  const seed = options.seed ?? 1
  const flow = options.flow ?? profile.flow.sections.map((item) => item.archetype)
  const columnsFor = (index: number) => profile.flow.sections[index]?.grid.columns ?? 3
  const sections = (flow.length ? flow : (['hero', 'feature-grid', 'content', 'cta', 'footer'] as FroamSectionArchetype[]))
    .map((archetype, index) => section(archetype, tokens, index, columnsFor(index), seed))
    .join('\n')

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(options.title ?? 'Generated page')}</title>
<style>
  *{box-sizing:border-box}
  body{margin:0;background:${tokens.surface};color:${tokens.ink};font-family:${tokens.bodyFont};-webkit-font-smoothing:antialiased}
  main{display:block}
  main > section{max-width:none}
</style></head>
<body><main>
${sections}
</main></body></html>`
}
