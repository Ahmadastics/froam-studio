/** The element's own words, from before Froam first painted a draft on it. */
export declare function pageTextOf(element: HTMLElement): string | undefined;
/**
 * Write an element's text, keeping its own text nodes when that is all it
 * holds (with the comments SSR puts between adjacent text). React keeps
 * references to those nodes; `innerText` swaps them for new ones, and React's
 * next update then removes a node that is no longer there.
 */
export declare function writeElementText(element: HTMLElement, text: string): void;
export declare function applyDraftText(element: HTMLElement, text: string): boolean;
/** Before someone types into it: the page's own words, if nothing has painted over them yet. */
export declare function rememberPageText(element: HTMLElement): void;
/**
 * A text draft went away (undone, reverted, taken off by a teammate): put the
 * page's own words back — but only while the element still shows what Froam
 * painted. If the page re-rendered it since, the page's text is already there.
 */
export declare function restorePageText(element: HTMLElement): boolean;
/** The element the user is typing into right now — never repaint it under them. */
export declare function isBeingWritten(element: HTMLElement): boolean;
//# sourceMappingURL=draft-text.d.ts.map