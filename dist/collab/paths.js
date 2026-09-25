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
export function isPathElement(node) {
    return node instanceof HTMLElement || node instanceof SVGSVGElement;
}
export function isSafeDraftPath(path) {
    return path.trim().length > 0 && path.includes(':');
}
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
export const BODY_SCOPE = '@body';
const BODY_PREFIX = `${BODY_SCOPE}/`;
export function isBodyScopedPath(path) {
    return path.startsWith(BODY_PREFIX);
}
/**
 * Froam's own nodes on `<body>`: the editor's UI, the device frame, the
 * standalone host. They are never page content, and are not counted in a
 * `@body` path — so the editor numbers `<body>`'s children exactly as a
 * production page (which has none of them) does.
 */
export function isFroamOwnedNode(element) {
    return element.getAttribute('data-chef-editor-root') === 'true' || element.id.startsWith('froam-');
}
/** Children of `parent` that count toward a path segment's position. */
function countedChildren(parent, tagName) {
    const onBody = parent === parent.ownerDocument?.body;
    return Array.from(parent.children).filter((child) => isPathElement(child)
        && child.tagName.toLowerCase() === tagName
        && !(onBody && isFroamOwnedNode(child)));
}
/**
 * Whether `element` is page content Froam can address from `root`: inside the
 * root, or elsewhere on `<body>` and not part of Froam's own UI.
 */
export function isInPageScope(element, root) {
    if (root.contains(element))
        return true;
    // A root that stands in for <body> (a static page's wrapper) is the whole
    // page; a @body path would count the wrapper itself as a <div>.
    if (root.getAttribute('data-froam-root') === 'page')
        return false;
    const body = element.ownerDocument?.body;
    if (!body || root === body || element === body || !body.contains(element))
        return false;
    for (let node = element; node && node !== body; node = node.parentElement) {
        if (isFroamOwnedNode(node))
            return false;
    }
    return true;
}
function segmentsFrom(element, base) {
    const segments = [];
    let current = element;
    while (current && current !== base) {
        const parent = current.parentElement;
        if (!parent)
            break;
        const tag = current.tagName.toLowerCase();
        const index = Math.max(1, countedChildren(parent, tag).indexOf(current) + 1);
        segments.unshift(`${tag}:${index}`);
        current = parent;
    }
    return segments.join('/');
}
export function getElementPath(element, root) {
    const body = element.ownerDocument?.body;
    if (body && !root.contains(element) && isInPageScope(element, root)) {
        return `${BODY_PREFIX}${segmentsFrom(element, body)}`;
    }
    return segmentsFrom(element, root);
}
export function findElementByPath(root, path) {
    if (!isSafeDraftPath(path))
        return null;
    const bodyScoped = isBodyScopedPath(path);
    const segments = (bodyScoped ? path.slice(BODY_PREFIX.length) : path).split('/').filter(Boolean);
    let current = bodyScoped ? root.ownerDocument?.body ?? null : root;
    for (const segment of segments) {
        if (!current)
            return null;
        const [tag, position] = segment.split(':');
        const index = Math.max(0, Number(position) - 1);
        const next = countedChildren(current, tag)[index];
        if (!next)
            return null;
        current = next;
    }
    return current;
}
/** The tag a path points at, without touching the DOM. */
export function tagOfPath(path) {
    const last = path.split('/').filter(Boolean).at(-1);
    return last && last !== BODY_SCOPE ? last.split(':')[0] : '';
}
//# sourceMappingURL=paths.js.map