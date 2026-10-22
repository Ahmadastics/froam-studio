/**
 * Froam Studio — the record: who changed what, who approved it, and when.
 *
 * An office that lets five people touch its website gets asked, sooner or
 * later, "who changed this, and who said it could go up?" Git knows which
 * files moved; it doesn't know that Amina asked for the new opening hours and
 * the owner approved them at 10:45. This file does.
 *
 *   froam/froam.record.jsonl     one entry per line, oldest first, append-only
 *
 * Each entry carries the hash of the one before it, so changing or deleting a
 * line anywhere breaks every hash after it and `verifyRecord` says where. That
 * alone doesn't stop someone rewriting the whole chain from the top; what does
 * is that Go Live commits the record with the site and writes the newest hash
 * into the commit message, so a rewrite would have to rewrite pushed history
 * too, and everyone with a copy of the repo would see it.
 *
 * What goes in is deliberately small: a person's name as they gave it, their
 * role, the pages, and the words or settings that changed (clipped). No
 * emails, no addresses, no tokens. It lives in the project, is never uploaded
 * by `froam publish`, and goes wherever the repo goes.
 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'

export const RECORD_FILE = 'froam.record.jsonl'
export const RECORD_VERSION = 1
/** The `prev` of the first entry: there is nothing before it. */
export const RECORD_GENESIS = '0'.repeat(64)

const MAX_CHANGES = 40
const MAX_TEXT = 160
const MAX_NAME = 60
const MAX_TITLE = 120
const MAX_NOTE = 600
const MAX_PAGES = 24
/** How much of the file's end is read to find the last entry. An entry is a few KB at most. */
const TAIL_BYTES = 256 * 1024

/* ── hashing ─────────────────────────────────────────────── */

/**
 * JSON with keys in a fixed order, so an entry hashes the same however it was
 * written: by this file, by a host's own copy of it, or re-saved by an editor
 * that reordered nothing but the keys.
 */
export function canonicalJson(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value ?? null)
  if (Array.isArray(value)) return `[${value.map((item) => canonicalJson(item === undefined ? null : item)).join(',')}]`
  const keys = Object.keys(value).filter((key) => value[key] !== undefined).sort()
  return `{${keys.map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(',')}}`
}

export function entryHash(entry) {
  const { hash: _hash, ...rest } = entry
  return createHash('sha256').update(canonicalJson(rest)).digest('hex')
}

/* ── reading ─────────────────────────────────────────────── */

/** Every line that parses, in file order. Line endings don't matter (git may turn them into CRLF). */
export function parseRecord(text) {
  const entries = []
  const problems = []
  String(text ?? '').split('\n').forEach((raw, index) => {
    const line = raw.trim()
    if (!line) return
    try {
      const entry = JSON.parse(line)
      if (entry && typeof entry === 'object' && !Array.isArray(entry)) entries.push(entry)
      else problems.push({ line: index + 1, reason: 'not an entry' })
    } catch {
      problems.push({ line: index + 1, reason: 'not readable JSON' })
    }
  })
  return { entries, problems }
}

/**
 * Walk the chain. `ok` means every entry is where it was written, unchanged,
 * and nothing between them is missing. The first problem is reported with
 * the line it's on, since that's where a person would look.
 */
export function verifyRecord(text) {
  const lines = String(text ?? '').split('\n')
  let prev = RECORD_GENESIS
  let seq = 0
  let count = 0
  let first = null
  let last = null
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index].trim()
    if (!line) continue
    let entry
    try { entry = JSON.parse(line) } catch {
      return { ok: false, count, head: prev, first, last, problem: { line: index + 1, seq: seq + 1, reason: 'This line isn’t readable: it was edited by hand or cut short.' } }
    }
    seq += 1
    const where = { line: index + 1, seq }
    if (entry?.seq !== seq) return { ok: false, count, head: prev, first, last, problem: { ...where, reason: `Entry ${seq} is missing or out of order (found ${entry?.seq ?? 'none'}).` } }
    if (entry.prev !== prev) return { ok: false, count, head: prev, first, last, problem: { ...where, reason: `Entry ${seq} doesn’t follow the one before it: something before it was changed or removed.` } }
    if (entry.hash !== entryHash(entry)) return { ok: false, count, head: prev, first, last, problem: { ...where, reason: `Entry ${seq} was changed after it was written.` } }
    prev = entry.hash
    count += 1
    first = first ?? entry.at ?? null
    last = entry.at ?? last
  }
  return { ok: true, count, head: prev, first, last, problem: null }
}

function readTail(file) {
  let handle
  try {
    handle = fs.openSync(file, 'r')
    const size = fs.fstatSync(handle).size
    const length = Math.min(size, TAIL_BYTES)
    const buffer = Buffer.alloc(length)
    fs.readSync(handle, buffer, 0, length, size - length)
    return buffer.toString('utf8')
  } catch {
    return ''
  } finally {
    if (handle !== undefined) try { fs.closeSync(handle) } catch { /* closed */ }
  }
}

/** The newest entry, read from the end of the file (the record only grows). */
function lastEntry(file) {
  const lines = readTail(file).split('\n').map((line) => line.trim()).filter(Boolean)
  for (let index = lines.length - 1; index >= 0; index -= 1) {
    try {
      const entry = JSON.parse(lines[index])
      if (entry && Number.isInteger(entry.seq) && typeof entry.hash === 'string') return entry
    } catch { /* a cut-off first line of the tail, keep looking */ }
  }
  return null
}

/* ── cleaning what comes in ──────────────────────────────── */

const clip = (value, max = MAX_TEXT) => {
  if (value === undefined || value === null) return null
  const text = String(value).replace(/\s+/g, ' ').trim()
  if (!text) return null
  return text.length > max ? `${text.slice(0, max - 1)}…` : text
}

function cleanPerson(person) {
  if (!person || typeof person !== 'object') return null
  const name = clip(person.name, MAX_NAME)
  if (!name) return null
  return {
    name,
    ...(clip(person.role, 20) ? { role: clip(person.role, 20) } : {}),
    ...(clip(person.via, 30) ? { via: clip(person.via, 30) } : {}),
  }
}

function cleanChangeList(changes) {
  if (!Array.isArray(changes)) return undefined
  const list = changes.slice(0, MAX_CHANGES).map((change) => ({
    label: clip(change?.label, MAX_TEXT) ?? 'Change',
    ...(clip(change?.before) ? { before: clip(change.before) } : {}),
    ...(clip(change?.after) ? { after: clip(change.after) } : {}),
    ...(typeof change?.routeKey === 'string' ? { page: clip(change.routeKey, 200) } : typeof change?.page === 'string' ? { page: clip(change.page, 200) } : {}),
  }))
  return list.length ? list : undefined
}

function cleanPages(pages) {
  if (!Array.isArray(pages)) return undefined
  const list = [...new Set(pages.filter((page) => typeof page === 'string' && page).map((page) => clip(page, 200)))].slice(0, MAX_PAGES)
  return list.length ? list : undefined
}

function cleanRefs(refs) {
  if (!refs || typeof refs !== 'object') return undefined
  const out = {}
  for (const [key, value] of Object.entries(refs)) {
    if (!/^[a-z][a-zA-Z]{0,20}$/.test(key)) continue
    if (typeof value === 'string' && value) out[key] = clip(value, 300)
    else if (typeof value === 'number' && Number.isFinite(value)) out[key] = value
  }
  return Object.keys(out).length ? out : undefined
}

/* ── the record ──────────────────────────────────────────── */

/**
 * @param {{ froamDir: string, now?: () => number, log?: (line: string) => void }} options
 */
export function createFroamRecord({ froamDir, now = () => Date.now(), log = () => {} }) {
  const file = path.join(froamDir, RECORD_FILE)

  /**
   * Write one entry. `event`: { type, by, title?, author?, pages?, viewport?,
   * changes?, count?, note?, result?, refs? }. Returns the entry as written.
   */
  function append(event) {
    const type = clip(event?.type, 40)
    if (!type) throw new Error('[froam] a record entry needs a type')
    fs.mkdirSync(froamDir, { recursive: true })
    const previous = fs.existsSync(file) ? lastEntry(file) : null
    const changes = cleanChangeList(event.changes)
    const entry = {
      v: RECORD_VERSION,
      seq: (previous?.seq ?? 0) + 1,
      at: new Date(now()).toISOString(),
      type,
      by: cleanPerson(event.by) ?? { name: 'Someone' },
      ...(clip(event.title, MAX_TITLE) ? { title: clip(event.title, MAX_TITLE) } : {}),
      ...(cleanPerson(event.author) ? { author: cleanPerson(event.author) } : {}),
      ...(cleanPages(event.pages) ? { pages: cleanPages(event.pages) } : {}),
      ...(typeof event.viewport === 'string' ? { viewport: clip(event.viewport, 20) } : {}),
      ...(changes ? { changes } : {}),
      // How many there were when more than fit (changes is clipped at MAX_CHANGES).
      ...(Number.isInteger(event.count) && event.count > (changes?.length ?? 0) ? { count: event.count } : {}),
      ...(clip(event.note, MAX_NOTE) ? { note: clip(event.note, MAX_NOTE) } : {}),
      ...(clip(event.result, MAX_NOTE) ? { result: clip(event.result, MAX_NOTE) } : {}),
      ...(cleanRefs(event.refs) ? { refs: cleanRefs(event.refs) } : {}),
      prev: previous?.hash ?? RECORD_GENESIS,
    }
    entry.hash = entryHash(entry)
    // One line, one write: an entry is either all there or not there.
    fs.appendFileSync(file, `${JSON.stringify(entry)}\n`)
    return entry
  }

  /** Never fails the thing being recorded: a record that can't be written is logged, loudly. */
  function note(event) {
    try {
      return append(event)
    } catch (error) {
      log(`couldn’t write to the record (${RECORD_FILE}): ${error instanceof Error ? error.message : error}`)
      return null
    }
  }

  function text() {
    try { return fs.readFileSync(file, 'utf8') } catch { return '' }
  }

  return {
    file,
    append,
    note,
    /** Newest first, `limit` of them, before sequence number `before` when paging back. */
    read({ limit = 200, before = null } = {}) {
      const { entries } = parseRecord(text())
      const older = before ? entries.filter((entry) => entry.seq < before) : entries
      return older.slice(-limit).reverse()
    },
    all() { return parseRecord(text()).entries },
    verify() { return verifyRecord(text()) },
    head() { return fs.existsSync(file) ? lastEntry(file)?.hash ?? null : null },
    exists() { return fs.existsSync(file) },
  }
}

/* ── who "you" are, on this computer ─────────────────────── */

/**
 * The name the owner's own saves are recorded under: the one set in
 * froam.config.json ("record": { "name": … }), else git's user.name for the
 * project, else this computer's account name. Never an email.
 */
export function ownerName({ configPath = null, cwd = null } = {}) {
  if (configPath) {
    try {
      const name = clip(JSON.parse(fs.readFileSync(configPath, 'utf8'))?.record?.name, MAX_NAME)
      if (name) return name
    } catch { /* no config yet */ }
  }
  try {
    const name = clip(execFileSync('git', ['config', 'user.name'], { cwd: cwd ?? process.cwd(), encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 3000 }), MAX_NAME)
    if (name) return name
  } catch { /* not a repo, or no name set */ }
  try {
    const name = clip(os.userInfo().username, MAX_NAME)
    if (name) return name
  } catch { /* some sandboxes have no user */ }
  return 'Owner'
}

/* ── what changed, in words ──────────────────────────────── */

const INJECTION_PREFIX = '__froam_injection__:'
const TAG_NAMES = {
  h1: 'Heading', h2: 'Heading', h3: 'Heading', h4: 'Heading', h5: 'Heading', h6: 'Heading',
  p: 'Paragraph', a: 'Link', button: 'Button', img: 'Image', li: 'List item', span: 'Text',
  section: 'Section', header: 'Header', footer: 'Footer', nav: 'Navigation', svg: 'Icon',
  div: 'Box', main: 'Main area', figure: 'Figure', video: 'Video', form: 'Form', input: 'Field', label: 'Label',
}
const FIELD_LABELS = { text: 'Words', imageUrl: 'Picture', media: 'Picture or video', href: 'Link' }

function tagOf(elementPath) {
  const last = String(elementPath).split('/').filter(Boolean).at(-1) ?? ''
  return last.split(':')[0].toLowerCase()
}

function elementName(elementPath, draft) {
  const tag = tagOf(elementPath)
  const kind = TAG_NAMES[tag] ?? (tag && tag !== 'body' ? `<${tag}>` : 'Page')
  const sample = clip(draft?.fingerprint?.text, 32)
  return sample ? `${kind} “${sample}”` : kind
}

const styleWords = (styles, keys) => keys.map((key) => `${key.replace(/([A-Z])/g, '-$1').toLowerCase()}: ${styles?.[key] ?? 'as before'}`).join('; ')

/**
 * The difference between two saves of one page, as a person would describe
 * it: "Words · Heading “Plan a trip”: Plan a trip → Plan your trip". Pictures
 * aren't spelled out (they're data, often large); styles are listed by name.
 */
export function describeStoreChanges(before = {}, after = {}, { routeKey = null } = {}) {
  const changes = []
  const was = before && typeof before === 'object' ? before : {}
  const now = after && typeof after === 'object' ? after : {}
  const page = routeKey ? { routeKey } : {}
  for (const elementPath of new Set([...Object.keys(was), ...Object.keys(now)])) {
    const old = was[elementPath]
    const next = now[elementPath]
    if (canonicalJson(old ?? null) === canonicalJson(next ?? null)) continue
    if (elementPath.startsWith(INJECTION_PREFIX)) {
      changes.push({ label: next ? (old ? 'Changed an added section' : 'Added a section') : 'Took out an added section', ...page })
      continue
    }
    const name = elementName(elementPath, next ?? old)
    if (!next) {
      changes.push({ label: `Reset · ${name}`, before: 'Froam’s edits', after: 'the page’s own', ...page })
      continue
    }
    for (const field of ['text', 'href', 'imageUrl', 'media']) {
      if ((old?.[field] ?? null) === (next[field] ?? null)) continue
      const picture = field === 'imageUrl' || field === 'media'
      changes.push({
        label: `${FIELD_LABELS[field]} · ${name}`,
        before: picture ? (old?.[field] ? 'previous picture' : null) : old?.[field] ?? null,
        after: picture ? (next[field] ? 'new picture' : 'removed') : next[field] ?? 'removed',
        ...page,
      })
    }
    const oldStyles = old?.styles ?? {}
    const newStyles = next.styles ?? {}
    const styleKeys = [...new Set([...Object.keys(oldStyles), ...Object.keys(newStyles)])].filter((key) => oldStyles[key] !== newStyles[key])
    if (styleKeys.length) {
      changes.push({ label: `Look · ${name}`, before: styleWords(oldStyles, styleKeys), after: styleWords(newStyles, styleKeys), ...page })
    }
    const known = new Set(['text', 'href', 'imageUrl', 'media', 'styles', 'fingerprint'])
    const otherKeys = [...new Set([...Object.keys(old ?? {}), ...Object.keys(next)])].filter((key) => !known.has(key) && canonicalJson(old?.[key] ?? null) !== canonicalJson(next[key] ?? null))
    if (otherKeys.length) changes.push({ label: `Settings · ${name}`, after: otherKeys.join(', '), ...page })
  }
  return changes
}

/* ── saying it ───────────────────────────────────────────── */

const plural = (count, word) => `${count} ${count === 1 ? word : word.endsWith('y') ? `${word.slice(0, -1)}ies` : `${word}s`}`
const changeCount = (entry) => entry.count ?? entry.changes?.length ?? 0
const onPages = (entry) => (entry.pages?.length ? ` on ${entry.pages.slice(0, 3).join(', ')}${entry.pages.length > 3 ? ` and ${entry.pages.length - 3} more` : ''}` : '')
const quoted = (entry) => (entry.title ? ` “${entry.title}”` : '')
const authorOf = (entry) => (entry.author?.name ? ` from ${entry.author.name}` : '')

/** One plain sentence per entry, for the editor's panel, the CLI and the report. */
export function describeEntry(entry) {
  const who = entry.by?.name ?? 'Someone'
  switch (entry.type) {
    case 'record.started': return `${who} started keeping this record`
    case 'saved': return `${who} saved ${plural(changeCount(entry), 'change')}${onPages(entry)}`
    case 'saved.source': return `${who} wrote ${plural(changeCount(entry), 'change')} into the site’s files${onPages(entry)}`
    case 'room.opened': return `${who} opened a review room${entry.title ? ` for ${entry.title}` : ''}`
    case 'room.joined': return `${who} joined the review room as ${entry.by?.role ?? 'a guest'}`
    case 'request.submitted': return `${who} asked for${quoted(entry)}: ${plural(changeCount(entry), 'change')}${onPages(entry)}`
    case 'request.withdrawn': return `${who} withdrew${quoted(entry)}`
    case 'request.approved': return `${who} approved${quoted(entry)}${authorOf(entry)}`
    case 'request.sent-back': return `${who} sent back${quoted(entry)}${authorOf(entry)}`
    case 'request.reverted': return `${who} took back${quoted(entry)}${authorOf(entry)}`
    case 'live.started': return `${who} put the site live${onPages(entry)}`
    case 'live.finished': return entry.result ? `Go Live finished: ${entry.result}` : 'Go Live finished'
    case 'live.failed': return `Go Live didn’t finish${entry.result ? `: ${entry.result}` : ''}`
    default: return `${who}: ${entry.type}`
  }
}

/* ── exports a person can file ───────────────────────────── */

const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char])
const csvCell = (value) => {
  const text = String(value ?? '')
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

export function recordToCsv(entries) {
  const header = ['seq', 'time', 'what', 'type', 'by', 'role', 'via', 'title', 'author', 'pages', 'changes', 'note', 'result', 'hash']
  const rows = entries.map((entry) => [
    entry.seq, entry.at, describeEntry(entry), entry.type, entry.by?.name, entry.by?.role, entry.by?.via,
    entry.title, entry.author?.name, (entry.pages ?? []).join(' '),
    (entry.changes ?? []).map((change) => `${change.label}${change.before || change.after ? `: ${change.before ?? '—'} → ${change.after ?? '—'}` : ''}`).join(' | '),
    entry.note, entry.result, entry.hash,
  ])
  return [header, ...rows].map((row) => row.map(csvCell).join(',')).join('\r\n') + '\r\n'
}

/**
 * A page to print or attach: the whole record, oldest first, with whether the
 * chain checks out at the top. Plain HTML, no scripts, readable offline.
 */
export function renderRecordReport(entries, verification, { site = null, generatedAt = new Date(), generatedBy = null } = {}) {
  const people = new Map()
  for (const entry of entries) {
    const name = entry.by?.name
    if (!name || entry.type.startsWith('live.f')) continue
    const roles = people.get(name) ?? new Set()
    if (entry.by?.role) roles.add(entry.by.role)
    people.set(name, roles)
  }
  const count = (type) => entries.filter((entry) => entry.type === type).length
  const when = (iso) => {
    const date = new Date(iso)
    return Number.isNaN(date.getTime()) ? escapeHtml(iso) : escapeHtml(date.toISOString().replace('T', ' ').slice(0, 16) + ' UTC')
  }
  const rows = entries.map((entry) => {
    const details = (entry.changes ?? []).map((change) => `<li>${escapeHtml(change.label)}${change.before || change.after ? `: <s>${escapeHtml(change.before ?? '—')}</s> → <b>${escapeHtml(change.after ?? '—')}</b>` : ''}${change.page ? ` <span class="muted">(${escapeHtml(change.page)})</span>` : ''}</li>`).join('')
    const more = changeCount(entry) > (entry.changes?.length ?? 0) ? `<li class="muted">and ${changeCount(entry) - (entry.changes?.length ?? 0)} more</li>` : ''
    return `<tr>
      <td class="num">${entry.seq}</td>
      <td class="when">${when(entry.at)}</td>
      <td>${escapeHtml(entry.by?.name ?? '')}${entry.by?.role ? `<div class="muted">${escapeHtml(entry.by.role)}${entry.by.via ? ` · ${escapeHtml(entry.by.via)}` : ''}</div>` : ''}</td>
      <td><div>${escapeHtml(describeEntry(entry))}</div>${details || more ? `<ul>${details}${more}</ul>` : ''}${entry.note ? `<div class="note">Note: ${escapeHtml(entry.note)}</div>` : ''}${entry.result && !entry.type.startsWith('live.') ? `<div class="muted">${escapeHtml(entry.result)}</div>` : ''}</td>
      <td class="hash" title="${escapeHtml(entry.hash)}">${escapeHtml(String(entry.hash ?? '').slice(0, 10))}</td>
    </tr>`
  }).join('\n')
  const status = verification.ok
    ? `<p class="ok">✓ The record checks out: ${plural(verification.count, 'entry')}, each linked to the one before it, none changed since it was written.</p>`
    : `<p class="bad">✗ The record doesn’t check out at line ${escapeHtml(verification.problem?.line)}: ${escapeHtml(verification.problem?.reason)} Entries before that point are intact.</p>`
  const title = `Change record${site ? ` · ${escapeHtml(site)}` : ''}`
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<style>
  :root { --ink: #0e0f10; --muted: #5b6066; --line: #dcdcd8; --paper: #fff; --ok: #0b6e4f; --bad: #a3261b; }
  * { box-sizing: border-box; }
  body { margin: 0; padding: 32px 20px; font: 14px/1.5 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; color: var(--ink); background: var(--paper); }
  main { max-width: 1040px; margin: 0 auto; }
  h1 { font-size: 22px; margin: 0 0 4px; }
  .muted { color: var(--muted); font-size: 12px; }
  .summary { display: flex; flex-wrap: wrap; gap: 8px 24px; margin: 16px 0; padding: 12px 16px; border: 1px solid var(--line); border-radius: 8px; }
  .summary div { min-width: 120px; }
  .summary strong { display: block; font-size: 18px; }
  .ok { color: var(--ok); font-weight: 600; }
  .bad { color: var(--bad); font-weight: 600; }
  table { width: 100%; border-collapse: collapse; margin-top: 16px; }
  th, td { text-align: left; vertical-align: top; padding: 8px; border-bottom: 1px solid var(--line); }
  th { font-size: 12px; text-transform: uppercase; letter-spacing: .04em; color: var(--muted); }
  td ul { margin: 6px 0 0; padding-left: 18px; }
  td li { margin: 2px 0; overflow-wrap: anywhere; }
  s { color: var(--muted); }
  .num, .hash { font-family: ui-monospace, Consolas, monospace; font-size: 12px; }
  .when { white-space: nowrap; }
  .note { margin-top: 4px; font-style: italic; }
  .head { font-family: ui-monospace, Consolas, monospace; font-size: 12px; overflow-wrap: anywhere; }
  @media (max-width: 640px) { .hash, th:last-child { display: none; } .when { white-space: normal; } }
  @media print { body { padding: 0; } .summary { break-inside: avoid; } tr { break-inside: avoid; } }
</style>
</head>
<body>
<main>
  <h1>${title}</h1>
  <div class="muted">Made ${when(generatedAt.toISOString())}${generatedBy ? ` by ${escapeHtml(generatedBy)}` : ''} with Froam from ${escapeHtml(RECORD_FILE)}</div>
  ${status}
  <div class="summary">
    <div><strong>${entries.length}</strong><span class="muted">entries</span></div>
    <div><strong>${people.size}</strong><span class="muted">people</span></div>
    <div><strong>${count('request.submitted')}</strong><span class="muted">changes asked for</span></div>
    <div><strong>${count('request.approved')}</strong><span class="muted">approved</span></div>
    <div><strong>${count('request.sent-back')}</strong><span class="muted">sent back</span></div>
    <div><strong>${count('live.started')}</strong><span class="muted">times put live</span></div>
  </div>
  ${people.size ? `<p class="muted">People: ${[...people].map(([name, roles]) => `${escapeHtml(name)}${roles.size ? ` (${escapeHtml([...roles].join(', '))})` : ''}`).join(' · ')}</p>` : ''}
  <p class="muted">Latest hash: <span class="head">${escapeHtml(verification.head)}</span></p>
  <table>
    <thead><tr><th>#</th><th>When</th><th>Who</th><th>What</th><th>Hash</th></tr></thead>
    <tbody>
${rows || '<tr><td colspan="5" class="muted">Nothing recorded yet.</td></tr>'}
    </tbody>
  </table>
</main>
</body>
</html>
`
}

/* ── the record over HTTP (froam dev and the Vite plugin) ── */

/**
 * GET  /__froam/record          newest entries, each with a sentence, and whether the chain checks out
 * GET  /__froam/record/report   the whole record as a page to print (?format=csv for a spreadsheet)
 * POST /__froam/record/name     { name }: what the owner's own saves are recorded under
 *
 * The caller decides who may ask (the owner's own devices); this only answers.
 * `readBody(req)` resolves to the parsed JSON body.
 */
export function createRecordEndpoint({ record, configPath, you, readBody, send, cors = () => {}, onName = () => {} }) {
  return async function handleRecordRequest(req, res, url) {
    if (url !== '/__froam/record' && !url.startsWith('/__froam/record/')) return false
    res.setHeader('Cache-Control', 'no-store')
    const query = new URL(req.url ?? '/', 'http://froam.local').searchParams
    if (url === '/__froam/record' && req.method === 'GET') {
      const limit = Math.min(Math.max(Number(query.get('limit')) || 100, 1), 500)
      const before = Number(query.get('before')) || null
      const entries = record.read({ limit, before }).map((entry) => ({ ...entry, summary: describeEntry(entry) }))
      send(res, 200, { success: true, entries, verification: record.verify(), you: you(), file: RECORD_FILE })
      return true
    }
    if (url === '/__froam/record/report' && req.method === 'GET') {
      const entries = record.all()
      cors(res)
      res.statusCode = 200
      if (query.get('format') === 'csv') {
        res.setHeader('Content-Type', 'text/csv; charset=utf-8')
        res.setHeader('Content-Disposition', 'attachment; filename="froam-record.csv"')
        res.end(recordToCsv(entries))
        return true
      }
      res.setHeader('Content-Type', 'text/html; charset=utf-8')
      // A report is a page of its own: nothing in it runs.
      res.setHeader('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'")
      let site = null
      try { site = JSON.parse(fs.readFileSync(configPath, 'utf8')).siteUrl ?? null } catch { /* no config yet */ }
      res.end(renderRecordReport(entries, record.verify(), { site: site ?? path.basename(path.dirname(configPath)), generatedBy: you() }))
      return true
    }
    if (url === '/__froam/record/name' && req.method === 'POST') {
      const body = await readBody(req).catch(() => ({}))
      const name = clip(body?.name, MAX_NAME)
      if (!name) {
        send(res, 400, { success: false, error: 'Say the name your changes should be recorded under' })
        return true
      }
      let config = {}
      try { config = JSON.parse(fs.readFileSync(configPath, 'utf8')) } catch { /* a new file */ }
      fs.writeFileSync(configPath, `${JSON.stringify({ ...config, record: { ...(config.record ?? {}), name } }, null, 2)}\n`)
      onName(name)
      send(res, 200, { success: true, you: you() })
      return true
    }
    send(res, 404, { success: false, error: 'Unknown froam endpoint' })
    return true
  }
}
