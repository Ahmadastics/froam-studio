/**
 * Make the page believe it's on a phone or tablet — without leaving the page.
 *
 * The browser evaluates CSS media queries, viewport units and matchMedia()
 * against the real window, so a 390px-wide frame on a 1440px screen still
 * gets the desktop layout. While a device preview is on, this answers those
 * questions for the device instead:
 *
 * - every @media rule (and <link media>, <style media>, @import media) that
 *   asks about width, height, aspect ratio, orientation, hover or pointer is
 *   evaluated for the device and switched to `all` or `not all`;
 * - vw / vh (and dvh, svh, lvh, vmin, vmax) in the page's rules become the
 *   device's pixels;
 * - window.matchMedia() answers width/height/hover/pointer queries for the
 *   device, so a script's "is this mobile?" agrees with its CSS.
 *
 * Froam's own styles are left alone — the editor around the preview keeps
 * its real layout — and everything is put back exactly on restore.
 */
const nativeMatchMediaFn = typeof window !== 'undefined' && typeof window.matchMedia === 'function' ? window.matchMedia.bind(window) : null;
/** The browser's own matchMedia — what the editor uses for its own layout, preview or not. */
export function nativeMatchMedia(query) {
    return nativeMatchMediaFn ? nativeMatchMediaFn(query) : null;
}
const matchesDescriptor = typeof MediaQueryList === 'undefined' ? undefined : Object.getOwnPropertyDescriptor(MediaQueryList.prototype, 'matches');
/** A list's real answer, even while a preview answers for the device. */
export function nativeMediaMatches(list) {
    if (!list)
        return false;
    return matchesDescriptor?.get ? Boolean(matchesDescriptor.get.call(list)) : list.matches;
}
const VIEWPORT_FEATURE = /(?:^|[\s(,])(?:(?:min|max)-)?(?:device-)?(?:width|height|aspect-ratio)\b|\borientation\b|\b(?:any-)?(?:hover|pointer)\b/i;
/** Whether a media query depends on the viewport (and so needs the device's answer). */
export function isViewportQuery(text) {
    return VIEWPORT_FEATURE.test(text);
}
function lengthPx(raw) {
    const match = /^(-?\d*\.?\d+)(px|em|rem)?$/i.exec(raw.trim());
    if (!match)
        return null;
    const n = Number.parseFloat(match[1]);
    return (match[2] ?? 'px').toLowerCase() === 'px' ? n : n * 16;
}
function ratioValue(raw) {
    const match = /^(\d*\.?\d+)\s*(?:\/\s*(\d*\.?\d+))?$/.exec(raw.trim());
    if (!match)
        return null;
    return Number.parseFloat(match[1]) / (match[2] ? Number.parseFloat(match[2]) : 1);
}
const MEASURE = /^(?:device-)?(width|height|aspect-ratio)$/;
function measureOf(name, size) {
    const kind = MEASURE.exec(name)?.[1];
    if (!kind)
        return null;
    return kind === 'width' ? size.width : kind === 'height' ? size.height : size.width / size.height;
}
function valueFor(name, raw) {
    return /aspect-ratio/.test(name) ? ratioValue(raw) : lengthPx(raw);
}
function compare(a, op, b) {
    if (op === '<')
        return a < b;
    if (op === '<=')
        return a <= b;
    if (op === '>')
        return a > b;
    if (op === '>=')
        return a >= b;
    return Math.abs(a - b) < 0.5;
}
/**
 * One feature, without its parentheses. `undefined`: not a viewport feature
 * (the browser answers it); `null`: a viewport feature we can't read.
 */
export function evaluateFeature(expression, size) {
    const e = expression.trim().toLowerCase();
    if (!e.includes(':') && /[<>=]/.test(e)) {
        // Range syntax: (width >= 600px), (400px <= width < 700px)
        const parts = e.split(/\s*(<=|>=|<|>|=)\s*/);
        if (parts.length === 3) {
            const [a, op, b] = parts;
            if (MEASURE.test(a)) {
                const v = valueFor(a, b);
                return v === null ? null : compare(measureOf(a, size), op, v);
            }
            if (MEASURE.test(b)) {
                const v = valueFor(b, a);
                return v === null ? null : compare(v, op, measureOf(b, size));
            }
            return undefined;
        }
        if (parts.length === 5 && MEASURE.test(parts[2])) {
            const [a, op1, name, op2, b] = parts;
            const low = valueFor(name, a);
            const high = valueFor(name, b);
            if (low === null || high === null)
                return null;
            const m = measureOf(name, size);
            return compare(low, op1, m) && compare(m, op2, high);
        }
        return undefined;
    }
    const at = e.indexOf(':');
    const name = (at < 0 ? e : e.slice(0, at)).trim();
    const raw = at < 0 ? undefined : e.slice(at + 1).trim();
    if (name === 'orientation')
        return raw === undefined ? true : (raw === 'portrait') === (size.height >= size.width);
    if (name === 'hover' || name === 'any-hover')
        return raw === undefined ? !size.touch : (raw === 'hover') === !size.touch;
    if (name === 'pointer' || name === 'any-pointer')
        return raw === undefined ? true : raw === 'none' ? false : (raw === 'coarse') === size.touch;
    const bounded = /^(min-|max-)?((?:device-)?(?:width|height|aspect-ratio))$/.exec(name);
    if (!bounded)
        return undefined;
    const measure = measureOf(bounded[2], size);
    if (raw === undefined)
        return measure > 0;
    const v = valueFor(bounded[2], raw);
    if (v === null)
        return null;
    if (bounded[1] === 'min-')
        return measure >= v;
    if (bounded[1] === 'max-')
        return measure <= v;
    return Math.abs(measure - v) < 0.5;
}
/** Split on a separator that isn't inside parentheses. */
function splitTopLevel(text, separator) {
    const out = [];
    let depth = 0;
    let start = 0;
    for (let i = 0; i < text.length; i += 1) {
        const ch = text[i];
        if (ch === '(')
            depth += 1;
        else if (ch === ')')
            depth -= 1;
        else if (depth === 0) {
            separator.lastIndex = i;
            const hit = separator.exec(text);
            if (hit && hit.index === i) {
                out.push(text.slice(start, i));
                start = i + hit[0].length;
                i = start - 1;
            }
        }
    }
    out.push(text.slice(start));
    return out.map((part) => part.trim()).filter(Boolean);
}
function evaluateCondition(condition, size) {
    const c = condition.trim();
    if (/^not\s*\(/i.test(c)) {
        const inner = evaluateCondition(c.replace(/^not\s*/i, ''), size);
        return inner === null ? null : !inner;
    }
    const ors = splitTopLevel(c, / or /giy);
    if (ors.length > 1) {
        let any = false;
        for (const part of ors) {
            const r = evaluateCondition(part, size);
            if (r === null)
                return null;
            if (r)
                any = true;
        }
        return any;
    }
    const ands = splitTopLevel(c, / and /giy);
    let all = true;
    for (const part of ands) {
        let r;
        if (part.startsWith('(') && part.endsWith(')')) {
            const inner = part.slice(1, -1).trim();
            r = /^\(|\bor\b|\band\b|^not\b/i.test(inner) ? evaluateCondition(inner, size) : evaluateFeature(inner, size);
            if (r === undefined)
                r = nativeMatchMedia(part)?.matches ?? true;
        }
        else {
            const type = part.toLowerCase();
            r = type === 'all' || type === 'screen' ? true : type === 'print' ? false : (nativeMatchMedia(type)?.matches ?? false);
        }
        if (r === null)
            return null;
        all = all && r;
    }
    return all;
}
/** A whole media list for the device: `null` when it can't be read (then it's left alone). */
export function evaluateMediaList(text, size) {
    const queries = splitTopLevel(text, /,/gy);
    if (!queries.length)
        return true;
    let any = false;
    for (const raw of queries) {
        let query = raw.trim();
        let negate = false;
        if (/^not\s+/i.test(query) && !/^not\s*\(/i.test(query)) {
            negate = true;
            query = query.replace(/^not\s+/i, '');
        }
        else if (/^only\s+/i.test(query))
            query = query.replace(/^only\s+/i, '');
        const r = evaluateCondition(query, size);
        if (r === null)
            return null;
        if (negate ? !r : r)
            any = true;
    }
    return any;
}
const VIEWPORT_UNIT = /(-?\d*\.?\d+)(dvh|svh|lvh|vh|dvw|svw|lvw|vw|vmin|vmax)\b/gi;
/** "100vh" → "844px" for the device; anything without viewport units comes back unchanged. */
export function resolveViewportUnits(value, size) {
    return value.replace(VIEWPORT_UNIT, (_, n, unit) => {
        const u = unit.toLowerCase();
        const base = u.endsWith('vh') ? size.height : u.endsWith('vw') ? size.width : u === 'vmin' ? Math.min(size.width, size.height) : Math.max(size.width, size.height);
        return `${Math.round(Number.parseFloat(n) * base) / 100}px`;
    });
}
/** Froam's own rules: the editor keeps its real layout around the preview. */
const EDITOR_SELECTOR = /froam|chef|(?:^|[\s.,>+~(])fs-|\.fsp-/i;
function mentionsEditor(rule) {
    if (rule instanceof CSSStyleRule && EDITOR_SELECTOR.test(rule.selectorText))
        return true;
    const nested = rule.cssRules;
    if (nested)
        for (const child of Array.from(nested))
            if (mentionsEditor(child))
                return true;
    return false;
}
function isEditorSheet(sheet) {
    const owner = sheet.ownerNode;
    if (!owner)
        return false;
    if (owner.id === 'froam-canvas-offset')
        return true;
    const href = owner.getAttribute?.('href') ?? '';
    return /froam(?:-editor)?\.css(?:$|\?)/.test(href) || owner.closest?.('[data-chef-editor-root="true"]') != null;
}
function emulateSheets(size, saved) {
    const visitMedia = (media) => {
        if (!media || !media.mediaText || saved.media.has(media))
            return;
        const text = media.mediaText;
        if (!isViewportQuery(text))
            return;
        const result = evaluateMediaList(text, size);
        if (result === null)
            return;
        saved.media.set(media, text);
        media.mediaText = result ? 'all' : 'not all';
    };
    const visitDeclarations = (style) => {
        if (saved.declarations.has(style))
            return;
        let changes = null;
        for (let i = 0; i < style.length; i += 1) {
            const prop = style.item(i);
            const value = style.getPropertyValue(prop);
            if (!/\d(?:d|s|l)?v(?:h|w)\b|\dvmin\b|\dvmax\b/i.test(value))
                continue;
            (changes ??= new Map()).set(prop, [value, style.getPropertyPriority(prop)]);
        }
        if (!changes)
            return;
        saved.declarations.set(style, changes);
        for (const [prop, [value, priority]] of changes)
            style.setProperty(prop, resolveViewportUnits(value, size), priority);
    };
    const visitRules = (rules) => {
        for (const rule of Array.from(rules)) {
            if (rule instanceof CSSImportRule) {
                visitMedia(rule.media);
                if (rule.styleSheet)
                    visitSheet(rule.styleSheet);
                continue;
            }
            if (rule instanceof CSSMediaRule) {
                if (mentionsEditor(rule))
                    continue;
                visitMedia(rule.media);
            }
            if (rule instanceof CSSStyleRule && !EDITOR_SELECTOR.test(rule.selectorText))
                visitDeclarations(rule.style);
            const nested = rule.cssRules;
            if (nested?.length)
                visitRules(nested);
        }
    };
    const visitSheet = (sheet) => {
        if (isEditorSheet(sheet))
            return;
        visitMedia(sheet.media);
        let rules = null;
        try {
            rules = sheet.cssRules;
        }
        catch {
            return; /* another origin's sheet: the browser won't let us read it */
        }
        if (rules)
            visitRules(rules);
    };
    for (const sheet of Array.from(document.styleSheets))
        visitSheet(sheet);
    for (const sheet of document.adoptedStyleSheets ?? [])
        visitSheet(sheet);
}
function restoreSheets(saved) {
    for (const [media, text] of saved.media) {
        try {
            media.mediaText = text;
        }
        catch { /* the sheet is gone */ }
    }
    for (const [style, changes] of saved.declarations) {
        for (const [prop, [value, priority]] of changes) {
            try {
                style.setProperty(prop, value, priority);
            }
            catch { /* gone */ }
        }
    }
    saved.media.clear();
    saved.declarations.clear();
}
const lists = new Set();
let current = null;
function answer(query) {
    if (current && isViewportQuery(query)) {
        const result = evaluateMediaList(query, current);
        if (result !== null)
            return result;
    }
    return nativeMediaMatches(nativeMatchMedia(query));
}
function emulatedList(query) {
    const target = new EventTarget();
    target.media = query;
    target.matches = answer(query);
    target.onchange = null;
    const nativeList = nativeMatchMedia(query);
    target.refresh = () => {
        const next = answer(query);
        if (next === target.matches)
            return;
        target.matches = next;
        const event = typeof MediaQueryListEvent === 'function' ? new MediaQueryListEvent('change', { matches: next, media: query }) : Object.assign(new Event('change'), { matches: next, media: query });
        target.dispatchEvent(event);
        target.onchange?.call(target, event);
    };
    // Off-preview, the real list's changes (a window resize) still come through.
    nativeList?.addEventListener?.('change', () => { if (!current)
        target.refresh(); });
    Object.assign(target, {
        addListener: (fn) => target.addEventListener('change', fn),
        removeListener: (fn) => target.removeEventListener('change', fn),
    });
    lists.add(target);
    return target;
}
let patched = false;
function patchMatchMedia() {
    if (patched || typeof window === 'undefined' || !nativeMatchMediaFn)
        return;
    patched = true;
    window.matchMedia = (query) => (isViewportQuery(query) ? emulatedList(query) : nativeMatchMediaFn(query));
    // Lists a page made before the preview started answer for the device too
    // when they're read (a resize handler, a re-render).
    if (matchesDescriptor?.get) {
        const read = matchesDescriptor.get;
        Object.defineProperty(MediaQueryList.prototype, 'matches', {
            configurable: true,
            enumerable: matchesDescriptor.enumerable,
            get() {
                const real = Boolean(read.call(this));
                if (!current || !isViewportQuery(this.media))
                    return real;
                return evaluateMediaList(this.media, current) ?? real;
            },
        });
    }
}
/** Scripts that lay out on resize look again — now at the device. */
function announceResize() {
    try {
        window.dispatchEvent(new Event('resize'));
    }
    catch { /* no window */ }
}
/* ── the switch ── */
let saved = null;
let watcher = null;
let rewalk = 0;
/** Answer as the device would, until restoreViewport(). Calling again changes the device. */
export function emulateViewport(size) {
    if (typeof document === 'undefined')
        return;
    if (saved)
        restoreSheets(saved);
    saved ??= { media: new Map(), declarations: new Map() };
    current = size;
    emulateSheets(size, saved);
    patchMatchMedia();
    for (const list of lists)
        list.refresh();
    document.documentElement.setAttribute('data-froam-device', `${size.width}x${size.height}`);
    announceResize();
    if (!watcher) {
        // Stylesheets that arrive later (a route's CSS, hot reload) are emulated too.
        watcher = new MutationObserver((records) => {
            const styling = records.some((r) => [r.target, ...Array.from(r.addedNodes)].some((node) => {
                const el = node.nodeType === 1 ? node : node.parentElement;
                return el != null && (el.tagName === 'STYLE' || el.tagName === 'LINK') && !el.closest('[data-chef-editor-root="true"]') && !(el.id ?? '').startsWith('froam-canvas');
            }));
            if (!styling)
                return;
            window.clearTimeout(rewalk);
            rewalk = window.setTimeout(() => { if (current && saved) {
                restoreSheets(saved);
                emulateSheets(current, saved);
            } }, 60);
        });
        watcher.observe(document.documentElement, { childList: true, subtree: true, characterData: true });
        document.addEventListener('load', onSheetLoad, true);
    }
}
function onSheetLoad(event) {
    if (!(event.target instanceof HTMLLinkElement) || !current || !saved)
        return;
    window.clearTimeout(rewalk);
    rewalk = window.setTimeout(() => { if (current && saved) {
        restoreSheets(saved);
        emulateSheets(current, saved);
    } }, 30);
}
/** Back to the real window: every rule, unit and list as it was. */
export function restoreViewport() {
    if (typeof document === 'undefined')
        return;
    window.clearTimeout(rewalk);
    watcher?.disconnect();
    watcher = null;
    document.removeEventListener('load', onSheetLoad, true);
    if (saved)
        restoreSheets(saved);
    const wasOn = current !== null;
    saved = null;
    current = null;
    for (const list of lists)
        list.refresh();
    document.documentElement.removeAttribute('data-froam-device');
    if (wasOn)
        announceResize();
}
/* ── Scrolling: the page's scripts see the frame's scroll as the window's ──
 * In a preview the page scrolls inside its screen, not the window — so a
 * header that shrinks "on scroll", a reveal wired to window.scrollY, never
 * moved. While a preview is on, the window's scroll position, scroll events
 * and scrollTo() are the screen's. The editor reads the real ones
 * (nativeWindowScroll) for its own layout.
 */
const SCROLL_PROPS = ['scrollY', 'pageYOffset', 'scrollX', 'pageXOffset'];
const savedScroll = new Map();
let scrollTarget = null;
const nativeScrollTo = typeof window !== 'undefined' ? window.scrollTo : null;
const nativeScrollBy = typeof window !== 'undefined' ? window.scrollBy : null;
const nativeScroll = typeof window !== 'undefined' ? window.scroll : null;
function forwardScroll() {
    window.dispatchEvent(new Event('scroll'));
    document.dispatchEvent(new Event('scroll'));
}
/** The window's own scroll, preview or not. */
export function nativeWindowScroll() {
    const read = (prop) => {
        const descriptor = savedScroll.get(prop);
        return descriptor?.get ? Number(descriptor.get.call(window)) : Number(window[prop]);
    };
    return { x: read('scrollX'), y: read('scrollY') };
}
export function emulateScroll(target) {
    if (typeof window === 'undefined')
        return;
    restoreScroll();
    scrollTarget = target;
    const define = (object, prop, get, set) => {
        savedScroll.set(`${object === window ? 'w' : object === document ? 'd' : object === document.documentElement ? 'h' : 'b'}:${prop}`, Object.getOwnPropertyDescriptor(object, prop));
        if (object === window && (prop === 'scrollX' || prop === 'scrollY'))
            savedScroll.set(prop, Object.getOwnPropertyDescriptor(window, prop) ?? Object.getOwnPropertyDescriptor(Object.getPrototypeOf(window), prop));
        Object.defineProperty(object, prop, { configurable: true, get, ...(set ? { set } : {}) });
    };
    define(window, 'scrollY', () => target.scrollTop);
    define(window, 'pageYOffset', () => target.scrollTop);
    define(window, 'scrollX', () => target.scrollLeft);
    define(window, 'pageXOffset', () => target.scrollLeft);
    define(document, 'scrollingElement', () => target);
    for (const element of [document.documentElement, document.body]) {
        define(element, 'scrollTop', () => target.scrollTop, (value) => { target.scrollTop = value; });
        define(element, 'scrollLeft', () => target.scrollLeft, (value) => { target.scrollLeft = value; });
    }
    const toTarget = (method) => function (x, y) {
        if (typeof x === 'object' && x !== null)
            target[method](x);
        else
            target[method](Number(x ?? 0), Number(y ?? 0));
    };
    window.scrollTo = toTarget('scrollTo');
    window.scroll = toTarget('scrollTo');
    window.scrollBy = toTarget('scrollBy');
    target.addEventListener('scroll', forwardScroll, { passive: true });
}
export function restoreScroll() {
    if (typeof window === 'undefined' || !scrollTarget)
        return;
    scrollTarget.removeEventListener('scroll', forwardScroll);
    const put = (object, key, prop) => {
        const descriptor = savedScroll.get(`${key}:${prop}`);
        if (descriptor)
            Object.defineProperty(object, prop, descriptor);
        else
            delete object[prop];
    };
    for (const prop of SCROLL_PROPS)
        put(window, 'w', prop);
    put(document, 'd', 'scrollingElement');
    for (const [element, key] of [[document.documentElement, 'h'], [document.body, 'b']]) {
        put(element, key, 'scrollTop');
        put(element, key, 'scrollLeft');
    }
    if (nativeScrollTo)
        window.scrollTo = nativeScrollTo;
    if (nativeScroll)
        window.scroll = nativeScroll;
    if (nativeScrollBy)
        window.scrollBy = nativeScrollBy;
    savedScroll.clear();
    scrollTarget = null;
}
//# sourceMappingURL=viewport-emulation.js.map