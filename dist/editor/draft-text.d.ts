/** The element's own words, from before Froam first painted a draft on it. */
export declare function pageTextOf(element: HTMLElement): string | undefined;
export declare function applyDraftText(element: HTMLElement, text: string): boolean;
/**
 * A text draft went away (undone, reverted, taken off by a teammate): put the
 * page's own words back — but only while the element still shows what Froam
 * painted. If the page re-rendered it since, the page's text is already there.
 */
export declare function restorePageText(element: HTMLElement): boolean;
/** The element the user is typing into right now — never repaint it under them. */
export declare function isBeingWritten(element: HTMLElement): boolean;
//# sourceMappingURL=draft-text.d.ts.map