/**
 * Froam — edits from more than one device, merged instead of overwritten.
 *
 * A page's saved edits used to be one blob per route and size, and every save
 * replaced the blob. Two devices open at once — a laptop and a phone, two
 * tabs, two teammates — meant the second save erased whatever the first had
 * saved, silently.
 *
 * Now each device remembers what it last synced, as a signature: a short hash
 * per field (and per style property), never the values themselves, so a
 * picture inlined as a data URI isn't kept twice. With that, a three-way merge
 * can tell "this device changed it" from "this device just never saw the
 * other one's change": a field the device left alone takes the other side's
 * value; a field it changed keeps its own. Two devices changing the very same
 * property is the only real conflict, and `ours` wins it — the newer save on
 * the computer, the unsaved edit in an open editor.
 *
 * KEEP IN SYNC with lib/draft-merge.mjs (the bridge's copy). Dependency-free.
 */

export type DraftLike = { styles?: Record<string, string>; fingerprint?: unknown; [field: string]: unknown }

/** Field → hash, with `styles` as property → hash. Bookkeeping (`fingerprint`) is left out. */
export type DraftSignature = { [field: string]: string | Record<string, string> }

/** Path → signature: what a device last synced for one route at one size. */
export type SyncBase = Record<string, DraftSignature>

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson((value as Record<string, unknown>)[key])}`).join(',')}}`
  return JSON.stringify(value) ?? 'null'
}

/** cyrb53: 53 bits, so two different values sharing a hash is not a real-world worry. */
export function hashValue(value: unknown): string {
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

export function signDraft(draft: DraftLike | undefined): DraftSignature | undefined {
  if (!draft || typeof draft !== 'object') return undefined
  const signature: DraftSignature = {}
  for (const [field, value] of Object.entries(draft)) {
    if (BOOKKEEPING.has(field) || value === undefined) continue
    if (field === 'styles' && value && typeof value === 'object') {
      const styles: Record<string, string> = {}
      for (const [prop, css] of Object.entries(value as Record<string, unknown>)) if (css !== undefined) styles[prop] = hashValue(css)
      if (Object.keys(styles).length) signature.styles = styles
    } else {
      signature[field] = hashValue(value)
    }
  }
  return Object.keys(signature).length ? signature : undefined
}

export function signDrafts(drafts: Record<string, DraftLike> | null | undefined): SyncBase {
  const base: SyncBase = {}
  for (const [path, draft] of Object.entries(drafts ?? {})) {
    const signature = signDraft(draft)
    if (signature) base[path] = signature
  }
  return base
}

const sameSignature = (a: DraftSignature | undefined, b: DraftSignature | undefined) => stableJson(a ?? null) === stableJson(b ?? null)

type Pick = { value: unknown; conflict: boolean }

/** One value, three ways: untouched by us → theirs; untouched by them → ours; both → ours, and say so. */
function pick(base: string | undefined, ours: unknown, theirs: unknown): Pick {
  const mine = ours === undefined ? undefined : hashValue(ours)
  const other = theirs === undefined ? undefined : hashValue(theirs)
  if (mine === base) return { value: theirs, conflict: false }
  if (other === base || other === mine) return { value: ours, conflict: false }
  return { value: ours, conflict: true }
}

function mergeDraft<D extends DraftLike>(base: DraftSignature | undefined, ours: D, theirs: D): { draft: D | undefined; conflict: boolean } {
  const merged: DraftLike = {}
  let conflict = false
  const fields = new Set([...Object.keys(ours), ...Object.keys(theirs), ...Object.keys(base ?? {})])
  for (const field of fields) {
    if (BOOKKEEPING.has(field)) continue
    if (field === 'styles') {
      const baseStyles = (base?.styles ?? {}) as Record<string, string>
      const props = new Set([...Object.keys(ours.styles ?? {}), ...Object.keys(theirs.styles ?? {}), ...Object.keys(baseStyles)])
      const styles: Record<string, string> = {}
      for (const prop of props) {
        const result = pick(baseStyles[prop], ours.styles?.[prop], theirs.styles?.[prop])
        conflict ||= result.conflict
        if (result.value !== undefined) styles[prop] = result.value as string
      }
      if (Object.keys(styles).length) merged.styles = styles
      continue
    }
    const result = pick(typeof base?.[field] === 'string' ? base[field] as string : undefined, ours[field], theirs[field])
    conflict ||= result.conflict
    if (result.value !== undefined) merged[field] = result.value
  }
  if (!Object.keys(merged).length) return { draft: undefined, conflict }
  const fingerprint = ours.fingerprint ?? theirs.fingerprint
  if (fingerprint !== undefined) merged.fingerprint = fingerprint
  return { draft: merged as D, conflict }
}

/**
 * Three-way merge of one route's drafts at one size.
 *
 * `base` is what the `ours` side last synced. `conflicts` lists the paths
 * where both sides changed the same field and `ours` was kept.
 */
export function mergeDrafts<D extends DraftLike>(input: { base: SyncBase; ours: Record<string, D>; theirs: Record<string, D> }): { drafts: Record<string, D>; conflicts: string[]; changed: boolean } {
  const { base, ours, theirs } = input
  const drafts: Record<string, D> = {}
  const conflicts: string[] = []
  const paths = new Set([...Object.keys(ours), ...Object.keys(theirs), ...Object.keys(base)])
  for (const path of paths) {
    const was = base[path]
    const mine = ours[path]
    const other = theirs[path]
    const mineSig = signDraft(mine)
    const otherSig = signDraft(other)
    let next: D | undefined
    if (sameSignature(mineSig, was)) next = other
    else if (sameSignature(otherSig, was) || sameSignature(mineSig, otherSig)) next = mine
    else if (!mine || !other) {
      // One side cleared the element, the other changed it: ours stands.
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
