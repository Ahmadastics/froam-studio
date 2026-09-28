/**
 * Style edits into the source, for Tailwind projects.
 *
 * Copy write-back (source-writeback.mjs) puts words back where a person wrote
 * them. This does the same for looks: a colour, a size, some padding changed
 * in the editor becomes a change to the element's own class list —
 * `text-[#0f172a]`, `p-[24px]`, `font-semibold` — instead of an override in
 * froam.generated.css that the developer never sees.
 *
 * Deliberately narrow, like copy:
 *   - only projects that use Tailwind (it's the one styling system where the
 *     class list *is* the style, so the edit stays readable);
 *   - only when the element's exact class list appears once in the source;
 *   - only base (desktop) styles, and never a property the element already
 *     sets under a variant (`md:p-8`, `hover:bg-…`) — a base class there
 *     would be overruled and the edit would silently not show;
 *   - only properties with a clean utility; the rest stay Froam edits.
 */
import fs from 'node:fs'
import path from 'node:path'
import { listSourceFiles } from './source-writeback.mjs'

const kebab = (name) => name.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)

const COLOR = String.raw`(?:\[(?:#|rgb|hsl|oklch|color:|var\()[^\]]*\]|inherit|current|transparent|black|white|[a-z]+-\d{2,3}(?:\/\d+)?)`
const LENGTH = String.raw`(?:\[[^\]]+\]|\d+\/\d+|[\d.]+|px|auto|full|screen|min|max|fit)`

/** Utility groups: what a new class replaces. */
const GROUPS = {
  color: new RegExp(`^text-${COLOR}$`),
  'font-size': /^text-(?:xs|sm|base|lg|xl|[2-9]xl|\[(?:length:)?[\d.]+(?:px|rem|em|vw|%)?\])$/,
  'background-color': new RegExp(`^bg-${COLOR}$`),
  'font-weight': /^font-(?:thin|extralight|light|normal|medium|semibold|bold|extrabold|black|\[\d+\])$/,
  'text-align': /^text-(?:left|center|right|justify|start|end)$/,
  'letter-spacing': /^tracking-(?:tighter|tight|normal|wide|wider|widest|\[[^\]]+\])$/,
  'line-height': /^leading-(?:none|tight|snug|normal|relaxed|loose|\d+|\[[^\]]+\])$/,
  'border-radius': /^rounded(?:-(?:none|sm|md|lg|xl|2xl|3xl|full|\[[^\]]+\]))?$/,
  opacity: /^opacity-(?:\d+|\[[^\]]+\])$/,
  width: new RegExp(`^w-${LENGTH}$`),
  height: new RegExp(`^h-${LENGTH}$`),
  'max-width': /^max-w-(?:\S+)$/,
  gap: new RegExp(`^gap-${LENGTH}$`),
}
for (const [side, prefix] of [['', 'p'], ['-top', 'pt'], ['-right', 'pr'], ['-bottom', 'pb'], ['-left', 'pl']]) {
  GROUPS[`padding${side}`] = new RegExp(`^${prefix}-${LENGTH}$`)
  GROUPS[`margin${side}`] = new RegExp(`^-?${prefix.replace('p', 'm')}-${LENGTH}$`)
}
// Setting all four sides replaces the axis and side utilities too.
const ALSO_REPLACES = {
  padding: [/^p[xytrbl]?-/],
  margin: [/^-?m[xytrbl]?-/],
}

const WEIGHTS = { 100: 'thin', 200: 'extralight', 300: 'light', 400: 'normal', 500: 'medium', 600: 'semibold', 700: 'bold', 800: 'extrabold', 900: 'black' }
const ALIGN = new Set(['left', 'center', 'right', 'justify', 'start', 'end'])

/** An arbitrary value Tailwind can read back: spaces become underscores. */
function arbitrary(value) {
  const clean = String(value).trim()
  if (!clean || /[[\]"'`<>{}]/.test(clean) || clean.includes('!important')) return null
  return `[${clean.replace(/\s+/g, '_')}]`
}

/** One CSS property and value → one utility, or null when there isn't a clean one. */
export function utilityFor(property, value) {
  const prop = kebab(property)
  const v = String(value ?? '').trim()
  if (!v) return null
  const a = arbitrary(v)
  switch (prop) {
    case 'color': return a && `text-${a.replace('[', '[color:')}`
    case 'font-size': return a && `text-${a.replace('[', '[length:')}`
    case 'background-color': return a && `bg-${a}`
    case 'font-weight': return WEIGHTS[v] ? `font-${WEIGHTS[v]}` : a && `font-${a}`
    case 'text-align': return ALIGN.has(v) ? `text-${v}` : null
    case 'letter-spacing': return a && `tracking-${a}`
    case 'line-height': return a && `leading-${a}`
    case 'border-radius': return a && `rounded-${a}`
    case 'opacity': return a && `opacity-${a}`
    case 'width': return a && `w-${a}`
    case 'height': return a && `h-${a}`
    case 'max-width': return a && `max-w-${a}`
    case 'gap': return a && `gap-${a}`
    default: {
      const box = /^(padding|margin)(?:-(top|right|bottom|left))?$/.exec(prop)
      if (!box) return null
      const letter = box[1] === 'padding' ? 'p' : 'm'
      const side = box[2] ? box[2][0] : ''
      if (v.includes(' ')) return null
      return a && `${letter}${side}-${a}`
    }
  }
}

const SCREEN_VARIANTS = new Set(['sm', 'md', 'lg', 'xl', '2xl', 'dark', 'print', 'portrait', 'landscape'])

/** A class whose variants can replace the base value on some screens. */
function overriddenBy(name) {
  if (!name.includes(':')) return false
  const variants = name.split(':').slice(0, -1)
  return variants.some((variant) => SCREEN_VARIANTS.has(variant) || /^(?:min|max)-/.test(variant) || variant.startsWith('@'))
}

function groupOf(prop) {
  return GROUPS[prop] ?? null
}

/**
 * A class list with `styles` applied. Returns the new list and which
 * properties were written; a property that can't be written cleanly is left
 * out of `written` and stays a Froam edit.
 */
export function rewriteClassList(classList, styles) {
  let classes = classList.split(/\s+/).filter(Boolean)
  const written = []
  for (const [property, value] of Object.entries(styles ?? {})) {
    if (property.startsWith('__froamState')) continue
    const prop = kebab(property)
    const group = groupOf(prop)
    const utility = group ? utilityFor(prop, value) : null
    if (!utility) continue
    const replaced = [group, ...(ALSO_REPLACES[prop] ?? [])]
    const matches = (name) => replaced.some((pattern) => pattern.test(name))
    // A screen-size or dark-mode variant already sets this property: on those
    // screens a base class would lose to it. (hover:/focus: only apply in
    // that state, so the base value is still the one people see.)
    if (classes.some((name) => overriddenBy(name) && matches(name.slice(name.lastIndexOf(':') + 1)))) continue
    classes = classes.filter((name) => !matches(name))
    classes.push(utility)
    written.push(property)
  }
  return { classList: classes.join(' '), written }
}

/** Every class attribute in a file: `class="…"`, `className='…'`, `className={"…"}` / {`…`}. */
const CLASS_ATTR = /\b(class|className)\s*=\s*(?:(["'])([^"'\n]*)\2|\{\s*(["'`])([^"'`\n$]*)\4\s*\})/g

const tokens = (value) => value.split(/\s+/).filter(Boolean).sort().join(' ')

function findClassAttributes(source, tag, classList) {
  const wanted = tokens(classList)
  const hits = []
  CLASS_ATTR.lastIndex = 0
  for (let match = CLASS_ATTR.exec(source); match; match = CLASS_ATTR.exec(source)) {
    const value = match[3] ?? match[5] ?? ''
    if (tokens(value) !== wanted) continue
    // The attribute must sit on the element's own opening tag.
    const open = source.lastIndexOf('<', match.index)
    const close = source.lastIndexOf('>', match.index)
    if (open < 0 || close > open) continue
    const tagName = /^<([A-Za-z][\w.-]*)/.exec(source.slice(open))?.[1]
    if (!tagName || (tag && tagName.toLowerCase() !== tag.toLowerCase())) continue
    const valueStart = match.index + match[0].indexOf(value, match[1].length)
    hits.push({ start: valueStart, end: valueStart + value.length })
  }
  return hits
}

/**
 * Applies style edits ([{ tag, className, styles }]) across `files`.
 * One result per edit:
 *   { status: 'written', file, line, written: [properties] }
 *   { status: 'ambiguous' | 'not-found' | 'skipped', reason? }
 */
export function applyStyleEdits(files, edits, { read: readFile, name = (file) => file } = {}) {
  const contents = new Map()
  const read = (file) => {
    if (!contents.has(file)) contents.set(file, readFile(file))
    return contents.get(file)
  }
  const changed = new Set()
  const results = []
  for (const edit of edits) {
    const classList = typeof edit?.className === 'string' ? edit.className.trim() : ''
    if (tokens(classList).split(' ').length < 2) { results.push({ status: 'skipped', reason: 'too few classes to find safely' }); continue }
    const hits = []
    for (const file of files) {
      const source = read(file)
      if (!source) continue
      for (const hit of findClassAttributes(source, edit.tag, classList)) hits.push({ file, ...hit })
      if (hits.length > 1) break
    }
    if (!hits.length) { results.push({ status: 'not-found' }); continue }
    if (hits.length > 1) { results.push({ status: 'ambiguous' }); continue }
    const [hit] = hits
    const source = read(hit.file)
    const rewrite = rewriteClassList(source.slice(hit.start, hit.end), edit.styles)
    if (!rewrite.written.length) { results.push({ status: 'skipped', reason: 'no property with a clean utility' }); continue }
    contents.set(hit.file, source.slice(0, hit.start) + rewrite.classList + source.slice(hit.end))
    changed.add(hit.file)
    results.push({ status: 'written', file: name(hit.file), line: source.slice(0, hit.start).split('\n').length, written: rewrite.written, from: source.slice(hit.start, hit.end), to: rewrite.classList, tag: edit.tag ?? null })
  }
  return { results, changed: new Map([...changed].map((file) => [file, contents.get(file)])) }
}

/**
 * Put class lists back ([{ tag, from, to }] as a written result reports them):
 * where `to` is still the element's list, it becomes `from` again. A list
 * someone has changed since is left alone.
 */
export function revertClassLists(files, reverts, { read: readFile, name = (file) => file } = {}) {
  const contents = new Map()
  const read = (file) => {
    if (!contents.has(file)) contents.set(file, readFile(file))
    return contents.get(file)
  }
  const changed = new Set()
  const results = []
  for (const revert of reverts) {
    let done = false
    for (const file of files) {
      const source = read(file)
      if (!source) continue
      const hits = findClassAttributes(source, revert.tag, revert.to)
      if (hits.length !== 1) continue
      const [hit] = hits
      contents.set(file, source.slice(0, hit.start) + revert.from + source.slice(hit.end))
      changed.add(file)
      results.push({ status: 'reverted', file: name(file) })
      done = true
      break
    }
    if (!done) results.push({ status: 'changed-since' })
  }
  return { results, changed: new Map([...changed].map((file) => [file, contents.get(file)])) }
}

/** Does this project style with Tailwind? */
export function usesTailwind(root) {
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'))
    const deps = { ...pkg.dependencies, ...pkg.devDependencies }
    if (deps.tailwindcss || deps['@tailwindcss/vite'] || deps['@tailwindcss/postcss']) return true
  } catch { /* no package.json */ }
  return ['tailwind.config.js', 'tailwind.config.ts', 'tailwind.config.cjs', 'tailwind.config.mjs'].some((file) => fs.existsSync(path.join(root, file)))
}

/** Style edits into the project under `root`. */
export function writeStyleEdits(root, edits, { dryRun = false } = {}) {
  const files = listSourceFiles(root).filter((file) => !file.endsWith('.json'))
  const { results, changed } = applyStyleEdits(files, edits, {
    read: (file) => { try { return fs.readFileSync(file, 'utf8') } catch { return null } },
    name: (file) => path.relative(root, file).split(path.sep).join('/'),
  })
  if (!dryRun) for (const [file, content] of changed) fs.writeFileSync(file, content)
  return results
}
