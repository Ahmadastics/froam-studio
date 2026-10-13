/**
 * Sections into the source, for static sites.
 *
 * A section added from the Library, or any block placed on the page, is
 * saved as an injection: its HTML lives in froam.design.json and
 * froam.runtime.js puts it on the page after load. That works, but the page
 * a search engine or a script-less reader gets doesn't have it, the source
 * a developer opens doesn't either, and the site depends on Froam's runtime
 * for its content. For a plain HTML site Froam can do better: write the
 * block into the .html file, where it would have been written by hand.
 *
 * It is path-neutral. The editor and the runtime both count injected blocks
 * when they address elements (src/collab/paths.ts), and the runtime puts
 * them in before applying anything else, so a block written at the place
 * the runtime would have put it leaves every other edit's path pointing at
 * what it pointed at before.
 *
 * Deliberately narrow, like copy write-back:
 *   - only the folder `froam dev --serve` is serving, and only when it is a
 *     plain static site, not a build output that the next build replaces;
 *   - only desktop edits, which flow down to every size: a block added at
 *     phone size alone would appear everywhere once it is in the HTML;
 *   - never a block with a script or an inline event handler: the runtime
 *     inserts HTML that doesn't run, and the source must not start running it;
 *   - when one block in a parent can't be written, the ones after it in the
 *     same parent stay injections too, so their positions stay right.
 */
import fs from 'node:fs'
import path from 'node:path'
import { findElementByPath, parseHtml, queryFirstByTag, resolveFroamRoot } from './html-tree.mjs'

export const ROOT_PARENT_KEY = '__froam_root__'
export const INJECTION_PREFIX = '__froam_injection__:'

/** The .html file a route is served from, or null. Mirrors the static server. */
export function htmlFileForRoute(serveDir, routeKey) {
  const root = path.resolve(serveDir)
  const relative = String(routeKey || '/').replace(/^\/+|\/+$/g, '')
  const candidates = relative ? [`${relative}.html`, `${relative}/index.html`, relative] : ['index.html']
  for (const candidate of candidates) {
    const file = path.resolve(root, candidate)
    const inside = path.relative(root, file)
    if (inside.startsWith('..') || path.isAbsolute(inside)) continue
    if (/\.html?$/i.test(file) && fs.existsSync(file) && fs.statSync(file).isFile()) return file
  }
  return null
}

/**
 * Editor-only attributes: Froam's bookkeeping, never something a visitor
 * needs. `data-froam-component-id` stays: it names the Library pattern a
 * section came from, which the editor can use again later.
 */
const EDITOR_ATTRIBUTES = /\s(?:data-froam-(?:injected|block|id|runtime-injected|component-category|writable|moving|switching|pin|pe|multi-selected|boundary-label|static-boundary)|data-chef-[\w-]+|contenteditable)(?:="[^"]*"|='[^']*')?(?=[\s/>])/g
const MEDIA_REF = /froam-media:([a-f0-9]{32}\.(?:jpg|png|webp|avif|gif|svg|bmp|mp4|webm|mov|ogv))/g
const RUNS_CODE = /<script\b|\son[a-z]+\s*=|javascript:/i

/**
 * A block's saved HTML as the source should hold it: no editor attributes,
 * placed media pointing at the files in the workspace's media/ folder.
 * Returns null for anything that isn't exactly one element, or that runs code.
 */
export function cleanBlockHtml(html, mediaPrefix) {
  const trimmed = String(html ?? '').trim()
  if (!trimmed || RUNS_CODE.test(trimmed)) return null
  const tree = parseHtml(trimmed)
  if (tree.children.length !== 1 || tree.childNodes.some((node) => node.type === 'text' && node.value.trim())) return null
  return trimmed.replace(EDITOR_ATTRIBUTES, '').replace(MEDIA_REF, (_, name) => `${mediaPrefix}${name}`)
}

/** The whitespace a line starts with, when nothing but whitespace comes before `index` on it. */
function indentAt(source, index) {
  const lineStart = source.lastIndexOf('\n', index - 1) + 1
  const before = source.slice(lineStart, index)
  return /^[ \t]*$/.test(before) ? { lineStart, indent: before } : null
}

/** `html` placed as child number `order` of the element at `parentPath`. Returns the new source, or a reason. */
function insertBlock(source, { parentPath, order, html, rootScope }) {
  const document = parseHtml(source)
  const root = rootScope === 'page' ? (queryFirstByTag(document, 'body') ?? document) : resolveFroamRoot(document).element
  const parent = parentPath === ROOT_PARENT_KEY ? root : findElementByPath(root, parentPath)
  if (!parent || parent.tag === '#document') return { reason: 'its place on the page is not in this file' }

  const before = Number.isInteger(order) && order >= 0 ? parent.children[order] : undefined
  if (before && typeof before.start === 'number') {
    const line = indentAt(source, before.start)
    const insert = line ? `${html}\n${line.indent}` : html
    return { source: source.slice(0, before.start) + insert + source.slice(before.start) }
  }
  if (typeof parent.closeStart !== 'number') return { reason: 'the element it goes in has no closing tag to write before' }
  const line = indentAt(source, parent.closeStart)
  if (line) {
    const childIndent = parent.children[0] && indentAt(source, parent.children[0].start)?.indent
    const insert = `${childIndent ?? `${line.indent}  `}${html}\n`
    return { source: source.slice(0, line.lineStart) + insert + source.slice(line.lineStart) }
  }
  return { source: source.slice(0, parent.closeStart) + html + source.slice(parent.closeStart) }
}

/**
 * Write blocks into the route's .html file.
 *
 * @param {{ serveDir: string, froamDir: string, routeKey: string, rootScope?: string,
 *   blocks: Array<{ key: string, parentPath: string, order: number, html: string }> }} options
 * @returns {Array<{ key: string, status: 'written' | 'skipped', file?: string, line?: number, reason?: string }>}
 */
export function writeBlocks({ serveDir, froamDir, routeKey, rootScope, blocks }) {
  const file = htmlFileForRoute(serveDir, routeKey)
  if (!file) return blocks.map(({ key }) => ({ key, status: 'skipped', reason: 'no .html file for this page' }))
  const name = path.relative(path.resolve(serveDir), file).split(path.sep).join('/')
  const mediaDir = path.relative(path.dirname(file), path.join(froamDir, 'media')).split(path.sep).join('/')
  const mediaPrefix = `${mediaDir || '.'}/`

  let source = fs.readFileSync(file, 'utf8')
  const results = new Map()
  const blockedParents = new Set()
  // The runtime inserts in this order; each one sees the ones before it in place.
  for (const block of [...blocks].sort((a, b) => a.order - b.order)) {
    if (blockedParents.has(block.parentPath)) {
      results.set(block.key, { key: block.key, status: 'skipped', reason: 'a section before it in the same place stays a Froam edit' })
      continue
    }
    const html = cleanBlockHtml(block.html, mediaPrefix)
    const placed = html ? insertBlock(source, { ...block, html, rootScope }) : { reason: 'it runs code, or is not a single element' }
    if (!placed.source) {
      blockedParents.add(block.parentPath)
      results.set(block.key, { key: block.key, status: 'skipped', reason: placed.reason })
      continue
    }
    const at = placed.source.indexOf(html)
    source = placed.source
    results.set(block.key, { key: block.key, status: 'written', file: name, line: source.slice(0, at).split('\n').length })
  }
  if ([...results.values()].some((result) => result.status === 'written')) fs.writeFileSync(file, source)
  return blocks.map(({ key }) => results.get(key))
}

/** The written blocks leave the design at every size: the HTML has them now. */
export function dropWrittenBlocks(design, routeKey, keys) {
  const route = design.routes?.[routeKey]
  if (!route || !keys.length) return design
  const routes = { ...design.routes, [routeKey]: Object.fromEntries(Object.entries(route).map(([viewport, store]) => {
    if (!store || typeof store !== 'object') return [viewport, store]
    const next = { ...store }
    for (const key of keys) delete next[key]
    return [viewport, next]
  })) }
  return { ...design, routes }
}
