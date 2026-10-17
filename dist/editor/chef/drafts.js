import { SECTION_STRUCTURE_KEY } from '../section-structure.js';
import { applyDraftText, isBeingWritten } from '../draft-text.js';
import { INJECTION_KEY } from './types.js';
import { persistedStyleKeys } from './style-options.js';
import { getCanvasHost, applyGlobalCSS, camelToKebab, readImageUrl } from './dom.js';
import { canApplyTextDraft } from './writing.js';
import { applyMediaSource, froamPlacedMedia, readImageSource } from '../media/apply-media.js';
import { hasMediaRef, mediaRefsFromUrls, resolveMediaRefs } from '../media/media-refs.js';
import { safeHref } from './links.js';
export function sanitizeDraftForElement(element, draft) {
    if (draft.text === undefined || canApplyTextDraft(element))
        return draft;
    const safeDraft = { ...draft };
    delete safeDraft.text;
    return safeDraft;
}
/* Each element's own style attribute, as the site wrote it, from before Froam
   first painted on it. Taking Froam's edits away puts exactly this back, so a
   site's own inline styles (a positioned caption, a sized hero) survive Undo,
   Cancel and Clear instead of being wiped with the edits. */
const pageStyles = new WeakMap();
/**
 * Note the site's own style attribute before Froam writes to it directly —
 * a resize or spacing drag previews on inline styles before any draft is
 * painted, and without this the baseline would be taken mid-drag and Undo
 * would put the drag back.
 */
export function rememberPageStyle(element) {
    if (!pageStyles.has(element))
        pageStyles.set(element, element.getAttribute('style'));
}
/**
 * Take Froam's styles off an element: back to the style attribute the site
 * gave it. For an element Froam hasn't seen being painted (the page replaced
 * it since), only the properties in `styles` — Froam's — are removed.
 */
export function restorePageStyle(element, styles) {
    restorePageLink(element);
    if (pageStyles.has(element)) {
        const own = pageStyles.get(element);
        if (own === null || own === undefined)
            element.removeAttribute('style');
        else
            element.setAttribute('style', own);
        return;
    }
    for (const key of Object.keys(styles ?? {}))
        if (!key.startsWith('__froamState:'))
            element.style.removeProperty(camelToKebab(key));
    if (!element.getAttribute('style')?.trim())
        element.removeAttribute('style');
}
/* A link's own address, from before Froam first pointed it somewhere else. */
const pageLinks = new WeakMap();
/** Point a link where the draft says; anything unsafe is ignored. */
function applyLink(element, href) {
    if (element.tagName !== 'A')
        return;
    const safe = safeHref(href);
    if (!safe)
        return;
    if (!pageLinks.has(element))
        pageLinks.set(element, element.getAttribute('href'));
    if (element.getAttribute('href') !== safe)
        element.setAttribute('href', safe);
}
/** Put a link's own address back. Called wherever Froam's styles are taken off, so Undo, Cancel and Clear cover links too. */
export function restorePageLink(element) {
    if (!pageLinks.has(element))
        return;
    const own = pageLinks.get(element);
    pageLinks.delete(element);
    if (own === null || own === undefined)
        element.removeAttribute('href');
    else
        element.setAttribute('href', own);
}
export function applyDraft(element, draft) {
    try {
        const safeDraft = sanitizeDraftForElement(element, draft);
        if (safeDraft.styles && !pageStyles.has(element))
            pageStyles.set(element, element.getAttribute('style'));
        if (safeDraft.text !== undefined && !isBeingWritten(element)) {
            applyDraftText(element, safeDraft.text);
        }
        if (safeDraft.imageUrl !== undefined || safeDraft.media !== undefined) {
            applyMediaSource(element, safeDraft.imageUrl, safeDraft.media, 'editor');
        }
        if (safeDraft.href !== undefined)
            applyLink(element, safeDraft.href);
        if (safeDraft.styles) {
            for (const [key, raw] of Object.entries(safeDraft.styles)) {
                if (key.startsWith('__froamState:'))
                    continue;
                // setProperty requires kebab-case, but our store uses camelCase
                const kebabKey = camelToKebab(key);
                // A placed picture is stored by reference and shown from the bridge.
                const value = hasMediaRef(raw) ? resolveMediaRefs(raw, 'editor') : raw;
                // Repaints are frequent; an unchanged value is not rewritten.
                if (element.style.getPropertyValue(kebabKey) === value)
                    continue;
                element.style.setProperty(kebabKey, value);
            }
        }
    }
    catch {
        // Element may have been removed from DOM by React re-render — safe to ignore
    }
}
export function isInjectionPath(path) {
    return path.startsWith(`${INJECTION_KEY}:`);
}
export function isSectionStructurePath(path) {
    return path === SECTION_STRUCTURE_KEY;
}
export function readInjectionDraft(draft) {
    if (!draft.text)
        return null;
    try {
        const parsed = JSON.parse(draft.text);
        if (typeof parsed.html !== 'string')
            return null;
        if (typeof parsed.parentPath !== 'string')
            return null;
        return {
            html: parsed.html,
            parentPath: parsed.parentPath,
            parentId: typeof parsed.parentId === 'string' ? parsed.parentId : undefined,
            order: typeof parsed.order === 'number' ? parsed.order : 0,
        };
    }
    catch {
        return null;
    }
}
/* Shorthands and the longhands a browser expands them into. Reading an element
   back, `border-radius: 999px` also reads as four corner radii; those copies
   are the browser's, not an edit. Saved into the design they became a
   baseline Undo can't reach, so a look taken back after a reload left its
   corners behind. */
const SHORTHANDS = {
    padding: ['paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft'],
    margin: ['marginTop', 'marginRight', 'marginBottom', 'marginLeft'],
    borderRadius: ['borderTopLeftRadius', 'borderTopRightRadius', 'borderBottomRightRadius', 'borderBottomLeftRadius'],
    border: ['borderWidth', 'borderStyle', 'borderColor'],
    background: ['backgroundColor', 'backgroundImage', 'backgroundSize', 'backgroundPosition', 'backgroundRepeat', 'backgroundAttachment'],
    flex: ['flexGrow', 'flexShrink', 'flexBasis'],
};
/** A key that only restates, in another form, a property the draft already sets. */
function restates(key, draft) {
    for (const [shorthand, longhands] of Object.entries(SHORTHANDS)) {
        if (longhands.includes(key) && draft[shorthand])
            return true;
        if (key === shorthand && longhands.some((longhand) => draft[longhand]))
            return true;
    }
    return false;
}
export function readLiveElementDraft(element, existingDraft = {}) {
    const nextDraft = { ...existingDraft };
    if (existingDraft.text !== undefined || element.isContentEditable || canApplyTextDraft(element)) {
        nextDraft.text = element.innerText || '';
    }
    const drafted = existingDraft.styles ?? {};
    const liveStyles = { ...drafted };
    // The site's own style attribute, from before Froam painted on the element.
    const own = pageStyles.get(element);
    let ownStyle = null;
    if (own) {
        const probe = element.ownerDocument.createElement('div');
        probe.setAttribute('style', own);
        ownStyle = probe.style;
    }
    persistedStyleKeys.forEach((key) => {
        const shown = element.style[key];
        if (!shown)
            return;
        // What the page itself set, unchanged, is not an edit: kept as one, a
        // later change to it in the code would be undone by Froam.
        if (!(key in drafted) && ownStyle && ownStyle[key] === shown)
            return;
        // What the page shows from the bridge is stored as the reference it came from.
        const value = mediaRefsFromUrls(shown);
        // What the draft sets is refreshed; a new key is taken only when it is a
        // property of its own (an aligned element's left/top), not a restatement.
        if (key in drafted || !restates(key, drafted))
            liveStyles[key] = value;
    });
    const imageUrl = element instanceof HTMLImageElement
        ? readImageSource(element)
        : mediaRefsFromUrls(readImageUrl(element.style.backgroundImage));
    // A picture is an edit when Froam put it there: an image's own src, or the
    // page's own inline background, stays the code's to change.
    const pictureIsFroams = element instanceof HTMLImageElement
        ? froamPlacedMedia(element)
        : !pageStyles.has(element) || element.style.backgroundImage !== (ownStyle?.backgroundImage ?? '');
    if (existingDraft.imageUrl !== undefined || (imageUrl && pictureIsFroams)) {
        nextDraft.imageUrl = imageUrl;
    }
    if (Object.keys(liveStyles).length > 0) {
        nextDraft.styles = liveStyles;
    }
    return nextDraft;
}
export function applyCanvasDraftStyles(background, color, styles) {
    const host = getCanvasHost();
    if (!host)
        return;
    if (background)
        host.style.setProperty('background-color', background);
    else
        host.style.removeProperty('background-color');
    if (color)
        host.style.setProperty('color', color);
    else
        host.style.removeProperty('color');
    const imageKeys = ['backgroundImage', 'backgroundSize', 'backgroundPosition', 'backgroundRepeat', 'backgroundAttachment'];
    imageKeys.forEach((key) => {
        const value = styles?.[key];
        const cssKey = camelToKebab(key);
        if (value)
            host.style.setProperty(cssKey, hasMediaRef(value) ? resolveMediaRefs(value, 'editor') : value);
        else
            host.style.removeProperty(cssKey);
    });
    applyGlobalCSS(styles?.customCSS);
}
export function clearCanvasDraftStyles() {
    const host = getCanvasHost();
    if (!host)
        return;
    host.style.removeProperty('background-color');
    host.style.removeProperty('color');
    host.style.removeProperty('background-image');
    host.style.removeProperty('background-size');
    host.style.removeProperty('background-position');
    host.style.removeProperty('background-repeat');
    host.style.removeProperty('background-attachment');
    applyGlobalCSS('');
}
//# sourceMappingURL=drafts.js.map