/** The drag payload a Library card carries: the pattern's id. */
export declare const FROAM_PATTERN_MIME = "application/x-froam-pattern";
export type PatternDropPlacement = 'before' | 'after';
/**
 * The section a pattern dropped at this point lands beside: the innermost
 * block at least half the page wide whose parent holds other blocks too —
 * a hero, a feature band, a footer — never a heading inside one of them.
 */
export declare function dropTargetFor(hit: Element, root: HTMLElement): HTMLElement | null;
type Options = {
    enabled: boolean;
    getRoot: () => HTMLElement | null;
    onDrop: (componentId: string, target: HTMLElement, placement: PatternDropPlacement) => void;
};
/**
 * Drag a Library pattern over the page: a line shows exactly where it will
 * land — above or below the section under the pointer — and letting go puts
 * it there. Only drags that carry a pattern are touched; the page's own drop
 * zones (file uploads, sortable lists) never see a difference.
 */
export declare function usePatternDrop({ enabled, getRoot, onDrop }: Options): void;
export {};
//# sourceMappingURL=pattern-drop.d.ts.map