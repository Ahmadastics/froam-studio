export const FROAM_PAGE_PROFILE_SCHEMA_VERSION = 1;
/** Roles that represent a user action. Accent discipline is measured against these. */
export const FROAM_ACTION_ROLES = ['cta', 'button', 'input', 'form'];
/** Smallest font size treated as a type-scale step. Below this it is decoration. */
export const FROAM_MIN_TYPE_PX = 10;
/** WCAG 2.5.8 AA minimum target size, in CSS pixels. */
export const FROAM_MIN_TARGET_PX = 24;
// ── colour ──────────────────────────────────────────────────────────────────
/** Parse the colour forms computed styles actually emit. Returns null for gradients and keywords. */
export function parseCssColor(value) {
    if (!value)
        return null;
    const text = value.trim().toLowerCase();
    if (!text || text === 'transparent' || text === 'none' || text === 'currentcolor')
        return null;
    const rgb = text.match(/^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)(?:[\s,/]+([\d.%]+))?\s*\)$/);
    if (rgb) {
        const alphaRaw = rgb[4];
        const a = alphaRaw === undefined ? 1 : alphaRaw.endsWith('%') ? Number.parseFloat(alphaRaw) / 100 : Number.parseFloat(alphaRaw);
        return { r: Number(rgb[1]) / 255, g: Number(rgb[2]) / 255, b: Number(rgb[3]) / 255, a: Number.isFinite(a) ? a : 1 };
    }
    const hex = text.match(/^#([0-9a-f]{3,8})$/);
    if (hex) {
        const digits = hex[1];
        const expand = (part) => Number.parseInt(part.length === 1 ? part + part : part, 16) / 255;
        if (digits.length === 3 || digits.length === 4)
            return { r: expand(digits[0]), g: expand(digits[1]), b: expand(digits[2]), a: digits.length === 4 ? expand(digits[3]) : 1 };
        if (digits.length === 6 || digits.length === 8)
            return { r: expand(digits.slice(0, 2)), g: expand(digits.slice(2, 4)), b: expand(digits.slice(4, 6)), a: digits.length === 8 ? expand(digits.slice(6, 8)) : 1 };
    }
    return null;
}
const linearize = (channel) => channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
const delinearize = (channel) => channel <= 0.0031308 ? channel * 12.92 : 1.055 * channel ** (1 / 2.4) - 0.055;
/** sRGB → OKLab. Clustering in sRGB treats #111 and #131214 as different decisions; OKLab does not. */
export function rgbToOklab(rgb) {
    const r = linearize(rgb.r), g = linearize(rgb.g), b = linearize(rgb.b);
    const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
    const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
    const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
    return {
        L: 0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s,
        a: 1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s,
        b: 0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s,
    };
}
export function oklabToRgb(lab) {
    const l = (lab.L + 0.3963377774 * lab.a + 0.2158037573 * lab.b) ** 3;
    const m = (lab.L - 0.1055613458 * lab.a - 0.0638541728 * lab.b) ** 3;
    const s = (lab.L - 0.0894841775 * lab.a - 1.2914855480 * lab.b) ** 3;
    const clamp = (value) => Math.min(1, Math.max(0, value));
    return {
        r: clamp(delinearize(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s)),
        g: clamp(delinearize(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s)),
        b: clamp(delinearize(-0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s)),
    };
}
export function oklabToOklch(lab) {
    const c = Math.hypot(lab.a, lab.b);
    const h = c < 1e-6 ? 0 : (Math.atan2(lab.b, lab.a) * 180 / Math.PI + 360) % 360;
    return { l: lab.L, c, h };
}
export function oklchToOklab(oklch) {
    const radians = oklch.h * Math.PI / 180;
    return { L: oklch.l, a: Math.cos(radians) * oklch.c, b: Math.sin(radians) * oklch.c };
}
const toHex = (rgb) => `#${[rgb.r, rgb.g, rgb.b].map((channel) => Math.round(channel * 255).toString(16).padStart(2, '0')).join('')}`;
export function oklchToHex(oklch) { return toHex(oklabToRgb(oklchToOklab(oklch))); }
/** WCAG 2.x relative luminance. Deliberately not OKLab — the standard defines this exact formula. */
export function relativeLuminance(rgb) {
    return 0.2126 * linearize(rgb.r) + 0.7152 * linearize(rgb.g) + 0.0722 * linearize(rgb.b);
}
export function contrastRatio(foreground, background) {
    const a = relativeLuminance(foreground), b = relativeLuminance(background);
    const light = Math.max(a, b), dark = Math.min(a, b);
    return (light + 0.05) / (dark + 0.05);
}
/** Composite a possibly translucent colour over an opaque backdrop. */
function flatten(colour, backdrop) {
    if (colour.a >= 1)
        return { r: colour.r, g: colour.g, b: colour.b };
    return {
        r: colour.r * colour.a + backdrop.r * (1 - colour.a),
        g: colour.g * colour.a + backdrop.g * (1 - colour.a),
        b: colour.b * colour.a + backdrop.b * (1 - colour.a),
    };
}
/** WCAG AA threshold: 3.0 for large text (≥24px, or ≥18.66px at weight ≥700), else 4.5. */
export function contrastRequirement(fontSizePx, fontWeight) {
    return fontSizePx >= 24 || (fontSizePx >= 18.66 && fontWeight >= 700) ? 3 : 4.5;
}
const signal = (record, kind) => (record.signals.find((item) => item.kind === kind)?.values ?? {});
const num = (value, fallback = 0) => {
    const parsed = typeof value === 'number' ? value : Number.parseFloat(String(value ?? ''));
    return Number.isFinite(parsed) ? parsed : fallback;
};
function toNodeViews(records) {
    const views = new Map();
    for (const record of records) {
        const identity = signal(record, 'identity'), structure = signal(record, 'structure');
        const layout = signal(record, 'layout'), appearance = signal(record, 'appearance');
        const semantics = signal(record, 'semantics'), responsive = signal(record, 'responsive');
        const accessibility = signal(record, 'accessibility'), behavior = signal(record, 'behavior');
        const rectRaw = (layout.rect ?? {});
        const rect = { x: num(rectRaw.x), y: num(rectRaw.y), width: num(rectRaw.width), height: num(rectRaw.height) };
        const id = String(identity.nodeId ?? record.node.nodeId);
        const fontSize = num(appearance.fontSize, 16);
        const lineHeightRaw = String(appearance.lineHeight ?? '');
        views.set(id, {
            id,
            role: semantics.role ?? 'unknown',
            tag: String(structure.tag ?? ''),
            text: String(semantics.textContent ?? ''),
            parentId: structure.parentNodeId ? String(structure.parentNodeId) : undefined,
            childIds: Array.isArray(structure.childNodeIds) ? structure.childNodeIds.map(String) : [],
            rect,
            area: Math.max(0, rect.width) * Math.max(0, rect.height),
            ownArea: 0,
            visible: responsive.visible !== false && rect.width > 0 && rect.height > 0,
            background: parseCssColor(appearance.backgroundColor),
            backgroundImage: String(appearance.backgroundImage ?? 'none'),
            colour: parseCssColor(appearance.color),
            fontSize,
            fontWeight: num(appearance.fontWeight, 400),
            lineHeight: lineHeightRaw === 'normal' ? fontSize * 1.2 : num(lineHeightRaw, fontSize * 1.2),
            fontFamily: String(appearance.fontFamily ?? '').trim(),
            radius: num(appearance.borderRadius),
            shadow: String(appearance.boxShadow ?? 'none'),
            border: String(appearance.border ?? ''),
            padding: String(layout.padding ?? ''),
            margin: String(layout.margin ?? ''),
            position: String(layout.position ?? 'static'),
            gap: num(layout.gapPx ?? layout.gap),
            display: String(layout.display ?? ''),
            gridTemplateColumns: String(layout.gridTemplateColumns ?? 'none'),
            accessibilityWarnings: Array.isArray(accessibility.warnings) ? accessibility.warnings.length : 0,
            focusable: behavior.focusable === true || accessibility.focusable === true,
            signature: String(structure.signature ?? ''),
        });
    }
    // Own area approximates painted area: a container covered by its children
    // paints little. Only children that actually paint occlude, weighted by their
    // alpha — a transparent section does not hide the page background behind it,
    // and treating it as if it did hands the palette to whichever nested element
    // happens to have a fill.
    for (const view of views.values()) {
        const occluded = view.childIds.reduce((total, childId) => {
            const child = views.get(childId);
            if (!child?.visible || !child.background || child.background.a <= 0)
                return total;
            return total + child.area * child.background.a;
        }, 0);
        view.ownArea = Math.max(0, view.area - occluded);
    }
    return [...views.values()];
}
/** Tags that are interactive regardless of what the semantic heuristic made of their copy. */
const ACTION_TAGS = new Set(['a', 'button', 'input', 'select', 'textarea', 'summary']);
/**
 * Whether a node represents a user action.
 *
 * Tag-first, because the scan's semantic role is a copy heuristic: a link
 * reading "Pricing" is 'unknown' while the identical element reading "Get
 * started" is 'cta'. For questions about where action colour belongs, the
 * element type is the reliable signal and the copy is not.
 */
function isActionNode(view) {
    return ACTION_TAGS.has(view.tag) || FROAM_ACTION_ROLES.includes(view.role) || view.focusable;
}
/**
 * Nearest ancestor with an opaque-enough background, flattened. Defaults to white.
 *
 * `certain` is false when a gradient or image sits anywhere in the resolved
 * stack. A computed style reports `backgroundImage` but not the pixels it
 * paints, so the true backdrop under that text is unknown.
 *
 * This matters more than it sounds. The first real site scanned reported 65 of
 * 160 text elements failing contrast, several at 1.01:1 — white text on a
 * gradient hero, where only the transparent `backgroundColor` was visible to
 * the resolver, so white was being compared against white. Reporting a
 * violation that cannot be substantiated is worse than reporting nothing:
 * it is the fastest way for an audit to lose a reader's trust.
 */
function effectiveBackground(view, byId) {
    const stack = [];
    let cursor = view;
    let guard = 0;
    let certain = true;
    while (cursor && guard++ < 64) {
        if (cursor.backgroundImage && cursor.backgroundImage !== 'none')
            certain = false;
        if (cursor.background && cursor.background.a > 0) {
            stack.push(cursor.background);
            if (cursor.background.a >= 1)
                break;
        }
        cursor = cursor.parentId ? byId.get(cursor.parentId) : undefined;
    }
    let result = { r: 1, g: 1, b: 1 };
    for (let index = stack.length - 1; index >= 0; index -= 1)
        result = flatten(stack[index], result);
    return { rgb: result, certain };
}
/**
 * Greedy perceptual clustering. Threshold is OKLab ΔE — below it, two values
 * are one design decision.
 *
 * Backgrounds cluster tighter than text on purpose. An elevation system is
 * built from 1–3% lightness steps: #ffffff against #fafafa is ΔE 0.0155, a
 * deliberate surface/raised distinction that a text-grade threshold would
 * silently average into one off-white. The same difference between two text
 * colours is invisible and should merge.
 */
export const OKLAB_MERGE_THRESHOLD = 0.035;
export const OKLAB_MERGE_THRESHOLD_BACKGROUND = 0.01;
function clusterColours(samples, threshold = OKLAB_MERGE_THRESHOLD, backgroundThreshold = OKLAB_MERGE_THRESHOLD_BACKGROUND) {
    const clusters = [];
    for (const sample of [...samples].sort((a, b) => b.weight - a.weight)) {
        const limit = sample.channel === 'background' ? backgroundThreshold : threshold;
        const match = clusters.find((cluster) => cluster.channel === sample.channel
            && Math.hypot(cluster.lab.L - sample.lab.L, cluster.lab.a - sample.lab.a, cluster.lab.b - sample.lab.b) <= limit);
        if (match) {
            const total = match.weight + sample.weight;
            match.lab = total > 0
                ? { L: (match.lab.L * match.weight + sample.lab.L * sample.weight) / total, a: (match.lab.a * match.weight + sample.lab.a * sample.weight) / total, b: (match.lab.b * match.weight + sample.lab.b * sample.weight) / total }
                : match.lab;
            match.weight = total;
            match.count += 1;
            match.roles.set(sample.role, (match.roles.get(sample.role) ?? 0) + 1);
        }
        else {
            clusters.push({ lab: sample.lab, weight: sample.weight, roles: new Map([[sample.role, 1]]), channel: sample.channel, count: 1 });
        }
    }
    return clusters.sort((a, b) => b.weight - a.weight);
}
/** Cluster numbers by relative tolerance, weighted by occurrence. */
function clusterNumbers(values, tolerance) {
    const clusters = [];
    for (const value of [...values].sort((a, b) => a - b)) {
        const match = clusters.find((cluster) => Math.abs(cluster.value - value) <= Math.max(0.5, cluster.value * tolerance));
        if (match) {
            match.value = (match.value * match.count + value) / (match.count + 1);
            match.count += 1;
        }
        else
            clusters.push({ value, count: 1 });
    }
    return clusters;
}
const median = (values) => {
    if (!values.length)
        return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const middle = sorted.length >> 1;
    return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
};
/**
 * Smallest value treated as layout spacing.
 *
 * A 1px padding is a hairline rule or an optical nudge, not a step in a spacing
 * system. Counting them is not harmless: across eighteen real sites the spacing
 * scale came back as [1,2,3,4,5] and every site resolved to a 4px base, because
 * sub-pixel noise outnumbered the actual 16/24/32px layout values. The grid was
 * being inferred from borders.
 */
export const FROAM_MIN_SPACING_PX = 2;
function parseLengths(value) {
    return value.split(/\s+/).map((part) => Number.parseFloat(part)).filter((part) => Number.isFinite(part) && part >= FROAM_MIN_SPACING_PX);
}
// ── section resolution ──────────────────────────────────────────────────────
/**
 * Landmark tags that *are* a section and are never exploded into their parts.
 *
 * `main` is deliberately absent. It is a container *of* sections, and treating
 * it as one is precisely why a real page reported two sections instead of eight:
 * the walk reached `<main>`, matched it as a landmark, stopped, and never looked
 * at the seven `<section>` elements inside it.
 */
const SECTION_TAGS = new Set(['section', 'header', 'footer', 'article', 'aside', 'nav']);
/** Container landmarks: never a section, always exploded. */
const BAND_TAGS = new Set(['main', 'body']);
/**
 * Out-of-flow positioning. These never partition anything, so they are neither
 * sections nor evidence against tiling — a fixed header and an absolutely
 * positioned background layer both overlap every section beneath them, which
 * would otherwise sink the tiling score and prevent any explosion at all.
 * `sticky` stays in flow and is not excluded.
 */
const OUT_OF_FLOW = new Set(['fixed', 'absolute']);
/** Sections are full-bleed relative to the document. */
const SECTION_MIN_WIDTH_SHARE = 0.55;
/** Below this share of document height a full-width block is content, not a section. */
const SECTION_MIN_HEIGHT_SHARE = 0.02;
const SECTION_MIN_HEIGHT_PX = 56;
/** More children than this is a list or a card grid, not a section stack. */
const SECTION_MAX_BAND_CHILDREN = 14;
const SECTION_MAX_DEPTH = 14;
/**
 * Find a page's sections.
 *
 * Real pages nest, and they do not nest uniformly. Beneath `<body>` sit a
 * framework mount, a theme provider and a layout shell before anything that
 * resembles a section; sections then appear at different depths, because a hero
 * might be a direct child of the shell while three feature blocks sit inside a
 * container and the footer is a sibling of all of it.
 *
 * Reading the direct children of any single parent therefore cannot work. The
 * first version of this walked down to one "section parent" and found a single
 * section on every real page, silently emptying the flow axis and with it three
 * of the six pretext tasks.
 *
 * What actually identifies a section stack is **vertical tiling**: sections
 * partition the height of what contains them, edge to edge, with little overlap.
 * That property survives arbitrary nesting, so this walks the tree deciding at
 * each node whether it *is* a section or is a band that should be exploded into
 * the sections beneath it.
 */
export function resolveSections(documentRoot, childrenOf) {
    if (!documentRoot)
        return [];
    const documentHeight = documentRoot.rect.height || 1;
    const documentWidth = documentRoot.rect.width || 1;
    const minHeight = Math.max(SECTION_MIN_HEIGHT_PX, documentHeight * SECTION_MIN_HEIGHT_SHARE);
    const qualifies = (view) => view.visible
        && !OUT_OF_FLOW.has(view.position)
        && view.rect.height >= minHeight
        && view.rect.width >= documentWidth * SECTION_MIN_WIDTH_SHARE;
    /** Collapse a wrapper chain: a node whose single qualifying child is essentially all of it. */
    const unwrap = (view) => {
        let cursor = view;
        for (let depth = 0; depth < SECTION_MAX_DEPTH; depth += 1) {
            if (SECTION_TAGS.has(cursor.tag))
                return cursor;
            const qualifying = childrenOf(cursor).filter(qualifies);
            if (qualifying.length !== 1)
                return cursor;
            const only = qualifying[0];
            if (only.rect.height < cursor.rect.height * 0.9)
                return cursor;
            cursor = only;
        }
        return cursor;
    };
    /**
     * How well a node lays its children out as a vertical sequence.
     *
     * Measured over *all* in-flow children, not just the ones large enough to be
     * sections. That distinction is the whole fix: linear.app interleaves its
     * sections with 1×1 spacers, hairline dividers and loose headings, so the
     * section-sized children covered only 64% of the parent. Tiling failed, the
     * container was not recognised as a stack, and the entire 9,394px wrapper was
     * emitted as one "hero" section.
     *
     * Tiling answers "is this a stack of things?"; qualification answers "which of
     * them are sections?". Conflating the two made a page's whole body a section.
     */
    const tiling = (view, children) => {
        if (children.length < 2)
            return 0;
        const ordered = [...children].sort((a, b) => a.rect.y - b.rect.y);
        const height = view.rect.height || 1;
        let covered = 0;
        let overlap = 0;
        let previousBottom = -Infinity;
        for (const child of ordered) {
            covered += child.rect.height;
            if (child.rect.y < previousBottom)
                overlap += Math.min(previousBottom - child.rect.y, child.rect.height);
            previousBottom = Math.max(previousBottom, child.rect.y + child.rect.height);
        }
        return Math.max(0, Math.min(1, covered / height) - overlap / height);
    };
    /** In-flow children, which are the ones that participate in a vertical stack. */
    const flowChildren = (view) => childrenOf(view).filter((child) => !OUT_OF_FLOW.has(child.position) && child.rect.height > 0);
    /** A section covering most of the document is a container that was not broken down. */
    const SECTION_MAX_DOCUMENT_SHARE = 0.8;
    const sections = [];
    const queue = [{ view: documentRoot, depth: 0 }];
    const seen = new Set();
    while (queue.length) {
        const { view, depth } = queue.shift();
        const resolved = unwrap(view);
        if (seen.has(resolved.id))
            continue;
        seen.add(resolved.id);
        const children = childrenOf(resolved).filter(qualifies);
        const tilesWell = tiling(resolved, flowChildren(resolved)) >= 0.7;
        // A landmark tag settles it: <section> is a section, however its insides
        // happen to be laid out. Everything else is a band only if its children
        // genuinely partition it and there are not so many that this is a list.
        const isBand = BAND_TAGS.has(resolved.tag)
            || (!SECTION_TAGS.has(resolved.tag)
                && children.length >= 2
                && children.length <= SECTION_MAX_BAND_CHILDREN
                && tilesWell
                && depth < SECTION_MAX_DEPTH);
        if (isBand || resolved === documentRoot) {
            // The document root is always a band — it is the page, not a section. If
            // its children do not tile it, fall through so a thin page still reports
            // whatever full-width blocks it has rather than nothing at all.
            if (children.length) {
                for (const child of children)
                    queue.push({ view: child, depth: depth + 1 });
                continue;
            }
            if (resolved === documentRoot)
                continue;
        }
        // Never emit a "section" that is most of the page. If it still has
        // qualifying children, descend into them regardless of how poorly they
        // tiled; a partial answer beats calling the whole body a hero.
        if (resolved.rect.height > documentHeight * SECTION_MAX_DOCUMENT_SHARE) {
            if (children.length && depth < SECTION_MAX_DEPTH) {
                for (const child of children)
                    queue.push({ view: child, depth: depth + 1 });
            }
            continue;
        }
        if (qualifies(resolved) && resolved !== documentRoot)
            sections.push(resolved);
    }
    return sections.sort((a, b) => a.rect.y - b.rect.y);
}
/** Below these an element is a nav link or a list row, not a card. */
const ITEM_MIN_WIDTH = 80;
const ITEM_MIN_HEIGHT = 60;
const ITEM_MAX_COUNT = 16;
/**
 * Find the strongest repeated-sibling group inside a section.
 *
 * This replaces counting `role === 'card'`, which came from scan.ts matching the
 * *class name* "card" or "tile". Across eighteen real sites that fired twice —
 * Stripe, Linear, Vercel and Tailwind all have obvious feature grids and none of
 * them name the class that way. Geometry does not care what the class is called:
 * three boxes of near-identical size sitting in a row is a grid, whatever the
 * markup calls them.
 */
export function detectItemGroup(section, childrenOf, isMedia) {
    let best = { count: 0, columns: 1, withMedia: 0, withHeading: 0 };
    const visit = (node, depth) => {
        if (depth > 5)
            return;
        const kids = childrenOf(node).filter((kid) => kid.rect.width >= ITEM_MIN_WIDTH && kid.rect.height >= ITEM_MIN_HEIGHT);
        if (kids.length >= 2) {
            const clusters = [];
            for (const kid of kids) {
                const match = clusters.find((cluster) => Math.abs(cluster.width - kid.rect.width) <= Math.max(8, cluster.width * 0.12)
                    && Math.abs(cluster.height - kid.rect.height) <= Math.max(12, cluster.height * 0.3));
                if (match)
                    match.items.push(kid);
                else
                    clusters.push({ width: kid.rect.width, height: kid.rect.height, items: [kid] });
            }
            for (const cluster of clusters) {
                if (cluster.items.length < 2 || cluster.items.length > ITEM_MAX_COUNT)
                    continue;
                if (cluster.items.length <= best.count)
                    continue;
                // Columns are how many items share a horizontal band, not a CSS property:
                // most real grids are flex, so gridTemplateColumns reads 'none'.
                const bands = new Map();
                for (const item of cluster.items) {
                    const band = Math.round(item.rect.y / 32);
                    bands.set(band, (bands.get(band) ?? 0) + 1);
                }
                const descendantsOf = (item, depthLimit = 3) => {
                    const out = [];
                    const walk = (view, level) => {
                        if (level > depthLimit)
                            return;
                        for (const child of childrenOf(view)) {
                            out.push(child);
                            walk(child, level + 1);
                        }
                    };
                    walk(item, 0);
                    return out;
                };
                best = {
                    count: cluster.items.length,
                    columns: Math.max(...bands.values()),
                    withMedia: cluster.items.filter((item) => descendantsOf(item).some(isMedia)).length,
                    withHeading: cluster.items.filter((item) => descendantsOf(item).some((view) => view.role === 'heading' || /^h[1-6]$/.test(view.tag))).length,
                };
            }
        }
        for (const kid of childrenOf(node))
            visit(kid, depth + 1);
    };
    visit(section, 0);
    return best;
}
/**
 * Money-shaped text, detected and counted — never retained.
 *
 * A price table is one of the few archetypes with an unmistakable signal, and a
 * boolean count of how many leaves looked like a price keeps the profile
 * derived-only. No copy crosses into the profile.
 */
const PRICE_PATTERN = /(^|\s)[$£€₦¥]\s?\d|\d\s?(usd|ngn|eur|gbp|jpy)\b|\/\s?(mo|month|yr|year|seat|user)\b|\bfree\b/i;
function classifySection(childRoles, input) {
    const has = (role) => childRoles.includes(role);
    const items = input.items;
    // The element's own tag is the strongest signal available and was previously
    // ignored entirely: a real `<footer>` came back as 'proof' because the check
    // looked for a footer role among its *children*, where it will never be.
    // Ordered by strength of evidence, most decisive first. A landmark tag or a
    // page's largest type is near-certain; a bare heading is a last resort.
    if (input.ownTag === 'footer')
        return { archetype: 'footer', confidence: 0.95 };
    if (input.ownTag === 'header' || input.ownTag === 'nav')
        return { archetype: 'unknown', confidence: 0 };
    if (input.index === input.total - 1 && input.linkDensity > 0.35)
        return { archetype: 'footer', confidence: 0.6 };
    // Owning the largest type on the page, at the top, is what a hero is.
    if (input.index === 0 && input.ownsLargestType && input.heightRatio > 0.1)
        return { archetype: 'hero', confidence: 0.8 };
    // Repeated items carrying money: a price table, whatever it is called.
    if (items.count >= 2 && input.priceLikeCount >= 2)
        return { archetype: 'pricing', confidence: 0.7 };
    // Disclosure widgets in a stack are an FAQ and essentially nothing else.
    if (input.disclosureCount >= 3)
        return { archetype: 'faq', confidence: 0.8 };
    // A logo strip: short, media-dense, and deliberately says nothing.
    if (!has('heading') && input.mediaShare > 0.06 && input.heightRatio < 0.12)
        return { archetype: 'proof', confidence: 0.65 };
    // Quotes: repeated items that carry a face and prose but no heading of their own.
    if (items.count >= 2 && items.withMedia >= items.count - 1 && items.withHeading === 0 && has('paragraph')) {
        return { archetype: 'testimonial', confidence: 0.55 };
    }
    if (items.count >= 3 && items.columns >= 2)
        return { archetype: 'feature-grid', confidence: 0.75 };
    if (items.count === 2 && items.columns === 2)
        return { archetype: 'split', confidence: 0.6 };
    // A stacked list of like items is still a feature list, just in one column.
    if (items.count >= 3 && has('heading'))
        return { archetype: 'feature-grid', confidence: 0.5 };
    if (input.hasForm || has('input'))
        return { archetype: 'cta', confidence: 0.65 };
    if ((has('cta') || has('button')) && input.heightRatio < 0.15 && items.count < 3)
        return { archetype: 'cta', confidence: 0.55 };
    // A heading over prose is the most common section on the web and deserves a
    // name. Reporting half of them as 'unknown' is not humility, it is a missing
    // label — and it starves every pretext task that reads archetypes.
    //
    // Deliberately structural rather than density-based. A first version gated on
    // characters per 1000px², which is an invented unit with an arbitrary cutoff:
    // it labelled a text-heavy real page correctly and left an identically shaped
    // sparse one unlabelled. What makes a content section is having a heading and
    // prose, not how much prose.
    if (has('heading') && has('paragraph'))
        return { archetype: 'content', confidence: 0.45 };
    if (has('heading'))
        return { archetype: 'content', confidence: 0.3 };
    return { archetype: 'unknown', confidence: 0 };
}
export function buildPageProfile(input) {
    const all = toNodeViews(input.records);
    const byId = new Map(all.map((view) => [view.id, view]));
    const rendered = all.filter((view) => view.visible);
    const capturedAt = input.capturedAt ?? (input.records[0]?.capturedAt ?? 0);
    // ── colour ────────────────────────────────────────────────────────────────
    // Backgrounds weight by own painted area; text weights by approximate ink.
    // Node counting would report a palette of whatever is most repeated rather
    // than whatever is most seen.
    const samples = [];
    let colourUsages = 0;
    const rawColours = new Set();
    for (const view of rendered) {
        if (view.background && view.background.a > 0 && view.ownArea > 0) {
            const backdrop = view.parentId ? effectiveBackground(byId.get(view.parentId) ?? view, byId).rgb : { r: 1, g: 1, b: 1 };
            const flat = flatten(view.background, backdrop);
            samples.push({ lab: rgbToOklab(flat), weight: view.ownArea * view.background.a, role: view.role, channel: 'background' });
            rawColours.add(toHex(flat));
            colourUsages += 1;
        }
        const leaf = view.childIds.length === 0;
        if (leaf && view.colour && view.colour.a > 0 && view.text.length > 0) {
            const flat = flatten(view.colour, effectiveBackground(view, byId).rgb);
            samples.push({ lab: rgbToOklab(flat), weight: view.text.length * view.fontSize, role: view.role, channel: 'text' });
            rawColours.add(toHex(flat));
            colourUsages += 1;
        }
    }
    const clusters = clusterColours(samples);
    const totalWeight = clusters.reduce((sum, cluster) => sum + cluster.weight, 0) || 1;
    const backgrounds = clusters.filter((cluster) => cluster.channel === 'background');
    const texts = clusters.filter((cluster) => cluster.channel === 'text');
    const surfaceCluster = backgrounds[0];
    const surfaceRgb = surfaceCluster ? oklabToRgb(surfaceCluster.lab) : { r: 1, g: 1, b: 1 };
    // Accent: chromatic, small, and landing on action roles. Chroma alone would
    // pick a large brand-coloured hero background.
    const accentCluster = clusters
        .filter((cluster) => oklabToOklch(cluster.lab).c >= 0.06 && cluster.weight / totalWeight < 0.25)
        .sort((a, b) => {
        const actionShare = (cluster) => [...cluster.roles].filter(([role]) => FROAM_ACTION_ROLES.includes(role)).reduce((sum, [, count]) => sum + count, 0) / Math.max(1, cluster.count);
        return (actionShare(b) - actionShare(a)) || (oklabToOklch(b.lab).c - oklabToOklch(a.lab).c);
    })[0];
    // Ink is the strongest voice on the page, not the most frequent one. Picking
    // the heaviest text cluster hands the role to whichever grey there is most
    // of: a page with one black headline and paragraphs of #9a9a9a would report
    // the failing grey as its ink and the headline as an outlier. Contrast
    // against the surface is the right discriminator, with a weight floor so a
    // single stray label cannot claim the role.
    const INK_WEIGHT_FLOOR = 0.05;
    const textWeightTotal = texts.reduce((sum, cluster) => sum + cluster.weight, 0) || 1;
    const inkCandidates = texts.filter((cluster) => cluster.weight / textWeightTotal >= INK_WEIGHT_FLOOR);
    const inkCluster = (inkCandidates.length ? inkCandidates : texts)
        .map((cluster) => ({ cluster, contrast: contrastRatio(oklabToRgb(cluster.lab), surfaceRgb) }))
        .sort((a, b) => b.contrast - a.contrast)[0]?.cluster;
    const surfaceLightness = surfaceCluster ? surfaceCluster.lab.L : 1;
    const inkDarkerThanSurface = inkCluster ? inkCluster.lab.L < surfaceLightness : true;
    const palette = clusters.map((cluster) => {
        const oklch = oklabToOklch(cluster.lab);
        let role = 'other';
        if (cluster === surfaceCluster)
            role = 'surface';
        else if (cluster === accentCluster)
            role = 'accent';
        else if (cluster === inkCluster)
            role = 'ink';
        else if (cluster.channel === 'background')
            role = 'raised';
        // Text painted in the accent colour is the accent — a link, typically.
        // Because clustering is per-channel, the same hue arrives twice: once as a
        // button background and once as link text. Labelling the second one 'muted'
        // put the identical hex in the palette under two contradictory roles, and
        // the design brief then told a model that #3366cc was both the quiet colour
        // and the loud one.
        else if (cluster.channel === 'text' && accentCluster
            && Math.hypot(cluster.lab.L - accentCluster.lab.L, cluster.lab.a - accentCluster.lab.a, cluster.lab.b - accentCluster.lab.b) <= OKLAB_MERGE_THRESHOLD) {
            role = 'accent';
        }
        // Muted means quieter than ink, which requires sitting *between* surface and
        // ink — not merely on the same side of the surface. Wikipedia exposed the
        // difference: its dominant readable text is #54595d, correctly chosen as ink,
        // but the darker #202122 used on the wordmark then came back as 'muted'
        // despite being the strongest text on the page. Anything at or beyond ink is
        // ink; anything past the surface is inverse text on a dark panel.
        else if (cluster.channel === 'text') {
            if (!inkCluster)
                role = 'muted';
            else {
                const beyondSurface = inkDarkerThanSurface ? cluster.lab.L >= surfaceLightness : cluster.lab.L <= surfaceLightness;
                const atLeastAsStrongAsInk = inkDarkerThanSurface ? cluster.lab.L <= inkCluster.lab.L : cluster.lab.L >= inkCluster.lab.L;
                role = beyondSurface ? 'other' : atLeastAsStrongAsInk ? 'ink' : 'muted';
            }
        }
        return {
            oklch,
            hex: oklchToHex(oklch),
            areaShare: cluster.weight / totalWeight,
            role,
            appearsOn: [...cluster.roles.keys()],
            channel: cluster.channel,
            nodeCount: cluster.count,
        };
    });
    // Accent discipline is measured over the nodes that actually carry the colour,
    // with action-ness decided by tag as well as role.
    //
    // The first live scan exposed why. scan.ts only promotes an <a> to 'cta' when
    // its copy matches buy/start/join/sign-up, so an ordinary link is 'unknown' —
    // and on a page whose accent *is* its link colour, counting roles alone
    // reported perfect discipline as 0%. Any site with a conventional link colour
    // would have been scored wrong.
    // Clustering runs per channel, so one design token arrives twice when it is
    // used as both a fill and a text colour — a link colour that is also a button
    // background. Wikipedia listed "#3366cc accent, #3366cc accent" twice over.
    // Merge perceptual duplicates that resolved to the same role: it is one
    // decision, and the palette should say so once.
    const mergedPalette = [];
    for (const entry of palette) {
        const twin = mergedPalette.find((candidate) => candidate.role === entry.role
            && Math.hypot(rgbToOklab(oklabToRgb(oklchToOklab(candidate.oklch))).L - rgbToOklab(oklabToRgb(oklchToOklab(entry.oklch))).L, candidate.oklch.c * Math.cos(candidate.oklch.h * Math.PI / 180) - entry.oklch.c * Math.cos(entry.oklch.h * Math.PI / 180), candidate.oklch.c * Math.sin(candidate.oklch.h * Math.PI / 180) - entry.oklch.c * Math.sin(entry.oklch.h * Math.PI / 180)) <= OKLAB_MERGE_THRESHOLD);
        if (!twin) {
            mergedPalette.push({ ...entry });
            continue;
        }
        twin.areaShare = Math.round((twin.areaShare + entry.areaShare) * 10000) / 10000;
        twin.nodeCount += entry.nodeCount;
        twin.appearsOn = [...new Set([...twin.appearsOn, ...entry.appearsOn])];
    }
    const accentNodesFound = [];
    if (accentCluster) {
        for (const view of rendered) {
            const candidates = [];
            if (view.background && view.background.a > 0 && view.ownArea > 0)
                candidates.push({ colour: view.background, channel: 'background' });
            if (view.childIds.length === 0 && view.colour && view.colour.a > 0 && view.text.length > 0)
                candidates.push({ colour: view.colour, channel: 'text' });
            for (const candidate of candidates) {
                if (candidate.channel !== accentCluster.channel)
                    continue;
                const backdrop = candidate.channel === 'background' && view.parentId
                    ? effectiveBackground(byId.get(view.parentId) ?? view, byId).rgb
                    : effectiveBackground(view, byId).rgb;
                const lab = rgbToOklab(flatten(candidate.colour, backdrop));
                const distance = Math.hypot(lab.L - accentCluster.lab.L, lab.a - accentCluster.lab.a, lab.b - accentCluster.lab.b);
                const limit = accentCluster.channel === 'background' ? OKLAB_MERGE_THRESHOLD_BACKGROUND : OKLAB_MERGE_THRESHOLD;
                if (distance <= limit) {
                    accentNodesFound.push(view);
                    break;
                }
            }
        }
    }
    const accentActionNodes = accentNodesFound.filter((view) => isActionNode(view)).length;
    const accentDiscipline = accentNodesFound.length > 0 ? accentActionNodes / accentNodesFound.length : 1;
    const contrastFailures = [];
    let contrastFloor = Infinity;
    let contrastSamples = 0;
    let contrastUnmeasurable = 0;
    for (const view of rendered) {
        if (view.childIds.length > 0 || !view.colour || view.colour.a <= 0 || !view.text.trim())
            continue;
        const resolved = effectiveBackground(view, byId);
        if (!resolved.certain) {
            contrastUnmeasurable += 1;
            continue;
        }
        const background = resolved.rgb;
        const ratio = contrastRatio(flatten(view.colour, background), background);
        const required = contrastRequirement(view.fontSize, view.fontWeight);
        contrastSamples += 1;
        contrastFloor = Math.min(contrastFloor, ratio);
        if (ratio < required)
            contrastFailures.push({ nodeId: view.id, ratio: Math.round(ratio * 100) / 100, required, largeText: required === 3, role: view.role });
    }
    // Mode is a property of the surfaces a page is built on, so only backgrounds
    // carrying real area vote. Every accent is dark or light relative to its
    // surface; letting a 4%-area button count would report a white page with a
    // red CTA as mixed-mode.
    const surfaceLuminance = relativeLuminance(surfaceRgb);
    const MODE_AREA_FLOOR = 0.15;
    const backgroundLuminances = backgrounds
        .filter((cluster) => cluster.weight / totalWeight >= MODE_AREA_FLOOR)
        .slice(0, 4)
        .map((cluster) => relativeLuminance(oklabToRgb(cluster.lab)));
    const modeSignal = backgroundLuminances.length > 1 && backgroundLuminances.some((value) => value > 0.5) && backgroundLuminances.some((value) => value <= 0.5)
        ? 'mixed'
        : surfaceLuminance > 0.5 ? 'light' : 'dark';
    // ── type ──────────────────────────────────────────────────────────────────
    // Text below 10px is an icon glyph, a screen-reader-only label or decoration —
    // never a step in a type scale. A real page reported 6px and 8px as its two
    // smallest "scale steps", which made a 17-step scale out of a 15-step one and
    // buried the actual progression. Excluded from the scale and the measure, but
    // counted and surfaced as a finding rather than quietly dropped: text that
    // small is itself worth knowing about.
    const allTextNodes = rendered.filter((view) => view.childIds.length === 0 && view.text.trim().length > 0);
    const textNodes = allTextNodes.filter((view) => view.fontSize >= FROAM_MIN_TYPE_PX);
    const belowMinimumSizes = allTextNodes.length - textNodes.length;
    const sizeClusters = clusterNumbers(textNodes.map((view) => view.fontSize), 0.04).sort((a, b) => a.value - b.value);
    const scale = sizeClusters.map((cluster) => {
        const members = textNodes.filter((view) => Math.abs(view.fontSize - cluster.value) <= Math.max(0.5, cluster.value * 0.04));
        return {
            px: Math.round(cluster.value * 100) / 100,
            weight: Math.round(median(members.map((view) => view.fontWeight))),
            lineHeight: Math.round(median(members.map((view) => view.lineHeight)) * 100) / 100,
            usedBy: [...new Set(members.map((view) => view.role))],
            count: cluster.count,
        };
    });
    const consecutiveRatios = scale.slice(1).map((step, index) => step.px / scale[index].px).filter((ratio) => Number.isFinite(ratio) && ratio > 1);
    const ratioMedian = consecutiveRatios.length ? median(consecutiveRatios) : null;
    const ratioSpread = consecutiveRatios.length > 1
        ? Math.sqrt(consecutiveRatios.reduce((sum, ratio) => sum + (ratio - (ratioMedian ?? 0)) ** 2, 0) / consecutiveRatios.length)
        : 0;
    // A "scale" whose steps disagree wildly is not a scale. Report null rather than a mean of noise.
    const ratio = ratioMedian !== null && ratioSpread <= 0.25 ? Math.round(ratioMedian * 1000) / 1000 : null;
    const familyWeights = new Map();
    for (const view of textNodes)
        if (view.fontFamily)
            familyWeights.set(view.fontFamily, (familyWeights.get(view.fontFamily) ?? 0) + view.text.length * view.fontSize);
    const familyTotal = [...familyWeights.values()].reduce((sum, value) => sum + value, 0) || 1;
    const displayRoles = ['heading', 'hero'];
    const families = [...familyWeights].sort((a, b) => b[1] - a[1]).map(([stack, weight]) => {
        const members = textNodes.filter((view) => view.fontFamily === stack);
        const displayShare = members.filter((view) => displayRoles.includes(view.role)).length / Math.max(1, members.length);
        const role = /mono|courier|consolas/i.test(stack) ? 'mono' : displayShare > 0.5 ? 'display' : 'body';
        return { stack, role, areaShare: weight / familyTotal };
    });
    // Measure describes running text only. Including short unclassified nodes
    // pulls the median toward the width of a footer link — a 1100px paragraph
    // and two 60px labels report as "11 characters per line", which is both
    // wrong and confidently stated.
    const MEASURE_MIN_CHARS = 40;
    const bodyNodes = textNodes.filter((view) => view.role === 'paragraph' && view.text.length >= MEASURE_MIN_CHARS);
    // 0.5em is the conventional average glyph advance for proportional Latin text.
    const measureCh = bodyNodes.length ? Math.round(median(bodyNodes.map((view) => view.rect.width / Math.max(1, view.fontSize * 0.5)))) : 0;
    // ── space ─────────────────────────────────────────────────────────────────
    const spacingValues = [];
    for (const view of rendered) {
        spacingValues.push(...parseLengths(view.padding), ...parseLengths(view.margin));
        if (view.gap > 0)
            spacingValues.push(view.gap);
    }
    const candidateBases = [8, 4, 6, 10, 5, 12, 3];
    const scored = candidateBases.map((base) => ({
        base,
        adherence: spacingValues.length ? spacingValues.filter((value) => Math.abs(value / base - Math.round(value / base)) * base <= 0.5).length / spacingValues.length : 0,
    }));
    // Prefer the coarsest base that explains the data: 4 always beats 8 numerically
    // because every multiple of 8 is a multiple of 4.
    const best = scored.reduce((winner, candidate) => candidate.adherence > winner.adherence + 0.02 || (Math.abs(candidate.adherence - winner.adherence) <= 0.02 && candidate.base > winner.base) ? candidate : winner, scored[0]);
    const spacingScale = clusterNumbers(spacingValues, 0.05).filter((cluster) => cluster.count > 1).map((cluster) => Math.round(cluster.value * 10) / 10).sort((a, b) => a - b);
    // ── surfaces ──────────────────────────────────────────────────────────────
    const radii = clusterNumbers(rendered.map((view) => view.radius).filter((value) => value > 0), 0.1).map((cluster) => Math.round(cluster.value * 10) / 10).sort((a, b) => a - b);
    const shadowTiers = new Set(rendered.map((view) => view.shadow).filter((shadow) => shadow && shadow !== 'none')).size;
    const borderWeights = [...new Set(rendered.map((view) => Number.parseFloat(view.border)).filter((value) => Number.isFinite(value) && value > 0))].sort((a, b) => a - b);
    // ── interaction ───────────────────────────────────────────────────────────
    // WCAG 2.5.8 AA constrains the shortest side of a target to 24 CSS px. The
    // standard exempts targets sitting inside a sentence, so an inline link in a
    // paragraph is measured, exempted and counted rather than silently skipped —
    // a check that quietly drops its hard cases reports a cleaner page than exists.
    const undersizedTargets = [];
    const targets = rendered.filter((view) => isActionNode(view));
    let exemptInlineTargets = 0;
    let exemptSpacedTargets = 0;
    let smallestTargetPx = Infinity;
    const measured = [];
    for (const view of targets) {
        const parent = view.parentId ? byId.get(view.parentId) : undefined;
        // The standard's inline exception covers a target "in a sentence". Any
        // text-bearing ancestor whose copy exceeds the link's own qualifies; the
        // earlier paragraph-only test missed links inside headings and list items,
        // which is most of the real web.
        const inlineInProse = view.tag === 'a' && Boolean(parent) && parent.text.length > view.text.length + 8 && view.text.length > 0;
        if (inlineInProse) {
            exemptInlineTargets += 1;
            continue;
        }
        measured.push(view);
        smallestTargetPx = Math.min(smallestTargetPx, Math.min(view.rect.width, view.rect.height));
    }
    // WCAG 2.5.8's spacing exception: an undersized target passes when a 24px
    // circle centred on it does not touch another target's circle. Without this,
    // every ordinary navigation bar reports as a pile of violations — a check
    // that fires on well-built pages is one nobody reads twice.
    const centreOf = (view) => ({ x: view.rect.x + view.rect.width / 2, y: view.rect.y + view.rect.height / 2 });
    for (const view of measured) {
        const shortestSide = Math.min(view.rect.width, view.rect.height);
        if (shortestSide >= FROAM_MIN_TARGET_PX)
            continue;
        const centre = centreOf(view);
        const crowded = measured.some((other) => {
            if (other === view)
                return false;
            const otherCentre = centreOf(other);
            return Math.hypot(centre.x - otherCentre.x, centre.y - otherCentre.y) < FROAM_MIN_TARGET_PX;
        });
        if (!crowded) {
            exemptSpacedTargets += 1;
            continue;
        }
        undersizedTargets.push({
            nodeId: view.id,
            role: view.role,
            tag: view.tag,
            width: Math.round(view.rect.width * 10) / 10,
            height: Math.round(view.rect.height * 10) / 10,
            shortestSide: Math.round(shortestSide * 10) / 10,
        });
    }
    const targetSamples = measured.length;
    // ── flow ──────────────────────────────────────────────────────────────────
    const documentRoot = rendered.filter((view) => !view.parentId || !byId.has(view.parentId)).sort((a, b) => b.area - a.area)[0]
        ?? rendered.sort((a, b) => b.area - a.area)[0];
    const childrenOf = (view) => view.childIds.map((id) => byId.get(id)).filter((child) => Boolean(child?.visible));
    const sectionNodes = resolveSections(documentRoot, childrenOf);
    const rootHeight = documentRoot?.rect.height || 1;
    const rootWidth = documentRoot?.rect.width || 1;
    const isMediaNode = (view) => view.role === 'media' || ['img', 'picture', 'video', 'svg', 'canvas'].includes(view.tag);
    const pageMaxFontSize = rendered.reduce((max, view) => view.text.trim() ? Math.max(max, view.fontSize) : max, 0);
    const sections = sectionNodes.map((section, index) => {
        const descendants = [];
        const walk = (view, depth) => {
            if (depth > 6)
                return;
            for (const childId of view.childIds) {
                const child = byId.get(childId);
                if (!child?.visible)
                    continue;
                descendants.push(child);
                walk(child, depth + 1);
            }
        };
        walk(section, 0);
        const childRoles = [...new Set(descendants.map((view) => view.role).filter((role) => role !== 'unknown'))];
        const columns = section.gridTemplateColumns !== 'none' && section.gridTemplateColumns
            ? section.gridTemplateColumns.trim().split(/\s+/).length
            : new Set(section.childIds.map((id) => byId.get(id)).filter((view) => view?.visible).map((view) => Math.round(view.rect.y / 8))).size === 1
                ? section.childIds.filter((id) => byId.get(id)?.visible).length
                : 1;
        const linkDensity = descendants.length ? descendants.filter((view) => view.tag === 'a').length / descendants.length : 0;
        const items = detectItemGroup(section, childrenOf, isMediaNode);
        const sectionArea = Math.max(1, section.rect.width * section.rect.height);
        const mediaShare = descendants.filter(isMediaNode).reduce((sum, view) => sum + view.rect.width * view.rect.height, 0) / sectionArea;
        const sectionMaxFont = descendants.reduce((max, view) => view.text.trim() ? Math.max(max, view.fontSize) : max, 0);
        const priceLikeCount = descendants.filter((view) => view.childIds.length === 0 && PRICE_PATTERN.test(view.text)).length;
        const disclosureCount = descendants.filter((view) => view.tag === 'details' || view.tag === 'summary').length;
        const classification = classifySection(childRoles, {
            index, total: sectionNodes.length, columns,
            heightRatio: section.rect.height / rootHeight,
            hasForm: descendants.some((view) => view.role === 'form'),
            linkDensity,
            ownTag: section.tag,
            items,
            mediaShare,
            // "Largest type on the page" has to be resolved page-wide, not per section:
            // a section holding 48px text is only a hero if nothing else is bigger.
            ownsLargestType: pageMaxFontSize > 0 && sectionMaxFont >= pageMaxFontSize - 0.5,
            priceLikeCount,
            disclosureCount,
        });
        return {
            index,
            archetype: classification.archetype,
            confidence: classification.confidence,
            // Report the column count that the classification was actually made on.
            // Reporting the CSS-derived one instead produced "feature-grid:30" for a
            // group capped at sixteen items — a number from one metric printed beside
            // a label from another.
            grid: { columns: items.count >= 2 ? items.columns : columns, gapPx: section.gap, maxWidthPx: Math.round(section.rect.width) },
            heightRatio: Math.round((section.rect.height / rootHeight) * 1000) / 1000,
            childRoles,
        };
    });
    const sectionGapPx = sections.slice(1).map((section, index) => {
        const current = sectionNodes[index + 1], previous = sectionNodes[index];
        return Math.round(current.rect.y - (previous.rect.y + previous.rect.height));
    }).filter((gap) => gap >= 0);
    // Density is the median of the padding values a page actually uses, in pixels.
    //
    // It was total padding divided by every rendered node, which works on a
    // sixteen-node fixture and collapses on a real page: most of two thousand
    // nodes carry no padding at all, so the average drags toward zero regardless
    // of how generous the layout is. Fifteen of eighteen real sites came back
    // 'tight', including Stripe, Linear, Vercel and Tailwind — and because
    // density is a prior scope, that single miscalibration was conditioning half
    // the induced priors on a fiction.
    // Measured over layout containers only — nodes with element children that span
    // a meaningful share of the page. Padding on a button or a chip is component
    // detail; "airy" is a statement about the space between blocks of content.
    //
    // The median over every padded node made 'airy' unreachable, because buttons
    // and chips outnumber containers on every real page and drag the median to
    // component scale. A prior scope with a bucket that can never fire wastes a
    // conditioning dimension.
    const documentWidthForDensity = rendered.reduce((max, view) => Math.max(max, view.rect.width), 1);
    const containerPadding = rendered
        .filter((view) => view.childIds.length > 0 && view.rect.width >= documentWidthForDensity * 0.3)
        .flatMap((view) => parseLengths(view.padding));
    const paddingValues = containerPadding.length ? containerPadding : rendered.flatMap((view) => parseLengths(view.padding));
    const medianPadding = median(paddingValues);
    const density = !paddingValues.length ? 'balanced'
        : medianPadding < 16 ? 'tight' : medianPadding > 40 ? 'airy' : 'balanced';
    // ── components ────────────────────────────────────────────────────────────
    const signatureGroups = new Map();
    for (const view of rendered) {
        if (!view.signature)
            continue;
        signatureGroups.set(view.signature, [...(signatureGroups.get(view.signature) ?? []), view]);
    }
    const components = [...signatureGroups.entries()]
        .filter(([, members]) => members.length >= 2)
        .map(([signatureKey, members]) => {
        // Variance: how much instances of the same structure disagree on padding.
        const paddings = members.map((view) => parseLengths(view.padding).reduce((sum, value) => sum + value, 0));
        const mean = paddings.reduce((sum, value) => sum + value, 0) / Math.max(1, paddings.length);
        const deviation = mean > 0 ? Math.sqrt(paddings.reduce((sum, value) => sum + (value - mean) ** 2, 0) / paddings.length) / mean : 0;
        return { signature: signatureKey, role: members[0].role, instances: members.length, variance: Math.round(Math.min(1, deviation) * 1000) / 1000 };
    })
        .sort((a, b) => b.instances - a.instances);
    // ── quality ───────────────────────────────────────────────────────────────
    const paletteSize = Math.min(palette.length, 8);
    const inPaletteWeight = palette.slice(0, paletteSize).reduce((sum, entry) => sum + entry.areaShare, 0);
    const tokenDrift = Math.round(Math.max(0, 1 - inPaletteWeight) * 1000) / 1000;
    const spacingDrift = Math.round((1 - best.adherence) * 1000) / 1000;
    return {
        schemaVersion: FROAM_PAGE_PROFILE_SCHEMA_VERSION,
        origin: input.origin,
        routeKey: input.routeKey,
        capturedAt,
        viewport: input.viewport,
        color: {
            palette: mergedPalette,
            accentDiscipline: Math.round(accentDiscipline * 1000) / 1000,
            contrastFloor: Number.isFinite(contrastFloor) ? Math.round(contrastFloor * 100) / 100 : Infinity,
            contrastFailures,
            contrastSamples,
            contrastUnmeasurable,
            modeSignal,
        },
        type: { families, scale, ratio, ratioSpread: Math.round(ratioSpread * 1000) / 1000, belowMinimumSizes, measureCh },
        space: {
            base: best.base,
            scale: spacingScale,
            adherence: Math.round(best.adherence * 1000) / 1000,
            sectionGapPx,
            density,
        },
        surface: { radii, shadowTiers, borderWeights },
        interaction: {
            targetSamples,
            undersizedTargets,
            smallestTargetPx: Number.isFinite(smallestTargetPx) ? Math.round(smallestTargetPx * 10) / 10 : Infinity,
            exemptInlineTargets,
            exemptSpacedTargets,
        },
        flow: { sections, signature: sections.map((section) => section.archetype === 'feature-grid' ? `feature-grid:${section.grid.columns}` : section.archetype).join('>') },
        components,
        quality: {
            tokenDrift,
            spacingDrift,
            accessibilityWarnings: rendered.reduce((sum, view) => sum + view.accessibilityWarnings, 0),
            uniqueColors: rawColours.size,
            uniqueSizes: sizeClusters.length,
        },
        provenance: {
            derivedOnly: true,
            sourceCaptured: false,
            copyCaptured: false,
            assetsCaptured: false,
            nodesObserved: all.length,
            nodesRendered: rendered.length,
            coverage: all.length ? Math.round((rendered.length / all.length) * 1000) / 1000 : 0,
        },
    };
}
//# sourceMappingURL=page-profile.js.map