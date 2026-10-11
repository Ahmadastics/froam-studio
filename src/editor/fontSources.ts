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
  /* Display */
  'Bricolage Grotesque': '200;300;400;500;600;700;800',
  Syne: '400;500;600;700;800',
  'Instrument Serif': '400',
  Anton: '400',
  'Bebas Neue': '400',
  'Archivo Black': '400',
  Unbounded: '200;300;400;500;600;700;800;900',
  'Funnel Display': '300;400;500;600;700;800',
  'Hubot Sans': '200;300;400;500;600;700;800;900',
  Gabarito: '400;500;600;700;800;900',
  'Climate Crisis': '400',
  Bungee: '400',
  Righteous: '400',
  'Tilt Warp': '400',
  'Rubik Mono One': '400',
  'Rubik Glitch': '400',
  'Abril Fatface': '400',
  'Bagel Fat One': '400',
  'Dela Gothic One': '400',
  'Black Han Sans': '400',
  'Do Hyeon': '400',
  'ZCOOL KuaiLe': '400',
  Lalezar: '400',
  'Reem Kufi': '400;500;600;700',
  'El Messiri': '400;500;600;700',
  Changa: '200;300;400;500;600;700;800',
  'Secular One': '400',
  'Baloo 2': '400;500;600;700;800',
  Shrikhand: '400',
  'Press Start 2P': '400',
  Silkscreen: '400;700',

  /* Sans */
  Inter: '400;500;600;700;800;900',
  Archivo: '100;200;300;400;500;600;700;800;900',
  'Libre Franklin': '100;200;300;400;500;600;700;800;900',
  Manrope: '400;500;600;700;800',
  'DM Sans': '400;500;700',
  'Plus Jakarta Sans': '400;500;600;700;800',
  'Space Grotesk': '400;500;600;700',
  Urbanist: '400;500;600;700;800;900',
  Outfit: '400;500;600;700;800;900',
  Poppins: '400;500;600;700;800;900',
  Montserrat: '400;500;600;700;800;900',
  Geist: '100;200;300;400;500;600;700;800;900',
  'Instrument Sans': '400;500;600;700',
  'Familjen Grotesk': '400;500;600;700',
  'Schibsted Grotesk': '400;500;600;700;800;900',
  'Hanken Grotesk': '100;200;300;400;500;600;700;800;900',
  'Red Hat Display': '300;400;500;600;700;800;900',
  Sora: '100;200;300;400;500;600;700;800',
  'Mona Sans': '200;300;400;500;600;700;800;900',
  'Host Grotesk': '300;400;500;600;700;800',
  'Funnel Sans': '300;400;500;600;700;800',
  Onest: '100;200;300;400;500;600;700;800;900',
  Chivo: '100;200;300;400;500;600;700;800;900',
  'Encode Sans': '100;200;300;400;500;600;700;800;900',
  'Work Sans': '100;200;300;400;500;600;700;800;900',
  Karla: '200;300;400;500;600;700;800',
  Rubik: '300;400;500;600;700;800;900',
  Jost: '100;200;300;400;500;600;700;800;900',
  Raleway: '100;200;300;400;500;600;700;800;900',
  Barlow: '100;200;300;400;500;600;700;800;900',
  'Josefin Sans': '100;200;300;400;500;600;700',
  'Be Vietnam Pro': '100;200;300;400;500;600;700;800;900',

  /* Humanist, rounded and world text faces */
  'Source Sans 3': '200;300;400;500;600;700;800;900',
  'Public Sans': '100;200;300;400;500;600;700;800;900',
  Figtree: '300;400;500;600;700;800;900',
  'Atkinson Hyperlegible Next': '200;300;400;500;600;700;800',
  Lexend: '100;200;300;400;500;600;700;800;900',
  Nunito: '200;300;400;500;600;700;800;900',
  Quicksand: '300;400;500;600;700',
  Comfortaa: '300;400;500;600;700',
  'Noto Sans': '100;200;300;400;500;600;700;800;900',
  'Golos Text': '400;500;600;700;800;900',
  'PT Sans': '400;700',
  Mukta: '200;300;400;500;600;700;800',
  Hind: '300;400;500;600;700',
  Catamaran: '100;200;300;400;500;600;700;800;900',
  'Hind Siliguri': '300;400;500;600;700',
  Heebo: '100;200;300;400;500;600;700;800;900',
  Assistant: '200;300;400;500;600;700;800',
  Cairo: '200;300;400;500;600;700;800;900',
  Tajawal: '200;300;400;500;700;800;900',
  'IBM Plex Sans Arabic': '100;200;300;400;500;600;700',
  'Noto Kufi Arabic': '100;200;300;400;500;600;700;800;900',
  Vazirmatn: '100;200;300;400;500;600;700;800;900',
  'Noto Sans JP': '400;500;700;900',
  'Zen Kaku Gothic New': '400;500;700;900',
  'Zen Maru Gothic': '400;500;700;900',
  'M PLUS 1': '400;500;700;900',
  'Noto Sans KR': '400;500;700;900',
  'Nanum Gothic': '400;700',
  'Gowun Dodum': '400',
  'Noto Sans SC': '400;500;700;900',
  'Noto Sans TC': '400;500;700;900',
  Sarabun: '100;200;300;400;500;600;700;800',
  Kanit: '100;200;300;400;500;600;700;800;900',
  Prompt: '100;200;300;400;500;600;700;800;900',
  'Noto Sans Devanagari': '100;200;300;400;500;600;700;800;900',
  'Noto Sans Bengali': '100;200;300;400;500;600;700;800;900',
  'Noto Sans Tamil': '100;200;300;400;500;600;700;800;900',
  'Noto Sans Gujarati': '100;200;300;400;500;600;700;800;900',
  'Noto Sans Ethiopic': '100;200;300;400;500;600;700;800;900',
  'Noto Sans Adlam': '400;500;600;700',
  'Noto Sans NKo Unjoined': '400;500;600;700',
  'Noto Sans Tifinagh': '400',
  'Noto Sans Georgian': '100;200;300;400;500;600;700;800;900',
  'Noto Sans Armenian': '100;200;300;400;500;600;700;800;900',

  /* Condensed */
  'Archivo Narrow': '400;500;600;700',
  Oswald: '200;300;400;500;600;700',
  'Barlow Condensed': '200;300;400;500;600;700;800;900',
  Rajdhani: '300;400;500;600;700',
  Teko: '300;400;500;600;700',
  'Fjalla One': '400',
  'League Gothic': '400',
  'Saira Condensed': '100;200;300;400;500;600;700;800;900',
  'Sofia Sans Condensed': '100;200;300;400;500;600;700;800;900',
  'Chakra Petch': '300;400;500;600;700',
  'Bai Jamjuree': '200;300;400;500;600;700',

  /* Serif */
  Newsreader: '200;300;400;500;600;700;800',
  'Source Serif 4': '200;300;400;500;600;700;800;900',
  Spectral: '200;300;400;500;600;700;800',
  'EB Garamond': '400;500;600;700;800',
  'Playfair Display': '400;500;600;700;800;900',
  'Cormorant Garamond': '400;500;600;700',
  Lora: '400;500;600;700',
  Merriweather: '400;700;900',
  Fraunces: '400;500;600;700;800;900',
  'DM Serif Display': '400',
  'Young Serif': '400',
  'Bodoni Moda': '400;500;600;700;800;900',
  Gloock: '400',
  Alegreya: '400;500;600;700;800;900',
  'Libre Baskerville': '400;500;600;700',
  'Libre Caslon Text': '400;700',
  Cormorant: '300;400;500;600;700',
  'Crimson Pro': '200;300;400;500;600;700;800;900',
  Literata: '200;300;400;500;600;700;800;900',
  Petrona: '100;200;300;400;500;600;700;800;900',
  Gelasio: '400;500;600;700',
  'PT Serif': '400;700',
  'GFS Didot': '400',
  'Yeseva One': '400',
  'Frank Ruhl Libre': '300;400;500;600;700;800;900',
  Amiri: '400;700',
  'Noto Naskh Arabic': '400;500;600;700',
  Martel: '200;300;400;600;700;800;900',
  'Tiro Devanagari Hindi': '400',
  'Rozha One': '400',
  'Noto Serif JP': '400;500;700;900',
  'Zen Old Mincho': '400;500;700;900',
  'Shippori Mincho': '400;500;700',
  'Kaisei Decol': '400;500;700',
  'Nanum Myeongjo': '400;700',
  'Gowun Batang': '400;700',
  'Noto Serif SC': '400;500;700;900',
  'ZCOOL XiaoWei': '400',
  'Abyssinica SIL': '400',
  'Noto Serif': '100;200;300;400;500;600;700;800;900',

  /* Slab */
  'Roboto Slab': '100;200;300;400;500;600;700;800;900',
  'Zilla Slab': '300;400;500;600;700',
  Bitter: '100;200;300;400;500;600;700;800;900',
  'Alfa Slab One': '400',

  /* Mono */
  'JetBrains Mono': '400;500;600;700;800',
  'IBM Plex Mono': '400;500;600;700',
  'Space Mono': '400;700',
  'Fira Code': '300;400;500;600;700',
  'DM Mono': '300;400;500',
  'Geist Mono': '100;200;300;400;500;600;700;800;900',
  'Red Hat Mono': '300;400;500;600;700',
  'Martian Mono': '100;200;300;400;500;600;700;800',
  'Victor Mono': '100;200;300;400;500;600;700',
  'Kode Mono': '400;500;600;700',
  'Sometype Mono': '400;500;600;700',
  VT323: '400',
  DotGothic16: '400',

  /* Hand and calligraphy */
  Caveat: '400;500;600;700',
  Kalam: '300;400;700',
  'Klee One': '400',
  'Yusei Magic': '400',
  'Nanum Pen Script': '400',
  Gaegu: '400;700',
  'Ma Shan Zheng': '400',
  'LXGW WenKai TC': '400;700',
  'Dancing Script': '400;500;600;700',
  Pacifico: '400',
  'Permanent Marker': '400',
  'Great Vibes': '400',
  Sacramento: '400',
  'Reenie Beanie': '400',
}

/** Fontshare families (free ITF fonts) with their available weights. */
export const FONTSHARE_FONTS: Record<string, string> = {
  Satoshi: 'satoshi@400,500,700,900',
  'Cabinet Grotesk': 'cabinet-grotesk@400,500,700,800',
  'General Sans': 'general-sans@200,300,400,500,600,700',
  Switzer: 'switzer@100,200,300,400,500,600,700,800,900',
  Supreme: 'supreme@100,200,300,400,500,700,800',
  'Clash Display': 'clash-display@200,300,400,500,600,700',
  'Clash Grotesk': 'clash-grotesk@200,300,400,500,600,700',
  Chillax: 'chillax@200,300,400,500,600,700',
  Panchang: 'panchang@200,300,400,500,600,700,800',
  Tanker: 'tanker@400',
  Gambetta: 'gambetta@300,400,500,600,700',
  Zodiak: 'zodiak@100,300,400,700,800,900',
  Sentient: 'sentient@200,300,400,500,700',
  Boska: 'boska@200,300,400,500,700,900',
  'Bespoke Serif': 'bespoke-serif@300,400,500,700,800',
  Melodrama: 'melodrama@300,400,500,600,700',
}

/* ── catalog ───────────────────────────────────────────────────
   Picker metadata. An alphabetical list of two hundred families is
   not a font picker — a designer chooses by the job the face has to
   do, so every family carries its role, a plain note about when to
   reach for it, and what it sits well with. World faces also carry
   where they were made and the writing systems they cover, so a
   site in Arabic, Hindi, Japanese or Amharic finds its type too.

   `scripts` comes from Google Fonts' own subset list for the family
   (never guessed); `origin` is only set where the foundry or
   designer's country is well documented.

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
  /** Country the foundry or designer works from, where well documented. */
  origin?: string
  /** The writing system the face was made for, when it isn't Latin. */
  script?: FontScript
  /** Every writing system it covers beyond Latin. */
  scripts?: FontScript[]
}

export type FontScript =
  | 'arabic' | 'hebrew' | 'devanagari' | 'bengali' | 'tamil' | 'gujarati'
  | 'japanese' | 'korean' | 'chinese' | 'thai' | 'vietnamese'
  | 'cyrillic' | 'greek' | 'ethiopic' | 'adlam' | 'nko' | 'tifinagh' | 'georgian' | 'armenian'

/** Picker filter order: the scripts with the most readers first. */
export const FONT_SCRIPT_ORDER: readonly FontScript[] = [
  'chinese', 'devanagari', 'arabic', 'bengali', 'japanese', 'cyrillic', 'korean', 'vietnamese', 'tamil', 'thai',
  'gujarati', 'hebrew', 'greek', 'ethiopic', 'georgian', 'armenian', 'adlam', 'nko', 'tifinagh',
]

export const FONT_SCRIPT_LABELS: Record<FontScript, string> = {
  arabic: 'Arabic', hebrew: 'Hebrew', devanagari: 'Devanagari', bengali: 'Bengali', tamil: 'Tamil', gujarati: 'Gujarati',
  japanese: 'Japanese', korean: 'Korean', chinese: 'Chinese', thai: 'Thai', vietnamese: 'Vietnamese',
  cyrillic: 'Cyrillic', greek: 'Greek', ethiopic: "Ge'ez (Ethiopic)", adlam: 'Adlam', nko: "N'Ko", tifinagh: 'Tifinagh',
  georgian: 'Georgian', armenian: 'Armenian',
}

/**
 * A few real characters per script, so the picker shows what a face does
 * in the writing system it was made for instead of only its Latin.
 */
export const FONT_SCRIPT_SAMPLES: Record<FontScript, string> = {
  arabic: 'خط عربي', hebrew: 'עברית', devanagari: 'देवनागरी', bengali: 'বাংলা', tamil: 'தமிழ்', gujarati: 'ગુજરાતી',
  japanese: 'あア日本語', korean: '한글 글꼴', chinese: '汉字书法', thai: 'ภาษาไทย', vietnamese: 'Tiếng Việt',
  cyrillic: 'Кириллица', greek: 'Ελληνικά', ethiopic: 'ግዕዝ ፊደል', adlam: '𞤀𞤣𞤤𞤢𞤥', nko: 'ߒߞߏ', tifinagh: 'ⵜⵉⴼⵉⵏⴰⵖ',
  georgian: 'ქართული', armenian: 'Հայերեն',
}

/** Catalog entry for a family, if Froam offers it. */
export function catalogEntry(family: string | null | undefined): FontCatalogEntry | undefined {
  if (!family) return undefined
  return FONT_CATALOG_BY_FAMILY.get(family)
}

export const FONT_CATALOG: readonly FontCatalogEntry[] = [
  /* Display */
  { family: 'Bricolage Grotesque', role: 'display', note: 'Odd widths and a bit of wonk. Carries a brand on its own.', pairsWith: ['Source Sans 3', 'Public Sans'], origin: 'France', scripts: ['vietnamese'] },
  { family: 'Syne', role: 'display', note: 'Wide, technical, art-book. Best very large and sparing.', pairsWith: ['Inter', 'DM Mono'], origin: 'France', scripts: ['greek'] },
  { family: 'Instrument Serif', role: 'display', note: 'High-contrast editorial headline. Elegant without going bridal.', pairsWith: ['Figtree', 'Archivo'], origin: 'United States' },
  { family: 'Anton', role: 'display', note: 'One heavy condensed weight. Poster shouting.', pairsWith: ['Public Sans', 'Archivo Narrow'], scripts: ['vietnamese'] },
  { family: 'Bebas Neue', role: 'display', note: 'Condensed caps. Tickets, sport, packaging.', pairsWith: ['Source Sans 3'], origin: 'Japan' },
  { family: 'Archivo Black', role: 'display', note: 'Blunt grotesque weight for a single loud line.', pairsWith: ['Archivo', 'Spectral'], origin: 'Argentina' },
  { family: 'Clash Display', role: 'display', note: 'Sharp, tight grotesque built for big headlines. The current agency favourite.', pairsWith: ['General Sans', 'Satoshi'], origin: 'India' },
  { family: 'Chillax', role: 'display', note: 'Laid-back geometric display. Friendly brands, lifestyle and food.', pairsWith: ['General Sans'], origin: 'India' },
  { family: 'Panchang', role: 'display', note: 'Extra-wide display caps. One short word across a whole hero.', pairsWith: ['Switzer'], origin: 'India' },
  { family: 'Tanker', role: 'display', note: 'One heavy poster weight. Loud, chunky and a little retro.', pairsWith: ['Satoshi'], origin: 'India' },
  { family: 'Unbounded', role: 'display', note: 'Extended, rounded, futuristic. Web3 and music festivals.', pairsWith: ['Inter'], scripts: ['cyrillic', 'vietnamese'] },
  { family: 'Funnel Display', role: 'display', note: 'Contemporary display sans with flared, funnel-like joints.', pairsWith: ['Funnel Sans'] },
  { family: 'Hubot Sans', role: 'display', note: "Mona Sans's robotic sibling. Squared, mechanical headlines.", pairsWith: ['Mona Sans'], origin: 'Sweden', scripts: ['vietnamese'] },
  { family: 'Gabarito', role: 'display', note: 'Bold geometric display. Playful and warm.', pairsWith: ['Figtree'], origin: 'Brazil' },
  { family: 'Climate Crisis', role: 'display', note: 'From a Finnish newspaper: its weight melts like Arctic sea ice. A statement.', pairsWith: ['Public Sans'], origin: 'Finland', scripts: ['cyrillic'] },
  { family: 'Bungee', role: 'display', note: 'Urban signage font that also sets vertically. Street, sport and food.', pairsWith: ['Barlow'], origin: 'United States', scripts: ['vietnamese'] },
  { family: 'Righteous', role: 'display', note: 'Art-deco geometric with retro poster vibes.', pairsWith: ['Barlow'] },
  { family: 'Tilt Warp', role: 'display', note: 'Chunky display with a 3D tilt. Playful brands and games.', pairsWith: ['Rubik'], origin: 'United States', scripts: ['vietnamese'] },
  { family: 'Rubik Mono One', role: 'display', note: 'Monospaced heavy caps. Bold labels and logotypes.', pairsWith: ['Rubik'], origin: 'Germany', scripts: ['cyrillic'] },
  { family: 'Rubik Glitch', role: 'display', note: 'Rubik heavy weight, digitally broken. Gaming and music drops.', pairsWith: ['Rubik'], scripts: ['cyrillic', 'hebrew'] },
  { family: 'Abril Fatface', role: 'display', note: 'Heavy Didone headline with fat-to-hairline contrast.', pairsWith: ['Public Sans'], origin: 'Argentina' },
  { family: 'Bagel Fat One', role: 'display', note: 'Puffy, inflated Hangul and Latin. Cute and loud.', pairsWith: ['Gowun Dodum'], origin: 'South Korea', script: 'korean', scripts: ['korean'] },
  { family: 'Dela Gothic One', role: 'display', note: 'Heavy, compact Japanese display gothic. Manga-cover energy.', pairsWith: ['M PLUS 1'], origin: 'Japan', script: 'japanese', scripts: ['cyrillic', 'greek', 'japanese', 'vietnamese'] },
  { family: 'Black Han Sans', role: 'display', note: 'Ultra-heavy Hangul headline face. Korean posters.', pairsWith: ['Noto Sans KR'], origin: 'South Korea', script: 'korean', scripts: ['korean'] },
  { family: 'Do Hyeon', role: 'display', note: 'Hand-cut Hangul made for a Korean app brand. Playful headlines.', pairsWith: ['Gowun Dodum'], origin: 'South Korea', script: 'korean', scripts: ['korean'] },
  { family: 'ZCOOL KuaiLe', role: 'display', note: 'Happy, bouncy simplified Chinese display.', pairsWith: ['Noto Sans SC'], origin: 'China', script: 'chinese', scripts: ['chinese'] },
  { family: 'Lalezar', role: 'display', note: 'Bold Persian and Arabic display with Latin. Posters and cafes.', pairsWith: ['Vazirmatn'], origin: 'Iran', script: 'arabic', scripts: ['arabic', 'vietnamese'] },
  { family: 'Reem Kufi', role: 'display', note: 'Geometric Kufi Arabic with Fatimid roots. Elegant signage.', pairsWith: ['Cairo'], origin: 'Egypt', script: 'arabic', scripts: ['arabic', 'vietnamese'] },
  { family: 'El Messiri', role: 'display', note: 'Arabic display with modern, crisp curves and matching Latin.', pairsWith: ['Cairo'], origin: 'Egypt', script: 'arabic', scripts: ['arabic', 'cyrillic'] },
  { family: 'Changa', role: 'display', note: 'Bold squarish Arabic and Latin. Sport and tech brands.', pairsWith: ['Cairo'], origin: 'Argentina', script: 'arabic', scripts: ['arabic'] },
  { family: 'Secular One', role: 'display', note: 'Heavy Hebrew and Latin headline sans.', pairsWith: ['Heebo'], origin: 'Israel', script: 'hebrew', scripts: ['hebrew'] },
  { family: 'Baloo 2', role: 'display', note: 'Round, juicy Devanagari and Latin. Fun Indian brands.', pairsWith: ['Mukta'], origin: 'India', script: 'devanagari', scripts: ['devanagari', 'vietnamese'] },
  { family: 'Shrikhand', role: 'display', note: 'Fat, swashy Gujarati and Latin inspired by Indian signage.', pairsWith: ['Hind'], origin: 'India', script: 'gujarati', scripts: ['gujarati'] },
  { family: 'Press Start 2P', role: 'display', note: '8-bit arcade bitmap. Retro games; use tiny and sparingly.', pairsWith: ['VT323'], scripts: ['cyrillic', 'greek'] },
  { family: 'Silkscreen', role: 'display', note: 'Tiny pixel caps. Y2K web nostalgia.', pairsWith: ['Space Mono'], origin: 'United States' },

  /* Sans */
  { family: 'Inter', role: 'sans', note: 'The safe default. Reads well at every size, says nothing.', pairsWith: ['Newsreader', 'JetBrains Mono'], origin: 'Sweden', scripts: ['cyrillic', 'greek', 'vietnamese'] },
  { family: 'Archivo', role: 'sans', note: 'Grotesque with more grip than Inter. Good at heavy weights.', pairsWith: ['Instrument Serif', 'Roboto Slab'], origin: 'Argentina', scripts: ['vietnamese'] },
  { family: 'Libre Franklin', role: 'sans', note: 'Franklin Gothic lineage — American, editorial, sturdy.', pairsWith: ['Spectral', 'EB Garamond'], origin: 'Argentina', scripts: ['cyrillic', 'vietnamese'] },
  { family: 'Manrope', role: 'sans', note: 'Soft geometric. Friendly product UI.', pairsWith: ['Lora'], scripts: ['cyrillic', 'greek', 'vietnamese'] },
  { family: 'DM Sans', role: 'sans', note: 'Low-contrast geometric, tidy at small sizes.', pairsWith: ['DM Mono'], origin: 'United Kingdom' },
  { family: 'Plus Jakarta Sans', role: 'sans', note: 'Rounded geometric with a touch of character.', pairsWith: ['Newsreader'], origin: 'Indonesia', scripts: ['cyrillic', 'vietnamese'] },
  { family: 'Space Grotesk', role: 'sans', note: 'Quirky mono-derived shapes. Reads technical.', pairsWith: ['Space Mono'], origin: 'Czechia', scripts: ['vietnamese'] },
  { family: 'Urbanist', role: 'sans', note: 'Very round geometric. Light weights go elegant.', pairsWith: ['Fraunces'] },
  { family: 'Outfit', role: 'sans', note: 'Even geometric with a clean bowl. Logo-friendly.', pairsWith: ['Source Serif 4'] },
  { family: 'Poppins', role: 'sans', note: 'Circular geometric. Everywhere — use knowingly.', pairsWith: ['Lora'], origin: 'India', scripts: ['devanagari'] },
  { family: 'Montserrat', role: 'sans', note: 'Urban-signage geometric. Wide caps.', pairsWith: ['Merriweather'], origin: 'Argentina', scripts: ['cyrillic', 'vietnamese'] },
  { family: 'Satoshi', role: 'sans', note: 'Contemporary neo-grotesque, crisp at display sizes.', pairsWith: ['Newsreader'], origin: 'India' },
  { family: 'Cabinet Grotesk', role: 'sans', note: 'Slightly condensed grotesque with sharp joints.', pairsWith: ['Spectral'], origin: 'India' },
  { family: 'General Sans', role: 'sans', note: 'Crisp contemporary grotesque. Startup-clean without being Inter.', pairsWith: ['Gambetta', 'JetBrains Mono'], origin: 'India' },
  { family: 'Switzer', role: 'sans', note: 'Swiss-school neo-grotesque with a full weight range. Quietly precise.', pairsWith: ['Zodiak', 'Sentient'], origin: 'India' },
  { family: 'Supreme', role: 'sans', note: 'Geometric-grotesque hybrid. Modern product pages and decks.', pairsWith: ['Bespoke Serif'], origin: 'India' },
  { family: 'Clash Grotesk', role: 'sans', note: 'The text-size sibling of Clash Display. Keeps its edge in paragraphs.', pairsWith: ['Clash Display'], origin: 'India' },
  { family: 'Geist', role: 'sans', note: "Vercel's typeface. Technical, crisp and very current for dev tools.", pairsWith: ['Geist Mono'], origin: 'Argentina', scripts: ['cyrillic', 'vietnamese'] },
  { family: 'Instrument Sans', role: 'sans', note: 'Precise grotesque with a slightly condensed feel. Pairs with its serif.', pairsWith: ['Instrument Serif'], origin: 'United States' },
  { family: 'Familjen Grotesk', role: 'sans', note: 'Scandinavian grotesque with a characterful bold. Agency energy.', pairsWith: ['Newsreader'], origin: 'Sweden', scripts: ['vietnamese'] },
  { family: 'Schibsted Grotesk', role: 'sans', note: 'Newsroom grotesque from a Norwegian media house. Dense and confident.', pairsWith: ['Source Serif 4'], origin: 'Norway' },
  { family: 'Hanken Grotesk', role: 'sans', note: 'Clean, slightly geometric grotesque. A calmer Inter alternative.', pairsWith: ['Fraunces'], scripts: ['cyrillic', 'vietnamese'] },
  { family: 'Red Hat Display', role: 'sans', note: 'Open, friendly corporate sans with crisp terminals.', pairsWith: ['Red Hat Mono'], origin: 'United States' },
  { family: 'Sora', role: 'sans', note: 'Wide, technical geometric. Fintech, crypto and dashboards.', pairsWith: ['IBM Plex Mono'], origin: 'United Kingdom' },
  { family: 'Mona Sans', role: 'sans', note: "GitHub's variable grotesque. Strong, with a wide weight range.", pairsWith: ['Hubot Sans', 'JetBrains Mono'], origin: 'Sweden', scripts: ['vietnamese'] },
  { family: 'Host Grotesk', role: 'sans', note: 'Contemporary grotesque with open shapes. Product UI that wants warmth.', pairsWith: ['Gelasio'], origin: 'Türkiye' },
  { family: 'Funnel Sans', role: 'sans', note: 'Modern sans with subtly flared details. Distinct at body size.', pairsWith: ['Funnel Display'] },
  { family: 'Onest', role: 'sans', note: 'Neutral grotesque with excellent Cyrillic. Multilingual product UI.', pairsWith: ['Golos Text'], scripts: ['cyrillic', 'vietnamese'] },
  { family: 'Chivo', role: 'sans', note: 'Sturdy grotesque that gets dramatic at heavy weights.', pairsWith: ['Libre Baskerville'], origin: 'Argentina', scripts: ['vietnamese'] },
  { family: 'Encode Sans', role: 'sans', note: 'Grotesque in many widths. Fits labels, tables and long headlines.', pairsWith: ['Alegreya'], origin: 'Argentina', scripts: ['vietnamese'] },
  { family: 'Work Sans', role: 'sans', note: 'Grotesque tuned for screens, slightly wide at display sizes.', pairsWith: ['Crimson Pro'], scripts: ['vietnamese'] },
  { family: 'Karla', role: 'sans', note: 'Quirky grotesque with a bit of personality. Indie and editorial.', pairsWith: ['Spectral'] },
  { family: 'Rubik', role: 'sans', note: 'Slightly rounded corners. Friendly, with Hebrew and Arabic support.', pairsWith: ['Karla'], origin: 'Germany', scripts: ['arabic', 'cyrillic', 'hebrew'] },
  { family: 'Jost', role: 'sans', note: 'Futura-inspired geometric. Bauhaus clarity without the licence.', pairsWith: ['Bodoni Moda'], origin: 'United States', scripts: ['cyrillic'] },
  { family: 'Raleway', role: 'sans', note: 'Elegant thin-to-black geometric. Pretty in light weights.', pairsWith: ['Lora'], origin: 'United States', scripts: ['cyrillic', 'vietnamese'] },
  { family: 'Barlow', role: 'sans', note: 'Slightly rounded grotesque after Californian highway signs. Utilitarian.', pairsWith: ['Barlow Condensed'], origin: 'United States', scripts: ['vietnamese'] },
  { family: 'Josefin Sans', role: 'sans', note: 'Vintage geometric with a low x-height. Twenties elegance.', pairsWith: ['Playfair Display'], origin: 'Mexico', scripts: ['vietnamese'] },
  { family: 'Be Vietnam Pro', role: 'sans', note: 'Neo-grotesque with flawless Vietnamese diacritics.', pairsWith: ['Lora'], origin: 'Vietnam', scripts: ['vietnamese'] },

  /* Humanist, rounded and world text faces */
  { family: 'Source Sans 3', role: 'humanist', note: 'Calm, legible, disappears into long text.', pairsWith: ['Source Serif 4', 'Bricolage Grotesque'], origin: 'United States', scripts: ['cyrillic', 'greek', 'vietnamese'] },
  { family: 'Public Sans', role: 'humanist', note: 'Neutral and accessible — built for public services.', pairsWith: ['Anton', 'Newsreader'], origin: 'United States', scripts: ['vietnamese'] },
  { family: 'Figtree', role: 'humanist', note: 'Warm and approachable without going childish.', pairsWith: ['Instrument Serif'], origin: 'United States' },
  { family: 'Atkinson Hyperlegible Next', role: 'humanist', note: 'Made by the Braille Institute for low vision. Every letter unmistakable.', pairsWith: ['Literata'], origin: 'United States' },
  { family: 'Lexend', role: 'humanist', note: 'Widths tuned to improve reading fluency. Education and accessibility.', pairsWith: ['Literata'], origin: 'United States', scripts: ['vietnamese'] },
  { family: 'Nunito', role: 'humanist', note: 'Rounded terminals and soft shapes. Friendly apps and kids products.', pairsWith: ['Lora'], scripts: ['cyrillic', 'vietnamese'] },
  { family: 'Quicksand', role: 'humanist', note: 'Light, rounded display sans. Gentle wellness and lifestyle.', pairsWith: ['Lora'], scripts: ['vietnamese'] },
  { family: 'Comfortaa', role: 'humanist', note: 'Rounded geometric with a playful, airy feel.', pairsWith: ['Nunito'], scripts: ['cyrillic', 'greek', 'vietnamese'] },
  { family: 'Noto Sans', role: 'humanist', note: "Google's \"no more tofu\" sans. A neutral base for any language.", pairsWith: ['Noto Serif'], scripts: ['cyrillic', 'devanagari', 'greek', 'vietnamese'] },
  { family: 'Golos Text', role: 'humanist', note: 'Made for Russian public services. Clear Cyrillic and Latin.', pairsWith: ['PT Serif'], origin: 'Russia', scripts: ['cyrillic'] },
  { family: 'PT Sans', role: 'humanist', note: 'Public-type humanist sans for Russian-speaking regions.', pairsWith: ['PT Serif'], origin: 'Russia', scripts: ['cyrillic'] },
  { family: 'Mukta', role: 'humanist', note: 'Devanagari and Latin in one even voice. Indian product UI.', pairsWith: ['Martel'], origin: 'India', script: 'devanagari', scripts: ['devanagari'] },
  { family: 'Hind', role: 'humanist', note: 'Workhorse Devanagari sans. Clean in both scripts.', pairsWith: ['Martel'], origin: 'India', script: 'devanagari', scripts: ['devanagari'] },
  { family: 'Catamaran', role: 'humanist', note: 'Tamil and Latin with matched rhythm. South Indian brands.', pairsWith: ['Lora'], origin: 'India', script: 'tamil', scripts: ['tamil'] },
  { family: 'Hind Siliguri', role: 'humanist', note: 'Bengali and Latin in the Hind family voice.', pairsWith: ['Lora'], origin: 'India', script: 'bengali', scripts: ['bengali'] },
  { family: 'Heebo', role: 'humanist', note: 'Hebrew extension of Roboto. Neutral Israeli product UI.', pairsWith: ['Frank Ruhl Libre'], origin: 'Israel', script: 'hebrew', scripts: ['hebrew'] },
  { family: 'Assistant', role: 'humanist', note: 'Hebrew and Latin with a soft, approachable stance.', pairsWith: ['Frank Ruhl Libre'], origin: 'Israel', script: 'hebrew', scripts: ['hebrew'] },
  { family: 'Cairo', role: 'humanist', note: 'Contemporary Arabic with matching Latin. A favourite on the Arabic web.', pairsWith: ['Amiri'], origin: 'Egypt', script: 'arabic', scripts: ['arabic'] },
  { family: 'Tajawal', role: 'humanist', note: 'Low-contrast Arabic for screens, from a renowned Arabic type studio.', pairsWith: ['Amiri'], origin: 'Lebanon', script: 'arabic', scripts: ['arabic'] },
  { family: 'IBM Plex Sans Arabic', role: 'humanist', note: 'Corporate-grade Arabic in the IBM Plex voice.', pairsWith: ['IBM Plex Mono'], script: 'arabic', scripts: ['arabic', 'cyrillic'] },
  { family: 'Noto Kufi Arabic', role: 'humanist', note: 'Geometric Kufi-style Arabic. Signage and modern brands.', pairsWith: ['Noto Naskh Arabic'], script: 'arabic', scripts: ['arabic'] },
  { family: 'Vazirmatn', role: 'humanist', note: 'The Persian web favourite. Excellent Farsi and Arabic shaping.', pairsWith: ['Amiri'], origin: 'Iran', script: 'arabic', scripts: ['arabic'] },
  { family: 'Noto Sans JP', role: 'humanist', note: 'The safe, complete Japanese gothic. Every kanji you will need.', pairsWith: ['Noto Serif JP'], script: 'japanese', scripts: ['cyrillic', 'japanese', 'vietnamese'] },
  { family: 'Zen Kaku Gothic New', role: 'humanist', note: 'Crisp Japanese gothic with a modern, bookish rhythm.', pairsWith: ['Zen Old Mincho'], origin: 'Japan', script: 'japanese', scripts: ['cyrillic', 'japanese'] },
  { family: 'Zen Maru Gothic', role: 'humanist', note: 'Rounded Japanese gothic. Soft, kind, approachable.', pairsWith: ['Zen Old Mincho'], origin: 'Japan', script: 'japanese', scripts: ['cyrillic', 'greek', 'japanese'] },
  { family: 'M PLUS 1', role: 'humanist', note: 'Clean Japanese gothic with a huge weight range.', pairsWith: ['Shippori Mincho'], origin: 'Japan', script: 'japanese', scripts: ['japanese', 'vietnamese'] },
  { family: 'Noto Sans KR', role: 'humanist', note: 'Complete, neutral Hangul. The safe Korean default.', pairsWith: ['Nanum Myeongjo'], script: 'korean', scripts: ['cyrillic', 'korean', 'vietnamese'] },
  { family: 'Nanum Gothic', role: 'humanist', note: 'The classic Korean web gothic.', pairsWith: ['Nanum Myeongjo'], origin: 'South Korea', script: 'korean', scripts: ['korean'] },
  { family: 'Gowun Dodum', role: 'humanist', note: 'Gentle, slightly calligraphic Hangul sans.', pairsWith: ['Gowun Batang'], origin: 'South Korea', script: 'korean', scripts: ['korean', 'vietnamese'] },
  { family: 'Noto Sans SC', role: 'humanist', note: 'Complete simplified Chinese sans. Mainland and Singapore audiences.', pairsWith: ['Noto Serif SC'], script: 'chinese', scripts: ['chinese', 'cyrillic', 'vietnamese'] },
  { family: 'Noto Sans TC', role: 'humanist', note: 'Traditional Chinese sans. Taiwan and Hong Kong audiences.', pairsWith: ['LXGW WenKai TC'], script: 'chinese', scripts: ['chinese', 'cyrillic', 'vietnamese'] },
  { family: 'Sarabun', role: 'humanist', note: 'A Thai government standard. Formal, legible Thai and Latin.', pairsWith: ['Kanit'], origin: 'Thailand', script: 'thai', scripts: ['thai', 'vietnamese'] },
  { family: 'Kanit', role: 'humanist', note: 'Loopless modern Thai with a techno edge.', pairsWith: ['Sarabun'], origin: 'Thailand', script: 'thai', scripts: ['thai', 'vietnamese'] },
  { family: 'Prompt', role: 'humanist', note: 'Geometric loopless Thai. Bold, clear and contemporary.', pairsWith: ['Sarabun'], origin: 'Thailand', script: 'thai', scripts: ['thai', 'vietnamese'] },
  { family: 'Noto Sans Devanagari', role: 'humanist', note: 'Complete Devanagari for Hindi, Marathi and Nepali.', pairsWith: ['Tiro Devanagari Hindi'], script: 'devanagari', scripts: ['devanagari'] },
  { family: 'Noto Sans Bengali', role: 'humanist', note: 'Complete Bengali for Bangla-speaking audiences.', pairsWith: ['Hind Siliguri'], script: 'bengali', scripts: ['bengali'] },
  { family: 'Noto Sans Tamil', role: 'humanist', note: 'Complete Tamil for India, Sri Lanka and Singapore.', pairsWith: ['Catamaran'], script: 'tamil', scripts: ['tamil'] },
  { family: 'Noto Sans Gujarati', role: 'humanist', note: 'Complete Gujarati for Gujarati-speaking audiences.', pairsWith: ['Shrikhand'], script: 'gujarati', scripts: ['gujarati'] },
  { family: 'Noto Sans Ethiopic', role: 'humanist', note: "Ge'ez script for Amharic, Tigrinya and more. Ethiopia and Eritrea.", pairsWith: ['Abyssinica SIL'], script: 'ethiopic', scripts: ['ethiopic'] },
  { family: 'Noto Sans Adlam', role: 'humanist', note: 'Adlam, the modern alphabet for Fulani across West Africa.', pairsWith: ['Noto Sans'], script: 'adlam', scripts: ['adlam'] },
  { family: 'Noto Sans NKo Unjoined', role: 'humanist', note: "N'Ko script for Manding languages across West Africa.", pairsWith: ['Noto Sans'], script: 'nko', scripts: ['nko'] },
  { family: 'Noto Sans Tifinagh', role: 'humanist', note: 'Tifinagh, the Amazigh (Berber) script of North Africa.', pairsWith: ['Noto Sans'], script: 'tifinagh', scripts: ['tifinagh'] },
  { family: 'Noto Sans Georgian', role: 'humanist', note: 'Georgian Mkhedruli script, with Latin and Cyrillic.', pairsWith: ['Noto Sans'], script: 'georgian', scripts: ['cyrillic', 'georgian', 'greek'] },
  { family: 'Noto Sans Armenian', role: 'humanist', note: 'The Armenian alphabet, clean and complete.', pairsWith: ['Noto Sans'], script: 'armenian', scripts: ['armenian'] },

  /* Condensed */
  { family: 'Archivo Narrow', role: 'condensed', note: 'Fits more per line without feeling squeezed.', pairsWith: ['Archivo'], origin: 'Argentina', scripts: ['vietnamese'] },
  { family: 'Oswald', role: 'condensed', note: 'Tall condensed gothic. Navigation, stats, decks.', pairsWith: ['Source Sans 3'], scripts: ['cyrillic', 'vietnamese'] },
  { family: 'Barlow Condensed', role: 'condensed', note: 'Low-contrast condensed, wide weight range.', pairsWith: ['Barlow Condensed'], scripts: ['vietnamese'] },
  { family: 'Rajdhani', role: 'condensed', note: 'Squared, technical Devanagari and Latin. Gaming and sport.', pairsWith: ['Hind'], origin: 'India', script: 'devanagari', scripts: ['devanagari'] },
  { family: 'Teko', role: 'condensed', note: 'Tall condensed Devanagari and Latin. Scores and posters.', pairsWith: ['Hind'], origin: 'India', script: 'devanagari', scripts: ['devanagari'] },
  { family: 'Fjalla One', role: 'condensed', note: 'Medium-contrast condensed headline face. Newsy and firm.', pairsWith: ['Source Sans 3'], origin: 'United States', scripts: ['cyrillic', 'vietnamese'] },
  { family: 'League Gothic', role: 'condensed', note: 'A revived American gothic. Tall, tight, classic newspaper.', pairsWith: ['Libre Caslon Text'], origin: 'United States', scripts: ['vietnamese'] },
  { family: 'Saira Condensed', role: 'condensed', note: 'Squarish technical condensed. Motorsport and tech specs.', pairsWith: ['Encode Sans'], origin: 'Argentina', scripts: ['vietnamese'] },
  { family: 'Sofia Sans Condensed', role: 'condensed', note: 'Wide-range condensed with excellent Cyrillic and Greek.', pairsWith: ['Literata'], scripts: ['cyrillic', 'greek'] },
  { family: 'Chakra Petch', role: 'condensed', note: 'Square Thai and Latin with cut corners. Sci-fi and esports.', pairsWith: ['Kanit'], origin: 'Thailand', script: 'thai', scripts: ['thai', 'vietnamese'] },
  { family: 'Bai Jamjuree', role: 'condensed', note: 'Thai and Latin with a squared, engineered feel.', pairsWith: ['Sarabun'], origin: 'Thailand', script: 'thai', scripts: ['thai', 'vietnamese'] },

  /* Serif */
  { family: 'Newsreader', role: 'serif', note: 'Made for reading on screen. Strong body serif.', pairsWith: ['Inter', 'Public Sans'], origin: 'France', scripts: ['vietnamese'] },
  { family: 'Source Serif 4', role: 'serif', note: 'Even colour, quiet, holds a long article.', pairsWith: ['Source Sans 3'], origin: 'United States', scripts: ['cyrillic', 'greek', 'vietnamese'] },
  { family: 'Spectral', role: 'serif', note: 'Screen-first with visible contrast. Editorial.', pairsWith: ['Libre Franklin'], origin: 'France', scripts: ['cyrillic', 'vietnamese'] },
  { family: 'EB Garamond', role: 'serif', note: 'Classical old-style. Books, essays, restraint.', pairsWith: ['Libre Franklin'], origin: 'Austria', scripts: ['cyrillic', 'greek', 'vietnamese'] },
  { family: 'Playfair Display', role: 'serif', note: 'High contrast, headline only — never body.', pairsWith: ['Source Sans 3'], origin: 'Denmark', scripts: ['cyrillic', 'vietnamese'] },
  { family: 'Cormorant Garamond', role: 'serif', note: 'Delicate and fine. Needs size and space.', pairsWith: ['Montserrat'], origin: 'Switzerland', scripts: ['cyrillic', 'vietnamese'] },
  { family: 'Lora', role: 'serif', note: 'Brushed contrast, comfortable at body size.', pairsWith: ['Manrope'], scripts: ['cyrillic', 'vietnamese'] },
  { family: 'Merriweather', role: 'serif', note: 'Large x-height, very sturdy on screen.', pairsWith: ['Montserrat'], origin: 'United States', scripts: ['cyrillic', 'vietnamese'] },
  { family: 'Fraunces', role: 'serif', note: 'Soft old-style with wonk. Playful and premium.', pairsWith: ['Urbanist'], origin: 'United States', scripts: ['vietnamese'] },
  { family: 'Gambetta', role: 'serif', note: 'Classic text serif with contemporary sharpness. Long reads with taste.', pairsWith: ['General Sans'], origin: 'India' },
  { family: 'Zodiak', role: 'serif', note: 'High-contrast serif that goes from essay text to fashion headline.', pairsWith: ['Switzer'], origin: 'India' },
  { family: 'Sentient', role: 'serif', note: 'Calm, even serif for editorial reading. Never shouts.', pairsWith: ['Switzer'], origin: 'India' },
  { family: 'Boska', role: 'serif', note: 'Exaggerated contrast and sharp joins. Luxury and beauty headlines.', pairsWith: ['General Sans'], origin: 'India' },
  { family: 'Bespoke Serif', role: 'serif', note: 'Sharp contemporary serif with a hint of attitude. Premium but not stiff.', pairsWith: ['Supreme'], origin: 'India' },
  { family: 'Melodrama', role: 'serif', note: 'Condensed, very high-contrast display serif. Dramatic, theatrical headlines.', pairsWith: ['Switzer'], origin: 'India' },
  { family: 'DM Serif Display', role: 'serif', note: 'High-contrast display serif. Polished magazine headlines.', pairsWith: ['DM Sans'], origin: 'United Kingdom' },
  { family: 'Young Serif', role: 'serif', note: 'Heavy, soft old-style. Warm bakery-and-bookshop charm.', pairsWith: ['Inter'], origin: 'France' },
  { family: 'Bodoni Moda', role: 'serif', note: 'Didone in the spirit of Bodoni. Fashion, perfume, luxury.', pairsWith: ['Jost'], origin: 'United States' },
  { family: 'Gloock', role: 'serif', note: 'Chunky high-contrast serif with ball terminals. Editorial personality.', pairsWith: ['Inter'], origin: 'Portugal', scripts: ['cyrillic'] },
  { family: 'Alegreya', role: 'serif', note: 'Calligraphic, dynamic book serif. Literature and storytelling.', pairsWith: ['Work Sans'], origin: 'Argentina', scripts: ['cyrillic', 'greek', 'vietnamese'] },
  { family: 'Libre Baskerville', role: 'serif', note: 'Baskerville tuned for body text on the web.', pairsWith: ['Chivo'], origin: 'Argentina' },
  { family: 'Libre Caslon Text', role: 'serif', note: 'Caslon for screens. Founding-document gravitas.', pairsWith: ['League Gothic'], origin: 'Argentina' },
  { family: 'Cormorant', role: 'serif', note: 'Display Garamond with razor-fine detail. Big sizes only.', pairsWith: ['Jost'], origin: 'Switzerland', scripts: ['cyrillic', 'vietnamese'] },
  { family: 'Crimson Pro', role: 'serif', note: 'Old-style book face. Essays, novels and long reads.', pairsWith: ['Work Sans'], origin: 'Netherlands', scripts: ['vietnamese'] },
  { family: 'Literata', role: 'serif', note: 'Built for e-books and hours of reading.', pairsWith: ['Lexend'], scripts: ['cyrillic', 'greek', 'vietnamese'] },
  { family: 'Petrona', role: 'serif', note: 'Sturdy, slightly condensed text serif with a wide weight range.', pairsWith: ['Hanken Grotesk'], scripts: ['vietnamese'] },
  { family: 'Gelasio', role: 'serif', note: 'Metric-compatible with Georgia. A drop-in classic upgrade.', pairsWith: ['Host Grotesk'], origin: 'United States', scripts: ['vietnamese'] },
  { family: 'PT Serif', role: 'serif', note: 'Transitional serif with superb Cyrillic. Russian publishing.', pairsWith: ['PT Sans'], origin: 'Russia', scripts: ['cyrillic'] },
  { family: 'GFS Didot', role: 'serif', note: 'From the Greek Font Society. Classical Greek typography.', pairsWith: ['Jost'], origin: 'Greece', script: 'greek', scripts: ['greek', 'vietnamese'] },
  { family: 'Yeseva One', role: 'serif', note: 'Feminine high-contrast display serif with Cyrillic.', pairsWith: ['Josefin Sans'], origin: 'Russia', scripts: ['cyrillic', 'vietnamese'] },
  { family: 'Frank Ruhl Libre', role: 'serif', note: 'Classic Hebrew book serif, refreshed for the web.', pairsWith: ['Heebo'], origin: 'Israel', script: 'hebrew', scripts: ['hebrew'] },
  { family: 'Amiri', role: 'serif', note: 'Classical Naskh Arabic. Literature, scripture, heritage brands.', pairsWith: ['Cairo'], origin: 'Egypt', script: 'arabic', scripts: ['arabic'] },
  { family: 'Noto Naskh Arabic', role: 'serif', note: 'Complete, neutral Naskh Arabic for reading.', pairsWith: ['Noto Kufi Arabic'], script: 'arabic', scripts: ['arabic'] },
  { family: 'Martel', role: 'serif', note: 'Devanagari and Latin serif. Indian editorial and news.', pairsWith: ['Mukta'], origin: 'Germany', script: 'devanagari', scripts: ['devanagari'] },
  { family: 'Tiro Devanagari Hindi', role: 'serif', note: 'Scholarly Devanagari serif for Hindi literature.', pairsWith: ['Noto Sans Devanagari'], origin: 'Canada', script: 'devanagari', scripts: ['devanagari'] },
  { family: 'Rozha One', role: 'serif', note: 'High-contrast Devanagari display serif. Film-poster drama.', pairsWith: ['Hind'], origin: 'India', script: 'devanagari', scripts: ['devanagari'] },
  { family: 'Noto Serif JP', role: 'serif', note: 'Complete Japanese Mincho. Formal and literary.', pairsWith: ['Noto Sans JP'], script: 'japanese', scripts: ['cyrillic', 'japanese', 'vietnamese'] },
  { family: 'Zen Old Mincho', role: 'serif', note: 'Old-style Japanese Mincho with warmth.', pairsWith: ['Zen Kaku Gothic New'], origin: 'Japan', script: 'japanese', scripts: ['cyrillic', 'greek', 'japanese'] },
  { family: 'Shippori Mincho', role: 'serif', note: 'Letterpress-style Mincho. Japanese editorial elegance.', pairsWith: ['M PLUS 1'], origin: 'Japan', script: 'japanese', scripts: ['japanese'] },
  { family: 'Kaisei Decol', role: 'serif', note: 'Decorative Japanese serif with soft brush touches.', pairsWith: ['Zen Maru Gothic'], origin: 'Japan', script: 'japanese', scripts: ['cyrillic', 'japanese'] },
  { family: 'Nanum Myeongjo', role: 'serif', note: 'Classic Korean Myeongjo serif. Literary and refined.', pairsWith: ['Nanum Gothic'], origin: 'South Korea', script: 'korean', scripts: ['korean'] },
  { family: 'Gowun Batang', role: 'serif', note: 'Gentle, handwritten-feel Korean serif.', pairsWith: ['Gowun Dodum'], origin: 'South Korea', script: 'korean', scripts: ['korean', 'vietnamese'] },
  { family: 'Noto Serif SC', role: 'serif', note: 'Complete simplified Chinese Song/Ming serif.', pairsWith: ['Noto Sans SC'], script: 'chinese', scripts: ['chinese', 'cyrillic', 'vietnamese'] },
  { family: 'ZCOOL XiaoWei', role: 'serif', note: 'Elegant simplified Chinese display serif.', pairsWith: ['Noto Sans SC'], origin: 'China', script: 'chinese', scripts: ['chinese'] },
  { family: 'Abyssinica SIL', role: 'serif', note: "Traditional Ge'ez serif for Ethiopian publishing.", pairsWith: ['Noto Sans Ethiopic'], script: 'ethiopic', scripts: ['ethiopic'] },
  { family: 'Noto Serif', role: 'serif', note: 'Neutral serif companion to Noto Sans. Any language.', pairsWith: ['Noto Sans'], scripts: ['cyrillic', 'greek', 'vietnamese'] },

  /* Slab */
  { family: 'Roboto Slab', role: 'slab', note: 'Geometric slab. Mechanical, dependable headings.', pairsWith: ['Archivo'], origin: 'United States', scripts: ['cyrillic', 'greek', 'vietnamese'] },
  { family: 'Zilla Slab', role: 'slab', note: 'Angular slab with personality at mid weights.', pairsWith: ['Public Sans'], origin: 'Netherlands' },
  { family: 'Bitter', role: 'slab', note: 'Slab built for reading on screens. Sturdy blogs and docs.', pairsWith: ['Raleway'], origin: 'Argentina', scripts: ['cyrillic', 'vietnamese'] },
  { family: 'Alfa Slab One', role: 'slab', note: 'Heavy, warm slab for one strong line.', pairsWith: ['Barlow'], origin: 'Argentina', scripts: ['vietnamese'] },

  /* Mono */
  { family: 'JetBrains Mono', role: 'mono', note: 'Tall x-height, built for reading code.', pairsWith: ['Inter'], origin: 'Czechia', scripts: ['cyrillic', 'greek', 'vietnamese'] },
  { family: 'IBM Plex Mono', role: 'mono', note: 'Warmer mono with real character.', pairsWith: ['Source Sans 3'], scripts: ['cyrillic', 'vietnamese'] },
  { family: 'Space Mono', role: 'mono', note: 'Quirky and retro. Labels, not paragraphs.', pairsWith: ['Space Grotesk'], origin: 'United Kingdom', scripts: ['vietnamese'] },
  { family: 'Fira Code', role: 'mono', note: 'Programming ligatures. Code blocks.', pairsWith: ['Inter'], scripts: ['cyrillic', 'greek'] },
  { family: 'DM Mono', role: 'mono', note: 'Low-contrast mono. Understated captions and data.', pairsWith: ['DM Sans'], origin: 'United Kingdom' },
  { family: 'Geist Mono', role: 'mono', note: 'Monospace partner of Geist. Code, data and terminal UI.', pairsWith: ['Geist'], origin: 'Argentina', scripts: ['cyrillic', 'vietnamese'] },
  { family: 'Red Hat Mono', role: 'mono', note: 'Monospace partner of Red Hat. Clean docs and CLIs.', pairsWith: ['Red Hat Display'], origin: 'United States' },
  { family: 'Martian Mono', role: 'mono', note: 'Wide, modern monospace. Bold tech branding.', pairsWith: ['Inter'], scripts: ['cyrillic'] },
  { family: 'Victor Mono', role: 'mono', note: 'Narrow mono with cursive italics. Developer personality.', pairsWith: ['Inter'], origin: 'Norway', scripts: ['cyrillic', 'greek', 'vietnamese'] },
  { family: 'Kode Mono', role: 'mono', note: 'Futuristic squared monospace. Hacker and gaming UI.', pairsWith: ['Space Grotesk'] },
  { family: 'Sometype Mono', role: 'mono', note: 'Friendly monospace from the designer of Bebas Neue.', pairsWith: ['Bebas Neue'], origin: 'Japan' },
  { family: 'VT323', role: 'mono', note: 'Old video-terminal bitmap. Retro computing.', pairsWith: ['Press Start 2P'], scripts: ['vietnamese'] },
  { family: 'DotGothic16', role: 'mono', note: 'Japanese pixel gothic. Retro game screens.', pairsWith: ['Press Start 2P'], origin: 'Japan', script: 'japanese', scripts: ['cyrillic', 'japanese'] },

  /* Hand and calligraphy */
  { family: 'Caveat', role: 'hand', note: 'Marker handwriting. Annotations and margin notes.', pairsWith: ['Inter'], origin: 'Argentina', scripts: ['cyrillic'] },
  { family: 'Kalam', role: 'hand', note: 'Handwritten Devanagari and Latin. Notes and personal touches.', pairsWith: ['Hind'], origin: 'India', script: 'devanagari', scripts: ['devanagari'] },
  { family: 'Klee One', role: 'hand', note: 'Japanese pencil-written textbook style. Warm and personal.', pairsWith: ['Zen Maru Gothic'], origin: 'Japan', script: 'japanese', scripts: ['cyrillic', 'greek', 'japanese'] },
  { family: 'Yusei Magic', role: 'hand', note: 'Marker-pen Japanese. Casual cafe menus and notes.', pairsWith: ['Zen Maru Gothic'], origin: 'Japan', script: 'japanese', scripts: ['japanese'] },
  { family: 'Nanum Pen Script', role: 'hand', note: 'Korean ballpoint handwriting. Diaries and doodles.', pairsWith: ['Nanum Gothic'], origin: 'South Korea', script: 'korean', scripts: ['korean'] },
  { family: 'Gaegu', role: 'hand', note: 'Cute, loose Korean handwriting.', pairsWith: ['Gowun Dodum'], origin: 'South Korea', script: 'korean', scripts: ['korean'] },
  { family: 'Ma Shan Zheng', role: 'hand', note: 'Chinese brush calligraphy. Tea, heritage and festivals.', pairsWith: ['Noto Serif SC'], origin: 'China', script: 'chinese', scripts: ['chinese'] },
  { family: 'LXGW WenKai TC', role: 'hand', note: 'Kai regular script for traditional Chinese. Literary warmth.', pairsWith: ['Noto Sans TC'], origin: 'China', script: 'chinese', scripts: ['chinese', 'cyrillic', 'greek', 'vietnamese'] },
  { family: 'Dancing Script', role: 'hand', note: 'Lively connected script. Invitations and boutique brands.', pairsWith: ['Josefin Sans'], origin: 'Argentina', scripts: ['vietnamese'] },
  { family: 'Pacifico', role: 'hand', note: 'Fifties surf-brush script. Beach, food trucks, fun.', pairsWith: ['Quicksand'], scripts: ['cyrillic', 'vietnamese'] },
  { family: 'Permanent Marker', role: 'hand', note: 'Bold felt-tip marker. Handmade labels and zines.', pairsWith: ['Barlow'], origin: 'United States' },
  { family: 'Great Vibes', role: 'hand', note: 'Flowing formal calligraphy. Weddings and fine dining.', pairsWith: ['Cormorant'], origin: 'United States', scripts: ['cyrillic', 'greek', 'vietnamese'] },
  { family: 'Sacramento', role: 'hand', note: 'Monoline retro script. Light, elegant signatures.', pairsWith: ['Josefin Sans'] },
  { family: 'Reenie Beanie', role: 'hand', note: 'Messy ballpoint scrawl. Sticky notes and annotations.', pairsWith: ['Inter'], origin: 'United States' },
]

/** Catalog entries for one role, in catalog order. */
const FONT_CATALOG_BY_FAMILY = new Map(FONT_CATALOG.map((entry) => [entry.family, entry]))

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
  /** The family to load for a preview; absent for system stacks. */
  family?: string
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
    options.push({ label: `${family} (brand)`, value: `${quoteFamily(family)}, system-ui, sans-serif`, role: 'brand', family })
  }
  for (const entry of FONT_CATALOG) {
    options.push({
      label: entry.family,
      value: `${quoteFamily(entry.family)}, ${ROLE_FALLBACK[entry.role]}`,
      role: entry.role,
      family: entry.family,
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
