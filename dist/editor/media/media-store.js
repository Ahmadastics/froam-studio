import { bridgeUrl } from '../../lib/bridge.js';
let probe = null;
/** Whether a bridge that keeps media files is answering. Asked once. */
export function canStoreMedia() {
    probe ??= fetch(bridgeUrl('/__froam/media/probe'), { cache: 'no-store' })
        .then((response) => (response.headers.get('content-type') ?? '').includes('json'))
        .catch(() => false);
    return probe;
}
/** The bridge answered, and said no: the file itself is the problem (not an image, too big). */
export class MediaRejected extends Error {
}
async function readResult(response) {
    const body = await response.json().catch(() => null);
    if (!response.ok || !body?.success || !body.ref || !body.name) {
        const message = body?.error || `The bridge could not keep that file (${response.status})`;
        throw response.status === 400 ? new MediaRejected(message) : new Error(message);
    }
    return { ref: body.ref, url: bridgeUrl(`/__froam/media/${body.name}`), name: body.name, bytes: body.bytes ?? 0, type: body.type ?? '' };
}
/** Keep a file in the project. The same bytes twice are one file. */
export async function storeMedia(blob) {
    const response = await fetch(bridgeUrl('/__froam/media'), {
        method: 'POST',
        headers: { 'content-type': blob.type || 'application/octet-stream' },
        body: blob,
    });
    return readResult(response);
}
/**
 * Copy another site's picture or video into the project, through the bridge
 * (a browser can't read pixels a site hasn't shared). After this it can be
 * cropped like an upload.
 */
export async function importMedia(url) {
    const response = await fetch(bridgeUrl('/__froam/media/import'), {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ url }),
    });
    return readResult(response);
}
//# sourceMappingURL=media-store.js.map