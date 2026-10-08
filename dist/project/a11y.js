/**
 * Accessibility, read off the live page once. The A11y tab, the Health scan,
 * "Fix contrast everywhere", the reviewer checks and the scan profile all ask
 * these functions, so they cannot give three answers about one element.
 *
 * Browser only (reads computed styles and layout). The thresholds are WCAG
 * 2.2 AA: 1.4.3 contrast, 1.1.1 text alternatives, 4.1.2 names and 2.5.8
 * target size with its inline and spacing exceptions. Where a number can't be
 * measured honestly — words over a photo, gradient-filled letters — the
 * answer says so instead of guessing.
 */
import { WCAG_MIN_TARGET_PX, WHITE, blend, contrastRatio, parseColor, requiredContrast } from './wcag.js';
const BLACK = { r: 0, g: 0, b: 0, a: 1 };
const MEDIA = /^(?:img|video|canvas|picture|iframe|object|embed)$/;
/** Gradients with many stops over gradients multiply; past this the worst case is already found. */
const MAX_GROUNDS = 64;
const editorOwned = (node) => Boolean(node.closest('[data-chef-editor-root="true"]'));
const skippedLayer = (node) => editorOwned(node) || node.hasAttribute('data-froam-stage');
// Node type numbers rather than the Node global, so the scan also runs against the plain-object DOM the Node tests use.
const ELEMENT_NODE = 1;
const TEXT_NODE = 3;
export const ownText = (element) => Array.from(element.childNodes).some((node) => node.nodeType === TEXT_NODE && Boolean(node.textContent?.trim()));
/** How much of an element survives its own and every ancestor's `opacity`. */
export function opacityOf(element) {
    let opacity = 1;
    for (let node = element; node; node = node.parentElement)
        opacity *= Number.parseFloat(getComputedStyle(node).opacity) || 0;
    return opacity;
}
const faded = (colour, opacity) => ({ ...colour, a: colour.a * opacity });
function gradientStops(image) {
    return (image.match(/(?:rgba?|oklch|oklab|color)\([^)]*\)|#[0-9a-f]{3,8}\b/gi) ?? []).map(parseColor).filter((stop) => Boolean(stop));
}
/** The paint a node puts behind whatever is in front of it, top layer first. */
function layersOf(node, opacity) {
    if (MEDIA.test(node.tagName.toLowerCase()))
        return [{ kind: 'photo' }];
    const style = getComputedStyle(node);
    const layers = [];
    if (/url\(/i.test(style.backgroundImage))
        layers.push({ kind: 'photo' });
    else if (/gradient\(/i.test(style.backgroundImage)) {
        const stops = gradientStops(style.backgroundImage).map((stop) => faded(stop, opacity));
        if (stops.length)
            layers.push({ kind: 'gradient', stops });
    }
    const colour = parseColor(style.backgroundColor);
    if (colour && colour.a > 0)
        layers.push({ kind: 'solid', colour: faded(colour, opacity) });
    return layers;
}
const covers = (layer) => (layer.kind === 'solid' ? layer.colour.a >= 0.999 : layer.kind === 'gradient' ? layer.stops.every((stop) => stop.a >= 0.999) : true);
/** The nodes painted under an element, nearest first: what's stacked under its centre when on screen, else its ancestors. */
function nodesBehind(element) {
    const rect = element.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;
    if (rect.width && rect.height && x >= 0 && y >= 0 && x < window.innerWidth && y < window.innerHeight) {
        const stack = document.elementsFromPoint(x, y);
        const at = stack.indexOf(element);
        if (at >= 0)
            return stack.slice(at + 1).filter((node) => !element.contains(node) && !skippedLayer(node));
    }
    const ancestors = [];
    for (let node = element.parentElement; node; node = node.parentElement)
        if (!skippedLayer(node))
            ancestors.push(node);
    return ancestors;
}
/** Every colour the element's words could sit on, composited down to an opaque base; null over a photo. */
export function groundsBehind(element) {
    const layers = [];
    const take = (node) => {
        for (const layer of layersOf(node, opacityOf(node))) {
            layers.push(layer);
            if (layer.kind === 'photo' || covers(layer))
                return true;
        }
        return false;
    };
    let covered = take(element);
    if (!covered)
        for (const node of nodesBehind(element))
            if ((covered = take(node)))
                break;
    if (layers.some((layer) => layer.kind === 'photo'))
        return null;
    let grounds = [WHITE];
    for (const layer of layers.reverse()) {
        if (layer.kind === 'solid')
            grounds = grounds.map((ground) => blend(layer.colour, ground));
        else if (layer.kind === 'gradient')
            grounds = layer.stops.flatMap((stop) => grounds.map((ground) => blend(stop, ground))).slice(0, MAX_GROUNDS);
    }
    return grounds;
}
/** The worst ratio a text colour gets across `grounds`, painted at `opacity`. */
export function contrastOn(colour, grounds, opacity = 1) {
    let worst = Infinity;
    let on = grounds[0] ?? WHITE;
    for (const ground of grounds) {
        const ratio = contrastRatio(blend(faded(colour, opacity), ground), ground);
        if (ratio < worst) {
            worst = ratio;
            on = ground;
        }
    }
    return { ratio: worst, ground: on };
}
/**
 * Can the words this element itself holds be read where they sit? WCAG 1.4.3:
 * measured against what is really painted behind them — every stop of a
 * gradient, every translucent layer — with the element's and its ancestors'
 * opacity applied to both. Disabled controls are exempt, as the standard says.
 */
export function readTextContrast(element) {
    if (!ownText(element))
        return { status: 'exempt', reason: 'no-text' };
    const style = getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    if (style.display === 'none' || style.visibility === 'hidden' || style.visibility === 'collapse' || !rect.width || !rect.height)
        return { status: 'exempt', reason: 'hidden' };
    if (element.closest(':disabled, [aria-disabled="true"]'))
        return { status: 'exempt', reason: 'disabled' };
    const opacity = opacityOf(element);
    // Nearly invisible is a fade-in caught halfway, not a design to judge.
    if (opacity < 0.1)
        return { status: 'exempt', reason: 'hidden' };
    const clip = style.backgroundClip || style.webkitBackgroundClip;
    const fill = parseColor(style.webkitTextFillColor);
    if (clip === 'text' || (fill && fill.a < 0.1))
        return { status: 'unmeasurable', reason: 'gradient-text', detail: 'The letters are filled with a gradient or image, so they are not one colour' };
    const colour = fill ?? parseColor(style.color);
    if (!colour)
        return { status: 'unmeasurable', reason: 'colour', detail: `Its colour (${style.color}) is in a colour space Froam can't convert yet` };
    if (colour.a < 0.02)
        return { status: 'exempt', reason: 'hidden' };
    const grounds = groundsBehind(element);
    if (!grounds)
        return { status: 'unmeasurable', reason: 'photo', detail: 'It sits on a photo or video, where the contrast changes from spot to spot' };
    const size = Number.parseFloat(style.fontSize) || 16;
    const weight = Number.parseFloat(style.fontWeight) || 400;
    const required = requiredContrast(size, weight);
    const { ratio, ground } = contrastOn(colour, grounds, opacity);
    const best = Math.max(contrastOn(BLACK, grounds, opacity).ratio, contrastOn(WHITE, grounds, opacity).ratio);
    return {
        status: 'measured',
        ratio,
        required,
        large: required < 4.5,
        passes: ratio >= required,
        colour,
        grounds,
        ground,
        rendered: blend(faded(colour, opacity), ground),
        opacity,
        fixableByColour: best >= required,
    };
}
/* ── Text alternatives and names (1.1.1, 4.1.2) ── */
const hiddenFromAssistiveTech = (element) => Boolean(element.closest('[aria-hidden="true"]'));
function labelledByText(element) {
    const ids = element.getAttribute('aria-labelledby')?.split(/\s+/).filter(Boolean) ?? [];
    return ids.map((id) => element.ownerDocument.getElementById(id)?.textContent?.trim() ?? '').filter(Boolean).join(' ');
}
/** Whether an image is described, deliberately decorative, or neither. */
export function imageAlternative(image) {
    const role = image.getAttribute('role');
    if (role === 'presentation' || role === 'none' || hiddenFromAssistiveTech(image))
        return 'decorative';
    if (labelledByText(image) || image.getAttribute('aria-label')?.trim() || image.getAttribute('title')?.trim())
        return 'described';
    const alt = image.getAttribute('alt');
    // alt="" is the deliberate decorative marker; alt=" " describes nothing and marks nothing.
    if (alt === '')
        return 'decorative';
    return alt?.trim() ? 'described' : 'missing';
}
/** The words inside an element a screen reader would announce: text, image alts, SVG titles, nested labels. */
function contentName(element) {
    const parts = [];
    for (const node of Array.from(element.childNodes)) {
        if (node.nodeType === TEXT_NODE) {
            parts.push(node.textContent ?? '');
            continue;
        }
        if (node.nodeType !== ELEMENT_NODE)
            continue;
        const child = node;
        if (child.getAttribute('aria-hidden') === 'true')
            continue;
        const label = labelledByText(child) || child.getAttribute('aria-label')?.trim();
        const tag = child.tagName.toLowerCase();
        if (label)
            parts.push(label);
        else if (tag === 'img')
            parts.push(child.getAttribute('alt') ?? '');
        else if (tag === 'svg')
            parts.push(child.querySelector(':scope > title')?.textContent ?? '');
        else
            parts.push(contentName(child));
    }
    return parts.join(' ').replace(/\s+/g, ' ').trim();
}
const FIELD = /^(?:input|select|textarea)$/;
const BUTTON_INPUT = /^(?:submit|button|reset)$/;
/** An approximation of the accessible name (accname 1.2): enough to tell a named control from an unnamed one. */
export function accessibleName(element) {
    const byReference = labelledByText(element);
    if (byReference)
        return byReference;
    const label = element.getAttribute('aria-label')?.trim();
    if (label)
        return label;
    const tag = element.tagName.toLowerCase();
    if (tag === 'img')
        return element.getAttribute('alt')?.trim() ?? '';
    if (tag === 'input' && BUTTON_INPUT.test(element.type)) {
        const { type, value } = element;
        return value.trim() || (type === 'submit' ? 'Submit' : type === 'reset' ? 'Reset' : '');
    }
    if (FIELD.test(tag)) {
        const labels = Array.from(element.labels ?? []).map((node) => contentName(node)).filter(Boolean).join(' ');
        if (labels)
            return labels;
    }
    else {
        const content = contentName(element);
        if (content)
            return content;
    }
    return element.getAttribute('title')?.trim() ?? '';
}
/* ── Target size (2.5.8) ── */
export const INTERACTIVE_SELECTOR = 'a[href], button, input:not([type="hidden"]), select, textarea, summary, [role="button"], [role="link"], [role="checkbox"], [role="radio"], [role="switch"], [role="tab"], [role="menuitem"], [onclick]';
/** The inline exception: a link in a sentence, sized by the line of text around it. */
export function isInlineTarget(element) {
    if (getComputedStyle(element).display !== 'inline')
        return false;
    const own = (element.textContent ?? '').trim().length;
    const around = (element.parentElement?.textContent ?? '').trim().length;
    return own > 0 && around > own + 8;
}
/**
 * Targets under 24×24 that no exception covers. WCAG 2.5.8's spacing
 * exception lets an undersized target pass when a 24px circle centred on it
 * touches no other target and no other undersized target's circle — without
 * it every ordinary icon row reads as a pile of failures.
 */
export function undersizedTargets(elements) {
    const measured = elements
        .filter((element) => !element.closest(':disabled, [aria-disabled="true"]') && getComputedStyle(element).visibility !== 'hidden')
        .map((element) => ({ element, rect: element.getBoundingClientRect() }))
        .filter(({ rect }) => rect.width > 0 && rect.height > 0);
    const radius = WCAG_MIN_TARGET_PX / 2;
    const centre = (rect) => ({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 });
    const small = measured.filter(({ element, rect }) => Math.min(rect.width, rect.height) < WCAG_MIN_TARGET_PX && !isInlineTarget(element));
    const smallSet = new Set(small.map(({ element }) => element));
    return small.filter(({ element, rect }) => {
        const c = centre(rect);
        return measured.some((other) => {
            if (other.element === element || other.element.contains(element) || element.contains(other.element))
                return false;
            if (smallSet.has(other.element)) {
                const o = centre(other.rect);
                if (Math.hypot(c.x - o.x, c.y - o.y) < radius * 2)
                    return true;
            }
            const nearestX = Math.max(other.rect.left, Math.min(c.x, other.rect.right));
            const nearestY = Math.max(other.rect.top, Math.min(c.y, other.rect.bottom));
            return Math.hypot(c.x - nearestX, c.y - nearestY) < radius;
        });
    }).map(({ element, rect }) => ({ element, width: Math.round(rect.width), height: Math.round(rect.height) }));
}
//# sourceMappingURL=a11y.js.map