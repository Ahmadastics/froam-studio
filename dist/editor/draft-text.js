/**
 * Text drafts are painted from a MutationObserver on the root, and writing
 * `innerText` is itself a childList mutation — so an unconditional write
 * repaints on the next frame, forever. That loop replaces the text node
 * every frame, which wipes any selection or caret inside it (double-click
 * to select a word, typing into a heading) and burns a frame's worth of
 * layout on every edited element.
 *
 * Reading `innerText` back does not always return what was written (the
 * browser collapses whitespace: "Hello " reads back as "Hello"), so an
 * equality check alone still loops. What the element showed right after
 * the last write is remembered too: if it still shows exactly that, the
 * draft is already on screen.
 */
const shownAfterWrite = new WeakMap();
/** What the page itself said before any draft was painted over it. */
const pageText = new WeakMap();
/** The element's own words, from before Froam first painted a draft on it. */
export function pageTextOf(element) {
    return pageText.get(element);
}
/**
 * Write an element's text, keeping its own text nodes when that is all it
 * holds (with the comments SSR puts between adjacent text). React keeps
 * references to those nodes; `innerText` swaps them for new ones, and React's
 * next update then removes a node that is no longer there.
 */
export function writeElementText(element, text) {
    let first = null;
    for (const node of Array.from(element.childNodes)) {
        if (node.nodeType === Node.TEXT_NODE)
            first ??= node;
        else if (node.nodeType !== Node.COMMENT_NODE) {
            first = null;
            break;
        }
    }
    // innerText turns a newline into <br>; a text node can't.
    if (!first || text.includes('\n')) {
        element.innerText = text;
        return;
    }
    first.nodeValue = text;
    for (const node of Array.from(element.childNodes)) {
        if (node !== first && node.nodeType === Node.TEXT_NODE)
            node.nodeValue = '';
    }
}
export function applyDraftText(element, text) {
    const shown = element.innerText;
    if (shown === text)
        return false;
    const last = shownAfterWrite.get(element);
    if (last && last.text === text && last.shown === shown)
        return false;
    if (!pageText.has(element))
        pageText.set(element, shown);
    writeElementText(element, text);
    shownAfterWrite.set(element, { text, shown: element.innerText });
    return true;
}
/** Before someone types into it: the page's own words, if nothing has painted over them yet. */
export function rememberPageText(element) {
    if (!pageText.has(element))
        pageText.set(element, element.innerText);
}
/**
 * A text draft went away (undone, reverted, taken off by a teammate): put the
 * page's own words back — but only while the element still shows what Froam
 * painted. If the page re-rendered it since, the page's text is already there.
 */
export function restorePageText(element) {
    const original = pageText.get(element);
    const last = shownAfterWrite.get(element);
    if (original === undefined || !last || isBeingWritten(element))
        return false;
    if (element.innerText !== last.shown)
        return false;
    writeElementText(element, original);
    pageText.delete(element);
    shownAfterWrite.delete(element);
    return true;
}
/** The element the user is typing into right now — never repaint it under them. */
export function isBeingWritten(element) {
    if (!element.isContentEditable)
        return false;
    const active = document.activeElement;
    return !!active && (active === element || element.contains(active));
}
//# sourceMappingURL=draft-text.js.map