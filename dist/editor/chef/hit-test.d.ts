/**
 * What the pointer is over, as Froam sees the page: the editable element under
 * a point (SVG internals roll up to their <svg>, Froam's own UI never counts),
 * everything beneath it for Alt+click, and click-through layers
 * (`pointer-events: none`) that the browser's own hit test skips.
 *
 * Page content is the root plus anything else on <body> that isn't Froam's
 * (a React app's portals: modals, drawers, toasts — see isInPageScope).
 *
 * One tester per editable root. It marks click-through layers and keeps the
 * marks current as the page changes; call disconnect() when editing stops.
 */
export declare function createHitTester(rootElement: HTMLElement, getSelectedPath: () => string | undefined): {
    resolveTarget: (rawTarget: EventTarget | null) => HTMLElement | null;
    resolveClick: (event: MouseEvent) => {
        target: null;
        stack: HTMLElement[];
    } | {
        target: HTMLElement;
        stack: HTMLElement[];
    };
    disconnect: () => void;
};
export type HitTester = ReturnType<typeof createHitTester>;
//# sourceMappingURL=hit-test.d.ts.map