import { type FroamChange } from '../../collab/oplog'
import { tagOfPath } from '../../collab/paths'
import { LOCAL_ACTOR } from '../../collab/types'
import { type FroamPersona } from '../froamPersona'
import { type ElementDraft, CANVAS_KEY, INJECTION_KEY, ROOT_PARENT_KEY, type ViewportMode } from './types'
import { stripPersonaDrafts } from './storage'
import { readCssUrl } from './dom'

/* ─── Reading a change back to the person who made it ─── */

/** "Fill · h1" — what changed, and on what. */
export function describeChange(change: FroamChange) {
  const tag = tagOfPath(change.paths[0] ?? '')
  const where = change.paths.length > 1 ? `${tag} +${change.paths.length - 1}` : tag
  return where ? `${change.label} · ${where}` : change.label
}

export function relativeTime(ts: number) {
  const seconds = Math.max(0, Math.round((Date.now() - ts) / 1000))
  if (seconds < 45) return 'just now'
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  return new Date(ts).toLocaleDateString()
}

/**
 * Who and when. The local actor reads as "you" — an id is the right thing to
 * store and the wrong thing to show someone.
 */
export function changeByline(change: FroamChange) {
  const who = change.actor === LOCAL_ACTOR ? 'You' : change.actor
  return `${who} · ${relativeTime(change.ts)}`
}

export function smallHash(value: string) {
  let hash = 5381
  for (let i = 0; i < value.length; i += 1) {
    hash = ((hash << 5) + hash) ^ value.charCodeAt(i)
  }
  return (hash >>> 0).toString(16).padStart(8, '0')
}

export function describeImageSource(src: string) {
  const mime = src.startsWith('data:') ? src.match(/^data:([^;]+);/)?.[1] ?? 'data-uri' : 'url'
  const kind = src.startsWith('data:') ? 'embedded data URI' : 'external URL'
  const preview = src.length > 520 ? `${src.slice(0, 520)}...` : src
  return [
    `kind: ${kind}`,
    `mime: ${mime}`,
    `chars: ${src.length}`,
    `hash: ${smallHash(src)}`,
    `preview: ${preview}`,
  ].join('\n    ')
}

export function parseInjectionDraft(draft: ElementDraft) {
  if (!draft.text) return null
  try {
    const parsed = JSON.parse(draft.text) as { html?: unknown; parentPath?: unknown; order?: unknown }
    if (typeof parsed.html !== 'string') return null
    return {
      html: parsed.html,
      parentPath: typeof parsed.parentPath === 'string' ? parsed.parentPath : ROOT_PARENT_KEY,
      order: typeof parsed.order === 'number' ? parsed.order : 0,
    }
  } catch {
    return null
  }
}

export function compactText(value: string, max = 500) {
  const cleaned = value.replace(/\s+/g, ' ').trim()
  return cleaned.length > max ? `${cleaned.slice(0, max)}...` : cleaned
}

export function buildFroamChangeReport(params: {
  routeKey: string
  viewportMode: ViewportMode
  viewportStoreKey: string
  drafts: Record<string, ElementDraft>
  persona: FroamPersona
}) {
  const { routeKey, viewportMode, viewportStoreKey, drafts, persona } = params
  const entries = Object.entries(stripPersonaDrafts(drafts))
  const canvasDraft = drafts[CANVAS_KEY]
  const insertedBlocks = entries
    .filter(([path]) => path.startsWith(`${INJECTION_KEY}:`))
    .map(([, draft]) => parseInjectionDraft(draft))
    .filter((draft): draft is NonNullable<ReturnType<typeof parseInjectionDraft>> => draft !== null)
  const editedElements = entries.filter(([path]) => path !== CANVAS_KEY && !path.startsWith(`${INJECTION_KEY}:`))
  const imageRefs: string[] = []
  let styleCount = 0
  let textCount = 0

  const lines: string[] = [
    '# Froam Design Change Report',
    '',
    `Generated: ${new Date().toISOString()}`,
    `Route: ${routeKey}`,
    `Viewport: ${viewportMode}`,
    `Store key: ${viewportStoreKey}`,
    `Froam persona: ${persona.name} (${persona.role})`,
    '',
    '## Summary',
    `- Edited elements: ${editedElements.length}`,
    `- Inserted blocks/shapes: ${insertedBlocks.length}`,
  ]

  if (canvasDraft?.styles) {
    styleCount += Object.keys(canvasDraft.styles).length
    const canvasImage = typeof canvasDraft.styles.backgroundImage === 'string'
      ? readCssUrl(canvasDraft.styles.backgroundImage)
      : null
    if (canvasImage) {
      imageRefs.push(`[canvas background]\n    ${describeImageSource(canvasImage)}`)
    }
  }

  for (const [path, draft] of editedElements) {
    if (typeof draft.text === 'string') textCount += 1
    if (draft.styles) {
      styleCount += Object.keys(draft.styles).length
      if (typeof draft.styles.backgroundImage === 'string') {
        const image = readCssUrl(draft.styles.backgroundImage)
        if (image) imageRefs.push(`[${path} background]\n    ${describeImageSource(image)}`)
      }
    }
    if (typeof draft.imageUrl === 'string') {
      imageRefs.push(`[${path} image]\n    ${describeImageSource(draft.imageUrl)}`)
    }
  }

  lines.push(`- Text changes: ${textCount}`)
  lines.push(`- Style properties changed: ${styleCount}`)
  lines.push(`- Image references: ${imageRefs.length}`)

  if (canvasDraft?.styles && Object.keys(canvasDraft.styles).length > 0) {
    lines.push('', '## Page / Canvas Changes')
    for (const [key, value] of Object.entries(canvasDraft.styles)) {
      if (key === 'backgroundImage') {
        const image = readCssUrl(value)
        lines.push(`- ${key}: ${image ? `[image ${smallHash(image)}]` : value}`)
      } else {
        lines.push(`- ${key}: ${value}`)
      }
    }
  }

  if (insertedBlocks.length > 0) {
    lines.push('', '## Inserted Blocks / Shapes')
    insertedBlocks
      .sort((a, b) => a.order - b.order)
      .forEach((block, index) => {
        lines.push(`### Block ${index + 1}`)
        lines.push(`- Parent: ${block.parentPath}`)
        lines.push(`- Order: ${block.order}`)
        lines.push('```html')
        lines.push(block.html)
        lines.push('```')
      })
  }

  if (editedElements.length > 0) {
    lines.push('', '## Edited Existing Elements')
    editedElements.forEach(([path, draft], index) => {
      lines.push(`### ${index + 1}. ${path}`)
      if (typeof draft.text === 'string') lines.push(`- Text: ${compactText(draft.text)}`)
      if (typeof draft.imageUrl === 'string') lines.push(`- Image: ${smallHash(draft.imageUrl)} (${draft.imageUrl.length} chars)`)
      if (draft.styles && Object.keys(draft.styles).length > 0) {
        lines.push('- Styles:')
        for (const [key, value] of Object.entries(draft.styles)) {
          if (key === 'backgroundImage') {
            const image = readCssUrl(value)
            lines.push(`  - ${key}: ${image ? `[image ${smallHash(image)}]` : value}`)
          } else {
            lines.push(`  - ${key}: ${value}`)
          }
        }
      }
    })
  }

  if (imageRefs.length > 0) {
    lines.push('', '## Image Manifest')
    imageRefs.forEach((ref, index) => {
      lines.push(`### Image ${index + 1}`)
      lines.push(ref)
    })
  }

  lines.push(
    '',
    '## Notes For Codex',
    '- This report is the readable implementation brief.',
    '- If exact embedded image data is needed, also paste Froam\'s "Copy page JSON" output.',
    '- Element paths are Froam DOM paths. Inserted blocks include their HTML.',
    '',
    '## Raw Froam Store JSON Snapshot',
    '```json',
    JSON.stringify(drafts, null, 2),
    '```',
  )

  return lines.join('\n')
}
