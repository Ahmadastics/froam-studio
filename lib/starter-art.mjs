/**
 * The pictures a new site starts with: flat drawings in the site's own
 * colours — a dish, a person, a room, a product — in place of empty boxes,
 * until the owner puts their own photos in.
 *
 * Each drawing is a picture frame's background image, set by the page's
 * stylesheet. A photo placed in the frame is the frame's own background, so
 * it replaces the drawing; taking the photo away brings the drawing back.
 * The drawings carry `data-froam-art`, which tells the editor the frame is
 * still waiting for a picture (see readImageUrl in src/editor/chef/dom.ts).
 *
 * Only the stylesheet changes with a style, never the page: the frames say
 * which scene they show (`data-scene`), the colours come from the theme.
 */

/** Which drawing a frame shows, from what its label asks for. */
export function sceneFor(label) {
  const words = String(label).toLowerCase()
  // Numbered things (the first product, the third project) take turns; anything else is picked by its words.
  const nth = ['first', 'second', 'third', 'fourth', 'fifth', 'sixth'].findIndex((word) => words.includes(word))
  const variant = (count) => `-${((nth >= 0 ? nth : hashOf(words)) % count) + 1}`
  if (/screenshot/.test(words)) return 'screen'
  if (/cover image/.test(words)) return `cover${variant(3)}`
  if (/parcel/.test(words)) return 'parcel'
  if (/dish|food|meal/.test(words)) return 'dish'
  if (/product/.test(words)) return `product${variant(3)}`
  if (/make-up|makeup|hairstyle|nails/.test(words)) return 'beauty'
  if (/school grounds|building/.test(words)) return 'building'
  if (/early days|landscape/.test(words)) return 'landscape'
  if (/classroom|students|community|leaders|people behind/.test(words)) return 'group'
  if (/venue|dining|salon|shop|room|office/.test(words)) return 'room'
  return `portrait${variant(3)}`
}

function hashOf(text) {
  let hash = 0
  for (let i = 0; i < text.length; i += 1) hash = (hash * 31 + text.charCodeAt(i)) >>> 0
  return hash
}

/* ── colour ─────────────────────────────────────────────────── */

function rgbOf(hex) {
  const value = String(hex).replace('#', '')
  const full = value.length === 3 ? value.split('').map((c) => c + c).join('') : value.slice(0, 6)
  const n = Number.parseInt(full, 16)
  return Number.isFinite(n) ? [(n >> 16) & 255, (n >> 8) & 255, n & 255] : [128, 128, 128]
}

/** `a` moved toward `b` by `t` (0–1), as #rrggbb. */
function mix(a, b, t) {
  const [r1, g1, b1] = rgbOf(a)
  const [r2, g2, b2] = rgbOf(b)
  const at = (x, y) => Math.round(x + (y - x) * t).toString(16).padStart(2, '0')
  return `#${at(r1, r2)}${at(g1, g2)}${at(b1, b2)}`
}

/**
 * The scene's colours, from the theme. "Toward ink" is toward contrast, so
 * the same drawing works on a light site and a dark one.
 */
function paletteOf(theme) {
  const [r, g, b] = rgbOf(theme.paper)
  const dark = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255 < 0.4
  return {
    // hair stays darker than a face on a light site and a dark one
    hair: dark ? mix(theme.accent, theme.paper, 0.55) : mix(theme.ink, theme.accent, 0.25),
    bg: theme.tint,
    bg2: mix(theme.tint, theme.accent, 0.1),
    soft: mix(theme.accent, theme.paper, 0.68),
    mid: theme.accent,
    deep: mix(theme.accent, theme.ink, 0.5),
    ink: theme.ink,
    object: theme.surface,
    line: mix(theme.ink, theme.tint, 0.78),
    shade: mix(theme.tint, theme.ink, 0.16),
  }
}

/* ── the drawings (480 × 360; what matters stays in the middle 288 × 270,
      so a tall frame and a wide one both crop it well) ──────────── */

const person = (x, y, scale, head, body, hair) => {
  const s = (n) => +(n * scale).toFixed(1)
  return `<path d='M${x - s(94)} ${y + s(160)} C${x - s(94)} ${y + s(70)} ${x - s(52)} ${y + s(24)} ${x} ${y + s(24)} C${x + s(52)} ${y + s(24)} ${x + s(94)} ${y + s(70)} ${x + s(94)} ${y + s(160)} Z' fill='${body}'/>`
    + `<rect x='${x - s(18)}' y='${y - s(12)}' width='${s(36)}' height='${s(46)}' rx='${s(16)}' fill='${head}'/>`
    + `<circle cx='${x}' cy='${y - s(52)}' r='${s(52)}' fill='${head}'/>`
    + (hair ? `<path d='M${x - s(52)} ${y - s(56)} C${x - s(54)} ${y - s(100)} ${x - s(26)} ${y - s(116)} ${x + s(2)} ${y - s(116)} C${x + s(36)} ${y - s(116)} ${x + s(56)} ${y - s(92)} ${x + s(52)} ${y - s(56)} C${x + s(40)} ${y - s(76)} ${x + s(16)} ${y - s(84)} ${x - s(4)} ${y - s(82)} C${x - s(26)} ${y - s(80)} ${x - s(42)} ${y - s(70)} ${x - s(52)} ${y - s(56)} Z' fill='${hair}'/>` : '')
}

const sparkle = (x, y, r, fill) => `<path d='M${x} ${y - r} Q${x} ${y} ${x + r} ${y} Q${x} ${y} ${x} ${y + r} Q${x} ${y} ${x - r} ${y} Q${x} ${y} ${x} ${y - r} Z' fill='${fill}'/>`

const SCENES = {
  dish: (c) => `<rect width='480' height='360' fill='${c.bg}'/>`
    + `<circle cx='250' cy='192' r='114' fill='${c.shade}' opacity='.55'/>`
    + `<circle cx='240' cy='180' r='110' fill='${c.object}'/>`
    + `<circle cx='240' cy='180' r='110' fill='none' stroke='${c.line}' stroke-width='2'/>`
    + `<circle cx='240' cy='180' r='82' fill='none' stroke='${c.line}' stroke-width='1.5'/>`
    + `<circle cx='226' cy='172' r='48' fill='${c.mid}'/>`
    + `<circle cx='264' cy='198' r='34' fill='${c.soft}'/>`
    + `<circle cx='252' cy='158' r='14' fill='${c.deep}'/>`
    + `<circle cx='210' cy='202' r='9' fill='${c.deep}'/>`
    + `<circle cx='238' cy='214' r='6' fill='${c.object}'/>`
    + `<path d='M272 146 Q286 126 306 136 Q296 156 272 146 Z' fill='${c.deep}'/>`
    + `<path d='M196 150 Q200 132 218 132 Q216 150 196 150 Z' fill='${c.deep}' opacity='.8'/>`
    + `<rect x='98' y='92' width='10' height='176' rx='5' fill='${c.deep}' opacity='.7'/>`
    + `<rect x='88' y='92' width='6' height='54' rx='3' fill='${c.deep}' opacity='.7'/><rect x='112' y='92' width='6' height='54' rx='3' fill='${c.deep}' opacity='.7'/>`
    + `<rect x='88' y='138' width='30' height='16' rx='6' fill='${c.deep}' opacity='.7'/>`
    + `<path d='M372 92 Q394 122 384 186 V262 A6 6 0 0 1 372 262 Z' fill='${c.deep}' opacity='.7'/>`,

  portrait: (c, v) => `<rect width='480' height='360' fill='${c.bg}'/>`
    + (v === 1 ? `<circle cx='240' cy='176' r='124' fill='${c.soft}'/>`
      : v === 2 ? `<path d='M128 360 V170 A112 112 0 0 1 352 170 V360 Z' fill='${c.soft}'/>`
      : `<circle cx='176' cy='128' r='70' fill='${c.soft}'/><circle cx='318' cy='214' r='92' fill='${c.bg2}'/>`)
    + person(240, 212, 1, c.deep, c.mid, v === 2 ? c.hair : c.deep)
    + (v === 3 ? '' : `<circle cx='356' cy='96' r='10' fill='${c.mid}' opacity='.5'/>`),

  beauty: (c) => `<rect width='480' height='360' fill='${c.bg}'/>`
    + `<circle cx='240' cy='176' r='124' fill='${c.soft}'/>`
    + `<path d='M178 160 C170 96 206 70 242 70 C284 70 314 100 304 168 C312 220 300 250 290 262 L190 262 C180 248 168 220 178 160 Z' fill='${c.hair}' opacity='.85'/>`
    + person(240, 212, 1, c.deep, c.mid, null)
    + sparkle(334, 108, 18, c.mid) + sparkle(150, 138, 11, c.mid) + sparkle(352, 200, 9, c.deep),

  group: (c) => `<rect width='480' height='360' fill='${c.bg}'/>`
    + `<rect x='70' y='70' width='340' height='300' rx='150' fill='${c.bg2}'/>`
    + person(158, 236, 0.72, c.deep, c.soft, null)
    + person(322, 236, 0.72, c.deep, c.soft, c.hair)
    + person(240, 216, 0.9, c.deep, c.mid, c.hair),

  room: (c) => `<rect width='480' height='360' fill='${c.bg}'/>`
    + `<rect y='266' width='480' height='94' fill='${c.bg2}'/>`
    + `<path d='M126 262 V144 A62 62 0 0 1 250 144 V262 Z' fill='${c.soft}'/>`
    + `<path d='M126 262 V144 A62 62 0 0 1 250 144 V262 Z M188 82 V262 M126 186 H250' fill='none' stroke='${c.object}' stroke-width='6'/>`
    + `<path d='M318 0 V96' stroke='${c.line}' stroke-width='2'/>`
    + `<path d='M290 120 A28 28 0 0 1 346 120 Z' fill='${c.mid}'/>`
    + `<circle cx='318' cy='134' r='34' fill='${c.mid}' opacity='.14'/>`
    + `<rect x='250' y='226' width='140' height='12' rx='6' fill='${c.deep}'/>`
    + `<rect x='264' y='236' width='8' height='54' fill='${c.deep}'/><rect x='368' y='236' width='8' height='54' fill='${c.deep}'/>`
    + `<rect x='298' y='190' width='34' height='36' rx='6' fill='${c.object}'/>`
    + `<path d='M98 290 L104 246 H140 L146 290 Z' fill='${c.mid}'/>`
    + `<ellipse cx='108' cy='222' rx='12' ry='26' fill='${c.deep}' transform='rotate(-24 108 222)'/>`
    + `<ellipse cx='136' cy='216' rx='12' ry='30' fill='${c.deep}' transform='rotate(18 136 216)'/>`
    + `<ellipse cx='122' cy='206' rx='11' ry='32' fill='${c.deep}' opacity='.85'/>`,

  product: (c, v) => `<rect width='480' height='360' fill='${c.bg}'/>`
    + `<circle cx='240' cy='170' r='120' fill='${c.soft}' opacity='.75'/>`
    + `<ellipse cx='240' cy='284' rx='118' ry='18' fill='${c.shade}'/>`
    + `<rect x='150' y='262' width='180' height='24' rx='12' fill='${c.object}'/>`
    + (v === 1
      ? `<rect x='196' y='132' width='88' height='130' rx='20' fill='${c.mid}'/><rect x='202' y='108' width='76' height='32' rx='10' fill='${c.deep}'/><rect x='196' y='176' width='88' height='42' fill='${c.object}'/><rect x='214' y='192' width='52' height='8' rx='4' fill='${c.deep}' opacity='.6'/>`
      : v === 2
        ? `<path d='M222 92 H258 V128 C286 140 296 162 296 190 V246 A16 16 0 0 1 280 262 H200 A16 16 0 0 1 184 246 V190 C184 162 194 140 222 128 Z' fill='${c.mid}'/><rect x='218' y='72' width='44' height='26' rx='8' fill='${c.deep}'/><rect x='184' y='186' width='112' height='46' fill='${c.object}' opacity='.92'/><rect x='206' y='202' width='68' height='8' rx='4' fill='${c.deep}' opacity='.6'/>`
        : `<path d='M240 112 L318 144 V232 L240 264 L162 232 V144 Z' fill='${c.mid}'/><path d='M240 112 L318 144 L240 176 L162 144 Z' fill='${c.soft}'/><path d='M240 176 V264 L162 232 V144 Z' fill='${c.deep}' opacity='.55'/><path d='M200 128 L278 160 V196 L262 202 V166 L184 134 Z' fill='${c.object}' opacity='.8'/>`),

  screen: (c) => `<rect width='480' height='360' fill='${c.bg}'/>`
    + `<rect x='104' y='66' width='280' height='236' rx='14' fill='${c.shade}' opacity='.6'/>`
    + `<rect x='96' y='58' width='288' height='236' rx='14' fill='${c.object}'/>`
    + `<rect x='96' y='58' width='288' height='236' rx='14' fill='none' stroke='${c.line}' stroke-width='2'/>`
    + `<path d='M96 90 H384' stroke='${c.line}' stroke-width='2'/>`
    + `<circle cx='116' cy='74' r='5' fill='${c.mid}'/><circle cx='132' cy='74' r='5' fill='${c.soft}'/><circle cx='148' cy='74' r='5' fill='${c.soft}'/>`
    + `<rect x='118' y='108' width='120' height='14' rx='7' fill='${c.deep}'/>`
    + `<rect x='118' y='132' width='176' height='8' rx='4' fill='${c.line}'/><rect x='118' y='148' width='150' height='8' rx='4' fill='${c.line}'/>`
    + `<rect x='118' y='168' width='72' height='22' rx='11' fill='${c.mid}'/>`
    + `<rect x='118' y='210' width='76' height='64' rx='10' fill='${c.soft}'/><rect x='202' y='210' width='76' height='64' rx='10' fill='${c.bg2}'/><rect x='286' y='210' width='76' height='64' rx='10' fill='${c.soft}'/>`
    + `<circle cx='326' cy='140' r='30' fill='${c.mid}' opacity='.85'/>`,

  cover: (c, v) => (v === 1
    ? `<rect width='480' height='360' fill='${c.soft}'/><circle cx='196' cy='176' r='96' fill='${c.mid}'/><rect x='238' y='118' width='120' height='120' rx='8' fill='${c.deep}' transform='rotate(12 298 178)' opacity='.9'/><circle cx='312' cy='96' r='16' fill='${c.object}'/>`
    : v === 2
      ? `<rect width='480' height='360' fill='${c.deep}'/><circle cx='240' cy='360' r='250' fill='${c.mid}'/><circle cx='240' cy='360' r='180' fill='${c.soft}'/><circle cx='240' cy='360' r='110' fill='${c.object}'/><circle cx='240' cy='360' r='48' fill='${c.mid}'/>`
      : `<rect width='480' height='360' fill='${c.bg}'/><path d='M0 260 L260 0 H340 L0 340 Z' fill='${c.soft}'/><path d='M140 360 L480 20 V110 L230 360 Z' fill='${c.mid}'/><circle cx='330' cy='250' r='54' fill='${c.deep}'/>`),

  parcel: (c) => `<rect width='480' height='360' fill='${c.bg}'/>`
    + `<ellipse cx='244' cy='282' rx='120' ry='16' fill='${c.shade}'/>`
    + `<path d='M150 140 L240 106 L330 140 L240 174 Z' fill='${c.soft}'/>`
    + `<path d='M150 140 L240 174 V280 L150 246 Z' fill='${c.mid}'/>`
    + `<path d='M330 140 L240 174 V280 L330 246 Z' fill='${c.deep}'/>`
    + `<path d='M196 123 L286 157 V190 L270 196 V163 L180 129 Z' fill='${c.object}' opacity='.85'/>`
    + `<path d='M262 200 L306 183 V211 L262 228 Z' fill='${c.object}'/>`,

  building: (c) => `<rect width='480' height='360' fill='${c.bg}'/>`
    + `<rect y='276' width='480' height='84' fill='${c.bg2}'/>`
    + `<path d='M240 48 V100' stroke='${c.deep}' stroke-width='4'/>`
    + `<path d='M242 50 H282 L272 62 L282 74 H242 Z' fill='${c.mid}'/>`
    + `<rect x='148' y='150' width='184' height='128' fill='${c.object}'/>`
    + `<path d='M136 156 L240 96 L344 156 Z' fill='${c.mid}'/>`
    + `<rect x='222' y='218' width='36' height='60' rx='4' fill='${c.deep}'/>`
    + `<rect x='166' y='176' width='34' height='28' rx='3' fill='${c.soft}'/><rect x='280' y='176' width='34' height='28' rx='3' fill='${c.soft}'/>`
    + `<rect x='166' y='226' width='34' height='28' rx='3' fill='${c.soft}'/><rect x='280' y='226' width='34' height='28' rx='3' fill='${c.soft}'/>`
    + `<rect x='108' y='238' width='8' height='40' fill='${c.deep}'/><circle cx='112' cy='222' r='30' fill='${c.deep}' opacity='.85'/>`
    + `<rect x='364' y='238' width='8' height='40' fill='${c.deep}'/><circle cx='368' cy='216' r='36' fill='${c.deep}' opacity='.85'/>`,

  landscape: (c) => `<rect width='480' height='360' fill='${c.bg}'/>`
    + `<circle cx='330' cy='118' r='42' fill='${c.soft}'/>`
    + `<path d='M0 250 C90 170 170 180 250 226 C320 190 400 168 480 214 V360 H0 Z' fill='${c.mid}' opacity='.55'/>`
    + `<path d='M0 290 C110 230 210 250 290 280 C360 256 420 250 480 270 V360 H0 Z' fill='${c.deep}'/>`
    + `<path d='M226 360 C238 320 262 300 300 282' stroke='${c.object}' stroke-width='10' fill='none' stroke-linecap='round' opacity='.8'/>`
    + `<path d='M150 120 q10 -8 20 0 q10 -8 20 0' stroke='${c.deep}' stroke-width='3' fill='none' stroke-linecap='round'/>`,
}

/** The scenes there are, by the name a frame's data-scene gives. */
export function sceneNames() {
  const names = []
  for (const base of Object.keys(SCENES)) {
    if (['portrait', 'product', 'cover'].includes(base)) for (const v of [1, 2, 3]) names.push(`${base}-${v}`)
    else names.push(base)
  }
  return names
}

function drawing(scene, palette) {
  const [base, variant] = scene.split('-')
  const draw = SCENES[base]
  if (!draw) return null
  const body = draw(palette, Number(variant) || 1)
  return `<svg xmlns='http://www.w3.org/2000/svg' data-froam-art='${scene}' viewBox='0 0 480 360' preserveAspectRatio='xMidYMid slice'>${body}</svg>`
}

/** An SVG as a CSS url(): only what a data URI needs escaped is. */
function dataUri(svg) {
  return `url("data:image/svg+xml,${svg.replace(/%/g, '%25').replace(/#/g, '%23').replace(/</g, '%3C').replace(/>/g, '%3E').replace(/"/g, "'").replace(/\s+/g, ' ')}")`
}

/** The stylesheet rules that draw the scenes a page uses, in the theme's colours. */
export function artStylesheet(theme, scenes) {
  const palette = paletteOf(theme)
  return [...new Set(scenes)].sort().map((scene) => {
    const svg = drawing(scene, palette)
    return svg ? `\n    .photo[data-scene="${scene}"] { background-image: ${dataUri(svg)}; }` : ''
  }).join('')
}

/** The scenes a page's markup asks for. */
export function scenesIn(html) {
  return [...String(html).matchAll(/data-scene="([a-z0-9-]+)"/g)].map((match) => match[1])
}
