import { bridgeUrl } from '../../lib/bridge'

/**
 * The editor's side of lib/media-store.mjs: put a file in the workspace and
 * get back the reference a design stores.
 *
 * Without a bridge (a hosted demo), or for someone on a share link (who may
 * suggest changes but not write files), there is nowhere to put a file:
 * `canStoreMedia()` says so and callers fall back to an inline picture.
 */
export type StoredMedia = {
  ref: string
  /** Where the editor loads it from: the bridge. */
  url: string
  name: string
  bytes: number
  type: string
}

let probe: Promise<boolean> | null = null

/** Whether a bridge that keeps media files is answering. Asked once. */
export function canStoreMedia(): Promise<boolean> {
  probe ??= fetch(bridgeUrl('/__froam/media/probe'), { cache: 'no-store' })
    .then((response) => (response.headers.get('content-type') ?? '').includes('json'))
    .catch(() => false)
  return probe
}

/** The bridge answered, and said no: the file itself is the problem (not an image, too big). */
export class MediaRejected extends Error {}

async function readResult(response: Response): Promise<StoredMedia> {
  const body = await response.json().catch(() => null) as (Partial<StoredMedia> & { success?: boolean; error?: string }) | null
  if (!response.ok || !body?.success || !body.ref || !body.name) {
    const message = body?.error || `The bridge could not keep that file (${response.status})`
    throw response.status === 400 ? new MediaRejected(message) : new Error(message)
  }
  return { ref: body.ref, url: bridgeUrl(`/__froam/media/${body.name}`), name: body.name, bytes: body.bytes ?? 0, type: body.type ?? '' }
}

/** Keep a file in the project. The same bytes twice are one file. */
export async function storeMedia(blob: Blob): Promise<StoredMedia> {
  const response = await fetch(bridgeUrl('/__froam/media'), {
    method: 'POST',
    headers: { 'content-type': blob.type || 'application/octet-stream' },
    body: blob,
  })
  return readResult(response)
}

/**
 * Copy another site's picture or video into the project, through the bridge
 * (a browser can't read pixels a site hasn't shared). After this it can be
 * cropped like an upload.
 */
export async function importMedia(url: string): Promise<StoredMedia> {
  const response = await fetch(bridgeUrl('/__froam/media/import'), {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ url }),
  })
  return readResult(response)
}
