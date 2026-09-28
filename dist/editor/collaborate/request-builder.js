import { findElementByPath, tagOfPath } from '../../collab/paths.js';
const INJECTION_PREFIX = '__froam_injection__:';
const TAG_NAMES = {
    h1: 'Heading', h2: 'Heading', h3: 'Heading', h4: 'Heading', h5: 'Heading', h6: 'Heading',
    p: 'Paragraph', a: 'Link', button: 'Button', img: 'Image', li: 'List item', span: 'Text',
    section: 'Section', header: 'Header', footer: 'Footer', nav: 'Navigation', svg: 'Icon',
};
const clip = (value, max = 160) => {
    if (value === undefined)
        return null;
    const text = value.replace(/\s+/g, ' ').trim();
    return text.length > max ? `${text.slice(0, max - 1)}…` : text || null;
};
function fieldLabel(field) {
    if (field === 'text')
        return 'Text';
    if (field === 'imageUrl')
        return 'Image';
    const name = field.replace(/^style:/, '').replace(/^__froamState:([^:]+):/, '$1 ').replace(/([A-Z])/g, ' $1').trim().toLowerCase();
    return name.charAt(0).toUpperCase() + name.slice(1);
}
/**
 * "Heading “Plan a trip”" — what a person would call the element. On another
 * page the element isn't in the DOM, so the fingerprint's words stand in.
 */
export function elementLabel(path, root, fallbackText) {
    const tag = tagOfPath(path);
    const kind = TAG_NAMES[tag] ?? (tag ? `<${tag}>` : 'Element');
    const element = root ? findElementByPath(root, path) : null;
    const sample = clip(element?.innerText ?? fallbackText ?? '', 32);
    return sample ? `${kind} “${sample}”` : kind;
}
function currentValue(draft, field) {
    if (!draft)
        return undefined;
    if (field === 'text')
        return draft.text;
    if (field === 'imageUrl')
        return draft.imageUrl;
    return draft.styles?.[field.replace(/^style:/, '')];
}
const scopeId = (routeKey, viewport) => `${routeKey}@@${viewport}`;
/** The element's classes as its source writes them — never the editor's own markers. */
export function sourceClasses(className) {
    if (typeof className !== 'string')
        return '';
    return className.split(/\s+/).filter((name) => name && !/^(?:froam|chef|fs-|global-chef)/.test(name)).join(' ');
}
/**
 * A contributor's changes, from the ops they made themselves — never from
 * diffing the page, which would sweep in whatever the owner changed live in
 * the meantime. Each touched field reads from its first `before` to its value
 * now; a field edited back to where it started is not a change.
 *
 * Every page and screen size they touched goes in one request: fixing the
 * headline on desktop and on mobile is one change to a person, not two.
 */
export function buildChangeRequest(input) {
    // scope → path → field → first before
    const touched = new Map();
    const opIds = [];
    for (const op of input.ops) {
        if (!input.isMine(op.actor) || input.excludedOpIds.has(op.id))
            continue;
        opIds.push(op.id);
        const id = scopeId(op.routeKey, op.viewport);
        const scope = touched.get(id) ?? { routeKey: op.routeKey, viewport: op.viewport, paths: new Map() };
        const fields = scope.paths.get(op.path) ?? new Map();
        if (!fields.has(op.field))
            fields.set(op.field, { before: op.before });
        scope.paths.set(op.path, fields);
        touched.set(id, scope);
    }
    const currentId = scopeId(input.current.routeKey, input.current.viewport);
    const ordered = [...touched.entries()].sort(([a], [b]) => (a === currentId ? -1 : b === currentId ? 1 : 0));
    const scopes = [];
    const changes = [];
    const textEdits = [];
    const styleEdits = [];
    for (const [id, scope] of ordered) {
        const drafts = input.draftsFor(scope.routeKey, scope.viewport);
        const onScreen = id === currentId;
        const store = {};
        const removed = [];
        for (const [path, fields] of scope.paths) {
            const draft = drafts[path];
            let changed = false;
            const styles = {};
            for (const [field, first] of fields) {
                const before = first.before ?? (field === 'text' ? input.originalText?.(scope.routeKey, scope.viewport, path) : undefined);
                const after = currentValue(draft, field);
                if ((after ?? '') === (before ?? ''))
                    continue;
                changed = true;
                if (path.startsWith(INJECTION_PREFIX)) {
                    changes.push({ label: 'Added a section', before: null, after: null, routeKey: scope.routeKey, viewport: scope.viewport });
                    continue;
                }
                changes.push({
                    label: `${fieldLabel(field)} · ${elementLabel(path, onScreen ? input.current.root : null, draft?.fingerprint?.text)}`,
                    before: field === 'imageUrl' ? (before ? 'previous image' : null) : clip(before),
                    after: field === 'imageUrl' ? (after ? 'new image' : null) : clip(after),
                    routeKey: scope.routeKey,
                    viewport: scope.viewport,
                });
                if (field === 'text' && typeof before === 'string' && typeof after === 'string')
                    textEdits.push({ from: before, to: after });
                if (field.startsWith('style:') && !field.startsWith('style:__froamState') && typeof after === 'string')
                    styles[field.slice('style:'.length)] = after;
            }
            if (!changed)
                continue;
            if (draft)
                store[path] = draft;
            else
                removed.push(path);
            const className = sourceClasses(draft?.fingerprint?.className);
            if (scope.viewport === 'desktop' && Object.keys(styles).length && className.split(' ').length >= 2) {
                styleEdits.push({ routeKey: scope.routeKey, viewport: 'desktop', path, tag: tagOfPath(path), className, styles });
            }
        }
        if (Object.keys(store).length || removed.length)
            scopes.push({ routeKey: scope.routeKey, viewport: scope.viewport, store, removed });
    }
    return {
        opIds,
        scopes,
        store: (scopes[0]?.store ?? {}),
        removed: scopes[0]?.removed ?? [],
        changes,
        textEdits,
        styleEdits,
    };
}
//# sourceMappingURL=request-builder.js.map