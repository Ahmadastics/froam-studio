/**
 * Froam Rooms — the path format.
 *
 * A path is `tag:n/tag:n/...` from the froam root down, where `n` is the
 * element's 1-based position among its same-tag siblings. Every draft, op,
 * comment and lock is keyed by one, so this is a contract, not an
 * implementation detail — it appears in froam.design.json, in the generated
 * CSS scope, and (from v5) on the wire between a designer and a client.
 *
 * Extracted from the editor so the format has one definition that the log,
 * the anchor resolver and a room server can all agree on.
 */
/**
 * Which elements a path can address: every HTML element, plus an `<svg>` root
 * (icons, logos, illustrations). SVG internals (path, g, circle…) roll up to
 * their <svg>. Siblings are counted per tag, so admitting <svg> changes no
 * existing HTML path — only paths ending in `svg:n` become resolvable.
 *
 * Typed as HTMLElement because the editor treats both uniformly (style,
 * dataset, attributes, geometry); callers must not assume innerText on an svg.
 */
export declare function isPathElement(node: Element | null | undefined): node is HTMLElement;
export declare function isSafeDraftPath(path: string): boolean;
/**
 * Page content outside the root. A React app renders into `#root`, but its
 * portals — modals, drawers, toasts, menus — mount straight on `<body>`, and a
 * page whose root is `<main>` keeps its header and footer outside it. Paths to
 * those start with this segment and count from `<body>`:
 *
 *   `@body/div:2/h2:1`   — the h2 in the second <div> on <body>
 *
 * Nothing about ordinary paths changes, so every saved design still resolves.
 * The nodes can't be moved into the root instead: React removes a portal from
 * its own container when it closes, and throws if the node was re-parented.
 */
export declare const BODY_SCOPE = "@body";
export declare function isBodyScopedPath(path: string): boolean;
/**
 * Froam's own nodes on `<body>`: the editor's UI, the device frame, the
 * standalone host. They are never page content, and are not counted in a
 * `@body` path — so the editor numbers `<body>`'s children exactly as a
 * production page (which has none of them) does.
 */
export declare function isFroamOwnedNode(element: Element): boolean;
/**
 * Whether `element` is page content Froam can address from `root`: inside the
 * root, or elsewhere on `<body>` and not part of Froam's own UI.
 */
export declare function isInPageScope(element: Element, root: HTMLElement): boolean;
export declare function getElementPath(element: HTMLElement, root: HTMLElement): string;
export declare function findElementByPath(root: HTMLElement, path: string): HTMLElement | null;
/** The tag a path points at, without touching the DOM. */
export declare function tagOfPath(path: string): string;
//# sourceMappingURL=paths.d.ts.map