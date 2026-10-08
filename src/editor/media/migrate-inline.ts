/**
 * Designs made before media was kept as files carry their pictures inline,
 * as base64 data URLs: megabytes in every save, every localStorage write,
 * every op, the generated CSS and the runtime. When a bridge can keep files,
 * each one is moved out once — stored as a file, replaced by its reference.
 *
 * Small inline images (icons, a few KB) stay where they are: a separate
 * request would cost a visitor more than the bytes do.
 */
const INLINE_MEDIA = /data:(?:image|video)\/[a-z0-9.+-]+;base64,[A-Za-z0-9+/=]+/g
export const INLINE_KEEP_BELOW = 2048

export function inlineMediaIn(value: unknown): string[] {
  const text = typeof value === 'string' ? value : JSON.stringify(value ?? null)
  const found = new Set<string>()
  for (const match of text.matchAll(INLINE_MEDIA)) if (match[0].length >= INLINE_KEEP_BELOW) found.add(match[0])
  return [...found]
}

/**
 * `value` with every large inline picture replaced by what `keep` returns for
 * it (a media reference). Null when there was nothing to move. A picture that
 * can't be kept stays inline — moving is an optimisation, never a loss.
 */
export async function moveInlineMedia<T>(value: T, keep: (blob: Blob) => Promise<string>, known = new Map<string, string>()): Promise<T | null> {
  const urls = inlineMediaIn(value)
  if (!urls.length) return null
  let text = JSON.stringify(value)
  let moved = 0
  for (const url of urls) {
    try {
      // The same picture is in the design, its history and the undo log: kept once.
      let ref = known.get(url)
      if (!ref) {
        ref = await keep(await (await fetch(url)).blob())
        known.set(url, ref)
      }
      text = text.split(url).join(ref)
      moved += 1
    } catch {
      // Stays inline.
    }
  }
  return moved ? (JSON.parse(text) as T) : null
}
