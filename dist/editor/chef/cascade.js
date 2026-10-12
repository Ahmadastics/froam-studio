/**
 * Froam — how screen sizes inherit.
 *
 * Desktop is the base and flows down: a desktop edit shows at every width,
 * tablet edits lay over it at 1024px and below, mobile edits over both at
 * 640px and below. It's the cascade Webflow and Framer use, and the one the
 * generated stylesheet, both runtimes and the editor's own previews share —
 * so what the Mobile preview shows is what a phone visitor gets.
 *
 * Per element, a narrower draft's fields replace the wider ones' and its
 * styles merge over theirs. KEEP IN SYNC with layeredStore in lib/codegen.mjs
 * (and the copy in the vanilla runtime there).
 *
 * Dependency-free on purpose: the production React runtime imports it.
 */
export const SIZE_ORDER = ['desktop', 'tablet', 'mobile'];
const NOTHING = Object.freeze({});
/**
 * Everything that applies at `size`: each wider size's drafts, then this one's.
 *
 * When only one size has anything — always so at desktop — that size's own
 * object comes back, not a copy. Callers key effects on it, and a fresh object
 * on every call made them repaint the page on every render.
 */
export function layeredDrafts(bySize, size) {
    const layers = SIZE_ORDER.slice(0, SIZE_ORDER.indexOf(size) + 1).filter((layer) => Object.keys(bySize[layer] ?? {}).length > 0);
    if (layers.length === 0)
        return NOTHING;
    if (layers.length === 1)
        return bySize[layers[0]];
    const merged = {};
    for (const layer of layers) {
        for (const [key, draft] of Object.entries(bySize[layer] ?? {})) {
            const below = merged[key];
            if (below && draft && typeof draft === 'object') {
                const next = { ...below, ...draft };
                if (below.styles || draft.styles)
                    next.styles = { ...(below.styles ?? {}), ...(draft.styles ?? {}) };
                merged[key] = next;
            }
            else {
                merged[key] = draft;
            }
        }
    }
    return merged;
}
/** What `size` inherits: the layered drafts of the wider sizes only (empty for desktop). */
export function inheritedDrafts(bySize, size) {
    const index = SIZE_ORDER.indexOf(size);
    return index <= 0 ? {} : layeredDrafts(bySize, SIZE_ORDER[index - 1]);
}
/** The editor keeps one store keyed `route@@size`; this reads one route's sizes out of it. */
export function routeSizes(store, routeKey) {
    return { desktop: store[`${routeKey}@@desktop`], tablet: store[`${routeKey}@@tablet`], mobile: store[`${routeKey}@@mobile`] };
}
/**
 * A narrower size's draft, minus what it only repeats of the sizes above.
 *
 * Saving reads styles and words back off the live element, and in the Tablet
 * or Mobile preview the live element is showing the desktop edits underneath.
 * Kept as they are, those copies would freeze: change the desktop colour
 * later and phones would keep the old one. A value this size never set
 * itself (`before`), that only matches what it inherits — or, for words, the
 * page's own — is dropped.
 */
export function withoutInherited(draft, before, inherited, pageText) {
    const next = { ...draft };
    if (next.styles) {
        const styles = { ...next.styles };
        for (const [key, value] of Object.entries(styles)) {
            if (before?.styles && key in before.styles)
                continue;
            if (inherited?.styles?.[key] === value)
                delete styles[key];
        }
        if (Object.keys(styles).length)
            next.styles = styles;
        else
            delete next.styles;
    }
    if (typeof next.text === 'string' && before?.text === undefined) {
        const shown = next.text.trim();
        const inheritedText = typeof inherited?.text === 'string' ? inherited.text.trim() : undefined;
        if (shown === inheritedText || (inheritedText === undefined && pageText !== undefined && shown === pageText.trim()))
            delete next.text;
    }
    return next;
}
//# sourceMappingURL=cascade.js.map