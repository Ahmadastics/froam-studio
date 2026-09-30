import { findElementByPath } from '../../collab/paths.js';
import { camelToKebab } from './dom.js';
export const PSEUDO_ELEMENTS = ['before', 'after'];
export const PSEUDO_HOST_ATTR = 'data-froam-pseudo';
const PAINT_STYLE_ID = 'froam-pseudo-paint';
export function pseudoKey(pseudo, property) {
    return `__froamState:${pseudo}:${property}`;
}
/** This pseudo-element's (or hover/focus/active state's) edits in a draft, as `{ property: value }`. */
export function pseudoStyles(styles, pseudo) {
    const prefix = `__froamState:${pseudo}:`;
    const out = {};
    for (const [key, value] of Object.entries(styles ?? {})) {
        if (key.startsWith(prefix) && value)
            out[key.slice(prefix.length)] = value;
    }
    return out;
}
/**
 * Plain text → a CSS `content` value. Keywords, functions and strings someone
 * typed with quotes pass through; everything else becomes a CSS string. Braces
 * and `<` are escaped so the value can never end a rule or a <style> element.
 */
export function encodePseudoContent(text) {
    const trimmed = text.trim();
    if (!trimmed)
        return '';
    if (/^(none|normal)$/i.test(trimmed) || /^(attr|counter|counters)\([^{}<]*\)$/i.test(trimmed))
        return trimmed;
    const body = /^"(?:[^"\\]|\\.)*"$/.test(trimmed) ? trimmed.slice(1, -1).replace(/\\(.)/g, '$1') : text;
    const escaped = body
        .replace(/\\/g, '\\\\')
        .replace(/"/g, '\\"')
        .replace(/\r?\n/g, '\\A ')
        .replace(/[{}<]/g, (character) => `\\${character.charCodeAt(0).toString(16).toUpperCase()} `);
    return `"${escaped}"`;
}
/** A CSS `content` value → the text a person would type to get it. */
export function decodePseudoContent(value) {
    if (!value || value === 'none' || value === 'normal')
        return '';
    const match = value.match(/^"((?:[^"\\]|\\[\s\S])*)"$/) ?? value.match(/^'((?:[^'\\]|\\[\s\S])*)'$/);
    if (!match)
        return value;
    // One pass, so an escaped backslash is never read as the start of a hex escape.
    return match[1].replace(/\\(?:([0-9a-fA-F]{1,6}) ?|([\s\S]))/g, (_, hex, character) => (hex ? String.fromCodePoint(parseInt(hex, 16)) : character ?? ''));
}
function declarationsFor(styles) {
    return Object.entries(styles)
        .filter(([property, value]) => /^-{0,2}[a-zA-Z][a-zA-Z0-9-]*$/.test(property) && !/[{}]/.test(value))
        .map(([property, value]) => `${camelToKebab(property)}:${value}!important`)
        .join(';');
}
/* Hover, focus and press, in the order the generated stylesheet writes them:
   pressing a hovered button shows :active. */
const INTERACTION_STATES = ['hover', 'focus', 'active'];
/**
 * Shows this route's ::before/::after edits in the editor — and its hover,
 * focus and press styles, so a living look answers the pointer as you work,
 * the way it will on the site. Hosts are stamped with their path so one
 * stylesheet can address them; stamps and rules are only rewritten when they
 * change (the page's observers see every write).
 */
export function paintPseudoElements(root, routeDrafts) {
    const rules = [];
    const hosts = new Set();
    for (const [path, draft] of Object.entries(routeDrafts)) {
        for (const [part, selector] of [...INTERACTION_STATES.map((state) => [state, `:${state}`]), ...PSEUDO_ELEMENTS.map((pseudo) => [pseudo, `::${pseudo}`])]) {
            const declarations = declarationsFor(pseudoStyles(draft.styles, part));
            if (!declarations)
                continue;
            const host = findElementByPath(root, path);
            if (!host)
                continue;
            if (host.getAttribute(PSEUDO_HOST_ATTR) !== path)
                host.setAttribute(PSEUDO_HOST_ATTR, path);
            hosts.add(host);
            rules.push(`[${PSEUDO_HOST_ATTR}="${path.replace(/["\\]/g, '\\$&')}"]${selector}{${declarations}}`);
        }
    }
    document.querySelectorAll(`[${PSEUDO_HOST_ATTR}]`).forEach((element) => {
        if (!hosts.has(element))
            element.removeAttribute(PSEUDO_HOST_ATTR);
    });
    const css = rules.join('\n');
    let style = document.getElementById(PAINT_STYLE_ID);
    if (!css) {
        style?.remove();
        return;
    }
    if (!style) {
        style = document.createElement('style');
        style.id = PAINT_STYLE_ID;
        document.head.appendChild(style);
    }
    if (style.textContent !== css)
        style.textContent = css;
}
export function clearPseudoPaint() {
    document.getElementById(PAINT_STYLE_ID)?.remove();
    document.querySelectorAll(`[${PSEUDO_HOST_ATTR}]`).forEach((element) => element.removeAttribute(PSEUDO_HOST_ATTR));
}
//# sourceMappingURL=pseudo.js.map