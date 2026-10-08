import { readMediaDraft } from './media-draft.js';
import { mediaRefsFromUrls, resolveMediaRefs } from './media-refs.js';
const VIDEO_FLAGS = ['autoplay', 'loop', 'muted', 'controls', 'playsinline'];
const pageMedia = new WeakMap();
function setAttr(element, name, value) {
    if (value === null) {
        if (element.hasAttribute(name))
            element.removeAttribute(name);
    }
    else if (element.getAttribute(name) !== value) {
        element.setAttribute(name, value);
    }
}
function pictureSources(element) {
    const parent = element.parentElement;
    return parent?.tagName === 'PICTURE' ? Array.from(parent.querySelectorAll(':scope > source')) : [];
}
function remember(element) {
    if (pageMedia.has(element))
        return;
    pageMedia.set(element, {
        src: element.getAttribute('src'),
        currentSrc: element instanceof HTMLImageElement || element instanceof HTMLVideoElement ? element.currentSrc : '',
        srcset: element.getAttribute('srcset'),
        sizes: element.getAttribute('sizes'),
        sources: pictureSources(element).map((source) => ({ element: source, srcset: source.getAttribute('srcset'), sizes: source.getAttribute('sizes'), type: source.getAttribute('type') })),
        poster: element.getAttribute('poster'),
        flags: Object.fromEntries(VIDEO_FLAGS.map((flag) => [flag, element.hasAttribute(flag)])),
    });
}
/** Put back what the page itself had. Returns false when Froam never touched it. */
export function restorePageMedia(element) {
    const page = pageMedia.get(element);
    if (!page)
        return false;
    pageMedia.delete(element);
    for (const source of page.sources) {
        setAttr(source.element, 'srcset', source.srcset);
        setAttr(source.element, 'sizes', source.sizes);
        setAttr(source.element, 'type', source.type);
    }
    setAttr(element, 'srcset', page.srcset);
    setAttr(element, 'sizes', page.sizes);
    setAttr(element, 'src', page.src);
    if (element instanceof HTMLVideoElement) {
        setAttr(element, 'poster', page.poster);
        for (const flag of VIDEO_FLAGS)
            setAttr(element, flag, page.flags[flag] ? '' : null);
        element.muted = page.flags.muted;
    }
    return true;
}
/** Whether `url` is what the page itself showed here before any edit. */
export function isPageMedia(element, url) {
    const page = pageMedia.get(element);
    return Boolean(page && url !== undefined && (url === page.currentSrc || url === page.src));
}
/**
 * Apply `imageUrl` + the media draft to an <img> or <video>. Anything else is
 * a background and is handled by its styles. Returns whether it did anything.
 */
export function applyMediaSource(element, imageUrl, mediaValue, context) {
    const media = readMediaDraft(mediaValue);
    if (element instanceof HTMLImageElement) {
        if (imageUrl === undefined && !media?.srcset)
            return false;
        // The page's own image again (Undo, Clear): everything it had comes back.
        if (!media && isPageMedia(element, imageUrl))
            return restorePageMedia(element);
        remember(element);
        const src = imageUrl === undefined ? null : imageUrl ? resolveMediaRefs(imageUrl, context) : null;
        const srcset = media?.srcset ? resolveMediaRefs(media.srcset, context) : null;
        const sizes = srcset ? media?.sizes ?? null : null;
        for (const source of pictureSources(element)) {
            setAttr(source, 'srcset', srcset ?? src);
            setAttr(source, 'sizes', sizes);
            setAttr(source, 'type', null);
        }
        setAttr(element, 'srcset', srcset);
        setAttr(element, 'sizes', sizes);
        if (imageUrl !== undefined)
            setAttr(element, 'src', src);
        return true;
    }
    if (element instanceof HTMLVideoElement && media?.kind === 'video') {
        remember(element);
        const playback = media.playback;
        // With a src attribute a video's <source> children are not used.
        if (media.src)
            setAttr(element, 'src', resolveMediaRefs(media.src, context));
        setAttr(element, 'poster', media.poster ? resolveMediaRefs(media.poster, context) : null);
        if (playback) {
            setAttr(element, 'autoplay', playback.autoplay ? '' : null);
            setAttr(element, 'loop', playback.loop ? '' : null);
            setAttr(element, 'muted', playback.muted ? '' : null);
            setAttr(element, 'controls', playback.controls ? '' : null);
            element.muted = playback.muted;
        }
        setAttr(element, 'playsinline', '');
        if (playback?.autoplay && element.paused)
            void element.play().catch(() => { });
        return true;
    }
    return false;
}
/** An <img>'s own src as a design would store it: ours as a reference, the page's as it was. */
export function readImageSource(element) {
    const own = element.getAttribute('src');
    if (own && own.includes('/__froam/media/'))
        return mediaRefsFromUrls(own);
    return mediaRefsFromUrls(element.currentSrc || element.src || '');
}
//# sourceMappingURL=apply-media.js.map