import { SECTION_STRUCTURE_KEY } from '../section-structure.js';
import { applyDraftText, isBeingWritten } from '../draft-text.js';
import { INJECTION_KEY } from './types.js';
import { persistedStyleKeys } from './style-options.js';
import { getCanvasHost, applyGlobalCSS, camelToKebab, readImageUrl } from './dom.js';
import { canApplyTextDraft } from './writing.js';
export function sanitizeDraftForElement(element, draft) {
    if (draft.text === undefined || canApplyTextDraft(element))
        return draft;
    const safeDraft = { ...draft };
    delete safeDraft.text;
    return safeDraft;
}
export function applyDraft(element, draft) {
    try {
        const safeDraft = sanitizeDraftForElement(element, draft);
        if (safeDraft.text !== undefined && !isBeingWritten(element)) {
            applyDraftText(element, safeDraft.text);
        }
        if (element instanceof HTMLImageElement && safeDraft.imageUrl !== undefined) {
            if (safeDraft.imageUrl) {
                element.src = safeDraft.imageUrl;
            }
            else {
                element.removeAttribute('src');
            }
        }
        if (safeDraft.styles) {
            for (const [key, value] of Object.entries(safeDraft.styles)) {
                if (key.startsWith('__froamState:'))
                    continue;
                // setProperty requires kebab-case, but our store uses camelCase
                const kebabKey = camelToKebab(key);
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
export function readLiveElementDraft(element, existingDraft = {}) {
    const nextDraft = { ...existingDraft };
    if (existingDraft.text !== undefined || element.isContentEditable || canApplyTextDraft(element)) {
        nextDraft.text = element.innerText || '';
    }
    const liveStyles = { ...(existingDraft.styles ?? {}) };
    persistedStyleKeys.forEach((key) => {
        const value = element.style[key];
        if (value)
            liveStyles[key] = value;
    });
    const imageUrl = element instanceof HTMLImageElement
        ? element.currentSrc || element.src || ''
        : readImageUrl(element.style.backgroundImage);
    if (imageUrl || existingDraft.imageUrl !== undefined) {
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
            host.style.setProperty(cssKey, value);
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