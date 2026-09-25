/**
 * Copy edits into the source.
 *
 * A text change made in the editor is, for most sites, a change to a string
 * someone wrote in a file: a JSX text node, an HTML heading, a Vue template,
 * a translation in en.json. Carrying it as a runtime override works, but it
 * means the page first renders the old words, the source keeps disagreeing
 * with the site, and the next developer edit to that string is silently
 * overwritten. Writing it back fixes all three.
 *
 * The rule is deliberately strict: an edit is written only when the original
 * text appears exactly once in the project's source, as a whole text node or
 * a whole string literal. Anything else — ambiguous, missing, split across
 * elements — is reported and stays an ordinary Froam edit. Nothing is written
 * outside the project, and nothing is written without an explicit Save.
 */
import fs from 'node:fs'
import path from 'node:path'

export const SOURCE_EXTENSIONS = new Set(['.html', '.htm', '.jsx', '.tsx', '.js', '.ts', '.mjs', '.cjs', '.vue', '.svelte', '.astro', '.json'])
const MARKUP_EXTENSIONS = new Set(['.html', '.htm', '.vue', '.svelte', '.astro'])
const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'build', 'out', '.next', '.nuxt', '.svelte-kit', '.astro', '.output', 'coverage', '.vercel', '.netlify', '.turbo', '.cache', 'froam', 'vendor', '.venv'])
const SKIP_FILES = new Set(['package.json', 'package-lock.json', 'tsconfig.json', 'froam.config.json', 'vercel.json', 'netlify.json'])
const MAX_FILES = 5000
const MAX_BYTES = 1_000_000

/** Source files under `root`, nearest first; no dependencies, builds, dotfolders or symlinks out. */
export function listSourceFiles(root, { maxFiles = MAX_FILES } = {}) {
  const found = []
  const queue = [root]
  while (queue.length && found.length < maxFiles) {
    const dir = queue.shift()
    let entries
    try { entries = fs.readdirSync(dir, { withFileTypes: true }) } catch { continue }
    for (const entry of entries) {
      if (entry.isSymbolicLink()) continue
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        if (!SKIP_DIRS.has(entry.name) && !entry.name.startsWith('.')) queue.push(full)
      } else if (entry.isFile() && SOURCE_EXTENSIONS.has(path.extname(entry.name).toLowerCase()) && !SKIP_FILES.has(entry.name) && !/\.min\.(js|css)$/.test(entry.name)) {
        try { if (fs.statSync(full).size <= MAX_BYTES) found.push(full) } catch { /* vanished */ }
      }
    }
  }
  return found
}

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** One character of displayed text, as it may be written in source. */
function characterPattern(character) {
  switch (character) {
    case '&': return '(?:&amp;|&#38;|&)'
    case '<': return '(?:&lt;|&#60;|<)'
    case '>': return '(?:&gt;|&#62;|>)'
    case '"': return '(?:&quot;|&#34;|\\\\"|")'
    case "'": return "(?:&#39;|&apos;|\\\\'|')"
    case '’': return '(?:&rsquo;|&#8217;|’)'
    case ' ': return '(?:&nbsp;|&#160;| | )'
    default: return escapeRegex(character)
  }
}

/** Displayed text → a pattern for how it may sit in source (entities, escapes, wrapped lines). */
export function sourcePattern(text) {
  const words = text.trim().split(/\s+/).filter(Boolean)
  return words.map((word) => Array.from(word).map(characterPattern).join('')).join('\\s+')
}

const WHITESPACE = /\s/
function significantBefore(source, index) {
  let i = index - 1
  while (i >= 0 && WHITESPACE.test(source[i])) i -= 1
  return source[i] ?? ''
}
function significantAfter(source, index) {
  let i = index
  while (i < source.length && WHITESPACE.test(source[i])) i += 1
  return source[i] ?? ''
}

const QUOTES = new Set(['"', "'", '`'])

/**
 * Where a match sits: a whole string literal (`quote`), a whole run of
 * markup text between tags or JSX braces (`markup`), or neither (null — part
 * of something longer, never touched).
 */
export function matchContext(source, start, end) {
  if (isInComment(source, start)) return null
  const before = significantBefore(source, start)
  const after = significantAfter(source, end)
  if (QUOTES.has(before) && before === after && source[start - 1] === before && source[end] === after) {
    // `{ "Hello world": … }` is a key, not copy.
    if (significantAfter(source, end + 1) === ':') return null
    return { kind: 'string', quote: before }
  }
  if ((before === '>' || before === '}') && (after === '<' || after === '{')) return { kind: 'markup' }
  return null
}

/**
 * Inside a comment: `<!-- … -->`, `/* … *\/`, or after `//` on the same line
 * (but not the `//` of a URL). A commented-out copy of the text is never the
 * one the page shows.
 */
export function isInComment(source, index) {
  const lastOpen = (open, close) => source.lastIndexOf(open, index) > source.lastIndexOf(close, index)
  if (lastOpen('<!--', '-->')) return true
  if (lastOpen('/*', '*/')) return true
  const lineStart = source.lastIndexOf('\n', index - 1) + 1
  const line = source.slice(lineStart, index)
  const slashes = line.search(/(^|[^:"'`/])\/\//)
  return slashes !== -1
}

/** Every place `text` appears in `source` as a whole text node or string. */
export function findTextOccurrences(source, text) {
  const pattern = sourcePattern(text)
  if (!pattern) return []
  const regex = new RegExp(pattern, 'g')
  const out = []
  for (let match = regex.exec(source); match; match = regex.exec(source)) {
    const start = match.index
    const end = start + match[0].length
    const context = matchContext(source, start, end)
    if (context) out.push({ start, end, context })
    if (match[0].length === 0) regex.lastIndex += 1
  }
  return out
}

const escapeHtml = (text) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

/** New text, written the way this spot in this file needs it. */
export function encodeForContext(text, context, extension) {
  if (context.kind === 'string') {
    if (extension === '.json') return JSON.stringify(text).slice(1, -1)
    const quote = context.quote
    let out = text.replace(/\\/g, '\\\\').replace(/\r?\n/g, '\\n')
    if (quote === '`') out = out.replace(/`/g, '\\`').replace(/\$\{/g, '\\${')
    else out = out.split(quote).join(`\\${quote}`)
    return out
  }
  const jsx = !MARKUP_EXTENSIONS.has(extension)
  const lines = text.split(/\r?\n/).map((line) => {
    const html = escapeHtml(line)
    return jsx ? html.replace(/[{}]/g, (brace) => `{'${brace}'}`) : html
  })
  return lines.join(jsx ? '<br />' : '<br>')
}

const lineOf = (source, index) => source.slice(0, index).split('\n').length

/**
 * Applies `edits` ([{ from, to }]) to the source under `root`.
 * Returns one result per edit, in order:
 *   { status: 'written', file, line }                  written to exactly one place
 *   { status: 'ambiguous', count, files }              the original appears more than once
 *   { status: 'not-found' }                            not in the source as a whole string
 *   { status: 'skipped', reason }                      nothing safe to do
 */
export function writeTextEdits(root, edits, { dryRun = false } = {}) {
  const files = listSourceFiles(root)
  const contents = new Map()
  const read = (file) => {
    if (!contents.has(file)) {
      try { contents.set(file, fs.readFileSync(file, 'utf8')) } catch { contents.set(file, null) }
    }
    return contents.get(file)
  }
  const changed = new Set()
  const results = []

  for (const edit of edits) {
    const from = typeof edit?.from === 'string' ? edit.from : ''
    const to = typeof edit?.to === 'string' ? edit.to : ''
    if (from.trim().length < 3) { results.push({ status: 'skipped', reason: 'too short to find safely' }); continue }
    if (from.trim() === to.trim()) { results.push({ status: 'skipped', reason: 'unchanged' }); continue }
    const hits = []
    for (const file of files) {
      const source = read(file)
      if (!source) continue
      for (const occurrence of findTextOccurrences(source, from)) hits.push({ file, ...occurrence })
      if (hits.length > 1) break
    }
    if (hits.length === 0) { results.push({ status: 'not-found' }); continue }
    if (hits.length > 1) {
      results.push({ status: 'ambiguous', count: hits.length, files: [...new Set(hits.map((hit) => path.relative(root, hit.file)))] })
      continue
    }
    const [hit] = hits
    const source = read(hit.file)
    const replacement = encodeForContext(to.trim(), hit.context, path.extname(hit.file).toLowerCase())
    contents.set(hit.file, source.slice(0, hit.start) + replacement + source.slice(hit.end))
    changed.add(hit.file)
    results.push({ status: 'written', file: path.relative(root, hit.file).split(path.sep).join('/'), line: lineOf(source, hit.start) })
  }

  if (!dryRun) for (const file of changed) fs.writeFileSync(file, contents.get(file))
  return results
}
