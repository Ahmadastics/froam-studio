/**
 * Component-aware editing.
 *
 * Reads React's internal fiber tree (attached to DOM nodes) to name the
 * component that owns an element and find that component's root DOM node.
 * This lets Froam say "you're editing <TaskCard>" and snap selection to a
 * component boundary — so designs survive refactors, because they're
 * anchored to a component, not a brittle DOM path.
 *
 * Entirely best-effort and read-only: every access is guarded, and if the
 * host isn't React (or internals change) the features simply go quiet.
 */
export type ComponentInfo = {
    name: string;
    /** DOM node that is the outermost element rendered by that component. */
    rootEl: HTMLElement | null;
};
/**
 * Nearest named component owning `el`, plus that component's root element.
 * Skips generic host wrappers and Froam's own components.
 */
export declare function nearestComponent(el: HTMLElement): ComponentInfo | null;
/** Full ancestor chain of named components, outermost last. For a breadcrumb. */
export declare function componentAncestry(el: HTMLElement, limit?: number): string[];
//# sourceMappingURL=froamReactFiber.d.ts.map