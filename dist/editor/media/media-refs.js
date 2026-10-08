import { getFroamStudioConfig } from '../../config.js';
import { bridgeUrl } from '../../lib/bridge.js';
/**
 * How a design refers to a placed picture or video: `froam-media:<name>`,
 * where the name is the file's content hash (lib/media-store.mjs). The same
 * reference works everywhere because it is resolved late:
 *
 *   the editor        → the bridge, `/__froam/media/<name>`
 *   generated CSS     → `media/<name>` beside the stylesheet (lib/codegen.mjs)
 *   runtime script    → `media/<name>` beside the script
 *   React runtime     → `mediaBaseUrl`, or the bridge in froam dev, or /froam/media/
 *
 * The editor only ever shows bridge URLs (never blob: URLs), so a URL read
 * back from the page maps to its reference by pattern, with nothing to
 * remember — nothing session-only can leak into a saved design.
 */
export const MEDIA_REF_PREFIX = 'froam-media:';
const NAME = '[a-f0-9]{32}\\.(?:jpg|png|webp|avif|gif|svg|bmp|mp4|webm|mov|ogv)';
const REF = new RegExp(`froam-media:(${NAME})`, 'g');
const BRIDGE_URL = new RegExp(`(?:[a-z][a-z0-9+.-]*://[^\\s"'()<>]*?)?/__froam/media/(${NAME})`, 'gi');
const ONE_REF = new RegExp(`^froam-media:(${NAME})$`);
export function isMediaRef(value) {
    return typeof value === 'string' && ONE_REF.test(value);
}
export function mediaRefName(ref) {
    return ONE_REF.exec(ref)?.[1] ?? null;
}
export function hasMediaRef(value) {
    return typeof value === 'string' && value.includes(MEDIA_REF_PREFIX);
}
/** Where media files are fetched from in this context. Ends with a slash. */
export function mediaBase(context = 'runtime') {
    if (context === 'editor')
        return bridgeUrl('/__froam/media/');
    const configured = getFroamStudioConfig().mediaBaseUrl;
    if (configured)
        return configured.endsWith('/') ? configured : `${configured}/`;
    // froam dev serves the page: the files are on the bridge until they ship.
    const win = typeof window === 'undefined' ? null : window;
    if (win && (win.__FROAM_BRIDGE_ORIGIN__ !== undefined || win.__FROAM_BOOT__))
        return bridgeUrl('/__froam/media/');
    return '/froam/media/';
}
/** Every reference in `value` (a src, a srcset, a CSS value, HTML) as a URL. */
export function resolveMediaRefs(value, context = 'editor') {
    if (!value.includes(MEDIA_REF_PREFIX))
        return value;
    const base = mediaBase(context);
    return value.replace(REF, (_, name) => `${base}${name}`);
}
/** The reverse, for anything read back off the page: a media URL becomes its reference again. */
export function mediaRefsFromUrls(value) {
    if (!value.includes('/__froam/media/'))
        return value;
    return value.replace(BRIDGE_URL, (_, name) => `${MEDIA_REF_PREFIX}${name}`);
}
/** The reference a single URL stands for, if it is one of ours. */
export function mediaRefForUrl(url) {
    const mapped = mediaRefsFromUrls(url);
    return isMediaRef(mapped) ? mapped : null;
}
//# sourceMappingURL=media-refs.js.map