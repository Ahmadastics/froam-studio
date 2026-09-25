import { type Dispatch, type SetStateAction } from 'react';
type Ref<T> = {
    current: T;
};
/**
 * Keeps the selection's handles, size badge and floating bar on the element
 * they belong to. The rect they're drawn from was only measured when the
 * selection changed — so scrolling the page, opening a panel (the page
 * reflows into the space left) or anything above it growing left them
 * floating over the wrong content.
 *
 * Remeasures on scroll (any scroller, captured), window resize, and size
 * changes of the page or the element itself; at most once per frame, and
 * only publishes a rect that actually changed.
 */
export declare function useSelectionTracking(active: boolean, currentSelectionRef: Ref<HTMLElement | null>, setSelectionRect: Dispatch<SetStateAction<DOMRect | null>>): void;
export {};
//# sourceMappingURL=useSelectionTracking.d.ts.map