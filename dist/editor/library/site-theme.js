export const DEFAULT_SITE_THEME = {
    fontBody: 'inherit',
    fontHeading: 'inherit',
    ink: '#0f172a',
    muted: '#475569',
    paper: '#ffffff',
    surface: '#ffffff',
    tint: '#f0fdf4',
    line: 'rgba(15, 23, 42, 0.12)',
    accent: '#10b981',
    accentInk: '#ffffff',
    radius: '14px',
    buttonRadius: '10px',
    maxWidth: '1120px',
    brandName: 'Your brand',
    navLinks: ['About', 'Work', 'Contact'],
};
export function parseColor(value) {
    if (!value)
        return null;
    const hex = value.trim().match(/^#([0-9a-f]{3,8})$/i);
    if (hex) {
        let digits = hex[1];
        if (digits.length <= 4)
            digits = digits.split('').map((d) => d + d).join('');
        const n = (i) => parseInt(digits.slice(i, i + 2), 16);
        return { r: n(0), g: n(2), b: n(4), a: digits.length === 8 ? n(6) / 255 : 1 };
    }
    const rgb = value.match(/rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)(?:[\s,/]+([\d.]+%?))?\s*\)/i);
    if (!rgb)
        return null;
    const alpha = rgb[4] === undefined ? 1 : rgb[4].endsWith('%') ? Number.parseFloat(rgb[4]) / 100 : Number(rgb[4]);
    return { r: Number(rgb[1]), g: Number(rgb[2]), b: Number(rgb[3]), a: alpha };
}
export function toHex({ r, g, b }) {
    return `#${[r, g, b].map((part) => Math.round(Math.max(0, Math.min(255, part))).toString(16).padStart(2, '0')).join('')}`;
}
function mix(a, b, amountOfB) {
    return { r: a.r + (b.r - a.r) * amountOfB, g: a.g + (b.g - a.g) * amountOfB, b: a.b + (b.b - a.b) * amountOfB, a: 1 };
}
/** WCAG relative luminance. */
export function luminance({ r, g, b }) {
    const channel = (value) => {
        const c = value / 255;
        return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    };
    return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}
export function contrast(a, b) {
    const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
    return (hi + 0.05) / (lo + 0.05);
}
/**
 * How colourful a colour actually is (max − min channel). Unlike HSL
 * saturation, a near-white tint (#eef4ff) scores low: it's a wash, not a brand.
 */
function chroma({ r, g, b }) {
    return (Math.max(r, g, b) - Math.min(r, g, b)) / 255;
}
const isVisible = (el) => {
    const rect = el.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
};
/** The first background up the tree that isn't transparent. */
function effectiveBackground(start) {
    for (let el = start; el; el = el.parentElement) {
        const color = parseColor(getComputedStyle(el).backgroundColor);
        if (color && color.a > 0.5)
            return color;
    }
    return { r: 255, g: 255, b: 255, a: 1 };
}
/**
 * The brand colour: the most-used saturated colour across the page's buttons
 * and links (backgrounds first — a filled button is the loudest statement of
 * a brand), weighted by how much of it there is on screen.
 */
function sampleAccent(scope) {
    const votes = new Map();
    const vote = (color, weight) => {
        if (!color || color.a < 0.6 || chroma(color) < 0.3)
            return;
        const lum = luminance(color);
        if (lum > 0.75 || lum < 0.012)
            return;
        const key = toHex(color);
        const entry = votes.get(key) ?? { color, weight: 0 };
        entry.weight += weight;
        votes.set(key, entry);
    };
    const controls = Array.from(scope.querySelectorAll('button, a, [role="button"], input[type="submit"]')).filter(isVisible).slice(0, 200);
    for (const control of controls) {
        const style = getComputedStyle(control);
        const rect = control.getBoundingClientRect();
        const area = Math.min(rect.width * rect.height, 40_000);
        vote(parseColor(style.backgroundColor), 3 + area / 2000);
        vote(parseColor(style.color), 1);
        vote(parseColor(style.borderTopColor), 0.5);
    }
    // Brand colour also shows up in headings' highlighted words — often as a
    // gradient clipped to the text, whose stops are the colours that count.
    for (const accent of Array.from(scope.querySelectorAll('h1 *, h2 *, [class*="accent"], [class*="brand"], [class*="primary"], [class*="gradient"]')).slice(0, 80)) {
        const style = getComputedStyle(accent);
        vote(parseColor(style.color), 1.5);
        for (const stop of style.backgroundImage.match(/rgba?\([^)]*\)/g) ?? [])
            vote(parseColor(stop), 2);
    }
    // …and in the logo and icons: the SVG fills and strokes in the header and controls.
    for (const shape of Array.from(scope.querySelectorAll('header svg *, nav svg *, a svg *, button svg *, [class*="logo" i] svg *')).slice(0, 80)) {
        const style = getComputedStyle(shape);
        vote(parseColor(style.fill), 2.5);
        vote(parseColor(style.stroke), 1.5);
    }
    let best = null;
    for (const entry of votes.values())
        if (!best || entry.weight > best.weight)
            best = entry;
    return best?.color ?? null;
}
function sampleRadius(elements, fallback) {
    const values = elements
        .filter(isVisible)
        .map((el) => Number.parseFloat(getComputedStyle(el).borderTopLeftRadius))
        .filter((value) => Number.isFinite(value) && value > 0 && value < 200)
        .sort((a, b) => a - b);
    if (!values.length)
        return fallback;
    const median = values[Math.floor(values.length / 2)];
    return `${Math.round(median)}px`;
}
function sampleMaxWidth(scope) {
    const widths = Array.from(scope.querySelectorAll('main, section, header, footer, [class*="container"], [class*="wrapper"], main > *, section > *'))
        .slice(0, 120)
        .map((el) => Number.parseFloat(getComputedStyle(el).maxWidth))
        .filter((value) => Number.isFinite(value) && value >= 640 && value <= 1600)
        .sort((a, b) => b - a);
    return widths.length ? `${Math.round(widths[0])}px` : DEFAULT_SITE_THEME.maxWidth;
}
const cleanText = (value) => (value ?? '').replace(/\s+/g, ' ').trim();
function sampleBrandName(scope) {
    const candidates = [
        scope.querySelector('[class*="logo" i]'),
        scope.querySelector('header a[href="/"], header a[href="#top"], header a[href="./"], nav a[href="/"]'),
        scope.querySelector('header strong, header b'),
    ];
    for (const candidate of candidates) {
        const text = cleanText(candidate?.textContent);
        if (text && text.length <= 32)
            return text;
    }
    const title = cleanText(document.title).split(/\s[|–—·-]\s/)[0];
    return title && title.length <= 32 ? title : DEFAULT_SITE_THEME.brandName;
}
function sampleNavLinks(scope) {
    const nav = scope.querySelector('header nav, nav');
    const links = Array.from(nav?.querySelectorAll('a') ?? [])
        .map((link) => cleanText(link.textContent))
        .filter((text) => text && text.length <= 24);
    const unique = [...new Set(links)].slice(0, 4);
    return unique.length >= 2 ? unique : DEFAULT_SITE_THEME.navLinks;
}
/** Reads the live page. Anything it can't find falls back to a calm default. */
export function sampleSiteTheme(scope = document.body) {
    try {
        const bodyStyle = getComputedStyle(document.body);
        const heading = Array.from(scope.querySelectorAll('h1, h2')).find(isVisible);
        const paragraph = Array.from(scope.querySelectorAll('p')).find(isVisible);
        const paper = effectiveBackground(document.body);
        const ink = parseColor(paragraph ? getComputedStyle(paragraph).color : bodyStyle.color) ?? parseColor(DEFAULT_SITE_THEME.ink);
        const lightPage = luminance(paper) > 0.45;
        const accent = sampleAccent(scope) ?? parseColor(DEFAULT_SITE_THEME.accent);
        const white = { r: 255, g: 255, b: 255, a: 1 };
        const black = { r: 0, g: 0, b: 0, a: 1 };
        const accentInk = contrast(accent, white) >= contrast(accent, black) ? white : black;
        const cards = Array.from(scope.querySelectorAll('article, li, [class*="card"], img, figure')).slice(0, 80);
        const buttons = Array.from(scope.querySelectorAll('button, [class*="btn"], [role="button"]')).slice(0, 40);
        return {
            fontBody: bodyStyle.fontFamily || DEFAULT_SITE_THEME.fontBody,
            fontHeading: heading ? getComputedStyle(heading).fontFamily : bodyStyle.fontFamily,
            ink: toHex(ink),
            muted: toHex(mix(ink, paper, 0.38)),
            paper: toHex(paper),
            surface: toHex(lightPage ? mix(paper, white, 0.7) : mix(paper, white, 0.06)),
            tint: toHex(mix(paper, accent, lightPage ? 0.08 : 0.16)),
            line: `rgba(${Math.round(ink.r)}, ${Math.round(ink.g)}, ${Math.round(ink.b)}, 0.12)`,
            accent: toHex(accent),
            accentInk: toHex(accentInk),
            radius: sampleRadius(cards, DEFAULT_SITE_THEME.radius),
            buttonRadius: sampleRadius(buttons, DEFAULT_SITE_THEME.buttonRadius),
            maxWidth: sampleMaxWidth(scope),
            brandName: sampleBrandName(scope),
            navLinks: sampleNavLinks(scope),
        };
    }
    catch {
        return DEFAULT_SITE_THEME;
    }
}
/** The theme as the custom properties the Library's patterns are written against. */
export function themeVariables(theme) {
    return {
        '--fx-font-body': theme.fontBody,
        '--fx-font-heading': theme.fontHeading,
        '--fx-ink': theme.ink,
        '--fx-muted': theme.muted,
        '--fx-paper': theme.paper,
        '--fx-surface': theme.surface,
        '--fx-tint': theme.tint,
        '--fx-line': theme.line,
        '--fx-accent': theme.accent,
        '--fx-accent-ink': theme.accentInk,
        '--fx-radius': theme.radius,
        '--fx-button-radius': theme.buttonRadius,
        '--fx-max-width': theme.maxWidth,
    };
}
//# sourceMappingURL=site-theme.js.map