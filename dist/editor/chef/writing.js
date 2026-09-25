export function canApplyTextDraft(element) {
    if (!(element instanceof HTMLElement))
        return false; // <svg>: style it, don't retype it
    if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement || element instanceof HTMLSelectElement)
        return false;
    if (element.dataset.froamShape === 'true')
        return true;
    if (element.children.length === 0)
        return true;
    const tag = element.tagName.toLowerCase();
    return ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'span', 'small', 'strong', 'em', 'b', 'i', 'label', 'button', 'a', 'li'].includes(tag);
}
export const TEXT_VISUAL_TAGS = new Set(['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'span', 'small', 'strong', 'em', 'b', 'i', 'blockquote', 'figcaption', 'cite', 'dt', 'dd', 'li']);
export const INLINE_TEXT_CHILD_TAGS = new Set(['span', 'small', 'strong', 'em', 'b', 'i', 'mark', 'cite', 'br', 'wbr']);
/* ─── Writing: which elements hold copy a person can type into ─── */
export const NON_WRITABLE_TAGS = new Set(['img', 'input', 'textarea', 'select', 'option', 'video', 'audio', 'canvas', 'iframe', 'svg', 'br', 'hr', 'picture', 'source', 'track', 'object', 'embed', 'area', 'map', 'meter', 'progress', 'ul', 'ol', 'table', 'tbody', 'thead', 'tfoot', 'tr']);
export const WRITABLE_TAGS = new Set(['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'span', 'small', 'strong', 'em', 'b', 'i', 'u', 'mark', 'q', 'cite', 'abbr', 'time', 'code', 'a', 'button', 'label', 'li', 'dt', 'dd', 'td', 'th', 'caption', 'figcaption', 'blockquote', 'summary', 'legend', 'address']);
/** Enter finishes writing in these (Shift+Enter still breaks the line); elsewhere it's a new line. */
export const SINGLE_LINE_TAGS = new Set(['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'a', 'button', 'label', 'span', 'small', 'strong', 'em', 'b', 'i', 'u', 'mark', 'q', 'cite', 'abbr', 'time', 'code', 'summary', 'legend', 'dt', 'td', 'th', 'caption']);
/** Copy someone could want to rewrite: text tags, or any leaf that already shows text. */
export function isWritableElement(element) {
    if (!(element instanceof HTMLElement))
        return false;
    const tag = element.tagName.toLowerCase();
    if (NON_WRITABLE_TAGS.has(tag))
        return false;
    if (element.dataset.froamShape === 'true')
        return true;
    if (!canApplyTextDraft(element))
        return false;
    return WRITABLE_TAGS.has(tag) || (element.children.length === 0 && !!element.innerText?.trim());
}
/** Put the caret where the person pointed (or select the word there), else at the end. */
export function placeCaret(element, caret) {
    const selection = window.getSelection();
    if (!selection)
        return;
    let range = null;
    if (caret !== 'end') {
        // Froam's own overlay (resize edges, handles) sits over the element's
        // edges; let the caret lookup see through it to the text beneath.
        const html = document.documentElement;
        html.setAttribute('data-froam-caret-probe', 'true');
        let hit = null;
        try {
            hit = document.caretRangeFromPoint?.(caret.x, caret.y) ?? null;
        }
        finally {
            html.removeAttribute('data-froam-caret-probe');
        }
        if (hit && element.contains(hit.startContainer))
            range = hit;
    }
    if (!range) {
        range = document.createRange();
        range.selectNodeContents(element);
        range.collapse(false);
    }
    selection.removeAllRanges();
    selection.addRange(range);
    if (caret !== 'end' && caret.word && typeof selection.modify === 'function') {
        selection.modify('move', 'backward', 'word');
        selection.modify('extend', 'forward', 'word');
    }
}
export function isEditableField(target) {
    if (!(target instanceof HTMLElement))
        return false;
    return target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);
}
export function isTextVisualLayer(element) {
    if (element.dataset.froamShape === 'true')
        return false;
    const tag = element.tagName.toLowerCase();
    if (!TEXT_VISUAL_TAGS.has(tag) || !element.innerText?.trim())
        return false;
    return Array.from(element.children).every((child) => INLINE_TEXT_CHILD_TAGS.has(child.tagName.toLowerCase()));
}
//# sourceMappingURL=writing.js.map