import { findElementByPath, tagOfPath } from '../../collab/paths'
import type { FroamOp } from '../../collab/types'
import type { PendingChange } from './FroamCollaborate'

type Draft = { text?: string; imageUrl?: string; styles?: Record<string, string>; [key: string]: unknown }

export type BuiltRequest = {
  /** The ops this request is made of — so a sent-back request's edits count again. */
  opIds: string[]
  store: Record<string, Draft>
  removed: string[]
  changes: PendingChange[]
  textEdits: Array<{ from: string; to: string }>
}

const INJECTION_PREFIX = '__froam_injection__:'
const TAG_NAMES: Record<string, string> = {
  h1: 'Heading', h2: 'Heading', h3: 'Heading', h4: 'Heading', h5: 'Heading', h6: 'Heading',
  p: 'Paragraph', a: 'Link', button: 'Button', img: 'Image', li: 'List item', span: 'Text',
  section: 'Section', header: 'Header', footer: 'Footer', nav: 'Navigation', svg: 'Icon',
}

const clip = (value: string | undefined, max = 160) => {
  if (value === undefined) return null
  const text = value.replace(/\s+/g, ' ').trim()
  return text.length > max ? `${text.slice(0, max - 1)}…` : text || null
}

function fieldLabel(field: string) {
  if (field === 'text') return 'Text'
  if (field === 'imageUrl') return 'Image'
  const name = field.replace(/^style:/, '').replace(/^__froamState:([^:]+):/, '$1 ').replace(/([A-Z])/g, ' $1').trim().toLowerCase()
  return name.charAt(0).toUpperCase() + name.slice(1)
}

/** "Heading “Plan a trip”" — what a person would call the element. */
export function elementLabel(path: string, root: HTMLElement | null) {
  const tag = tagOfPath(path)
  const kind = TAG_NAMES[tag] ?? (tag ? `<${tag}>` : 'Element')
  const element = root ? findElementByPath(root, path) : null
  const sample = clip(element?.innerText ?? '', 32)
  return sample ? `${kind} “${sample}”` : kind
}

function currentValue(draft: Draft | undefined, field: string) {
  if (!draft) return undefined
  if (field === 'text') return draft.text
  if (field === 'imageUrl') return draft.imageUrl
  return draft.styles?.[field.replace(/^style:/, '')]
}

/**
 * A contributor's changes on one page and viewport, from the ops they made
 * themselves — never from diffing the page, which would sweep in whatever the
 * owner changed live in the meantime. Each touched field reads from its first
 * `before` to its value now; a field edited back to where it started is not
 * a change.
 */
export function buildChangeRequest(input: {
  ops: readonly FroamOp[]
  isMine: (actor: string) => boolean
  routeKey: string
  viewport: string
  drafts: Record<string, Draft>
  root: HTMLElement | null
  /** Ops already in a pending or approved request. */
  excludedOpIds: ReadonlySet<string>
  /**
   * The page's own words at a path, before anyone edited it. An op's `before`
   * is the previous draft, and the first edit has none — but the source still
   * says the original, and that's what copy write-back searches for.
   */
  originalText?: (path: string) => string | undefined
}): BuiltRequest {
  const touched = new Map<string, Map<string, { before: string | undefined }>>()
  const opIds: string[] = []
  for (const op of input.ops) {
    if (!input.isMine(op.actor) || op.routeKey !== input.routeKey || op.viewport !== input.viewport || input.excludedOpIds.has(op.id)) continue
    opIds.push(op.id)
    const fields = touched.get(op.path) ?? new Map()
    if (!fields.has(op.field)) fields.set(op.field, { before: op.before })
    touched.set(op.path, fields)
  }

  const store: Record<string, Draft> = {}
  const removed: string[] = []
  const changes: PendingChange[] = []
  const textEdits: Array<{ from: string; to: string }> = []

  for (const [path, fields] of touched) {
    const draft = input.drafts[path]
    let changed = false
    for (const [field, first] of fields) {
      const before = first.before ?? (field === 'text' ? input.originalText?.(path) : undefined)
      const after = currentValue(draft, field)
      if ((after ?? '') === (before ?? '')) continue
      changed = true
      if (path.startsWith(INJECTION_PREFIX)) {
        changes.push({ label: 'Added a section', before: null, after: null })
        continue
      }
      changes.push({
        label: `${fieldLabel(field)} · ${elementLabel(path, input.root)}`,
        before: field === 'imageUrl' ? (before ? 'previous image' : null) : clip(before),
        after: field === 'imageUrl' ? (after ? 'new image' : null) : clip(after),
      })
      if (field === 'text' && typeof before === 'string' && typeof after === 'string') textEdits.push({ from: before, to: after })
    }
    if (!changed) continue
    if (draft) store[path] = draft
    else removed.push(path)
  }

  return { opIds, store, removed, changes, textEdits }
}
