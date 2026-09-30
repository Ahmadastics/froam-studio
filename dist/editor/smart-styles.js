import { contrast, luminance, parseColor, sampleAccent, sampleRadius, toHex } from './library/site-theme.js';
const WHITE = { r: 255, g: 255, b: 255, a: 1 };
const INK = { r: 11, g: 15, b: 20, a: 1 };
const FALLBACK_ACCENT = { r: 99, g: 102, b: 241, a: 1 };
const TEXT_TAG = /^(?:h[1-6]|p|span|a|small|strong|em|b|i|label|li|blockquote|figcaption|dt|dd|q|cite|mark|code)$/;
/* The phrases each edit answers to. Order matters: "glow in the brand colour" is a glow. */
const SMART_EDITS = [
    ['contrast', /\bcontrast\b|\blegible\b|\breadable (?:on|over|against)\b/],
    ['fluid', /\bfluid\b|\bscales? with (?:the )?(?:screen|window|viewport)\b|\bresponsive (?:text|type|font)(?: size)?\b/],
    ['glass', /\bglass(?:y|morphism)?\b|\bfrost(?:ed|y)?\b/],
    ['gradient', /\bgradient\b/],
    ['glow', /\bglow(?:s|ing|y)?\b|\bneon\b/],
    ['balance', /\bbalance[ds]?\b|\borphans?\b|\bwidows?\b|\beven (?:out )?(?:the )?lines\b/],
    ['match', /\bmatch (?:the |its )?(?:others|siblings|neighbou?rs|rest|look-?alikes)\b|\bconsistent\b/],
    ['brand', /\b(?:brand|accent) colou?r\b|\bon[- ]brand\b|\bin (?:the |our |my )?brand\b/],
    ['pop', /\bpop\b/],
];
/* ── Colour ── */
/** Computed colours come as rgb(), rgba(), hex, or color(srgb …) for color-mix results. */
function parse(value) {
    if (typeof value !== 'string' || !value.trim())
        return null;
    const srgb = value.match(/color\(srgb\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)(?:\s*\/\s*([\d.]+%?))?\s*\)/i);
    if (srgb) {
        const alpha = srgb[4] === undefined ? 1 : srgb[4].endsWith('%') ? Number.parseFloat(srgb[4]) / 100 : Number(srgb[4]);
        return { r: Number(srgb[1]) * 255, g: Number(srgb[2]) * 255, b: Number(srgb[3]) * 255, a: alpha };
    }
    return parseColor(value.trim());
}
const solid = (color) => (color && color.a > 0.6 ? color : null);
const chroma = ({ r, g, b }) => (Math.max(r, g, b) - Math.min(r, g, b)) / 255;
const rgba = ({ r, g, b }, alpha) => `rgba(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)}, ${Number(alpha.toFixed(2))})`;
/** Ratios round down: "4.5:1" never stands for 4.46. */
const ratio = (value) => `${(Math.floor(value * 10) / 10).toFixed(1)}:1`;
const inkOn = (fill) => (contrast(WHITE, fill) >= contrast(INK, fill) ? WHITE : INK);
const hexed = (color) => parse(toHex(color));
function toHsl({ r, g, b }) {
    const [R, G, B] = [r / 255, g / 255, b / 255];
    const max = Math.max(R, G, B);
    const min = Math.min(R, G, B);
    const l = (max + min) / 2;
    if (max === min)
        return { h: 0, s: 0, l };
    const d = max - min;
    const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    const h = max === R ? (G - B) / d + (G < B ? 6 : 0) : max === G ? (B - R) / d + 2 : (R - G) / d + 4;
    return { h: h * 60, s, l };
}
function fromHsl(hue, s, l) {
    const h = (((hue % 360) + 360) % 360) / 360;
    if (s === 0)
        return { r: l * 255, g: l * 255, b: l * 255, a: 1 };
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    const channel = (t) => {
        const x = t < 0 ? t + 1 : t > 1 ? t - 1 : t;
        return x < 1 / 6 ? p + (q - p) * 6 * x : x < 1 / 2 ? q : x < 2 / 3 ? p + (q - p) * (2 / 3 - x) * 6 : p;
    };
    return { r: channel(h + 1 / 3) * 255, g: channel(h) * 255, b: channel(h - 1 / 3) * 255, a: 1 };
}
/**
 * The nearest colour of the same hue that reaches `target` against `ground`:
 * as close to the original as the target allows, so a brand colour stays
 * recognisably itself. Checked after rounding to hex, as it will be written.
 */
export function readableShade(color, ground, target) {
    if (contrast(hexed(color), ground) >= target)
        return color;
    const { h, s, l } = toHsl(color);
    const darker = contrast(INK, ground) >= contrast(WHITE, ground);
    for (const toward of [darker, !darker]) {
        for (let step = 1; step <= 100; step += 1) {
            const next = toward ? l - step / 100 : l + step / 100;
            if (next < 0 || next > 1)
                break;
            const candidate = hexed(fromHsl(h, s, next));
            if (contrast(candidate, ground) >= target)
                return candidate;
        }
    }
    return darker ? INK : WHITE;
}
/* ── The edits ── */
const px = (value) => {
    const parsed = typeof value === 'string' ? Number.parseFloat(value) : typeof value === 'number' ? value : Number.NaN;
    return Number.isFinite(parsed) ? parsed : null;
};
const rem = (pixels) => `${Number((pixels / 16).toFixed(3))}rem`;
const MATCHED = {
    borderRadius: ['visual', 'corners'], backgroundColor: ['visual', 'fill'], color: ['visual', 'text colour'],
    boxShadow: ['visual', 'shadow'], border: ['visual', 'border'], fontFamily: ['typography', 'font'],
    fontSize: ['typography', 'size'], fontWeight: ['typography', 'weight'], letterSpacing: ['typography', 'tracking'],
    lineHeight: ['typography', 'line height'], textTransform: ['typography', 'case'], padding: ['spacing', 'padding'], gap: ['spacing', 'gap'],
};
export function smartEditFor(intent) {
    const normalized = intent.toLocaleLowerCase();
    return SMART_EDITS.find(([, pattern]) => pattern.test(normalized))?.[0] ?? null;
}
/**
 * The smart edit an instruction asks for, worked out for this element on this
 * page — or null when it isn't one. `take` is Quick Edit's Try again: each
 * take is a different, still page-derived variation (another hue pairing, a
 * softer or stronger glow, lighter or heavier frost), not the same result twice.
 */
export function smartStyleEdit(intent, subject, take = 1) {
    const id = smartEditFor(intent);
    if (!id)
        return null;
    const variant = (Math.max(1, Math.floor(take)) - 1) % 3;
    const page = subject.page ?? {};
    const { visual } = subject;
    const tag = (page.tag ?? subject.tag ?? '').toLowerCase();
    const own = parse(page.surface) ?? solid(parse(visual.backgroundColor));
    const behind = parse(page.behind) ?? WHITE;
    const ground = own ?? behind;
    const isText = page.text ?? (!own && TEXT_TAG.test(tag));
    const brand = parse(page.accent);
    const accent = brand ?? (() => { const color = parse(visual.color); return color && chroma(color) > 0.3 ? color : null; })() ?? FALLBACK_ACCENT;
    const whose = brand ? `your brand colour ${toHex(accent)}` : toHex(accent);
    const size = px(visual.fontSize) ?? 16;
    const large = size >= 24 || (size >= 18.66 && (Number(visual.fontWeight) || 400) >= 700);
    const change = (domain, property, value) => ({ domain, property, value });
    switch (id) {
        case 'contrast': {
            const fg = parse(visual.color) ?? INK;
            const stops = (page.behindStops ?? []).map(parse).filter((stop) => Boolean(stop));
            if (page.overImage && page.imageKind === 'gradient' && stops.length) {
                // A gradient's colours are known: pass against every one of them.
                const aa = large ? 3 : 4.5;
                const worst = (text) => stops.reduce((low, stop) => (contrast(text, stop) < contrast(text, low) ? stop : low));
                const before = contrast(fg, worst(fg));
                if (before >= 7)
                    return { id, changes: [], note: `Already easy to read: ${ratio(before)} even on the palest part of the gradient behind it` };
                const goal = (before >= aa || variant > 0 ? 7 : aa) + 0.05;
                let next = fg;
                for (let round = 0; round < 4 && contrast(next, worst(next)) < goal; round += 1)
                    next = readableShade(next, worst(next), goal);
                const after = contrast(next, worst(next));
                if (after >= aa)
                    return { id, changes: [change('visual', 'color', toHex(next))], note: `Contrast ${ratio(before)} → ${ratio(after)} against every colour of the gradient behind it: passes WCAG ${after >= 7 ? 'AAA' : `AA${large ? ' for large text' : ''}`}` };
            }
            if (page.overImage && !own) {
                const lightText = luminance(fg) > 0.4;
                return { id, changes: [change('visual', 'textShadow', lightText ? '0 1px 2px rgba(0, 0, 0, 0.55), 0 0 18px rgba(0, 0, 0, 0.45)' : '0 1px 2px rgba(255, 255, 255, 0.6), 0 0 18px rgba(255, 255, 255, 0.5)')], note: `It sits on a ${page.imageKind === 'gradient' ? 'gradient no single colour reads on' : 'photo, where the contrast changes from spot to spot'} — a soft shadow behind the letters keeps them legible on all of it` };
            }
            const before = contrast(fg, ground);
            const aa = large ? 3 : 4.5;
            if (before >= 7)
                return { id, changes: [], note: `Already easy to read: ${ratio(before)} on its background passes WCAG AAA` };
            // Try again aims higher: AAA.
            const goal = before >= aa || variant > 0 ? 7 : aa;
            const next = readableShade(fg, ground, goal + 0.05);
            const after = contrast(next, ground);
            const level = after >= 7 ? 'AAA' : `AA${large ? ' for large text' : ''}`;
            return { id, changes: [change('visual', 'color', toHex(next))], note: `Contrast ${ratio(before)} → ${ratio(after)} on its background: passes WCAG ${level}, in the same hue` };
        }
        case 'fluid': {
            if (size < 18)
                return { id, changes: [], note: `At ${Math.round(size)}px this is body text, which reads best at one steady size — fluid sizing is for headings and big type` };
            const max = Math.round(size);
            const min = Math.max(16, Math.round(size * [0.62, 0.55, 0.7][variant]));
            const slope = (max - min) / (1440 - 375);
            return { id, changes: [change('typography', 'fontSize', `clamp(${rem(min)}, ${rem(min - slope * 375)} + ${(slope * 100).toFixed(2)}vw, ${rem(max)})`)], note: `${min}px on a phone, growing smoothly to ${max}px on a wide screen — no breakpoints, and it still follows the reader's text-size setting` };
        }
        case 'glass': {
            const light = luminance(behind) > 0.35;
            const tint = own && chroma(own) > 0.25 ? own : WHITE;
            const [frost, blur, density] = [['Frosted glass', 16, 1], ['Heavy frost', 28, 1.3], ['Light frost', 9, 0.65]][variant];
            const alpha = (tint === WHITE ? (light ? 0.55 : 0.08) : (light ? 0.5 : 0.28)) * density;
            const filter = `blur(${blur}px) saturate(170%)`;
            const changes = [
                change('visual', 'backgroundColor', rgba(tint, Math.min(0.9, alpha))),
                change('visual', 'backdropFilter', filter),
                change('visual', 'WebkitBackdropFilter', filter),
                change('visual', 'border', `1px solid ${light ? 'rgba(255, 255, 255, 0.7)' : 'rgba(255, 255, 255, 0.16)'}`),
                change('visual', 'boxShadow', light ? '0 8px 32px rgba(15, 23, 42, 0.12), inset 0 1px 0 rgba(255, 255, 255, 0.6)' : '0 8px 32px rgba(0, 0, 0, 0.35), inset 0 1px 0 rgba(255, 255, 255, 0.08)'),
            ];
            if (!px(visual.borderRadius))
                changes.push(change('visual', 'borderRadius', page.radius ?? '16px'));
            return { id, changes, note: `${frost} tuned for the ${light ? 'light' : 'dark'} ${page.overImage ? page.imageKind ?? 'photo' : 'background'} behind it${page.overImage ? '' : ' — it comes alive over photos and gradients'}` };
        }
        case 'gradient': {
            const { h, s, l } = toHsl(accent);
            const [turn, into] = [[40, 'a neighbouring hue'], [-40, 'a neighbouring hue the other way'], [150, 'a bold contrasting hue']][variant];
            const second = fromHsl(h + turn, Math.min(1, s * 1.05), Math.min(0.72, l + 0.06));
            if (isText) {
                const stops = [accent, second].map((stop) => readableShade(stop, behind, 3.05));
                const deepened = stops.some((stop, index) => toHex(stop) !== toHex([accent, second][index]));
                const [from, to] = stops.map(toHex);
                return {
                    id,
                    changes: [
                        change('visual', 'backgroundImage', `linear-gradient(100deg, ${from}, ${to})`),
                        change('visual', 'WebkitBackgroundClip', 'text'),
                        change('visual', 'backgroundClip', 'text'),
                        change('visual', 'WebkitTextFillColor', 'transparent'),
                        change('visual', 'color', from),
                    ],
                    note: `${whose[0].toUpperCase()}${whose.slice(1)} flowing into ${into}, clipped to the letters${deepened ? ' — deepened a touch so it stays readable' : ''}`,
                };
            }
            const middle = { r: (accent.r + second.r) / 2, g: (accent.g + second.g) / 2, b: (accent.b + second.b) / 2, a: 1 };
            return { id, changes: [change('visual', 'backgroundImage', `linear-gradient(135deg, ${toHex(accent)}, ${toHex(second)})`), change('visual', 'color', toHex(inkOn(middle)))], note: `A gradient from ${whose} into ${into}, with text picked to stay readable on it` };
        }
        case 'glow': {
            const [kindOf, boost] = [['A glow', 1], ['A soft glow', 0.6], ['An intense glow', 1.45]][variant];
            const strength = (luminance(behind) < 0.3 ? 1 : 0.75) * boost;
            const reach = Math.round(28 * (boost > 1 ? 1.4 : boost < 1 ? 0.8 : 1));
            return isText
                ? { id, changes: [change('visual', 'textShadow', `0 0 10px ${rgba(accent, Math.min(0.95, 0.6 * strength))}, 0 0 ${reach}px ${rgba(accent, Math.min(0.9, 0.4 * strength))}`)], note: `${kindOf} in ${whose}` }
                : { id, changes: [change('visual', 'boxShadow', `0 0 0 1px ${rgba(accent, 0.35)}, 0 8px ${reach}px -6px ${rgba(accent, Math.min(0.95, 0.55 * strength))}, 0 0 ${reach * 2}px ${rgba(accent, Math.min(0.9, 0.28 * strength))}`)], note: `${kindOf} in ${whose}` };
        }
        case 'balance': {
            const heading = /^h[1-6]$/.test(tag) || size >= 22;
            return heading
                ? { id, changes: [change('typography', 'textWrap', 'balance')], note: 'Its lines even out at every screen width, so no word is left alone on the last line' }
                : { id, changes: [change('typography', 'textWrap', 'pretty')], note: 'It rewraps more carefully, so the paragraph never ends on one lonely word' };
        }
        case 'match': {
            const alike = page.lookAlikes;
            if (!alike?.count)
                return { id, changes: [], note: 'Nothing else on the page looks like it — try this on one of a set, like a card in a row or a button' };
            const changes = Object.entries(alike.styles).filter(([property]) => MATCHED[property]).map(([property, value]) => change(MATCHED[property][0], property, value));
            const others = `${alike.count} other ${alike.noun}${alike.count === 1 ? '' : 's'}`;
            if (!changes.length)
                return { id, changes: [], note: `It already matches the ${others} like it` };
            return { id, changes, note: `Matched to the ${others} like it: ${changes.map(({ property }) => MATCHED[property][1]).join(', ')}` };
        }
        case 'brand': {
            if (own || !isText) {
                const ink = inkOn(accent);
                return { id, changes: [change('visual', 'backgroundColor', toHex(accent)), change('visual', 'color', toHex(ink))], note: `Filled with ${whose}, with ${ink === WHITE ? 'white' : 'dark'} text that reads on it (${ratio(contrast(ink, accent))})` };
            }
            const shade = readableShade(accent, behind, large ? 3.05 : 4.55);
            const adjusted = toHex(shade) !== toHex(accent);
            return { id, changes: [change('visual', 'color', toHex(shade))], note: adjusted ? `${whose[0].toUpperCase()}${whose.slice(1)}, deepened to ${toHex(shade)} so it passes WCAG on this background (${ratio(contrast(shade, behind))})` : `${whose[0].toUpperCase()}${whose.slice(1)} — already readable here (${ratio(contrast(shade, behind))})` };
        }
        case 'pop': {
            // Without a brand colour, or on bare text, the plain shadow edit does it.
            if (!brand || isText)
                return null;
            const [lift, depth, alpha] = [['Lifted', 14, 0.6], ['Gently lifted', 8, 0.4], ['Lifted high', 22, 0.7]][variant];
            return { id, changes: [change('visual', 'boxShadow', `0 ${depth}px ${depth * 2.4}px -12px ${rgba(accent, alpha)}, 0 2px 6px rgba(15, 23, 42, 0.08)`)], note: `${lift}, with a shadow in ${whose}` };
        }
    }
}
/* ── Reading the page (browser only) ── */
const MEDIA = /^(?:img|video|canvas|picture|iframe)$/;
const editorOwned = (node) => Boolean(node.closest('[data-chef-editor-root="true"]'));
const visible = (node) => { const rect = node.getBoundingClientRect(); return rect.width > 0 && rect.height > 0; };
/**
 * What a layer's background is: a photo (can't be measured), a gradient
 * (whose colours can — their average stands in as "the" colour behind), a
 * solid colour, or nothing: null, look further down. A faint decorative wash
 * with no solid colour in it counts as nothing.
 */
function layerBehind(style) {
    if (/url\(/.test(style.backgroundImage))
        return { behind: solid(parse(style.backgroundColor)), overImage: true, imageKind: 'photo' };
    const color = solid(parse(style.backgroundColor));
    const stops = /gradient\(/.test(style.backgroundImage)
        ? (style.backgroundImage.match(/rgba?\([^)]*\)|color\(srgb[^)]*\)/g) ?? []).map(parse).filter((stop) => Boolean(stop && stop.a > 0.6))
        : [];
    if (!stops.length)
        return color ? { behind: color, overImage: false } : null;
    const average = { r: stops.reduce((sum, stop) => sum + stop.r, 0) / stops.length, g: stops.reduce((sum, stop) => sum + stop.g, 0) / stops.length, b: stops.reduce((sum, stop) => sum + stop.b, 0) / stops.length, a: 1 };
    return { behind: average, overImage: true, imageKind: 'gradient', stops };
}
/** The solid colour behind an element — or the photo or gradient — from what's stacked under its centre, else up its ancestors. */
function readBehind(element) {
    const rect = element.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;
    if (rect.width && rect.height && x >= 0 && y >= 0 && x < window.innerWidth && y < window.innerHeight) {
        const stack = document.elementsFromPoint(x, y);
        const at = stack.indexOf(element);
        if (at >= 0) {
            for (const node of stack.slice(at + 1)) {
                if (editorOwned(node) || node.hasAttribute('data-froam-stage') || element.contains(node))
                    continue;
                if (MEDIA.test(node.tagName.toLowerCase()))
                    return { behind: null, overImage: true, imageKind: 'photo' };
                const layer = layerBehind(getComputedStyle(node));
                if (layer)
                    return layer;
            }
        }
    }
    for (let node = element.parentElement; node; node = node.parentElement) {
        if (node.hasAttribute('data-froam-stage'))
            continue;
        const layer = layerBehind(getComputedStyle(node));
        if (layer)
            return layer;
    }
    return { behind: WHITE, overImage: false };
}
/** Others of its kind: the same tag and first class across the page, else its same-tag siblings. Keeps the styles most of them share where this one differs. */
function readLookAlikes(element, root) {
    const tag = element.tagName.toLowerCase();
    const firstClass = Array.from(element.classList).find((name) => !name.startsWith('froam') && /^[\w-]+$/.test(name));
    const usable = (node) => node instanceof HTMLElement && node !== element && !node.contains(element) && !element.contains(node) && !editorOwned(node) && visible(node);
    let others = firstClass ? Array.from(root.querySelectorAll(`${tag}.${CSS.escape(firstClass)}`)).filter(usable) : [];
    if (!others.length && element.parentElement)
        others = Array.from(element.parentElement.children).filter((node) => node.tagName === element.tagName).filter(usable);
    others = others.slice(0, 24);
    if (!others.length)
        return undefined;
    const mine = getComputedStyle(element);
    const theirs = others.map((node) => getComputedStyle(node));
    const styles = {};
    for (const property of Object.keys(MATCHED)) {
        const counts = new Map();
        for (const style of theirs)
            if (style[property])
                counts.set(style[property], (counts.get(style[property]) ?? 0) + 1);
        const [value, count] = [...counts].sort((a, b) => b[1] - a[1])[0] ?? [];
        if (value && count && count * 2 > others.length && value !== mine[property])
            styles[property] = value;
    }
    const noun = /^h[1-6]$/.test(tag) ? 'heading' : { a: 'link', button: 'button', li: 'item', p: 'paragraph', img: 'image', section: 'section', article: 'card' }[tag] ?? (firstClass && /card|tile/i.test(firstClass) ? 'card' : firstClass && /btn|button/i.test(firstClass) ? 'button' : 'one');
    return { count: others.length, noun, styles };
}
/** Everything the smart edits need about the page around `element`, read once. */
export function readSmartContext(element, root) {
    const style = getComputedStyle(element);
    const surface = solid(parse(style.backgroundColor));
    const found = readBehind(element);
    // Its own photo or gradient is what its words sit on.
    const ownImage = layerBehind(style);
    const image = ownImage?.overImage ? ownImage : found.overImage ? found : null;
    const tag = element.tagName.toLowerCase();
    const ownText = Array.from(element.childNodes).some((node) => node.nodeType === Node.TEXT_NODE && Boolean(node.textContent?.trim()));
    const accent = sampleAccent(root);
    const cards = Array.from(root.querySelectorAll('article, li, [class*="card"], img, figure')).slice(0, 80);
    return {
        surface: surface ? toHex(surface) : undefined,
        behind: found.behind ? toHex(found.behind) : undefined,
        overImage: Boolean(image),
        imageKind: image?.imageKind,
        behindStops: image?.stops?.map(toHex),
        accent: accent ? toHex(accent) : undefined,
        radius: sampleRadius(cards, '16px'),
        text: !surface && style.backgroundImage === 'none' && (TEXT_TAG.test(tag) || ownText),
        tag,
        lookAlikes: readLookAlikes(element, root),
    };
}
//# sourceMappingURL=smart-styles.js.map