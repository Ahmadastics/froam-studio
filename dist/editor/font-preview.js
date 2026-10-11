/* ===============================================================
   FROAM STUDIO — FONT PREVIEWS
   The font picker shows every family in its own face. Loading two
   hundred full families to do that would cost megabytes, so each
   preview asks for only the characters the picker draws (Google's
   `text=` subsetting), batched into a few requests as rows scroll
   into view.

   Previews are registered under a private alias
   ("froam-preview:Inter"), never under the family's real name. A
   subset face registered as "Inter" would win over the full Inter
   the page loads when that font is picked, and every glyph outside
   the subset would then fall back to another font.
   =============================================================== */
import { FONTSHARE_FONTS, GOOGLE_FONTS } from './fontSources.js';
const PREFIX = 'froam-preview:';
const BATCH = 12;
const requested = new Set();
const loaded = new Set();
const listeners = new Set();
let queue = [];
let flushTimer = 0;
/** The CSS font-family that draws a preview of `family`. */
export function previewFamily(family, fallback = 'system-ui, sans-serif') {
    return `"${PREFIX}${family}", ${fallback}`;
}
export function isPreviewLoaded(family) {
    return loaded.has(family);
}
/** Called after any batch of previews lands, so rows can re-render. */
export function onPreviewsLoaded(listener) {
    listeners.add(listener);
    return () => { listeners.delete(listener); };
}
/**
 * Queue a preview of `family` that can draw `text`. Unknown families
 * (system stacks, brand fonts already on the page) are ignored.
 */
export function requestPreview(family, text) {
    if (typeof document === 'undefined' || requested.has(family))
        return;
    if (!GOOGLE_FONTS[family] && !FONTSHARE_FONTS[family])
        return;
    requested.add(family);
    queue.push({ family, text });
    window.clearTimeout(flushTimer);
    flushTimer = window.setTimeout(flush, 40);
}
function styleSheet() {
    let style = document.head.querySelector('style[data-froam-font-preview]');
    if (!style) {
        style = document.createElement('style');
        style.setAttribute('data-froam-font-preview', 'true');
        document.head.appendChild(style);
    }
    return style;
}
/** Rename every @font-face in `css` from the real family to its preview alias. */
function aliasFaces(css, families) {
    let out = css;
    for (const family of families) {
        const escaped = family.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        out = out.replace(new RegExp(`font-family:\\s*['"]${escaped}['"]`, 'g'), `font-family: "${PREFIX}${family}"`);
    }
    return out;
}
async function fetchCss(url) {
    try {
        const response = await fetch(url, { mode: 'cors', credentials: 'omit' });
        return response.ok ? await response.text() : null;
    }
    catch {
        return null;
    }
}
function settle(families, css) {
    if (!css)
        return;
    styleSheet().append(document.createTextNode(`${aliasFaces(css, families)}\n`));
    // Text faces load when something uses them; wait for them so rows don't flash.
    const fonts = document.fonts;
    const ready = families.map((family) => fonts?.load(`16px "${PREFIX}${family}"`).catch(() => []) ?? Promise.resolve([]));
    void Promise.all(ready).then(() => {
        families.forEach((family) => loaded.add(family));
        listeners.forEach((listener) => listener());
    });
}
function flush() {
    const batch = queue;
    queue = [];
    const google = batch.filter((item) => GOOGLE_FONTS[item.family]);
    const fontshare = batch.filter((item) => FONTSHARE_FONTS[item.family]);
    for (let start = 0; start < google.length; start += BATCH) {
        const slice = google.slice(start, start + BATCH);
        const families = slice.map((item) => item.family);
        // One `text` serves the whole request: the union of what every row draws.
        const text = [...new Set(slice.map((item) => item.text).join(''))].join('');
        const params = families.map((family) => `family=${encodeURIComponent(family).replace(/%20/g, '+')}`).join('&');
        const url = `https://fonts.googleapis.com/css2?${params}&text=${encodeURIComponent(text)}&display=swap`;
        void fetchCss(url).then((css) => settle(families, css));
    }
    // Fontshare can't subset, so ask for the one weight a preview needs.
    for (const item of fontshare) {
        const [slug, weights] = FONTSHARE_FONTS[item.family].split('@');
        const list = weights.split(',').map(Number);
        const weight = list.find((w) => w >= 400) ?? list[list.length - 1];
        void fetchCss(`https://api.fontshare.com/v2/css?f[]=${slug}@${weight}&display=swap`).then((css) => settle([item.family], css));
    }
}
//# sourceMappingURL=font-preview.js.map