/* ===============================================================
   FROAM STUDIO — FONT SOURCES
   The editor's font picker offers families the host site may not
   ship. This module knows where each family lives (Google Fonts /
   Fontshare) so the design's fonts ACTUALLY load everywhere the
   design is applied: editor preview, React runtime, and codegen
   (@import in froam.generated.css).

   KEEP IN SYNC with the mirror map in lib/codegen.mjs — codegen is
   plain .mjs shared by the CLI and can't import TS.
   =============================================================== */

/**
 * Google Fonts families with the weights that exist for each.
 *
 * A weight that does not exist makes the whole css2 request fail, so only
 * add a family with weights you have confirmed. Grouped by the job the face
 * does — the picker reads FONT_CATALOG below for that, but keeping the
 * groups visible here stops the list drifting back into nine versions of
 * the same geometric sans.
 *
 * KEEP IN SYNC with the mirror in lib/codegen.mjs — production @import
 * lines come from that copy, so a family missing there loads in the editor
 * and then silently falls back to Times on the deployed site.
 */
export const GOOGLE_FONTS: Record<string, string> = {
  /* Geometric & neo-grotesque sans */
  Inter: '400;500;600;700;800;900',
  Manrope: '400;500;600;700;800',
  'DM Sans': '400;500;700',
  'Plus Jakarta Sans': '400;500;600;700;800',
  'Space Grotesk': '400;500;600;700',
  Urbanist: '400;500;600;700;800;900',
  Outfit: '400;500;600;700;800;900',
  Poppins: '400;500;600;700;800;900',
  Montserrat: '400;500;600;700;800;900',
  Archivo: '100;200;300;400;500;600;700;800;900',
  'Libre Franklin': '100;200;300;400;500;600;700;800;900',

  /* Humanist sans — for long text and interfaces that need warmth */
  'Source Sans 3': '200;300;400;500;600;700;800;900',
  'Public Sans': '100;200;300;400;500;600;700;800;900',
  Figtree: '300;400;500;600;700;800;900',

  /* Condensed — dense UI, editorial decks, posters */
  'Archivo Narrow': '400;500;600;700',
  Oswald: '200;300;400;500;600;700',
  'Barlow Condensed': '200;300;400;500;600;700;800;900',

  /* Display — headlines with an actual voice */
  'Bricolage Grotesque': '200;300;400;500;600;700;800',
  Syne: '400;500;600;700;800',
  Anton: '400',
  'Bebas Neue': '400',
  'Archivo Black': '400',
  'Instrument Serif': '400',

  /* Serif */
  'Playfair Display': '400;500;600;700;800;900',
  'Cormorant Garamond': '400;500;600;700',
  Lora: '400;500;600;700',
  Merriweather: '400;700;900',
  Fraunces: '400;500;600;700;800;900',
  Newsreader: '200;300;400;500;600;700;800',
  'Source Serif 4': '200;300;400;500;600;700;800;900',
  Spectral: '200;300;400;500;600;700;800',
  'EB Garamond': '400;500;600;700;800',

  /* Slab */
  'Roboto Slab': '100;200;300;400;500;600;700;800;900',
  'Zilla Slab': '300;400;500;600;700',

  /* Mono */
  'JetBrains Mono': '400;500;600;700;800',
  'IBM Plex Mono': '400;500;600;700',
  'Space Mono': '400;700',
  'Fira Code': '300;400;500;600;700',
  'DM Mono': '300;400;500',

  /* Hand */
  Caveat: '400;500;600;700',
}

/** Fontshare families (free ITF fonts) with their available weights. */
export const FONTSHARE_FONTS: Record<string, string> = {
  Satoshi: 'satoshi@400,500,700,900',
  'Cabinet Grotesk': 'cabinet-grotesk@400,500,700,800',
}

/* ── catalog ───────────────────────────────────────────────────
   Picker metadata. An alphabetical list of forty families is not a
   font picker — a designer chooses by the job the face has to do,
   so every family carries its role, a plain note about when to
   reach for it, and what it sits well with.

   UI-only: codegen never reads this, so it stays out of the mjs
   mirror. Families here must exist in GOOGLE_FONTS or
   FONTSHARE_FONTS above, which `npm test` checks.
   ─────────────────────────────────────────────────────────────── */

export type FontRole = 'display' | 'sans' | 'humanist' | 'condensed' | 'serif' | 'slab' | 'mono' | 'hand'

export const FONT_ROLE_LABELS: Record<FontRole, string> = {
  display: 'Display — headlines with a voice',
  sans: 'Sans — neutral workhorses',
  humanist: 'Humanist — warmer text faces',
  condensed: 'Condensed — tight, dense, editorial',
  serif: 'Serif — editorial and classical',
  slab: 'Slab — sturdy, mechanical',
  mono: 'Mono — code, data, labels',
  hand: 'Hand — informal accents',
}

export interface FontCatalogEntry {
  family: string
  role: FontRole
  /** When to reach for it, in a designer's terms — not a history lesson. */
  note: string
  /** Families that hold up beside it. */
  pairsWith?: string[]
}

export const FONT_CATALOG: readonly FontCatalogEntry[] = [
  /* Display */
  { family: 'Bricolage Grotesque', role: 'display', note: 'Odd widths and a bit of wonk. Carries a brand on its own.', pairsWith: ['Source Sans 3', 'Public Sans'] },
  { family: 'Syne', role: 'display', note: 'Wide, technical, art-book. Best very large and sparing.', pairsWith: ['Inter', 'DM Mono'] },
  { family: 'Instrument Serif', role: 'display', note: 'High-contrast editorial headline. Elegant without going bridal.', pairsWith: ['Figtree', 'Archivo'] },
  { family: 'Anton', role: 'display', note: 'One heavy condensed weight. Poster shouting.', pairsWith: ['Public Sans', 'Archivo Narrow'] },
  { family: 'Bebas Neue', role: 'display', note: 'Condensed caps. Tickets, sport, packaging.', pairsWith: ['Source Sans 3'] },
  { family: 'Archivo Black', role: 'display', note: 'Blunt grotesque weight for a single loud line.', pairsWith: ['Archivo', 'Spectral'] },

  /* Sans */
  { family: 'Inter', role: 'sans', note: 'The safe default. Reads well at every size, says nothing.', pairsWith: ['Newsreader', 'JetBrains Mono'] },
  { family: 'Archivo', role: 'sans', note: 'Grotesque with more grip than Inter. Good at heavy weights.', pairsWith: ['Instrument Serif', 'Roboto Slab'] },
  { family: 'Libre Franklin', role: 'sans', note: 'Franklin Gothic lineage — American, editorial, sturdy.', pairsWith: ['Spectral', 'EB Garamond'] },
  { family: 'Manrope', role: 'sans', note: 'Soft geometric. Friendly product UI.', pairsWith: ['Lora'] },
  { family: 'DM Sans', role: 'sans', note: 'Low-contrast geometric, tidy at small sizes.', pairsWith: ['DM Mono'] },
  { family: 'Plus Jakarta Sans', role: 'sans', note: 'Rounded geometric with a touch of character.', pairsWith: ['Newsreader'] },
  { family: 'Space Grotesk', role: 'sans', note: 'Quirky mono-derived shapes. Reads technical.', pairsWith: ['Space Mono'] },
  { family: 'Urbanist', role: 'sans', note: 'Very round geometric. Light weights go elegant.', pairsWith: ['Fraunces'] },
  { family: 'Outfit', role: 'sans', note: 'Even geometric with a clean bowl. Logo-friendly.', pairsWith: ['Source Serif 4'] },
  { family: 'Poppins', role: 'sans', note: 'Circular geometric. Everywhere — use knowingly.', pairsWith: ['Lora'] },
  { family: 'Montserrat', role: 'sans', note: 'Urban-signage geometric. Wide caps.', pairsWith: ['Merriweather'] },
  { family: 'Satoshi', role: 'sans', note: 'Contemporary neo-grotesque, crisp at display sizes.', pairsWith: ['Newsreader'] },
  { family: 'Cabinet Grotesk', role: 'sans', note: 'Slightly condensed grotesque with sharp joints.', pairsWith: ['Spectral'] },

  /* Humanist */
  { family: 'Source Sans 3', role: 'humanist', note: 'Calm, legible, disappears into long text.', pairsWith: ['Source Serif 4', 'Bricolage Grotesque'] },
  { family: 'Public Sans', role: 'humanist', note: 'Neutral and accessible — built for public services.', pairsWith: ['Anton', 'Newsreader'] },
  { family: 'Figtree', role: 'humanist', note: 'Warm and approachable without going childish.', pairsWith: ['Instrument Serif'] },

  /* Condensed */
  { family: 'Archivo Narrow', role: 'condensed', note: 'Fits more per line without feeling squeezed.', pairsWith: ['Archivo'] },
  { family: 'Oswald', role: 'condensed', note: 'Tall condensed gothic. Navigation, stats, decks.', pairsWith: ['Source Sans 3'] },
  { family: 'Barlow Condensed', role: 'condensed', note: 'Low-contrast condensed, wide weight range.', pairsWith: ['Barlow Condensed'] },

  /* Serif */
  { family: 'Newsreader', role: 'serif', note: 'Made for reading on screen. Strong body serif.', pairsWith: ['Inter', 'Public Sans'] },
  { family: 'Source Serif 4', role: 'serif', note: 'Even colour, quiet, holds a long article.', pairsWith: ['Source Sans 3'] },
  { family: 'Spectral', role: 'serif', note: 'Screen-first with visible contrast. Editorial.', pairsWith: ['Libre Franklin'] },
  { family: 'EB Garamond', role: 'serif', note: 'Classical old-style. Books, essays, restraint.', pairsWith: ['Libre Franklin'] },
  { family: 'Playfair Display', role: 'serif', note: 'High contrast, headline only — never body.', pairsWith: ['Source Sans 3'] },
  { family: 'Cormorant Garamond', role: 'serif', note: 'Delicate and fine. Needs size and space.', pairsWith: ['Montserrat'] },
  { family: 'Lora', role: 'serif', note: 'Brushed contrast, comfortable at body size.', pairsWith: ['Manrope'] },
  { family: 'Merriweather', role: 'serif', note: 'Large x-height, very sturdy on screen.', pairsWith: ['Montserrat'] },
  { family: 'Fraunces', role: 'serif', note: 'Soft old-style with wonk. Playful and premium.', pairsWith: ['Urbanist'] },

  /* Slab */
  { family: 'Roboto Slab', role: 'slab', note: 'Geometric slab. Mechanical, dependable headings.', pairsWith: ['Archivo'] },
  { family: 'Zilla Slab', role: 'slab', note: 'Angular slab with personality at mid weights.', pairsWith: ['Public Sans'] },

  /* Mono */
  { family: 'JetBrains Mono', role: 'mono', note: 'Tall x-height, built for reading code.', pairsWith: ['Inter'] },
  { family: 'IBM Plex Mono', role: 'mono', note: 'Warmer mono with real character.', pairsWith: ['Source Sans 3'] },
  { family: 'Space Mono', role: 'mono', note: 'Quirky and retro. Labels, not paragraphs.', pairsWith: ['Space Grotesk'] },
  { family: 'Fira Code', role: 'mono', note: 'Programming ligatures. Code blocks.', pairsWith: ['Inter'] },
  { family: 'DM Mono', role: 'mono', note: 'Low-contrast mono. Understated captions and data.', pairsWith: ['DM Sans'] },

  /* Hand */
  { family: 'Caveat', role: 'hand', note: 'Marker handwriting. Annotations and margin notes.', pairsWith: ['Inter'] },
]

/** Catalog entries for one role, in catalog order. */
export function fontsByRole(role: FontRole): FontCatalogEntry[] {
  return FONT_CATALOG.filter((entry) => entry.role === role)
}

/** Fallbacks that match the shape of the face, so a slow load degrades sensibly. */
const ROLE_FALLBACK: Record<FontRole, string> = {
  display: 'system-ui, sans-serif',
  sans: 'system-ui, sans-serif',
  humanist: 'system-ui, sans-serif',
  condensed: 'system-ui, sans-serif',
  serif: 'Georgia, serif',
  slab: 'Georgia, serif',
  mono: 'ui-monospace, monospace',
  hand: 'cursive',
}

/** Genuine system stacks — no download, and honest about where they exist. */
const SYSTEM_FONTS: readonly { label: string; value: string }[] = [
  { label: 'System UI', value: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif' },
  { label: 'System Serif', value: 'Georgia, "Times New Roman", serif' },
  { label: 'System Mono', value: 'ui-monospace, "Cascadia Mono", Consolas, monospace' },
]

/** A family name needs quoting in a CSS stack when it isn't a single word. */
function quoteFamily(family: string): string {
  return /^[A-Za-z][A-Za-z0-9]*$/.test(family) ? family : `"${family}"`
}

export interface FontOption {
  label: string
  value: string
  role: FontRole | 'brand' | 'system'
}

/**
 * The font picker's list, derived from the catalog rather than hand-kept.
 *
 * A hardcoded picker drifts: it ends up offering faces that are in no font
 * source at all, which load nowhere and silently fall back — the control
 * says one thing and the page renders another. Deriving it means the picker
 * can only ever offer families the editor and codegen can both load, and
 * brand fonts appear the moment they are added.
 */
export function fontOptionsFor(brandFonts?: readonly BrandFont[] | null): FontOption[] {
  const options: FontOption[] = []
  for (const family of brandFontFamilies(brandFonts)) {
    options.push({ label: `${family} (brand)`, value: `${quoteFamily(family)}, system-ui, sans-serif`, role: 'brand' })
  }
  for (const entry of FONT_CATALOG) {
    options.push({
      label: entry.family,
      value: `${quoteFamily(entry.family)}, ${ROLE_FALLBACK[entry.role]}`,
      role: entry.role,
    })
  }
  for (const system of SYSTEM_FONTS) options.push({ ...system, role: 'system' })
  return options
}

export type FontOptionGroup = FontOption['role']

/** Group order in the picker: the client's own font first, then loudest to quietest. */
const FONT_GROUP_ORDER: readonly FontOptionGroup[] = [
  'brand', 'display', 'sans', 'humanist', 'condensed', 'serif', 'slab', 'mono', 'hand', 'system',
]

export const FONT_GROUP_LABELS: Record<FontOptionGroup, string> = {
  brand: 'Brand',
  display: 'Display',
  sans: 'Sans',
  humanist: 'Humanist',
  condensed: 'Condensed',
  serif: 'Serif',
  slab: 'Slab',
  mono: 'Mono',
  hand: 'Hand',
  system: 'System',
}

/** Options bucketed by role, in FONT_GROUP_ORDER, skipping empty groups. */
export function groupFontOptions(options: readonly FontOption[]): [FontOptionGroup, FontOption[]][] {
  const groups: [FontOptionGroup, FontOption[]][] = []
  for (const role of FONT_GROUP_ORDER) {
    const matching = options.filter((option) => option.role === role)
    if (matching.length) groups.push([role, matching])
  }
  return groups
}

/** Keep only brand fonts that can compile. Mirrors sanitizeBrandFonts in lib/codegen.mjs. */
export function sanitizeBrandFonts(value: unknown): BrandFont[] {
  if (!Array.isArray(value)) return []
  const clean: BrandFont[] = []
  for (const font of value) {
    const family = typeof font?.family === 'string' ? font.family.trim() : ''
    if (!family) continue
    const faces: BrandFontFace[] = []
    for (const face of Array.isArray(font.faces) ? font.faces : []) {
      if (!isSafeFontSrc(face?.src)) continue
      const kept: BrandFontFace = { src: face.src }
      if (face.weight !== undefined) kept.weight = face.weight
      if (face.style === 'italic') kept.style = 'italic'
      if (BRAND_FONT_FORMATS.has(face.format)) kept.format = face.format
      faces.push(kept)
    }
    if (faces.length) clean.push({ family, faces })
  }
  return clean
}

/* ── brand fonts ───────────────────────────────────────────────
   A designer on client work needs the client's licensed typeface,
   which is neither on Google Fonts nor Fontshare. Brand fonts are
   carried in the design itself — as a data: URI for an uploaded
   file, or an https: URL for a self-hosted one — so the face
   survives Save to Repo instead of only existing in the editor.

   Everything here is mirrored in lib/codegen.mjs. Both sides feed
   untrusted strings into generated CSS that ships to production,
   so validation lives with the generator, not the caller.
   ─────────────────────────────────────────────────────────────── */

export type BrandFontFormat = 'woff2' | 'woff' | 'truetype' | 'opentype'

export interface BrandFontFace {
  /** 400, or a variable range like '400 700'. Defaults to 400. */
  weight?: number | string
  style?: 'normal' | 'italic'
  /** data:font/…;base64,… or an https: URL. Anything else is dropped. */
  src: string
  format?: BrandFontFormat
}

export interface BrandFont {
  family: string
  faces: BrandFontFace[]
}

const BRAND_FONT_FORMATS = new Set<string>(['woff2', 'woff', 'truetype', 'opentype'])

const FORMAT_BY_EXTENSION: Record<string, BrandFontFormat> = {
  woff2: 'woff2',
  woff: 'woff',
  ttf: 'truetype',
  otf: 'opentype',
}

/**
 * A font `src` lands verbatim inside a generated CSS rule, so only two
 * shapes are ever allowed through: a base64 font data URI, or an https
 * URL. http: is refused too — it would break the page on any site served
 * over TLS.
 */
export function isSafeFontSrc(src: unknown): src is string {
  if (typeof src !== 'string' || !src) return false
  if (/^data:/i.test(src)) {
    return /^data:(?:font|application)\/[a-z0-9.+-]+;base64,[A-Za-z0-9+/=]+$/i.test(src.replace(/\s+/g, ''))
  }
  try {
    return new URL(src).protocol === 'https:'
  } catch {
    return false
  }
}

/** Escape a value for use inside a double-quoted CSS string. */
function cssString(value: unknown): string {
  return String(value).replace(/[\\"]/g, '\\$&').replace(/[\r\n]/g, '')
}

function inferFormat(src: string): BrandFontFormat | null {
  const dataMatch = /^data:(?:font|application)\/([a-z0-9.+-]+);/i.exec(src)
  if (dataMatch) return FORMAT_BY_EXTENSION[dataMatch[1].toLowerCase().replace(/^x-font-/, '')] ?? null
  const extMatch = /\.([a-z0-9]+)(?:[?#]|$)/i.exec(src)
  return extMatch ? FORMAT_BY_EXTENSION[extMatch[1].toLowerCase()] ?? null : null
}

/** 400 | '400' | '400 700' (variable range) → a valid font-weight, else 400. */
function normalizeWeight(weight: unknown): string {
  if (typeof weight === 'number' && Number.isFinite(weight)) {
    return String(Math.min(1000, Math.max(1, Math.round(weight))))
  }
  if (typeof weight === 'string') {
    const parts = weight.trim().split(/\s+/)
    if (parts.length <= 2 && parts.every((part) => /^\d{1,4}$/.test(part))) {
      const clamped = parts.map((part) => String(Math.min(1000, Math.max(1, Number(part)))))
      return clamped.join(' ')
    }
  }
  return '400'
}

/**
 * @font-face blocks for every valid face, as CSS lines. Faces with an
 * unusable src or an empty family are skipped rather than emitted
 * broken — generated CSS should never contain a rule that can't parse.
 */
export function brandFontFaceCss(brandFonts: readonly BrandFont[] | null | undefined): string[] {
  const lines: string[] = []
  for (const font of brandFonts ?? []) {
    const family = typeof font?.family === 'string' ? font.family.trim() : ''
    if (!family) continue
    for (const face of font.faces ?? []) {
      if (!isSafeFontSrc(face?.src)) continue
      const format =
        face.format && BRAND_FONT_FORMATS.has(face.format) ? face.format : inferFormat(face.src)
      const source = format
        ? `url("${cssString(face.src)}") format("${format}")`
        : `url("${cssString(face.src)}")`
      lines.push(
        '@font-face {',
        `  font-family: "${cssString(family)}";`,
        `  src: ${source};`,
        `  font-weight: ${normalizeWeight(face.weight)};`,
        `  font-style: ${face.style === 'italic' ? 'italic' : 'normal'};`,
        '  font-display: swap;',
        '}',
      )
    }
  }
  return lines
}

/** Family names the design defines itself — these must never be fetched remotely. */
export function brandFontFamilies(brandFonts: readonly BrandFont[] | null | undefined): string[] {
  const families = new Set<string>()
  for (const font of brandFonts ?? []) {
    const family = typeof font?.family === 'string' ? font.family.trim() : ''
    if (family && (font.faces ?? []).some((face) => isSafeFontSrc(face?.src))) families.add(family)
  }
  return [...families]
}

/**
 * Idempotently sync the <style data-froam-brand-fonts> block so the editor
 * previews brand faces exactly as production will render them. Mirrors
 * ensureFontLinks: only touches the DOM when the CSS actually differs.
 */
export function ensureBrandFontStyle(brandFonts: readonly BrandFont[] | null | undefined): void {
  if (typeof document === 'undefined') return
  const css = brandFontFaceCss(brandFonts).join('\n')
  const existing = document.head.querySelector<HTMLStyleElement>('style[data-froam-brand-fonts]')
  if (!css) {
    existing?.remove()
    return
  }
  if (existing) {
    if (existing.textContent !== css) existing.textContent = css
    return
  }
  const style = document.createElement('style')
  style.setAttribute('data-froam-brand-fonts', 'true')
  style.textContent = css
  document.head.appendChild(style)
}

/** First family name out of a CSS font-family value, unquoted. */
export function primaryFamily(fontFamilyValue: string | undefined): string | null {
  if (!fontFamilyValue) return null
  const first = fontFamilyValue.split(',')[0]?.trim().replace(/^["']|["']$/g, '')
  return first || null
}

/**
 * Stylesheet URLs that load the given families (unknown/system
 * families are skipped — they need no loading). Stable order so
 * callers can diff by URL.
 */
export function fontStylesheetUrls(families: Iterable<string | null | undefined>): string[] {
  const google: string[] = []
  const fontshare: string[] = []
  const seen = new Set<string>()
  for (const family of families) {
    if (!family || seen.has(family)) continue
    seen.add(family)
    if (GOOGLE_FONTS[family]) {
      google.push(`family=${encodeURIComponent(family).replace(/%20/g, '+')}:wght@${GOOGLE_FONTS[family]}`)
    } else if (FONTSHARE_FONTS[family]) {
      fontshare.push(`f[]=${FONTSHARE_FONTS[family]}`)
    }
  }
  const urls: string[] = []
  if (google.length) urls.push(`https://fonts.googleapis.com/css2?${google.sort().join('&')}&display=swap`)
  if (fontshare.length) urls.push(`https://api.fontshare.com/v2/css?${fontshare.sort().join('&')}&display=swap`)
  return urls
}

/** Pull every font-family a draft store references (styles + injected HTML). */
export function collectStoreFontFamilies(
  store: Record<string, { text?: string; styles?: Record<string, string> } | undefined> | null | undefined,
): string[] {
  const families = new Set<string>()
  for (const [path, draft] of Object.entries(store ?? {})) {
    if (!draft) continue
    const fromStyle = primaryFamily(draft.styles?.fontFamily)
    if (fromStyle) families.add(fromStyle)
    // Injected blocks carry inline styles inside their HTML payload,
    // with quotes encoded as entities — decode before scanning.
    if (path.startsWith('__froam_injection__:') && draft.text) {
      const text = draft.text.replace(/&quot;|&#0?34;/g, '"').replace(/&#0?39;|&apos;/g, "'")
      for (const match of text.matchAll(/font-family:\s*([^;}<]+)/gi)) {
        const family = primaryFamily(match[1])
        if (family) families.add(family)
      }
    }
  }
  return [...families]
}

/**
 * Idempotently sync <link data-froam-fonts> tags in <head> so exactly
 * the given stylesheet URLs are loaded. Safe to call on every store
 * change — it only touches the DOM when the URL set actually differs.
 */
export function ensureFontLinks(families: Iterable<string | null | undefined>): void {
  if (typeof document === 'undefined') return
  const wanted = fontStylesheetUrls(families)
  const existing = document.head.querySelectorAll<HTMLLinkElement>('link[data-froam-fonts]')
  const current = new Set<string>()
  existing.forEach((link) => {
    if (wanted.includes(link.href) || wanted.includes(link.getAttribute('href') ?? '')) {
      current.add(link.getAttribute('href') ?? link.href)
    } else {
      link.remove()
    }
  })
  for (const url of wanted) {
    if (current.has(url)) continue
    const link = document.createElement('link')
    link.rel = 'stylesheet'
    link.href = url
    link.setAttribute('data-froam-fonts', 'true')
    document.head.appendChild(link)
  }
}
