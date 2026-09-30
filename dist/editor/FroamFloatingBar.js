import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { FONT_GROUP_LABELS, groupFontOptions } from './fontSources.js';
import { describeSelection } from './selection-name.js';
import { sampleAccent, toHex as brandHex } from './library/site-theme.js';
import { AlignCenter, AlignJustify, AlignLeft, AlignRight, Bold, BringToFront, Check, ChevronDown, ChevronLeft, ChevronRight, Combine, Contrast, Copy, CornerLeftUp, CornerRightDown, Eraser, Eye, EyeOff, ImagePlus, Italic, MoreHorizontal, SendToBack, Search, SlidersHorizontal, Sparkles, Strikethrough, Trash2, Type, Underline, Undo2, Ungroup, WandSparkles, } from 'lucide-react';
const VIEWPORT_GAP = 12;
const TARGET_GAP = 12;
const SCRUB_SLOP = 6;
/* ─── v4: scrub-to-adjust ───
   Press any numeric control and drag horizontally to change it — the
   phone answer to precision editing. Slop-gated so plain taps still
   focus the input / press the buttons. */
function useScrub(onSteps, pixelsPerStep = 8) {
    const stateRef = useRef(null);
    function handlePointerDown(event) {
        if (event.button !== 0 && event.pointerType === 'mouse')
            return;
        stateRef.current = { pointerId: event.pointerId, lastX: event.clientX, acc: 0, active: false };
    }
    function handlePointerMove(event) {
        const state = stateRef.current;
        if (!state || state.pointerId !== event.pointerId)
            return;
        const dx = event.clientX - state.lastX;
        if (!state.active) {
            state.acc += dx;
            state.lastX = event.clientX;
            if (Math.abs(state.acc) < SCRUB_SLOP)
                return;
            state.active = true;
            state.acc = 0;
            try {
                event.currentTarget.setPointerCapture(event.pointerId);
            }
            catch { /* pointer already gone */ }
            return;
        }
        state.acc += dx;
        state.lastX = event.clientX;
        const steps = Math.trunc(state.acc / pixelsPerStep);
        if (steps !== 0) {
            state.acc -= steps * pixelsPerStep;
            onSteps(steps);
            if ('vibrate' in navigator)
                navigator.vibrate?.(2);
        }
    }
    function handlePointerUp(event) {
        const state = stateRef.current;
        if (!state)
            return;
        try {
            if (state.active && event.currentTarget.hasPointerCapture(event.pointerId)) {
                event.currentTarget.releasePointerCapture(event.pointerId);
            }
        }
        catch { /* pointer already gone */ }
        stateRef.current = null;
    }
    return {
        onPointerDown: handlePointerDown,
        onPointerMove: handlePointerMove,
        onPointerUp: handlePointerUp,
        onPointerCancel: handlePointerUp,
    };
}
/* ─── v4: page palette ───
   The best mobile color picker is no picker: read the colors the site
   already uses, rank them by frequency, offer them as one-tap chips. */
function normalizeToHex(value) {
    const match = value.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)(?:\s*,\s*([\d.]+))?\s*\)/);
    if (!match)
        return value.startsWith('#') ? value.toLowerCase() : null;
    if (match[4] !== undefined && Number.parseFloat(match[4]) < 0.4)
        return null;
    const toHex = (channel) => Number(channel).toString(16).padStart(2, '0');
    return `#${toHex(match[1])}${toHex(match[2])}${toHex(match[3])}`;
}
export function collectPagePalette() {
    // Scan the whole page, not just the froam root — brand colors live in headers/footers too
    const counts = new Map();
    const elements = document.body.querySelectorAll('*');
    let scanned = 0;
    for (const element of elements) {
        if (scanned > 1500)
            break;
        if (element.closest('[data-chef-editor-root="true"]'))
            continue;
        scanned += 1;
        const computed = window.getComputedStyle(element);
        for (const raw of [computed.color, computed.backgroundColor, computed.borderTopColor]) {
            const hex = normalizeToHex(raw);
            if (!hex)
                continue;
            counts.set(hex, (counts.get(hex) ?? 0) + 1);
        }
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10).map(([hex]) => hex);
}
function relativeLuminance(hex) {
    const channels = [1, 3, 5].map((offset) => {
        const channel = Number.parseInt(hex.slice(offset, offset + 2), 16) / 255;
        return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}
function contrastRatio(hexA, hexB) {
    const a = relativeLuminance(hexA);
    const b = relativeLuminance(hexB);
    const [lighter, darker] = a >= b ? [a, b] : [b, a];
    return (lighter + 0.05) / (darker + 0.05);
}
function saturationOf(hex) {
    const r = Number.parseInt(hex.slice(1, 3), 16) / 255;
    const g = Number.parseInt(hex.slice(3, 5), 16) / 255;
    const b = Number.parseInt(hex.slice(5, 7), 16) / 255;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    return max === 0 ? 0 : (max - min) / max;
}
/** The site's brand colour, the way the Library and the smart Quick Edits read it; null when the page has no clear one. */
function siteAccent() {
    try {
        const color = sampleAccent(document.body);
        return color ? brandHex(color) : null;
    }
    catch {
        return null;
    }
}
function pickAccent(palette) {
    return palette.find((hex) => {
        const lum = relativeLuminance(hex);
        return saturationOf(hex) > 0.35 && lum > 0.05 && lum < 0.8;
    }) ?? '#14b8a6';
}
/* ─── v4: quick looks — one-tap style recipes ─── */
/* v4.8: expanded from 6 → 40+ recipes, grouped for browsing. Every look's
   `styles` is applied live via setProperty (camelCase → kebab) and compiles
   verbatim to froam.generated.css, so anything valid here ships. Looks are
   accent-aware: `accent` is the site's own picked accent, and color-mix
   derives shades from it so recipes fit whatever palette they land on. */
/* Ordered by how often a designer reaches for them, not alphabetically.
   'Pattern' was called Texture but holds Stripes/Dots/Grid/Blueprint/Halftone,
   which are patterns; 'Vibe' was called Bold but holds Bauhaus/Y2K/Retro/Comic,
   which are eras rather than weights. The old 'Effect' bucket was four
   unrelated recipes, so each moved to the group its CSS actually belongs to. */
/* Look Studio's recipes live in floating-bar-looks.ts, loaded the first time Styles opens. */
const NO_LOOKS = [];
/** Names of the looks that answer the pointer, worked out once per recipe list. */
const LIVING = new WeakMap();
function livingLooks(looks) {
    let names = LIVING.get(looks);
    if (!names) {
        names = new Set(looks.filter((look) => Object.keys(look.styles('#6366f1')).some((key) => /^__froamState:(?:hover|active|focus):/.test(key))).map((look) => look.name));
        LIVING.set(looks, names);
    }
    return names;
}
const NO_NOTES = {};
const NO_GROUPS = [];
// Uniform corner-radius patch so the editor's own radius controls stay in sync.
const corners = (n) => ({ borderRadiusTL: n, borderRadiusTR: n, borderRadiusBR: n, borderRadiusBL: n });
export default function FroamFloatingBar({ targetRect, visible, label, fontFamily, fontSize, fontWeight, isBold, isItalic, isUnderline, isStrike, textAlign, color, background, radius, opacity, isHidden = false, fontOptions, selectionCount, isTextLayer = false, hasText = true, isImage = false, docked = false, canUndo = false, onWalk, onAction, onStyle, selectionKey, onSaveLook, }) {
    const barRef = useRef(null);
    const [narrow, setNarrow] = useState(false);
    const [position, setPosition] = useState({ left: 12, top: 12 });
    const [openPop, setOpenPop] = useState(null);
    const [menuLeft, setMenuLeft] = useState(0);
    const [palette, setPalette] = useState([]);
    const [paletteMode, setPaletteMode] = useState('fill');
    const [lookSearch, setLookSearch] = useState('');
    const [lookGroup, setLookGroup] = useState('All');
    const [recipes, setRecipes] = useState(null);
    useEffect(() => {
        if (openPop !== 'looks' || recipes)
            return;
        let alive = true;
        void import('./floating-bar-looks.js').then((m) => { if (alive)
            setRecipes({ LOOKS: m.LOOKS, LOOK_NOTES: m.LOOK_NOTES, LOOK_GROUPS: m.LOOK_GROUPS }); });
        return () => { alive = false; };
    }, [openPop, recipes]);
    const LOOKS = recipes?.LOOKS ?? NO_LOOKS;
    const LOOK_NOTES = recipes?.LOOK_NOTES ?? NO_NOTES;
    const LOOK_GROUPS = recipes?.LOOK_GROUPS ?? NO_GROUPS;
    const [selectedLookName, setSelectedLookName] = useState('Lift');
    const [lookAccent, setLookAccent] = useState('#14b8a6');
    const lookAccentPickedRef = useRef(false);
    const [lookFill, setLookFill] = useState(() => normalizeToHex(background) ?? '#ffffff');
    const [lookText, setLookText] = useState(() => normalizeToHex(color) ?? '#111827');
    const [overrideLookFill, setOverrideLookFill] = useState(false);
    const [overrideLookText, setOverrideLookText] = useState(false);
    const [overrideLookRadius, setOverrideLookRadius] = useState(false);
    const [lookRadius, setLookRadius] = useState(Math.max(0, Math.round(radius)));
    const [lookState, setLookState] = useState('base');
    const [lookStateDrafts, setLookStateDrafts] = useState({});
    // Another element: the looks tried on the last one aren't this one's to take off.
    useEffect(() => { setLookStateDrafts({}); }, [selectionKey]);
    const [lookDockSide, setLookDockSide] = useState('right');
    const [lookDockStyle, setLookDockStyle] = useState({});
    const fontScrub = useScrub((steps) => {
        const next = Math.min(400, Math.max(6, Math.round(fontSize) + steps));
        onStyle({ fontSize: `${next}px` }, { fontSize: next }, 'Changed font size');
    }, 8);
    // v4.1: opacity scrub — accumulate in a ref so fast drags don't lose steps to render lag
    const opacityRef = useRef(opacity);
    useEffect(() => { opacityRef.current = opacity; }, [opacity]);
    const setOpacity = (next) => {
        const clamped = Math.min(1, Math.max(0, Math.round(next * 100) / 100));
        opacityRef.current = clamped;
        onStyle({ opacity: String(clamped) }, { opacity: clamped }, 'Changed opacity');
    };
    // A menu closes on Escape or a press anywhere else; the Look Studio dock stays.
    useEffect(() => {
        if (!openPop || openPop === 'looks')
            return;
        const onDown = (event) => { if (!barRef.current?.contains(event.target))
            setOpenPop(null); };
        const onKey = (event) => { if (event.key === 'Escape') {
            event.stopPropagation();
            setOpenPop(null);
        } };
        window.addEventListener('pointerdown', onDown, true);
        window.addEventListener('keydown', onKey, true);
        return () => {
            window.removeEventListener('pointerdown', onDown, true);
            window.removeEventListener('keydown', onKey, true);
        };
    }, [openPop]);
    useLayoutEffect(() => {
        if (docked || !visible || !targetRect || !barRef.current)
            return;
        const placeBar = () => {
            const bar = barRef.current;
            if (!bar)
                return;
            const leftPanel = document.querySelector('.froam-figma-left:not([hidden])')?.getBoundingClientRect();
            const rightPanel = document.querySelector('.froam-dp:not(.froam-sheet .froam-dp)')?.getBoundingClientRect();
            const toolbar = document.querySelector('.froam-chrome')?.getBoundingClientRect();
            const safeLeft = leftPanel && leftPanel.width > 0 ? leftPanel.right + VIEWPORT_GAP : VIEWPORT_GAP;
            const safeRight = rightPanel && rightPanel.width > 0 ? rightPanel.left - VIEWPORT_GAP : window.innerWidth - VIEWPORT_GAP;
            const toolbarAtTop = Boolean(toolbar && toolbar.top <= VIEWPORT_GAP);
            const safeTop = toolbarAtTop && toolbar ? toolbar.bottom + VIEWPORT_GAP : VIEWPORT_GAP;
            const safeBottom = !toolbarAtTop && toolbar ? toolbar.top - VIEWPORT_GAP : window.innerHeight - VIEWPORT_GAP;
            const availableWidth = Math.max(280, safeRight - safeLeft);
            const nextNarrow = availableWidth < 560;
            bar.style.maxWidth = `${availableWidth}px`;
            bar.style.width = 'max-content';
            const barRect = bar.getBoundingClientRect();
            const centeredLeft = targetRect.left + targetRect.width / 2 - barRect.width / 2;
            const left = Math.min(Math.max(safeLeft, centeredLeft), Math.max(safeLeft, safeRight - barRect.width));
            // Above the selection when it fits, else below it; never over it.
            const above = targetRect.top - barRect.height - TARGET_GAP;
            const below = targetRect.bottom + TARGET_GAP + 22;
            const maxTop = Math.max(safeTop, safeBottom - barRect.height);
            const top = above >= safeTop ? Math.min(above, maxTop) : Math.min(Math.max(safeTop, below), maxTop);
            bar.style.left = `${left}px`;
            bar.style.top = `${top}px`;
            if (narrow !== nextNarrow)
                setNarrow(nextNarrow);
            setPosition((current) => (Math.abs(current.left - left) < 0.5 && Math.abs(current.top - top) < 0.5
                ? current
                : { left, top }));
        };
        placeBar();
        const resizeObserver = new ResizeObserver(placeBar);
        resizeObserver.observe(barRef.current);
        window.addEventListener('resize', placeBar);
        return () => {
            resizeObserver.disconnect();
            window.removeEventListener('resize', placeBar);
        };
    }, [docked, narrow, targetRect, visible]);
    useLayoutEffect(() => {
        if (openPop !== 'looks')
            return;
        const placeLookDock = () => {
            const leftPanel = document.querySelector('.froam-figma-left:not([hidden])')?.getBoundingClientRect();
            const rightPanel = document.querySelector('.froam-dp:not(.froam-sheet .froam-dp)')?.getBoundingClientRect();
            const toolbar = document.querySelector('.froam-chrome')?.getBoundingClientRect();
            const safeLeft = leftPanel && leftPanel.width > 0 ? leftPanel.right + VIEWPORT_GAP : VIEWPORT_GAP;
            const safeRight = rightPanel && rightPanel.width > 0 ? rightPanel.left - VIEWPORT_GAP : window.innerWidth - VIEWPORT_GAP;
            const safeTop = toolbar && toolbar.top <= VIEWPORT_GAP ? toolbar.bottom + VIEWPORT_GAP : VIEWPORT_GAP;
            const availableWidth = Math.max(280, safeRight - safeLeft);
            if (availableWidth < 620 || window.innerWidth < 720) {
                const panelHeight = Math.min(360, Math.round(window.innerHeight * 0.46));
                setLookDockStyle({
                    left: safeLeft,
                    top: Math.max(VIEWPORT_GAP, window.innerHeight - panelHeight - VIEWPORT_GAP),
                    width: Math.max(280, availableWidth),
                    maxHeight: panelHeight,
                });
                return;
            }
            const panelWidth = Math.min(380, Math.max(320, Math.round(availableWidth * 0.34)));
            setLookDockStyle({
                left: lookDockSide === 'left' ? safeLeft : safeRight - panelWidth,
                top: safeTop,
                width: panelWidth,
                maxHeight: window.innerHeight - safeTop - VIEWPORT_GAP,
            });
        };
        placeLookDock();
        window.addEventListener('resize', placeLookDock);
        return () => window.removeEventListener('resize', placeLookDock);
    }, [lookDockSide, openPop]);
    if (!visible || !targetRect)
        return null;
    const backgroundHex = normalizeToHex(background) ?? '#0b0f14';
    const { kind, detail } = describeSelection(label);
    const showType = hasText || isTextLayer;
    function togglePop(which, mode) {
        if (mode)
            setPaletteMode(mode);
        setOpenPop((current) => {
            const next = current === which && (!mode || mode === paletteMode) ? null : which;
            if ((next === 'palette' || next === 'looks') && palette.length === 0)
                setPalette(collectPagePalette());
            // The looks' accent is the site's brand colour — read from its buttons,
            // links and logo, not whichever colour is most common on the page.
            if (next === 'looks' && !lookAccentPickedRef.current) {
                lookAccentPickedRef.current = true;
                setLookAccent(siteAccent() ?? pickAccent(palette.length ? palette : collectPagePalette()));
            }
            if (next === 'looks') {
                setLookFill(normalizeToHex(background) ?? '#ffffff');
                setLookText(normalizeToHex(color) ?? '#111827');
                setLookRadius(Math.max(0, Math.round(radius)));
                const canvasMidpoint = window.innerWidth / 2;
                const targetCenter = targetRect ? targetRect.left + targetRect.width / 2 : canvasMidpoint;
                setLookDockSide(targetCenter < canvasMidpoint ? 'right' : 'left');
            }
            return next;
        });
    }
    function applyChip(hex) {
        if (paletteMode === 'text')
            onAction('color', hex);
        else
            onAction('bg-color', hex);
        if ('vibrate' in navigator)
            navigator.vibrate?.(4);
    }
    function customizedLook(look, overrides = {}) {
        const accent = overrides.accent ?? lookAccent;
        const fill = overrides.fill ?? lookFill;
        const text = overrides.text ?? lookText;
        const nextRadius = overrides.radius ?? lookRadius;
        const shouldOverrideFill = overrides.overrideFill ?? overrideLookFill;
        const shouldOverrideText = overrides.overrideText ?? overrideLookText;
        const shouldOverrideRadius = overrides.overrideRadius ?? overrideLookRadius;
        // On words, a look's own text recipe when it has one, applied as written.
        const asWritten = Boolean(isTextLayer && look.text);
        const styles = { ...(isTextLayer && look.text ? look.text : look.styles)(accent) };
        const patch = isTextLayer ? {} : { ...(look.patch ?? {}) };
        if (shouldOverrideFill && look.group !== 'Reset') {
            styles.background = fill;
            styles.backgroundImage = 'none';
        }
        if (shouldOverrideText && look.group !== 'Reset') {
            styles.color = text;
            if ('WebkitTextFillColor' in styles)
                styles.WebkitTextFillColor = text;
        }
        if (shouldOverrideRadius && look.group !== 'Reset' && !isTextLayer) {
            styles.borderRadius = `${nextRadius}px`;
            Object.assign(patch, corners(nextRadius));
        }
        return { styles, patch, asWritten };
    }
    function applyLook(look, overrides = {}) {
        const { styles, patch, asWritten } = customizedLook(look, overrides);
        // Trying looks one after another: whatever the last one set and this one
        // doesn't comes off — its hover, its ::after arrow — so each is seen as itself.
        const previous = lookStateDrafts[lookState] ?? {};
        const next = { ...Object.fromEntries(Object.keys(previous).filter((key) => !(key in styles)).map((key) => [key, ''])), ...styles };
        setSelectedLookName(look.name);
        setLookStateDrafts((current) => ({ ...current, [lookState]: styles }));
        if (lookState === 'base')
            onStyle(next, patch, `Look: ${look.name}`, { asWritten });
        // On a state tab the look's plain styles become that state's; a living look's own states stay out of it.
        else
            onStyle(Object.fromEntries(Object.entries(next).filter(([property]) => !property.startsWith('__froamState:')).map(([property, value]) => [`__froamState:${lookState}:${property}`, value])), undefined, `Look: ${look.name} · ${lookState}`, { asWritten });
        if ('vibrate' in navigator)
            navigator.vibrate?.(6);
    }
    const selectedLook = LOOKS.find((look) => look.name === selectedLookName) ?? LOOKS[0];
    const visibleLooks = LOOKS.filter((look) => {
        const query = lookSearch.trim().toLowerCase();
        // Search the description too, so "shadow" finds the shadows and
        // "uppercase" finds Eyebrow — the names alone are not searchable words.
        return (lookGroup === 'All' || look.group === lookGroup)
            && (!isTextLayer || look.text !== null)
            && (!query || `${look.name} ${look.group} ${LOOK_NOTES[look.name] ?? ''}`.toLowerCase().includes(query));
    });
    const lookCount = isTextLayer ? LOOKS.filter((look) => look.text !== null).length : LOOKS.length;
    // Looks that answer the pointer: their tiles move when hovered, too.
    const aliveLooks = livingLooks(LOOKS);
    const alignIcon = textAlign === 'center' ? _jsx(AlignCenter, { size: 15 }) : textAlign === 'right' || textAlign === 'end' ? _jsx(AlignRight, { size: 15 }) : textAlign === 'justify' ? _jsx(AlignJustify, { size: 15 }) : _jsx(AlignLeft, { size: 15 });
    const act = (action, value) => { setOpenPop(null); onAction(action, value); };
    // Open toward the side with more room, and never past the screen's edge.
    const barHeight = barRef.current?.offsetHeight ?? 40;
    const roomBelow = typeof window === 'undefined' ? 600 : window.innerHeight - (position.top + barHeight) - 16;
    const roomAbove = position.top - 16;
    const menuUp = !docked && roomBelow < 420 && roomAbove > roomBelow;
    const menuRoom = Math.max(180, (menuUp ? roomAbove : roomBelow) - 8);
    function anchorAt(button) {
        const bar = barRef.current?.getBoundingClientRect();
        const own = button.getBoundingClientRect();
        setMenuLeft(bar ? Math.max(0, own.left - bar.left + own.width / 2) : 0);
    }
    const walk = (direction) => { setOpenPop(null); onWalk?.(direction); };
    return (_jsxs("div", { ref: barRef, className: `froam-floating-bar ${narrow ? 'is-narrow' : ''} ${docked ? 'is-docked' : ''}`, "data-chef-editor-root": "true", style: docked ? undefined : { left: position.left, top: position.top }, role: "toolbar", "aria-label": `${kind} tools`, children: [_jsxs("div", { className: "froam-floating-bar__primary", children: [onWalk && (_jsx("button", { type: "button", className: "froam-floating-bar__btn froam-floating-bar__walker", title: "Select the parent (Esc climbs too)", "aria-label": "Select parent", onClick: () => onWalk('parent'), children: _jsx(CornerLeftUp, { size: 15 }) })), _jsxs("div", { className: "froam-floating-bar__identity", title: label, children: [_jsx("strong", { children: selectionCount > 1 ? `${selectionCount} selected` : kind }), selectionCount <= 1 && detail && _jsx("small", { children: detail })] }), showType && (_jsxs(_Fragment, { children: [_jsx("span", { className: "froam-floating-bar__sep" }), _jsx("button", { type: "button", className: "froam-floating-bar__btn froam-floating-bar__edit-text", title: "Edit the words (or double-click them)", "aria-label": "Edit text", onClick: () => onAction('edit-text'), children: _jsx(Type, { size: 15 }) }), _jsx("select", { className: "froam-floating-bar__select froam-floating-bar__font", value: fontFamily, title: "Font", "aria-label": "Font family", onChange: (event) => onStyle({ fontFamily: event.target.value }, { fontFamily: event.target.value }, 'Changed font family'), children: groupFontOptions(fontOptions).map(([role, options]) => (_jsx("optgroup", { label: FONT_GROUP_LABELS[role], children: options.map((font) => _jsx("option", { value: font.value, children: font.label }, font.value)) }, role))) }), _jsx("div", { className: "froam-floating-bar__stepper froam-floating-bar__stepper--scrub", title: "Size \u2014 drag the number to scrub", ...fontScrub, style: { touchAction: 'none' }, children: _jsx("input", { type: "number", value: Math.round(fontSize), min: 6, max: 400, "aria-label": "Font size", onChange: (event) => {
                                        const next = Math.max(6, Number(event.target.value));
                                        onStyle({ fontSize: `${next}px` }, { fontSize: next }, 'Changed font size');
                                    } }) }), _jsx("select", { className: "froam-floating-bar__select froam-floating-bar__weight", value: fontWeight, title: "Weight", "aria-label": "Font weight", onChange: (event) => onStyle({ fontWeight: event.target.value }, { fontWeight: event.target.value }, 'Changed font weight'), children: [['300', 'Light'], ['400', 'Regular'], ['500', 'Medium'], ['600', 'Semibold'], ['700', 'Bold'], ['800', 'Extra bold'], ['900', 'Black']].map(([weight, name]) => _jsx("option", { value: weight, children: name }, weight)) }), _jsx("span", { className: "froam-floating-bar__sep" }), _jsx("button", { type: "button", className: `froam-floating-bar__btn ${isBold ? 'is-active' : ''}`, title: "Bold (Ctrl+B)", "aria-label": "Bold", "aria-pressed": Boolean(isBold), onClick: () => onAction('bold'), children: _jsx(Bold, { size: 15 }) }), _jsx("button", { type: "button", className: `froam-floating-bar__btn ${isItalic ? 'is-active' : ''}`, title: "Italic (Ctrl+I)", "aria-label": "Italic", "aria-pressed": Boolean(isItalic), onClick: () => onAction('italic'), children: _jsx(Italic, { size: 15 }) }), _jsx("button", { type: "button", className: `froam-floating-bar__btn ${isUnderline ? 'is-active' : ''}`, title: "Underline (Ctrl+U)", "aria-label": "Underline", "aria-pressed": Boolean(isUnderline), onClick: () => onAction('underline'), children: _jsx(Underline, { size: 15 }) }), _jsx("div", { className: "froam-floating-bar__anchor", children: _jsxs("button", { type: "button", className: `froam-floating-bar__btn froam-floating-bar__btn--menu ${openPop === 'align' ? 'is-open' : ''}`, title: "Alignment", "aria-label": "Text alignment", "aria-haspopup": "menu", "aria-expanded": openPop === 'align', onClick: (event) => { anchorAt(event.currentTarget); togglePop('align'); }, children: [alignIcon, _jsx(ChevronDown, { size: 11 })] }) })] })), _jsx("span", { className: "froam-floating-bar__sep" }), showType && (_jsx("button", { type: "button", className: `froam-floating-bar__swatch ${openPop === 'palette' && paletteMode === 'text' ? 'is-open' : ''}`, title: "Text colour", "aria-label": "Text colour", onClick: (event) => { anchorAt(event.currentTarget); togglePop('palette', 'text'); }, children: _jsx("span", { className: "froam-floating-bar__swatch-text", style: { '--froam-swatch': color }, children: "A" }) })), _jsx("button", { type: "button", className: `froam-floating-bar__swatch ${openPop === 'palette' && paletteMode === 'fill' ? 'is-open' : ''}`, title: isTextLayer ? 'Text fill' : 'Fill', "aria-label": isTextLayer ? 'Text fill' : 'Fill colour', onClick: (event) => { anchorAt(event.currentTarget); togglePop('palette', 'fill'); }, children: _jsx("span", { className: "froam-floating-bar__swatch-fill", style: { '--froam-swatch': isTextLayer ? color : background } }) }), isImage && (_jsx("button", { type: "button", className: "froam-floating-bar__btn", title: "Replace image", "aria-label": "Replace image", onClick: () => onAction('image'), children: _jsx(ImagePlus, { size: 15 }) })), _jsxs("button", { type: "button", className: `froam-floating-bar__looks-btn ${openPop === 'looks' ? 'is-active' : ''}`, title: "Styles \u2014 one-tap looks, previewed live", onClick: () => togglePop('looks'), children: [_jsx(Sparkles, { size: 14 }), _jsx("span", { children: "Styles" })] }), docked && (_jsx("button", { type: "button", className: "froam-floating-bar__btn", title: "Undo", "aria-label": "Undo", disabled: !canUndo, onClick: () => onAction('undo'), children: _jsx(Undo2, { size: 15 }) })), _jsx("div", { className: "froam-floating-bar__anchor", children: _jsx("button", { type: "button", className: `froam-floating-bar__btn ${openPop === 'more' ? 'is-open' : ''}`, onClick: () => togglePop('more'), "aria-haspopup": "menu", "aria-expanded": openPop === 'more', "aria-label": "More actions", title: "More", children: _jsx(MoreHorizontal, { size: 16 }) }) })] }), openPop === 'align' && (_jsxs("div", { className: `froam-floating-bar__menu is-row${menuUp ? ' is-up' : ''}`, style: { left: menuLeft }, role: "menu", "aria-label": "Text alignment", children: [_jsx("button", { type: "button", role: "menuitemradio", "aria-checked": textAlign === 'left' || textAlign === 'start', className: textAlign === 'left' || textAlign === 'start' ? 'is-active' : '', title: "Align left", onClick: () => act('align-left'), children: _jsx(AlignLeft, { size: 15 }) }), _jsx("button", { type: "button", role: "menuitemradio", "aria-checked": textAlign === 'center', className: textAlign === 'center' ? 'is-active' : '', title: "Align center", onClick: () => act('align-center'), children: _jsx(AlignCenter, { size: 15 }) }), _jsx("button", { type: "button", role: "menuitemradio", "aria-checked": textAlign === 'right' || textAlign === 'end', className: textAlign === 'right' || textAlign === 'end' ? 'is-active' : '', title: "Align right", onClick: () => act('align-right'), children: _jsx(AlignRight, { size: 15 }) }), _jsx("button", { type: "button", role: "menuitemradio", "aria-checked": textAlign === 'justify', className: textAlign === 'justify' ? 'is-active' : '', title: "Justify", onClick: () => act('align-justify'), children: _jsx(AlignJustify, { size: 15 }) })] })), openPop === 'more' && (_jsxs("div", { className: `froam-floating-bar__menu is-list${menuUp ? ' is-up' : ''}`, style: { maxHeight: docked ? undefined : menuRoom }, role: "menu", "aria-label": "More actions", children: [_jsxs("button", { type: "button", role: "menuitem", onClick: () => act('open-design'), children: [_jsx(SlidersHorizontal, { size: 14 }), _jsx("span", { children: "All design controls" })] }), _jsxs("button", { type: "button", role: "menuitem", onClick: () => act('animate'), children: [_jsx(WandSparkles, { size: 14 }), _jsx("span", { children: "Animate\u2026" })] }), _jsxs("button", { type: "button", role: "menuitem", onClick: () => act('duplicate'), children: [_jsx(Copy, { size: 14 }), _jsx("span", { children: "Duplicate" }), _jsx("kbd", { children: "Ctrl D" })] }), !isImage && _jsxs("button", { type: "button", role: "menuitem", onClick: () => act('image'), children: [_jsx(ImagePlus, { size: 14 }), _jsx("span", { children: "Add an image" })] }), _jsx("div", { className: "froam-floating-bar__menu-divider" }), _jsxs("div", { className: "froam-floating-bar__menu-row", role: "group", "aria-label": "Opacity", children: [_jsx(Contrast, { size: 14 }), _jsx("span", { children: "Opacity" }), _jsx("input", { type: "range", min: 0, max: 100, value: Math.round(opacity * 100), "aria-label": "Opacity", onChange: (event) => setOpacity(Number(event.target.value) / 100) }), _jsxs("output", { children: [Math.round(opacity * 100), "%"] })] }), showType && _jsxs("button", { type: "button", role: "menuitemcheckbox", "aria-checked": Boolean(isStrike), onClick: () => act('strike'), children: [_jsx(Strikethrough, { size: 14 }), _jsx("span", { children: "Strikethrough" }), isStrike && _jsx(Check, { size: 13 })] }), _jsxs("button", { type: "button", role: "menuitem", onClick: () => act('clear-bg'), children: [_jsx(Eraser, { size: 14 }), _jsx("span", { children: "Remove fill" })] }), _jsxs("button", { type: "button", role: "menuitem", onClick: () => act('toggle-hidden'), children: [isHidden ? _jsx(Eye, { size: 14 }) : _jsx(EyeOff, { size: 14 }), _jsx("span", { children: isHidden ? 'Show element' : 'Hide element' })] }), _jsx("div", { className: "froam-floating-bar__menu-divider" }), _jsx("div", { className: "froam-floating-bar__menu-label", children: "Select" }), _jsxs("button", { type: "button", role: "menuitem", onClick: () => walk('parent'), children: [_jsx(CornerLeftUp, { size: 14 }), _jsx("span", { children: "Parent" })] }), _jsxs("button", { type: "button", role: "menuitem", onClick: () => walk('child'), children: [_jsx(CornerRightDown, { size: 14 }), _jsx("span", { children: "First inside" })] }), _jsxs("button", { type: "button", role: "menuitem", onClick: () => walk('prev'), children: [_jsx(ChevronLeft, { size: 14 }), _jsx("span", { children: "Previous" })] }), _jsxs("button", { type: "button", role: "menuitem", onClick: () => walk('next'), children: [_jsx(ChevronRight, { size: 14 }), _jsx("span", { children: "Next" })] }), _jsx("div", { className: "froam-floating-bar__menu-divider" }), _jsxs("button", { type: "button", role: "menuitem", onClick: () => act('bring-front'), children: [_jsx(BringToFront, { size: 14 }), _jsx("span", { children: "Bring to front" })] }), _jsxs("button", { type: "button", role: "menuitem", onClick: () => act('send-back'), children: [_jsx(SendToBack, { size: 14 }), _jsx("span", { children: "Send to back" })] }), _jsxs("button", { type: "button", role: "menuitem", title: selectionCount > 1 ? 'Merge selected into one movable stamp' : 'Merge this with overlapping sibling shapes', onClick: () => act('merge'), children: [_jsx(Combine, { size: 14 }), _jsx("span", { children: "Merge shapes" })] }), _jsxs("button", { type: "button", role: "menuitem", onClick: () => act('unmerge'), children: [_jsx(Ungroup, { size: 14 }), _jsx("span", { children: "Ungroup" })] }), _jsx("div", { className: "froam-floating-bar__menu-divider" }), _jsxs("button", { type: "button", role: "menuitem", className: "is-danger", onClick: () => act('delete'), children: [_jsx(Trash2, { size: 14 }), _jsx("span", { children: "Reset styles" })] })] })), openPop === 'palette' && (_jsxs("div", { className: `froam-floating-bar__pop is-anchored${menuUp ? ' is-up' : ''}`, style: docked ? undefined : { left: Math.max(4, menuLeft - 136) }, "data-chef-editor-root": "true", children: [_jsxs("div", { className: "froam-floating-bar__pop-head", children: [_jsx("span", { children: paletteMode === 'text' ? 'Text colour' : isTextLayer ? 'Text fill' : 'Fill' }), _jsxs("div", { className: "froam-floating-bar__pop-toggle", role: "group", "aria-label": "Apply as", children: [_jsx("button", { type: "button", className: paletteMode === 'fill' ? 'is-active' : '', onClick: () => setPaletteMode('fill'), children: isTextLayer ? 'Glyph' : 'Fill' }), showType && _jsx("button", { type: "button", className: paletteMode === 'text' ? 'is-active' : '', onClick: () => setPaletteMode('text'), children: "Text" })] })] }), _jsx("small", { className: "froam-floating-bar__pop-note", children: "From this page" }), _jsxs("div", { className: "froam-floating-bar__chips", children: [palette.map((hex) => {
                                const readable = paletteMode === 'text' && contrastRatio(hex, backgroundHex) >= 4.5;
                                return (_jsxs("button", { type: "button", className: "froam-floating-bar__chip", style: { '--froam-chip': hex }, title: `${hex}${readable ? ' — easy to read on this fill' : ''}`, onClick: () => applyChip(hex), children: [paletteMode === 'text' && _jsx("span", { style: { color: hex }, children: "Aa" }), readable && _jsx("i", { className: "froam-floating-bar__chip-ok" })] }, hex));
                            }), palette.length === 0 && _jsx("span", { className: "froam-floating-bar__pop-empty", children: "No colours found on this page yet" })] }), _jsxs("div", { className: "froam-floating-bar__pop-actions", children: [_jsxs("label", { className: "froam-floating-bar__custom-color", children: [_jsx("input", { type: "color", value: normalizeToHex(paletteMode === 'text' ? color : background) ?? '#000000', onChange: (event) => onAction(paletteMode === 'text' ? 'color' : 'bg-color', event.target.value) }), _jsx("span", { children: "Any colour\u2026" })] }), paletteMode === 'fill' && _jsxs("button", { type: "button", onClick: () => act('clear-bg'), children: [_jsx(Eraser, { size: 13 }), " No fill"] })] })] })), openPop === 'looks' && recipes && typeof document !== 'undefined' && createPortal(_jsxs("div", { className: "froam-floating-bar__pop froam-floating-bar__pop--looks", "data-chef-editor-root": "true", role: "dialog", "aria-label": "Look Studio live editor", style: lookDockStyle, children: [_jsxs("div", { className: "froam-floating-bar__pop-head", children: [_jsxs("span", { children: ["Styles ", _jsxs("small", { children: [lookCount, " ", isTextLayer ? 'text-safe ' : '', "looks \u00B7 live preview"] })] }), _jsxs("div", { className: "froam-floating-bar__look-window-actions", children: [_jsx("button", { type: "button", onClick: () => setLookDockSide((side) => side === 'left' ? 'right' : 'left'), title: "Move to the other side", "aria-label": "Move to the other side", children: lookDockSide === 'left' ? _jsx(ChevronRight, { size: 13 }) : _jsx(ChevronLeft, { size: 13 }) }), _jsx("button", { type: "button", className: "froam-floating-bar__look-apply", onClick: () => setOpenPop(null), children: "Done" })] })] }), _jsxs("label", { className: "froam-floating-bar__look-search", children: [_jsx(Search, { size: 13 }), _jsx("input", { value: lookSearch, onChange: (event) => setLookSearch(event.target.value), placeholder: "Search styles\u2026" })] }), _jsx("div", { className: "froam-floating-bar__look-groups", role: "tablist", "aria-label": "Look categories", children: ['All', ...LOOK_GROUPS].map((group) => (_jsx("button", { type: "button", role: "tab", "aria-selected": lookGroup === group, className: lookGroup === group ? 'is-active' : '', onClick: () => setLookGroup(group), children: group }, group))) }), _jsx("div", { className: "froam-floating-bar__looks-scroll", children: _jsxs("div", { className: "froam-floating-bar__looks", children: [visibleLooks.map((look) => (_jsxs("button", { type: "button", className: `${selectedLookName === look.name ? 'is-active' : ''}${aliveLooks.has(look.name) ? ' is-alive' : ''}`, onClick: () => applyLook(look), title: LOOK_NOTES[look.name] ?? `${look.group} · ${look.name}`, children: [_jsx("i", { style: look.swatch }), _jsx("span", { children: look.name }), _jsx("small", { children: look.group })] }, look.name))), visibleLooks.length === 0 && _jsxs("span", { className: "froam-floating-bar__pop-empty", children: ["No styles match \u201C", lookSearch, "\u201D"] })] }) }), _jsxs("div", { className: "froam-floating-bar__look-editor", children: [_jsxs("div", { className: "froam-floating-bar__look-editor-title", children: [_jsx(SlidersHorizontal, { size: 13 }), _jsxs("span", { children: ["Adjust ", selectedLook.name] })] }), _jsx("div", { className: "froam-floating-bar__look-states", role: "tablist", "aria-label": "Style state", children: ['base', 'hover', 'focus', 'active'].map((state) => _jsx("button", { type: "button", role: "tab", "aria-selected": lookState === state, className: lookState === state ? 'is-active' : '', onClick: () => setLookState(state), children: state === 'base' ? 'Normal' : state[0].toUpperCase() + state.slice(1) }, state)) }), _jsxs("div", { className: "froam-floating-bar__look-colors", children: [_jsxs("label", { title: "Accent used by accent-aware looks", children: [_jsx("span", { children: "Accent" }), _jsx("input", { type: "color", value: lookAccent, onChange: (event) => { const next = event.target.value; setLookAccent(next); applyLook(selectedLook, { accent: next }); } })] }), _jsxs("label", { className: overrideLookFill ? 'is-enabled' : '', children: [_jsx("input", { type: "checkbox", checked: overrideLookFill, onChange: (event) => { const next = event.target.checked; setOverrideLookFill(next); applyLook(selectedLook, { overrideFill: next }); } }), _jsx("span", { children: isTextLayer ? 'Glyph' : 'Fill' }), _jsx("input", { type: "color", value: lookFill, onChange: (event) => { const next = event.target.value; setLookFill(next); if (overrideLookFill)
                                                    applyLook(selectedLook, { fill: next }); }, disabled: !overrideLookFill })] }), _jsxs("label", { className: overrideLookText ? 'is-enabled' : '', children: [_jsx("input", { type: "checkbox", checked: overrideLookText, onChange: (event) => { const next = event.target.checked; setOverrideLookText(next); applyLook(selectedLook, { overrideText: next }); } }), _jsx("span", { children: "Text" }), _jsx("input", { type: "color", value: lookText, onChange: (event) => { const next = event.target.value; setLookText(next); if (overrideLookText)
                                                    applyLook(selectedLook, { text: next }); }, disabled: !overrideLookText })] })] }), !isTextLayer && _jsxs("label", { className: `froam-floating-bar__look-radius ${overrideLookRadius ? 'is-enabled' : ''}`, children: [_jsx("input", { type: "checkbox", checked: overrideLookRadius, onChange: (event) => { const next = event.target.checked; setOverrideLookRadius(next); applyLook(selectedLook, { overrideRadius: next }); } }), _jsx("span", { children: "Corner radius" }), _jsx("input", { type: "range", min: "0", max: "64", value: lookRadius, onChange: (event) => { const next = Number(event.target.value); setLookRadius(next); if (overrideLookRadius)
                                            applyLook(selectedLook, { radius: next }); }, disabled: !overrideLookRadius }), _jsxs("output", { children: [lookRadius, "px"] })] }), _jsx("p", { children: isTextLayer ? 'On text, box effects become glyph effects: fill, gradient, stroke and shadow stay on the words.' : 'Every style previews on the selected element as you pick it.' }), onSaveLook && _jsx("button", { type: "button", className: "froam-floating-bar__look-save", onClick: () => onSaveLook({ name: selectedLook.name, states: { ...lookStateDrafts, [lookState]: customizedLook(selectedLook).styles } }), children: "Save as a reusable style" })] })] }), document.body)] }));
}
//# sourceMappingURL=FroamFloatingBar.js.map