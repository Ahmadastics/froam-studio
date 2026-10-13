/**
 * Froam — edits from more than one device, merged instead of overwritten.
 *
 * The bridge's copy of src/editor/chef/draft-merge.ts — KEEP IN SYNC (the
 * test in scripts/test-draft-merge.mjs runs both on the same cases). A device
 * sends what it last synced as a signature (a hash per field and per style
 * property); a save then takes only what that device actually changed, and
 * leaves alone everything another device saved in the meantime.
 */

function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(',')}}`
  return JSON.stringify(value) ?? 'null'
}

/** cyrb53 over the value's stable JSON. */
export function hashValue(value) {
  const text = stableJson(value)
  let h1 = 0xdeadbeef
  let h2 = 0x41c6ce57
  for (let i = 0; i < text.length; i += 1) {
    const ch = text.charCodeAt(i)
    h1 = Math.imul(h1 ^ ch, 2654435761)
    h2 = Math.imul(h2 ^ ch, 1597334677)
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909)
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909)
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36)
}

const BOOKKEEPING = new Set(['fingerprint'])

export function signDraft(draft) {
  if (!draft || typeof draft !== 'object') return undefined
  const signature = {}
  for (const [field, value] of Object.entries(draft)) {
    if (BOOKKEEPING.has(field) || value === undefined) continue
    if (field === 'styles' && value && typeof value === 'object') {
      const styles = {}
      for (const [prop, css] of Object.entries(value)) if (css !== undefined) styles[prop] = hashValue(css)
      if (Object.keys(styles).length) signature.styles = styles
    } else {
      signature[field] = hashValue(value)
    }
  }
  return Object.keys(signature).length ? signature : undefined
}

export function signDrafts(drafts) {
  const base = {}
  for (const [path, draft] of Object.entries(drafts ?? {})) {
    const signature = signDraft(draft)
    if (signature) base[path] = signature
  }
  return base
}

/** A signature as a device sent it: path → { field: hash, styles: { prop: hash } }, nothing else. */
export function isSyncBase(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  return Object.values(value).every((signature) => signature && typeof signature === 'object' && !Array.isArray(signature)
    && Object.entries(signature).every(([field, hash]) => (field === 'styles'
      ? hash && typeof hash === 'object' && !Array.isArray(hash) && Object.values(hash).every((h) => typeof h === 'string')
      : typeof hash === 'string')))
}

const sameSignature = (a, b) => stableJson(a ?? null) === stableJson(b ?? null)

function pick(base, ours, theirs) {
  const mine = ours === undefined ? undefined : hashValue(ours)
  const other = theirs === undefined ? undefined : hashValue(theirs)
  if (mine === base) return { value: theirs, conflict: false }
  if (other === base || other === mine) return { value: ours, conflict: false }
  return { value: ours, conflict: true }
}

function mergeDraft(base, ours, theirs) {
  const merged = {}
  let conflict = false
  const fields = new Set([...Object.keys(ours), ...Object.keys(theirs), ...Object.keys(base ?? {})])
  for (const field of fields) {
    if (BOOKKEEPING.has(field)) continue
    if (field === 'styles') {
      const baseStyles = base?.styles ?? {}
      const props = new Set([...Object.keys(ours.styles ?? {}), ...Object.keys(theirs.styles ?? {}), ...Object.keys(baseStyles)])
      const styles = {}
      for (const prop of props) {
        const result = pick(baseStyles[prop], ours.styles?.[prop], theirs.styles?.[prop])
        conflict ||= result.conflict
        if (result.value !== undefined) styles[prop] = result.value
      }
      if (Object.keys(styles).length) merged.styles = styles
      continue
    }
    const result = pick(typeof base?.[field] === 'string' ? base[field] : undefined, ours[field], theirs[field])
    conflict ||= result.conflict
    if (result.value !== undefined) merged[field] = result.value
  }
  if (!Object.keys(merged).length) return { draft: undefined, conflict }
  const fingerprint = ours.fingerprint ?? theirs.fingerprint
  if (fingerprint !== undefined) merged.fingerprint = fingerprint
  return { draft: merged, conflict }
}

/** Three-way merge of one route's drafts at one size; `ours` wins a true conflict. */
export function mergeDrafts({ base, ours, theirs }) {
  const drafts = {}
  const conflicts = []
  const paths = new Set([...Object.keys(ours), ...Object.keys(theirs), ...Object.keys(base)])
  for (const path of paths) {
    const was = base[path]
    const mine = ours[path]
    const other = theirs[path]
    const mineSig = signDraft(mine)
    const otherSig = signDraft(other)
    let next
    if (sameSignature(mineSig, was)) next = other
    else if (sameSignature(otherSig, was) || sameSignature(mineSig, otherSig)) next = mine
    else if (!mine || !other) {
      next = mine
      conflicts.push(path)
    } else {
      const result = mergeDraft(was, mine, other)
      next = result.draft
      if (result.conflict) conflicts.push(path)
    }
    if (next) drafts[path] = next
  }
  const changed = stableJson(signDrafts(drafts)) !== stableJson(signDrafts(theirs))
  return { drafts, conflicts, changed }
}
