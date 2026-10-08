/**
 * The few page elements the editor has to know about by their computed style:
 * click-through layers (`pointer-events: none`, see hit-test.ts) and pinned
 * ones (`position: sticky | fixed`, see usePageCanvasOffset.ts).
 *
 * Nothing but a computed style says which elements those are, and a page can
 * have tens of thousands of elements. Both used to read every element's style
 * again after any change on the page — every edit, every typed word — and
 * each scan forced a full relayout. Here one scan runs when the page is idle,
 * then only the subtree a change touched is read again: an edit to one
 * element re-reads that element, not the page.
 */
export type PageStyleIndex = {
    clickThrough: ReadonlySet<HTMLElement>;
    pinned: ReadonlySet<HTMLElement>;
};
type Listener = (index: PageStyleIndex, changed: {
    clickThrough: boolean;
    pinned: boolean;
}) => void;
/** Get the index for `root` now and on every change. Returns unsubscribe. */
export declare function subscribePageStyles(root: HTMLElement, listener: Listener): () => void;
export {};
//# sourceMappingURL=page-styles.d.ts.map