/* ===============================================================
   FROAM STUDIO — FONT SOURCES
   The editor's font picker offers families the host site may not
   ship. This module knows where each family lives (Google Fonts /
   Fontshare) so the design's fonts ACTUALLY load everywhere the
   design is applied: editor preview, React runtime, and codegen
   (@import in froam.generated.css).

   KEEP IN SYNC with the mirror map in lib/codegen.mjs — codegen is
   plain .mjs shared by the CLI and can't import TS.
   =============================================================== */
/** Google Fonts families with the weights that exist for each. */
export const GOOGLE_FONTS = {
    Inter: '400;500;600;700;800;900',
    Manrope: '400;500;600;700;800',
    'DM Sans': '400;500;700',
    'Plus Jakarta Sans': '400;500;600;700;800',
    'Space Grotesk': '400;500;600;700',
    Urbanist: '400;500;600;700;800;900',
    Outfit: '400;500;600;700;800;900',
    Poppins: '400;500;600;700;800;900',
    Montserrat: '400;500;600;700;800;900',
    'Playfair Display': '400;500;600;700;800;900',
    'Cormorant Garamond': '400;500;600;700',
    Lora: '400;500;600;700',
    Merriweather: '400;700;900',
    Fraunces: '400;500;600;700;800;900',
    'JetBrains Mono': '400;500;600;700;800',
    'IBM Plex Mono': '400;500;600;700',
    'Space Mono': '400;700',
};
/** Fontshare families (free ITF fonts) with their available weights. */
export const FONTSHARE_FONTS = {
    Satoshi: 'satoshi@400,500,700,900',
    'Cabinet Grotesk': 'cabinet-grotesk@400,500,700,800',
};
/** First family name out of a CSS font-family value, unquoted. */
export function primaryFamily(fontFamilyValue) {
    if (!fontFamilyValue)
        return null;
    const first = fontFamilyValue.split(',')[0]?.trim().replace(/^["']|["']$/g, '');
    return first || null;
}
/**
 * Stylesheet URLs that load the given families (unknown/system
 * families are skipped — they need no loading). Stable order so
 * callers can diff by URL.
 */
export function fontStylesheetUrls(families) {
    const google = [];
    const fontshare = [];
    const seen = new Set();
    for (const family of families) {
        if (!family || seen.has(family))
            continue;
        seen.add(family);
        if (GOOGLE_FONTS[family]) {
            google.push(`family=${encodeURIComponent(family).replace(/%20/g, '+')}:wght@${GOOGLE_FONTS[family]}`);
        }
        else if (FONTSHARE_FONTS[family]) {
            fontshare.push(`f[]=${FONTSHARE_FONTS[family]}`);
        }
    }
    const urls = [];
    if (google.length)
        urls.push(`https://fonts.googleapis.com/css2?${google.sort().join('&')}&display=swap`);
    if (fontshare.length)
        urls.push(`https://api.fontshare.com/v2/css?${fontshare.sort().join('&')}&display=swap`);
    return urls;
}
/** Pull every font-family a draft store references (styles + injected HTML). */
export function collectStoreFontFamilies(store) {
    const families = new Set();
    for (const [path, draft] of Object.entries(store ?? {})) {
        if (!draft)
            continue;
        const fromStyle = primaryFamily(draft.styles?.fontFamily);
        if (fromStyle)
            families.add(fromStyle);
        // Injected blocks carry inline styles inside their HTML payload,
        // with quotes encoded as entities — decode before scanning.
        if (path.startsWith('__froam_injection__:') && draft.text) {
            const text = draft.text.replace(/&quot;|&#0?34;/g, '"').replace(/&#0?39;|&apos;/g, "'");
            for (const match of text.matchAll(/font-family:\s*([^;}<]+)/gi)) {
                const family = primaryFamily(match[1]);
                if (family)
                    families.add(family);
            }
        }
    }
    return [...families];
}
/**
 * Idempotently sync <link data-froam-fonts> tags in <head> so exactly
 * the given stylesheet URLs are loaded. Safe to call on every store
 * change — it only touches the DOM when the URL set actually differs.
 */
export function ensureFontLinks(families) {
    if (typeof document === 'undefined')
        return;
    const wanted = fontStylesheetUrls(families);
    const existing = document.head.querySelectorAll('link[data-froam-fonts]');
    const current = new Set();
    existing.forEach((link) => {
        if (wanted.includes(link.href) || wanted.includes(link.getAttribute('href') ?? '')) {
            current.add(link.getAttribute('href') ?? link.href);
        }
        else {
            link.remove();
        }
    });
    for (const url of wanted) {
        if (current.has(url))
            continue;
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = url;
        link.setAttribute('data-froam-fonts', 'true');
        document.head.appendChild(link);
    }
}
//# sourceMappingURL=fontSources.js.map