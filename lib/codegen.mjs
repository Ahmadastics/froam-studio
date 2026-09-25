/**
 * Froam Studio v3 — shared codegen.
 *
 * Single source of truth for everything that turns froam.design.json
 * into shippable artifacts. Used by the Vite plugin, the `froam` CLI,
 * and the universal dev bridge so every integration produces
 * identical output:
 *
 *   froam.design.json     — canonical design store (v3)
 *   froam.generated.css   — styles compiled to static CSS
 *   froam.runtime.js      — zero-dependency vanilla runtime (text /
 *                           image / injected-block drafts for sites
 *                           that don't mount the React FroamRuntime)
 */
import fs from 'node:fs'
import path from 'node:path'

export const DESIGN_VERSION = 3
export const CANVAS_KEY = '__froam_canvas__'
export const INJECTION_KEY = '__froam_injection__'
/** Leading path segment for content beside the root on <body> (see src/collab/paths.ts). */
export const BODY_SCOPE = '@body'
export const SECTION_STRUCTURE_KEY = '__froam_structure__:sections'
export const VIEWPORTS = ['desktop', 'tablet', 'mobile']
export const MEDIA = {
  desktop: '@media (min-width: 1025px)',
  tablet: '@media (min-width: 641px) and (max-width: 1024px)',
  mobile: '@media (max-width: 640px)',
}

/**
 * One canonical form for route keys so a design edited at `/page`,
 * `/page/` or `/page/index.html` applies at ALL of them — servers
 * disagree about trailing slashes, the design must not care.
 * KEEP IN SYNC with normalizeFroamRouteKey in src/routing.ts.
 */
export function normalizeRouteKey(value) {
  let p = String(value || '/').split('?')[0].split('#')[0]
  p = p.replace(/\/index\.html?$/i, '/')
  p = p.replace(/\/+$/, '')
  return p || '/'
}

export function emptyDesign() {
  return {
    version: DESIGN_VERSION,
    updatedAt: null,
    meta: { createdWith: 'froam-studio@3' },
    routes: {},
  }
}

/**
 * Which element paths are relative to.
 *   'auto' (absent) — the historic choice: [data-froam-root], #root, #__next,
 *                     then <main>, then <body>. Every design saved before 8.5.
 *   'page'          — <body>: the whole page, header/footer/late modals
 *                     included. New projects get it; a design that already
 *                     has edits never switches (its paths would shift).
 */
export function designRootScope(design) {
  return design?.rootScope === 'page' ? 'page' : 'auto'
}

export function designHasDrafts(design) {
  return Object.values(design?.routes ?? {}).some((viewports) =>
    Object.values(viewports ?? {}).some((store) => store && Object.keys(store).length > 0))
}

/** Accepts any v1/v2/v3 design object and returns a valid v3 design. */
export function migrateDesign(design) {
  if (!design || typeof design !== 'object' || typeof design.routes !== 'object' || design.routes === null) {
    return emptyDesign()
  }
  // Normalize route keys (legacy designs may carry trailing slashes);
  // on collision, merge viewports with the already-normalized key winning.
  const routes = {}
  for (const [routeKey, viewports] of Object.entries(design.routes)) {
    const key = normalizeRouteKey(routeKey)
    routes[key] = routes[key] ? { ...viewports, ...routes[key] } : viewports
  }
  const { rootScope, ...rest } = design
  return {
    ...rest,
    ...(rootScope === 'page' ? { rootScope: 'page' } : {}),
    version: DESIGN_VERSION,
    meta: { createdWith: 'froam-studio@3', ...(design.meta ?? {}) },
    routes,
  }
}

export function loadDesign(designPath) {
  try {
    const parsed = JSON.parse(fs.readFileSync(designPath, 'utf8'))
    if (parsed && typeof parsed === 'object' && parsed.routes) return migrateDesign(parsed)
  } catch {
    /* fall through to empty */
  }
  return emptyDesign()
}

function camelToKebab(value) {
  return value.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`)
}

/* ── font sources ──────────────────────────────────────────────
   The editor's font picker offers families the host site may not
   ship. Codegen emits @import lines so the design's fonts ACTUALLY
   load in production. KEEP IN SYNC with src/editor/fontSources.ts
   (the TS mirror used by the editor + React runtime). */
const GOOGLE_FONTS = {
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

  /* Humanist sans */
  'Source Sans 3': '200;300;400;500;600;700;800;900',
  'Public Sans': '100;200;300;400;500;600;700;800;900',
  Figtree: '300;400;500;600;700;800;900',

  /* Condensed */
  'Archivo Narrow': '400;500;600;700',
  Oswald: '200;300;400;500;600;700',
  'Barlow Condensed': '200;300;400;500;600;700;800;900',

  /* Display */
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

const FONTSHARE_FONTS = {
  Satoshi: 'satoshi@400,500,700,900',
  'Cabinet Grotesk': 'cabinet-grotesk@400,500,700,800',
}

function primaryFamily(fontFamilyValue) {
  if (!fontFamilyValue) return null
  const first = String(fontFamilyValue).split(',')[0]?.trim().replace(/^["']|["']$/g, '')
  return first || null
}

/** Every font family the design references (draft styles + injected HTML). */
export function collectDesignFontFamilies(design) {
  const families = new Set()
  for (const viewports of Object.values(design.routes ?? {})) {
    for (const viewport of VIEWPORTS) {
      const store = viewports?.[viewport]
      if (!store) continue
      for (const [draftPath, draft] of Object.entries(store)) {
        if (!draft) continue
        const fromStyle = primaryFamily(draft.styles?.fontFamily)
        if (fromStyle) families.add(fromStyle)
        if (draftPath.startsWith(`${INJECTION_KEY}:`) && typeof draft.text === 'string') {
          // Injected HTML encodes quotes as entities — decode before scanning.
          const text = draft.text.replace(/&quot;|&#0?34;/g, '"').replace(/&#0?39;|&apos;/g, "'")
          for (const match of text.matchAll(/font-family:\s*([^;}<]+)/gi)) {
            const family = primaryFamily(match[1])
            if (family) families.add(family)
          }
        }
      }
    }
  }
  return [...families]
}

/** Stylesheet URLs that load the given families (unknown/system families skipped). */
export function fontStylesheetUrls(families) {
  const google = []
  const fontshare = []
  const seen = new Set()
  for (const family of families) {
    if (!family || seen.has(family)) continue
    seen.add(family)
    if (GOOGLE_FONTS[family]) {
      google.push(`family=${encodeURIComponent(family).replace(/%20/g, '+')}:wght@${GOOGLE_FONTS[family]}`)
    } else if (FONTSHARE_FONTS[family]) {
      fontshare.push(`f[]=${FONTSHARE_FONTS[family]}`)
    }
  }
  const urls = []
  if (google.length) urls.push(`https://fonts.googleapis.com/css2?${google.sort().join('&')}&display=swap`)
  if (fontshare.length) urls.push(`https://api.fontshare.com/v2/css?${fontshare.sort().join('&')}&display=swap`)
  return urls
}

/* ── brand fonts ───────────────────────────────────────────────
   Client work needs the client's licensed typeface, which is on
   neither Google Fonts nor Fontshare. Brand faces travel inside the
   design (data: URI for an upload, https: URL for a self-hosted
   file) and compile to @font-face here, so the font ships with the
   repo instead of only existing in the editor.

   KEEP IN SYNC with src/editor/fontSources.ts.
   ─────────────────────────────────────────────────────────────── */
const BRAND_FONT_FORMATS = new Set(['woff2', 'woff', 'truetype', 'opentype'])

const FORMAT_BY_EXTENSION = { woff2: 'woff2', woff: 'woff', ttf: 'truetype', otf: 'opentype' }

/** Only a base64 font data URI or an https URL may reach generated CSS. */
export function isSafeFontSrc(src) {
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

function cssString(value) {
  return String(value).replace(/[\\"]/g, '\\$&').replace(/[\r\n]/g, '')
}

function inferFontFormat(src) {
  const dataMatch = /^data:(?:font|application)\/([a-z0-9.+-]+);/i.exec(src)
  if (dataMatch) return FORMAT_BY_EXTENSION[dataMatch[1].toLowerCase().replace(/^x-font-/, '')] ?? null
  const extMatch = /\.([a-z0-9]+)(?:[?#]|$)/i.exec(src)
  return extMatch ? FORMAT_BY_EXTENSION[extMatch[1].toLowerCase()] ?? null : null
}

function normalizeFontWeight(weight) {
  if (typeof weight === 'number' && Number.isFinite(weight)) {
    return String(Math.min(1000, Math.max(1, Math.round(weight))))
  }
  if (typeof weight === 'string') {
    const parts = weight.trim().split(/\s+/)
    if (parts.length <= 2 && parts.every((part) => /^\d{1,4}$/.test(part))) {
      return parts.map((part) => String(Math.min(1000, Math.max(1, Number(part))))).join(' ')
    }
  }
  return '400'
}

/** @font-face blocks as CSS lines. Unusable faces are skipped, never emitted broken. */
export function brandFontFaceCss(brandFonts) {
  const lines = []
  for (const font of brandFonts ?? []) {
    const family = typeof font?.family === 'string' ? font.family.trim() : ''
    if (!family) continue
    for (const face of font.faces ?? []) {
      if (!isSafeFontSrc(face?.src)) continue
      const format =
        face.format && BRAND_FONT_FORMATS.has(face.format) ? face.format : inferFontFormat(face.src)
      const source = format
        ? `url("${cssString(face.src)}") format("${format}")`
        : `url("${cssString(face.src)}")`
      lines.push(
        '@font-face {',
        `  font-family: "${cssString(family)}";`,
        `  src: ${source};`,
        `  font-weight: ${normalizeFontWeight(face.weight)};`,
        `  font-style: ${face.style === 'italic' ? 'italic' : 'normal'};`,
        '  font-display: swap;',
        '}',
      )
    }
  }
  return lines
}

function cssEscapeAttr(value) {
  return String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"')
}

function isSpecialPath(draftPath) {
  return draftPath === CANVAS_KEY || draftPath.startsWith(`${INJECTION_KEY}:`) || draftPath.startsWith('__froam')
}

function pathToSelector(draftPath, rootScope = 'auto') {
  const bodyScoped = draftPath.startsWith(`${BODY_SCOPE}/`)
  const segments = (bodyScoped ? draftPath.slice(BODY_SCOPE.length + 1) : draftPath).split('/').filter(Boolean)
  const parts = []
  for (const segment of segments) {
    const [tag, indexRaw] = segment.split(':')
    const index = Number(indexRaw)
    if (!tag || !/^[a-z][a-z0-9-]*$/i.test(tag) || !Number.isInteger(index) || index < 1) return null
    parts.push(`${tag.toLowerCase()}:nth-of-type(${index})`)
  }
  if (!parts.length) return null
  const root = bodyScoped || rootScope === 'page' ? 'body' : ':where([data-froam-root], #root, #__next)'
  return `${root} > ${parts.join(' > ')}`
}

/**
 * A declaration the generated stylesheet can carry. Designs arrive over the
 * bridge (and from collaborators in a room), so a property name or value that
 * could close the rule and open another is dropped, not written.
 */
function isSafeDeclaration(property, value) {
  return /^-{0,2}[a-zA-Z][a-zA-Z0-9-]*$/.test(property) && !/[{}]|<\/style/i.test(String(value))
}

function declarations(styles, indent) {
  const lines = []
  for (const [key, value] of Object.entries(styles ?? {})) {
    if (key === 'customCSS' || key.startsWith('__froamState:') || value === '' || value == null) continue
    if (!isSafeDeclaration(key, value)) continue
    lines.push(`${indent}${camelToKebab(key)}: ${value} !important;`)
  }
  return lines
}

function stateDeclarations(styles, state, indent) {
  const prefix = `__froamState:${state}:`
  const lines = []
  for (const [key, value] of Object.entries(styles ?? {})) {
    if (!key.startsWith(prefix) || value === '' || value == null) continue
    const property = key.slice(prefix.length)
    if (!isSafeDeclaration(property, value)) continue
    lines.push(`${indent}${camelToKebab(property)}: ${value} !important;`)
  }
  return lines
}

export function generateCss(design) {
  const out = [
    '/* Generated by froam (Repo Mode) — do not edit by hand.',
    '   Edit visually in the Froam editor, then "Save to Repo". */',
    '',
    'html:not([data-chef-editing]) [data-froam-export-hidden="true"] { display: none !important; }',
    '',
  ]

  // @import must precede all rules — fonts the design uses ship with it.
  const fontUrls = fontStylesheetUrls(collectDesignFontFamilies(design))
  if (fontUrls.length) {
    out.push('/* ── fonts used by this design ── */')
    for (const url of fontUrls) out.push(`@import url("${url}");`)
    out.push('')
  }

  // Brand faces come after @import (which must be first) and before any rule.
  const brandFontLines = brandFontFaceCss(design.brandFonts)
  if (brandFontLines.length) {
    out.push('/* ── brand fonts carried by this design ── */')
    out.push(...brandFontLines)
    out.push('')
  }

  const customCssBlocks = []
  const rootScope = designRootScope(design)

  for (const [routeKey, viewports] of Object.entries(design.routes ?? {})) {
    for (const viewport of VIEWPORTS) {
      const store = viewports?.[viewport]
      if (!store || !Object.keys(store).length) continue
      const scope = `html[data-froam-route="${cssEscapeAttr(normalizeRouteKey(routeKey))}"]:not([data-chef-editing])`
      const rules = []

      for (const [draftPath, draft] of Object.entries(store)) {
        if (draftPath === CANVAS_KEY) {
          const decls = declarations(draft?.styles, '    ')
          if (decls.length) rules.push(`  ${scope} [data-froam-canvas] {\n${decls.join('\n')}\n  }`)
          if (draft?.styles?.customCSS) customCssBlocks.push(draft.styles.customCSS)
          continue
        }
        if (isSpecialPath(draftPath) || !draft?.styles) continue
        const selector = pathToSelector(draftPath, rootScope)
        if (!selector) continue
        const decls = declarations(draft.styles, '    ')
        if (decls.length) rules.push(`  ${scope} ${selector} {\n${decls.join('\n')}\n  }`)
        for (const state of ['hover', 'focus', 'active']) {
          const stateDecls = stateDeclarations(draft.styles, state, '    ')
          if (stateDecls.length) rules.push(`  ${scope} ${selector}:${state} {\n${stateDecls.join('\n')}\n  }`)
        }
        // ::before / ::after — badges, quote marks, icons drawn with `content`.
        for (const pseudo of ['before', 'after']) {
          const pseudoDecls = stateDeclarations(draft.styles, pseudo, '    ')
          if (pseudoDecls.length) rules.push(`  ${scope} ${selector}::${pseudo} {\n${pseudoDecls.join('\n')}\n  }`)
        }
      }

      if (!rules.length) continue
      out.push(`/* ── ${routeKey} · ${viewport} ── */`)
      out.push(`${MEDIA[viewport]} {`)
      out.push(rules.join('\n\n'))
      out.push('}')
      out.push('')
    }
  }

  if (customCssBlocks.length) {
    out.push('/* ── Custom CSS (canvas) ── */')
    out.push(customCssBlocks.join('\n\n'))
    out.push('')
  }

  return out.join('\n')
}

/**
 * Vanilla production runtime — applies the parts of a design that pure
 * CSS can't express (text edits, image swaps, injected blocks, custom
 * canvas CSS) on any website with zero dependencies. The design is
 * inlined so the file is self-contained and cache-friendly.
 */
export function generateRuntimeJs(design) {
  const routes = {}
  for (const [routeKey, viewports] of Object.entries(design.routes ?? {})) {
    const slim = {}
    for (const viewport of VIEWPORTS) {
      const store = viewports?.[viewport]
      if (!store) continue
      const kept = {}
      for (const [draftPath, draft] of Object.entries(store)) {
        if (!draft) continue
        const entry = {}
        if (draftPath === CANVAS_KEY) {
          if (draft.styles?.customCSS) entry.customCSS = draft.styles.customCSS
        } else if (draftPath.startsWith(`${INJECTION_KEY}:`) || draftPath === SECTION_STRUCTURE_KEY) {
          if (draft.text !== undefined) entry.text = draft.text
        } else {
          if (draft.text !== undefined) entry.text = draft.text
          if (draft.imageUrl !== undefined) entry.imageUrl = draft.imageUrl
        }
        if (Object.keys(entry).length) kept[draftPath] = entry
      }
      if (Object.keys(kept).length) slim[viewport] = kept
    }
    if (Object.keys(slim).length) routes[routeKey] = slim
  }

  // rootScope travels with the runtime: its paths are relative to it.
  const designJson = JSON.stringify({
    version: design.version ?? DESIGN_VERSION,
    ...(designRootScope(design) === 'page' ? { rootScope: 'page' } : {}),
    routes,
  })

  return `/* Generated by froam-studio (Repo Mode) — do not edit by hand.
   Zero-dependency Froam runtime: route attribute + text/image/injected
   drafts for sites that don't mount the React <FroamRuntime/>. */
;(function () {
  'use strict'
  if (typeof window === 'undefined' || typeof document === 'undefined') return
  if (window.__FROAM_VANILLA_RUNTIME__) return
  window.__FROAM_VANILLA_RUNTIME__ = true

  var DESIGN = ${designJson}
  var CANVAS_KEY = '${CANVAS_KEY}'
  var INJECTION_PREFIX = '${INJECTION_KEY}:'
  var SECTION_STRUCTURE_KEY = '${SECTION_STRUCTURE_KEY}'
  var ROOT_PARENT_KEY = '__froam_root__'
  var TEXT_TAGS = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'span', 'small', 'strong', 'em', 'b', 'i', 'label', 'button', 'a', 'li']

  function getRoot() {
    if (DESIGN.rootScope === 'page') return document.body
    return (
      document.querySelector('[data-froam-root]') ||
      document.getElementById('root') ||
      document.getElementById('__next') ||
      document.querySelector('main') ||
      document.body
    )
  }

  function viewportMode() {
    if (window.matchMedia('(max-width: 640px)').matches) return 'mobile'
    if (window.matchMedia('(max-width: 1024px)').matches) return 'tablet'
    return 'desktop'
  }

  // "@body/…" paths are content beside the root (a React app's portals),
  // counted from <body>. Froam's own nodes there never count.
  var BODY_PREFIX = '${BODY_SCOPE}/'
  function isFroamOwned(element) {
    return element.getAttribute('data-chef-editor-root') === 'true' || (element.id || '').indexOf('froam-') === 0
  }

  function findByPath(root, pathValue) {
    var fromBody = pathValue.indexOf(BODY_PREFIX) === 0
    var segments = (fromBody ? pathValue.slice(BODY_PREFIX.length) : pathValue).split('/').filter(Boolean)
    var current = fromBody ? document.body : root
    for (var i = 0; i < segments.length; i += 1) {
      var pieces = segments[i].split(':')
      var tag = pieces[0]
      var index = Number(pieces[1]) - 1
      if (!tag || isNaN(index) || index < 0 || !current) return null
      var matches = []
      var onBody = current === document.body
      for (var c = 0; c < current.children.length; c += 1) {
        var child = current.children[c]
        if (child.tagName && child.tagName.toLowerCase() === tag && !(onBody && isFroamOwned(child))) matches.push(child)
      }
      current = matches[index] || null
    }
    return current
  }

  function canApplyText(element) {
    var tag = element.tagName.toLowerCase()
    if (tag === 'input' || tag === 'textarea') return false
    if (element.children.length === 0) return true
    return TEXT_TAGS.indexOf(tag) !== -1
  }

  // innerText reads back normalised ("Hello " → "Hello"), so what the element
  // showed right after the last write is remembered: still showing exactly
  // that means the draft is on screen, and rewriting would only churn the DOM.
  var shownAfterWrite = typeof WeakMap === 'function' ? new WeakMap() : null
  function applyText(element, text) {
    var shown = element.innerText
    if (shown === text) return
    var last = shownAfterWrite && shownAfterWrite.get(element)
    if (last && last.text === text && last.shown === shown) return
    element.innerText = text
    if (shownAfterWrite) shownAfterWrite.set(element, { text: text, shown: element.innerText })
  }

  function clearInjected(root) {
    var injected = root.querySelectorAll('[data-froam-runtime-injected="true"]')
    for (var i = 0; i < injected.length; i += 1) injected[i].parentNode.removeChild(injected[i])
  }

  function ensureRuntimeVisibilityStyle() {
    var style = document.getElementById('froam-runtime-visibility')
    if (!style) {
      style = document.createElement('style')
      style.id = 'froam-runtime-visibility'
      document.head.appendChild(style)
    }
    style.textContent = 'html:not([data-chef-editing]) [data-froam-export-hidden="true"],html:not([data-chef-editing]) [data-froam-structure-deleted="true"]{display:none!important}'
  }

  function applySectionStructure(root, store) {
    var draft = store[SECTION_STRUCTURE_KEY]
    if (!draft || !draft.text) return
    var manifest
    try { manifest = JSON.parse(draft.text) } catch (e) { return }
    if (!manifest || !Array.isArray(manifest.sections)) return
    var resolved = []
    for (var i = 0; i < manifest.sections.length; i += 1) {
      var entry = manifest.sections[i]
      if (!entry || typeof entry.sourcePath !== 'string' || typeof entry.nodeId !== 'string') continue
      var element = root.querySelector('[data-froam-id="' + entry.nodeId.replace(/["\\\\]/g, '\\\\$&') + '"]') || findByPath(root, entry.sourcePath)
      if (!element || element.getAttribute('data-froam-runtime-injected') === 'true') continue
      element.setAttribute('data-froam-id', entry.nodeId)
      element.setAttribute('data-froam-structure-source', entry.sourcePath)
      resolved.push({ entry: entry, element: element })
    }
    resolved.filter(function (item) { return !item.entry.deleted }).sort(function (a, b) { return a.entry.order - b.entry.order }).forEach(function (item) {
      var parent = item.entry.parentPath === ROOT_PARENT_KEY ? root : findByPath(root, item.entry.parentPath)
      if (parent) {
        var current = Array.prototype.indexOf.call(parent.children, item.element)
        if (current !== item.entry.order) {
          item.element.remove()
          parent.insertBefore(item.element, parent.children.item(item.entry.order))
        }
      }
      item.element.hidden = !!item.entry.exportHidden
      if (item.entry.exportHidden) item.element.setAttribute('data-froam-export-hidden', 'true')
      else item.element.removeAttribute('data-froam-export-hidden')
    })
    resolved.filter(function (item) { return !!item.entry.deleted }).forEach(function (item) {
      item.element.hidden = true
      item.element.setAttribute('data-froam-structure-deleted', 'true')
    })
  }

  function applyInjections(root, store) {
    var blocks = []
    for (var key in store) {
      if (key.indexOf(INJECTION_PREFIX) !== 0 || !store[key].text) continue
      try {
        var parsed = JSON.parse(store[key].text)
        if (typeof parsed.html === 'string' && typeof parsed.parentPath === 'string') {
          blocks.push({ html: parsed.html, parentPath: parsed.parentPath, parentId: typeof parsed.parentId === 'string' ? parsed.parentId : '', order: typeof parsed.order === 'number' ? parsed.order : 0 })
        }
      } catch (e) { /* skip malformed */ }
    }
    blocks.sort(function (a, b) { return a.order - b.order })
    for (var i = 0; i < blocks.length; i += 1) {
      var parent = blocks[i].parentId ? root.querySelector('[data-froam-id="' + blocks[i].parentId.replace(/["\\\\]/g, '\\\\$&') + '"]') : blocks[i].parentPath === ROOT_PARENT_KEY ? root : findByPath(root, blocks[i].parentPath)
      if (!parent) continue
      var template = document.createElement('template')
      template.innerHTML = blocks[i].html.trim()
      var node = template.content.firstElementChild
      if (!node) continue
      node.setAttribute('data-froam-runtime-injected', 'true')
      node.removeAttribute('data-chef-selected')
      node.removeAttribute('data-chef-hovered')
      // Blocks saved before 8.5 carried contenteditable — never live for visitors.
      node.removeAttribute('contenteditable')
      var editables = node.querySelectorAll('[contenteditable]')
      for (var e = 0; e < editables.length; e += 1) editables[e].removeAttribute('contenteditable')
      parent.insertBefore(node, parent.children.item(blocks[i].order))
    }
  }

  function applyCustomCss(css) {
    var styleEl = document.getElementById('froam-global-styles')
    if (css) {
      if (!styleEl) {
        styleEl = document.createElement('style')
        styleEl.id = 'froam-global-styles'
        document.head.appendChild(styleEl)
      }
      if (styleEl.textContent !== css) styleEl.textContent = css
    } else if (styleEl) {
      styleEl.textContent = ''
    }
  }

  function normRoute(value) {
    var p = String(value || '/').split('?')[0].split('#')[0]
    p = p.replace(/\\/index\\.html?$/i, '/')
    p = p.replace(/\\/+$/, '')
    return p || '/'
  }

  function apply() {
    if (document.documentElement.hasAttribute('data-chef-editing')) return
    var routeKey = normRoute(window.location.pathname)
    document.documentElement.setAttribute('data-froam-route', routeKey)

    var root = getRoot()
    if (!root) return
    if (!root.hasAttribute('data-froam-root')) root.setAttribute('data-froam-root', '')

    clearInjected(root)
    var route = DESIGN.routes[routeKey]
    var store = route && route[viewportMode()]
    if (!store) { applyCustomCss(''); return }

    applySectionStructure(root, store)
    applyInjections(root, store)

    for (var key in store) {
      if (key === CANVAS_KEY) { applyCustomCss(store[key].customCSS || ''); continue }
      if (key.indexOf('__froam') === 0) continue
      var target = findByPath(root, key)
      if (!target) continue
      var draft = store[key]
      if (draft.text !== undefined && canApplyText(target)) applyText(target, draft.text)
      if (draft.imageUrl !== undefined && target.tagName.toLowerCase() === 'img') {
        if (draft.imageUrl && target.getAttribute('src') !== draft.imageUrl) target.src = draft.imageUrl
        if (!draft.imageUrl && target.hasAttribute('src')) target.removeAttribute('src')
      }
    }
  }

  var frame = 0
  var observer = null
  // apply() re-injects blocks and rewrites text, which mutates the root; those
  // records are the runtime's own — left queued, they'd schedule the next
  // apply and rebuild every injected block on every frame.
  function applyOwnChanges() {
    apply()
    if (observer) observer.takeRecords()
  }
  function scheduleApply() {
    cancelAnimationFrame(frame)
    frame = requestAnimationFrame(applyOwnChanges)
  }

  function patchHistory(method) {
    var original = window.history[method]
    window.history[method] = function () {
      var result = original.apply(this, arguments)
      scheduleApply()
      return result
    }
  }

  function start() {
    ensureRuntimeVisibilityStyle()
    apply()
    patchHistory('pushState')
    patchHistory('replaceState')
    window.addEventListener('popstate', scheduleApply)
    window.addEventListener('resize', scheduleApply)
    var root = getRoot()
    if (root && typeof MutationObserver !== 'undefined') {
      observer = new MutationObserver(function (mutations) {
        for (var i = 0; i < mutations.length; i += 1) {
          var node = mutations[i].target
          if (node && node.closest && node.closest('[data-froam-runtime-injected="true"], [data-chef-editor-root]')) continue
          scheduleApply()
          return
        }
      })
      // A portal's modal mounts on <body>, long after load: watch it too.
      observer.observe(hasBodyPaths() && root !== document.body ? document.body : root, { childList: true, subtree: true })
    }
  }

  function hasBodyPaths() {
    for (var routeKey in DESIGN.routes) {
      var viewports = DESIGN.routes[routeKey]
      for (var viewport in viewports) {
        for (var key in viewports[viewport]) if (key.indexOf(BODY_PREFIX) === 0) return true
      }
    }
    return false
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start)
  else start()
})()
`
}

const GLUE_TS = `// Generated by froam-studio — do not edit by hand.
import './froam.generated.css'
import design from './froam.design.json'
export default design
`

/**
 * Ensure the froam dir exists with design.json / generated.css /
 * runtime.js (+ index.ts glue when `glue` is true, for bundled
 * React/Vite apps that import the design).
 */
export function ensureScaffold(froamDir, { glue = true } = {}) {
  fs.mkdirSync(froamDir, { recursive: true })
  const designPath = path.join(froamDir, 'froam.design.json')
  if (!fs.existsSync(designPath)) {
    fs.writeFileSync(designPath, JSON.stringify(emptyDesign(), null, 2) + '\n')
  }
  const design = loadDesign(designPath)
  const cssPath = path.join(froamDir, 'froam.generated.css')
  if (!fs.existsSync(cssPath)) fs.writeFileSync(cssPath, generateCss(design))
  const runtimePath = path.join(froamDir, 'froam.runtime.js')
  if (!fs.existsSync(runtimePath)) fs.writeFileSync(runtimePath, generateRuntimeJs(design))
  if (glue) {
    const gluePath = path.join(froamDir, 'index.ts')
    if (!fs.existsSync(gluePath)) fs.writeFileSync(gluePath, GLUE_TS)
  }
  return design
}

/**
 * The three shipped files as strings, without touching a filesystem.
 *
 * Split out so a server can commit a design straight to a repo (see
 * lib/github-committer.mjs) and produce byte-identical output to the local
 * bridge — a design saved from a phone must not differ from one saved on a
 * laptop.
 */
export function buildDesignArtifacts(design) {
  return {
    design: JSON.stringify(design, null, 2) + '\n',
    css: generateCss(design),
    runtime: generateRuntimeJs(design),
  }
}

/** Compile design.json → generated.css + runtime.js. Returns file list. */
export function writeArtifacts(froamDir, design) {
  const artifacts = buildDesignArtifacts(design)
  fs.writeFileSync(path.join(froamDir, 'froam.design.json'), artifacts.design)
  fs.writeFileSync(path.join(froamDir, 'froam.generated.css'), artifacts.css)
  fs.writeFileSync(path.join(froamDir, 'froam.runtime.js'), artifacts.runtime)
  return ['froam.design.json', 'froam.generated.css', 'froam.runtime.js']
}

/** Merge one route+viewport store into a design (repo save payload). */
/**
 * Keep only brand fonts that can actually compile. Brand fonts arrive over
 * the bridge from the editor, get written to disk, and end up in production
 * CSS — so they are sanitised on the way in rather than trusted and patched
 * up at generation time.
 */
export function sanitizeBrandFonts(value) {
  if (!Array.isArray(value)) return []
  const clean = []
  for (const font of value) {
    const family = typeof font?.family === 'string' ? font.family.trim() : ''
    if (!family) continue
    const faces = []
    for (const face of Array.isArray(font.faces) ? font.faces : []) {
      if (!isSafeFontSrc(face?.src)) continue
      const kept = { src: face.src }
      if (face.weight !== undefined) kept.weight = face.weight
      if (face.style === 'italic') kept.style = 'italic'
      if (BRAND_FONT_FORMATS.has(face.format)) kept.format = face.format
      faces.push(kept)
    }
    if (faces.length) clean.push({ family, faces })
  }
  return clean
}

export function mergeSave(design, { routeKey, viewportMode, store, brandFonts, rootScope }) {
  const next = migrateDesign(design)
  // A fresh design adopts the scope the editor edited in; one that already
  // has edits keeps its own, or every existing path would shift under it.
  if (rootScope === 'page' && !designHasDrafts(next)) next.rootScope = 'page'
  const key = normalizeRouteKey(routeKey)
  next.routes[key] = next.routes[key] ?? {}
  next.routes[key][viewportMode] = store
  // Brand fonts are design-level, not per-route. Absent means "unchanged",
  // so a save from a route that never opened the font picker can't wipe them.
  if (brandFonts !== undefined) {
    const clean = sanitizeBrandFonts(brandFonts)
    if (clean.length) next.brandFonts = clean
    else delete next.brandFonts
  }
  next.updatedAt = new Date().toISOString()
  return next
}
