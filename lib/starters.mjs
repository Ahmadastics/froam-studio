/**
 * Starter sites for `froam new`: a real page to edit for someone who has no
 * website yet.
 *
 * Every starter is one plain index.html: semantic markup, one stylesheet in
 * its <head>, no build step and no framework. It can be opened, hosted or
 * handed to a developer as it is. Froam's two shipping tags are already in
 * place, so edits saved in the editor reach visitors with nothing to wire.
 *
 * Two rules keep a starter friendly to the editor:
 *   - Every piece of text is different from every other. Copy write-back
 *     (source-writeback.mjs) only writes an edit into index.html when the
 *     original text appears exactly once, so a repeated placeholder would
 *     stay a runtime override instead of becoming the user's own HTML.
 *   - The look lives in a handful of custom properties, and the page uses
 *     them the way the Library's theme sampler reads a site (a filled
 *     button for the brand colour, cards for the radius, a logo link and a
 *     header nav). Sections added later from the Library match the starter.
 *
 * Nothing here pretends to work when it doesn't: there is no backend, so
 * there are no forms, only mailto: and tel: links a static host can serve.
 */

import { artStylesheet, sceneFor, scenesIn } from './starter-art.mjs'

export const STARTER_KINDS = [
  { id: 'business', label: 'Business or services', hint: 'a clinic, a consultant, a repair shop, a trade' },
  { id: 'restaurant', label: 'Restaurant or café', hint: 'a menu, opening hours, how to order' },
  { id: 'salon', label: 'Salon or beauty', hint: 'treatments and prices, your work, bookings' },
  { id: 'shop', label: 'Shop', hint: 'products and prices, how to order, delivery' },
  { id: 'school', label: 'School or classes', hint: 'programmes, fees, visits, admissions' },
  { id: 'community', label: 'Church, mosque or community', hint: 'meeting times, who you are, how to join' },
  { id: 'portfolio', label: 'Portfolio', hint: 'your work, your story, a way to reach you' },
  { id: 'product', label: 'Product or startup', hint: 'features, pricing, questions, sign-up' },
  { id: 'event', label: 'Event', hint: 'the date, the schedule, speakers, tickets' },
  { id: 'blank', label: 'Blank page', hint: 'a header, a title and a footer; add sections from the Library' },
]

const THEMES = {
  business: {
    heading: 'Fraunces', headingWeights: '600;700',
    paper: '#fbfaf7', surface: '#ffffff', ink: '#1c1917', muted: '#57534e', tint: '#eef2fb', line: 'rgba(28, 25, 23, 0.12)',
    accent: '#1d4ed8', accentInk: '#ffffff', radius: '16px', buttonRadius: '999px',
  },
  portfolio: {
    heading: 'Space Grotesk', headingWeights: '500;700',
    paper: '#ffffff', surface: '#ffffff', ink: '#111111', muted: '#52525b', tint: '#f6f3ef', line: 'rgba(17, 17, 17, 0.12)',
    accent: '#c2410c', accentInk: '#ffffff', radius: '6px', buttonRadius: '6px',
  },
  product: {
    heading: 'Plus Jakarta Sans', headingWeights: '700;800',
    paper: '#ffffff', surface: '#ffffff', ink: '#0f172a', muted: '#475569', tint: '#f5f3ff', line: 'rgba(15, 23, 42, 0.1)',
    accent: '#6d28d9', accentInk: '#ffffff', radius: '18px', buttonRadius: '12px',
  },
  event: {
    heading: 'Bricolage Grotesque', headingWeights: '600;800',
    paper: '#0c0a09', surface: '#1c1917', ink: '#fafaf9', muted: '#a8a29e', tint: '#1f1712', line: 'rgba(250, 250, 249, 0.14)',
    accent: '#f97316', accentInk: '#111111', radius: '14px', buttonRadius: '999px',
  },
  restaurant: {
    heading: 'Playfair Display', headingWeights: '700;800',
    paper: '#fffaf3', surface: '#ffffff', ink: '#2a1a12', muted: '#6f5848', tint: '#fbeee0', line: 'rgba(42, 26, 18, 0.12)',
    accent: '#b91c1c', accentInk: '#ffffff', radius: '14px', buttonRadius: '999px',
  },
  salon: {
    heading: 'Cormorant Garamond', headingWeights: '600;700',
    paper: '#fdf8f6', surface: '#ffffff', ink: '#2b1b1f', muted: '#6e565c', tint: '#f8e9ec', line: 'rgba(43, 27, 31, 0.1)',
    accent: '#9d174d', accentInk: '#ffffff', radius: '20px', buttonRadius: '999px',
  },
  shop: {
    heading: 'Archivo', headingWeights: '700;800',
    paper: '#ffffff', surface: '#ffffff', ink: '#111827', muted: '#4b5563', tint: '#f3f4f6', line: 'rgba(17, 24, 39, 0.1)',
    accent: '#15803d', accentInk: '#ffffff', radius: '12px', buttonRadius: '10px',
  },
  school: {
    heading: 'Nunito', headingWeights: '700;800',
    paper: '#f8fbff', surface: '#ffffff', ink: '#0f1f3a', muted: '#4a5b78', tint: '#e8f1fd', line: 'rgba(15, 31, 58, 0.1)',
    accent: '#1e40af', accentInk: '#ffffff', radius: '16px', buttonRadius: '12px',
  },
  community: {
    heading: 'Lora', headingWeights: '600;700',
    paper: '#fbfaf8', surface: '#ffffff', ink: '#1d1b16', muted: '#5f5a4f', tint: '#f1ede3', line: 'rgba(29, 27, 22, 0.12)',
    accent: '#7c4a03', accentInk: '#ffffff', radius: '14px', buttonRadius: '999px',
  },
  blank: {
    heading: 'Inter', headingWeights: '700',
    paper: '#ffffff', surface: '#ffffff', ink: '#18181b', muted: '#52525b', tint: '#f0fdfa', line: 'rgba(24, 24, 27, 0.12)',
    accent: '#0f766e', accentInk: '#ffffff', radius: '14px', buttonRadius: '10px',
  },
}

/**
 * Styles a starter can wear, grouped by mood. Each is a whole theme, so it
 * changes only the custom properties and fonts in <head>: the markup, and with
 * it every element path and every saved edit, stays the same whichever style
 * a site wears or switches to. `original` is the kind's own theme. Every style
 * keeps body text, muted text, accent text and button text at 4.5:1 or better
 * against what they sit on (scripts/test-new.mjs checks).
 */
export const STARTER_STYLES = [
  { id: 'original', label: 'Original', mood: 'Made for it' },
  {
    id: 'monochrome', label: 'Monochrome', mood: 'Clean',
    theme: { heading: 'Inter', headingWeights: '700;800', paper: '#ffffff', surface: '#ffffff', ink: '#0a0a0a', muted: '#525252', tint: '#f5f5f5', line: 'rgba(10, 10, 10, 0.12)', accent: '#0a0a0a', accentInk: '#ffffff', radius: '4px', buttonRadius: '4px' },
  },
  {
    id: 'ocean', label: 'Ocean', mood: 'Clean',
    theme: { heading: 'Manrope', headingWeights: '700;800', paper: '#ffffff', surface: '#ffffff', ink: '#0c1a2b', muted: '#475569', tint: '#f0f9ff', line: 'rgba(12, 26, 43, 0.1)', accent: '#0369a1', accentInk: '#ffffff', radius: '16px', buttonRadius: '999px' },
  },
  {
    id: 'mint', label: 'Mint', mood: 'Clean',
    theme: { heading: 'DM Sans', headingWeights: '600;700', paper: '#f7fdfb', surface: '#ffffff', ink: '#0f2a22', muted: '#4b635a', tint: '#e7f8f1', line: 'rgba(15, 42, 34, 0.1)', accent: '#047857', accentInk: '#ffffff', radius: '14px', buttonRadius: '10px' },
  },
  {
    id: 'terracotta', label: 'Terracotta', mood: 'Warm',
    theme: { heading: 'Fraunces', headingWeights: '600;700', paper: '#fbf6f0', surface: '#fffaf5', ink: '#2b1d16', muted: '#6b5547', tint: '#f6e7dc', line: 'rgba(43, 29, 22, 0.12)', accent: '#c2410c', accentInk: '#ffffff', radius: '18px', buttonRadius: '999px' },
  },
  {
    id: 'bakery', label: 'Bakery', mood: 'Warm',
    theme: { heading: 'Playfair Display', headingWeights: '700;800', paper: '#fdf8ef', surface: '#fffcf6', ink: '#3b2a1a', muted: '#76604d', tint: '#f6ead3', line: 'rgba(59, 42, 26, 0.12)', accent: '#92400e', accentInk: '#ffffff', radius: '10px', buttonRadius: '10px' },
  },
  {
    id: 'sunset', label: 'Sunset', mood: 'Warm',
    theme: { heading: 'Bricolage Grotesque', headingWeights: '600;800', paper: '#fff7f3', surface: '#ffffff', ink: '#2a1215', muted: '#6b4b50', tint: '#ffe8de', line: 'rgba(42, 18, 21, 0.1)', accent: '#d61f45', accentInk: '#ffffff', radius: '20px', buttonRadius: '999px' },
  },
  {
    id: 'electric', label: 'Electric', mood: 'Bold',
    theme: { heading: 'Plus Jakarta Sans', headingWeights: '700;800', paper: '#ffffff', surface: '#ffffff', ink: '#0f172a', muted: '#475569', tint: '#eef2ff', line: 'rgba(15, 23, 42, 0.1)', accent: '#4f46e5', accentInk: '#ffffff', radius: '18px', buttonRadius: '12px' },
  },
  {
    id: 'citrus', label: 'Citrus', mood: 'Bold',
    theme: { heading: 'Space Grotesk', headingWeights: '500;700', paper: '#fffdf2', surface: '#ffffff', ink: '#1c1917', muted: '#57534e', tint: '#fef3c7', line: 'rgba(28, 25, 23, 0.12)', accent: '#b45309', accentInk: '#ffffff', radius: '8px', buttonRadius: '8px' },
  },
  {
    id: 'lavender', label: 'Lavender', mood: 'Soft',
    theme: { heading: 'Outfit', headingWeights: '600;700', paper: '#fbfaff', surface: '#ffffff', ink: '#1e1b2e', muted: '#5b5675', tint: '#f1edff', line: 'rgba(30, 27, 46, 0.1)', accent: '#7c3aed', accentInk: '#ffffff', radius: '24px', buttonRadius: '999px' },
  },
  {
    id: 'sage', label: 'Sage', mood: 'Soft',
    theme: { heading: 'Lora', headingWeights: '600;700', paper: '#f7f8f3', surface: '#fcfdf9', ink: '#1f2a1f', muted: '#56635a', tint: '#e8eee2', line: 'rgba(31, 42, 31, 0.12)', accent: '#4d7c0f', accentInk: '#ffffff', radius: '14px', buttonRadius: '999px' },
  },
  {
    id: 'midnight', label: 'Midnight', mood: 'Dark',
    theme: { heading: 'Sora', headingWeights: '600;700', paper: '#0b1120', surface: '#111a2e', ink: '#e5ecf6', muted: '#94a3b8', tint: '#121c33', line: 'rgba(229, 236, 246, 0.12)', accent: '#38bdf8', accentInk: '#04121f', radius: '16px', buttonRadius: '12px' },
  },
  {
    id: 'noir', label: 'Noir', mood: 'Dark',
    theme: { heading: 'Syne', headingWeights: '700;800', paper: '#0a0a0a', surface: '#161616', ink: '#fafafa', muted: '#a3a3a3', tint: '#141414', line: 'rgba(250, 250, 250, 0.12)', accent: '#f97316', accentInk: '#111111', radius: '6px', buttonRadius: '999px' },
  },
]

export function isStarterStyle(style) {
  return STARTER_STYLES.some((entry) => entry.id === style)
}

/** The theme a starter wears: the style's, or the kind's own for `original` (and anything unknown). */
export function starterTheme(kind = 'business', style = 'original') {
  return STARTER_STYLES.find((entry) => entry.id === style)?.theme ?? THEMES[kind] ?? THEMES.business
}

export function isStarterKind(kind) {
  return STARTER_KINDS.some((entry) => entry.id === kind)
}

export const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character])

/** A folder name for a site name: "Ade's Bakery" → "ades-bakery". */
export function slugify(name) {
  const slug = String(name)
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48)
    .replace(/-+$/g, '')
  return slug || 'my-website'
}

/** A site name for a folder name: "ades-bakery" → "Ades Bakery". */
export function titleFromFolder(folder) {
  const words = String(folder).split(/[-_\s]+/).filter(Boolean)
  if (!words.length) return 'My website'
  return words.map((word) => word[0].toUpperCase() + word.slice(1)).join(' ')
}

function fontsHref(theme) {
  const families = [`family=${theme.heading.replace(/ /g, '+')}:wght@${theme.headingWeights}`]
  if (theme.heading !== 'Inter') families.push('family=Inter:wght@400;500;600;700')
  else families[0] = 'family=Inter:wght@400;500;600;700'
  return `https://fonts.googleapis.com/css2?${families.join('&')}&display=swap`
}

/** The site's initial in its brand colour: a favicon that needs no file. */
function favicon(name, theme) {
  const initial = escapeHtml((String(name).trim()[0] ?? 'F').toUpperCase())
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'><rect width='64' height='64' rx='14' fill='${theme.accent}'/><text x='32' y='44' font-family='Arial,sans-serif' font-size='34' font-weight='700' text-anchor='middle' fill='${theme.accentInk}'>${initial}</text></svg>`
  return `data:image/svg+xml,${encodeURIComponent(svg)}`
}

function stylesheet(theme) {
  return `
    :root {
      --paper: ${theme.paper};
      --surface: ${theme.surface};
      --ink: ${theme.ink};
      --muted: ${theme.muted};
      --tint: ${theme.tint};
      --line: ${theme.line};
      --accent: ${theme.accent};
      --accent-ink: ${theme.accentInk};
      --radius: ${theme.radius};
      --button-radius: ${theme.buttonRadius};
      --max: 1120px;
      --font-body: 'Inter', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
      --font-heading: '${theme.heading}', 'Inter', system-ui, sans-serif;
    }
    *, *::before, *::after { box-sizing: border-box; }
    html { scroll-behavior: smooth; }
    body { margin: 0; background: var(--paper); color: var(--ink); font: 400 1rem/1.65 var(--font-body); -webkit-font-smoothing: antialiased; }
    img { display: block; max-width: 100%; }
    a { color: inherit; }
    h1, h2, h3 { margin: 0; font-family: var(--font-heading); font-weight: 700; line-height: 1.08; letter-spacing: -0.02em; }
    h1 { font-size: clamp(2.6rem, 6.4vw, 4.9rem); }
    h2 { font-size: clamp(2rem, 4vw, 3rem); }
    h3 { font-size: 1.2rem; letter-spacing: -0.01em; }
    p { margin: 0; }
    .wrap { width: min(100% - 40px, var(--max)); margin-inline: auto; }

    .site-header { position: sticky; top: 0; z-index: 20; background: color-mix(in srgb, var(--paper) 90%, transparent); backdrop-filter: blur(12px); border-bottom: 1px solid var(--line); }
    .site-header .wrap { display: flex; align-items: center; justify-content: space-between; gap: 12px 24px; min-height: 68px; flex-wrap: wrap; }
    .logo { font-family: var(--font-heading); font-size: 1.2rem; font-weight: 700; letter-spacing: -0.01em; text-decoration: none; }
    .nav { display: flex; align-items: center; gap: 24px; margin-left: auto; }
    .nav a { color: var(--muted); font-weight: 500; text-decoration: none; white-space: nowrap; }
    .nav a:hover { color: var(--ink); }

    .button { display: inline-flex; align-items: center; justify-content: center; min-height: 48px; padding: 0 22px; white-space: nowrap; border: 1px solid var(--accent); border-radius: var(--button-radius); background: var(--accent); color: var(--accent-ink); font-weight: 600; text-decoration: none; transition: transform 0.15s ease, box-shadow 0.15s ease; }
    .button:hover { transform: translateY(-1px); box-shadow: 0 8px 24px color-mix(in srgb, var(--accent) 30%, transparent); }
    .button.ghost { border-color: var(--line); background: transparent; color: var(--ink); }
    .button.ghost:hover { box-shadow: none; border-color: var(--ink); }
    .header-cta { min-height: 40px; padding: 0 18px; }

    section { padding: clamp(64px, 10vw, 120px) 0; }
    .tinted { background: var(--tint); }
    .eyebrow { display: inline-block; margin-bottom: 18px; color: var(--accent); font-size: 0.78rem; font-weight: 600; letter-spacing: 0.14em; text-transform: uppercase; }
    .lead { max-width: 58ch; margin-top: 22px; color: var(--muted); font-size: clamp(1.05rem, 1.6vw, 1.25rem); }
    .actions { display: flex; flex-wrap: wrap; gap: 12px; margin-top: 34px; }
    .section-head { max-width: 680px; margin-bottom: 48px; }
    .section-head p { margin-top: 16px; color: var(--muted); }
    .centered { margin-inline: auto; text-align: center; }
    .centered .lead { margin-inline: auto; }
    .centered .actions { justify-content: center; }

    .hero { padding-top: clamp(72px, 12vw, 136px); }
    .split { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 340px), 1fr)); gap: clamp(32px, 6vw, 72px); align-items: center; }
    .photo { aspect-ratio: 4 / 3; border-radius: var(--radius); background: linear-gradient(135deg, var(--tint), color-mix(in srgb, var(--accent) 30%, var(--surface))) center / cover no-repeat; }
    .photo.wide { aspect-ratio: 16 / 9; margin-top: clamp(48px, 8vw, 80px); box-shadow: 0 30px 80px color-mix(in srgb, var(--ink) 14%, transparent); }
    .photo.portrait { aspect-ratio: 4 / 5; }

    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 260px), 1fr)); gap: 20px; }
    .grid.two { grid-template-columns: repeat(auto-fit, minmax(min(100%, 380px), 1fr)); gap: 32px; }
    .card { padding: 30px; border: 1px solid var(--line); border-radius: var(--radius); background: var(--surface); }
    .card p { margin-top: 10px; color: var(--muted); }
    .card .number { display: inline-grid; place-items: center; width: 40px; height: 40px; margin-bottom: 22px; border-radius: 50%; background: var(--accent); color: var(--accent-ink); font-weight: 700; }
    .work h3 { margin-top: 18px; }
    .work p { margin-top: 4px; color: var(--muted); }

    .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 24px; margin-top: 40px; }
    .stats strong { display: block; font-family: var(--font-heading); font-size: 2.4rem; line-height: 1; }
    .stats span { color: var(--muted); }

    .quote { max-width: 30ch; margin: 0; font-family: var(--font-heading); font-size: clamp(1.6rem, 3.4vw, 2.5rem); line-height: 1.25; letter-spacing: -0.01em; }
    .quote-by { margin-top: 24px; color: var(--muted); }

    .price { display: flex; flex-direction: column; gap: 6px; }
    .price strong { font-family: var(--font-heading); font-size: 3rem; line-height: 1.1; }
    .price ul { margin: 18px 0 28px; padding-left: 20px; color: var(--muted); }
    .price ul li + li { margin-top: 6px; }
    .price .button { margin-top: auto; }
    .featured { border: 2px solid var(--accent); }

    .faq { max-width: 760px; }
    .faq details { padding: 22px 0; border-top: 1px solid var(--line); }
    .faq details:last-child { border-bottom: 1px solid var(--line); }
    .faq summary { cursor: pointer; font-weight: 600; font-size: 1.1rem; }
    .faq details p { margin-top: 12px; color: var(--muted); }

    .agenda { display: grid; border-top: 1px solid var(--line); }
    .agenda div { display: grid; grid-template-columns: minmax(80px, 140px) 1fr; gap: 20px; padding: 22px 0; border-bottom: 1px solid var(--line); }
    .agenda time { color: var(--accent); font-weight: 600; font-variant-numeric: tabular-nums; }
    .agenda p { color: var(--muted); }

    .big-link { display: inline-block; margin-top: 28px; font-family: var(--font-heading); font-size: clamp(1.8rem, 5vw, 3.6rem); font-weight: 700; letter-spacing: -0.02em; text-decoration-thickness: 2px; text-underline-offset: 8px; }
    .band { padding: clamp(48px, 8vw, 88px); border-radius: var(--radius); background: var(--accent); color: var(--accent-ink); }
    .band .lead { color: inherit; opacity: 0.86; }
    .band .button { border-color: var(--accent-ink); background: var(--accent-ink); color: var(--accent); }

    .site-footer { padding: 40px 0; border-top: 1px solid var(--line); color: var(--muted); }
    .site-footer .wrap { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 16px; }
    .site-footer nav { display: flex; gap: 20px; }
    .site-footer a { text-decoration: none; }
    .site-footer a:hover { color: var(--ink); }
    .site-footer .made-with { margin: 18px 0 0; text-align: center; font-size: 11px; letter-spacing: 0.02em; opacity: 0.55; }
    .site-footer .made-with a { color: inherit; }

    .dish-price { margin-top: 14px !important; color: var(--accent) !important; font-weight: 700; }
    .whatsapp { position: fixed; right: 18px; bottom: 18px; z-index: 30; display: inline-flex; align-items: center; gap: 10px; min-height: 52px; padding: 0 20px 0 16px; border-radius: 999px; background: #1f8f4e; color: #ffffff; font-weight: 600; text-decoration: none; box-shadow: 0 12px 30px rgba(0, 0, 0, 0.22); transition: transform 0.15s ease; }
    .whatsapp:hover { transform: translateY(-2px); }

    @media (max-width: 640px) {
      .site-header .wrap { padding: 12px 0; }
      .header-cta { order: 1; margin-left: auto; }
      .nav { order: 2; width: 100%; gap: 20px; margin-left: 0; overflow-x: auto; }
    }
    @media (prefers-reduced-motion: reduce) {
      html { scroll-behavior: auto; }
      .button { transition: none; }
    }`
}

const photo = (label, extra = '') => `<div class="photo${extra ? ` ${extra}` : ''}" data-froam-image-frame="true" data-scene="${sceneFor(label)}" role="img" aria-label="${escapeHtml(label)}" title="Select this and add a picture"></div>`

function header(name, links, cta) {
  const nav = links.map(([href, label]) => `<a href="${href}">${label}</a>`).join('\n          ')
  return `<header class="site-header">
      <div class="wrap">
        <a class="logo" href="#top">${name}</a>
        <nav class="nav" aria-label="Main">
          ${nav}
        </nav>${cta ? `\n        <a class="button header-cta" href="${cta[0]}">${cta[1]}</a>` : ''}
      </div>
    </header>`
}

function footer(name, year, links = []) {
  const nav = links.length
    ? `\n        <nav aria-label="Footer">\n          ${links.map(([href, label]) => `<a href="${href}">${label}</a>`).join('\n          ')}\n        </nav>`
    : ''
  return `<footer class="site-footer">
      <div class="wrap">
        <p>&copy; ${year} ${name}. All rights reserved.</p>${nav}
      </div>
      <p class="made-with"><a href="${FROAM_HOME}" rel="noopener">Made with Froam</a></p>
    </footer>`
}

/* ── the pages ─────────────────────────────────────────────── */

function businessPage(name, year) {
  return {
    description: `${name}: what we do, who we do it for, and how to reach us.`,
    body: `${header(name, [['#services', 'Services'], ['#about', 'About'], ['#reviews', 'Reviews']], ['#contact', 'Get in touch'])}

    <main id="top">
      <section class="hero">
        <div class="wrap split">
          <div>
            <span class="eyebrow">Welcome to ${name}</span>
            <h1>Good work, done properly, close to home.</h1>
            <p class="lead">Say in one sentence what you do, who it is for, and why people choose you. Click any text on this page to change it.</p>
            <div class="actions">
              <a class="button" href="#services">See our services</a>
              <a class="button ghost" href="#contact">Contact us</a>
            </div>
          </div>
          ${photo('A photo of your shop, your team or your work')}
        </div>
      </section>

      <section id="services">
        <div class="wrap">
          <div class="section-head">
            <span class="eyebrow">What we do</span>
            <h2>Services built around your day</h2>
            <p>Three things people come to you for. Keep each one short and specific.</p>
          </div>
          <div class="grid">
            <article class="card">
              <h3>Consultations</h3>
              <p>What happens in a first visit, how long it takes, and what it costs.</p>
            </article>
            <article class="card">
              <h3>Full service</h3>
              <p>Your main offer. Describe the result people get, not just the steps.</p>
            </article>
            <article class="card">
              <h3>Ongoing care</h3>
              <p>For returning customers: plans, repeat visits or maintenance.</p>
            </article>
          </div>
        </div>
      </section>

      <section id="about" class="tinted">
        <div class="wrap split">
          ${photo('A photo of the people behind the business', 'portrait')}
          <div>
            <span class="eyebrow">About us</span>
            <h2>A small team that cares about the details</h2>
            <p class="lead">How you started, what you believe in, and what a customer can always count on from you.</p>
            <div class="stats">
              <div><strong>12+</strong><span>Years in business</span></div>
              <div><strong>1,400</strong><span>Happy customers</span></div>
              <div><strong>4.9&#9733;</strong><span>Average rating</span></div>
            </div>
          </div>
        </div>
      </section>

      <section id="reviews">
        <div class="wrap">
          <span class="eyebrow">Kind words</span>
          <blockquote class="quote">&ldquo;On time, honest about the price, and the result was better than we hoped.&rdquo;</blockquote>
          <p class="quote-by">Customer name, their town</p>
        </div>
      </section>

      <section id="contact" class="tinted">
        <div class="wrap">
          <div class="section-head">
            <span class="eyebrow">Visit or call</span>
            <h2>Let&rsquo;s talk about what you need</h2>
            <p>The fastest ways to reach you, and when you are open.</p>
          </div>
          <div class="grid">
            <article class="card">
              <h3>Email</h3>
              <p><a href="mailto:hello@example.com">hello@example.com</a></p>
            </article>
            <article class="card">
              <h3>Phone</h3>
              <p><a href="tel:+15550100">+1 555 0100</a></p>
            </article>
            <article class="card">
              <h3>Find us</h3>
              <p>12 Market Street, Your City. Open Monday to Saturday, 9am to 6pm.</p>
            </article>
          </div>
        </div>
      </section>
    </main>

    ${footer(name, year, [['#services', 'Our services'], ['#contact', 'Contact']])}`,
  }
}

function portfolioPage(name, year) {
  return {
    description: `${name}: selected work, a little about me, and how to get in touch.`,
    body: `${header(name, [['#work', 'Work'], ['#about', 'About'], ['#contact', 'Contact']])}

    <main id="top">
      <section class="hero">
        <div class="wrap">
          <span class="eyebrow">Hello, I&rsquo;m ${name}</span>
          <h1>I design things people enjoy using.</h1>
          <p class="lead">One line on what you do, who you do it for, and what you would like to work on next.</p>
          <div class="actions">
            <a class="button" href="#work">See my work</a>
            <a class="button ghost" href="#contact">Get in touch</a>
          </div>
        </div>
      </section>

      <section id="work">
        <div class="wrap">
          <div class="section-head">
            <span class="eyebrow">Selected work</span>
            <h2>Projects I&rsquo;m proud of</h2>
          </div>
          <div class="grid two">
            <article class="work">
              ${photo('Cover image for the first project')}
              <h3>Northwind rebrand</h3>
              <p>Identity, 2026</p>
            </article>
            <article class="work">
              ${photo('Cover image for the second project')}
              <h3>Harbor mobile app</h3>
              <p>Product design, 2025</p>
            </article>
            <article class="work">
              ${photo('Cover image for the third project')}
              <h3>Field Notes magazine</h3>
              <p>Editorial, 2025</p>
            </article>
            <article class="work">
              ${photo('Cover image for the fourth project')}
              <h3>Kiln &amp; Co. website</h3>
              <p>Web design, 2024</p>
            </article>
          </div>
        </div>
      </section>

      <section id="about" class="tinted">
        <div class="wrap split">
          <div>
            <span class="eyebrow">Behind the work</span>
            <h2>A little about me</h2>
            <p class="lead">Where you are based, how you work, and the kind of people and teams you like working with.</p>
            <div class="stats">
              <div><strong>8</strong><span>Years of practice</span></div>
              <div><strong>60+</strong><span>Projects shipped</span></div>
            </div>
          </div>
          ${photo('A portrait of you', 'portrait')}
        </div>
      </section>

      <section id="contact">
        <div class="wrap">
          <span class="eyebrow">Say hello</span>
          <h2>Have a project in mind?</h2>
          <a class="big-link" href="mailto:hello@example.com">hello@example.com</a>
        </div>
      </section>
    </main>

    ${footer(name, year, [['#', 'Instagram'], ['#', 'LinkedIn']])}`,
  }
}

function productPage(name, year) {
  return {
    description: `${name}: what it does, how it works, and what it costs.`,
    body: `${header(name, [['#features', 'Features'], ['#how', 'How it works'], ['#pricing', 'Pricing'], ['#faq', 'FAQ']], ['#pricing', 'Get started'])}

    <main id="top">
      <section class="hero">
        <div class="wrap">
          <div class="centered" style="max-width: 860px;">
            <span class="eyebrow">Introducing ${name}</span>
            <h1>The simplest way to get your work done.</h1>
            <p class="lead">Explain the problem you solve and the outcome people get, in a sentence a stranger would understand.</p>
            <div class="actions">
              <a class="button" href="#pricing">Start for free</a>
              <a class="button ghost" href="#how">See how it works</a>
            </div>
          </div>
          ${photo('A screenshot of your product', 'wide')}
        </div>
      </section>

      <section id="features">
        <div class="wrap">
          <div class="section-head">
            <span class="eyebrow">Why people switch</span>
            <h2>Everything you need, nothing you don&rsquo;t</h2>
          </div>
          <div class="grid">
            <article class="card">
              <h3>Set up in minutes</h3>
              <p>No manual, no training. People get value on their first visit.</p>
            </article>
            <article class="card">
              <h3>Works everywhere</h3>
              <p>On a laptop, a tablet or a phone, with the same experience.</p>
            </article>
            <article class="card">
              <h3>Private by default</h3>
              <p>Say plainly what happens to your customers&rsquo; data.</p>
            </article>
          </div>
        </div>
      </section>

      <section id="how" class="tinted">
        <div class="wrap">
          <div class="section-head">
            <span class="eyebrow">Getting started</span>
            <h2>Three steps to the result</h2>
          </div>
          <div class="grid">
            <article class="card">
              <span class="number">1</span>
              <h3>Create an account</h3>
              <p>Sign up with an email address. It takes under a minute.</p>
            </article>
            <article class="card">
              <span class="number">2</span>
              <h3>Bring your work in</h3>
              <p>Import what you already have, or start from a template.</p>
            </article>
            <article class="card">
              <span class="number">3</span>
              <h3>Share the result</h3>
              <p>Send a link, invite your team, and see what happens next.</p>
            </article>
          </div>
        </div>
      </section>

      <section id="pricing">
        <div class="wrap">
          <div class="section-head centered">
            <span class="eyebrow">Plans</span>
            <h2>Simple plans that grow with you</h2>
          </div>
          <div class="grid" style="max-width: 820px; margin-inline: auto;">
            <article class="card price">
              <h3>Starter</h3>
              <strong>$0</strong>
              <p>For trying it out on your own.</p>
              <ul>
                <li>One project</li>
                <li>Community support</li>
              </ul>
              <a class="button ghost" href="mailto:hello@example.com">Start free</a>
            </article>
            <article class="card price featured">
              <h3>Pro</h3>
              <strong>$12</strong>
              <p>Per month, for people who rely on it.</p>
              <ul>
                <li>Unlimited projects</li>
                <li>Priority email support</li>
              </ul>
              <a class="button" href="mailto:hello@example.com?subject=Pro%20plan">Choose Pro</a>
            </article>
          </div>
        </div>
      </section>

      <section id="faq" class="tinted">
        <div class="wrap">
          <div class="section-head">
            <span class="eyebrow">Good questions</span>
            <h2>Questions people ask</h2>
          </div>
          <div class="faq">
            <details>
              <summary>Is there a free trial?</summary>
              <p>Answer the question people ask most before they sign up.</p>
            </details>
            <details>
              <summary>Can I cancel at any time?</summary>
              <p>Be direct about contracts, refunds and what happens to their data.</p>
            </details>
            <details>
              <summary>Who is it for?</summary>
              <p>Describe the person who gets the most out of it, in their words.</p>
            </details>
          </div>
        </div>
      </section>

      <section>
        <div class="wrap">
          <div class="band centered">
            <h2>Ready when you are.</h2>
            <p class="lead">Start free today. Upgrade when it earns its place.</p>
            <div class="actions">
              <a class="button" href="#pricing">Get started for free</a>
            </div>
          </div>
        </div>
      </section>
    </main>

    ${footer(name, year, [['#features', 'Product'], ['mailto:hello@example.com', 'Support']])}`,
  }
}

function eventPage(name, year) {
  return {
    description: `${name}: the date, the schedule, the speakers and tickets.`,
    body: `${header(name, [['#schedule', 'Schedule'], ['#speakers', 'Speakers'], ['#venue', 'Venue']], ['#tickets', 'Get tickets'])}

    <main id="top">
      <section class="hero">
        <div class="wrap">
          <span class="eyebrow">Saturday 14 November ${year} &middot; Your City</span>
          <h1>${name} ${year}</h1>
          <p class="lead">One day of talks, workshops and good conversation. Say who it is for and why they should not miss it.</p>
          <div class="actions">
            <a class="button" href="#tickets">Get your ticket</a>
            <a class="button ghost" href="#schedule">See the schedule</a>
          </div>
        </div>
      </section>

      <section id="schedule">
        <div class="wrap">
          <div class="section-head">
            <span class="eyebrow">The programme</span>
            <h2>How the day runs</h2>
          </div>
          <div class="agenda">
            <div><time>09:00</time><div><h3>Doors open and coffee</h3><p>Pick up your badge and meet the people next to you.</p></div></div>
            <div><time>10:00</time><div><h3>Opening talk</h3><p>The big idea of the day, from your headline speaker.</p></div></div>
            <div><time>11:30</time><div><h3>Workshops</h3><p>Small hands-on groups. Choose one when you arrive.</p></div></div>
            <div><time>13:00</time><div><h3>Lunch</h3><p>Food is included in every ticket.</p></div></div>
            <div><time>14:30</time><div><h3>Panel discussion</h3><p>Questions from the audience, answered on stage.</p></div></div>
            <div><time>17:00</time><div><h3>Closing and drinks</h3><p>Stay for the evening and keep the conversation going.</p></div></div>
          </div>
        </div>
      </section>

      <section id="speakers" class="tinted">
        <div class="wrap">
          <div class="section-head">
            <span class="eyebrow">On stage</span>
            <h2>Who you will hear from</h2>
          </div>
          <div class="grid">
            <article class="work">
              ${photo('A photo of the first speaker', 'portrait')}
              <h3>First speaker</h3>
              <p>Founder, Studio One</p>
            </article>
            <article class="work">
              ${photo('A photo of the second speaker', 'portrait')}
              <h3>Second speaker</h3>
              <p>Engineer, Company Two</p>
            </article>
            <article class="work">
              ${photo('A photo of the third speaker', 'portrait')}
              <h3>Third speaker</h3>
              <p>Writer, Publication Three</p>
            </article>
          </div>
        </div>
      </section>

      <section id="venue">
        <div class="wrap split">
          <div>
            <span class="eyebrow">Getting there</span>
            <h2>Where it happens</h2>
            <p class="lead">Venue name, 1 Example Road, Your City. Say how to get there and whether the venue is step-free.</p>
          </div>
          ${photo('A photo of the venue')}
        </div>
      </section>

      <section id="tickets" class="tinted">
        <div class="wrap">
          <div class="section-head">
            <span class="eyebrow">Tickets</span>
            <h2>Save your seat</h2>
          </div>
          <div class="grid" style="max-width: 820px;">
            <article class="card price">
              <h3>Early bird</h3>
              <strong>$49</strong>
              <p>Until the end of September, while they last.</p>
              <a class="button" href="mailto:tickets@example.com?subject=Early%20bird%20ticket">Book early bird</a>
            </article>
            <article class="card price">
              <h3>General admission</h3>
              <strong>$79</strong>
              <p>Talks, workshops, lunch and the evening.</p>
              <a class="button ghost" href="mailto:tickets@example.com?subject=General%20admission">Book a ticket</a>
            </article>
          </div>
        </div>
      </section>
    </main>

    ${footer(name, year, [['mailto:hello@example.com', 'Contact the organisers']])}`,
  }
}

function blankPage(name, year) {
  return {
    description: `${name}.`,
    body: `${header(name, [['#top', 'Home']])}

    <main id="top">
      <section class="hero">
        <div class="wrap">
          <h1>Welcome to ${name}</h1>
          <p class="lead">Click this text to change it. Add sections from the Library, then save.</p>
        </div>
      </section>
    </main>

    ${footer(name, year)}`,
  }
}

function restaurantPage(name, year) {
  return {
    description: `${name}: what we cook, when we are open, and how to order.`,
    body: `${header(name, [['#menu', 'Menu'], ['#hours', 'Hours'], ['#find', 'Find us']], ['#order', 'Order now'])}

    <main id="top">
      <section class="hero">
        <div class="wrap split">
          <div>
            <span class="eyebrow">Fresh every day at ${name}</span>
            <h1>Good food, made the way you like it.</h1>
            <p class="lead">Say what you cook, what makes it special, and when people can come and eat.</p>
            <div class="actions">
              <a class="button" href="#menu">See the menu</a>
              <a class="button ghost" href="#find">Book a table</a>
            </div>
          </div>
          ${photo('A photo of your best dish')}
        </div>
      </section>

      <section id="menu">
        <div class="wrap">
          <div class="section-head">
            <span class="eyebrow">On the menu</span>
            <h2>Favourites people come back for</h2>
            <p>Four dishes, a line each and a price. Change them to yours.</p>
          </div>
          <div class="grid">
            <article class="card">
              <h3>House jollof with chicken</h3>
              <p>Smoky rice, slow-cooked sauce and grilled chicken.</p>
              <p class="dish-price">4,500</p>
            </article>
            <article class="card">
              <h3>Grilled fish of the day</h3>
              <p>Whatever came in fresh, with plantain and pepper sauce.</p>
              <p class="dish-price">6,000</p>
            </article>
            <article class="card">
              <h3>Garden salad</h3>
              <p>Crisp greens, beans, egg and a light dressing.</p>
              <p class="dish-price">2,500</p>
            </article>
            <article class="card">
              <h3>Fresh juice</h3>
              <p>Pressed to order: pineapple, orange or watermelon.</p>
              <p class="dish-price">1,500</p>
            </article>
          </div>
        </div>
      </section>

      <section id="hours" class="tinted">
        <div class="wrap split">
          ${photo('A photo of your dining room', 'portrait')}
          <div>
            <span class="eyebrow">Opening hours</span>
            <h2>Come hungry, leave happy</h2>
            <div class="agenda">
              <div><time>Mon&ndash;Fri</time><p>10am to 10pm, kitchen closes at 9:30pm</p></div>
              <div><time>Saturday</time><p>11am to 11pm, live music from 7pm</p></div>
              <div><time>Sunday</time><p>12pm to 9pm, family lunch all afternoon</p></div>
            </div>
          </div>
        </div>
      </section>

      <section id="order">
        <div class="wrap">
          <div class="band centered">
            <h2>Hungry now? We deliver.</h2>
            <p class="lead">Tell people how to order: call, send a message, or use a delivery app.</p>
            <div class="actions">
              <a class="button" href="tel:+15550100">Call to order</a>
            </div>
          </div>
        </div>
      </section>

      <section id="find" class="tinted">
        <div class="wrap">
          <div class="section-head">
            <span class="eyebrow">Where we are</span>
            <h2>Easy to find, hard to leave</h2>
          </div>
          <div class="grid">
            <article class="card">
              <h3>Address</h3>
              <p>12 Market Street, Your City. Parking out front.</p>
            </article>
            <article class="card">
              <h3>Reservations</h3>
              <p><a href="tel:+15550100">+1 555 0100</a></p>
            </article>
            <article class="card">
              <h3>Events and catering</h3>
              <p><a href="mailto:hello@example.com">hello@example.com</a></p>
            </article>
          </div>
        </div>
      </section>
    </main>

    ${footer(name, year, [['#menu', 'Our menu'], ['#find', 'Directions']])}`,
  }
}

function salonPage(name, year) {
  return {
    description: `${name}: treatments and prices, our work, and how to book.`,
    body: `${header(name, [['#treatments', 'Treatments'], ['#looks', 'Our work'], ['#book', 'Book']], ['#book', 'Book a visit'])}

    <main id="top">
      <section class="hero">
        <div class="wrap split">
          <div>
            <span class="eyebrow">Welcome to ${name}</span>
            <h1>Look good, feel better, leave smiling.</h1>
            <p class="lead">Say what you do best, who you do it for, and how people can book a chair.</p>
            <div class="actions">
              <a class="button" href="#treatments">See prices</a>
              <a class="button ghost" href="#book">Make a booking</a>
            </div>
          </div>
          ${photo('A photo of your salon')}
        </div>
      </section>

      <section id="treatments">
        <div class="wrap">
          <div class="section-head">
            <span class="eyebrow">Treatments and prices</span>
            <h2>Something for every visit</h2>
            <p>Four treatments with how long they take and what they cost.</p>
          </div>
          <div class="grid">
            <article class="card">
              <h3>Wash and style</h3>
              <p>45 minutes &middot; from 8,000</p>
            </article>
            <article class="card">
              <h3>Braids</h3>
              <p>3 hours &middot; from 15,000</p>
            </article>
            <article class="card">
              <h3>Nails</h3>
              <p>1 hour &middot; from 6,500</p>
            </article>
            <article class="card">
              <h3>Make-up</h3>
              <p>1 hour &middot; from 12,000</p>
            </article>
          </div>
        </div>
      </section>

      <section id="looks" class="tinted">
        <div class="wrap">
          <div class="section-head">
            <span class="eyebrow">Fresh from the chair</span>
            <h2>Recent looks we are proud of</h2>
          </div>
          <div class="grid">
            ${photo('A photo of a recent hairstyle', 'portrait')}
            ${photo('A photo of a set of nails', 'portrait')}
            ${photo('A photo of a finished make-up look', 'portrait')}
          </div>
        </div>
      </section>

      <section id="book">
        <div class="wrap">
          <div class="band centered">
            <h2>Ready for your next appointment?</h2>
            <p class="lead">Tell people how to book: call, send a message, or walk in.</p>
            <div class="actions">
              <a class="button" href="tel:+15550100">Call to book</a>
            </div>
          </div>
        </div>
      </section>
    </main>

    ${footer(name, year, [['#treatments', 'Price list'], ['#book', 'Bookings']])}`,
  }
}

function shopPage(name, year) {
  return {
    description: `${name}: what we sell, how to order, and delivery.`,
    body: `${header(name, [['#products', 'Products'], ['#delivery', 'Delivery'], ['#questions', 'Questions']], ['#order', 'How to order'])}

    <main id="top">
      <section class="hero">
        <div class="wrap split">
          <div>
            <span class="eyebrow">New in at ${name}</span>
            <h1>Things you will love, delivered to your door.</h1>
            <p class="lead">Say what you sell, who it is for, and how people get it.</p>
            <div class="actions">
              <a class="button" href="#products">Shop the range</a>
              <a class="button ghost" href="#order">Order today</a>
            </div>
          </div>
          ${photo('A photo of your best-selling product')}
        </div>
      </section>

      <section id="products">
        <div class="wrap">
          <div class="section-head">
            <span class="eyebrow">Best sellers</span>
            <h2>Pick a favourite</h2>
            <p>Six products with a name and a price. Change them to what you sell.</p>
          </div>
          <div class="grid">
            <article class="work">${photo('A photo of the first product')}<h3>Classic tote bag</h3><p>12,000</p></article>
            <article class="work">${photo('A photo of the second product')}<h3>Woven basket</h3><p>9,500</p></article>
            <article class="work">${photo('A photo of the third product')}<h3>Scented candle</h3><p>6,000</p></article>
            <article class="work">${photo('A photo of the fourth product')}<h3>Ceramic mug</h3><p>4,500</p></article>
            <article class="work">${photo('A photo of the fifth product')}<h3>Linen cushion</h3><p>11,000</p></article>
            <article class="work">${photo('A photo of the sixth product')}<h3>Gift box</h3><p>15,000</p></article>
          </div>
        </div>
      </section>

      <section id="order" class="tinted">
        <div class="wrap">
          <div class="section-head">
            <span class="eyebrow">Ordering is easy</span>
            <h2>Three steps to your order</h2>
          </div>
          <div class="grid">
            <article class="card">
              <span class="number">1</span>
              <h3>Pick what you want</h3>
              <p>Browse the products above and note the ones you like.</p>
            </article>
            <article class="card">
              <span class="number">2</span>
              <h3>Send us a message</h3>
              <p>Tell us what you want and where to deliver it.</p>
            </article>
            <article class="card">
              <span class="number">3</span>
              <h3>Pay and receive</h3>
              <p>Pay by transfer or on delivery, whichever suits you.</p>
            </article>
          </div>
        </div>
      </section>

      <section id="delivery">
        <div class="wrap split">
          ${photo('A photo of a parcel ready to go')}
          <div>
            <span class="eyebrow">Delivered to you</span>
            <h2>Fast delivery across the city</h2>
            <p class="lead">Say where you deliver, how long it takes, and what it costs.</p>
          </div>
        </div>
      </section>

      <section id="questions" class="tinted">
        <div class="wrap">
          <div class="section-head">
            <span class="eyebrow">Before you buy</span>
            <h2>Questions shoppers ask</h2>
          </div>
          <div class="faq">
            <details>
              <summary>Can I return something?</summary>
              <p>Say how many days people have, and how a return works.</p>
            </details>
            <details>
              <summary>Do you deliver outside the city?</summary>
              <p>Name the places you reach and how much longer it takes.</p>
            </details>
            <details>
              <summary>How do I pay?</summary>
              <p>List the ways you accept payment, and when it is due.</p>
            </details>
          </div>
        </div>
      </section>
    </main>

    ${footer(name, year, [['#products', 'Shop'], ['#questions', 'Help']])}`,
  }
}

function schoolPage(name, year) {
  return {
    description: `${name}: programmes, fees, admissions and visits.`,
    body: `${header(name, [['#programmes', 'Programmes'], ['#fees', 'Fees'], ['#visit', 'Visit']], ['#apply', 'Apply now'])}

    <main id="top">
      <section class="hero">
        <div class="wrap split">
          <div>
            <span class="eyebrow">Welcome to ${name}</span>
            <h1>Where curious minds grow into confident people.</h1>
            <p class="lead">Say who you teach, what makes your school different, and how families can join.</p>
            <div class="actions">
              <a class="button" href="#programmes">Explore programmes</a>
              <a class="button ghost" href="#visit">Book a school tour</a>
            </div>
          </div>
          ${photo('A photo of your classroom or students')}
        </div>
      </section>

      <section id="programmes">
        <div class="wrap">
          <div class="section-head">
            <span class="eyebrow">What we teach</span>
            <h2>A place for every stage</h2>
          </div>
          <div class="grid">
            <article class="card">
              <h3>Early years</h3>
              <p>Learning through play, for children aged two to five.</p>
            </article>
            <article class="card">
              <h3>Primary</h3>
              <p>Strong foundations in reading, numbers and science.</p>
            </article>
            <article class="card">
              <h3>Secondary</h3>
              <p>Exam preparation, clubs and guidance for what comes next.</p>
            </article>
          </div>
        </div>
      </section>

      <section id="fees" class="tinted">
        <div class="wrap">
          <div class="section-head centered">
            <span class="eyebrow">Fees per term</span>
            <h2>Clear fees, paid in instalments if you need</h2>
          </div>
          <div class="grid">
            <article class="card price">
              <h3>Day pupils</h3>
              <strong>120,000</strong>
              <p>Tuition, books and lunch included.</p>
              <ul>
                <li>Classes from 8am to 2pm</li>
                <li>Termly progress reports</li>
              </ul>
              <a class="button ghost" href="mailto:hello@example.com?subject=Day%20places">Ask about day places</a>
            </article>
            <article class="card price featured">
              <h3>Boarding</h3>
              <strong>250,000</strong>
              <p>Everything for day pupils, plus room and meals.</p>
              <ul>
                <li>Supervised evening study</li>
                <li>Weekend activities</li>
              </ul>
              <a class="button" href="mailto:hello@example.com?subject=Boarding">Ask about boarding</a>
            </article>
            <article class="card price">
              <h3>After-school club</h3>
              <strong>30,000</strong>
              <p>Homework help and sport until 5pm.</p>
              <ul>
                <li>Open to all pupils</li>
                <li>Snack provided</li>
              </ul>
              <a class="button ghost" href="mailto:hello@example.com?subject=After-school%20club">Join the club</a>
            </article>
          </div>
        </div>
      </section>

      <section id="visit">
        <div class="wrap split">
          ${photo('A photo of your school grounds', 'portrait')}
          <div>
            <span class="eyebrow">Come and see</span>
            <h2>See a school day for yourself</h2>
            <p class="lead">Say when families can visit and who will show them around.</p>
            <div class="stats">
              <div><strong>1:15</strong><span>Teachers to pupils</span></div>
              <div><strong>98%</strong><span>Exam pass rate</span></div>
              <div><strong>20+</strong><span>Clubs and activities</span></div>
            </div>
          </div>
        </div>
      </section>

      <section id="apply">
        <div class="wrap">
          <div class="band centered">
            <h2>Admissions are open</h2>
            <p class="lead">Say when to apply, what to bring, and who to contact.</p>
            <div class="actions">
              <a class="button" href="mailto:hello@example.com?subject=Application">Start an application</a>
            </div>
          </div>
        </div>
      </section>
    </main>

    ${footer(name, year, [['#programmes', 'Our programmes'], ['#apply', 'Admissions']])}`,
  }
}

function communityPage(name, year) {
  return {
    description: `${name}: when we meet, who we are, and how to get involved.`,
    body: `${header(name, [['#gatherings', 'Gatherings'], ['#who', 'Who we are'], ['#involved', 'Get involved']], ['#involved', 'Join us'])}

    <main id="top">
      <section class="hero">
        <div class="wrap split">
          <div>
            <span class="eyebrow">Welcome to ${name}</span>
            <h1>A place to belong, to serve and to grow together.</h1>
            <p class="lead">Say who you are, when you meet, and that everyone is welcome.</p>
            <div class="actions">
              <a class="button" href="#gatherings">See meeting times</a>
              <a class="button ghost" href="#involved">Plan your first visit</a>
            </div>
          </div>
          ${photo('A photo of your community together')}
        </div>
      </section>

      <section id="gatherings">
        <div class="wrap">
          <div class="section-head">
            <span class="eyebrow">When we meet</span>
            <h2>Every week, you are welcome</h2>
          </div>
          <div class="agenda">
            <div><time>Sun 9:00am</time><div><h3>Main gathering</h3><p>Our biggest meeting of the week, with something for children.</p></div></div>
            <div><time>Wed 6:00pm</time><div><h3>Midweek meeting</h3><p>A shorter time together in the middle of the week.</p></div></div>
            <div><time>Fri 5:00pm</time><div><h3>Youth evening</h3><p>Games, food and good conversation for young people.</p></div></div>
            <div><time>Sat 10:00am</time><div><h3>Community outreach</h3><p>We serve our neighbourhood together. Come and help.</p></div></div>
          </div>
        </div>
      </section>

      <section id="who" class="tinted">
        <div class="wrap split">
          ${photo('A photo of your leaders', 'portrait')}
          <div>
            <span class="eyebrow">About our community</span>
            <h2>Rooted here, open to all</h2>
            <p class="lead">Say how you began, what you believe, and what a newcomer can expect.</p>
          </div>
        </div>
      </section>

      <section id="involved">
        <div class="wrap">
          <div class="section-head">
            <span class="eyebrow">Join in</span>
            <h2>Find your place with us</h2>
          </div>
          <div class="grid">
            <article class="card">
              <h3>Volunteer</h3>
              <p>Give your time on a team that suits you.</p>
            </article>
            <article class="card">
              <h3>Small groups</h3>
              <p>Meet in homes during the week and get to know people.</p>
            </article>
            <article class="card">
              <h3>Give</h3>
              <p>Support the work and the people it reaches.</p>
            </article>
          </div>
        </div>
      </section>

      <section>
        <div class="wrap">
          <div class="band centered">
            <h2>We would love to meet you</h2>
            <p class="lead">Say how someone new can get in touch, or what to expect on a first visit.</p>
            <div class="actions">
              <a class="button" href="mailto:hello@example.com">Send us a message</a>
            </div>
          </div>
        </div>
      </section>
    </main>

    ${footer(name, year, [['#gatherings', 'Meeting times'], ['#involved', 'Volunteer with us']])}`,
  }
}

/* ── more pages for a site ───────────────────────────────────── */

/**
 * Pages a starter site can grow: each is its own HTML file beside index.html,
 * with the same head and header. Their nav words are chosen to differ from
 * every starter's own links, so no text repeats on a page.
 */
export const STARTER_PAGES = [
  { id: 'about', file: 'about.html', label: 'Our story', hint: 'how you began, what you stand for, the team' },
  { id: 'services', file: 'services.html', label: 'Prices', hint: 'what you offer and what it costs' },
  { id: 'gallery', file: 'gallery.html', label: 'Gallery', hint: 'six pictures of your work, with captions' },
  { id: 'contact', file: 'contact.html', label: 'Talk to us', hint: 'every way to reach you, hours and questions' },
]

export function isStarterPage(page) {
  return STARTER_PAGES.some((entry) => entry.id === page)
}

/** A page's word in the nav: a restaurant's prices are its menu. */
export function starterPageLabel(page, kind) {
  if (page === 'services' && kind === 'restaurant') return 'Full menu'
  return STARTER_PAGES.find((entry) => entry.id === page)?.label ?? page
}

const pageFile = (page) => STARTER_PAGES.find((entry) => entry.id === page)?.file ?? `${page}.html`

function aboutPage(name, year, more) {
  return {
    title: `About ${name}`,
    description: `${name}: how we began, what we stand for, and the people behind it.`,
    main: `
      <section class="hero">
        <div class="wrap centered">
          <span class="eyebrow">About ${name}</span>
          <h1>How it all started</h1>
          <p class="lead">Tell people how you began, what has changed, and what never will.</p>
        </div>
        <div class="wrap">${photo('A photo from the early days', 'wide')}</div>
      </section>

      <section>
        <div class="wrap">
          <div class="section-head">
            <span class="eyebrow">What we stand for</span>
            <h2>Three promises we keep</h2>
          </div>
          <div class="grid">
            <article class="card">
              <h3>Honest work</h3>
              <p>Say what you will always do, even when nobody is watching.</p>
            </article>
            <article class="card">
              <h3>Real care</h3>
              <p>Say how you treat the people who come to you.</p>
            </article>
            <article class="card">
              <h3>Fair prices</h3>
              <p>Say how you keep what you charge simple and fair.</p>
            </article>
          </div>
        </div>
      </section>

      <section class="tinted">
        <div class="wrap">
          <div class="section-head">
            <span class="eyebrow">The team</span>
            <h2>The people you will meet</h2>
          </div>
          <div class="grid">
            <article class="work">${photo('A photo of the founder', 'portrait')}<h3>Founder&rsquo;s name</h3><p>Founder</p></article>
            <article class="work">${photo('A photo of a team lead', 'portrait')}<h3>Team lead&rsquo;s name</h3><p>Runs the day to day</p></article>
            <article class="work">${photo('A photo of a team member', 'portrait')}<h3>Team member&rsquo;s name</h3><p>Looks after customers</p></article>
          </div>
        </div>
      </section>

      <section>
        <div class="wrap">
          <div class="band centered">
            <h2>Want to work with us?</h2>
            <p class="lead">Say what happens next when someone reaches out.</p>
            <div class="actions">
              <a class="button" href="${more.contactHref}">Say hello</a>
            </div>
          </div>
        </div>
      </section>`,
  }
}

function servicesPage(name, year, more) {
  const menu = more.kind === 'restaurant'
  return {
    title: menu ? `Menu · ${name}` : `Prices · ${name}`,
    description: menu ? `${name}: the full menu.` : `${name}: what we offer and what it costs.`,
    main: `
      <section class="hero">
        <div class="wrap centered">
          <span class="eyebrow">${menu ? 'Everything we cook' : 'What it costs'}</span>
          <h1>${menu ? 'The full menu' : 'Clear prices, no surprises'}</h1>
          <p class="lead">${menu ? 'Every dish with what is in it and what it costs. Change them to yours.' : 'Three ways to work with you, each with what is included. Change them to yours.'}</p>
        </div>
      </section>

      <section class="tinted">
        <div class="wrap">
          <div class="grid">
            <article class="card price">
              <h3>${menu ? 'Starters' : 'Basic'}</h3>
              <strong>${menu ? 'From 2,000' : 'From 10,000'}</strong>
              <p>${menu ? 'Small plates to share while you wait.' : 'The essentials, done well.'}</p>
              <ul>
                <li>${menu ? 'Pepper soup' : 'One visit or one item'}</li>
                <li>${menu ? 'Spring rolls' : 'Email support'}</li>
              </ul>
              <a class="button ghost" href="${more.contactHref}">${menu ? 'Ask about starters' : 'Ask about Basic'}</a>
            </article>
            <article class="card price featured">
              <h3>${menu ? 'Mains' : 'Popular'}</h3>
              <strong>${menu ? 'From 4,500' : 'From 25,000'}</strong>
              <p>${menu ? 'Our signature plates, cooked to order.' : 'What most people choose.'}</p>
              <ul>
                <li>${menu ? 'House jollof' : 'Everything in Basic'}</li>
                <li>${menu ? 'Grilled fish' : 'Priority booking'}</li>
              </ul>
              <a class="button" href="${more.contactHref}">${menu ? 'Ask about mains' : 'Ask about Popular'}</a>
            </article>
            <article class="card price">
              <h3>${menu ? 'Drinks and desserts' : 'Complete'}</h3>
              <strong>${menu ? 'From 1,000' : 'From 60,000'}</strong>
              <p>${menu ? 'Fresh juices, cold drinks and something sweet.' : 'For people who want it all handled.'}</p>
              <ul>
                <li>${menu ? 'Chapman' : 'Everything in Popular'}</li>
                <li>${menu ? 'Puff-puff' : 'A dedicated contact'}</li>
              </ul>
              <a class="button ghost" href="${more.contactHref}">${menu ? 'Ask about drinks' : 'Ask about Complete'}</a>
            </article>
          </div>
        </div>
      </section>

      <section>
        <div class="wrap">
          <div class="section-head">
            <span class="eyebrow">Good to know</span>
            <h2>${menu ? 'Before you order' : 'Before you choose'}</h2>
          </div>
          <div class="faq">
            <details>
              <summary>${menu ? 'Do you cater for events?' : 'Can I change my mind later?'}</summary>
              <p>${menu ? 'Say how far ahead people should ask, and for how many guests.' : 'Say how people move between options, and what it costs.'}</p>
            </details>
            <details>
              <summary>${menu ? 'Do you have vegetarian dishes?' : 'Do prices include everything?'}</summary>
              <p>${menu ? 'Name them, or say the kitchen will adapt a dish.' : 'Say plainly what is extra, so nobody is surprised.'}</p>
            </details>
          </div>
        </div>
      </section>`,
  }
}

function galleryPage(name, year) {
  const pictures = [
    ['A photo of your work, first', 'Say what this shows'],
    ['A photo of your work, second', 'Who it was for'],
    ['A photo of your work, third', 'What made it special'],
    ['A photo of your work, fourth', 'A detail worth seeing'],
    ['A photo of your work, fifth', 'Before and after'],
    ['A photo of your work, sixth', 'A favourite of ours'],
  ]
  return {
    title: `Gallery · ${name}`,
    description: `${name}: our work, up close.`,
    main: `
      <section class="hero">
        <div class="wrap centered">
          <span class="eyebrow">A look inside</span>
          <h1>Our work, up close</h1>
          <p class="lead">Six pictures with a line each. Select a frame to add your own picture.</p>
        </div>
      </section>

      <section>
        <div class="wrap">
          <div class="grid">
            ${pictures.map(([label, caption]) => `<article class="work">${photo(label)}<p>${caption}</p></article>`).join('\n            ')}
          </div>
        </div>
      </section>`,
  }
}

function contactPage(name, year) {
  return {
    title: `Contact ${name}`,
    description: `${name}: how to reach us, when we are open, and common questions.`,
    main: `
      <section class="hero">
        <div class="wrap centered">
          <span class="eyebrow">We reply quickly</span>
          <h1>Come and see us, or send a message</h1>
          <p class="lead">Every way to reach you in one place, and when you are around.</p>
        </div>
      </section>

      <section class="tinted">
        <div class="wrap">
          <div class="grid">
            <article class="card">
              <h3>Write to us</h3>
              <p><a href="mailto:hello@example.com">hello@example.com</a></p>
            </article>
            <article class="card">
              <h3>Call us</h3>
              <p><a href="tel:+15550100">+1 555 0100</a></p>
            </article>
            <article class="card">
              <h3>Our address</h3>
              <p>12 Market Street, Your City</p>
            </article>
            <article class="card">
              <h3>Opening times</h3>
              <p>Monday to Saturday, 9am to 6pm</p>
            </article>
          </div>
        </div>
      </section>

      <section>
        <div class="wrap">
          <div class="section-head">
            <span class="eyebrow">Common questions</span>
            <h2>Quick answers</h2>
          </div>
          <div class="faq">
            <details>
              <summary>How quickly do you reply?</summary>
              <p>Say when people can expect to hear back.</p>
            </details>
            <details>
              <summary>Do I need an appointment?</summary>
              <p>Say whether people can walk in, and when it is best to come.</p>
            </details>
          </div>
        </div>
      </section>`,
  }
}

const EXTRA_PAGES = { about: aboutPage, services: servicesPage, gallery: galleryPage, contact: contactPage }

/* ── contact details and WhatsApp ────────────────────────────── */

/**
 * "+234 906 585 7458" → "2349065857458": what a wa.me link and a tel: link
 * need, which is the number with its country code. A Nigerian mobile number
 * written the local way ("0803 555 0101") gets its +234: a wa.me link without
 * it opens no chat. Only Nigeria's mobile prefixes (070/071, 080/081,
 * 090/091) are read that way, so another country's local number is left as
 * it was typed. "00" before a country code is the same as "+".
 */
export function phoneDigits(value) {
  const typed = String(value ?? '').trim()
  let digits = typed.replace(/[^\d]/g, '')
  if (!typed.startsWith('+') && digits.startsWith('00')) digits = digits.slice(2)
  else if (!typed.startsWith('+') && /^0[789][01]\d{8}$/.test(digits)) digits = `234${digits.slice(1)}`
  return digits.length >= 7 && digits.length <= 15 ? digits : ''
}

/**
 * The starters' placeholder email and phone, swapped for the real ones.
 * Only the words and the link target change, never the markup, so a page's
 * element paths stay the same with or without them.
 */
function withContact(body, contact = {}) {
  let out = body
  const email = String(contact.email ?? '').trim()
  if (/^[^\s@<>"']+@[^\s@<>"']+\.[^\s@<>"']+$/.test(email)) {
    out = out.replace(/(?:hello|tickets)@example\.com/g, escapeHtml(email))
  }
  const phone = phoneDigits(contact.phone)
  if (phone) {
    out = out.replace(/tel:\+15550100/g, `tel:+${phone}`).replace(/\+1 555 0100/g, escapeHtml(String(contact.phone).trim()))
  }
  return out
}

/**
 * The WhatsApp button: the last thing in <body>, so adding it later moves no
 * other element. It opens a chat with the site's own number.
 */
function whatsappButton(rawName, whatsapp) {
  const digits = phoneDigits(whatsapp)
  if (!digits) return ''
  const text = encodeURIComponent(`Hello ${String(rawName).trim() || 'there'}!`)
  return `

    <a class="whatsapp" href="https://wa.me/${digits}?text=${text}" target="_blank" rel="noopener" aria-label="Chat with us on WhatsApp">
      <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path fill="currentColor" d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 18.2c-1.5 0-3-.4-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2Zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8s-.4-.1-.6.1-.7.8-.8 1-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.2-.4.2-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.8 11.9 11.9 0 0 0 4.6 4c1.7.7 2.4.8 3.2.7a2.8 2.8 0 0 0 1.8-1.3 2.3 2.3 0 0 0 .2-1.3c-.1-.1-.3-.2-.5-.3Z"/></svg>
      <span>Chat with us</span>
    </a>`
}

/** Links to the site's other pages, added at the end of the main nav: no existing link moves. */
function withPageLinks(body, links) {
  if (!links.length) return body
  const extra = links.map(([href, label]) => `\n          <a href="${href}">${label}</a>`).join('')
  return body.replace(/(<nav class="nav" aria-label="Main">[\s\S]*?)(\n\s*<\/nav>)/, `$1${extra}$2`)
}

const PAGES = { business: businessPage, restaurant: restaurantPage, salon: salonPage, shop: shopPage, school: schoolPage, community: communityPage, portfolio: portfolioPage, product: productPage, event: eventPage, blank: blankPage }

/** Where "Made with Froam" points. */
export const FROAM_HOME = 'https://froam.vercel.app'

/**
 * A site's id: random, made once when the site is, and written into each of
 * its pages beside the generator tag. Nothing is sent anywhere — it lets a
 * page be matched to the site it came from, by whoever has both.
 */
export function newSiteId() {
  const bytes = new Uint8Array(6)
  globalThis.crypto.getRandomValues(bytes)
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
}

/** The mark every Froam page carries in its source: what made it, and (when known) which site it is. */
function siteMark(siteId) {
  const id = typeof siteId === 'string' && /^[A-Za-z0-9-]{4,40}$/.test(siteId) ? ` · site ${siteId}` : ''
  return `<!-- Made with Froam · ${FROAM_HOME}${id} -->`
}

function documentHtml({ title, description, theme, rawName, froamDir, body, siteId }) {
  return `<!doctype html>
${siteMark(siteId)}
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="generator" content="Froam">
    <title>${title}</title>
    <meta name="description" content="${description}">
    <link rel="icon" href="${favicon(rawName, theme)}">
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link rel="stylesheet" href="${fontsHref(theme)}">
    <style>${stylesheet(theme)}${artStylesheet(theme, scenesIn(body))}
    </style>
    <link rel="stylesheet" href="${froamDir}/froam.generated.css">
    <script src="${froamDir}/froam.runtime.js" defer></script>
  </head>
  <body>
    ${body}
  </body>
</html>
`
}

/** The other pages' links, for the nav: on index.html after its own links. */
function pageLinks(kind, pages) {
  return pages.filter(isStarterPage).map((page) => [pageFile(page), starterPageLabel(page, kind)])
}

/**
 * index.html for a new site.
 *
 * @param {{ name: string, kind?: string, style?: string, year?: number, froamDir?: string,
 *   pages?: string[], contact?: { email?: string, phone?: string, whatsapp?: string } }} options
 *   style is one of STARTER_STYLES (the kind's own look by default).
 *   pages are STARTER_PAGES ids the site also has: their links join the nav.
 *   contact replaces the placeholder email and phone; a whatsapp number adds
 *   a "Chat with us" button.
 *   froamDir is the workspace folder relative to the page, where the two
 *   shipping files live.
 *   siteId (see newSiteId) goes into the page's "Made with Froam" comment.
 */
export function renderStarter({ name, kind = 'business', style = 'original', year = new Date().getFullYear(), froamDir = 'froam', pages = [], contact = {}, siteId }) {
  const page = PAGES[kind] ?? PAGES.business
  const theme = starterTheme(kind, style)
  const safeName = escapeHtml(String(name).trim() || 'My website')
  const { description, body } = page(safeName, year)
  const full = withContact(withPageLinks(body, pageLinks(kind, pages)), contact) + whatsappButton(name, contact?.whatsapp)
  return documentHtml({ title: safeName, description, theme, rawName: name, froamDir, body: full, siteId })
}

/**
 * Another page of the same site (about.html, services.html, gallery.html,
 * contact.html): the same head, a header that links every page, the page's
 * own sections, and the footer.
 *
 * @param {{ name: string, kind?: string, style?: string, year?: number, froamDir?: string,
 *   page: string, pages?: string[], contact?: { email?: string, phone?: string, whatsapp?: string } }} options
 */
export function renderStarterPage({ name, kind = 'business', style = 'original', year = new Date().getFullYear(), froamDir = 'froam', page, pages = [], contact = {}, siteId }) {
  const make = EXTRA_PAGES[page]
  if (!make) throw new Error(`there is no "${page}" page — use one of: ${STARTER_PAGES.map((entry) => entry.id).join(', ')}`)
  const theme = starterTheme(kind, style)
  const safeName = escapeHtml(String(name).trim() || 'My website')
  const all = [...new Set([...pages, page])].filter(isStarterPage)
  const hasContact = all.includes('contact')
  const more = { kind, contactHref: hasContact && page !== 'contact' ? 'contact.html' : 'index.html' }
  const { title, description, main } = make(safeName, year, more)
  const links = [['index.html', 'Home'], ...pageLinks(kind, all)]
  const cta = hasContact && page !== 'contact' ? ['contact.html', 'Get in touch'] : null
  const body = `${header(safeName, links, cta).replace('href="#top"', 'href="index.html"')}

    <main id="top">${main}
    </main>

    ${footer(safeName, year, [['index.html', 'Back to home']])}`
  const full = withContact(body, contact) + whatsappButton(name, contact?.whatsapp)
  return documentHtml({ title, description, theme, rawName: name, froamDir, body: full, siteId })
}

/** README.md for a new site: what the files are, how to edit, how to put it online. */
export function starterReadme({ name, folder }) {
  return `# ${name}

Made with [Froam](https://froam.vercel.app). It is a plain website: open
\`index.html\` in any browser, host it anywhere, change it in any editor.

## Edit it

From this folder:

\`\`\`bash
npx @ahmadastic/froam .
\`\`\`

Your site opens with the editor on top. Click any text to change it, add
sections from the Library, then press **Save to Repo** (Ctrl+Shift+S).
Text changes and new sections go straight into \`index.html\`. Style changes
are saved in \`froam/\`, and the two tags in \`index.html\` load them for visitors.

## Put it online

From this folder:

\`\`\`bash
npx @ahmadastic/froam publish
\`\`\`

The first time, Froam asks where: Cloudflare Pages (free, and fine for a
business), Netlify, Vercel, or just a folder you upload yourself. It
remembers the answer, so after that publishing is that one command. Save in
Froam, run it again, and the changes are live.

It uploads a clean copy made in \`.froam/publish/\`: your pages and the two
files visitors need, never Froam's edit history. The \`${folder}\` folder
itself also works on any static host as it is.

## Files

| File | What it is |
| --- | --- |
| \`index.html\` | Your page. Real HTML, yours to keep. |
| \`froam/froam.design.json\` | Your Froam edits: the source of truth for what you changed. |
| \`froam/froam.generated.css\`, \`froam/froam.runtime.js\` | Built from your edits. Visitors' browsers load these. |
| \`froam.config.json\` | Tells Froam where its files are. |

## Made with Froam

Each page ends with a small "Made with Froam" line under the footer, and its
source starts with a comment naming Froam and this site's id. They show
where the site came from; nothing is tracked or sent anywhere. The line is
yours to keep, restyle or delete like anything else on the page.
`
}
