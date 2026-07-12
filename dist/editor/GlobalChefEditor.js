import { jsxs as _jsxs, jsx as _jsx, Fragment as _Fragment } from "react/jsx-runtime";
import { useCallback, useEffect, useMemo, useRef, useState, } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { AlignCenter, AlignHorizontalDistributeCenter, AlignHorizontalJustifyCenter, AlignLeft, AlignRight, AlignVerticalDistributeCenter, AlignVerticalJustifyCenter, Bold, Box, ChevronDown, ClipboardCheck, Clock, Code, Command, Copy, Download, Eraser, Eye, EyeOff, FileImage, FileText, GitCommit, Grip, ImagePlus, Italic, Keyboard, Layers, LayoutGrid, Link, Minus, Monitor, MousePointer, Smartphone, Tablet, MousePointer2, Move, Paintbrush, Palette, PencilLine, Plus, Redo2, RotateCw, Save, Search, SlidersHorizontal, Sparkles, Square, SquareDashedBottom, Strikethrough, Type, Underline, Undo2, Unlink, Variable, Maximize2, X, Zap, Coins, AlignCenterHorizontal, AlignCenterVertical, Timer, } from 'lucide-react';
import FroamSectionBoundary from './FroamSectionBoundary.js';
import { apiGetFresh, apiPost } from '../lib/api.js';
import { bridgeUrl } from '../lib/bridge.js';
import FroamResizeHandles from './FroamResizeHandles.js';
import FroamFloatingBar from './FroamFloatingBar.js';
import FroamContextMenu from './FroamContextMenu.js';
import FroamExport from './FroamExport.js';
import FroamShortcutOverlay from './FroamShortcutOverlay.js';
import FroamSmartGuides from './FroamSmartGuides.js';
import FroamVersionPanel from './FroamVersionPanel.js';
import FroamSitePlanner from './FroamSitePlanner.js';
import { createFroamLibraryComponent } from './FroamComponentCatalog.js';
import FroamToolbar from './FroamToolbar.js';
import FroamIntel from './FroamIntel.js';
import FroamLayersPanel from './FroamLayersPanel.js';
import FroamDesignPanel from './FroamDesignPanel.js';
import FroamInspirationPanel from './FroamInspirationPanel.js';
import FroamShapeLibrary from './FroamShapeLibrary.js';
import FroamPersonaEditor from './FroamPersonaEditor.js';
import { getFroamRootElement } from '../config.js';
import { useFroamRouteKey } from '../routing.js';
import { DEFAULT_FROAM_PERSONA, FROAM_PERSONA_PATH, PERSONA_STORAGE_KEY, readFroamPersonaDraft, sanitizeFroamPersona, isFroamPersonaPath, } from './froamPersona.js';
const cursorOptions = ['auto', 'default', 'pointer', 'grab', 'grabbing', 'text', 'crosshair', 'move', 'not-allowed', 'wait', 'zoom-in', 'zoom-out', 'none'];
/* ═══════════════════════════════════════════════════════════════
   Constants
   ═══════════════════════════════════════════════════════════════ */
const STORAGE_KEY = 'froam-editor-store-v1';
const HISTORY_KEY = 'froam-history-v1';
const MAX_HISTORY = 6;
const MAX_HISTORY_BYTES = 600_000;
const MAX_INLINE_ASSET_LENGTH = 40_000;
const MAX_PERSONA_IMAGE_BYTES = 400_000;
const SAVE_META_KEY = 'froam-last-save-v1';
/* Migrate drafts saved under pre-3.1 (Run'Am-branded) localStorage keys. */
if (typeof window !== 'undefined') {
    try {
        const legacyPairs = [
            ['runam-chef-editor-store-v1', STORAGE_KEY],
            ['runam-froam-history-v1', HISTORY_KEY],
            ['runam-froam-last-save-v1', SAVE_META_KEY],
        ];
        for (const [oldKey, newKey] of legacyPairs) {
            const legacy = window.localStorage.getItem(oldKey);
            if (legacy !== null && window.localStorage.getItem(newKey) === null) {
                window.localStorage.setItem(newKey, legacy);
            }
        }
    }
    catch { /* storage unavailable */ }
}
const CHEF_BUTTON_START = { x: 20, y: 480 };
const CANVAS_KEY = '__froam_canvas__';
const INJECTION_KEY = '__froam_injection__';
const ROOT_PARENT_KEY = '__froam_root__';
const VIEWPORT_MODES = [
    { id: 'desktop', label: 'Desktop', width: null, height: null },
    { id: 'tablet', label: 'Tablet', width: 768, height: 1024 },
    { id: 'mobile', label: 'Mobile', width: 390, height: 844 },
];
// ID of the portal element Froam injects to host the device shell
const DEVICE_SHELL_ID = 'froam-device-shell';
const fontOptions = [
    { label: 'Editorial Sans', value: '"Editorial Sans", "Satoshi", system-ui, sans-serif' },
    { label: 'Cabinet Grotesk', value: '"Cabinet Grotesk", "Satoshi", system-ui, sans-serif' },
    { label: 'Satoshi', value: 'Satoshi, system-ui, sans-serif' },
    { label: 'Neue Montreal', value: 'Neue Montreal, system-ui, sans-serif' },
    { label: 'Inter', value: 'Inter, system-ui, sans-serif' },
    { label: 'Manrope', value: 'Manrope, system-ui, sans-serif' },
    { label: 'DM Sans', value: '"DM Sans", system-ui, sans-serif' },
    { label: 'Plus Jakarta Sans', value: 'Plus Jakarta Sans, system-ui, sans-serif' },
    { label: 'Space Grotesk', value: 'Space Grotesk, system-ui, sans-serif' },
    { label: 'Urbanist', value: 'Urbanist, system-ui, sans-serif' },
    { label: 'Outfit', value: 'Outfit, system-ui, sans-serif' },
    { label: 'Poppins', value: 'Poppins, system-ui, sans-serif' },
    { label: 'Montserrat', value: 'Montserrat, system-ui, sans-serif' },
    { label: 'Avenir Next', value: '"Avenir Next", Avenir, system-ui, sans-serif' },
    { label: 'SF Pro', value: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", sans-serif' },
    { label: 'Playfair Display', value: '"Playfair Display", Georgia, serif' },
    { label: 'Cormorant Garamond', value: '"Cormorant Garamond", Georgia, serif' },
    { label: 'Lora', value: 'Lora, Georgia, serif' },
    { label: 'Merriweather', value: 'Merriweather, Georgia, serif' },
    { label: 'Fraunces', value: 'Fraunces, Georgia, serif' },
    { label: 'JetBrains Mono', value: 'JetBrains Mono, ui-monospace, monospace' },
    { label: 'IBM Plex Mono', value: '"IBM Plex Mono", ui-monospace, monospace' },
    { label: 'Space Mono', value: '"Space Mono", ui-monospace, monospace' },
];
const displayOptions = ['block', 'flex', 'grid', 'inline-flex', 'inline-block', 'inline', 'none'];
const flexDirectionOptions = ['row', 'row-reverse', 'column', 'column-reverse'];
const justifyOptions = ['flex-start', 'center', 'flex-end', 'space-between', 'space-around', 'space-evenly'];
const alignOptions = ['stretch', 'flex-start', 'center', 'flex-end', 'baseline'];
const positionOptions = ['static', 'relative', 'absolute', 'fixed', 'sticky'];
const overflowOptions = ['visible', 'hidden', 'scroll', 'auto'];
const borderStyleOptions = ['none', 'solid', 'dashed', 'dotted', 'double'];
const blendModeOptions = ['normal', 'multiply', 'screen', 'overlay', 'darken', 'lighten', 'color-dodge', 'color-burn', 'hard-light', 'soft-light', 'difference', 'exclusion'];
const textTransformOptions = ['none', 'uppercase', 'lowercase', 'capitalize'];
const persistedStyleKeys = [
    'backgroundColor', 'color', 'borderColor', 'borderRadius', 'borderTopLeftRadius', 'borderTopRightRadius',
    'borderBottomRightRadius', 'borderBottomLeftRadius', 'borderWidth', 'borderStyle', 'opacity', 'margin',
    'marginTop', 'marginRight', 'marginBottom', 'marginLeft', 'padding', 'paddingTop', 'paddingRight',
    'paddingBottom', 'paddingLeft', 'fontSize', 'fontFamily', 'fontWeight', 'fontStyle', 'textAlign',
    'lineHeight', 'letterSpacing', 'wordSpacing', 'textTransform', 'textDecorationLine', 'display',
    'flex', 'flexBasis', 'flexGrow', 'flexShrink', 'flexDirection', 'justifyContent', 'alignItems', 'flexWrap', 'gap', 'gridTemplateColumns',
    'gridTemplateRows', 'position', 'zIndex', 'overflow', 'cursor', 'width', 'height', 'minWidth',
    'maxWidth', 'minHeight', 'maxHeight', 'aspectRatio', 'boxSizing', 'left', 'top', 'right', 'bottom', 'transform', 'boxShadow', 'textShadow',
    'filter', 'backdropFilter', 'mixBlendMode', 'backgroundImage', 'backgroundSize',
    'backgroundPosition', 'backgroundRepeat', 'backgroundAttachment',
];
/* ═══════════════════════════════════════════════════════════════
   Utility functions
   ═══════════════════════════════════════════════════════════════ */
function loadStore() {
    if (typeof window === 'undefined')
        return {};
    try {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        if (!raw)
            return {};
        return sanitizeStore(JSON.parse(raw));
    }
    catch {
        return {};
    }
}
function saveStore(store) {
    if (typeof window === 'undefined')
        return;
    const serialized = JSON.stringify(sanitizeStore(store));
    try {
        window.localStorage.setItem(STORAGE_KEY, serialized);
    }
    catch {
        // History is disposable. Clear it first so a full browser store can never
        // take down the live editor.
        try {
            window.localStorage.removeItem(HISTORY_KEY);
        }
        catch { /* ignore */ }
        try {
            window.localStorage.setItem(STORAGE_KEY, serialized);
        }
        catch {
            // Keep the in-memory editor usable even when persistence is unavailable.
        }
    }
}
function isSafeDraftPath(path) {
    return path.trim().length > 0 && path.includes(':');
}
function loadPersonaPreference() {
    if (typeof window === 'undefined')
        return DEFAULT_FROAM_PERSONA;
    try {
        const raw = window.localStorage.getItem(PERSONA_STORAGE_KEY);
        return raw ? sanitizeFroamPersona(JSON.parse(raw)) : DEFAULT_FROAM_PERSONA;
    }
    catch {
        return DEFAULT_FROAM_PERSONA;
    }
}
function savePersonaPreference(persona) {
    if (typeof window === 'undefined')
        return;
    try {
        window.localStorage.setItem(PERSONA_STORAGE_KEY, JSON.stringify(sanitizeFroamPersona(persona)));
    }
    catch {
        // Keep editing usable even if profile persistence is unavailable.
    }
}
function personasEqual(left, right) {
    return left.name === right.name
        && left.tagline === right.tagline
        && left.imageUrl === right.imageUrl;
}
function stripPersonaDrafts(drafts) {
    const nextDrafts = { ...drafts };
    delete nextDrafts[FROAM_PERSONA_PATH];
    return nextDrafts;
}
function withPersonaDraft(drafts, persona) {
    return {
        ...stripPersonaDrafts(drafts),
        [FROAM_PERSONA_PATH]: { text: JSON.stringify(sanitizeFroamPersona(persona)) },
    };
}
function countRenderableDrafts(drafts) {
    return Object.keys(drafts).filter((path) => !isFroamPersonaPath(path)).length;
}
function sanitizeStore(store) {
    const nextStore = {};
    for (const [route, drafts] of Object.entries(store)) {
        const nextDrafts = {};
        for (const [path, draft] of Object.entries(drafts ?? {})) {
            if (path === CANVAS_KEY || isSafeDraftPath(path)) {
                nextDrafts[path] = draft;
            }
        }
        if (Object.keys(nextDrafts).length) {
            nextStore[route] = nextDrafts;
        }
    }
    return nextStore;
}
function loadHistory() {
    if (typeof window === 'undefined')
        return [];
    try {
        const raw = window.localStorage.getItem(HISTORY_KEY);
        return raw ? JSON.parse(raw).slice(0, MAX_HISTORY) : [];
    }
    catch {
        try {
            window.localStorage.removeItem(HISTORY_KEY);
        }
        catch { /* ignore */ }
        return [];
    }
}
function stripLargeInlineValue(value) {
    if (!value || value.length <= MAX_INLINE_ASSET_LENGTH)
        return value;
    return value.startsWith('data:') || value.includes('data:image/') ? undefined : value;
}
function compactHistoryStore(store, routeKey) {
    const routeStore = store[routeKey] ?? {};
    const compactRoute = {};
    Object.entries(routeStore).forEach(([path, draft]) => {
        const styles = draft.styles ? { ...draft.styles } : undefined;
        if (styles?.backgroundImage) {
            const compactBackground = stripLargeInlineValue(styles.backgroundImage);
            if (compactBackground)
                styles.backgroundImage = compactBackground;
            else
                delete styles.backgroundImage;
        }
        let text = draft.text;
        if (isInjectionPath(path) && text && text.length > MAX_INLINE_ASSET_LENGTH) {
            text = text.replace(/data:image\/[^"' )]+/gi, '');
        }
        compactRoute[path] = {
            ...draft,
            text,
            imageUrl: stripLargeInlineValue(draft.imageUrl),
            styles,
        };
    });
    return { [routeKey]: compactRoute };
}
function saveHistory(history) {
    const candidates = history.slice(0, MAX_HISTORY);
    const persisted = [];
    for (const entry of candidates) {
        const compactEntry = {
            ...entry,
            store: compactHistoryStore(entry.store, entry.routeKey),
        };
        const next = [...persisted, compactEntry];
        if (JSON.stringify(next).length > MAX_HISTORY_BYTES)
            break;
        persisted.push(compactEntry);
    }
    try {
        window.localStorage.setItem(HISTORY_KEY, JSON.stringify(persisted));
    }
    catch {
        // If another feature consumed the remaining quota, retain progressively
        // fewer entries. Never let optional history crash Froam.
        while (persisted.length > 0) {
            persisted.pop();
            try {
                window.localStorage.setItem(HISTORY_KEY, JSON.stringify(persisted));
                return persisted;
            }
            catch {
                // Continue shrinking.
            }
        }
        try {
            window.localStorage.removeItem(HISTORY_KEY);
        }
        catch { /* ignore */ }
    }
    return persisted;
}
function getRoot() {
    return getFroamRootElement();
}
function getCanvasHost() {
    const root = getRoot();
    return root?.querySelector('[data-froam-canvas]') ?? null;
}
function applyGlobalCSS(css) {
    if (typeof window === 'undefined')
        return;
    let styleEl = document.getElementById('froam-global-styles');
    if (!styleEl) {
        styleEl = document.createElement('style');
        styleEl.id = 'froam-global-styles';
        document.head.appendChild(styleEl);
    }
    styleEl.textContent = css || '';
}
function shouldSkipElement(element) {
    const tag = element.tagName.toLowerCase();
    if (['html', 'body', 'script', 'style', 'path', 'svg'].includes(tag))
        return true;
    if (element.id === 'root')
        return true;
    if (element.dataset.chefEditorRoot === 'true')
        return true;
    return false;
}
function getElementPath(element, root) {
    const segments = [];
    let current = element;
    while (current && current !== root) {
        const parent = current.parentElement;
        if (!parent)
            break;
        const tag = current.tagName.toLowerCase();
        const currentTag = current.tagName;
        const siblings = Array.from(parent.children).filter((child) => child instanceof HTMLElement && child.tagName === currentTag);
        const index = Math.max(1, siblings.indexOf(current) + 1);
        segments.unshift(`${tag}:${index}`);
        current = parent;
    }
    return segments.join('/');
}
function findElementByPath(root, path) {
    if (!isSafeDraftPath(path))
        return null;
    const segments = path.split('/').filter(Boolean);
    let current = root;
    for (const segment of segments) {
        if (!current)
            return null;
        const [tag, position] = segment.split(':');
        const index = Math.max(0, Number(position) - 1);
        const next = Array.from(current.children).filter((child) => child instanceof HTMLElement && child.tagName.toLowerCase() === tag)[index];
        if (!next)
            return null;
        current = next;
    }
    return current;
}
function readNumber(value, fallback) {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : fallback;
}
function camelToKebab(str) {
    return str.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);
}
function readCssUrl(value) {
    const match = value.match(/url\((['"]?)(.*?)\1\)/i);
    return match?.[2] ?? null;
}
function smallHash(value) {
    let hash = 5381;
    for (let i = 0; i < value.length; i += 1) {
        hash = ((hash << 5) + hash) ^ value.charCodeAt(i);
    }
    return (hash >>> 0).toString(16).padStart(8, '0');
}
function describeImageSource(src) {
    const mime = src.startsWith('data:') ? src.match(/^data:([^;]+);/)?.[1] ?? 'data-uri' : 'url';
    const kind = src.startsWith('data:') ? 'embedded data URI' : 'external URL';
    const preview = src.length > 520 ? `${src.slice(0, 520)}...` : src;
    return [
        `kind: ${kind}`,
        `mime: ${mime}`,
        `chars: ${src.length}`,
        `hash: ${smallHash(src)}`,
        `preview: ${preview}`,
    ].join('\n    ');
}
function parseInjectionDraft(draft) {
    if (!draft.text)
        return null;
    try {
        const parsed = JSON.parse(draft.text);
        if (typeof parsed.html !== 'string')
            return null;
        return {
            html: parsed.html,
            parentPath: typeof parsed.parentPath === 'string' ? parsed.parentPath : ROOT_PARENT_KEY,
            order: typeof parsed.order === 'number' ? parsed.order : 0,
        };
    }
    catch {
        return null;
    }
}
function compactText(value, max = 500) {
    const cleaned = value.replace(/\s+/g, ' ').trim();
    return cleaned.length > max ? `${cleaned.slice(0, max)}...` : cleaned;
}
function buildFroamChangeReport(params) {
    const { routeKey, viewportMode, viewportStoreKey, drafts, persona } = params;
    const entries = Object.entries(stripPersonaDrafts(drafts));
    const canvasDraft = drafts[CANVAS_KEY];
    const insertedBlocks = entries
        .filter(([path]) => path.startsWith(`${INJECTION_KEY}:`))
        .map(([, draft]) => parseInjectionDraft(draft))
        .filter((draft) => draft !== null);
    const editedElements = entries.filter(([path]) => path !== CANVAS_KEY && !path.startsWith(`${INJECTION_KEY}:`));
    const imageRefs = [];
    let styleCount = 0;
    let textCount = 0;
    const lines = [
        '# Froam Design Change Report',
        '',
        `Generated: ${new Date().toISOString()}`,
        `Route: ${routeKey}`,
        `Viewport: ${viewportMode}`,
        `Store key: ${viewportStoreKey}`,
        `Froam persona: ${persona.name} (${persona.role})`,
        '',
        '## Summary',
        `- Edited elements: ${editedElements.length}`,
        `- Inserted blocks/shapes: ${insertedBlocks.length}`,
    ];
    if (canvasDraft?.styles) {
        styleCount += Object.keys(canvasDraft.styles).length;
        const canvasImage = typeof canvasDraft.styles.backgroundImage === 'string'
            ? readCssUrl(canvasDraft.styles.backgroundImage)
            : null;
        if (canvasImage) {
            imageRefs.push(`[canvas background]\n    ${describeImageSource(canvasImage)}`);
        }
    }
    for (const [path, draft] of editedElements) {
        if (typeof draft.text === 'string')
            textCount += 1;
        if (draft.styles) {
            styleCount += Object.keys(draft.styles).length;
            if (typeof draft.styles.backgroundImage === 'string') {
                const image = readCssUrl(draft.styles.backgroundImage);
                if (image)
                    imageRefs.push(`[${path} background]\n    ${describeImageSource(image)}`);
            }
        }
        if (typeof draft.imageUrl === 'string') {
            imageRefs.push(`[${path} image]\n    ${describeImageSource(draft.imageUrl)}`);
        }
    }
    lines.push(`- Text changes: ${textCount}`);
    lines.push(`- Style properties changed: ${styleCount}`);
    lines.push(`- Image references: ${imageRefs.length}`);
    if (canvasDraft?.styles && Object.keys(canvasDraft.styles).length > 0) {
        lines.push('', '## Page / Canvas Changes');
        for (const [key, value] of Object.entries(canvasDraft.styles)) {
            if (key === 'backgroundImage') {
                const image = readCssUrl(value);
                lines.push(`- ${key}: ${image ? `[image ${smallHash(image)}]` : value}`);
            }
            else {
                lines.push(`- ${key}: ${value}`);
            }
        }
    }
    if (insertedBlocks.length > 0) {
        lines.push('', '## Inserted Blocks / Shapes');
        insertedBlocks
            .sort((a, b) => a.order - b.order)
            .forEach((block, index) => {
            lines.push(`### Block ${index + 1}`);
            lines.push(`- Parent: ${block.parentPath}`);
            lines.push(`- Order: ${block.order}`);
            lines.push('```html');
            lines.push(block.html);
            lines.push('```');
        });
    }
    if (editedElements.length > 0) {
        lines.push('', '## Edited Existing Elements');
        editedElements.forEach(([path, draft], index) => {
            lines.push(`### ${index + 1}. ${path}`);
            if (typeof draft.text === 'string')
                lines.push(`- Text: ${compactText(draft.text)}`);
            if (typeof draft.imageUrl === 'string')
                lines.push(`- Image: ${smallHash(draft.imageUrl)} (${draft.imageUrl.length} chars)`);
            if (draft.styles && Object.keys(draft.styles).length > 0) {
                lines.push('- Styles:');
                for (const [key, value] of Object.entries(draft.styles)) {
                    if (key === 'backgroundImage') {
                        const image = readCssUrl(value);
                        lines.push(`  - ${key}: ${image ? `[image ${smallHash(image)}]` : value}`);
                    }
                    else {
                        lines.push(`  - ${key}: ${value}`);
                    }
                }
            }
        });
    }
    if (imageRefs.length > 0) {
        lines.push('', '## Image Manifest');
        imageRefs.forEach((ref, index) => {
            lines.push(`### Image ${index + 1}`);
            lines.push(ref);
        });
    }
    lines.push('', '## Notes For Codex', '- This report is the readable implementation brief.', '- If exact embedded image data is needed, also paste Froam\'s "Copy page JSON" output.', '- Element paths are Froam DOM paths. Inserted blocks include their HTML.', '', '## Raw Froam Store JSON Snapshot', '```json', JSON.stringify(drafts, null, 2), '```');
    return lines.join('\n');
}
function parseTransformValues(transformStr) {
    const result = { rotate: 0, scaleX: 1, scaleY: 1, skewX: 0, skewY: 0, translateX: 0, translateY: 0 };
    if (!transformStr || transformStr === 'none')
        return result;
    // Parse matrix(a, b, c, d, tx, ty)
    const matrixMatch = transformStr.match(/matrix\(([^)]+)\)/);
    if (matrixMatch) {
        const parts = matrixMatch[1].split(',').map((s) => parseFloat(s.trim()));
        if (parts.length >= 6) {
            const [a, b, c, d, tx, ty] = parts;
            result.rotate = Math.round(Math.atan2(b, a) * (180 / Math.PI));
            result.scaleX = Math.round(Math.sqrt(a * a + b * b) * 10) / 10;
            result.scaleY = Math.round(Math.sqrt(c * c + d * d) * 10) / 10;
            result.translateX = Math.round(tx);
            result.translateY = Math.round(ty);
        }
        return result;
    }
    // Parse individual functions
    const rotateMatch = transformStr.match(/rotate\(([\d.-]+)deg\)/);
    if (rotateMatch)
        result.rotate = parseFloat(rotateMatch[1]);
    const scaleXMatch = transformStr.match(/scaleX\(([\d.-]+)\)/);
    if (scaleXMatch)
        result.scaleX = parseFloat(scaleXMatch[1]);
    const scaleYMatch = transformStr.match(/scaleY\(([\d.-]+)\)/);
    if (scaleYMatch)
        result.scaleY = parseFloat(scaleYMatch[1]);
    const scaleMatch = transformStr.match(/scale\(([\d.-]+)\)/);
    if (scaleMatch) {
        result.scaleX = parseFloat(scaleMatch[1]);
        result.scaleY = parseFloat(scaleMatch[1]);
    }
    const skewXMatch = transformStr.match(/skewX\(([\d.-]+)deg\)/);
    if (skewXMatch)
        result.skewX = parseFloat(skewXMatch[1]);
    const skewYMatch = transformStr.match(/skewY\(([\d.-]+)deg\)/);
    if (skewYMatch)
        result.skewY = parseFloat(skewYMatch[1]);
    const translateXMatch = transformStr.match(/translateX\(([\d.-]+)px\)/);
    if (translateXMatch)
        result.translateX = parseFloat(translateXMatch[1]);
    const translateYMatch = transformStr.match(/translateY\(([\d.-]+)px\)/);
    if (translateYMatch)
        result.translateY = parseFloat(translateYMatch[1]);
    return result;
}
function rgbToHex(value) {
    if (value.startsWith('#'))
        return value;
    const match = value.match(/\d+(\.\d+)?/g);
    if (!match || match.length < 3)
        return '#ffffff';
    const [r, g, b] = match.map((part) => Math.round(Number(part)));
    return `#${[r, g, b].map((part) => part.toString(16).padStart(2, '0')).join('')}`;
}
function readImageUrl(value) {
    const match = value.match(/url\((['"]?)(.*?)\1\)/i);
    return match?.[2] ?? '';
}
function buildSelection(element, path) {
    try {
        const c = window.getComputedStyle(element);
        const imageUrl = element instanceof HTMLImageElement ? element.currentSrc || element.src || '' : readImageUrl(c.backgroundImage);
        // Parse transform matrix to get rotate/scale/skew/translate
        const transformValues = parseTransformValues(c.transform);
        // Normalize lineHeight: computed gives px, convert to ratio using fontSize
        const fontSizePx = readNumber(c.fontSize, 16);
        const lineHeightPx = readNumber(c.lineHeight, fontSizePx * 1.5);
        const lineHeightRatio = fontSizePx > 0 ? Math.round((lineHeightPx / fontSizePx) * 10) / 10 : 1.5;
        return {
            path,
            label: `${element.tagName.toLowerCase()}${element.className && typeof element.className === 'string' ? `.${element.className.split(' ').filter(Boolean).slice(0, 2).join('.')}` : ''}`,
            text: element.innerText || '',
            background: c.backgroundColor === 'rgba(0, 0, 0, 0)' ? '#ffffff' : rgbToHex(c.backgroundColor),
            color: rgbToHex(c.color),
            borderColor: c.borderColor === 'rgba(0, 0, 0, 0)' ? '#d1d5db' : rgbToHex(c.borderColor),
            borderWidth: readNumber(c.borderTopWidth, 0),
            borderStyle: c.borderTopStyle || 'none',
            borderRadiusTL: readNumber(c.borderTopLeftRadius, 0),
            borderRadiusTR: readNumber(c.borderTopRightRadius, 0),
            borderRadiusBR: readNumber(c.borderBottomRightRadius, 0),
            borderRadiusBL: readNumber(c.borderBottomLeftRadius, 0),
            opacity: readNumber(c.opacity, 1),
            marginTop: readNumber(c.marginTop, 0),
            marginRight: readNumber(c.marginRight, 0),
            marginBottom: readNumber(c.marginBottom, 0),
            marginLeft: readNumber(c.marginLeft, 0),
            paddingTop: readNumber(c.paddingTop, 0),
            paddingRight: readNumber(c.paddingRight, 0),
            paddingBottom: readNumber(c.paddingBottom, 0),
            paddingLeft: readNumber(c.paddingLeft, 0),
            width: c.width || 'auto',
            height: c.height || 'auto',
            minWidth: c.minWidth === '0px' ? '' : c.minWidth,
            maxWidth: c.maxWidth === 'none' ? '' : c.maxWidth,
            minHeight: c.minHeight === '0px' ? '' : c.minHeight,
            maxHeight: c.maxHeight === 'none' ? '' : c.maxHeight,
            aspectRatio: c.aspectRatio === 'auto' ? '' : c.aspectRatio,
            fontSize: fontSizePx,
            fontFamily: c.fontFamily || 'Satoshi, system-ui, sans-serif',
            fontWeight: c.fontWeight || '400',
            fontStyle: c.fontStyle || 'normal',
            textAlign: c.textAlign || 'start',
            lineHeight: lineHeightRatio,
            letterSpacing: readNumber(c.letterSpacing, 0),
            wordSpacing: readNumber(c.wordSpacing, 0),
            textTransform: c.textTransform || 'none',
            textDecoration: c.textDecorationLine || 'none',
            display: c.display || 'block',
            flexDirection: c.flexDirection || 'row',
            justifyContent: c.justifyContent || 'flex-start',
            alignItems: c.alignItems || 'stretch',
            flexWrap: c.flexWrap || 'nowrap',
            gap: readNumber(c.gap, 0),
            gridTemplateColumns: c.gridTemplateColumns === 'none' ? '' : c.gridTemplateColumns,
            gridTemplateRows: c.gridTemplateRows === 'none' ? '' : c.gridTemplateRows,
            position: c.position || 'static',
            zIndex: readNumber(c.zIndex, 0),
            overflow: c.overflow || 'visible',
            cursor: c.cursor || 'auto',
            rotate: transformValues.rotate,
            scaleX: transformValues.scaleX,
            scaleY: transformValues.scaleY,
            skewX: transformValues.skewX,
            skewY: transformValues.skewY,
            translateX: transformValues.translateX,
            translateY: transformValues.translateY,
            boxShadow: c.boxShadow === 'none' ? '' : c.boxShadow,
            textShadow: c.textShadow === 'none' ? '' : c.textShadow,
            mixBlendMode: c.mixBlendMode || 'normal',
            filter: c.filter === 'none' ? '' : c.filter,
            backdropFilter: c.backdropFilter === 'none' ? '' : (c.backdropFilter || ''),
            imageUrl,
        };
    }
    catch {
        // Element may be disconnected from DOM — return safe defaults
        return {
            path,
            label: 'unknown',
            text: '',
            background: '#ffffff',
            color: '#000000',
            borderColor: '#d1d5db',
            borderWidth: 0,
            borderStyle: 'none',
            borderRadiusTL: 0,
            borderRadiusTR: 0,
            borderRadiusBR: 0,
            borderRadiusBL: 0,
            opacity: 1,
            marginTop: 0,
            marginRight: 0,
            marginBottom: 0,
            marginLeft: 0,
            paddingTop: 0,
            paddingRight: 0,
            paddingBottom: 0,
            paddingLeft: 0,
            width: 'auto',
            height: 'auto',
            minWidth: '',
            maxWidth: '',
            minHeight: '',
            maxHeight: '',
            aspectRatio: '',
            fontSize: 16,
            fontFamily: 'Satoshi, system-ui, sans-serif',
            fontWeight: '400',
            fontStyle: 'normal',
            textAlign: 'start',
            lineHeight: 1.5,
            letterSpacing: 0,
            wordSpacing: 0,
            textTransform: 'none',
            textDecoration: 'none',
            display: 'block',
            flexDirection: 'row',
            justifyContent: 'flex-start',
            alignItems: 'stretch',
            flexWrap: 'nowrap',
            gap: 0,
            gridTemplateColumns: '',
            gridTemplateRows: '',
            position: 'static',
            zIndex: 0,
            overflow: 'visible',
            cursor: 'auto',
            rotate: 0,
            scaleX: 1,
            scaleY: 1,
            skewX: 0,
            skewY: 0,
            translateX: 0,
            translateY: 0,
            boxShadow: '',
            textShadow: '',
            mixBlendMode: 'normal',
            filter: '',
            backdropFilter: '',
            imageUrl: '',
        };
    }
}
function canApplyTextDraft(element) {
    if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement)
        return false;
    if (element.dataset.froamShape === 'true')
        return true;
    if (element.children.length === 0)
        return true;
    const tag = element.tagName.toLowerCase();
    return ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'span', 'small', 'strong', 'em', 'b', 'i', 'label', 'button', 'a', 'li'].includes(tag);
}
function sanitizeDraftForElement(element, draft) {
    if (draft.text === undefined || canApplyTextDraft(element))
        return draft;
    const safeDraft = { ...draft };
    delete safeDraft.text;
    return safeDraft;
}
function applyDraft(element, draft) {
    try {
        const safeDraft = sanitizeDraftForElement(element, draft);
        if (safeDraft.text !== undefined) {
            element.innerText = safeDraft.text;
        }
        if (element instanceof HTMLImageElement && safeDraft.imageUrl !== undefined) {
            if (safeDraft.imageUrl) {
                element.src = safeDraft.imageUrl;
            }
            else {
                element.removeAttribute('src');
            }
        }
        if (safeDraft.styles) {
            for (const [key, value] of Object.entries(safeDraft.styles)) {
                // setProperty requires kebab-case, but our store uses camelCase
                const kebabKey = camelToKebab(key);
                element.style.setProperty(kebabKey, value);
            }
        }
    }
    catch {
        // Element may have been removed from DOM by React re-render — safe to ignore
    }
}
function isInjectionPath(path) {
    return path.startsWith(`${INJECTION_KEY}:`);
}
function ensureFroamNodeId(element) {
    const existing = element.dataset.froamId;
    if (existing)
        return existing;
    const id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    element.dataset.froamId = id;
    return id;
}
function assignFreshFroamNodeIds(element) {
    if (element.dataset.froamInjected === 'true') {
        element.dataset.froamId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    }
    element.querySelectorAll('[data-froam-injected="true"]').forEach((child) => {
        child.dataset.froamId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    });
}
function readInjectionDraft(draft) {
    if (!draft.text)
        return null;
    try {
        const parsed = JSON.parse(draft.text);
        if (typeof parsed.html !== 'string')
            return null;
        if (typeof parsed.parentPath !== 'string')
            return null;
        return {
            html: parsed.html,
            parentPath: parsed.parentPath,
            order: typeof parsed.order === 'number' ? parsed.order : 0,
        };
    }
    catch {
        return null;
    }
}
function readLiveElementDraft(element, existingDraft = {}) {
    const nextDraft = { ...existingDraft };
    if (existingDraft.text !== undefined || element.isContentEditable || canApplyTextDraft(element)) {
        nextDraft.text = element.innerText || '';
    }
    const liveStyles = { ...(existingDraft.styles ?? {}) };
    persistedStyleKeys.forEach((key) => {
        const value = element.style[key];
        if (value)
            liveStyles[key] = value;
    });
    const imageUrl = element instanceof HTMLImageElement
        ? element.currentSrc || element.src || ''
        : readImageUrl(element.style.backgroundImage);
    if (imageUrl || existingDraft.imageUrl !== undefined) {
        nextDraft.imageUrl = imageUrl;
    }
    if (Object.keys(liveStyles).length > 0) {
        nextDraft.styles = liveStyles;
    }
    return nextDraft;
}
function collectCSSVars() {
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
function readCanvasState() {
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
async function capturePageThumb() {
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
function applyCanvasDraftStyles(background, color, styles) {
    const host = getCanvasHost();
    if (!host)
        return;
    if (background)
        host.style.setProperty('background-color', background);
    else
        host.style.removeProperty('background-color');
    if (color)
        host.style.setProperty('color', color);
    else
        host.style.removeProperty('color');
    const imageKeys = ['backgroundImage', 'backgroundSize', 'backgroundPosition', 'backgroundRepeat', 'backgroundAttachment'];
    imageKeys.forEach((key) => {
        const value = styles?.[key];
        const cssKey = camelToKebab(key);
        if (value)
            host.style.setProperty(cssKey, value);
        else
            host.style.removeProperty(cssKey);
    });
    applyGlobalCSS(styles?.customCSS);
}
function clearCanvasDraftStyles() {
    const host = getCanvasHost();
    if (!host)
        return;
    host.style.removeProperty('background-color');
    host.style.removeProperty('color');
    host.style.removeProperty('background-image');
    host.style.removeProperty('background-size');
    host.style.removeProperty('background-position');
    host.style.removeProperty('background-repeat');
    host.style.removeProperty('background-attachment');
    applyGlobalCSS('');
}
function syncFroamArtboardMetadata(element) {
    if (element.dataset.froamArtboard !== 'true')
        return;
    const rect = element.getBoundingClientRect();
    element.dataset.froamFrameWidth = String(Math.max(1, Math.round(rect.width)));
    element.dataset.froamFrameHeight = String(Math.max(1, Math.round(rect.height)));
    element.dataset.froamFramePreset = 'custom';
}
function buildGradientCSS(type, angle, stops) {
    const sortedStops = [...stops].sort((a, b) => a.position - b.position);
    const stopStr = sortedStops.map((s) => `${s.color} ${s.position}%`).join(', ');
    return type === 'linear'
        ? `linear-gradient(${angle}deg, ${stopStr})`
        : `radial-gradient(circle, ${stopStr})`;
}
function collectLayers(root, maxDepth = 4) {
    const nodes = [];
    function walk(el, depth) {
        if (depth > maxDepth)
            return;
        if (shouldSkipElement(el))
            return;
        const path = getElementPath(el, root);
        const computed = window.getComputedStyle(el);
        const elementChildren = Array.from(el.children).filter((child) => child instanceof HTMLElement && !shouldSkipElement(child));
        nodes.push({
            element: el,
            path,
            tag: el.tagName.toLowerCase(),
            label: el.dataset.froamMerged === 'true' ? 'Stamp group' : el.dataset.froamShape === 'true' ? 'Shape' : el.tagName.toLowerCase(),
            kind: el.dataset.froamMerged === 'true' ? 'stamp' : el.dataset.froamShape === 'true' ? 'shape' : 'element',
            className: typeof el.className === 'string' ? el.className.split(' ').filter(Boolean).slice(0, 2).join(' ') : '',
            depth,
            hidden: computed.display === 'none',
            hasChildren: elementChildren.length > 0,
            childCount: elementChildren.length,
        });
        elementChildren.forEach((child) => walk(child, depth + 1));
    }
    for (const child of Array.from(root.children)) {
        if (child instanceof HTMLElement)
            walk(child, 0);
    }
    return nodes;
}
/* ═══════════════════════════════════════════════════════════════
   Sub-components
   ═══════════════════════════════════════════════════════════════ */
function AccordionSection({ id, icon, title, isOpen, onToggle, children, }) {
    return (_jsxs("div", { className: "froam-accordion", "data-chef-editor-root": "true", children: [_jsxs("button", { type: "button", className: "froam-accordion__trigger", "aria-expanded": isOpen, "aria-controls": `froam-section-${id}`, onClick: onToggle, "data-chef-editor-root": "true", children: [_jsxs("span", { className: "froam-accordion__trigger-left", children: [icon, title] }), _jsx(ChevronDown, { size: 14, className: "froam-accordion__chevron", "aria-hidden": "true" })] }), _jsx(AnimatePresence, { initial: false, children: isOpen && (_jsx(motion.div, { className: "froam-accordion__body", id: `froam-section-${id}`, initial: { height: 0, opacity: 0 }, animate: { height: 'auto', opacity: 1 }, exit: { height: 0, opacity: 0 }, transition: { duration: 0.22, ease: [0.4, 0, 0.2, 1] }, children: _jsx("div", { className: "froam-accordion__content", "data-chef-editor-root": "true", children: children }) })) })] }));
}
function Toast({ message, visible }) {
    return (_jsxs("div", { className: `fs-toast ${visible ? 'is-visible' : ''}`, "data-chef-editor-root": "true", children: [_jsx(Zap, { size: 14, "aria-hidden": "true" }), message] }));
}
const WELCOME_TIPS_KEY = 'froam:welcome-tips-dismissed:v1';
function FroamWelcomeTips({ open }) {
    const [dismissed, setDismissed] = useState(() => {
        try {
            return window.localStorage.getItem(WELCOME_TIPS_KEY) === '1';
        }
        catch {
            return true;
        }
    });
    if (!open || dismissed)
        return null;
    const dismiss = () => {
        setDismissed(true);
        try {
            window.localStorage.setItem(WELCOME_TIPS_KEY, '1');
        }
        catch { /* storage unavailable */ }
    };
    return (_jsxs("div", { className: "fs-welcome-tips", "data-chef-editor-root": "true", role: "note", "aria-label": "Froam quick tips", children: [_jsxs("div", { className: "fs-welcome-tips__title", children: [_jsx(Sparkles, { size: 13, "aria-hidden": "true" }), _jsx("span", { children: "Welcome to Froam" }), _jsx("button", { type: "button", className: "fs-welcome-tips__close", onClick: dismiss, "aria-label": "Dismiss tips", children: _jsx(X, { size: 12, "aria-hidden": "true" }) })] }), _jsxs("ul", { className: "fs-welcome-tips__list", children: [_jsxs("li", { children: [_jsx("b", { children: "Click any element" }), " on the page to select and restyle it"] }), _jsxs("li", { children: [_jsx("kbd", { children: "Ctrl+K" }), " opens the command palette"] }), _jsxs("li", { children: [_jsx("kbd", { children: "Ctrl+Shift+S" }), " saves the design to your repo, git-ready"] })] }), _jsx("button", { type: "button", className: "fs-welcome-tips__cta", onClick: dismiss, children: "Got it" })] }));
}
function MeasurementOverlay({ rect }) {
    if (!rect)
        return null;
    const w = Math.round(rect.width);
    const h = Math.round(rect.height);
    return (_jsx("div", { className: "fs-measure", "data-chef-editor-root": "true", style: {
            left: rect.left,
            top: rect.top,
            width: rect.width,
            height: rect.height,
        }, children: _jsxs("span", { className: "fs-measure__badge", children: [w, " \u00D7 ", h] }) }));
}
function SelectionHandoffOverlay({ rect, label, mode, count, pulseKey, }) {
    if (!rect)
        return null;
    const top = Math.max(10, rect.top - 36);
    const left = Math.min(Math.max(10, rect.left), Math.max(10, window.innerWidth - 210));
    return (_jsxs("div", { className: "froam-selection-handoff", "data-chef-editor-root": "true", style: { left, top }, children: [_jsx("span", { className: "froam-selection-handoff__dot" }), _jsx("span", { className: "froam-selection-handoff__mode", children: mode }), _jsx("span", { className: "froam-selection-handoff__label", children: count > 1 ? `${count} selected` : label })] }, pulseKey));
}
export default function GlobalChefEditor({ initialOpen = false, routeKey: explicitRouteKey }) {
    const routeKey = useFroamRouteKey(explicitRouteKey);
    const [portalContainer] = useState(() => {
        if (typeof document === 'undefined')
            return null;
        const container = document.createElement('div');
        container.id = 'froam-editor-portal';
        container.setAttribute('data-chef-editor-root', 'true');
        return container;
    });
    useEffect(() => {
        if (!portalContainer)
            return;
        document.body.appendChild(portalContainer);
        return () => {
            portalContainer.remove();
        };
    }, [portalContainer]);
    // Core state
    const [store, setStore] = useState(() => loadStore());
    const [buttonPosition, setButtonPosition] = useState(CHEF_BUTTON_START);
    const [panelPosition, setPanelPosition] = useState(null);
    const panelDragRef = useRef(null);
    const [panelOpen, setPanelOpen] = useState(initialOpen);
    const [active, setActive] = useState(initialOpen);
    const [selection, setSelection] = useState(null);
    const [selections, setSelections] = useState([]);
    const [canvas, setCanvas] = useState(() => ({ background: '#050505', text: '#ffffff' }));
    const [zoom, setZoom] = useState(1);
    const [persona, setPersona] = useState(() => loadPersonaPreference());
    const [personaDraft, setPersonaDraft] = useState(() => loadPersonaPreference());
    const [personaEditorOpen, setPersonaEditorOpen] = useState(false);
    // UI state
    const [toastMsg, setToastMsg] = useState('');
    const [toastVisible, setToastVisible] = useState(false);
    const [openSections, setOpenSections] = useState({
        intel: true,
        quickActions: false,
        layout: false,
        spacing: false,
        typography: false,
        fill: false,
        borders: false,
        effects: false,
        transform: false,
        container: false,
        layers: false,
        gradient: false,
        cssVars: false,
        history: false,
        textShadow: false,
        versions: false,
        shapes: false,
        animator: false,
        export: false,
        inspiration: false,
        tokens: false,
        align: false,
        transitions: false,
        assets: false,
    });
    const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
    const [leftWorkspaceMode, setLeftWorkspaceMode] = useState('plan');
    const [leftPanelOpen, setLeftPanelOpen] = useState(true);
    const [rightPanelOpen, setRightPanelOpen] = useState(true);
    const [studioMinimized, setStudioMinimized] = useState(false);
    const [commandSearch, setCommandSearch] = useState('');
    const [commandFocusIndex, setCommandFocusIndex] = useState(0);
    const [inlineEditing, setInlineEditing] = useState(false);
    const [measureRect, setMeasureRect] = useState(null);
    // v4: New feature state
    const [showShortcutOverlay, setShowShortcutOverlay] = useState(false);
    const [contextMenuPos, setContextMenuPos] = useState(null);
    const [selectionRect, setSelectionRect] = useState(null);
    const [selectionHandoffKey, setSelectionHandoffKey] = useState(0);
    const [selectionHandoffMode, setSelectionHandoffMode] = useState('Editing');
    const [smartGuides] = useState([]);
    const [clipboardStyles, setClipboardStyles] = useState(null);
    const [isResizing, setIsResizing] = useState(false);
    const resizeBaseRef = useRef(null);
    // Drag-to-move mode
    const [moveMode, setMoveMode] = useState(false);
    const moveDragRef = useRef(null);
    // Undo/redo
    const [undoStack, setUndoStack] = useState([]);
    const [redoStack, setRedoStack] = useState([]);
    const [history, setHistory] = useState(() => loadHistory());
    // Gradient builder
    const [gradType, setGradType] = useState('linear');
    const [gradAngle, setGradAngle] = useState(135);
    const [gradStops, setGradStops] = useState([
        { color: '#5eead4', position: 0 },
        { color: '#ff6c4f', position: 100 },
    ]);
    // Spacing link
    const [marginLinked, setMarginLinked] = useState(true);
    const [paddingLinked, setPaddingLinked] = useState(true);
    const [radiusLinked, setRadiusLinked] = useState(true);
    // Viewport simulation
    const [viewportMode, setViewportMode] = useState('desktop');
    const [activeTool, setActiveTool] = useState('pointer');
    // Layers
    const [layers, setLayers] = useState([]);
    // CSS Variables
    const [cssVars, setCssVars] = useState([]);
    const [repoStatus, setRepoStatus] = useState(null);
    const [repoDirtyCount, setRepoDirtyCount] = useState(0);
    const [editorTheme, setEditorTheme] = useState(() => typeof document !== 'undefined' && document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark');
    const [newVarName, setNewVarName] = useState('');
    const [newVarValue, setNewVarValue] = useState('');
    // Design Tokens (named colors, spacing, type scales)
    const [tokens, setTokens] = useState(() => {
        if (typeof window === 'undefined')
            return [];
        try {
            return JSON.parse(window.localStorage.getItem('froam-tokens-v1') || '[]');
        }
        catch {
            return [];
        }
    });
    const [newTokenName, setNewTokenName] = useState('');
    const [newTokenValue, setNewTokenValue] = useState('');
    const [newTokenCategory, setNewTokenCategory] = useState('color');
    // Transition editor
    const [transitionProp, setTransitionProp] = useState('all');
    const [transitionDuration, setTransitionDuration] = useState(300);
    const [transitionEasing, setTransitionEasing] = useState('ease');
    const [transitionDelay, setTransitionDelay] = useState(0);
    // Asset manager
    const [assets, setAssets] = useState(() => {
        if (typeof window === 'undefined')
            return [];
        try {
            return JSON.parse(window.localStorage.getItem('froam-assets-v1') || '[]');
        }
        catch {
            return [];
        }
    });
    const [assetSearch, setAssetSearch] = useState('');
    // Refs
    const dragRef = useRef(null);
    const fileInputRef = useRef(null);
    const pendingImageTargetRef = useRef(null);
    const pendingCanvasImageRef = useRef(false);
    const currentSelectionRef = useRef(null);
    const selectionSwitchTargetRef = useRef(null);
    const selectionSwitchTimerRef = useRef(0);
    const currentHoverRef = useRef(null);
    const originalsRef = useRef({});
    const toastTimerRef = useRef(0);
    const suspendDraftPaintingRef = useRef(false);
    const pendingDraftPaintResumeRef = useRef(false);
    const undoDebounceRef = useRef(0);
    const pendingUndoSnapshotRef = useRef(null);
    const loadedPublishedKeysRef = useRef(new Set());
    const isKitchenRoute = routeKey === '/kitchen';
    // Each viewport gets its own isolated store bucket
    const viewportStoreKey = `${routeKey}@@${viewportMode}`;
    const viewportStoreKeyRef = useRef(viewportStoreKey);
    viewportStoreKeyRef.current = viewportStoreKey;
    const routeDrafts = useMemo(() => store[viewportStoreKey] ?? {}, [store, viewportStoreKey]);
    const draftCount = useMemo(() => countRenderableDrafts(routeDrafts), [routeDrafts]);
    const hasRouteDrafts = useMemo(() => draftCount > 0, [draftCount]);
    const showPanel = panelOpen || active;
    useEffect(() => {
        if (!pendingDraftPaintResumeRef.current)
            return;
        pendingDraftPaintResumeRef.current = false;
        const frame = window.requestAnimationFrame(() => {
            suspendDraftPaintingRef.current = false;
        });
        return () => window.cancelAnimationFrame(frame);
    }, [routeDrafts]);
    function keepStudioPinned() {
        setPanelOpen(true);
        setActive(true);
        setStudioMinimized(false);
    }
    /* ─── Toast helper ─── */
    const showToast = useCallback((msg) => {
        setToastMsg(msg);
        setToastVisible(true);
        window.clearTimeout(toastTimerRef.current);
        toastTimerRef.current = window.setTimeout(() => setToastVisible(false), 2200);
    }, []);
    function openPersonaEditor() {
        keepStudioPinned();
        setPersonaDraft(persona);
        setPersonaEditorOpen(true);
    }
    function closePersonaEditor() {
        setPersonaDraft(persona);
        setPersonaEditorOpen(false);
    }
    function savePersonaProfile() {
        const nextPersona = sanitizeFroamPersona(personaDraft);
        setPersona(nextPersona);
        setPersonaDraft(nextPersona);
        setPersonaEditorOpen(false);
        showToast('Froam profile updated');
    }
    function clearPersonaImage() {
        setPersonaDraft((current) => {
            const nextPersona = sanitizeFroamPersona({ ...current, imageUrl: '' });
            setPersona(nextPersona);
            return nextPersona;
        });
    }
    function handlePersonaImageUpload(event) {
        const file = event.target.files?.[0];
        event.target.value = '';
        if (!file)
            return;
        if (!file.type.startsWith('image/')) {
            showToast('Use an image file for the Froam avatar');
            return;
        }
        if (file.size > MAX_PERSONA_IMAGE_BYTES) {
            showToast('Avatar is too large. Keep it under 400 KB.');
            return;
        }
        const reader = new FileReader();
        reader.onload = () => {
            const imageUrl = typeof reader.result === 'string' ? reader.result : '';
            if (!imageUrl)
                return;
            setPersonaDraft((current) => {
                const nextPersona = sanitizeFroamPersona({ ...current, imageUrl });
                setPersona(nextPersona);
                return nextPersona;
            });
        };
        reader.readAsDataURL(file);
    }
    function markSelectionSwitch(element, mode = 'Editing') {
        selectionSwitchTargetRef.current?.removeAttribute('data-froam-switching');
        selectionSwitchTargetRef.current = null;
        window.clearTimeout(selectionSwitchTimerRef.current);
        if (!element)
            return;
        selectionSwitchTargetRef.current = element;
        element.setAttribute('data-froam-switching', 'true');
        setSelectionHandoffMode(mode);
        setSelectionHandoffKey(window.performance.now());
        selectionSwitchTimerRef.current = window.setTimeout(() => {
            if (selectionSwitchTargetRef.current === element) {
                element.removeAttribute('data-froam-switching');
                selectionSwitchTargetRef.current = null;
            }
        }, 520);
    }
    /* ─── Section toggle ─── */
    const toggleSection = useCallback((id) => {
        setOpenSections((prev) => ({ ...prev, [id]: !prev[id] }));
    }, []);
    /* ─── Device shell: CSS-transform viewport simulation (no DOM tree moves) ─── */
    const prevViewportRef = useRef('desktop');
    useEffect(() => {
        const appRoot = getRoot();
        if (!appRoot)
            return;
        // Strip previous viewport's drafted styles
        const prevKey = `${routeKey}@@${prevViewportRef.current}`;
        const prevDrafts = store[prevKey] ?? {};
        Object.keys(prevDrafts).forEach((path) => {
            if (path === CANVAS_KEY || isInjectionPath(path) || isFroamPersonaPath(path))
                return;
            const el = findElementByPath(appRoot, path);
            if (el)
                el.removeAttribute('style');
        });
        if (prevDrafts[CANVAS_KEY]) {
            clearCanvasDraftStyles();
        }
        // Remove any old shell overlay
        document.getElementById(DEVICE_SHELL_ID)?.remove();
        // Always make sure #root is back in body (safety) — unless the root
        // IS <body>/<html>, which can never be re-parented into itself.
        if (appRoot !== document.body && appRoot !== document.documentElement && appRoot.parentElement && appRoot.parentElement !== document.body) {
            document.body.appendChild(appRoot);
        }
        // Reset root styles
        appRoot.style.removeProperty('width');
        appRoot.style.removeProperty('min-height');
        appRoot.style.removeProperty('height');
        appRoot.style.removeProperty('overflow-y');
        appRoot.style.removeProperty('overflow-x');
        appRoot.style.removeProperty('position');
        appRoot.style.removeProperty('left');
        appRoot.style.removeProperty('top');
        appRoot.style.removeProperty('z-index');
        appRoot.style.removeProperty('border-radius');
        appRoot.style.removeProperty('box-shadow');
        appRoot.style.removeProperty('background');
        appRoot.style.removeProperty('transform');
        appRoot.style.removeProperty('transform-origin');
        appRoot.style.removeProperty('max-width');
        appRoot.style.removeProperty('margin-inline');
        appRoot.style.removeProperty('margin-left');
        appRoot.style.removeProperty('margin-right');
        appRoot.style.removeProperty('margin-top');
        appRoot.style.removeProperty('margin');
        appRoot.style.removeProperty('isolation');
        document.body.style.removeProperty('overflow');
        document.body.style.removeProperty('background');
        document.body.style.removeProperty('display');
        document.body.style.removeProperty('align-items');
        document.body.style.removeProperty('justify-content');
        document.body.style.removeProperty('min-height');
        prevViewportRef.current = viewportMode;
        setPanelPosition(null);
        const mode = VIEWPORT_MODES.find((m) => m.id === viewportMode);
        if (!mode || mode.width === null) {
            // Desktop — plain, repaint desktop drafts
            const newDrafts = store[`${routeKey}@@desktop`] ?? {};
            Object.entries(newDrafts).forEach(([path, draft]) => {
                if (path === CANVAS_KEY || isFroamPersonaPath(path))
                    return;
                const el = findElementByPath(appRoot, path);
                if (el)
                    applyDraft(el, draft);
            });
            const cd = newDrafts[CANVAS_KEY];
            applyCanvasDraftStyles(cd?.styles?.backgroundColor, cd?.styles?.color, cd?.styles);
            currentSelectionRef.current?.removeAttribute('data-chef-selected');
            currentSelectionRef.current = null;
            setSelection(null);
            // Desktop stays true to the page. Froam controls float above it instead of
            // pushing the canvas into a dark editor workbench.
            appRoot.style.minHeight = '100vh';
            appRoot.style.transformOrigin = 'top left';
            appRoot.style.transform = zoom !== 1 ? `scale(${zoom})` : '';
            return;
        }
        // Mobile / Tablet: put #root inside a fixed device screen and scale it.
        // This keeps #root in document.body, triggers real media queries, and aligns the page with the phone frame.
        const deviceW = mode.width;
        const deviceH = mode.height;
        const padding = viewportMode === 'mobile' ? 28 : 32;
        const availW = window.innerWidth - padding * 2;
        const availH = window.innerHeight - padding * 2;
        const scale = Math.min(availW / deviceW, availH / deviceH, viewportMode === 'mobile' ? 0.96 : 0.92);
        const scaledW = deviceW * scale;
        const scaledH = deviceH * scale;
        const screenLeft = Math.round((window.innerWidth - scaledW) / 2);
        const screenTop = Math.round((window.innerHeight - scaledH) / 2);
        const screenRadius = viewportMode === 'mobile' ? 32 : 18;
        // Size #root to device width so media queries fire correctly
        appRoot.style.width = `${deviceW}px`;
        appRoot.style.height = `${deviceH}px`;
        appRoot.style.minHeight = `${deviceH}px`;
        appRoot.style.maxWidth = 'none';
        appRoot.style.marginInline = '0';
        appRoot.style.position = 'fixed';
        appRoot.style.left = `${screenLeft}px`;
        appRoot.style.top = `${screenTop}px`;
        appRoot.style.zIndex = '1045';
        appRoot.style.isolation = 'isolate';
        appRoot.style.borderRadius = `${screenRadius}px`;
        appRoot.style.boxShadow = '0 0 0 1px rgba(255,255,255,0.06)';
        appRoot.style.background = '#fff';
        appRoot.style.overflowX = 'hidden';
        appRoot.style.overflowY = 'auto';
        appRoot.style.transformOrigin = 'top left';
        appRoot.style.transform = `scale(${scale})`;
        // Dark background behind the scaled frame
        document.body.style.background = 'rgba(6,8,14,0.95)';
        document.body.style.minHeight = '100vh';
        document.body.style.overflow = 'hidden';
        // Build a thin bezel overlay (purely decorative, pointer-events:none)
        const bezelPad = viewportMode === 'mobile' ? 12 : 16;
        const bezelRadius = screenRadius;
        const shell = document.createElement('div');
        shell.id = DEVICE_SHELL_ID;
        shell.setAttribute('data-chef-editor-root', 'true');
        shell.style.cssText = [
            'position:fixed',
            `left:${screenLeft}px`,
            `top:${screenTop}px`,
            `width:${scaledW}px`,
            `height:${scaledH}px`,
            `border-radius:${bezelRadius}px`,
            `box-shadow:0 0 0 ${bezelPad}px #1f2430,0 0 0 ${bezelPad + 1}px rgba(255,255,255,0.08),0 32px 80px rgba(0,0,0,0.7)`,
            'border:2px solid rgba(255,255,255,0.08)',
            'z-index:1048',
            'pointer-events:none',
        ].join(';');
        if (viewportMode === 'mobile') {
            const notch = document.createElement('div');
            notch.setAttribute('data-chef-editor-root', 'true');
            notch.style.cssText = 'position:absolute;top:10px;left:50%;transform:translateX(-50%);width:92px;height:24px;background:#0e1016;border-radius:15px;z-index:2;pointer-events:none;box-shadow:inset 0 1px 0 rgba(255,255,255,0.06)';
            shell.appendChild(notch);
        }
        document.body.appendChild(shell);
        // Paint new viewport drafts
        const newDrafts = store[`${routeKey}@@${viewportMode}`] ?? {};
        Object.entries(newDrafts).forEach(([path, draft]) => {
            if (path === CANVAS_KEY || isFroamPersonaPath(path))
                return;
            const el = findElementByPath(appRoot, path);
            if (el)
                applyDraft(el, draft);
        });
        const cd = newDrafts[CANVAS_KEY];
        applyCanvasDraftStyles(cd?.styles?.backgroundColor, cd?.styles?.color, cd?.styles);
        currentSelectionRef.current?.removeAttribute('data-chef-selected');
        currentSelectionRef.current = null;
        setSelection(null);
        return () => {
            document.getElementById(DEVICE_SHELL_ID)?.remove();
            appRoot.style.removeProperty('width');
            appRoot.style.removeProperty('min-height');
            appRoot.style.removeProperty('height');
            appRoot.style.removeProperty('overflow-y');
            appRoot.style.removeProperty('overflow-x');
            appRoot.style.removeProperty('position');
            appRoot.style.removeProperty('left');
            appRoot.style.removeProperty('top');
            appRoot.style.removeProperty('z-index');
            appRoot.style.removeProperty('border-radius');
            appRoot.style.removeProperty('box-shadow');
            appRoot.style.removeProperty('background');
            appRoot.style.removeProperty('transform');
            appRoot.style.removeProperty('transform-origin');
            appRoot.style.removeProperty('max-width');
            appRoot.style.removeProperty('margin-inline');
            appRoot.style.removeProperty('margin-left');
            appRoot.style.removeProperty('margin-right');
            appRoot.style.removeProperty('margin-top');
            appRoot.style.removeProperty('margin');
            appRoot.style.removeProperty('isolation');
            document.body.style.removeProperty('background');
            document.body.style.removeProperty('min-height');
            document.body.style.removeProperty('overflow');
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [viewportMode, routeKey, zoom]);
    /* ─── Route change reset ─── */
    useEffect(() => {
        const frame = window.requestAnimationFrame(() => {
            setPanelOpen(false);
            setActive(false);
            setStudioMinimized(false);
            setSelection(null);
            setInlineEditing(false);
            prevViewportRef.current = 'desktop';
            setViewportMode('desktop');
        });
        return () => window.cancelAnimationFrame(frame);
    }, [routeKey]);
    /* ─── Editing attribute ─── */
    useEffect(() => {
        document.documentElement.toggleAttribute('data-chef-editing', showPanel);
        return () => { document.documentElement.removeAttribute('data-chef-editing'); };
    }, [showPanel]);
    /* ─── Move mode cursor ─── */
    useEffect(() => {
        if (moveMode && showPanel) {
            document.body.style.cursor = 'move';
        }
        else {
            document.body.style.removeProperty('cursor');
        }
        return () => { document.body.style.removeProperty('cursor'); };
    }, [moveMode, showPanel]);
    /* ─── Turn off move mode when panel closes ─── */
    useEffect(() => {
        if (!showPanel)
            setMoveMode(false);
    }, [showPanel]);
    /* ─── Persist store ─── */
    useEffect(() => { saveStore(store); }, [store]);
    useEffect(() => {
        savePersonaPreference(persona);
    }, [persona]);
    useEffect(() => {
        if (personaEditorOpen)
            return;
        setPersonaDraft(persona);
    }, [persona, personaEditorOpen]);
    useEffect(() => {
        const draftPersona = readFroamPersonaDraft(routeDrafts);
        if (draftPersona && !personasEqual(draftPersona, persona)) {
            setPersona(sanitizeFroamPersona(draftPersona));
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [routeDrafts]);
    useEffect(() => {
        let cancelled = false;
        // Skip if we already attempted this key, or if there are already local drafts
        if (loadedPublishedKeysRef.current.has(viewportStoreKey))
            return;
        if (countRenderableDrafts(store[viewportStoreKey] ?? {}) > 0) {
            loadedPublishedKeysRef.current.add(viewportStoreKey);
            return;
        }
        async function loadPublishedDesign() {
            loadedPublishedKeysRef.current.add(viewportStoreKey);
            try {
                const params = new URLSearchParams({ routeKey, viewportMode });
                const response = await apiGetFresh(`/api/froam/published?${params.toString()}`);
                const publishedStore = response.design?.store;
                if (cancelled || !publishedStore || Object.keys(publishedStore).length === 0)
                    return;
                const publishedPersona = readFroamPersonaDraft(publishedStore);
                if (publishedPersona && !personasEqual(publishedPersona, persona)) {
                    setPersona(sanitizeFroamPersona(publishedPersona));
                }
                setStore((current) => {
                    const currentRouteDrafts = current[viewportStoreKey] ?? {};
                    if (countRenderableDrafts(currentRouteDrafts) > 0)
                        return current;
                    const next = { ...current, [viewportStoreKey]: stripPersonaDrafts(publishedStore) };
                    saveStore(next);
                    return next;
                });
            }
            catch {
                // Stay usable offline or while backend is restarting.
            }
        }
        void loadPublishedDesign();
        return () => { cancelled = true; };
        // Intentionally exclude `store` — including it causes an infinite loop when
        // setStore fires and re-triggers this effect. We gate on the ref instead.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [routeKey, viewportMode, viewportStoreKey]);
    /* ─── Read canvas on route change ─── */
    useEffect(() => {
        const frame = window.requestAnimationFrame(() => setCanvas(readCanvasState()));
        return () => window.cancelAnimationFrame(frame);
    }, [routeKey]);
    /* ─── Paint drafts (re-apply on DOM mutations, e.g. React re-renders) ─── */
    useEffect(() => {
        if (!hasRouteDrafts)
            return;
        const root = getRoot();
        if (!root)
            return;
        const rootElement = root;
        function paintDrafts() {
            try {
                if (suspendDraftPaintingRef.current)
                    return;
                restoreInjectedBlocks(routeDrafts);
                Object.entries(routeDrafts).forEach(([path, draft]) => {
                    if (path === CANVAS_KEY || isInjectionPath(path) || isFroamPersonaPath(path))
                        return;
                    const target = findElementByPath(rootElement, path);
                    if (target)
                        applyDraft(target, draft);
                });
                const canvasDraft = routeDrafts[CANVAS_KEY];
                applyCanvasDraftStyles(canvasDraft?.styles?.backgroundColor, canvasDraft?.styles?.color, canvasDraft?.styles);
            }
            catch {
                // Safe to ignore, element likely removed by React
            }
        }
        // Defer initial paint to avoid running synchronously during React commit phase
        let paintFrame = requestAnimationFrame(paintDrafts);
        const observer = new MutationObserver(() => {
            cancelAnimationFrame(paintFrame);
            paintFrame = requestAnimationFrame(paintDrafts);
        });
        observer.observe(rootElement, { childList: true, subtree: true });
        return () => {
            cancelAnimationFrame(paintFrame);
            observer.disconnect();
        };
    }, [hasRouteDrafts, routeDrafts, viewportStoreKey]);
    /* ─── Click / hover handlers ─── */
    useEffect(() => {
        if (!showPanel)
            return;
        const root = getRoot();
        if (!root)
            return;
        const rootElement = root;
        function clearHover() {
            currentHoverRef.current?.removeAttribute('data-chef-hovered');
            currentHoverRef.current = null;
            setMeasureRect(null);
        }
        function resolveTarget(rawTarget) {
            let element = rawTarget instanceof HTMLElement ? rawTarget : null;
            while (element && rootElement.contains(element)) {
                if (element.closest('[data-chef-editor-root="true"]'))
                    return null;
                if (!shouldSkipElement(element))
                    return element;
                element = element.parentElement;
            }
            return null;
        }
        let hoverFrame = 0;
        function handlePointerOver(event) {
            cancelAnimationFrame(hoverFrame);
            hoverFrame = requestAnimationFrame(() => {
                const target = resolveTarget(event.target);
                if (!target || target === currentSelectionRef.current)
                    return;
                if (currentHoverRef.current === target)
                    return;
                clearHover();
                currentHoverRef.current = target;
                target.setAttribute('data-chef-hovered', 'true');
                setMeasureRect(target.getBoundingClientRect());
            });
        }
        function handlePointerLeave() {
            cancelAnimationFrame(hoverFrame);
            hoverFrame = requestAnimationFrame(clearHover);
        }
        function handleClick(event) {
            const target = resolveTarget(event.target);
            if (!target) {
                if (!(event.target instanceof HTMLElement) || event.target.closest('[data-chef-editor-root="true"]'))
                    return;
                if (panelOpenRef.current) {
                    clearHover();
                    return;
                }
                setPanelOpen(false);
                setActive(false);
                setCommandPaletteOpen(false);
                return;
            }
            event.preventDefault();
            event.stopPropagation();
            // Exit inline editing if clicking something else
            if (inlineEditing && currentSelectionRef.current) {
                currentSelectionRef.current.contentEditable = 'false';
                setInlineEditing(false);
            }
            const path = getElementPath(target, rootElement);
            if (event.shiftKey) {
                const currentSels = selectionsRef.current;
                const isAlreadySelected = currentSels.some((sel) => sel.path === path);
                let nextSels;
                if (isAlreadySelected) {
                    nextSels = currentSels.filter((sel) => sel.path !== path);
                }
                else {
                    nextSels = [...currentSels, buildSelection(target, path)];
                }
                updateSelectionsState(nextSels);
            }
            else {
                updateSelectionsState([buildSelection(target, path)]);
            }
            setMeasureRect(null);
            setContextMenuPos(null);
        }
        function handleDblClick(event) {
            const target = resolveTarget(event.target);
            if (!target)
                return;
            const textTarget = target;
            event.preventDefault();
            event.stopPropagation();
            if (!canApplyTextDraft(textTarget)) {
                showToast('Select a text layer to edit copy');
                return;
            }
            if (textTarget.dataset.froamShape === 'true') {
                textTarget.querySelector('svg')?.setAttribute('aria-hidden', 'true');
                textTarget.style.placeItems = 'center';
                textTarget.style.textAlign = textTarget.style.textAlign || 'center';
                textTarget.style.alignContent = 'center';
                textTarget.style.justifyContent = 'center';
                textTarget.style.cursor = 'text';
            }
            // Enable contentEditable
            textTarget.contentEditable = 'true';
            textTarget.focus();
            if (textTarget.dataset.froamShape === 'true' && !textTarget.innerText.trim()) {
                const selectionRange = document.createRange();
                selectionRange.selectNodeContents(textTarget);
                selectionRange.collapse(false);
                const browserSelection = window.getSelection();
                browserSelection?.removeAllRanges();
                browserSelection?.addRange(selectionRange);
            }
            setInlineEditing(true);
            function handleBlur() {
                textTarget.contentEditable = 'false';
                setInlineEditing(false);
                // Sync text back to draft
                const path = getElementPath(textTarget, rootElement);
                const newText = textTarget.innerText;
                setStore((currentStore) => {
                    const vsk = viewportStoreKeyRef.current;
                    return {
                        ...currentStore,
                        [vsk]: {
                            ...(currentStore[vsk] ?? {}),
                            [path]: {
                                ...(currentStore[vsk]?.[path] ?? {}),
                                text: newText,
                            },
                        },
                    };
                });
                setSelection((s) => s ? { ...s, text: newText } : s);
                persistLiveRouteSnapshot();
                textTarget.removeEventListener('blur', handleBlur);
            }
            textTarget.addEventListener('blur', handleBlur);
        }
        function handleContextMenu(event) {
            const target = resolveTarget(event.target);
            if (!target)
                return;
            event.preventDefault();
            event.stopPropagation();
            const path = getElementPath(target, rootElement);
            const isAlreadySelected = selectionsRef.current.some((sel) => sel.path === path);
            if (!isAlreadySelected) {
                updateSelectionsState([buildSelection(target, path)]);
            }
            setContextMenuPos({ x: event.clientX, y: event.clientY });
        }
        document.addEventListener('mouseover', handlePointerOver, { capture: true, passive: true });
        document.addEventListener('mouseout', handlePointerLeave, { capture: true, passive: true });
        document.addEventListener('click', handleClick, true);
        document.addEventListener('dblclick', handleDblClick, true);
        document.addEventListener('contextmenu', handleContextMenu, true);
        return () => {
            cancelAnimationFrame(hoverFrame);
            document.removeEventListener('mouseover', handlePointerOver, true);
            document.removeEventListener('mouseout', handlePointerLeave, true);
            document.removeEventListener('click', handleClick, true);
            document.removeEventListener('dblclick', handleDblClick, true);
            document.removeEventListener('contextmenu', handleContextMenu, true);
            clearHover();
        };
    }, [showPanel, routeKey, viewportStoreKey, inlineEditing, showToast]);
    /* ─── Drag-to-move ─── */
    useEffect(() => {
        if (!showPanel || !moveMode)
            return;
        const root = getRoot();
        if (!root)
            return;
        function resolveMovTarget(rawTarget) {
            let element = rawTarget instanceof HTMLElement ? rawTarget : null;
            while (element && root.contains(element)) {
                if (element.closest('[data-chef-editor-root="true"]'))
                    return null;
                if (!shouldSkipElement(element))
                    return element;
                element = element.parentElement;
            }
            return null;
        }
        function handleMoveDown(e) {
            const target = resolveMovTarget(e.target);
            if (!target)
                return;
            e.preventDefault();
            e.stopPropagation();
            const computed = window.getComputedStyle(target);
            const origTop = readNumber(computed.top, 0);
            const origLeft = readNumber(computed.left, 0);
            if (computed.position === 'static')
                target.style.position = 'relative';
            const path = getElementPath(target, root);
            moveDragRef.current = { startX: e.clientX, startY: e.clientY, origTop, origLeft, target, path };
            target.setPointerCapture(e.pointerId);
            updateSelectionsState([buildSelection(target, path)]);
            target.setAttribute('data-froam-moving', 'true');
            markSelectionSwitch(target, 'Moving');
        }
        function handleMoveMove(e) {
            const drag = moveDragRef.current;
            if (!drag)
                return;
            e.preventDefault();
            drag.target.style.top = `${drag.origTop + e.clientY - drag.startY}px`;
            drag.target.style.left = `${drag.origLeft + e.clientX - drag.startX}px`;
            setSelectionRect(drag.target.getBoundingClientRect());
        }
        function handleMoveUp(e) {
            const drag = moveDragRef.current;
            if (!drag)
                return;
            drag.target.releasePointerCapture(e.pointerId);
            const newTop = drag.origTop + e.clientY - drag.startY;
            const newLeft = drag.origLeft + e.clientX - drag.startX;
            moveDragRef.current = null;
            drag.target.removeAttribute('data-froam-moving');
            const computed = window.getComputedStyle(drag.target);
            const pos = computed.position === 'static' ? 'relative' : computed.position;
            // Persist the new position into the draft store via applyStyle
            // We need selection to be set — update it first, then call applyStyle
            setSelection((current) => {
                if (!current || current.path !== drag.path)
                    return current;
                return { ...current, position: pos };
            });
            const nextStore = { ...storeRef.current };
            const routeStore = { ...(nextStore[viewportStoreKey] ?? {}) };
            const existing = routeStore[drag.path] ?? {};
            routeStore[drag.path] = {
                ...existing,
                styles: { ...(existing.styles ?? {}), position: pos, top: `${Math.round(newTop)}px`, left: `${Math.round(newLeft)}px` },
            };
            nextStore[viewportStoreKey] = routeStore;
            setStore(nextStore);
            saveStore(nextStore);
            setSelectionRect(drag.target.getBoundingClientRect());
        }
        document.addEventListener('pointerdown', handleMoveDown, true);
        document.addEventListener('pointermove', handleMoveMove, true);
        document.addEventListener('pointerup', handleMoveUp, true);
        return () => {
            moveDragRef.current?.target.removeAttribute('data-froam-moving');
            document.removeEventListener('pointerdown', handleMoveDown, true);
            document.removeEventListener('pointermove', handleMoveMove, true);
            document.removeEventListener('pointerup', handleMoveUp, true);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [showPanel, moveMode, viewportStoreKey]);
    /* ─── Cleanup refs on unmount ─── */
    useEffect(() => {
        return () => {
            currentSelectionRef.current?.removeAttribute('data-chef-selected');
            currentSelectionRef.current?.removeAttribute('data-froam-moving');
            currentSelectionRef.current?.removeAttribute('data-froam-multi-selected');
            selectionSwitchTargetRef.current?.removeAttribute('data-froam-switching');
            window.clearTimeout(selectionSwitchTimerRef.current);
            currentHoverRef.current?.removeAttribute('data-chef-hovered');
        };
    }, []);
    /* ─── Restore #root on page unload (refresh / tab close) ─── */
    useEffect(() => {
        function restoreOnUnload() {
            try {
                const vsk = viewportStoreKeyRef.current;
                const routeSnapshot = collectVersionRouteDrafts();
                saveStore({ ...storeRef.current, [vsk]: stripPersonaDrafts(routeSnapshot) });
            }
            catch {
                // Best-effort refresh safety
            }
            const shell = document.getElementById(DEVICE_SHELL_ID);
            const appRoot = getRoot();
            if (shell && appRoot && appRoot.parentElement !== document.body) {
                document.body.insertBefore(appRoot, shell);
            }
            shell?.remove();
        }
        window.addEventListener('beforeunload', restoreOnUnload);
        return () => window.removeEventListener('beforeunload', restoreOnUnload);
    }, []);
    useEffect(() => {
        return () => {
            const shell = document.getElementById(DEVICE_SHELL_ID);
            const appRoot = getRoot();
            if (shell && appRoot) {
                // Move #root back to body before removing shell
                if (appRoot.parentElement !== document.body) {
                    document.body.insertBefore(appRoot, shell);
                }
                shell.remove();
            }
            else if (shell) {
                shell.remove();
            }
            // Strip any viewport constraint styles left on #root
            if (appRoot) {
                appRoot.style.removeProperty('max-width');
                appRoot.style.removeProperty('margin-inline');
                appRoot.style.removeProperty('overflow-x');
                appRoot.style.removeProperty('width');
                appRoot.style.removeProperty('min-height');
                appRoot.style.removeProperty('height');
                appRoot.style.removeProperty('overflow-y');
                appRoot.style.removeProperty('position');
                appRoot.style.removeProperty('left');
                appRoot.style.removeProperty('top');
                appRoot.style.removeProperty('z-index');
                appRoot.style.removeProperty('border-radius');
                appRoot.style.removeProperty('box-shadow');
                appRoot.style.removeProperty('background');
                appRoot.style.removeProperty('transform');
                appRoot.style.removeProperty('transform-origin');
                appRoot.style.removeProperty('isolation');
            }
            document.documentElement.removeAttribute('data-chef-editing');
        };
    }, []);
    /* ─── Refresh layers when section opens ─── */
    useEffect(() => {
        if (!openSections.layers || !showPanel)
            return;
        const root = getRoot();
        if (!root)
            return;
        setLayers(collectLayers(root));
    }, [openSections.layers, showPanel, routeKey]);
    /* ─── History helpers ─── */
    function pushHistory(label, currentStore) {
        const entry = {
            id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            timestamp: Date.now(),
            label,
            routeKey: viewportStoreKey,
            store: JSON.parse(JSON.stringify(currentStore)),
        };
        setHistory((prev) => {
            const next = [entry, ...prev].slice(0, MAX_HISTORY);
            return saveHistory(next);
        });
    }
    function commitToUndoStack(currentStore) {
        setUndoStack((prev) => [...prev.slice(-19), JSON.parse(JSON.stringify(currentStore))]);
        setRedoStack([]);
    }
    function refreshSelectedElementFromDOM() {
        window.requestAnimationFrame(() => {
            if (!selection)
                return;
            const root = getRoot();
            if (!root)
                return;
            const target = findElementByPath(root, selection.path);
            if (!target)
                return;
            const refreshed = buildSelection(target, selection.path);
            currentSelectionRef.current = target;
            target.setAttribute('data-chef-selected', 'true');
            setSelection(refreshed);
            setSelections((current) => current.map((item) => item.path === refreshed.path ? refreshed : item));
            setSelectionRect(target.getBoundingClientRect());
        });
    }
    function undo() {
        if (!undoStack.length)
            return;
        const prev = undoStack[undoStack.length - 1];
        setRedoStack((r) => [...r, JSON.parse(JSON.stringify(store))]);
        setUndoStack((u) => u.slice(0, -1));
        setStore(prev);
        saveStore(prev);
        applyStoreToDOM(prev, { clearCurrent: true });
        refreshSelectedElementFromDOM();
        showToast('Undone');
    }
    function redo() {
        if (!redoStack.length)
            return;
        const next = redoStack[redoStack.length - 1];
        setUndoStack((u) => [...u, JSON.parse(JSON.stringify(store))]);
        setRedoStack((r) => r.slice(0, -1));
        setStore(next);
        saveStore(next);
        applyStoreToDOM(next, { clearCurrent: true });
        refreshSelectedElementFromDOM();
        showToast('Redone');
    }
    function restoreFromHistory(entry) {
        commitToUndoStack(store);
        setStore(entry.store);
        saveStore(entry.store);
        applyStoreToDOM(entry.store, { clearCurrent: true });
        refreshSelectedElementFromDOM();
        showToast(`Restored: ${entry.label}`);
    }
    function collectVersionRouteDrafts() {
        const root = getRoot();
        const latestRouteDrafts = storeRef.current[viewportStoreKeyRef.current] ?? {};
        const nextRouteDrafts = stripPersonaDrafts(latestRouteDrafts);
        if (!root)
            return withPersonaDraft(nextRouteDrafts, persona);
        Object.entries(nextRouteDrafts).forEach(([path, draft]) => {
            if (isInjectionPath(path)) {
                delete nextRouteDrafts[path];
                return;
            }
            if (path === CANVAS_KEY || isFroamPersonaPath(path))
                return;
            const element = findElementByPath(root, path);
            if (element?.closest('[data-froam-injected="true"][data-froam-block="true"]')) {
                delete nextRouteDrafts[path];
                return;
            }
            if (element) {
                nextRouteDrafts[path] = readLiveElementDraft(element, draft);
            }
        });
        const activeElement = currentSelectionRef.current;
        if (activeElement
            && !shouldSkipElement(activeElement)
            && !activeElement.closest('[data-froam-injected="true"][data-froam-block="true"]')) {
            const activePath = getElementPath(activeElement, root);
            if (activePath && !isInjectionPath(activePath)) {
                nextRouteDrafts[activePath] = readLiveElementDraft(activeElement, nextRouteDrafts[activePath] ?? {});
            }
        }
        const injectedBlocks = Array.from(root.querySelectorAll('[data-froam-injected="true"][data-froam-block="true"]'))
            .filter((element) => !element.parentElement?.closest('[data-froam-injected="true"][data-froam-block="true"]'));
        injectedBlocks.forEach((element, order) => {
            const parent = element.parentElement;
            if (!parent)
                return;
            const parentPath = parent === root ? ROOT_PARENT_KEY : getElementPath(parent, root);
            if (parentPath !== ROOT_PARENT_KEY && !parentPath)
                return;
            const id = ensureFroamNodeId(element);
            nextRouteDrafts[`${INJECTION_KEY}:${id}`] = {
                text: JSON.stringify({
                    parentPath,
                    order,
                    html: element.outerHTML,
                }),
            };
        });
        return withPersonaDraft(nextRouteDrafts, persona);
    }
    function persistLiveRouteSnapshot() {
        const routeSnapshot = collectVersionRouteDrafts();
        const next = { ...storeRef.current, [viewportStoreKey]: stripPersonaDrafts(routeSnapshot) };
        storeRef.current = next;
        setStore(next);
        saveStore(next);
        return routeSnapshot;
    }
    function clearDraftsFromDOM(drafts) {
        const root = getRoot();
        if (!root)
            return;
        const injectedBlocks = Array.from(root.querySelectorAll('[data-froam-injected="true"][data-froam-block="true"]'))
            .filter((element) => !element.parentElement?.closest('[data-froam-injected="true"][data-froam-block="true"]'));
        injectedBlocks.forEach((element) => element.remove());
        Object.entries(drafts).forEach(([path]) => {
            if (path === CANVAS_KEY || isInjectionPath(path) || isFroamPersonaPath(path))
                return;
            const target = findElementByPath(root, path);
            if (!target)
                return;
            const original = originalsRef.current[viewportStoreKey]?.[path];
            if (original)
                applyDraft(target, original);
            else
                target.removeAttribute('style');
        });
        if (drafts[CANVAS_KEY])
            clearCanvasDraftStyles();
    }
    function restoreInjectedBlocks(routeDraftsToApply) {
        const root = getRoot();
        if (!root)
            return;
        Object.entries(routeDraftsToApply)
            .filter(([path]) => isInjectionPath(path))
            .map(([, draft]) => readInjectionDraft(draft))
            .filter((draft) => draft !== null)
            .sort((a, b) => a.order - b.order)
            .forEach((injection) => {
            const parent = injection.parentPath === ROOT_PARENT_KEY
                ? root
                : findElementByPath(root, injection.parentPath);
            if (!parent)
                return;
            const template = document.createElement('template');
            template.innerHTML = injection.html.trim();
            const node = template.content.firstElementChild;
            if (!(node instanceof HTMLElement))
                return;
            const nodeId = node.dataset.froamId;
            if (nodeId && Array.from(root.querySelectorAll('[data-froam-id]')).some((element) => element.dataset.froamId === nodeId)) {
                return;
            }
            node.removeAttribute('data-chef-selected');
            node.removeAttribute('data-chef-hovered');
            parent.appendChild(node);
        });
    }
    function applyStoreToDOM(targetStore, options = {}) {
        const root = getRoot();
        if (!root)
            return;
        if (options.clearCurrent) {
            clearDraftsFromDOM(store[viewportStoreKey] ?? {});
        }
        const routeDraftsToApply = targetStore[viewportStoreKey] ?? {};
        restoreInjectedBlocks(routeDraftsToApply);
        Object.entries(routeDraftsToApply).forEach(([path, draft]) => {
            if (path === CANVAS_KEY || isInjectionPath(path) || isFroamPersonaPath(path))
                return;
            const el = findElementByPath(root, path);
            if (el?.closest('[data-froam-injected="true"][data-froam-block="true"]'))
                return;
            if (el)
                applyDraft(el, draft);
        });
        const canvasDraft = routeDraftsToApply[CANVAS_KEY];
        const backgroundColor = canvasDraft?.styles?.backgroundColor;
        const color = canvasDraft?.styles?.color;
        applyCanvasDraftStyles(backgroundColor, color, canvasDraft?.styles);
    }
    /* ─── Draft update ─── */
    function updateDraft(updater, nextSelection, historyLabel) {
        if (!selection)
            return;
        const root = getRoot();
        if (!root)
            return;
        // Debounce undo commits — prevents 3 setState calls per color picker frame
        if (!pendingUndoSnapshotRef.current) {
            pendingUndoSnapshotRef.current = JSON.parse(JSON.stringify(storeRef.current));
        }
        window.clearTimeout(undoDebounceRef.current);
        undoDebounceRef.current = window.setTimeout(() => {
            const snapshot = pendingUndoSnapshotRef.current;
            pendingUndoSnapshotRef.current = null;
            if (snapshot)
                commitToUndoStack(snapshot);
        }, 400);
        const nextStore = { ...storeRef.current };
        const routeStore = { ...(nextStore[viewportStoreKey] ?? {}) };
        const targetsToUpdate = selections.length > 0 ? selections : [selection];
        targetsToUpdate.forEach((sel) => {
            const target = findElementByPath(root, sel.path);
            if (!target)
                return;
            const originalRoute = originalsRef.current[viewportStoreKey] ?? {};
            if (!originalRoute[sel.path]) {
                const s = target.style;
                originalRoute[sel.path] = {
                    text: target.innerText,
                    imageUrl: target instanceof HTMLImageElement ? target.currentSrc || target.src || '' : undefined,
                    styles: {
                        backgroundColor: s.backgroundColor || '',
                        color: s.color || '',
                        borderColor: s.borderColor || '',
                        borderRadius: s.borderRadius || '',
                        borderTopLeftRadius: s.borderTopLeftRadius || '',
                        borderTopRightRadius: s.borderTopRightRadius || '',
                        borderBottomRightRadius: s.borderBottomRightRadius || '',
                        borderBottomLeftRadius: s.borderBottomLeftRadius || '',
                        borderWidth: s.borderWidth || '',
                        borderStyle: s.borderStyle || '',
                        opacity: s.opacity || '',
                        margin: s.margin || '',
                        marginTop: s.marginTop || '',
                        marginRight: s.marginRight || '',
                        marginBottom: s.marginBottom || '',
                        marginLeft: s.marginLeft || '',
                        padding: s.padding || '',
                        paddingTop: s.paddingTop || '',
                        paddingRight: s.paddingRight || '',
                        paddingBottom: s.paddingBottom || '',
                        paddingLeft: s.paddingLeft || '',
                        fontSize: s.fontSize || '',
                        fontFamily: s.fontFamily || '',
                        fontWeight: s.fontWeight || '',
                        fontStyle: s.fontStyle || '',
                        textAlign: s.textAlign || '',
                        lineHeight: s.lineHeight || '',
                        letterSpacing: s.letterSpacing || '',
                        wordSpacing: s.wordSpacing || '',
                        textTransform: s.textTransform || '',
                        textDecorationLine: s.textDecorationLine || '',
                        display: s.display || '',
                        flexDirection: s.flexDirection || '',
                        justifyContent: s.justifyContent || '',
                        alignItems: s.alignItems || '',
                        flexWrap: s.flexWrap || '',
                        gap: s.gap || '',
                        gridTemplateColumns: s.gridTemplateColumns || '',
                        gridTemplateRows: s.gridTemplateRows || '',
                        position: s.position || '',
                        zIndex: s.zIndex || '',
                        overflow: s.overflow || '',
                        cursor: s.cursor || '',
                        width: s.width || '',
                        height: s.height || '',
                        minWidth: s.minWidth || '',
                        maxWidth: s.maxWidth || '',
                        minHeight: s.minHeight || '',
                        maxHeight: s.maxHeight || '',
                        aspectRatio: s.aspectRatio || '',
                        transform: s.transform || '',
                        boxShadow: s.boxShadow || '',
                        textShadow: s.textShadow || '',
                        filter: s.filter || '',
                        backdropFilter: s.backdropFilter || '',
                        mixBlendMode: s.mixBlendMode || '',
                        backgroundImage: s.backgroundImage || '',
                        backgroundSize: s.backgroundSize || '',
                        backgroundPosition: s.backgroundPosition || '',
                        backgroundRepeat: s.backgroundRepeat || '',
                    },
                };
                originalsRef.current[viewportStoreKey] = originalRoute;
            }
            const currentDraft = routeStore[sel.path] ?? {};
            const nextDraft = sanitizeDraftForElement(target, updater(currentDraft));
            applyDraft(target, nextDraft);
            syncFroamArtboardMetadata(target);
            routeStore[sel.path] = nextDraft;
        });
        nextStore[viewportStoreKey] = routeStore;
        storeRef.current = nextStore;
        setStore(nextStore);
        if (nextSelection) {
            setSelection((current) => (current ? { ...current, ...nextSelection } : current));
            setSelections((current) => current.map((s) => ({ ...s, ...nextSelection })));
        }
        if (historyLabel)
            pushHistory(historyLabel, nextStore);
    }
    function applyStyle(styles, nextSel, label) {
        updateDraft((draft) => ({ ...draft, styles: { ...(draft.styles ?? {}), ...styles } }), nextSel, label ?? `Style: ${Object.keys(styles).join(', ')}`);
    }
    /* ─── Design Intelligence bridges ─── */
    // Select an arbitrary element (used by the Health scanner to jump to an issue).
    function selectElementFromIntel(el) {
        const root = getRoot();
        if (!root || !root.contains(el))
            return;
        const path = getElementPath(el, root);
        if (!path)
            return;
        updateSelectionsState([buildSelection(el, path)]);
        setRightPanelOpen(true);
        el.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }
    // Apply styles to a specific element by path, independent of the async selection state.
    function fixElementFromIntel(el, styles, label) {
        const root = getRoot();
        if (!root || !root.contains(el))
            return;
        const path = getElementPath(el, root);
        if (!path)
            return;
        const target = findElementByPath(root, path);
        if (!target)
            return;
        const beforeSnapshot = JSON.parse(JSON.stringify(storeRef.current));
        const nextStore = { ...storeRef.current };
        const routeStore = { ...(nextStore[viewportStoreKey] ?? {}) };
        const currentDraft = routeStore[path] ?? {};
        const nextDraft = sanitizeDraftForElement(target, {
            ...currentDraft,
            styles: { ...(currentDraft.styles ?? {}), ...styles },
        });
        applyDraft(target, nextDraft);
        syncFroamArtboardMetadata(target);
        routeStore[path] = nextDraft;
        nextStore[viewportStoreKey] = routeStore;
        storeRef.current = nextStore;
        setStore(nextStore);
        commitToUndoStack(beforeSnapshot);
        pushHistory(label, nextStore);
        selectElementFromIntel(el);
    }
    function applySizePreset(preset) {
        if (!selection)
            return;
        if (preset === 'auto') {
            applyStyle({ width: '', height: '', minWidth: '', maxWidth: '', minHeight: '', maxHeight: '', aspectRatio: '' }, { width: 'auto', height: 'auto', minWidth: '', maxWidth: '', minHeight: '', maxHeight: '', aspectRatio: '' }, 'Size: auto');
            return;
        }
        if (preset === 'hug') {
            applyStyle({ width: 'max-content', height: 'auto', maxWidth: '100%' }, { width: 'max-content', height: 'auto', maxWidth: '100%' }, 'Size: hug content');
            return;
        }
        if (preset === 'fill') {
            applyStyle({ width: '100%', maxWidth: '100%', height: 'auto' }, { width: '100%', maxWidth: '100%', height: 'auto' }, 'Size: fill parent');
            return;
        }
        if (preset === 'fullBleed') {
            applyStyle({ width: '100vw', maxWidth: '100vw', marginLeft: 'calc(50% - 50vw)', marginRight: 'calc(50% - 50vw)' }, { width: '100vw', maxWidth: '100vw', marginLeft: 0, marginRight: 0 }, 'Size: full bleed');
            return;
        }
        if (preset === 'square') {
            const side = selectionRect ? `${Math.round(Math.max(selectionRect.width, selectionRect.height))}px` : selection.width;
            applyStyle({ width: side, height: side, aspectRatio: '1 / 1' }, { width: side, height: side, aspectRatio: '1 / 1' }, 'Size: square');
            return;
        }
        applyStyle({ minHeight: '100vh' }, { minHeight: '100vh' }, 'Size: viewport height');
    }
    /* ─── Clear / reset ─── */
    function updateTargetDraft(target, updater, nextSelection, historyLabel) {
        const root = getRoot();
        if (!root)
            return;
        const path = getElementPath(target, root);
        if (!isSafeDraftPath(path))
            return;
        const originalRoute = originalsRef.current[viewportStoreKey] ?? {};
        if (!originalRoute[path]) {
            const s = target.style;
            originalRoute[path] = {
                text: target.innerText,
                imageUrl: target instanceof HTMLImageElement ? target.currentSrc || target.src || '' : undefined,
                styles: {
                    backgroundColor: s.backgroundColor || '',
                    color: s.color || '',
                    borderColor: s.borderColor || '',
                    borderRadius: s.borderRadius || '',
                    borderWidth: s.borderWidth || '',
                    borderStyle: s.borderStyle || '',
                    opacity: s.opacity || '',
                    padding: s.padding || '',
                    margin: s.margin || '',
                    display: s.display || '',
                    gap: s.gap || '',
                    width: s.width || '',
                    height: s.height || '',
                    minWidth: s.minWidth || '',
                    maxWidth: s.maxWidth || '',
                    minHeight: s.minHeight || '',
                    maxHeight: s.maxHeight || '',
                    aspectRatio: s.aspectRatio || '',
                    backgroundImage: s.backgroundImage || '',
                    backgroundSize: s.backgroundSize || '',
                    backgroundPosition: s.backgroundPosition || '',
                    backgroundRepeat: s.backgroundRepeat || '',
                },
            };
            originalsRef.current[viewportStoreKey] = originalRoute;
        }
        window.clearTimeout(undoDebounceRef.current);
        undoDebounceRef.current = window.setTimeout(() => commitToUndoStack(storeRef.current), 400);
        const currentDraft = routeDrafts[path] ?? {};
        const nextDraft = sanitizeDraftForElement(target, updater(currentDraft));
        applyDraft(target, nextDraft);
        const nextStore = {
            ...store,
            [viewportStoreKey]: {
                ...(store[viewportStoreKey] ?? {}),
                [path]: nextDraft,
            },
        };
        setStore(nextStore);
        currentSelectionRef.current?.removeAttribute('data-chef-selected');
        currentSelectionRef.current = target;
        target.setAttribute('data-chef-selected', 'true');
        setSelection({ ...buildSelection(target, path), ...nextSelection });
        if (historyLabel)
            pushHistory(historyLabel, nextStore);
    }
    function clearSelectionDraft() {
        if (!selection)
            return;
        const root = getRoot();
        const target = root ? findElementByPath(root, selection.path) : null;
        const original = originalsRef.current[viewportStoreKey]?.[selection.path];
        if (target && original)
            applyDraft(target, original);
        else if (target)
            target.removeAttribute('style');
        setStore((current) => {
            const routeEntries = { ...(current[viewportStoreKey] ?? {}) };
            delete routeEntries[selection.path];
            return { ...current, [viewportStoreKey]: routeEntries };
        });
        updateSelectionsState([]);
        showToast('Selection cleared');
    }
    function clearRouteDrafts() {
        const root = getRoot();
        if (root) {
            Object.entries(routeDrafts).forEach(([path]) => {
                if (path === CANVAS_KEY || isInjectionPath(path) || isFroamPersonaPath(path))
                    return;
                const target = findElementByPath(root, path);
                if (target) {
                    const original = originalsRef.current[viewportStoreKey]?.[path];
                    if (original)
                        applyDraft(target, original);
                    else
                        target.removeAttribute('style');
                }
            });
        }
        setStore((current) => {
            const next = { ...current };
            delete next[viewportStoreKey];
            return next;
        });
        clearCanvasDraftStyles();
        root?.querySelectorAll('[data-froam-injected="true"][data-froam-block="true"]').forEach((element) => {
            if (!element.parentElement?.closest('[data-froam-injected="true"][data-froam-block="true"]')) {
                element.remove();
            }
        });
        setCanvas(readCanvasState());
        showToast(`${viewportMode} reset`);
    }
    /* ─── Canvas styles ─── */
    function applyCanvasStyles(patch) {
        if (!getCanvasHost()) {
            showToast('Canvas edits need a page canvas host');
            return;
        }
        const next = { ...canvas, ...patch };
        const currentCanvasDraft = store[viewportStoreKey]?.[CANVAS_KEY]?.styles ?? {};
        const nextStyles = {
            ...currentCanvasDraft,
            backgroundColor: next.background,
            color: next.text,
        };
        applyCanvasDraftStyles(next.background, next.text, nextStyles);
        setCanvas(next);
        setStore((current) => ({
            ...current,
            [viewportStoreKey]: {
                ...(current[viewportStoreKey] ?? {}),
                [CANVAS_KEY]: {
                    styles: nextStyles,
                },
            },
        }));
    }
    /* ─── Save / export ─── */
    function applyCanvasImage(imageData) {
        keepStudioPinned();
        if (!getCanvasHost()) {
            showToast('Canvas edits need a page canvas host');
            return;
        }
        const next = { ...canvas, imageUrl: imageData };
        const currentCanvasDraft = store[viewportStoreKey]?.[CANVAS_KEY]?.styles ?? {};
        const nextStyles = {
            ...currentCanvasDraft,
            backgroundColor: next.background,
            color: next.text,
            backgroundImage: `url("${imageData}")`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            backgroundRepeat: 'no-repeat',
            backgroundAttachment: 'scroll',
        };
        applyCanvasDraftStyles(next.background, next.text, nextStyles);
        setCanvas(next);
        setStore((current) => ({
            ...current,
            [viewportStoreKey]: {
                ...(current[viewportStoreKey] ?? {}),
                [CANVAS_KEY]: { styles: nextStyles },
            },
        }));
        showToast('Page background image applied');
    }
    function clearCanvasImage() {
        keepStudioPinned();
        if (!getCanvasHost()) {
            showToast('Canvas edits need a page canvas host');
            return;
        }
        const next = { ...canvas, imageUrl: '' };
        const currentCanvasDraft = store[viewportStoreKey]?.[CANVAS_KEY]?.styles ?? {};
        const nextStyles = {
            ...currentCanvasDraft,
            backgroundColor: next.background,
            color: next.text,
            backgroundImage: '',
            backgroundSize: '',
            backgroundPosition: '',
            backgroundRepeat: '',
            backgroundAttachment: '',
        };
        applyCanvasDraftStyles(next.background, next.text, nextStyles);
        setCanvas(next);
        setStore((current) => ({
            ...current,
            [viewportStoreKey]: {
                ...(current[viewportStoreKey] ?? {}),
                [CANVAS_KEY]: { styles: nextStyles },
            },
        }));
        showToast('Page background image cleared');
    }
    async function copyRouteDrafts() {
        const payload = JSON.stringify(collectVersionRouteDrafts(), null, 2);
        await navigator.clipboard.writeText(payload);
        showToast('Copied to clipboard');
    }
    async function copyDesignReport() {
        const routeSnapshot = collectVersionRouteDrafts();
        const report = buildFroamChangeReport({
            routeKey,
            viewportMode,
            viewportStoreKey,
            drafts: routeSnapshot,
            persona,
        });
        await navigator.clipboard.writeText(report);
        showToast('Design report copied for Codex');
    }
    async function saveToRunam() {
        keepStudioPinned();
        const routeSnapshot = collectVersionRouteDrafts();
        const nextStore = { ...store, [viewportStoreKey]: stripPersonaDrafts(routeSnapshot) };
        const payload = {
            savedAt: new Date().toISOString(),
            route: viewportStoreKey,
            routeKey,
            viewportMode,
            draftCount: countRenderableDrafts(routeSnapshot),
        };
        setStore(nextStore);
        saveStore(nextStore);
        window.localStorage.setItem(SAVE_META_KEY, JSON.stringify(payload));
        try {
            await apiPost('/api/froam/published', {
                routeKey,
                viewportMode,
                store: routeSnapshot,
            });
            showToast('Published');
        }
        catch (error) {
            const message = error instanceof Error ? error.message : '';
            showToast(message.includes('restricted') || message.includes('token') ? 'Saved locally. Admin sign-in needed to publish.' : 'Saved locally. Publish server unavailable.');
        }
    }
    async function saveToRepo() {
        keepStudioPinned();
        const routeSnapshot = collectVersionRouteDrafts();
        const cleanDrafts = stripPersonaDrafts(routeSnapshot);
        const nextStore = { ...store, [viewportStoreKey]: cleanDrafts };
        setStore(nextStore);
        saveStore(nextStore);
        try {
            const response = await window.fetch(bridgeUrl('/__froam/repo/save'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ routeKey, viewportMode, store: cleanDrafts }),
            });
            const data = await response.json().catch(() => null);
            if (!response.ok || !data?.success)
                throw new Error(data?.error || 'Repo bridge unavailable');
            showToast('Saved to repo — commit & push to ship it');
        }
        catch {
            showToast('Repo bridge offline — run `froam dev` or add froamStudio() to vite.config');
        }
    }
    function downloadRunamDrafts() {
        const routeSnapshot = collectVersionRouteDrafts();
        const nextStore = { ...storeRef.current, [viewportStoreKeyRef.current]: stripPersonaDrafts(routeSnapshot) };
        storeRef.current = nextStore;
        setStore(nextStore);
        saveStore(nextStore);
        const payload = JSON.stringify({ savedAt: new Date().toISOString(), route: viewportStoreKeyRef.current, store: nextStore }, null, 2);
        const blob = new Blob([payload], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = `froam-studio-${routeKey.replace(/[^a-z0-9]+/gi, '-') || 'home'}.json`;
        anchor.click();
        URL.revokeObjectURL(url);
        showToast('Exported JSON');
    }
    /* ─── Container injection ─── */
    function updateSelectionsState(nextSelections) {
        try {
            const root = getRoot();
            const previousElement = currentSelectionRef.current;
            const previousPath = root && previousElement && root.contains(previousElement)
                ? getElementPath(previousElement, root)
                : '';
            if (root) {
                root.querySelectorAll('[data-chef-selected="true"]').forEach((el) => {
                    el.removeAttribute('data-chef-selected');
                    el.removeAttribute('data-froam-multi-selected');
                });
            }
            nextSelections.forEach((sel) => {
                const el = root ? findElementByPath(root, sel.path) : null;
                if (el) {
                    el.setAttribute('data-chef-selected', 'true');
                    if (nextSelections.length > 1)
                        el.setAttribute('data-froam-multi-selected', 'true');
                }
            });
            setSelections(nextSelections);
            const primary = nextSelections[nextSelections.length - 1] ?? null;
            setSelection(primary);
            const nextElement = primary && root ? findElementByPath(root, primary.path) : null;
            currentSelectionRef.current = nextElement;
            setSelectionRect(nextElement ? nextElement.getBoundingClientRect() : null);
            if (!nextElement) {
                markSelectionSwitch(null);
            }
            else if (primary.path !== previousPath) {
                markSelectionSwitch(nextElement, moveMode ? 'Moving' : 'Editing');
            }
            if (root) {
                try {
                    setLayers(collectLayers(root));
                }
                catch { /* DOM may be mid-render */ }
            }
        }
        catch {
            // Safe fallback if DOM nodes disappear mid-update
        }
    }
    function selectInsertedElement(element) {
        const root = getRoot();
        if (!root)
            return;
        const path = getElementPath(element, root);
        const sel = buildSelection(element, path);
        updateSelectionsState([sel]);
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    function getStructureTarget() {
        const root = getRoot();
        if (!root)
            return null;
        const canvas = root.querySelector('[data-froam-canvas], .kitchen-canvas');
        if (!selection)
            return canvas ?? root;
        return findElementByPath(root, selection.path) ?? canvas ?? root;
    }
    function applyInjectedBase(element) {
        element.setAttribute('data-froam-injected', 'true');
        element.setAttribute('data-froam-block', 'true');
        ensureFroamNodeId(element);
        element.style.boxSizing = 'border-box';
        element.style.width = '100%';
    }
    function syncImageFrameState(frame, imageUrl) {
        const hasImage = Boolean(imageUrl);
        const chrome = frame.querySelector('[data-froam-image-ui="true"]');
        if (chrome) {
            chrome.style.opacity = hasImage ? '0' : '1';
            chrome.style.pointerEvents = hasImage ? 'none' : 'auto';
        }
        frame.style.borderStyle = hasImage ? 'solid' : 'dashed';
        frame.style.borderColor = hasImage ? 'rgba(15, 23, 42, 0.12)' : 'rgba(15, 23, 42, 0.24)';
    }
    function applyImageToTarget(target, imageData) {
        if (target instanceof HTMLImageElement) {
            updateTargetDraft(target, (draft) => ({ ...draft, imageUrl: imageData }), { imageUrl: imageData }, 'Uploaded image');
            return;
        }
        updateTargetDraft(target, (draft) => ({
            ...draft,
            imageUrl: imageData,
            styles: {
                ...(draft.styles ?? {}),
                backgroundImage: `url("${imageData}")`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                backgroundRepeat: 'no-repeat',
            },
        }), { imageUrl: imageData }, 'Uploaded image');
        if (target.dataset.froamImageFrame === 'true') {
            syncImageFrameState(target, imageData);
        }
    }
    function addImageBlockFromSource(imageData, label = 'Image added') {
        const frame = createInjectedBlock('image');
        if (!placeInsertedNode(frame, 'inside'))
            return;
        selectInsertedElement(frame);
        applyImageToTarget(frame, imageData);
        syncImageFrameState(frame, imageData);
        persistLiveRouteSnapshot();
        showToast(label);
    }
    function insertShapeLayer(svgString, width, height) {
        const shape = createInjectedBlock('shape');
        shape.innerHTML = svgString;
        Object.assign(shape.style, {
            width: `${Math.max(20, Math.round(width))}px`,
            height: `${Math.max(20, Math.round(height))}px`,
            minWidth: '20px',
            minHeight: '20px',
            maxWidth: 'none',
            display: 'inline-grid',
            placeItems: 'stretch',
            padding: '0',
            lineHeight: '0',
            flex: '0 0 auto',
            resize: 'both',
            overflow: 'visible',
        });
        const svg = shape.querySelector('svg');
        if (svg) {
            svg.setAttribute('width', '100%');
            svg.setAttribute('height', '100%');
            svg.style.display = 'block';
            svg.style.width = '100%';
            svg.style.height = '100%';
            svg.style.pointerEvents = 'none';
        }
        if (!placeInsertedNode(shape, 'inside'))
            return;
        selectInsertedElement(shape);
        persistLiveRouteSnapshot();
    }
    function readImageFile(file, target) {
        const reader = new FileReader();
        reader.onload = () => {
            const imageData = typeof reader.result === 'string' ? reader.result : undefined;
            if (!imageData)
                return;
            applyImageToTarget(target, imageData);
            showToast('Image applied');
        };
        reader.readAsDataURL(file);
    }
    function createInjectedBlock(kind) {
        if (kind === 'header') {
            const header = document.createElement('header');
            applyInjectedBase(header);
            Object.assign(header.style, {
                minHeight: '86px',
                padding: '22px 28px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '20px',
                borderRadius: '28px',
                border: '1px solid rgba(15, 23, 42, 0.12)',
                background: 'rgba(255, 255, 255, 0.94)',
                color: '#111827',
            });
            header.innerHTML = '<strong contenteditable="true">New header</strong><nav contenteditable="true">Home  Work  Contact</nav>';
            return header;
        }
        if (kind === 'footer') {
            const footer = document.createElement('footer');
            applyInjectedBase(footer);
            Object.assign(footer.style, {
                minHeight: '110px',
                padding: '28px',
                display: 'grid',
                gap: '10px',
                borderRadius: '28px',
                border: '1px solid rgba(15, 23, 42, 0.12)',
                background: '#0b0f14',
                color: '#f8fafc',
            });
            footer.innerHTML = '<strong contenteditable="true">Footer</strong><p contenteditable="true">Add links, copyright text, contact details, or final calls to action here.</p>';
            return footer;
        }
        if (kind === 'hero') {
            const section = document.createElement('section');
            applyInjectedBase(section);
            Object.assign(section.style, {
                minHeight: '360px',
                padding: '48px',
                display: 'grid',
                alignContent: 'center',
                gap: '18px',
                borderRadius: '36px',
                border: '1px solid rgba(15, 23, 42, 0.12)',
                background: 'linear-gradient(135deg, #f8fafc 0%, #e8f8f1 54%, #fff1ed 100%)',
                color: '#0f172a',
            });
            section.innerHTML = '<p contenteditable="true" style="margin:0;font-weight:800;letter-spacing:.14em;text-transform:uppercase;color:#ef4444;">Hero</p><h1 contenteditable="true" style="margin:0;font-size:clamp(2.6rem,6vw,5rem);line-height:.94;">Cook your next layout.</h1><p contenteditable="true" style="max-width:620px;margin:0;color:#475569;font-size:1.05rem;line-height:1.7;">Drop images, tune colors, resize containers, and shape the page from Froam.</p><button type="button" contenteditable="true" style="width:max-content;border:0;border-radius:999px;padding:14px 20px;background:#111827;color:#fff;font-weight:800;">Edit this button</button>';
            return section;
        }
        if (kind === 'section') {
            const section = document.createElement('section');
            applyInjectedBase(section);
            Object.assign(section.style, {
                minHeight: '260px',
                padding: '32px',
                display: 'grid',
                gap: '18px',
                borderRadius: '32px',
                border: '1px solid rgba(15, 23, 42, 0.12)',
                background: '#ffffff',
                color: '#111827',
            });
            section.innerHTML = '<p contenteditable="true" style="margin:0;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:#16a34a;">Section</p><h2 contenteditable="true" style="margin:0;font-size:2.3rem;line-height:1;">New section</h2><p contenteditable="true" style="margin:0;color:#64748b;line-height:1.7;">Write what this section needs to say.</p>';
            return section;
        }
        if (kind === 'grid') {
            const grid = document.createElement('div');
            applyInjectedBase(grid);
            Object.assign(grid.style, {
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                gap: '16px',
                padding: '18px',
                borderRadius: '28px',
                border: '1px dashed rgba(22, 163, 74, 0.35)',
                background: 'rgba(248, 250, 252, 0.86)',
            });
            grid.innerHTML = Array.from({ length: 3 }, (_, index) => `<article data-froam-injected="true" style="min-height:140px;border-radius:22px;border:1px solid rgba(15,23,42,.1);padding:18px;background:#fff;color:#111827;"><strong contenteditable="true">Grid card ${index + 1}</strong><p contenteditable="true" style="color:#64748b;line-height:1.6;">Add content here.</p></article>`).join('');
            return grid;
        }
        if (kind === 'stats') {
            const stats = document.createElement('div');
            applyInjectedBase(stats);
            Object.assign(stats.style, {
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
                gap: '14px',
            });
            stats.innerHTML = ['24', '98%', '4.9'].map((value) => `<article data-froam-injected="true" style="padding:20px;border-radius:24px;border:1px solid rgba(15,23,42,.1);background:#fff;color:#111827;"><strong contenteditable="true" style="font-size:2rem;">${value}</strong><p contenteditable="true" style="margin:.35rem 0 0;color:#64748b;">Metric label</p></article>`).join('');
            return stats;
        }
        if (kind === 'card' || kind === 'container') {
            const card = document.createElement('article');
            applyInjectedBase(card);
            Object.assign(card.style, {
                minHeight: kind === 'container' ? '180px' : '150px',
                padding: kind === 'container' ? '28px' : '22px',
                display: 'grid',
                gap: '12px',
                borderRadius: kind === 'container' ? '30px' : '24px',
                border: kind === 'container' ? '1px dashed rgba(22, 163, 74, 0.38)' : '1px solid rgba(15, 23, 42, 0.12)',
                background: '#ffffff',
                color: '#111827',
            });
            card.innerHTML = `<strong contenteditable="true">${kind === 'container' ? 'New container' : 'New card'}</strong><p contenteditable="true" style="margin:0;color:#64748b;line-height:1.65;">Add text, images, buttons, or nested blocks here.</p>`;
            return card;
        }
        if (kind === 'text') {
            const text = document.createElement('div');
            applyInjectedBase(text);
            Object.assign(text.style, {
                padding: '16px 0',
                color: '#111827',
            });
            text.innerHTML = '<h2 contenteditable="true" style="margin:0 0 10px;font-size:2rem;line-height:1.05;">Editable heading</h2><p contenteditable="true" style="margin:0;color:#64748b;line-height:1.75;">Write your copy here and style it with Froam.</p>';
            return text;
        }
        if (kind === 'image') {
            const frame = document.createElement('div');
            applyInjectedBase(frame);
            frame.dataset.froamImageFrame = 'true';
            Object.assign(frame.style, {
                minHeight: '220px',
                display: 'grid',
                placeItems: 'center',
                borderRadius: '28px',
                border: '1px dashed rgba(15, 23, 42, 0.24)',
                background: 'linear-gradient(135deg, rgba(248,250,252,.96), rgba(226,232,240,.82))',
                color: '#64748b',
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                backgroundRepeat: 'no-repeat',
                overflow: 'hidden',
                position: 'relative',
                cursor: 'pointer',
            });
            const frameUi = document.createElement('div');
            frameUi.setAttribute('data-froam-image-ui', 'true');
            frameUi.setAttribute('data-chef-editor-root', 'true');
            Object.assign(frameUi.style, {
                display: 'grid',
                gap: '12px',
                justifyItems: 'center',
                padding: '20px',
                textAlign: 'center',
            });
            const pill = document.createElement('button');
            pill.type = 'button';
            pill.textContent = 'Drop or add image';
            Object.assign(pill.style, {
                minHeight: '42px',
                padding: '0 16px',
                borderRadius: '999px',
                border: '1px solid rgba(15, 23, 42, 0.14)',
                background: 'rgba(255, 255, 255, 0.88)',
                color: '#0f172a',
                fontWeight: '700',
                cursor: 'pointer',
            });
            pill.addEventListener('click', (event) => {
                event.preventDefault();
                event.stopPropagation();
                pendingImageTargetRef.current = frame;
                selectInsertedElement(frame);
                fileInputRef.current?.click();
            });
            const label = document.createElement('span');
            label.textContent = 'Drop or add image';
            Object.assign(label.style, {
                fontWeight: '800',
                fontSize: '1rem',
            });
            const note = document.createElement('span');
            note.textContent = 'Use Froam upload, click the button, or drag a file straight into the frame.';
            Object.assign(note.style, {
                maxWidth: '260px',
                color: '#64748b',
                lineHeight: '1.55',
                fontSize: '0.92rem',
            });
            frameUi.append(pill, label, note);
            frame.appendChild(frameUi);
            frame.addEventListener('dragover', (event) => {
                event.preventDefault();
                frame.style.borderColor = 'rgba(239, 68, 68, 0.45)';
                frame.style.backgroundColor = 'rgba(255, 255, 255, 0.92)';
            });
            frame.addEventListener('dragleave', () => {
                syncImageFrameState(frame, readImageUrl(frame.style.backgroundImage));
                frame.style.backgroundColor = '';
            });
            frame.addEventListener('drop', (event) => {
                event.preventDefault();
                const file = event.dataTransfer?.files?.[0];
                frame.style.backgroundColor = '';
                if (!file)
                    return;
                pendingImageTargetRef.current = frame;
                selectInsertedElement(frame);
                readImageFile(file, frame);
            });
            syncImageFrameState(frame);
            return frame;
        }
        if (kind === 'button') {
            const button = document.createElement('button');
            applyInjectedBase(button);
            button.type = 'button';
            button.setAttribute('contenteditable', 'true');
            Object.assign(button.style, {
                width: 'max-content',
                minHeight: '48px',
                padding: '0 20px',
                border: '0',
                borderRadius: '999px',
                background: '#ef4444',
                color: '#ffffff',
                fontWeight: '800',
                cursor: 'pointer',
            });
            button.textContent = 'New button';
            return button;
        }
        if (kind === 'shape') {
            const shape = document.createElement('div');
            applyInjectedBase(shape);
            shape.dataset.froamShape = 'true';
            Object.assign(shape.style, {
                width: '200px',
                height: '140px',
                minWidth: '20px',
                minHeight: '20px',
                display: 'inline-grid',
                placeItems: 'center',
                padding: '12px',
                borderRadius: '0',
                background: 'transparent',
                color: '#0f172a',
                border: '2px solid #0f172a',
                fontFamily: 'Satoshi, system-ui, sans-serif',
                fontSize: '18px',
                fontWeight: '700',
                textAlign: 'center',
                flex: '0 0 auto',
                resize: 'both',
                overflow: 'visible',
            });
            return shape;
        }
        const divider = document.createElement('hr');
        applyInjectedBase(divider);
        Object.assign(divider.style, {
            height: '1px',
            minHeight: '1px',
            border: '0',
            margin: '20px 0',
            background: 'rgba(15, 23, 42, 0.16)',
        });
        return divider;
    }
    function addStructureBlock(kind, mode = 'inside') {
        const target = getStructureTarget();
        if (!target)
            return;
        const block = createInjectedBlock(kind);
        if (mode === 'after' && selection && target.parentElement) {
            target.parentElement.insertBefore(block, target.nextSibling);
        }
        else {
            target.appendChild(block);
        }
        selectInsertedElement(block);
        persistLiveRouteSnapshot();
        showToast(`Added ${kind}`);
    }
    function createFroamArtboard(frame, label = 'Blank white page') {
        const artboard = document.createElement('section');
        applyInjectedBase(artboard);
        artboard.dataset.froamArtboard = 'true';
        artboard.dataset.froamFrameLabel = label;
        artboard.dataset.froamFrameWidth = String(frame.width);
        artboard.dataset.froamFrameHeight = String(frame.height);
        artboard.dataset.froamFramePreset = frame.preset;
        Object.assign(artboard.style, {
            width: frame.preset === 'responsive' ? '100%' : `${frame.width}px`,
            maxWidth: frame.preset === 'responsive' ? `${frame.width}px` : 'none',
            height: `${frame.height}px`,
            minHeight: `${frame.height}px`,
            margin: '28px auto',
            padding: '0',
            display: 'block',
            position: 'relative',
            overflow: 'hidden',
            flexShrink: '0',
            border: '1px solid rgba(15, 23, 42, 0.14)',
            borderRadius: '0',
            background: frame.background || '#ffffff',
            boxShadow: '0 18px 50px rgba(15, 23, 42, 0.12)',
            color: '#0f172a',
        });
        return artboard;
    }
    function selectedPlacementTarget(root) {
        const selected = currentSelectionRef.current
            ?? (selection ? findElementByPath(root, selection.path) : null);
        if (!selected)
            return null;
        return selected.closest('[data-froam-artboard="true"], [data-froam-component-id], [data-froam-block="true"]')
            ?? selected;
    }
    function placeInsertedNode(node, placement) {
        const root = getRoot();
        if (!root)
            return false;
        const canvasTarget = root.querySelector('[data-froam-canvas], .kitchen-canvas') ?? root;
        const selectedTarget = selectedPlacementTarget(root);
        if (placement === 'start') {
            canvasTarget.insertBefore(node, canvasTarget.firstChild);
            return true;
        }
        if (placement === 'inside' && selectedTarget) {
            selectedTarget.appendChild(node);
            return true;
        }
        if ((placement === 'before' || placement === 'after') && selectedTarget?.parentElement) {
            selectedTarget.parentElement.insertBefore(node, placement === 'before' ? selectedTarget : selectedTarget.nextSibling);
            return true;
        }
        canvasTarget.appendChild(node);
        if (['before', 'after', 'inside'].includes(placement) && !selectedTarget) {
            showToast('Nothing selected, so Froam placed it at the page end');
        }
        return true;
    }
    function insertLibraryComponent(componentId, placement, frame) {
        const component = createFroamLibraryComponent(componentId);
        if (!component)
            return;
        applyInjectedBase(component);
        assignFreshFroamNodeIds(component);
        const node = placement === 'new-frame'
            ? createFroamArtboard(frame, component.dataset.froamComponentCategory || 'Website section')
            : component;
        if (node !== component) {
            node.appendChild(component);
            assignFreshFroamNodeIds(node);
        }
        if (!placeInsertedNode(node, placement))
            return;
        selectInsertedElement(node);
        persistLiveRouteSnapshot();
        showToast(placement === 'new-frame' ? 'Component inserted on a new white page' : `Component inserted: ${placement}`);
    }
    function insertBlankFrame(placement, frame) {
        const artboard = createFroamArtboard(frame);
        assignFreshFroamNodeIds(artboard);
        if (!placeInsertedNode(artboard, placement))
            return;
        selectInsertedElement(artboard);
        persistLiveRouteSnapshot();
        showToast('Blank white page inserted');
    }
    function buildLibraryPage(sections) {
        const root = getRoot();
        if (!root)
            return;
        suspendDraftPaintingRef.current = true;
        pendingDraftPaintResumeRef.current = true;
        const canvasTarget = root.querySelector('[data-froam-canvas], .kitchen-canvas') ?? root;
        canvasTarget.querySelectorAll('[data-froam-artboard="true"]').forEach((artboard) => artboard.remove());
        canvasTarget.querySelectorAll('[data-froam-component-id]').forEach((component) => {
            if (!component.closest('[data-froam-artboard="true"]'))
                component.remove();
        });
        let lastArtboard = null;
        sections.forEach((section) => {
            const artboard = createFroamArtboard(section.frame, section.name);
            artboard.dataset.froamSectionId = section.id;
            if (section.componentId) {
                const component = createFroamLibraryComponent(section.componentId);
                if (component) {
                    applyInjectedBase(component);
                    component.style.margin = '0';
                    component.style.minHeight = '100%';
                    component.style.height = '100%';
                    artboard.appendChild(component);
                }
            }
            assignFreshFroamNodeIds(artboard);
            canvasTarget.appendChild(artboard);
            lastArtboard = artboard;
        });
        if (lastArtboard)
            selectInsertedElement(lastArtboard);
        persistLiveRouteSnapshot();
    }
    function wrapInContainer() {
        if (!selection)
            return;
        const root = getRoot();
        if (!root)
            return;
        const target = findElementByPath(root, selection.path);
        if (!target || !target.parentElement)
            return;
        const wrapper = document.createElement('div');
        wrapper.setAttribute('data-froam-injected', 'true');
        wrapper.setAttribute('data-froam-block', 'true');
        ensureFroamNodeId(wrapper);
        wrapper.style.display = 'flex';
        wrapper.style.flexDirection = 'column';
        target.parentElement.insertBefore(wrapper, target);
        wrapper.appendChild(target);
        selectInsertedElement(wrapper);
        persistLiveRouteSnapshot();
        showToast('Wrapped in container');
    }
    function rectsOverlap(a, b) {
        return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
    }
    function getMergeElements(root) {
        const selectedElements = selections
            .map((sel) => findElementByPath(root, sel.path))
            .filter((el) => el !== null);
        if (selectedElements.length > 1)
            return selectedElements;
        const primary = selectedElements[0] ?? currentSelectionRef.current;
        if (!primary || !primary.parentElement)
            return primary ? [primary] : [];
        const primaryRect = primary.getBoundingClientRect();
        const siblings = Array.from(primary.parentElement.children)
            .filter((child) => (child instanceof HTMLElement
            && child !== primary
            && !child.closest('[data-chef-editor-root="true"]')
            && rectsOverlap(primaryRect, child.getBoundingClientRect())));
        return [primary, ...siblings];
    }
    function groupSelected() {
        const root = getRoot();
        if (!root)
            return;
        const elements = getMergeElements(root);
        if (elements.length < 2) {
            showToast('Select or overlap at least 2 layers to merge');
            return;
        }
        const parent = elements[0].parentElement;
        if (!parent)
            return;
        const sameParent = elements.every((el) => el.parentElement === parent);
        if (!sameParent) {
            showToast('Can only group elements with the same parent');
            return;
        }
        const sortedElements = Array.from(parent.children)
            .filter((child) => child instanceof HTMLElement && elements.includes(child));
        const rects = sortedElements.map((element) => ({ element, rect: element.getBoundingClientRect() }));
        const parentRect = parent.getBoundingClientRect();
        const left = Math.min(...rects.map(({ rect }) => rect.left));
        const top = Math.min(...rects.map(({ rect }) => rect.top));
        const right = Math.max(...rects.map(({ rect }) => rect.right));
        const bottom = Math.max(...rects.map(({ rect }) => rect.bottom));
        const firstEl = sortedElements[0];
        const parentComputed = window.getComputedStyle(parent);
        if (parentComputed.position === 'static')
            parent.style.position = 'relative';
        if (parent !== root) {
            const parentPath = getElementPath(parent, root);
            if (parentPath && !isInjectionPath(parentPath)) {
                const routeKeyRef = viewportStoreKeyRef.current;
                const currentRoute = storeRef.current[routeKeyRef] ?? {};
                storeRef.current = {
                    ...storeRef.current,
                    [routeKeyRef]: {
                        ...currentRoute,
                        [parentPath]: readLiveElementDraft(parent, currentRoute[parentPath] ?? {}),
                    },
                };
            }
        }
        const wrapper = document.createElement('div');
        wrapper.setAttribute('data-froam-injected', 'true');
        wrapper.setAttribute('data-froam-block', 'true');
        wrapper.setAttribute('data-froam-merged', 'true');
        ensureFroamNodeId(wrapper);
        Object.assign(wrapper.style, {
            position: 'absolute',
            left: `${Math.round(left - parentRect.left + parent.scrollLeft)}px`,
            top: `${Math.round(top - parentRect.top + parent.scrollTop)}px`,
            width: `${Math.max(1, Math.round(right - left))}px`,
            height: `${Math.max(1, Math.round(bottom - top))}px`,
            minWidth: '1px',
            minHeight: '1px',
            display: 'block',
            padding: '0',
            margin: '0',
            border: '0',
            background: 'transparent',
            overflow: 'visible',
            boxSizing: 'border-box',
        });
        parent.insertBefore(wrapper, firstEl);
        rects.forEach(({ element, rect }) => {
            const computed = window.getComputedStyle(element);
            Object.assign(element.style, {
                position: 'absolute',
                left: `${Math.round(rect.left - left)}px`,
                top: `${Math.round(rect.top - top)}px`,
                width: `${Math.max(1, Math.round(rect.width))}px`,
                height: `${Math.max(1, Math.round(rect.height))}px`,
                margin: '0',
                flex: '0 0 auto',
                boxSizing: computed.boxSizing || 'border-box',
            });
            wrapper.appendChild(element);
        });
        selectInsertedElement(wrapper);
        persistLiveRouteSnapshot();
        setLayers(collectLayers(root));
        showToast('Merged into movable stamp');
    }
    function ungroupSelected() {
        if (!selection)
            return;
        const root = getRoot();
        if (!root)
            return;
        const target = findElementByPath(root, selection.path);
        if (!target || !target.parentElement)
            return;
        if (target.getAttribute('data-froam-injected') !== 'true') {
            showToast('Can only ungroup injected containers');
            return;
        }
        const parent = target.parentElement;
        const children = Array.from(target.children).filter((c) => c instanceof HTMLElement);
        if (children.length === 0) {
            target.remove();
            clearSelectionDraft();
            showToast('Removed empty container');
            return;
        }
        const isMerged = target.getAttribute('data-froam-merged') === 'true';
        const wrapperRect = target.getBoundingClientRect();
        const parentRect = parent.getBoundingClientRect();
        children.forEach((child) => {
            if (isMerged) {
                const childLeft = readNumber(child.style.left, 0);
                const childTop = readNumber(child.style.top, 0);
                child.style.left = `${Math.round(wrapperRect.left - parentRect.left + parent.scrollLeft + childLeft)}px`;
                child.style.top = `${Math.round(wrapperRect.top - parentRect.top + parent.scrollTop + childTop)}px`;
            }
            parent.insertBefore(child, target);
        });
        target.remove();
        const newSelections = children.map((child) => buildSelection(child, getElementPath(child, root)));
        updateSelectionsState(newSelections);
        persistLiveRouteSnapshot();
        setLayers(collectLayers(root));
        showToast('Ungrouped elements');
    }
    function addChildContainer() {
        addStructureBlock('container', 'inside');
    }
    function addSiblingContainer() {
        addStructureBlock('container', 'after');
    }
    /* ─── Layer click ─── */
    function selectLayerNode(node) {
        const root = getRoot();
        if (!root)
            return;
        const target = findElementByPath(root, node.path) ?? node.element;
        updateSelectionsState([buildSelection(target, node.path)]);
        target.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
        window.requestAnimationFrame(() => setSelectionRect(target.getBoundingClientRect()));
    }
    function toggleLayerVisibility(node) {
        const root = getRoot();
        if (!root)
            return;
        const target = findElementByPath(root, node.path);
        if (!target)
            return;
        const isHidden = window.getComputedStyle(target).display === 'none';
        target.style.display = isHidden ? '' : 'none';
        // Refresh layers
        setLayers(collectLayers(root));
    }
    /* ─── Image upload ─── */
    function handleImageUpload(event) {
        const file = event.target.files?.[0];
        if (!file) {
            event.target.value = '';
            return;
        }
        if (pendingCanvasImageRef.current) {
            const reader = new FileReader();
            reader.onload = () => {
                const imageData = typeof reader.result === 'string' ? reader.result : undefined;
                if (imageData)
                    applyCanvasImage(imageData);
            };
            reader.readAsDataURL(file);
            pendingCanvasImageRef.current = false;
            pendingImageTargetRef.current = null;
            event.target.value = '';
            return;
        }
        const root = getRoot();
        if (!root) {
            event.target.value = '';
            return;
        }
        const selectedTarget = selection ? findElementByPath(root, selection.path) : null;
        const target = pendingImageTargetRef.current ?? selectedTarget;
        if (!target) {
            const reader = new FileReader();
            reader.onload = () => {
                const imageData = typeof reader.result === 'string' ? reader.result : undefined;
                if (imageData)
                    addImageBlockFromSource(imageData);
            };
            reader.readAsDataURL(file);
            event.target.value = '';
            return;
        }
        readImageFile(file, target);
        pendingImageTargetRef.current = null;
        event.target.value = '';
    }
    function openSelectedImageUpload() {
        keepStudioPinned();
        pendingCanvasImageRef.current = false;
        const root = getRoot();
        const target = root && selection ? findElementByPath(root, selection.path) : null;
        pendingImageTargetRef.current = target;
        if (!target) {
            showToast('No selection, so Froam will add a new image frame');
            fileInputRef.current?.click();
            return;
        }
        fileInputRef.current?.click();
    }
    function openCanvasImageUpload() {
        keepStudioPinned();
        pendingImageTargetRef.current = null;
        pendingCanvasImageRef.current = true;
        fileInputRef.current?.click();
    }
    function clearAppliedImage() {
        keepStudioPinned();
        if (!selection)
            return;
        const root = getRoot();
        if (!root)
            return;
        const target = findElementByPath(root, selection.path);
        if (!target)
            return;
        if (target instanceof HTMLImageElement) {
            updateDraft((draft) => ({ ...draft, imageUrl: '' }), { imageUrl: '' }, 'Cleared image');
            showToast('Image cleared');
            return;
        }
        updateDraft((draft) => ({
            ...draft,
            imageUrl: '',
            styles: {
                ...(draft.styles ?? {}),
                backgroundImage: 'none',
                backgroundSize: '',
                backgroundPosition: '',
                backgroundRepeat: '',
            },
        }), { imageUrl: '' }, 'Cleared image');
        if (target.dataset.froamImageFrame === 'true') {
            syncImageFrameState(target);
        }
        showToast('Image cleared');
    }
    /* ─── Panel drag (desktop: free drag; device modes: stays in background area) ─── */
    function handlePanelHeaderPointerDown(e) {
        // Only drag on the header itself, not buttons inside it
        if (e.target.closest('button'))
            return;
        const aside = e.currentTarget.closest('aside');
        if (!aside)
            return;
        const rect = aside.getBoundingClientRect();
        panelDragRef.current = { offsetX: e.clientX - rect.left, offsetY: e.clientY - rect.top };
        aside.setPointerCapture(e.pointerId);
    }
    function handlePanelPointerMove(e) {
        if (!panelDragRef.current)
            return;
        const panelW = 400;
        const panelH = 600;
        let newX = e.clientX - panelDragRef.current.offsetX;
        let newY = e.clientY - panelDragRef.current.offsetY;
        if (viewportMode !== 'desktop') {
            // In device mode: constrain to the background overlay, not the device screen
            const mode = VIEWPORT_MODES.find((m) => m.id === viewportMode);
            const padding = 20;
            const scale = Math.min((window.innerWidth - padding * 2) / mode.width, (window.innerHeight - padding * 2) / mode.height, 1);
            const deviceScreenW = mode.width * scale;
            const deviceScreenLeft = (window.innerWidth - deviceScreenW) / 2 - 30; // bezel padding approx
            // Only allow positioning in the left or right background strip
            const rightStripStart = (window.innerWidth + deviceScreenW) / 2 + 30;
            if (newX + panelW / 2 > deviceScreenLeft && newX < rightStripStart) {
                // Push to whichever side is closer
                newX = e.clientX < window.innerWidth / 2
                    ? Math.min(newX, deviceScreenLeft - panelW - 8)
                    : Math.max(newX, rightStripStart);
            }
        }
        newX = Math.max(8, Math.min(newX, window.innerWidth - panelW - 8));
        newY = Math.max(8, Math.min(newY, window.innerHeight - panelH));
        setPanelPosition({ x: newX, y: newY });
    }
    function handlePanelPointerUp(e) {
        if (!panelDragRef.current)
            return;
        e.currentTarget.releasePointerCapture(e.pointerId);
        panelDragRef.current = null;
    }
    // Compute default panel position when not manually placed
    function getDefaultPanelStyle() {
        if (panelPosition) {
            return { position: 'fixed', left: panelPosition.x, top: panelPosition.y, right: 'auto', bottom: 'auto' };
        }
        if (viewportMode !== 'desktop') {
            // Place in the right background strip next to the device shell
            const mode = VIEWPORT_MODES.find((m) => m.id === viewportMode);
            const padding = 20;
            const scale = Math.min((window.innerWidth - padding * 2) / mode.width, (window.innerHeight - padding * 2) / mode.height, 1);
            const deviceScreenW = mode.width * scale;
            const rightStripStart = (window.innerWidth + deviceScreenW) / 2 + 38;
            const availRight = window.innerWidth - rightStripStart - 8;
            if (availRight >= 260) {
                // Enough room on the right
                return { position: 'fixed', left: rightStripStart, top: '50%', right: 'auto', bottom: 'auto', transform: 'translateY(-50%) scale(1)', opacity: 1 };
            }
            // Fall back to left strip
            return { position: 'fixed', right: 'auto', left: 8, top: '50%', bottom: 'auto', transform: 'translateY(-50%) scale(1)', opacity: 1 };
        }
        // Desktop default: top-right
        return {};
    }
    const DRAG_THRESHOLD = 5;
    function handleButtonPointerDown(event) {
        const rect = event.currentTarget.getBoundingClientRect();
        dragRef.current = {
            offsetX: event.clientX - rect.left,
            offsetY: event.clientY - rect.top,
            startX: event.clientX,
            startY: event.clientY,
            moved: false,
        };
        event.currentTarget.setPointerCapture(event.pointerId);
    }
    function handleButtonPointerMove(event) {
        if (!dragRef.current)
            return;
        const dx = event.clientX - dragRef.current.startX;
        const dy = event.clientY - dragRef.current.startY;
        const distance = Math.sqrt(dx * dx + dy * dy);
        if (distance < DRAG_THRESHOLD)
            return; // ignore micro-jitter
        dragRef.current.moved = true;
        setButtonPosition({
            x: Math.min(Math.max(12, event.clientX - dragRef.current.offsetX), window.innerWidth - 80),
            y: Math.min(Math.max(80, event.clientY - dragRef.current.offsetY), window.innerHeight - 80),
        });
    }
    function handleButtonPointerUp(event) {
        const drag = dragRef.current;
        if (!drag)
            return;
        event.currentTarget.releasePointerCapture(event.pointerId);
        dragRef.current = null;
        if (!drag.moved) {
            // Cycle: idle → open, open → minimized, minimized → restored
            if (!showPanel) {
                setPanelOpen(true);
                setActive(true);
                setStudioMinimized(false);
            }
            else if (!studioMinimized) {
                setStudioMinimized(true);
            }
            else {
                setStudioMinimized(false);
            }
        }
    }
    function handleFroamContextMenu(event) {
        event.preventDefault();
        event.stopPropagation();
        setPanelOpen(false);
        setActive(false);
        setStudioMinimized(false);
        setCommandPaletteOpen(false);
        showToast('Froam hidden');
    }
    /* ─── Refs for stable callbacks (avoids stale closures) ─── */
    const storeRef = useRef(store);
    storeRef.current = store;
    const undoStackRef = useRef(undoStack);
    undoStackRef.current = undoStack;
    const redoStackRef = useRef(redoStack);
    redoStackRef.current = redoStack;
    const selectionRef = useRef(selection);
    selectionRef.current = selection;
    const selectionsRef = useRef(selections);
    selectionsRef.current = selections;
    const panelOpenRef = useRef(panelOpen);
    panelOpenRef.current = panelOpen;
    const actionsRef = useRef({ saveToRunam, saveToRepo, undo, redo, clearSelectionDraft, applyStyle, openSelectedImageUpload, wrapInContainer });
    actionsRef.current = { saveToRunam, saveToRepo, undo, redo, clearSelectionDraft, applyStyle, openSelectedImageUpload, wrapInContainer };
    /* ─── CSS Vars refresh ─── */
    useEffect(() => {
        if (!openSections.cssVars)
            return;
        setCssVars(collectCSSVars());
    }, [openSections.cssVars]);
    /* ─── Repo bridge status polling (dev only) ─── */
    useEffect(() => {
        if (!showPanel)
            return;
        let active = true;
        let timer = 0;
        async function poll() {
            try {
                const res = await window.fetch(bridgeUrl('/__froam/repo/status'), { cache: 'no-store' });
                if (!res.ok)
                    throw new Error('no bridge');
                const data = await res.json();
                if (!active)
                    return;
                if (!data.success) {
                    setRepoStatus('offline');
                    return;
                }
                setRepoStatus(data.dirty ? 'dirty' : 'clean');
                setRepoDirtyCount(data.files?.length ?? 0);
            }
            catch {
                if (active)
                    setRepoStatus('offline');
            }
        }
        void poll();
        timer = window.setInterval(poll, 4000);
        return () => { active = false; window.clearInterval(timer); };
    }, [showPanel]);
    /* ─── Theme preview flip (Froam edits the real app, so both themes are live) ─── */
    function toggleEditorTheme() {
        const next = editorTheme === 'light' ? 'dark' : 'light';
        if (next === 'light')
            document.documentElement.setAttribute('data-theme', 'light');
        else
            document.documentElement.removeAttribute('data-theme');
        setEditorTheme(next);
        showToast(`Previewing ${next} theme`);
    }
    function updateCSSVar(name, value) {
        document.documentElement.style.setProperty(name, value);
        setCssVars((prev) => prev.map((v) => v.name === name ? { ...v, value } : v));
        showToast(`Updated ${name}`);
    }
    function addCSSVar() {
        if (!newVarName.trim())
            return;
        const name = newVarName.startsWith('--') ? newVarName : `--${newVarName}`;
        document.documentElement.style.setProperty(name, newVarValue || '#000000');
        setCssVars((prev) => [...prev, { name, value: newVarValue || '#000000' }]);
        setNewVarName('');
        setNewVarValue('');
        showToast(`Added ${name}`);
    }
    function removeCSSVar(name) {
        document.documentElement.style.removeProperty(name);
        setCssVars((prev) => prev.filter((v) => v.name !== name));
        showToast(`Removed ${name}`);
    }
    /* ─── Design Tokens ─── */
    function addToken() {
        if (!newTokenName.trim() || !newTokenValue.trim())
            return;
        const token = { id: `${Date.now()}`, name: newTokenName.trim(), value: newTokenValue.trim(), category: newTokenCategory };
        const next = [...tokens, token];
        setTokens(next);
        window.localStorage.setItem('froam-tokens-v1', JSON.stringify(next));
        document.documentElement.style.setProperty(`--${token.name.replace(/\s+/g, '-').toLowerCase()}`, token.value);
        setNewTokenName('');
        setNewTokenValue('');
        showToast('Token added');
    }
    function removeToken(id) {
        const token = tokens.find((t) => t.id === id);
        if (token)
            document.documentElement.style.removeProperty(`--${token.name.replace(/\s+/g, '-').toLowerCase()}`);
        const next = tokens.filter((t) => t.id !== id);
        setTokens(next);
        window.localStorage.setItem('froam-tokens-v1', JSON.stringify(next));
    }
    function applyTokenToSelection(token) {
        if (!selection) {
            showToast('Select an element first');
            return;
        }
        if (token.category === 'color')
            applyStyle({ backgroundColor: token.value }, { background: token.value });
        else if (token.category === 'spacing')
            applyStyle({ padding: token.value }, { paddingTop: parseFloat(token.value) });
        else if (token.category === 'font-size')
            applyStyle({ fontSize: token.value }, { fontSize: parseFloat(token.value) });
        else if (token.category === 'radius')
            applyStyle({ borderRadius: token.value }, { borderRadiusTL: parseFloat(token.value) });
        else if (token.category === 'shadow')
            applyStyle({ boxShadow: token.value }, { boxShadow: token.value });
        showToast('Token applied');
    }
    /* ─── Alignment (multi-select) ─── */
    function alignSelections(type) {
        const root = getRoot();
        if (!root)
            return;
        const targets = selections.length > 1
            ? selections.map((s) => findElementByPath(root, s.path)).filter((el) => el !== null)
            : selection ? [findElementByPath(root, selection.path)].filter((el) => el !== null) : [];
        if (targets.length < 2) {
            showToast('Select 2+ elements to align');
            return;
        }
        const rects = targets.map((el) => el.getBoundingClientRect());
        const minLeft = Math.min(...rects.map((r) => r.left));
        const maxRight = Math.max(...rects.map((r) => r.right));
        const minTop = Math.min(...rects.map((r) => r.top));
        const maxBottom = Math.max(...rects.map((r) => r.bottom));
        const centerH = (minLeft + maxRight) / 2;
        const centerV = (minTop + maxBottom) / 2;
        targets.forEach((el, i) => {
            const rect = rects[i];
            const computed = window.getComputedStyle(el);
            if (computed.position === 'static')
                el.style.position = 'relative';
            const currentLeft = parseFloat(computed.left) || 0;
            const currentTop = parseFloat(computed.top) || 0;
            if (type === 'left')
                el.style.left = `${currentLeft + (minLeft - rect.left)}px`;
            else if (type === 'center-h')
                el.style.left = `${currentLeft + (centerH - rect.left - rect.width / 2)}px`;
            else if (type === 'right')
                el.style.left = `${currentLeft + (maxRight - rect.right)}px`;
            else if (type === 'top')
                el.style.top = `${currentTop + (minTop - rect.top)}px`;
            else if (type === 'center-v')
                el.style.top = `${currentTop + (centerV - rect.top - rect.height / 2)}px`;
            else if (type === 'bottom')
                el.style.top = `${currentTop + (maxBottom - rect.bottom)}px`;
        });
        if (type === 'distribute-h' && targets.length >= 3) {
            const sorted = targets.map((el, i) => ({ el, rect: rects[i] })).sort((a, b) => a.rect.left - b.rect.left);
            const totalGap = maxRight - minLeft - sorted.reduce((sum, { rect }) => sum + rect.width, 0);
            const gap = totalGap / (sorted.length - 1);
            let cursor = minLeft;
            sorted.forEach(({ el, rect }, idx) => {
                if (idx === 0 || idx === sorted.length - 1) {
                    cursor += rect.width + gap;
                    return;
                }
                const computed = window.getComputedStyle(el);
                const currentLeft = parseFloat(computed.left) || 0;
                el.style.left = `${currentLeft + (cursor - rect.left)}px`;
                cursor += rect.width + gap;
            });
        }
        if (type === 'distribute-v' && targets.length >= 3) {
            const sorted = targets.map((el, i) => ({ el, rect: rects[i] })).sort((a, b) => a.rect.top - b.rect.top);
            const totalGap = maxBottom - minTop - sorted.reduce((sum, { rect }) => sum + rect.height, 0);
            const gap = totalGap / (sorted.length - 1);
            let cursor = minTop;
            sorted.forEach(({ el, rect }, idx) => {
                if (idx === 0 || idx === sorted.length - 1) {
                    cursor += rect.height + gap;
                    return;
                }
                const computed = window.getComputedStyle(el);
                const currentTop = parseFloat(computed.top) || 0;
                el.style.top = `${currentTop + (cursor - rect.top)}px`;
                cursor += rect.height + gap;
            });
        }
        persistLiveRouteSnapshot();
        showToast('Aligned');
    }
    /* ─── Transition builder ─── */
    function applyTransitionToSelection() {
        if (!selection) {
            showToast('Select an element first');
            return;
        }
        const value = `${transitionProp} ${transitionDuration}ms ${transitionEasing} ${transitionDelay}ms`;
        applyStyle({ transition: value }, undefined, 'Applied transition');
        showToast('Transition applied');
    }
    /* ─── Asset manager ─── */
    function addAssetEntry(url, name) {
        const entry = { id: `${Date.now()}`, name, url, addedAt: Date.now() };
        const next = [entry, ...assets];
        setAssets(next);
        window.localStorage.setItem('froam-assets-v1', JSON.stringify(next));
    }
    function removeAsset(id) {
        const next = assets.filter((a) => a.id !== id);
        setAssets(next);
        window.localStorage.setItem('froam-assets-v1', JSON.stringify(next));
    }
    function applyAssetToSelection(url) {
        if (!selection) {
            addImageBlockFromSource(url, 'Asset added as image');
            return;
        }
        const root = getRoot();
        if (!root)
            return;
        const target = findElementByPath(root, selection.path);
        if (!target)
            return;
        if (target instanceof HTMLImageElement) {
            updateDraft((d) => ({ ...d, imageUrl: url }));
        }
        else {
            applyStyle({ backgroundImage: `url(${url})`, backgroundSize: 'cover', backgroundPosition: 'center' });
        }
        showToast('Asset applied');
    }
    /* ─── Build transform string ─── */
    function buildTransformString(vals) {
        const s = selection;
        if (!s)
            return '';
        const r = vals.rotate ?? s.rotate;
        const sx = vals.scaleX ?? s.scaleX;
        const sy = vals.scaleY ?? s.scaleY;
        const skx = vals.skewX ?? s.skewX;
        const sky = vals.skewY ?? s.skewY;
        const tx = vals.translateX ?? s.translateX;
        const ty = vals.translateY ?? s.translateY;
        const parts = [];
        if (tx !== 0 || ty !== 0)
            parts.push(`translate(${tx}px, ${ty}px)`);
        if (r !== 0)
            parts.push(`rotate(${r}deg)`);
        if (sx !== 1 || sy !== 1)
            parts.push(`scale(${sx}, ${sy})`);
        if (skx !== 0)
            parts.push(`skewX(${skx}deg)`);
        if (sky !== 0)
            parts.push(`skewY(${sky}deg)`);
        return parts.length > 0 ? parts.join(' ') : 'none';
    }
    /* ─── Command palette ─── */
    const paletteCommands = [
        { id: 'save', label: 'Save draft', shortcut: 'Ctrl+S', icon: _jsx(Save, { size: 15 }), action: saveToRunam },
        { id: 'save-repo', label: 'Save to Repo (git-ready)', shortcut: 'Ctrl+Shift+S', icon: _jsx(GitCommit, { size: 15 }), action: () => { void saveToRepo(); } },
        { id: 'versions', label: 'Versions', icon: _jsx(GitCommit, { size: 15 }), action: () => { setOpenSections((p) => ({ ...p, versions: !p.versions })); } },
        { id: 'undo', label: 'Undo', shortcut: 'Ctrl+Z', icon: _jsx(Undo2, { size: 15 }), action: undo },
        { id: 'redo', label: 'Redo', shortcut: 'Ctrl+Y', icon: _jsx(Redo2, { size: 15 }), action: redo },
        { id: 'copy-report', label: 'Copy design report', icon: _jsx(FileText, { size: 15 }), action: () => { copyDesignReport(); } },
        { id: 'copy', label: 'Copy page JSON', shortcut: 'Ctrl+C', icon: _jsx(Copy, { size: 15 }), action: () => { copyRouteDrafts(); } },
        { id: 'export', label: 'Export as file', icon: _jsx(Download, { size: 15 }), action: downloadRunamDrafts },
        { id: 'reset', label: 'Reset page', icon: _jsx(Eraser, { size: 15 }), action: clearRouteDrafts },
        { id: 'dark', label: 'Dark page', icon: _jsx(Palette, { size: 15 }), action: () => applyCanvasStyles({ background: '#050505', text: '#ffffff' }) },
        { id: 'light', label: 'Light page', icon: _jsx(Palette, { size: 15 }), action: () => applyCanvasStyles({ background: '#ffffff', text: '#111827' }) },
        { id: 'clear-sel', label: 'Clear selected element', icon: _jsx(X, { size: 15 }), action: clearSelectionDraft },
        { id: 'bold', label: 'Toggle bold', icon: _jsx(Bold, { size: 15 }), action: () => { if (selectionRef.current)
                applyStyle({ fontWeight: Number(selectionRef.current.fontWeight) >= 700 ? '400' : '700' }, { fontWeight: Number(selectionRef.current.fontWeight) >= 700 ? '400' : '700' }); } },
        { id: 'flex', label: 'Set display: flex', icon: _jsx(LayoutGrid, { size: 15 }), action: () => { if (selectionRef.current)
                applyStyle({ display: 'flex' }, { display: 'flex' }); } },
        { id: 'grid', label: 'Set display: grid', icon: _jsx(LayoutGrid, { size: 15 }), action: () => { if (selectionRef.current)
                applyStyle({ display: 'grid' }, { display: 'grid' }); } },
        { id: 'center-flex', label: 'Center with flex', icon: _jsx(AlignCenter, { size: 15 }), action: () => { if (selectionRef.current)
                applyStyle({ display: 'flex', justifyContent: 'center', alignItems: 'center' }, { display: 'flex', justifyContent: 'center', alignItems: 'center' }); } },
        { id: 'group-selected', label: 'Group selected elements', icon: _jsx(SquareDashedBottom, { size: 15 }), action: groupSelected },
        { id: 'ungroup-selected', label: 'Ungroup selected container', icon: _jsx(SquareDashedBottom, { size: 15 }), action: ungroupSelected },
        { id: 'size-fill', label: 'Resize: fill parent', icon: _jsx(Box, { size: 15 }), action: () => { if (selectionRef.current)
                applySizePreset('fill'); } },
        { id: 'size-hug', label: 'Resize: hug content', icon: _jsx(Box, { size: 15 }), action: () => { if (selectionRef.current)
                applySizePreset('hug'); } },
        { id: 'size-square', label: 'Resize: square', icon: _jsx(Square, { size: 15 }), action: () => { if (selectionRef.current)
                applySizePreset('square'); } },
        { id: 'size-full-bleed', label: 'Resize: full bleed', icon: _jsx(Box, { size: 15 }), action: () => { if (selectionRef.current)
                applySizePreset('fullBleed'); } },
        { id: 'size-auto', label: 'Resize: reset auto', icon: _jsx(Eraser, { size: 15 }), action: () => { if (selectionRef.current)
                applySizePreset('auto'); } },
    ];
    const commandSearchTerm = commandSearch.trim().toLowerCase();
    const filteredCommands = commandSearchTerm
        ? paletteCommands.filter((c) => c.label.toLowerCase().includes(commandSearchTerm))
        : paletteCommands;
    function executePaletteCommand(cmd) {
        cmd.action();
        setCommandPaletteOpen(false);
        setCommandSearch('');
    }
    /* ─── Global toggle shortcut (works even when panel is closed) ─── */
    useEffect(() => {
        function handleGlobalToggle(e) {
            if ((e.ctrlKey || e.metaKey) && e.key === '.') {
                e.preventDefault();
                if (!showPanel) {
                    setPanelOpen(true);
                    setActive(true);
                    setStudioMinimized(false);
                }
                else if (!studioMinimized) {
                    setStudioMinimized(true);
                }
                else {
                    setPanelOpen(false);
                    setActive(false);
                    setStudioMinimized(false);
                }
            }
        }
        window.addEventListener('keydown', handleGlobalToggle);
        return () => window.removeEventListener('keydown', handleGlobalToggle);
    }, [showPanel, studioMinimized]);
    /* ─── Keyboard shortcuts ─── */
    useEffect(() => {
        if (!showPanel)
            return;
        function handleKeyDown(e) {
            // Command palette
            if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
                e.preventDefault();
                setCommandPaletteOpen((o) => !o);
                return;
            }
            // Save to repo (git-ready files via the dev-server bridge)
            if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 's' || e.key === 'S')) {
                e.preventDefault();
                void actionsRef.current.saveToRepo();
                return;
            }
            // Save
            if ((e.ctrlKey || e.metaKey) && e.key === 's') {
                e.preventDefault();
                actionsRef.current.saveToRunam();
                return;
            }
            // Undo
            if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
                e.preventDefault();
                actionsRef.current.undo();
                return;
            }
            // Redo
            if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
                e.preventDefault();
                actionsRef.current.redo();
                return;
            }
            // Escape
            if (e.key === 'Escape') {
                if (commandPaletteOpen) {
                    setCommandPaletteOpen(false);
                    setCommandSearch('');
                    return;
                }
                if (inlineEditing && currentSelectionRef.current) {
                    currentSelectionRef.current.contentEditable = 'false';
                    currentSelectionRef.current.blur();
                    setInlineEditing(false);
                    return;
                }
                currentSelectionRef.current?.removeAttribute('data-chef-selected');
                currentSelectionRef.current = null;
                setSelection(null);
                return;
            }
            // Delete to clear
            if (e.key === 'Delete' && selection && !inlineEditing) {
                e.preventDefault();
                actionsRef.current.clearSelectionDraft();
                return;
            }
            // ? key for shortcut overlay
            if (e.key === '?' && !inlineEditing && !commandPaletteOpen) {
                e.preventDefault();
                setShowShortcutOverlay((v) => !v);
                return;
            }
            // Modified shortcut to toggle move mode without stealing normal typing.
            if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'l' && !inlineEditing && !commandPaletteOpen) {
                e.preventDefault();
                setMoveMode((v) => {
                    showToast(v ? 'Move mode off' : 'Move mode on — drag any element freely');
                    return !v;
                });
                return;
            }
            // Ctrl+D to duplicate (copy styles to new sibling)
            if ((e.ctrlKey || e.metaKey) && e.key === 'd' && selection && !inlineEditing) {
                e.preventDefault();
                const root = getRoot();
                if (!root)
                    return;
                const target = findElementByPath(root, selection.path);
                if (!target || !target.parentElement)
                    return;
                const clone = target.cloneNode(true);
                clone.removeAttribute('data-chef-selected');
                clone.removeAttribute('data-chef-hovered');
                assignFreshFroamNodeIds(clone);
                target.parentElement.insertBefore(clone, target.nextSibling);
                selectInsertedElement(clone);
                persistLiveRouteSnapshot();
                showToast('Duplicated');
                return;
            }
            // Ctrl+Alt+C to copy styles
            if ((e.ctrlKey || e.metaKey) && e.altKey && e.key === 'c' && selection) {
                e.preventDefault();
                const draft = storeRef.current[viewportStoreKey]?.[selection.path];
                if (draft?.styles) {
                    setClipboardStyles({ ...draft.styles });
                    showToast('Styles copied');
                }
                return;
            }
            // Ctrl+Alt+V to paste styles
            if ((e.ctrlKey || e.metaKey) && e.altKey && e.key === 'v' && selection && clipboardStyles) {
                e.preventDefault();
                actionsRef.current.applyStyle(clipboardStyles, undefined, 'Pasted styles');
                showToast('Styles pasted');
                return;
            }
            // Arrow keys to nudge position (only when not inline editing)
            if (selection && !inlineEditing && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
                e.preventDefault();
                const root = getRoot();
                if (!root)
                    return;
                const target = findElementByPath(root, selection.path);
                if (!target)
                    return;
                const computed = window.getComputedStyle(target);
                if (computed.position === 'static') {
                    target.style.position = 'relative';
                }
                const currentTop = readNumber(computed.top, 0);
                const currentLeft = readNumber(computed.left, 0);
                const step = e.shiftKey ? 10 : 1;
                if (e.key === 'ArrowUp')
                    actionsRef.current.applyStyle({ top: `${currentTop - step}px` });
                if (e.key === 'ArrowDown')
                    actionsRef.current.applyStyle({ top: `${currentTop + step}px` });
                if (e.key === 'ArrowLeft')
                    actionsRef.current.applyStyle({ left: `${currentLeft - step}px` });
                if (e.key === 'ArrowRight')
                    actionsRef.current.applyStyle({ left: `${currentLeft + step}px` });
                // Update selection rect for resize handles
                const updated = findElementByPath(root, selection.path);
                if (updated)
                    setSelectionRect(updated.getBoundingClientRect());
            }
        }
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [showPanel, selection, commandPaletteOpen, inlineEditing, clipboardStyles, viewportStoreKey]);
    /* ─── Gradient helpers ─── */
    function applyGradient() {
        if (!selection) {
            showToast('Select an element first');
            return;
        }
        const css = buildGradientCSS(gradType, gradAngle, gradStops);
        applyStyle({ backgroundImage: css, backgroundSize: '100% 100%' }, undefined, 'Applied gradient');
        showToast('Gradient applied');
    }
    /* ─── Bail for kitchen route ─── */
    if (isKitchenRoute)
        return null;
    /* ═══════════════════════════════════════════════════════════════
       Render
       ═══════════════════════════════════════════════════════════════ */
    if (!portalContainer)
        return null;
    const selectedExportElement = selection ? currentSelectionRef.current : null;
    const intelRoot = getRoot();
    const intelSelectedElement = selection && intelRoot ? findElementByPath(intelRoot, selection.path) : null;
    return createPortal(_jsxs(_Fragment, { children: [_jsxs("button", { className: [
                    'global-chef-button',
                    showPanel ? 'is-active' : '',
                    showPanel && !studioMinimized ? 'is-studio-open' : '',
                ].filter(Boolean).join(' '), "data-chef-editor-root": "true", type: "button", style: { left: buttonPosition.x, top: buttonPosition.y }, onPointerDown: handleButtonPointerDown, onPointerMove: handleButtonPointerMove, onPointerUp: handleButtonPointerUp, onPointerCancel: handleButtonPointerUp, onContextMenu: handleFroamContextMenu, "aria-label": showPanel ? `Toggle ${persona.name} Studio` : `Open ${persona.name} Studio`, title: showPanel && !studioMinimized ? 'Minimize (Ctrl+.)' : showPanel ? 'Restore (Ctrl+.)' : `Open ${persona.name} (Ctrl+.)`, children: [_jsx("span", { className: "global-chef-button__halo", "aria-hidden": "true" }), _jsx("span", { className: "global-chef-button__ring", "aria-hidden": "true" }), _jsx("span", { className: "global-chef-button__core", "aria-hidden": "true", children: persona.imageUrl ? (_jsx("img", { src: persona.imageUrl, alt: "", className: "global-chef-button__avatar" })) : (_jsxs("svg", { className: "global-chef-button__mark", viewBox: "0 0 24 24", "aria-hidden": "true", children: [_jsx("defs", { children: _jsxs("linearGradient", { id: "froam-mark-grad", x1: "0", y1: "0", x2: "1", y2: "1", children: [_jsx("stop", { offset: "0", stopColor: "#f0fdfa" }), _jsx("stop", { offset: "1", stopColor: "#5eead4" })] }) }), _jsx("path", { fill: "url(#froam-mark-grad)", d: "M7.2 21V3h10.6v3.3h-6.9v4.3h6.2v3.3h-6.2V21Z" })] })) }), _jsxs("span", { className: "global-chef-button__hint", "aria-hidden": "true", children: ["Edit this page ", _jsx("kbd", { children: "Ctrl+." })] }), showPanel && _jsx("span", { className: "global-chef-button__dot" })] }), showPanel && _jsx(MeasurementOverlay, { rect: measureRect }), showPanel && selection && (_jsx(SelectionHandoffOverlay, { rect: selectionRect, label: selection.label, mode: selectionHandoffMode, count: selections.length, pulseKey: selectionHandoffKey }, selectionHandoffKey)), _jsx(Toast, { message: toastMsg, visible: toastVisible }), _jsx(FroamWelcomeTips, { open: showPanel && !studioMinimized }), commandPaletteOpen && (_jsx("div", { className: "fs-command-palette", "data-chef-editor-root": "true", onClick: (e) => { if (e.target === e.currentTarget) {
                    setCommandPaletteOpen(false);
                    setCommandSearch('');
                } }, children: _jsxs("div", { className: "fs-command-palette__card", "data-chef-editor-root": "true", children: [_jsx("input", { className: "fs-command-palette__input", type: "text", value: commandSearch, placeholder: "Type a command\u2026", autoFocus: true, onChange: (e) => { setCommandSearch(e.target.value); setCommandFocusIndex(0); }, onKeyDown: (e) => {
                                if (e.key === 'ArrowDown') {
                                    e.preventDefault();
                                    setCommandFocusIndex((i) => Math.min(i + 1, filteredCommands.length - 1));
                                }
                                if (e.key === 'ArrowUp') {
                                    e.preventDefault();
                                    setCommandFocusIndex((i) => Math.max(i - 1, 0));
                                }
                                if (e.key === 'Enter' && filteredCommands[commandFocusIndex]) {
                                    executePaletteCommand(filteredCommands[commandFocusIndex]);
                                }
                                if (e.key === 'Escape') {
                                    setCommandPaletteOpen(false);
                                    setCommandSearch('');
                                }
                            } }), _jsxs("ul", { className: "fs-command-palette__list", children: [filteredCommands.map((cmd, idx) => (_jsxs("li", { className: `fs-command-palette__item ${idx === commandFocusIndex ? 'is-focused' : ''}`, onClick: () => executePaletteCommand(cmd), onMouseEnter: () => setCommandFocusIndex(idx), children: [cmd.icon, _jsx("span", { className: "fs-command-palette__item-label", children: cmd.label }), cmd.shortcut && _jsx("span", { className: "fs-command-palette__item-shortcut", children: cmd.shortcut })] }, cmd.id))), filteredCommands.length === 0 && (_jsx("li", { className: "fs-command-palette__item", style: { justifyContent: 'center', color: 'var(--fs-text-tertiary)' }, children: "No commands found" }))] })] }) })), showPanel && !studioMinimized && (_jsxs("div", { className: [
                    'froam-figma-layout',
                    leftWorkspaceMode === 'plan' ? 'is-planning' : '',
                    leftPanelOpen ? '' : 'is-left-collapsed',
                    rightPanelOpen ? '' : 'is-right-collapsed',
                ].filter(Boolean).join(' '), "data-chef-editor-root": "true", children: [_jsx(FroamSectionBoundary, { name: "Toolbar", children: _jsx(FroamToolbar, { viewportMode: viewportMode, onViewportChange: setViewportMode, activeTool: activeTool, onToolChange: (tool) => {
                                if (tool === 'shape') {
                                    setActiveTool('shape');
                                    setMoveMode(false);
                                    setRightPanelOpen(true);
                                    addStructureBlock('shape');
                                    return;
                                }
                                if (tool === 'frame') {
                                    setActiveTool('frame');
                                    setMoveMode(false);
                                    setRightPanelOpen(true);
                                    insertBlankFrame('end', { preset: 'responsive', width: 1200, height: 720, background: '#ffffff' });
                                    return;
                                }
                                setActiveTool(tool);
                                setMoveMode(tool === 'move');
                            }, canUndo: undoStack.length > 0, canRedo: redoStack.length > 0, onSave: actionsRef.current.saveToRunam, onSaveRepo: () => { void actionsRef.current.saveToRepo(); }, repoStatus: repoStatus, repoDirtyCount: repoDirtyCount, theme: editorTheme, onToggleTheme: toggleEditorTheme, onUndo: actionsRef.current.undo, onRedo: actionsRef.current.redo, onCommandPalette: () => setCommandPaletteOpen(true), onShortcutsOverlay: () => setShowShortcutOverlay(true), routeKey: routeKey, persona: persona, onOpenPersonaEditor: openPersonaEditor, draftCount: draftCount, moveMode: moveMode, onToggleMoveMode: () => setMoveMode((value) => !value), zoom: zoom, setZoom: setZoom, leftPanelOpen: leftPanelOpen, rightPanelOpen: rightPanelOpen, onToggleLeftPanel: () => setLeftPanelOpen((value) => !value), onToggleRightPanel: () => setRightPanelOpen((value) => !value), onMinimize: () => {
                                setStudioMinimized(true);
                                showToast(`${persona.name} minimized — editing is still active`);
                            }, onClose: () => {
                                setPanelOpen(false);
                                setActive(false);
                                setStudioMinimized(false);
                            } }) }), leftPanelOpen && _jsxs("div", { className: "froam-figma-left", "data-chef-editor-root": "true", children: [_jsxs("div", { className: "froam-figma-left__tabs", "data-chef-editor-root": "true", children: [_jsxs("button", { type: "button", className: leftWorkspaceMode === 'plan' ? 'is-active' : '', onClick: () => setLeftWorkspaceMode('plan'), children: [_jsx(LayoutGrid, { size: 13 }), " Plan"] }), _jsxs("button", { type: "button", className: leftWorkspaceMode === 'layers' ? 'is-active' : '', onClick: () => setLeftWorkspaceMode('layers'), children: [_jsx(Layers, { size: 13 }), " Layers"] })] }), _jsx("div", { className: "froam-figma-left__body", "data-chef-editor-root": "true", children: leftWorkspaceMode === 'plan' ? (_jsx(FroamSectionBoundary, { name: "SitePlanner", children: _jsx(FroamSitePlanner, { routeKey: routeKey, onInsertComponent: insertLibraryComponent, onInsertBlankFrame: insertBlankFrame, onBuildPage: buildLibraryPage, onToast: showToast }) })) : (_jsx(FroamSectionBoundary, { name: "LayersPanel", children: _jsx(FroamLayersPanel, { layers: layers, selectedPath: selection?.path ?? null, selections: selections, onSelectLayer: selectLayerNode, onToggleVisibility: toggleLayerVisibility, onRefresh: () => { const root = getRoot(); if (root)
                                            setLayers(collectLayers(root)); }, routeKey: routeKey }) })) })] }), _jsx("div", { className: "froam-figma-layout__canvas", "data-chef-editor-root": "true" }), rightPanelOpen && (_jsx(FroamSectionBoundary, { name: "DesignPanel", children: _jsx(FroamDesignPanel, { selection: selection, selectionRect: selectionRect, onApplyStyle: applyStyle, onUpdateDraft: updateDraft, onOpenImageUpload: openSelectedImageUpload, onClearImage: clearAppliedImage, onClearSelectionDraft: actionsRef.current.clearSelectionDraft, marginLinked: marginLinked, paddingLinked: paddingLinked, radiusLinked: radiusLinked, onToggleMarginLinked: () => setMarginLinked((value) => !value), onTogglePaddingLinked: () => setPaddingLinked((value) => !value), onToggleRadiusLinked: () => setRadiusLinked((value) => !value), onApplySizePreset: applySizePreset, onBuildTransformString: buildTransformString, fontOptions: fontOptions }) }))] })), showPanel && studioMinimized && (_jsxs("div", { className: "froam-mini-dock", "data-chef-editor-root": "true", role: "toolbar", "aria-label": `Minimized ${persona.name} Studio`, children: [_jsxs("button", { type: "button", className: "froam-mini-dock__status froam-mini-dock__persona", onClick: openPersonaEditor, title: "Edit studio profile", children: [persona.imageUrl ? (_jsx("img", { className: "froam-mini-dock__avatar", src: persona.imageUrl, alt: "", "aria-hidden": "true" })) : (_jsx("span", { className: "froam-mini-dock__dot" })), _jsx("span", { children: persona.name }), _jsx("small", { children: "editing" })] }), _jsx("button", { type: "button", className: "froam-mini-dock__button", onClick: actionsRef.current.saveToRunam, title: "Save changes", "aria-label": `Save ${persona.name} changes`, children: _jsx(Save, { size: 15 }) }), _jsxs("button", { type: "button", className: "froam-mini-dock__button froam-mini-dock__button--primary", onClick: () => setStudioMinimized(false), title: `Restore ${persona.name} Studio`, "aria-label": `Restore ${persona.name} Studio`, children: [_jsx(Maximize2, { size: 15 }), _jsx("span", { children: "Restore" })] }), _jsx("button", { type: "button", className: "froam-mini-dock__button", onClick: () => {
                            setPanelOpen(false);
                            setActive(false);
                            setStudioMinimized(false);
                        }, title: `Exit ${persona.name}`, "aria-label": `Exit ${persona.name} editing`, children: _jsx(X, { size: 15 }) })] })), showPanel && !studioMinimized ? (_jsx("aside", { className: `froam-studio ${showPanel ? 'is-open' : ''} ${viewportMode !== 'desktop' ? 'is-device-mode' : ''}`, "data-chef-editor-root": "true", style: getDefaultPanelStyle(), onPointerMove: handlePanelPointerMove, onPointerUp: handlePanelPointerUp, onPointerCancel: handlePanelPointerUp, children: _jsxs("div", { className: "froam-studio__card", "data-chef-editor-root": "true", children: [_jsxs("div", { className: "froam-studio__header", "data-chef-editor-root": "true", style: { cursor: 'grab' }, onPointerDown: handlePanelHeaderPointerDown, children: [_jsxs("div", { className: "froam-studio__brand", children: [_jsx("span", { className: "froam-studio__version-dot" }), _jsxs("span", { className: "froam-studio__logo", children: [persona.name, " Studio"] }), _jsx("span", { className: "froam-studio__badge", children: "v4" })] }), _jsxs("div", { className: "froam-studio__header-actions", children: [_jsx("button", { type: "button", className: `froam-studio__icon-btn${moveMode ? ' is-active' : ''}`, "data-chef-editor-root": "true", onClick: () => { setMoveMode((v) => !v); showToast(moveMode ? 'Move mode off' : 'Move mode on — drag any element freely'); }, title: "Move mode \u2014 drag elements to reposition (Ctrl+Shift+L)", style: moveMode ? { background: 'rgba(239,68,68,0.18)', color: '#ef4444' } : {}, children: _jsx(Move, { size: 14 }) }), _jsx("div", { className: "froam-studio__header-divider" }), _jsxs("div", { className: "froam-viewport-switcher", "data-chef-editor-root": "true", children: [_jsx("button", { type: "button", className: `froam-studio__icon-btn ${viewportMode === 'desktop' ? 'is-active' : ''}`, onClick: () => setViewportMode('desktop'), title: "Desktop", children: _jsx(Monitor, { size: 14 }) }), _jsx("button", { type: "button", className: `froam-studio__icon-btn ${viewportMode === 'tablet' ? 'is-active' : ''}`, onClick: () => setViewportMode('tablet'), title: "Tablet (768px)", children: _jsx(Tablet, { size: 14 }) }), _jsx("button", { type: "button", className: `froam-studio__icon-btn ${viewportMode === 'mobile' ? 'is-active' : ''}`, onClick: () => setViewportMode('mobile'), title: "Mobile (375px)", children: _jsx(Smartphone, { size: 14 }) })] }), _jsx("div", { className: "froam-studio__header-divider" }), _jsx("button", { type: "button", className: "froam-studio__icon-btn", onClick: () => setCommandPaletteOpen(true), title: "Command palette (Ctrl+K)", children: _jsx(Command, { size: 14 }) }), _jsx("button", { type: "button", className: "froam-studio__icon-btn", onClick: undo, disabled: !undoStack.length, title: "Undo (Ctrl+Z)", children: _jsx(Undo2, { size: 14 }) }), _jsx("button", { type: "button", className: "froam-studio__icon-btn", onClick: redo, disabled: !redoStack.length, title: "Redo (Ctrl+Y)", children: _jsx(Redo2, { size: 14 }) }), _jsx("button", { type: "button", className: "froam-studio__icon-btn", onClick: () => setShowShortcutOverlay(true), title: "Keyboard shortcuts (?)", children: _jsx(Keyboard, { size: 14 }) })] })] }), _jsxs("div", { className: "froam-studio__status", "data-chef-editor-root": "true", children: [_jsxs("div", { className: "froam-studio__status-left", children: [_jsx("span", { className: `froam-studio__status-dot ${showPanel ? '' : 'is-idle'}` }), _jsx("span", { className: "froam-studio__status-text", children: showPanel ? 'Editing live' : 'Idle' })] }), _jsx("span", { className: "froam-studio__route", children: routeKey }), viewportMode !== 'desktop' && (_jsx("span", { className: "froam-studio__viewport-badge", "data-chef-editor-root": "true", children: viewportMode === 'mobile' ? '375px' : '768px' }))] }), _jsx("div", { className: "froam-studio__divider" }), inlineEditing && (_jsxs("div", { className: "fs-inline-indicator", "data-chef-editor-root": "true", children: [_jsx(PencilLine, { size: 13, "aria-hidden": "true" }), "Editing inline \u2014 click away or press Esc to finish"] })), selection ? (_jsxs("div", { className: "froam-selection-banner", "data-chef-editor-root": "true", children: [_jsxs("div", { className: "froam-selection-banner__tag", children: [_jsx(MousePointer2, { size: 12, "aria-hidden": "true" }), selection.label] }), _jsx("span", { className: "froam-selection-banner__path", children: selection.path })] })) : (_jsxs("div", { className: "froam-empty-state", "data-chef-editor-root": "true", children: [_jsx(MousePointer2, { size: 28, className: "froam-empty-state__icon" }), _jsx("strong", { children: "No element selected" }), _jsx("span", { children: "Click any element on the page to start designing. Double-click to edit text inline." })] })), _jsxs(AccordionSection, { id: "quickActions", icon: _jsx(Zap, { size: 14 }), title: "Quick Actions", isOpen: openSections.quickActions, onToggle: () => toggleSection('quickActions'), children: [_jsxs("div", { className: "fs-pill-group", children: [_jsxs("button", { type: "button", className: "fs-pill is-accent", onClick: saveToRunam, children: [_jsx(ClipboardCheck, { size: 13 }), " Save"] }), _jsxs("button", { type: "button", className: "fs-pill", onClick: () => { copyDesignReport(); }, children: [_jsx(FileText, { size: 13 }), " Copy report"] }), _jsxs("button", { type: "button", className: "fs-pill", onClick: () => { copyRouteDrafts(); }, children: [_jsx(Copy, { size: 13 }), " Copy JSON"] }), _jsxs("button", { type: "button", className: "fs-pill", onClick: downloadRunamDrafts, children: [_jsx(Download, { size: 13 }), " Export"] }), _jsxs("button", { type: "button", className: "fs-pill is-danger", onClick: clearRouteDrafts, children: [_jsx(Eraser, { size: 13 }), " Reset page"] }), selection && (_jsxs("button", { type: "button", className: "fs-pill", onClick: clearSelectionDraft, children: [_jsx(X, { size: 13 }), " Clear selected"] }))] }), _jsxs("div", { className: "fs-grid-2", style: { marginTop: 6 }, children: [_jsxs("label", { className: "fs-field", children: [_jsxs("span", { className: "fs-field__label", children: [_jsx(Palette, { size: 12 }), " Page BG"] }), _jsx("input", { type: "color", className: "fs-color-input", value: canvas.background, onChange: (e) => applyCanvasStyles({ background: e.target.value }) })] }), _jsxs("label", { className: "fs-field", children: [_jsxs("span", { className: "fs-field__label", children: [_jsx(Type, { size: 12 }), " Page text"] }), _jsx("input", { type: "color", className: "fs-color-input", value: canvas.text, onChange: (e) => applyCanvasStyles({ text: e.target.value }) })] })] }), _jsxs("div", { className: "fs-pill-group", style: { marginTop: 8 }, children: [_jsxs("button", { type: "button", className: "fs-pill is-accent", onClick: openCanvasImageUpload, children: [_jsx(ImagePlus, { size: 13 }), " Page image"] }), _jsxs("button", { type: "button", className: "fs-pill", onClick: clearCanvasImage, children: [_jsx(Eraser, { size: 13 }), " Clear page image"] })] })] }), _jsx(AccordionSection, { id: "intel", icon: _jsx(Sparkles, { size: 14 }), title: "Design Intelligence", isOpen: openSections.intel, onToggle: () => toggleSection('intel'), children: _jsx(FroamIntel, { selectedElement: intelSelectedElement, selectionPath: selection?.path ?? '', applyStyle: applyStyle, onSelectElement: selectElementFromIntel, onFixElement: fixElementFromIntel, onToast: showToast, rootEl: getRoot() }) }), _jsx(AccordionSection, { id: "export", icon: _jsx(Download, { size: 14 }), title: "Export / Capture", isOpen: openSections.export, onToggle: () => toggleSection('export'), children: _jsx(FroamExport, { selectedElement: selectedExportElement, selectionLabel: selection?.label ?? 'Page', selectionPath: selection?.path ?? 'document.body', onToast: showToast }) }), _jsx(AccordionSection, { id: "layout", icon: _jsx(LayoutGrid, { size: 14 }), title: "Layout", isOpen: openSections.layout, onToggle: () => toggleSection('layout'), children: selection ? (_jsxs("div", { className: "fs-stack", children: [_jsxs("label", { className: "fs-field", children: [_jsx("span", { className: "fs-field__label", children: "Display" }), _jsx("select", { className: "fs-select", value: selection.display, onChange: (e) => applyStyle({ display: e.target.value }, { display: e.target.value }), children: displayOptions.map((o) => _jsx("option", { value: o, children: o }, o)) })] }), (selection.display === 'flex' || selection.display === 'inline-flex') && (_jsxs(_Fragment, { children: [_jsxs("label", { className: "fs-field", children: [_jsx("span", { className: "fs-field__label", children: "Direction" }), _jsx("select", { className: "fs-select", value: selection.flexDirection, onChange: (e) => applyStyle({ flexDirection: e.target.value }, { flexDirection: e.target.value }), children: flexDirectionOptions.map((o) => _jsx("option", { value: o, children: o }, o)) })] }), _jsxs("div", { className: "fs-grid-2", children: [_jsxs("label", { className: "fs-field", children: [_jsx("span", { className: "fs-field__label", children: "Justify" }), _jsx("select", { className: "fs-select", value: selection.justifyContent, onChange: (e) => applyStyle({ justifyContent: e.target.value }, { justifyContent: e.target.value }), children: justifyOptions.map((o) => _jsx("option", { value: o, children: o }, o)) })] }), _jsxs("label", { className: "fs-field", children: [_jsx("span", { className: "fs-field__label", children: "Align" }), _jsx("select", { className: "fs-select", value: selection.alignItems, onChange: (e) => applyStyle({ alignItems: e.target.value }, { alignItems: e.target.value }), children: alignOptions.map((o) => _jsx("option", { value: o, children: o }, o)) })] })] }), _jsxs("div", { className: "fs-grid-2", children: [_jsxs("label", { className: "fs-field", children: [_jsx("span", { className: "fs-field__label", children: "Wrap" }), _jsxs("select", { className: "fs-select", value: selection.flexWrap, onChange: (e) => applyStyle({ flexWrap: e.target.value }, { flexWrap: e.target.value }), children: [_jsx("option", { value: "nowrap", children: "nowrap" }), _jsx("option", { value: "wrap", children: "wrap" }), _jsx("option", { value: "wrap-reverse", children: "wrap-reverse" })] })] }), _jsxs("label", { className: "fs-field", children: [_jsx("span", { className: "fs-field__label", children: "Gap" }), _jsxs("div", { className: "fs-range-row", children: [_jsx("input", { type: "range", className: "fs-range", min: "0", max: "64", value: selection.gap, onChange: (e) => { const v = e.target.value; applyStyle({ gap: `${v}px` }, { gap: Number(v) }); } }), _jsx("span", { className: "fs-range-value", children: selection.gap })] })] })] })] })), selection.display === 'grid' && (_jsxs(_Fragment, { children: [_jsxs("label", { className: "fs-field", children: [_jsx("span", { className: "fs-field__label", children: "Grid columns" }), _jsx("input", { type: "text", className: "fs-input", value: selection.gridTemplateColumns, placeholder: "1fr 1fr 1fr", onChange: (e) => applyStyle({ gridTemplateColumns: e.target.value }, { gridTemplateColumns: e.target.value }) })] }), _jsxs("label", { className: "fs-field", children: [_jsx("span", { className: "fs-field__label", children: "Grid rows" }), _jsx("input", { type: "text", className: "fs-input", value: selection.gridTemplateRows, placeholder: "auto", onChange: (e) => applyStyle({ gridTemplateRows: e.target.value }, { gridTemplateRows: e.target.value }) })] }), _jsxs("label", { className: "fs-field", children: [_jsx("span", { className: "fs-field__label", children: "Gap" }), _jsxs("div", { className: "fs-range-row", children: [_jsx("input", { type: "range", className: "fs-range", min: "0", max: "64", value: selection.gap, onChange: (e) => { const v = e.target.value; applyStyle({ gap: `${v}px` }, { gap: Number(v) }); } }), _jsx("span", { className: "fs-range-value", children: selection.gap })] })] })] })), _jsxs("div", { className: "fs-grid-2", children: [_jsxs("label", { className: "fs-field", children: [_jsx("span", { className: "fs-field__label", children: "Position" }), _jsx("select", { className: "fs-select", value: selection.position, onChange: (e) => applyStyle({ position: e.target.value }, { position: e.target.value }), children: positionOptions.map((o) => _jsx("option", { value: o, children: o }, o)) })] }), _jsxs("label", { className: "fs-field", children: [_jsx("span", { className: "fs-field__label", children: "Z-Index" }), _jsx("input", { type: "number", className: "fs-input", value: selection.zIndex, onChange: (e) => { const v = e.target.value; applyStyle({ zIndex: v }, { zIndex: Number(v) }); } })] })] }), _jsxs("label", { className: "fs-field", children: [_jsx("span", { className: "fs-field__label", children: "Overflow" }), _jsx("select", { className: "fs-select", value: selection.overflow, onChange: (e) => applyStyle({ overflow: e.target.value }, { overflow: e.target.value }), children: overflowOptions.map((o) => _jsx("option", { value: o, children: o }, o)) })] }), _jsxs("label", { className: "fs-field", children: [_jsxs("span", { className: "fs-field__label", children: [_jsx(MousePointer, { size: 12 }), " Cursor"] }), _jsx("select", { className: "fs-select", value: selection.cursor, onChange: (e) => applyStyle({ cursor: e.target.value }, { cursor: e.target.value }), children: cursorOptions.map((o) => _jsx("option", { value: o, children: o }, o)) })] })] })) : (_jsx("span", { style: { color: 'var(--fs-text-tertiary)', fontSize: '0.74rem' }, children: "Select an element" })) }), _jsx(AccordionSection, { id: "spacing", icon: _jsx(Square, { size: 14 }), title: "Spacing & Sizing", isOpen: openSections.spacing, onToggle: () => toggleSection('spacing'), children: selection ? (_jsxs("div", { className: "fs-stack", children: [_jsxs("div", { className: "fs-boxmodel", "data-chef-editor-root": "true", children: [_jsx("button", { type: "button", className: `fs-boxmodel__link-btn ${marginLinked ? 'is-linked' : ''}`, onClick: () => setMarginLinked(!marginLinked), title: "Link margins", children: marginLinked ? _jsx(Link, { size: 10 }) : _jsx(Unlink, { size: 10 }) }), _jsx("input", { className: "fs-boxmodel__input is-mt", value: Math.round(selection.marginTop), onChange: (e) => { const v = e.target.value; if (marginLinked) {
                                                    applyStyle({ margin: `${v}px` }, { marginTop: Number(v), marginRight: Number(v), marginBottom: Number(v), marginLeft: Number(v) });
                                                }
                                                else {
                                                    applyStyle({ marginTop: `${v}px` }, { marginTop: Number(v) });
                                                } } }), _jsx("input", { className: "fs-boxmodel__input is-mr", value: Math.round(selection.marginRight), onChange: (e) => { const v = e.target.value; if (marginLinked) {
                                                    applyStyle({ margin: `${v}px` }, { marginTop: Number(v), marginRight: Number(v), marginBottom: Number(v), marginLeft: Number(v) });
                                                }
                                                else {
                                                    applyStyle({ marginRight: `${v}px` }, { marginRight: Number(v) });
                                                } } }), _jsx("input", { className: "fs-boxmodel__input is-mb", value: Math.round(selection.marginBottom), onChange: (e) => { const v = e.target.value; if (marginLinked) {
                                                    applyStyle({ margin: `${v}px` }, { marginTop: Number(v), marginRight: Number(v), marginBottom: Number(v), marginLeft: Number(v) });
                                                }
                                                else {
                                                    applyStyle({ marginBottom: `${v}px` }, { marginBottom: Number(v) });
                                                } } }), _jsx("input", { className: "fs-boxmodel__input is-ml", value: Math.round(selection.marginLeft), onChange: (e) => { const v = e.target.value; if (marginLinked) {
                                                    applyStyle({ margin: `${v}px` }, { marginTop: Number(v), marginRight: Number(v), marginBottom: Number(v), marginLeft: Number(v) });
                                                }
                                                else {
                                                    applyStyle({ marginLeft: `${v}px` }, { marginLeft: Number(v) });
                                                } } }), _jsxs("div", { className: "fs-boxmodel__padding", children: [_jsx("button", { type: "button", className: `fs-boxmodel__link-btn ${paddingLinked ? 'is-linked' : ''}`, onClick: () => setPaddingLinked(!paddingLinked), title: "Link padding", children: paddingLinked ? _jsx(Link, { size: 10 }) : _jsx(Unlink, { size: 10 }) }), _jsx("input", { className: "fs-boxmodel__input is-pt", value: Math.round(selection.paddingTop), onChange: (e) => { const v = e.target.value; if (paddingLinked) {
                                                            applyStyle({ padding: `${v}px` }, { paddingTop: Number(v), paddingRight: Number(v), paddingBottom: Number(v), paddingLeft: Number(v) });
                                                        }
                                                        else {
                                                            applyStyle({ paddingTop: `${v}px` }, { paddingTop: Number(v) });
                                                        } } }), _jsx("input", { className: "fs-boxmodel__input is-pr", value: Math.round(selection.paddingRight), onChange: (e) => { const v = e.target.value; if (paddingLinked) {
                                                            applyStyle({ padding: `${v}px` }, { paddingTop: Number(v), paddingRight: Number(v), paddingBottom: Number(v), paddingLeft: Number(v) });
                                                        }
                                                        else {
                                                            applyStyle({ paddingRight: `${v}px` }, { paddingRight: Number(v) });
                                                        } } }), _jsx("input", { className: "fs-boxmodel__input is-pb", value: Math.round(selection.paddingBottom), onChange: (e) => { const v = e.target.value; if (paddingLinked) {
                                                            applyStyle({ padding: `${v}px` }, { paddingTop: Number(v), paddingRight: Number(v), paddingBottom: Number(v), paddingLeft: Number(v) });
                                                        }
                                                        else {
                                                            applyStyle({ paddingBottom: `${v}px` }, { paddingBottom: Number(v) });
                                                        } } }), _jsx("input", { className: "fs-boxmodel__input is-pl", value: Math.round(selection.paddingLeft), onChange: (e) => { const v = e.target.value; if (paddingLinked) {
                                                            applyStyle({ padding: `${v}px` }, { paddingTop: Number(v), paddingRight: Number(v), paddingBottom: Number(v), paddingLeft: Number(v) });
                                                        }
                                                        else {
                                                            applyStyle({ paddingLeft: `${v}px` }, { paddingLeft: Number(v) });
                                                        } } }), _jsx("div", { className: "fs-boxmodel__content", children: "content" })] })] }), _jsxs("div", { className: "fs-pill-group", children: [_jsx("button", { type: "button", className: "fs-pill", onClick: () => applySizePreset('auto'), children: "Auto" }), _jsx("button", { type: "button", className: "fs-pill", onClick: () => applySizePreset('hug'), children: "Hug" }), _jsx("button", { type: "button", className: "fs-pill is-accent", onClick: () => applySizePreset('fill'), children: "Fill" }), _jsx("button", { type: "button", className: "fs-pill", onClick: () => applySizePreset('fullBleed'), children: "Full bleed" }), _jsx("button", { type: "button", className: "fs-pill", onClick: () => applySizePreset('square'), children: "Square" }), _jsx("button", { type: "button", className: "fs-pill", onClick: () => applySizePreset('viewportHeight'), children: "100vh" })] }), _jsxs("div", { className: "fs-grid-2", children: [_jsxs("label", { className: "fs-field", children: [_jsx("span", { className: "fs-field__label", children: "Width" }), _jsx("input", { type: "text", className: "fs-input", value: selection.width, onChange: (e) => applyStyle({ width: e.target.value }, { width: e.target.value }), placeholder: "auto" })] }), _jsxs("label", { className: "fs-field", children: [_jsx("span", { className: "fs-field__label", children: "Height" }), _jsx("input", { type: "text", className: "fs-input", value: selection.height, onChange: (e) => applyStyle({ height: e.target.value }, { height: e.target.value }), placeholder: "auto" })] })] }), _jsxs("div", { className: "fs-grid-2", children: [_jsxs("label", { className: "fs-field", children: [_jsx("span", { className: "fs-field__label", children: "Min width" }), _jsx("input", { type: "text", className: "fs-input", value: selection.minWidth, onChange: (e) => applyStyle({ minWidth: e.target.value }, { minWidth: e.target.value }), placeholder: "none" })] }), _jsxs("label", { className: "fs-field", children: [_jsx("span", { className: "fs-field__label", children: "Max width" }), _jsx("input", { type: "text", className: "fs-input", value: selection.maxWidth, onChange: (e) => applyStyle({ maxWidth: e.target.value }, { maxWidth: e.target.value }), placeholder: "none" })] })] }), _jsxs("div", { className: "fs-grid-2", children: [_jsxs("label", { className: "fs-field", children: [_jsx("span", { className: "fs-field__label", children: "Min height" }), _jsx("input", { type: "text", className: "fs-input", value: selection.minHeight, onChange: (e) => applyStyle({ minHeight: e.target.value }, { minHeight: e.target.value }), placeholder: "none" })] }), _jsxs("label", { className: "fs-field", children: [_jsx("span", { className: "fs-field__label", children: "Max height" }), _jsx("input", { type: "text", className: "fs-input", value: selection.maxHeight, onChange: (e) => applyStyle({ maxHeight: e.target.value }, { maxHeight: e.target.value }), placeholder: "none" })] })] }), _jsxs("label", { className: "fs-field", children: [_jsx("span", { className: "fs-field__label", children: "Aspect ratio" }), _jsx("input", { type: "text", className: "fs-input", value: selection.aspectRatio, onChange: (e) => applyStyle({ aspectRatio: e.target.value }, { aspectRatio: e.target.value }), placeholder: "auto, 1 / 1, 16 / 9" })] })] })) : (_jsx("span", { style: { color: 'var(--fs-text-tertiary)', fontSize: '0.74rem' }, children: "Select an element" })) }), _jsx(AccordionSection, { id: "typography", icon: _jsx(Type, { size: 14 }), title: "Typography", isOpen: openSections.typography, onToggle: () => toggleSection('typography'), children: selection ? (_jsxs("div", { className: "fs-stack", children: [_jsxs("label", { className: "fs-field", children: [_jsxs("span", { className: "fs-field__label", children: [_jsx(PencilLine, { size: 12 }), " Content"] }), _jsx("textarea", { className: "fs-textarea", value: selection.text, onChange: (e) => {
                                                    const value = e.target.value;
                                                    updateDraft((draft) => ({ ...draft, text: value }), { text: value });
                                                } })] }), _jsxs("label", { className: "fs-field", children: [_jsx("span", { className: "fs-field__label", children: "Font family" }), _jsx("select", { className: "fs-select", value: selection.fontFamily, onChange: (e) => applyStyle({ fontFamily: e.target.value }, { fontFamily: e.target.value }), children: fontOptions.map((f) => _jsx("option", { value: f.value, children: f.label }, f.label)) })] }), _jsxs("div", { className: "fs-grid-2", children: [_jsxs("label", { className: "fs-field", children: [_jsx("span", { className: "fs-field__label", children: "Size" }), _jsxs("div", { className: "fs-range-row", children: [_jsx("input", { type: "range", className: "fs-range", min: "8", max: "96", value: selection.fontSize, onChange: (e) => { const v = Number(e.target.value); applyStyle({ fontSize: `${v}px` }, { fontSize: v }); } }), _jsx("span", { className: "fs-range-value", children: selection.fontSize })] })] }), _jsxs("label", { className: "fs-field", children: [_jsx("span", { className: "fs-field__label", children: "Weight" }), _jsx("select", { className: "fs-select", value: selection.fontWeight, onChange: (e) => applyStyle({ fontWeight: e.target.value }, { fontWeight: e.target.value }), children: ['100', '200', '300', '400', '500', '600', '700', '800', '900'].map((w) => _jsx("option", { value: w, children: w }, w)) })] })] }), _jsxs("div", { className: "fs-toolbar", role: "toolbar", "aria-label": "Text formatting", children: [_jsx("button", { type: "button", className: `fs-toolbar__btn ${selection.fontWeight === '700' || selection.fontWeight === '800' || selection.fontWeight === '900' ? 'is-active' : ''}`, onClick: () => applyStyle({ fontWeight: Number(selection.fontWeight) >= 700 ? '400' : '700' }, { fontWeight: Number(selection.fontWeight) >= 700 ? '400' : '700' }), title: "Bold", children: _jsx(Bold, { size: 14 }) }), _jsx("button", { type: "button", className: `fs-toolbar__btn ${selection.fontStyle === 'italic' ? 'is-active' : ''}`, onClick: () => applyStyle({ fontStyle: selection.fontStyle === 'italic' ? 'normal' : 'italic' }, { fontStyle: selection.fontStyle === 'italic' ? 'normal' : 'italic' }), title: "Italic", children: _jsx(Italic, { size: 14 }) }), _jsx("button", { type: "button", className: `fs-toolbar__btn ${selection.textDecoration.includes('underline') ? 'is-active' : ''}`, onClick: () => applyStyle({ textDecorationLine: selection.textDecoration.includes('underline') ? 'none' : 'underline' }, { textDecoration: selection.textDecoration.includes('underline') ? 'none' : 'underline' }), title: "Underline", children: _jsx(Underline, { size: 14 }) }), _jsx("button", { type: "button", className: `fs-toolbar__btn ${selection.textDecoration.includes('line-through') ? 'is-active' : ''}`, onClick: () => applyStyle({ textDecorationLine: selection.textDecoration.includes('line-through') ? 'none' : 'line-through' }, { textDecoration: selection.textDecoration.includes('line-through') ? 'none' : 'line-through' }), title: "Strikethrough", children: _jsx(Strikethrough, { size: 14 }) })] }), _jsxs("div", { className: "fs-toolbar", role: "toolbar", "aria-label": "Text alignment", children: [_jsx("button", { type: "button", className: `fs-toolbar__btn ${selection.textAlign === 'left' || selection.textAlign === 'start' ? 'is-active' : ''}`, onClick: () => applyStyle({ textAlign: 'left' }, { textAlign: 'left' }), title: "Align left", children: _jsx(AlignLeft, { size: 14 }) }), _jsx("button", { type: "button", className: `fs-toolbar__btn ${selection.textAlign === 'center' ? 'is-active' : ''}`, onClick: () => applyStyle({ textAlign: 'center' }, { textAlign: 'center' }), title: "Align center", children: _jsx(AlignCenter, { size: 14 }) }), _jsx("button", { type: "button", className: `fs-toolbar__btn ${selection.textAlign === 'right' || selection.textAlign === 'end' ? 'is-active' : ''}`, onClick: () => applyStyle({ textAlign: 'right' }, { textAlign: 'right' }), title: "Align right", children: _jsx(AlignRight, { size: 14 }) })] }), _jsxs("div", { className: "fs-grid-2", children: [_jsxs("label", { className: "fs-field", children: [_jsx("span", { className: "fs-field__label", children: "Letter spacing" }), _jsxs("div", { className: "fs-range-row", children: [_jsx("input", { type: "range", className: "fs-range", min: "-5", max: "20", step: "0.5", value: selection.letterSpacing, onChange: (e) => { const v = Number(e.target.value); applyStyle({ letterSpacing: `${v}px` }, { letterSpacing: v }); } }), _jsx("span", { className: "fs-range-value", children: selection.letterSpacing })] })] }), _jsxs("label", { className: "fs-field", children: [_jsx("span", { className: "fs-field__label", children: "Line height" }), _jsxs("div", { className: "fs-range-row", children: [_jsx("input", { type: "range", className: "fs-range", min: "0.8", max: "3", step: "0.1", value: selection.lineHeight, onChange: (e) => { const v = Number(e.target.value); applyStyle({ lineHeight: `${v}` }, { lineHeight: v }); } }), _jsx("span", { className: "fs-range-value", children: selection.lineHeight.toFixed(1) })] })] })] }), _jsxs("div", { className: "fs-grid-2", children: [_jsxs("label", { className: "fs-field", children: [_jsx("span", { className: "fs-field__label", children: "Word spacing" }), _jsxs("div", { className: "fs-range-row", children: [_jsx("input", { type: "range", className: "fs-range", min: "-5", max: "20", step: "1", value: selection.wordSpacing, onChange: (e) => { const v = Number(e.target.value); applyStyle({ wordSpacing: `${v}px` }, { wordSpacing: v }); } }), _jsx("span", { className: "fs-range-value", children: selection.wordSpacing })] })] }), _jsxs("label", { className: "fs-field", children: [_jsx("span", { className: "fs-field__label", children: "Text transform" }), _jsx("select", { className: "fs-select", value: selection.textTransform, onChange: (e) => applyStyle({ textTransform: e.target.value }, { textTransform: e.target.value }), children: textTransformOptions.map((o) => _jsx("option", { value: o, children: o }, o)) })] })] })] })) : (_jsx("span", { style: { color: 'var(--fs-text-tertiary)', fontSize: '0.74rem' }, children: "Select an element" })) }), _jsx(AccordionSection, { id: "fill", icon: _jsx(Paintbrush, { size: 14 }), title: "Fill & Color", isOpen: openSections.fill, onToggle: () => toggleSection('fill'), children: selection ? (_jsxs("div", { className: "fs-stack", children: [_jsxs("div", { className: "fs-grid-2", children: [_jsxs("label", { className: "fs-field", children: [_jsxs("span", { className: "fs-field__label", children: [_jsx(Palette, { size: 12 }), " Background"] }), _jsx("input", { type: "color", className: "fs-color-input", value: selection.background, onChange: (e) => applyStyle({ backgroundColor: e.target.value }, { background: e.target.value }) })] }), _jsxs("label", { className: "fs-field", children: [_jsxs("span", { className: "fs-field__label", children: [_jsx(PencilLine, { size: 12 }), " Text color"] }), _jsx("input", { type: "color", className: "fs-color-input", value: selection.color, onChange: (e) => applyStyle({ color: e.target.value }, { color: e.target.value }) })] })] }), _jsxs("label", { className: "fs-field", children: [_jsx("span", { className: "fs-field__label", children: "Opacity" }), _jsxs("div", { className: "fs-range-row", children: [_jsx("input", { type: "range", className: "fs-range", min: "0", max: "100", value: Math.round(selection.opacity * 100), onChange: (e) => { const v = Number(e.target.value) / 100; applyStyle({ opacity: `${v}` }, { opacity: v }); } }), _jsxs("span", { className: "fs-range-value", children: [Math.round(selection.opacity * 100), "%"] })] })] }), _jsxs("div", { className: "fs-pill-group", children: [_jsxs("button", { type: "button", className: "fs-pill is-accent", onClick: openSelectedImageUpload, children: [_jsx(ImagePlus, { size: 13 }), " Selected image"] }), _jsxs("button", { type: "button", className: "fs-pill", onClick: clearAppliedImage, children: [_jsx(Eraser, { size: 13 }), " Clear selected image"] }), _jsxs("button", { type: "button", className: "fs-pill", onClick: openCanvasImageUpload, children: [_jsx(ImagePlus, { size: 13 }), " Page image"] }), _jsxs("button", { type: "button", className: "fs-pill", onClick: clearCanvasImage, children: [_jsx(Eraser, { size: 13 }), " Clear page image"] })] }), _jsxs("label", { className: "fs-field", children: [_jsx("span", { className: "fs-field__label", children: "Mix blend mode" }), _jsx("select", { className: "fs-select", value: selection.mixBlendMode, onChange: (e) => applyStyle({ mixBlendMode: e.target.value }, { mixBlendMode: e.target.value }), children: blendModeOptions.map((o) => _jsx("option", { value: o, children: o }, o)) })] })] })) : (_jsx("span", { style: { color: 'var(--fs-text-tertiary)', fontSize: '0.74rem' }, children: "Select an element" })) }), _jsx(AccordionSection, { id: "borders", icon: _jsx(SquareDashedBottom, { size: 14 }), title: "Borders", isOpen: openSections.borders, onToggle: () => toggleSection('borders'), children: selection ? (_jsxs("div", { className: "fs-stack", children: [_jsxs("div", { className: "fs-grid-2", children: [_jsxs("label", { className: "fs-field", children: [_jsx("span", { className: "fs-field__label", children: "Width" }), _jsxs("div", { className: "fs-range-row", children: [_jsx("input", { type: "range", className: "fs-range", min: "0", max: "12", value: selection.borderWidth, onChange: (e) => { const v = e.target.value; applyStyle({ borderWidth: `${v}px` }, { borderWidth: Number(v) }); } }), _jsx("span", { className: "fs-range-value", children: selection.borderWidth })] })] }), _jsxs("label", { className: "fs-field", children: [_jsx("span", { className: "fs-field__label", children: "Style" }), _jsx("select", { className: "fs-select", value: selection.borderStyle, onChange: (e) => applyStyle({ borderStyle: e.target.value }, { borderStyle: e.target.value }), children: borderStyleOptions.map((o) => _jsx("option", { value: o, children: o }, o)) })] })] }), _jsxs("label", { className: "fs-field", children: [_jsxs("span", { className: "fs-field__label", children: [_jsx(SlidersHorizontal, { size: 12 }), " Border color"] }), _jsx("input", { type: "color", className: "fs-color-input", value: selection.borderColor, onChange: (e) => applyStyle({ borderColor: e.target.value }, { borderColor: e.target.value }) })] }), _jsxs("div", { className: "fs-row-between", children: [_jsx("span", { className: "fs-field__label", children: "Corner radius" }), _jsx("button", { type: "button", className: `fs-boxmodel__link-btn ${radiusLinked ? 'is-linked' : ''}`, onClick: () => setRadiusLinked(!radiusLinked), title: "Link corners", style: { position: 'static' }, children: radiusLinked ? _jsx(Link, { size: 10 }) : _jsx(Unlink, { size: 10 }) })] }), _jsxs("div", { className: "fs-grid-4", children: [_jsxs("label", { className: "fs-field", children: [_jsx("span", { className: "fs-field__label", style: { fontSize: '0.62rem' }, children: "TL" }), _jsx("input", { type: "number", className: "fs-input", min: "0", max: "100", value: Math.round(selection.borderRadiusTL), onChange: (e) => {
                                                            const v = Number(e.target.value);
                                                            if (radiusLinked) {
                                                                applyStyle({ borderRadius: `${v}px` }, { borderRadiusTL: v, borderRadiusTR: v, borderRadiusBR: v, borderRadiusBL: v });
                                                            }
                                                            else {
                                                                applyStyle({ borderTopLeftRadius: `${v}px` }, { borderRadiusTL: v });
                                                            }
                                                        } })] }), _jsxs("label", { className: "fs-field", children: [_jsx("span", { className: "fs-field__label", style: { fontSize: '0.62rem' }, children: "TR" }), _jsx("input", { type: "number", className: "fs-input", min: "0", max: "100", value: Math.round(selection.borderRadiusTR), onChange: (e) => {
                                                            const v = Number(e.target.value);
                                                            if (radiusLinked) {
                                                                applyStyle({ borderRadius: `${v}px` }, { borderRadiusTL: v, borderRadiusTR: v, borderRadiusBR: v, borderRadiusBL: v });
                                                            }
                                                            else {
                                                                applyStyle({ borderTopRightRadius: `${v}px` }, { borderRadiusTR: v });
                                                            }
                                                        } })] }), _jsxs("label", { className: "fs-field", children: [_jsx("span", { className: "fs-field__label", style: { fontSize: '0.62rem' }, children: "BR" }), _jsx("input", { type: "number", className: "fs-input", min: "0", max: "100", value: Math.round(selection.borderRadiusBR), onChange: (e) => {
                                                            const v = Number(e.target.value);
                                                            if (radiusLinked) {
                                                                applyStyle({ borderRadius: `${v}px` }, { borderRadiusTL: v, borderRadiusTR: v, borderRadiusBR: v, borderRadiusBL: v });
                                                            }
                                                            else {
                                                                applyStyle({ borderBottomRightRadius: `${v}px` }, { borderRadiusBR: v });
                                                            }
                                                        } })] }), _jsxs("label", { className: "fs-field", children: [_jsx("span", { className: "fs-field__label", style: { fontSize: '0.62rem' }, children: "BL" }), _jsx("input", { type: "number", className: "fs-input", min: "0", max: "100", value: Math.round(selection.borderRadiusBL), onChange: (e) => {
                                                            const v = Number(e.target.value);
                                                            if (radiusLinked) {
                                                                applyStyle({ borderRadius: `${v}px` }, { borderRadiusTL: v, borderRadiusTR: v, borderRadiusBR: v, borderRadiusBL: v });
                                                            }
                                                            else {
                                                                applyStyle({ borderBottomLeftRadius: `${v}px` }, { borderRadiusBL: v });
                                                            }
                                                        } })] })] })] })) : (_jsx("span", { style: { color: 'var(--fs-text-tertiary)', fontSize: '0.74rem' }, children: "Select an element" })) }), _jsx(AccordionSection, { id: "effects", icon: _jsx(Sparkles, { size: 14 }), title: "Effects", isOpen: openSections.effects, onToggle: () => toggleSection('effects'), children: selection ? (_jsxs("div", { className: "fs-stack", children: [_jsxs("label", { className: "fs-field", children: [_jsx("span", { className: "fs-field__label", children: "Box shadow" }), _jsx("input", { type: "text", className: "fs-input", value: selection.boxShadow, placeholder: "0 4px 12px rgba(0,0,0,0.2)", onChange: (e) => applyStyle({ boxShadow: e.target.value }, { boxShadow: e.target.value }) })] }), _jsxs("div", { className: "fs-pill-group", children: [_jsx("button", { type: "button", className: "fs-pill", onClick: () => applyStyle({ boxShadow: '0 4px 14px rgba(0,0,0,0.15)' }, { boxShadow: '0 4px 14px rgba(0,0,0,0.15)' }), children: "Soft" }), _jsx("button", { type: "button", className: "fs-pill", onClick: () => applyStyle({ boxShadow: '0 10px 30px rgba(0,0,0,0.25)' }, { boxShadow: '0 10px 30px rgba(0,0,0,0.25)' }), children: "Medium" }), _jsx("button", { type: "button", className: "fs-pill", onClick: () => applyStyle({ boxShadow: '0 20px 50px rgba(0,0,0,0.4)' }, { boxShadow: '0 20px 50px rgba(0,0,0,0.4)' }), children: "Heavy" }), _jsx("button", { type: "button", className: "fs-pill", onClick: () => applyStyle({ boxShadow: '0 0 20px rgba(94,234,212,0.3)' }, { boxShadow: '0 0 20px rgba(94,234,212,0.3)' }), children: "Glow" }), _jsx("button", { type: "button", className: "fs-pill", onClick: () => applyStyle({ boxShadow: 'none' }, { boxShadow: '' }), children: "None" })] }), _jsxs("label", { className: "fs-field", children: [_jsx("span", { className: "fs-field__label", children: "CSS Filter" }), _jsx("input", { type: "text", className: "fs-input", value: selection.filter, placeholder: "blur(4px) brightness(1.1)", onChange: (e) => applyStyle({ filter: e.target.value }, { filter: e.target.value }) })] }), _jsxs("div", { className: "fs-pill-group", children: [_jsx("button", { type: "button", className: "fs-pill", onClick: () => applyStyle({ filter: 'blur(4px)' }, { filter: 'blur(4px)' }), children: "Blur" }), _jsx("button", { type: "button", className: "fs-pill", onClick: () => applyStyle({ filter: 'grayscale(1)' }, { filter: 'grayscale(1)' }), children: "Grayscale" }), _jsx("button", { type: "button", className: "fs-pill", onClick: () => applyStyle({ filter: 'brightness(1.2) contrast(1.1)' }, { filter: 'brightness(1.2) contrast(1.1)' }), children: "Vivid" }), _jsx("button", { type: "button", className: "fs-pill", onClick: () => applyStyle({ filter: 'saturate(2)' }, { filter: 'saturate(2)' }), children: "Saturate" }), _jsx("button", { type: "button", className: "fs-pill", onClick: () => applyStyle({ filter: 'sepia(0.8)' }, { filter: 'sepia(0.8)' }), children: "Sepia" }), _jsx("button", { type: "button", className: "fs-pill", onClick: () => applyStyle({ filter: 'none' }, { filter: '' }), children: "Clear" })] }), _jsxs("label", { className: "fs-field", children: [_jsx("span", { className: "fs-field__label", children: "Backdrop filter" }), _jsx("input", { type: "text", className: "fs-input", value: selection.backdropFilter, placeholder: "blur(12px)", onChange: (e) => applyStyle({ backdropFilter: e.target.value }, { backdropFilter: e.target.value }) })] }), _jsxs("label", { className: "fs-field", children: [_jsx("span", { className: "fs-field__label", children: "Text shadow" }), _jsx("input", { type: "text", className: "fs-input", value: selection.textShadow, placeholder: "2px 2px 4px rgba(0,0,0,0.3)", onChange: (e) => applyStyle({ textShadow: e.target.value }, { textShadow: e.target.value }) })] }), _jsxs("div", { className: "fs-pill-group", children: [_jsx("button", { type: "button", className: "fs-pill", onClick: () => applyStyle({ textShadow: '1px 1px 2px rgba(0,0,0,0.3)' }, { textShadow: '1px 1px 2px rgba(0,0,0,0.3)' }), children: "Subtle" }), _jsx("button", { type: "button", className: "fs-pill", onClick: () => applyStyle({ textShadow: '2px 2px 6px rgba(0,0,0,0.5)' }, { textShadow: '2px 2px 6px rgba(0,0,0,0.5)' }), children: "Medium" }), _jsx("button", { type: "button", className: "fs-pill", onClick: () => applyStyle({ textShadow: '0 0 10px rgba(94,234,212,0.6)' }, { textShadow: '0 0 10px rgba(94,234,212,0.6)' }), children: "Glow" }), _jsx("button", { type: "button", className: "fs-pill", onClick: () => applyStyle({ textShadow: '3px 3px 0px rgba(255,108,79,0.8)' }, { textShadow: '3px 3px 0px rgba(255,108,79,0.8)' }), children: "Retro" }), _jsx("button", { type: "button", className: "fs-pill", onClick: () => applyStyle({ textShadow: 'none' }, { textShadow: '' }), children: "None" })] })] })) : (_jsx("span", { style: { color: 'var(--fs-text-tertiary)', fontSize: '0.74rem' }, children: "Select an element" })) }), _jsx(AccordionSection, { id: "transform", icon: _jsx(Move, { size: 14 }), title: "Transform", isOpen: openSections.transform, onToggle: () => toggleSection('transform'), children: selection ? (_jsxs("div", { className: "fs-stack", children: [_jsxs("label", { className: "fs-field", children: [_jsxs("span", { className: "fs-field__label", children: [_jsx(RotateCw, { size: 12 }), " Rotate"] }), _jsxs("div", { className: "fs-range-row", children: [_jsx("input", { type: "range", className: "fs-range", min: "-180", max: "180", value: selection.rotate, onChange: (e) => {
                                                            const v = Number(e.target.value);
                                                            applyStyle({ transform: buildTransformString({ rotate: v }) }, { rotate: v });
                                                        } }), _jsxs("span", { className: "fs-range-value", children: [selection.rotate, "\u00B0"] })] })] }), _jsxs("div", { className: "fs-grid-2", children: [_jsxs("label", { className: "fs-field", children: [_jsx("span", { className: "fs-field__label", children: "Scale X" }), _jsxs("div", { className: "fs-range-row", children: [_jsx("input", { type: "range", className: "fs-range", min: "0.1", max: "3", step: "0.1", value: selection.scaleX, onChange: (e) => {
                                                                    const v = Number(e.target.value);
                                                                    applyStyle({ transform: buildTransformString({ scaleX: v }) }, { scaleX: v });
                                                                } }), _jsx("span", { className: "fs-range-value", children: selection.scaleX.toFixed(1) })] })] }), _jsxs("label", { className: "fs-field", children: [_jsx("span", { className: "fs-field__label", children: "Scale Y" }), _jsxs("div", { className: "fs-range-row", children: [_jsx("input", { type: "range", className: "fs-range", min: "0.1", max: "3", step: "0.1", value: selection.scaleY, onChange: (e) => {
                                                                    const v = Number(e.target.value);
                                                                    applyStyle({ transform: buildTransformString({ scaleY: v }) }, { scaleY: v });
                                                                } }), _jsx("span", { className: "fs-range-value", children: selection.scaleY.toFixed(1) })] })] })] }), _jsxs("div", { className: "fs-grid-2", children: [_jsxs("label", { className: "fs-field", children: [_jsx("span", { className: "fs-field__label", children: "Skew X" }), _jsxs("div", { className: "fs-range-row", children: [_jsx("input", { type: "range", className: "fs-range", min: "-45", max: "45", value: selection.skewX, onChange: (e) => {
                                                                    const v = Number(e.target.value);
                                                                    applyStyle({ transform: buildTransformString({ skewX: v }) }, { skewX: v });
                                                                } }), _jsxs("span", { className: "fs-range-value", children: [selection.skewX, "\u00B0"] })] })] }), _jsxs("label", { className: "fs-field", children: [_jsx("span", { className: "fs-field__label", children: "Skew Y" }), _jsxs("div", { className: "fs-range-row", children: [_jsx("input", { type: "range", className: "fs-range", min: "-45", max: "45", value: selection.skewY, onChange: (e) => {
                                                                    const v = Number(e.target.value);
                                                                    applyStyle({ transform: buildTransformString({ skewY: v }) }, { skewY: v });
                                                                } }), _jsxs("span", { className: "fs-range-value", children: [selection.skewY, "\u00B0"] })] })] })] }), _jsxs("div", { className: "fs-grid-2", children: [_jsxs("label", { className: "fs-field", children: [_jsx("span", { className: "fs-field__label", children: "Translate X" }), _jsx("input", { type: "number", className: "fs-input", value: selection.translateX, onChange: (e) => {
                                                            const v = Number(e.target.value);
                                                            applyStyle({ transform: buildTransformString({ translateX: v }) }, { translateX: v });
                                                        } })] }), _jsxs("label", { className: "fs-field", children: [_jsx("span", { className: "fs-field__label", children: "Translate Y" }), _jsx("input", { type: "number", className: "fs-input", value: selection.translateY, onChange: (e) => {
                                                            const v = Number(e.target.value);
                                                            applyStyle({ transform: buildTransformString({ translateY: v }) }, { translateY: v });
                                                        } })] })] }), _jsxs("button", { type: "button", className: "fs-pill", onClick: () => applyStyle({ transform: 'none' }, { rotate: 0, scaleX: 1, scaleY: 1, skewX: 0, skewY: 0, translateX: 0, translateY: 0 }), children: [_jsx(Eraser, { size: 12 }), " Reset transform"] })] })) : (_jsx("span", { style: { color: 'var(--fs-text-tertiary)', fontSize: '0.74rem' }, children: "Select an element" })) }), _jsx(AccordionSection, { id: "container", icon: _jsx(Box, { size: 14 }), title: "Add Structure", isOpen: openSections.container, onToggle: () => toggleSection('container'), children: _jsxs("div", { className: "fs-stack", children: [_jsx("p", { className: "fs-helper-text", children: "Add inside the selected area. If nothing is selected, Froam adds it to the page canvas." }), _jsxs("div", { className: "fs-shape-studio", "data-chef-editor-root": "true", children: [_jsxs("div", { className: "fs-shape-studio__header", children: [_jsxs("span", { children: [_jsx(Square, { size: 13 }), " Shape studio"] }), _jsxs("button", { type: "button", className: "fs-pill", onClick: () => addStructureBlock('shape'), children: [_jsx(Plus, { size: 12 }), " Rectangle"] })] }), _jsx(FroamShapeLibrary, { onInsertShape: insertShapeLayer, onToast: showToast })] }), _jsxs("div", { className: "fs-inject-grid", children: [_jsxs("button", { type: "button", className: "fs-inject-btn is-primary", onClick: () => addStructureBlock('section'), children: [_jsx(Square, { size: 18 }), "Add section"] }), _jsxs("button", { type: "button", className: "fs-inject-btn", onClick: () => addStructureBlock('header'), children: [_jsx(SquareDashedBottom, { size: 18 }), "Add header"] }), _jsxs("button", { type: "button", className: "fs-inject-btn", onClick: () => addStructureBlock('footer'), children: [_jsx(SquareDashedBottom, { size: 18 }), "Add footer"] }), _jsxs("button", { type: "button", className: "fs-inject-btn", onClick: () => addStructureBlock('container'), children: [_jsx(Box, { size: 18 }), "Add container"] }), _jsxs("button", { type: "button", className: "fs-inject-btn", onClick: () => addStructureBlock('card'), children: [_jsx(Layers, { size: 18 }), "Add card"] }), _jsxs("button", { type: "button", className: "fs-inject-btn", onClick: () => addStructureBlock('grid'), children: [_jsx(LayoutGrid, { size: 18 }), "Add grid"] }), _jsxs("button", { type: "button", className: "fs-inject-btn", onClick: () => addStructureBlock('hero'), children: [_jsx(Sparkles, { size: 18 }), "Add hero"] }), _jsxs("button", { type: "button", className: "fs-inject-btn", onClick: () => addStructureBlock('stats'), children: [_jsx(ClipboardCheck, { size: 18 }), "Add stats"] }), _jsxs("button", { type: "button", className: "fs-inject-btn", onClick: () => addStructureBlock('text'), children: [_jsx(Type, { size: 18 }), "Add text"] }), _jsxs("button", { type: "button", className: "fs-inject-btn", onClick: () => addStructureBlock('image'), children: [_jsx(ImagePlus, { size: 18 }), "Add image frame"] }), _jsxs("button", { type: "button", className: "fs-inject-btn", onClick: () => addStructureBlock('button'), children: [_jsx(MousePointer2, { size: 18 }), "Add button"] }), _jsxs("button", { type: "button", className: "fs-inject-btn", onClick: () => addStructureBlock('divider'), children: [_jsx(Minus, { size: 18 }), "Add divider"] })] }), _jsxs("div", { className: "fs-inject-actions", children: [_jsxs("button", { type: "button", className: "fs-pill", onClick: wrapInContainer, disabled: !selection, children: [_jsx(Grip, { size: 12 }), " Wrap selected"] }), _jsxs("button", { type: "button", className: "fs-pill", onClick: addChildContainer, children: [_jsx(Plus, { size: 12 }), " Child container"] }), _jsxs("button", { type: "button", className: "fs-pill", onClick: addSiblingContainer, disabled: !selection, children: [_jsx(Minus, { size: 12 }), " Sibling container"] }), _jsxs("button", { type: "button", className: "fs-pill is-accent", onClick: openSelectedImageUpload, children: [_jsx(ImagePlus, { size: 12 }), " Upload image"] })] })] }) }), _jsx(AccordionSection, { id: "gradient", icon: _jsx(Palette, { size: 14 }), title: "Gradient Builder", isOpen: openSections.gradient, onToggle: () => toggleSection('gradient'), children: _jsxs("div", { className: "fs-stack", children: [_jsx("div", { className: "fs-gradient-preview", children: _jsx("div", { className: "fs-gradient-preview__overlay", style: { background: buildGradientCSS(gradType, gradAngle, gradStops) } }) }), _jsxs("div", { className: "fs-grid-2", children: [_jsxs("label", { className: "fs-field", children: [_jsx("span", { className: "fs-field__label", children: "Type" }), _jsxs("select", { className: "fs-select", value: gradType, onChange: (e) => setGradType(e.target.value), children: [_jsx("option", { value: "linear", children: "Linear" }), _jsx("option", { value: "radial", children: "Radial" })] })] }), gradType === 'linear' && (_jsxs("label", { className: "fs-field", children: [_jsx("span", { className: "fs-field__label", children: "Angle" }), _jsxs("div", { className: "fs-range-row", children: [_jsx("input", { type: "range", className: "fs-range", min: "0", max: "360", value: gradAngle, onChange: (e) => setGradAngle(Number(e.target.value)) }), _jsxs("span", { className: "fs-range-value", children: [gradAngle, "\u00B0"] })] })] }))] }), _jsx("div", { className: "fs-gradient-stops", children: gradStops.map((stop, i) => (_jsxs("div", { className: "fs-gradient-stop", children: [_jsx("input", { type: "color", className: "fs-gradient-stop__color", value: stop.color, onChange: (e) => {
                                                        const next = [...gradStops];
                                                        next[i] = { ...next[i], color: e.target.value };
                                                        setGradStops(next);
                                                    } }), _jsx("input", { type: "number", className: "fs-input fs-gradient-stop__position", min: "0", max: "100", value: stop.position, onChange: (e) => {
                                                        const next = [...gradStops];
                                                        next[i] = { ...next[i], position: Number(e.target.value) };
                                                        setGradStops(next);
                                                    } }), _jsx("span", { className: "fs-range-value", children: "%" }), gradStops.length > 2 && (_jsx("button", { type: "button", className: "fs-gradient-stop__remove", onClick: () => setGradStops(gradStops.filter((_, j) => j !== i)), children: _jsx(X, { size: 12 }) }))] }, i))) }), _jsxs("div", { className: "fs-pill-group", children: [_jsxs("button", { type: "button", className: "fs-pill", onClick: () => setGradStops([...gradStops, { color: '#ffffff', position: 50 }]), children: [_jsx(Plus, { size: 12 }), " Add stop"] }), _jsxs("button", { type: "button", className: "fs-pill is-accent", onClick: applyGradient, disabled: !selection, children: [_jsx(Paintbrush, { size: 12 }), " Apply gradient"] })] })] }) }), _jsxs(AccordionSection, { id: "layers", icon: _jsx(Layers, { size: 14 }), title: "Layers", isOpen: openSections.layers, onToggle: () => toggleSection('layers'), children: [_jsx("div", { className: "fs-layers", "data-chef-editor-root": "true", children: layers.length === 0 ? (_jsx("span", { style: { color: 'var(--fs-text-tertiary)', fontSize: '0.74rem' }, children: "No layers detected" })) : (layers.map((node) => (_jsxs("div", { className: `fs-layers__node ${selection?.path === node.path ? 'is-selected' : ''}`, style: { paddingLeft: `${8 + node.depth * 14}px` }, onClick: () => selectLayerNode(node), children: [_jsx(Code, { size: 11, style: { opacity: 0.5, flexShrink: 0 } }), _jsx("span", { className: "fs-layers__node-tag", children: node.tag }), node.className && _jsxs("span", { className: "fs-layers__node-class", children: [".", node.className.replace(/ /g, '.')] }), _jsx("button", { type: "button", className: `fs-layers__eye ${node.hidden ? 'is-hidden' : ''}`, onClick: (e) => { e.stopPropagation(); toggleLayerVisibility(node); }, title: node.hidden ? 'Show' : 'Hide', children: node.hidden ? _jsx(EyeOff, { size: 12 }) : _jsx(Eye, { size: 12 }) })] }, node.path)))) }), _jsxs("button", { type: "button", className: "fs-pill", onClick: () => { const root = getRoot(); if (root)
                                        setLayers(collectLayers(root)); }, children: [_jsx(Search, { size: 12 }), " Refresh layers"] })] }), _jsx(AccordionSection, { id: "cssVars", icon: _jsx(Variable, { size: 14 }), title: "CSS Variables", isOpen: openSections.cssVars, onToggle: () => toggleSection('cssVars'), children: _jsxs("div", { className: "fs-stack", children: [cssVars.length === 0 ? (_jsx("span", { style: { color: 'var(--fs-text-tertiary)', fontSize: '0.74rem' }, children: "No custom properties found on :root" })) : (cssVars.map((v) => (_jsxs("div", { className: "fs-css-var", "data-chef-editor-root": "true", children: [_jsx("span", { className: "fs-css-var__name", title: v.name, children: v.name }), _jsx("input", { type: "text", className: "fs-input fs-css-var__value", value: v.value, onChange: (e) => updateCSSVar(v.name, e.target.value) }), _jsx("button", { type: "button", className: "fs-gradient-stop__remove", onClick: () => removeCSSVar(v.name), title: "Remove", children: _jsx(X, { size: 12 }) })] }, v.name)))), _jsxs("div", { className: "fs-row", style: { gap: 6 }, children: [_jsx("input", { type: "text", className: "fs-input", value: newVarName, onChange: (e) => setNewVarName(e.target.value), placeholder: "--my-color", style: { flex: 1 } }), _jsx("input", { type: "text", className: "fs-input", value: newVarValue, onChange: (e) => setNewVarValue(e.target.value), placeholder: "#ff0000", style: { flex: 1 } }), _jsxs("button", { type: "button", className: "fs-pill is-accent", onClick: addCSSVar, children: [_jsx(Plus, { size: 12 }), " Add"] })] })] }) }), _jsx(AccordionSection, { id: "versions", icon: _jsx(GitCommit, { size: 14 }), title: "Versions", isOpen: openSections.versions, onToggle: () => toggleSection('versions'), children: _jsx(FroamVersionPanel, { routeKey: routeKey, viewportMode: viewportMode, currentStore: routeDrafts, getCurrentStore: () => collectVersionRouteDrafts(), captureThumb: capturePageThumb, onLoadVersion: (versionStore, versionName) => {
                                    commitToUndoStack(store);
                                    const nextStore = {
                                        ...store,
                                        [viewportStoreKey]: versionStore,
                                    };
                                    setStore(nextStore);
                                    saveStore(nextStore);
                                    applyStoreToDOM(nextStore, { clearCurrent: true });
                                    showToast(`Loaded "${versionName}"`);
                                    toggleSection('versions');
                                }, onClose: () => toggleSection('versions') }) }), _jsx(AccordionSection, { id: "history", icon: _jsx(Clock, { size: 14 }), title: "History", isOpen: openSections.history, onToggle: () => toggleSection('history'), children: history.filter((e) => e.routeKey === viewportStoreKey).length === 0 ? (_jsx("span", { style: { color: 'var(--fs-text-tertiary)', fontSize: '0.74rem' }, children: "No history yet for this viewport" })) : (_jsx("ul", { className: "fs-history-list", children: history.filter((e) => e.routeKey === viewportStoreKey).map((entry) => (_jsxs("li", { className: "fs-history-item", "data-chef-editor-root": "true", children: [_jsxs("div", { className: "fs-history-meta", children: [_jsx("span", { children: entry.label }), _jsx("small", { children: new Date(entry.timestamp).toLocaleTimeString() })] }), _jsx("button", { type: "button", className: "fs-pill is-accent", onClick: () => restoreFromHistory(entry), children: "Restore" })] }, entry.id))) })) }), _jsx(AccordionSection, { id: "inspiration", icon: _jsx(ImagePlus, { size: 14 }), title: "Inspiration Board", isOpen: openSections.inspiration, onToggle: () => toggleSection('inspiration'), children: _jsx(FroamInspirationPanel, { onToast: showToast }) }), _jsx(AccordionSection, { id: "tokens", icon: _jsx(Coins, { size: 14 }), title: "Design Tokens", isOpen: openSections.tokens, onToggle: () => toggleSection('tokens'), children: _jsxs("div", { className: "fs-stack", children: [_jsx("p", { className: "fs-helper-text", children: "Named values you can apply instantly to any element. Also injected as CSS variables." }), tokens.length > 0 && (_jsx("div", { className: "fs-tokens-grid", children: tokens.map((token) => (_jsxs("div", { className: "fs-token", "data-chef-editor-root": "true", children: [token.category === 'color' && (_jsx("span", { className: "fs-token__swatch", style: { background: token.value } })), _jsx("span", { className: "fs-token__name", title: `--${token.name.replace(/\s+/g, '-').toLowerCase()}`, children: token.name }), _jsx("span", { className: "fs-token__value", children: token.value }), _jsx("button", { type: "button", className: "fs-pill fs-token__apply", onClick: () => applyTokenToSelection(token), children: "Apply" }), _jsx("button", { type: "button", className: "froam-floating-bar__btn", onClick: () => removeToken(token.id), children: _jsx(X, { size: 10 }) })] }, token.id))) })), _jsxs("div", { className: "fs-grid-2", style: { gap: 6 }, children: [_jsxs("label", { className: "fs-field", children: [_jsx("span", { className: "fs-field__label", children: "Category" }), _jsxs("select", { className: "fs-select", value: newTokenCategory, onChange: (e) => setNewTokenCategory(e.target.value), children: [_jsx("option", { value: "color", children: "Color" }), _jsx("option", { value: "spacing", children: "Spacing" }), _jsx("option", { value: "font-size", children: "Font size" }), _jsx("option", { value: "radius", children: "Radius" }), _jsx("option", { value: "shadow", children: "Shadow" }), _jsx("option", { value: "other", children: "Other" })] })] }), _jsxs("label", { className: "fs-field", children: [_jsx("span", { className: "fs-field__label", children: "Name" }), _jsx("input", { type: "text", className: "fs-input", value: newTokenName, onChange: (e) => setNewTokenName(e.target.value), placeholder: "brand-primary" })] })] }), _jsxs("label", { className: "fs-field", children: [_jsx("span", { className: "fs-field__label", children: "Value" }), _jsxs("div", { style: { display: 'flex', gap: 6 }, children: [newTokenCategory === 'color' && _jsx("input", { type: "color", className: "fs-color-input", value: newTokenValue || '#000000', onChange: (e) => setNewTokenValue(e.target.value), style: { width: 36 } }), _jsx("input", { type: "text", className: "fs-input", value: newTokenValue, onChange: (e) => setNewTokenValue(e.target.value), placeholder: newTokenCategory === 'color' ? '#5eead4' : newTokenCategory === 'spacing' ? '16px' : newTokenCategory === 'radius' ? '8px' : 'value', style: { flex: 1 } })] })] }), _jsxs("button", { type: "button", className: "fs-pill is-accent", onClick: addToken, children: [_jsx(Plus, { size: 12 }), " Add token"] })] }) }), _jsx(AccordionSection, { id: "align", icon: _jsx(AlignCenterHorizontal, { size: 14 }), title: "Align & Distribute", isOpen: openSections.align, onToggle: () => toggleSection('align'), children: _jsxs("div", { className: "fs-stack", children: [_jsx("p", { className: "fs-helper-text", children: "Shift-click multiple elements, then align. Works on 2+ selected elements." }), _jsxs("div", { className: "fs-align-grid", children: [_jsxs("button", { type: "button", className: "fs-pill", title: "Align left edges", onClick: () => alignSelections('left'), children: [_jsx(AlignLeft, { size: 13 }), " Left"] }), _jsxs("button", { type: "button", className: "fs-pill", title: "Center horizontally", onClick: () => alignSelections('center-h'), children: [_jsx(AlignCenterHorizontal, { size: 13 }), " Center H"] }), _jsxs("button", { type: "button", className: "fs-pill", title: "Align right edges", onClick: () => alignSelections('right'), children: [_jsx(AlignRight, { size: 13 }), " Right"] }), _jsxs("button", { type: "button", className: "fs-pill", title: "Align top edges", onClick: () => alignSelections('top'), children: [_jsx(AlignVerticalJustifyCenter, { size: 13 }), " Top"] }), _jsxs("button", { type: "button", className: "fs-pill", title: "Center vertically", onClick: () => alignSelections('center-v'), children: [_jsx(AlignCenterVertical, { size: 13 }), " Center V"] }), _jsxs("button", { type: "button", className: "fs-pill", title: "Align bottom edges", onClick: () => alignSelections('bottom'), children: [_jsx(AlignVerticalDistributeCenter, { size: 13 }), " Bottom"] })] }), _jsxs("div", { className: "fs-pill-group", style: { marginTop: 4 }, children: [_jsxs("button", { type: "button", className: "fs-pill is-accent", title: "Distribute horizontally", onClick: () => alignSelections('distribute-h'), children: [_jsx(AlignHorizontalDistributeCenter, { size: 13 }), " Distribute H"] }), _jsxs("button", { type: "button", className: "fs-pill is-accent", title: "Distribute vertically", onClick: () => alignSelections('distribute-v'), children: [_jsx(AlignHorizontalJustifyCenter, { size: 13 }), " Distribute V"] })] }), _jsxs("p", { style: { fontSize: '0.7rem', color: 'var(--fs-text-tertiary)', margin: 0 }, children: [selections.length, " element", selections.length !== 1 ? 's' : '', " selected"] })] }) }), _jsx(AccordionSection, { id: "transitions", icon: _jsx(Timer, { size: 14 }), title: "Transitions & Motion", isOpen: openSections.transitions, onToggle: () => toggleSection('transitions'), children: _jsxs("div", { className: "fs-stack", children: [_jsxs("div", { className: "fs-grid-2", children: [_jsxs("label", { className: "fs-field", children: [_jsx("span", { className: "fs-field__label", children: "Property" }), _jsx("select", { className: "fs-select", value: transitionProp, onChange: (e) => setTransitionProp(e.target.value), children: ['all', 'opacity', 'transform', 'background-color', 'color', 'box-shadow', 'border-radius', 'width', 'height', 'padding', 'margin', 'filter'].map((p) => (_jsx("option", { value: p, children: p }, p))) })] }), _jsxs("label", { className: "fs-field", children: [_jsx("span", { className: "fs-field__label", children: "Easing" }), _jsx("select", { className: "fs-select", value: transitionEasing, onChange: (e) => setTransitionEasing(e.target.value), children: ['ease', 'ease-in', 'ease-out', 'ease-in-out', 'linear', 'cubic-bezier(0.34,1.56,0.64,1)', 'cubic-bezier(0.4,0,0.2,1)'].map((e) => (_jsx("option", { value: e, children: e.startsWith('cubic') ? 'Spring' : e }, e))) })] })] }), _jsxs("div", { className: "fs-grid-2", children: [_jsxs("label", { className: "fs-field", children: [_jsx("span", { className: "fs-field__label", children: "Duration (ms)" }), _jsxs("div", { className: "fs-range-row", children: [_jsx("input", { type: "range", className: "fs-range", min: "50", max: "2000", step: "50", value: transitionDuration, onChange: (e) => setTransitionDuration(Number(e.target.value)) }), _jsx("span", { className: "fs-range-value", children: transitionDuration })] })] }), _jsxs("label", { className: "fs-field", children: [_jsx("span", { className: "fs-field__label", children: "Delay (ms)" }), _jsxs("div", { className: "fs-range-row", children: [_jsx("input", { type: "range", className: "fs-range", min: "0", max: "1000", step: "50", value: transitionDelay, onChange: (e) => setTransitionDelay(Number(e.target.value)) }), _jsx("span", { className: "fs-range-value", children: transitionDelay })] })] })] }), _jsxs("div", { className: "fs-pill-group", children: [_jsx("button", { type: "button", className: "fs-pill", onClick: () => { setTransitionProp('all'); setTransitionDuration(200); setTransitionEasing('ease'); setTransitionDelay(0); }, children: "Fast" }), _jsx("button", { type: "button", className: "fs-pill", onClick: () => { setTransitionProp('all'); setTransitionDuration(400); setTransitionEasing('ease-in-out'); setTransitionDelay(0); }, children: "Smooth" }), _jsx("button", { type: "button", className: "fs-pill", onClick: () => { setTransitionProp('transform'); setTransitionDuration(600); setTransitionEasing('cubic-bezier(0.34,1.56,0.64,1)'); setTransitionDelay(0); }, children: "Spring" }), _jsx("button", { type: "button", className: "fs-pill", onClick: () => { setTransitionProp('opacity'); setTransitionDuration(300); setTransitionEasing('ease'); setTransitionDelay(0); }, children: "Fade" })] }), _jsxs("button", { type: "button", className: "fs-pill is-accent", onClick: applyTransitionToSelection, disabled: !selection, children: [_jsx(Zap, { size: 12 }), " Apply to selected"] }), selection && (_jsxs("button", { type: "button", className: "fs-pill", onClick: () => applyStyle({ transition: 'none' }), children: [_jsx(Eraser, { size: 12 }), " Remove transition"] }))] }) }), _jsx(AccordionSection, { id: "assets", icon: _jsx(FileImage, { size: 14 }), title: "Asset Manager", isOpen: openSections.assets, onToggle: () => toggleSection('assets'), children: _jsxs("div", { className: "fs-stack", children: [_jsx("p", { className: "fs-helper-text", children: "Save images and apply them to any element. Drag & drop or paste a URL." }), _jsxs("div", { className: "fs-row", style: { gap: 6 }, children: [_jsx("input", { type: "text", className: "fs-input", placeholder: "Paste image URL\u2026", style: { flex: 1 }, onKeyDown: (e) => {
                                                    if (e.key === 'Enter') {
                                                        const url = e.target.value.trim();
                                                        if (url) {
                                                            addAssetEntry(url, url.split('/').pop()?.split('?')[0] || 'Image');
                                                            e.target.value = '';
                                                        }
                                                    }
                                                } }), _jsxs("button", { type: "button", className: "fs-pill is-accent", onClick: () => {
                                                    const input = document.createElement('input');
                                                    input.type = 'file';
                                                    input.accept = 'image/*';
                                                    input.onchange = () => {
                                                        const file = input.files?.[0];
                                                        if (!file)
                                                            return;
                                                        const reader = new FileReader();
                                                        reader.onload = () => { if (typeof reader.result === 'string')
                                                            addAssetEntry(reader.result, file.name.replace(/\.[^.]+$/, '')); };
                                                        reader.readAsDataURL(file);
                                                    };
                                                    input.click();
                                                }, children: [_jsx(ImagePlus, { size: 12 }), " Upload"] })] }), assets.length > 0 && (_jsx("input", { type: "text", className: "fs-input", placeholder: "Search assets\u2026", value: assetSearch, onChange: (e) => setAssetSearch(e.target.value) })), _jsxs("div", { className: "fs-assets-grid", children: [assets.filter((a) => !assetSearch || a.name.toLowerCase().includes(assetSearch.toLowerCase())).map((asset) => (_jsxs("div", { className: "fs-asset-item", "data-chef-editor-root": "true", children: [_jsx("img", { src: asset.url, alt: asset.name, className: "fs-asset-item__thumb", onClick: () => applyAssetToSelection(asset.url), loading: "lazy" }), _jsx("span", { className: "fs-asset-item__name", title: asset.name, children: asset.name }), _jsx("button", { type: "button", className: "fs-asset-item__remove", onClick: () => removeAsset(asset.id), children: _jsx(X, { size: 10 }) })] }, asset.id))), assets.length === 0 && _jsx("p", { style: { color: 'var(--fs-text-tertiary)', fontSize: '0.74rem', margin: 0 }, children: "No assets yet." })] })] }) }), _jsxs("div", { className: "froam-studio__quick-bar", "data-chef-editor-root": "true", children: [_jsxs("button", { type: "button", className: "fs-pill", onClick: () => setCommandPaletteOpen(true), title: "Ctrl+K", children: [_jsx(Search, { size: 11 }), " Ctrl+K"] }), _jsx("span", { style: { flex: 1 } }), _jsxs("span", { style: { fontSize: '0.64rem', color: 'var(--fs-text-tertiary)' }, children: [draftCount, " ", viewportMode, " drafts"] })] })] }) })) : null, _jsx("input", { ref: fileInputRef, className: "fs-hidden-input", "data-chef-editor-root": "true", type: "file", accept: "image/*", onChange: handleImageUpload }), showPanel && selection && !inlineEditing && (_jsx(FroamResizeHandles, { targetRect: selectionRect, visible: !!selectionRect, onResizeStart: () => {
                    if (!selection)
                        return;
                    const root = getRoot();
                    if (!root)
                        return;
                    const target = findElementByPath(root, selection.path);
                    if (!target)
                        return;
                    const rect = target.getBoundingClientRect();
                    const computed = window.getComputedStyle(target);
                    const originalRoute = originalsRef.current[viewportStoreKey] ?? {};
                    if (!originalRoute[selection.path]) {
                        const inlineStyles = target.style;
                        originalRoute[selection.path] = {
                            text: target.innerText,
                            imageUrl: target instanceof HTMLImageElement ? target.currentSrc || target.src || '' : undefined,
                            styles: Object.fromEntries(persistedStyleKeys.map((key) => [key, inlineStyles[key] || ''])),
                        };
                        originalsRef.current[viewportStoreKey] = originalRoute;
                    }
                    resizeBaseRef.current = {
                        width: rect.width,
                        height: rect.height,
                        left: readNumber(computed.left, 0),
                        top: readNumber(computed.top, 0),
                        position: computed.position,
                        aspectRatio: rect.height > 0 ? rect.width / rect.height : 1,
                        finalStyles: {},
                    };
                    setIsResizing(true);
                }, onResize: ({ direction, deltaWidth, deltaHeight, deltaX, deltaY, preserveAspectRatio, resizeFromCenter }) => {
                    if (!selection || !resizeBaseRef.current)
                        return;
                    const root = getRoot();
                    if (!root)
                        return;
                    const target = findElementByPath(root, selection.path);
                    if (!target)
                        return;
                    const base = resizeBaseRef.current;
                    let widthDelta = resizeFromCenter ? deltaWidth * 2 : deltaWidth;
                    let heightDelta = resizeFromCenter ? deltaHeight * 2 : deltaHeight;
                    const changesWidth = direction.includes('e') || direction.includes('w');
                    const changesHeight = direction === 'n' || direction === 's' || direction.includes('n') || direction.includes('s');
                    let newW = Math.max(20, base.width + widthDelta);
                    let newH = Math.max(10, base.height + heightDelta);
                    if (preserveAspectRatio && changesWidth && changesHeight && base.aspectRatio > 0) {
                        const widthChange = Math.abs(widthDelta / Math.max(base.width, 1));
                        const heightChange = Math.abs(heightDelta / Math.max(base.height, 1));
                        if (widthChange >= heightChange) {
                            newH = Math.max(10, newW / base.aspectRatio);
                            heightDelta = newH - base.height;
                        }
                        else {
                            newW = Math.max(20, newH * base.aspectRatio);
                            widthDelta = newW - base.width;
                        }
                    }
                    const snap = (value) => {
                        const rounded = Math.round(value);
                        const grid = Math.round(rounded / 8) * 8;
                        return Math.abs(grid - rounded) <= 2 ? grid : rounded;
                    };
                    newW = snap(newW);
                    newH = snap(newH);
                    widthDelta = newW - base.width;
                    heightDelta = newH - base.height;
                    let moveX = resizeFromCenter && changesWidth ? -widthDelta / 2 : deltaX;
                    let moveY = resizeFromCenter && changesHeight ? -heightDelta / 2 : deltaY;
                    if (!resizeFromCenter && direction.includes('w'))
                        moveX = -widthDelta;
                    if (!resizeFromCenter && direction.includes('n'))
                        moveY = -heightDelta;
                    const styles = {};
                    if (changesWidth) {
                        styles.width = `${newW}px`;
                        styles.minWidth = '0px';
                        styles.maxWidth = 'none';
                        styles.boxSizing = 'border-box';
                        styles.flex = '0 0 auto';
                    }
                    if (changesHeight) {
                        styles.height = `${newH}px`;
                        styles.minHeight = '0px';
                        styles.maxHeight = 'none';
                        styles.boxSizing = 'border-box';
                    }
                    if (moveX !== 0 || moveY !== 0) {
                        if (base.position === 'static') {
                            styles.position = 'relative';
                        }
                        if (moveX !== 0) {
                            styles.left = `${Math.round(base.left + moveX)}px`;
                        }
                        if (moveY !== 0) {
                            styles.top = `${Math.round(base.top + moveY)}px`;
                        }
                    }
                    if (!Object.keys(styles).length)
                        return;
                    Object.entries(styles).forEach(([property, value]) => {
                        target.style.setProperty(camelToKebab(property), value);
                    });
                    base.finalStyles = styles;
                    setSelectionRect(target.getBoundingClientRect());
                }, onResizeEnd: () => {
                    setIsResizing(false);
                    const finalStyles = resizeBaseRef.current?.finalStyles ?? {};
                    resizeBaseRef.current = null;
                    if (!selection)
                        return;
                    const root = getRoot();
                    if (!root)
                        return;
                    const target = findElementByPath(root, selection.path);
                    if (!target)
                        return;
                    if (Object.keys(finalStyles).length) {
                        const nextSelection = {};
                        if (finalStyles.width)
                            nextSelection.width = finalStyles.width;
                        if (finalStyles.height)
                            nextSelection.height = finalStyles.height;
                        if (finalStyles.position)
                            nextSelection.position = finalStyles.position;
                        applyStyle(finalStyles, nextSelection, 'Resized element');
                    }
                    setSelectionRect(target.getBoundingClientRect());
                } })), _jsx(FroamPersonaEditor, { open: personaEditorOpen, persona: personaDraft, onChange: setPersonaDraft, onClose: closePersonaEditor, onSave: savePersonaProfile, onImageUpload: handlePersonaImageUpload, onClearImage: clearPersonaImage }), showPanel && selection && !inlineEditing && !isResizing && (_jsx(FroamFloatingBar, { targetRect: selectionRect, visible: !!selectionRect, label: selection.label, fontFamily: selection.fontFamily, fontSize: selection.fontSize, fontWeight: selection.fontWeight, lineHeight: selection.lineHeight, letterSpacing: selection.letterSpacing, wordSpacing: selection.wordSpacing, textTransform: selection.textTransform, isBold: Number(selection.fontWeight) >= 700, isItalic: selection.fontStyle === 'italic', isUnderline: selection.textDecoration.includes('underline'), isStrike: selection.textDecoration.includes('line-through'), textAlign: selection.textAlign, color: selection.color, background: selection.background, width: selection.width, height: selection.height, display: selection.display, flexDirection: selection.flexDirection, justifyContent: selection.justifyContent, alignItems: selection.alignItems, gap: selection.gap, padding: selection.paddingTop, radius: selection.borderRadiusTL, overflow: selection.overflow, fontOptions: fontOptions, selectionCount: selections.length, onStyle: (styles, selectionPatch, label) => {
                    applyStyle(styles, selectionPatch, label);
                    const root = getRoot();
                    const target = root ? findElementByPath(root, selection.path) : null;
                    if (target)
                        window.requestAnimationFrame(() => setSelectionRect(target.getBoundingClientRect()));
                }, onAction: (action, value) => {
                    switch (action) {
                        case 'bold':
                            applyStyle({ fontWeight: Number(selection.fontWeight) >= 700 ? '400' : '700' }, { fontWeight: Number(selection.fontWeight) >= 700 ? '400' : '700' });
                            break;
                        case 'italic':
                            applyStyle({ fontStyle: selection.fontStyle === 'italic' ? 'normal' : 'italic' }, { fontStyle: selection.fontStyle === 'italic' ? 'normal' : 'italic' });
                            break;
                        case 'underline':
                            applyStyle({ textDecorationLine: selection.textDecoration.includes('underline') ? 'none' : 'underline' }, { textDecoration: selection.textDecoration.includes('underline') ? 'none' : 'underline' });
                            break;
                        case 'strike':
                            applyStyle({ textDecorationLine: selection.textDecoration.includes('line-through') ? 'none' : 'line-through' }, { textDecoration: selection.textDecoration.includes('line-through') ? 'none' : 'line-through' });
                            break;
                        case 'align-left':
                            applyStyle({ textAlign: 'left' }, { textAlign: 'left' });
                            break;
                        case 'align-center':
                            applyStyle({ textAlign: 'center' }, { textAlign: 'center' });
                            break;
                        case 'align-right':
                            applyStyle({ textAlign: 'right' }, { textAlign: 'right' });
                            break;
                        case 'align-justify':
                            applyStyle({ textAlign: 'justify' }, { textAlign: 'justify' });
                            break;
                        case 'color':
                            if (value)
                                applyStyle({ color: value }, { color: value });
                            break;
                        case 'bg-color':
                            if (value)
                                applyStyle({ backgroundColor: value }, { background: value });
                            break;
                        case 'clear-bg':
                            applyStyle({ backgroundColor: 'transparent' }, { background: '#ffffff' }, 'Cleared fill');
                            break;
                        case 'image':
                            actionsRef.current.openSelectedImageUpload();
                            break;
                        case 'merge':
                            groupSelected();
                            break;
                        case 'unmerge':
                            ungroupSelected();
                            break;
                        case 'duplicate': {
                            const root = getRoot();
                            if (!root)
                                break;
                            const target = findElementByPath(root, selection.path);
                            if (!target || !target.parentElement)
                                break;
                            const clone = target.cloneNode(true);
                            clone.removeAttribute('data-chef-selected');
                            clone.removeAttribute('data-chef-hovered');
                            assignFreshFroamNodeIds(clone);
                            target.parentElement.insertBefore(clone, target.nextSibling);
                            selectInsertedElement(clone);
                            persistLiveRouteSnapshot();
                            showToast('Duplicated');
                            break;
                        }
                        case 'delete':
                            clearSelectionDraft();
                            break;
                    }
                } })), _jsx(FroamContextMenu, { position: contextMenuPos, elementLabel: selection?.label, isHidden: false, hasClipboard: !!clipboardStyles, onAction: (action) => {
                    switch (action) {
                        case 'copy-styles': {
                            const draft = store[viewportStoreKey]?.[selection?.path ?? ''];
                            if (draft?.styles) {
                                setClipboardStyles({ ...draft.styles });
                                showToast('Styles copied');
                            }
                            break;
                        }
                        case 'paste-styles': {
                            if (clipboardStyles && selection) {
                                applyStyle(clipboardStyles, undefined, 'Pasted styles');
                                showToast('Styles pasted');
                            }
                            break;
                        }
                        case 'duplicate': {
                            if (!selection)
                                break;
                            const root = getRoot();
                            if (!root)
                                break;
                            const target = findElementByPath(root, selection.path);
                            if (!target || !target.parentElement)
                                break;
                            const clone = target.cloneNode(true);
                            clone.removeAttribute('data-chef-selected');
                            clone.removeAttribute('data-chef-hovered');
                            assignFreshFroamNodeIds(clone);
                            target.parentElement.insertBefore(clone, target.nextSibling);
                            selectInsertedElement(clone);
                            persistLiveRouteSnapshot();
                            showToast('Duplicated');
                            break;
                        }
                        case 'clear':
                            clearSelectionDraft();
                            break;
                        case 'delete-element': {
                            if (!selection)
                                break;
                            const root = getRoot();
                            if (!root)
                                break;
                            const target = findElementByPath(root, selection.path);
                            if (target?.dataset.froamInjected === 'true' && target.parentElement) {
                                target.remove();
                                currentSelectionRef.current = null;
                                setSelection(null);
                                setSelectionRect(null);
                                persistLiveRouteSnapshot();
                                showToast('Element removed');
                            }
                            else {
                                showToast('Only injected elements can be removed');
                            }
                            break;
                        }
                        case 'bring-to-front': {
                            if (selection)
                                applyStyle({ zIndex: '999' }, { zIndex: 999 });
                            break;
                        }
                        case 'send-to-back': {
                            if (selection)
                                applyStyle({ zIndex: '-1' }, { zIndex: -1 });
                            break;
                        }
                        case 'toggle-visibility': {
                            if (!selection)
                                break;
                            const root = getRoot();
                            if (!root)
                                break;
                            const target = findElementByPath(root, selection.path);
                            if (target) {
                                const isHidden = window.getComputedStyle(target).display === 'none';
                                applyStyle({ display: isHidden ? '' : 'none' });
                            }
                            break;
                        }
                        case 'wrap-container':
                            actionsRef.current.wrapInContainer();
                            break;
                        case 'upload-image':
                            actionsRef.current.openSelectedImageUpload();
                            break;
                    }
                }, onClose: () => setContextMenuPos(null) }), _jsx(FroamSmartGuides, { guides: smartGuides, visible: smartGuides.length > 0 }), _jsx(FroamShortcutOverlay, { visible: showShortcutOverlay, onClose: () => setShowShortcutOverlay(false) })] }), portalContainer);
}
//# sourceMappingURL=GlobalChefEditor.js.map