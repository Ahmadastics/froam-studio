import { getRoot, getCanvasHost, rgbToHex, readImageUrl } from './dom.js';
export function collectCSSVars() {
    const vars = [];
    try {
        const rootStyles = window.getComputedStyle(document.documentElement);
        // Check all stylesheets for custom properties
        for (const sheet of Array.from(document.styleSheets)) {
            try {
                for (const rule of Array.from(sheet.cssRules)) {
                    if (rule instanceof CSSStyleRule && rule.selectorText === ':root') {
                        for (const prop of Array.from(rule.style)) {
                            if (prop.startsWith('--') && !prop.startsWith('--fs-')) {
                                vars.push({ name: prop, value: rootStyles.getPropertyValue(prop).trim() });
                            }
                        }
                    }
                }
            }
            catch { /* cross-origin sheets */ }
        }
        // Also check inline styles on :root
        for (const prop of Array.from(document.documentElement.style)) {
            if (prop.startsWith('--') && !prop.startsWith('--fs-') && !vars.some((v) => v.name === prop)) {
                vars.push({ name: prop, value: document.documentElement.style.getPropertyValue(prop).trim() });
            }
        }
    }
    catch { /* safe fallback */ }
    return vars;
}
export function readCanvasState() {
    const host = getCanvasHost();
    if (!host) {
        return { background: '#050505', text: '#ffffff', imageUrl: '' };
    }
    const computed = window.getComputedStyle(host);
    return {
        background: computed.backgroundColor === 'rgba(0, 0, 0, 0)' ? '#050505' : rgbToHex(computed.backgroundColor),
        text: rgbToHex(computed.color),
        imageUrl: readImageUrl(computed.backgroundImage),
    };
}
export async function capturePageThumb() {
    try {
        const root = getRoot();
        if (!root)
            return null;
        const rect = root.getBoundingClientRect();
        if (rect.width <= 0 || rect.height <= 0)
            return null;
        const scale = Math.min(360 / rect.width, 220 / rect.height, 1);
        const w = Math.round(rect.width * scale);
        const h = Math.round(rect.height * scale);
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx)
            return null;
        const clone = root.cloneNode(true);
        clone.querySelectorAll('[data-chef-editor-root="true"], #froam-editor-portal, script').forEach((node) => node.remove());
        clone.style.width = `${rect.width}px`;
        clone.style.height = `${rect.height}px`;
        clone.style.overflow = 'hidden';
        clone.style.transform = 'none';
        clone.style.position = 'relative';
        const html = new XMLSerializer().serializeToString(clone);
        const svg = [
            `<svg xmlns="http://www.w3.org/2000/svg" width="${rect.width}" height="${rect.height}">`,
            '<foreignObject width="100%" height="100%">',
            `<div xmlns="http://www.w3.org/1999/xhtml">${html}</div>`,
            '</foreignObject>',
            '</svg>',
        ].join('');
        const image = new Image();
        const loaded = new Promise((resolve) => {
            image.onload = () => {
                try {
                    ctx.drawImage(image, 0, 0, rect.width, rect.height, 0, 0, w, h);
                    resolve(canvas.toDataURL('image/jpeg', 0.72));
                }
                catch {
                    resolve(null);
                }
            };
            image.onerror = () => resolve(null);
        });
        image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
        const snapshot = await loaded;
        if (snapshot)
            return snapshot;
        const computed = window.getComputedStyle(root);
        ctx.fillStyle = computed.backgroundColor !== 'rgba(0, 0, 0, 0)' ? computed.backgroundColor : '#050505';
        ctx.fillRect(0, 0, w, h);
        const children = Array.from(root.querySelectorAll('[data-froam-canvas], section, header, footer, main, article, div[class]')).slice(0, 30);
        for (const child of children) {
            if (child.closest('[data-chef-editor-root="true"]'))
                continue;
            const cr = child.getBoundingClientRect();
            if (cr.width < 4 || cr.height < 4)
                continue;
            const cc = window.getComputedStyle(child);
            if (cc.display === 'none' || cc.visibility === 'hidden')
                continue;
            const x = (cr.left - rect.left) * scale;
            const y = (cr.top - rect.top) * scale;
            const cw = cr.width * scale;
            const ch = cr.height * scale;
            const bg = cc.backgroundColor;
            if (bg && bg !== 'rgba(0, 0, 0, 0)') {
                ctx.fillStyle = bg;
                const r = Math.min(parseFloat(cc.borderTopLeftRadius) * scale || 0, cw / 2, ch / 2);
                if (ctx.roundRect) {
                    ctx.beginPath();
                    ctx.roundRect(x, y, cw, ch, r);
                    ctx.fill();
                }
                else {
                    ctx.fillRect(x, y, cw, ch);
                }
            }
        }
        return canvas.toDataURL('image/jpeg', 0.65);
    }
    catch {
        return null;
    }
}
export function syncFroamArtboardMetadata(element) {
    if (element.dataset.froamArtboard !== 'true')
        return;
    const rect = element.getBoundingClientRect();
    element.dataset.froamFrameWidth = String(Math.max(1, Math.round(rect.width)));
    element.dataset.froamFrameHeight = String(Math.max(1, Math.round(rect.height)));
    element.dataset.froamFramePreset = 'custom';
}
export function buildGradientCSS(type, angle, stops) {
    const sortedStops = [...stops].sort((a, b) => a.position - b.position);
    const stopStr = sortedStops.map((s) => `${s.color} ${s.position}%`).join(', ');
    return type === 'linear'
        ? `linear-gradient(${angle}deg, ${stopStr})`
        : `radial-gradient(circle, ${stopStr})`;
}
//# sourceMappingURL=canvas.js.map