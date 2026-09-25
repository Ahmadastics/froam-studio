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
export function applyDraftText(element, text) {
    const shown = element.innerText;
    if (shown === text)
        return false;
    const last = shownAfterWrite.get(element);
    if (last && last.text === text && last.shown === shown)
        return false;
    element.innerText = text;
    shownAfterWrite.set(element, { text, shown: element.innerText });
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