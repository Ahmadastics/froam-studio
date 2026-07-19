import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { AlignCenter, AlignJustify, AlignLeft, AlignRight, Bold, BringToFront, ChevronDown, ChevronLeft, ChevronRight, Combine, Contrast, Copy, CornerLeftUp, CornerRightDown, Eraser, Eye, EyeOff, Grid2X2, ImagePlus, Italic, Layers, LayoutTemplate, Maximize, Palette, SendToBack, Pipette, RectangleHorizontal, Rows3, Sparkles, Strikethrough, Trash2, Type, Underline, Undo2, Ungroup, } from 'lucide-react';
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
function pickAccent(palette) {
    return palette.find((hex) => {
        const lum = relativeLuminance(hex);
        return saturationOf(hex) > 0.35 && lum > 0.05 && lum < 0.8;
    }) ?? '#14b8a6';
}
const LOOKS = [
    {
        name: 'Lift',
        swatch: { background: '#1f2937', boxShadow: '0 4px 10px rgba(0,0,0,0.55)', borderRadius: 6 },
        styles: () => ({ boxShadow: '0 14px 34px rgba(0, 0, 0, 0.22)', borderRadius: '16px' }),
        patch: { borderRadiusTL: 16, borderRadiusTR: 16, borderRadiusBR: 16, borderRadiusBL: 16 },
    },
    {
        name: 'Glass',
        swatch: { background: 'rgba(255,255,255,0.14)', border: '1px solid rgba(255,255,255,0.4)', borderRadius: 6 },
        styles: () => ({
            background: 'rgba(255, 255, 255, 0.08)',
            backdropFilter: 'blur(14px)',
            border: '1px solid rgba(255, 255, 255, 0.18)',
            borderRadius: '16px',
        }),
        patch: { borderRadiusTL: 16, borderRadiusTR: 16, borderRadiusBR: 16, borderRadiusBL: 16 },
    },
    {
        name: 'Outline',
        swatch: { background: 'transparent', border: '1.5px solid currentColor', borderRadius: 6 },
        styles: () => ({ background: 'transparent', border: '1.5px solid currentColor', borderRadius: '12px' }),
    },
    {
        name: 'Pill',
        swatch: { background: '#334155', borderRadius: 999 },
        styles: () => ({ borderRadius: '999px', paddingTop: '10px', paddingBottom: '10px', paddingLeft: '20px', paddingRight: '20px' }),
        patch: { borderRadiusTL: 999, borderRadiusTR: 999, borderRadiusBR: 999, borderRadiusBL: 999 },
    },
    {
        name: 'Pop',
        swatch: { background: 'var(--fs-accent, #14b8a6)', borderRadius: 6 },
        styles: (accent) => ({ background: accent, color: '#ffffff', fontWeight: '700', borderRadius: '12px' }),
        patch: { fontWeight: '700' },
    },
    {
        name: 'Reset look',
        swatch: { background: 'transparent', border: '1px dashed rgba(255,255,255,0.35)', borderRadius: 6 },
        styles: () => ({ boxShadow: 'none', border: 'none', backdropFilter: 'none' }),
    },
];
function NumericField({ label, value, min, max, step = 1, unit, onChange, }) {
    const numericValue = Number.parseFloat(String(value)) || 0;
    const clamp = (next) => Math.min(max ?? Number.POSITIVE_INFINITY, Math.max(min ?? Number.NEGATIVE_INFINITY, next));
    const scrub = useScrub((steps) => onChange(clamp(numericValue + steps * step)), 6);
    return (_jsxs("label", { className: "froam-floating-bar__field froam-floating-bar__field--scrub", children: [_jsx("span", { ...scrub, style: { touchAction: 'none', cursor: 'ew-resize' }, children: label }), _jsxs("div", { className: "froam-floating-bar__number", children: [_jsx("input", { type: "number", value: numericValue, min: min, max: max, step: step, onChange: (event) => onChange(Number(event.target.value)) }), unit && _jsx("small", { children: unit })] })] }));
}
export default function FroamFloatingBar({ targetRect, visible, label, fontFamily, fontSize, fontWeight, lineHeight, letterSpacing, wordSpacing, textTransform, isBold, isItalic, isUnderline, isStrike, textAlign, color, background, width, height, display, flexDirection, justifyContent, alignItems, gap, padding, radius, overflow, opacity, isHidden = false, mixBlendMode, zIndex, fontOptions, selectionCount, docked = false, canUndo = false, onWalk, onAction, onStyle, }) {
    const barRef = useRef(null);
    const [expanded, setExpanded] = useState(false);
    const [narrow, setNarrow] = useState(false);
    const [position, setPosition] = useState({ left: 12, top: 12 });
    const [openPop, setOpenPop] = useState(null);
    const [palette, setPalette] = useState([]);
    const [paletteMode, setPaletteMode] = useState('fill');
    const fontScrub = useScrub((steps) => {
        const next = Math.min(400, Math.max(6, Math.round(fontSize) + steps));
        onStyle({ fontSize: `${next}px` }, { fontSize: next }, 'Changed font size');
    }, 8);
    // v4.1: opacity scrub — accumulate in a ref so fast drags don't lose steps to render lag
    const opacityRef = useRef(opacity);
    useEffect(() => { opacityRef.current = opacity; }, [opacity]);
    const opacityScrub = useScrub((steps) => {
        const next = Math.min(1, Math.max(0, Math.round((opacityRef.current + steps * 0.02) * 100) / 100));
        opacityRef.current = next;
        onStyle({ opacity: String(next) }, { opacity: next }, 'Changed opacity');
    }, 6);
    useLayoutEffect(() => {
        if (docked || !visible || !targetRect || !barRef.current)
            return;
        const placeBar = () => {
            const bar = barRef.current;
            if (!bar)
                return;
            const leftPanel = document.querySelector('.froam-figma-left')?.getBoundingClientRect();
            const rightPanel = document.querySelector('.froam-dp:not(.froam-sheet .froam-dp)')?.getBoundingClientRect();
            const safeLeft = leftPanel ? leftPanel.right + VIEWPORT_GAP : VIEWPORT_GAP;
            const safeRight = rightPanel ? rightPanel.left - VIEWPORT_GAP : window.innerWidth - VIEWPORT_GAP;
            const availableWidth = Math.max(280, safeRight - safeLeft);
            const nextNarrow = availableWidth < 760;
            bar.style.maxWidth = `${availableWidth}px`;
            bar.style.width = expanded ? `${Math.min(920, availableWidth)}px` : 'max-content';
            const constrainedRect = bar.getBoundingClientRect();
            const centeredLeft = targetRect.left + targetRect.width / 2 - constrainedRect.width / 2;
            const left = Math.min(Math.max(safeLeft, centeredLeft), Math.max(safeLeft, safeRight - constrainedRect.width));
            const above = targetRect.top - constrainedRect.height - TARGET_GAP;
            const below = targetRect.bottom + TARGET_GAP;
            const maxTop = Math.max(VIEWPORT_GAP, window.innerHeight - constrainedRect.height - VIEWPORT_GAP);
            const top = above >= VIEWPORT_GAP ? above : Math.min(below, maxTop);
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
    }, [docked, expanded, narrow, targetRect, visible]);
    if (!visible || !targetRect)
        return null;
    const cleanDimension = (value, fallback) => Number.parseFloat(value) || fallback;
    const widthValue = cleanDimension(width, targetRect.width);
    const heightValue = cleanDimension(height, targetRect.height);
    const backgroundHex = normalizeToHex(background) ?? '#0b0f14';
    function togglePop(which) {
        setOpenPop((current) => {
            const next = current === which ? null : which;
            if (next && palette.length === 0)
                setPalette(collectPagePalette());
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
    function applyLook(look) {
        const accent = pickAccent(palette.length ? palette : collectPagePalette());
        onStyle(look.styles(accent), look.patch, `Look: ${look.name}`);
        if ('vibrate' in navigator)
            navigator.vibrate?.(6);
        setOpenPop(null);
    }
    return (_jsxs("div", { ref: barRef, className: `froam-floating-bar ${expanded ? 'is-expanded' : ''} ${narrow ? 'is-narrow' : ''} ${docked ? 'is-docked' : ''}`, "data-chef-editor-root": "true", style: docked ? undefined : { left: position.left, top: position.top }, children: [_jsxs("div", { className: "froam-floating-bar__primary", children: [onWalk && (_jsxs("div", { className: "froam-floating-bar__group froam-floating-bar__walker", role: "group", "aria-label": "Walk selection", children: [_jsx("button", { type: "button", className: "froam-floating-bar__btn", title: "Select parent", onClick: () => onWalk('parent'), children: _jsx(CornerLeftUp, { size: 13 }) }), _jsx("button", { type: "button", className: "froam-floating-bar__btn", title: "Previous sibling", onClick: () => onWalk('prev'), children: _jsx(ChevronLeft, { size: 13 }) }), _jsx("button", { type: "button", className: "froam-floating-bar__btn", title: "Next sibling", onClick: () => onWalk('next'), children: _jsx(ChevronRight, { size: 13 }) }), _jsx("button", { type: "button", className: "froam-floating-bar__btn", title: "Select first child", onClick: () => onWalk('child'), children: _jsx(CornerRightDown, { size: 13 }) })] })), _jsxs("div", { className: "froam-floating-bar__identity", title: label, children: [_jsx(Type, { size: 13 }), _jsx("span", { children: label })] }), _jsx("button", { type: "button", className: "froam-floating-bar__btn froam-floating-bar__edit-text", title: "Edit text", onClick: () => onAction('edit-text'), children: _jsx("span", { className: "froam-floating-bar__aa", children: "Aa" }) }), _jsx("select", { className: "froam-floating-bar__select froam-floating-bar__font", value: fontFamily, title: "Font family", "aria-label": "Font family", onChange: (event) => onStyle({ fontFamily: event.target.value }, { fontFamily: event.target.value }, 'Changed font family'), children: fontOptions.map((font) => _jsx("option", { value: font.value, children: font.label }, font.value)) }), _jsxs("div", { className: "froam-floating-bar__stepper froam-floating-bar__stepper--scrub", title: "Font size \u2014 drag the number to scrub", ...fontScrub, style: { touchAction: 'none' }, children: [_jsx("button", { type: "button", onClick: () => onStyle({ fontSize: `${Math.max(6, fontSize - 1)}px` }, { fontSize: Math.max(6, fontSize - 1) }), children: "\u2212" }), _jsx("input", { type: "number", value: Math.round(fontSize), min: 6, max: 400, "aria-label": "Font size", onChange: (event) => {
                                    const next = Math.max(6, Number(event.target.value));
                                    onStyle({ fontSize: `${next}px` }, { fontSize: next }, 'Changed font size');
                                } }), _jsx("button", { type: "button", onClick: () => onStyle({ fontSize: `${Math.min(400, fontSize + 1)}px` }, { fontSize: Math.min(400, fontSize + 1) }), children: "+" })] }), _jsx("select", { className: "froam-floating-bar__select froam-floating-bar__weight", value: fontWeight, title: "Font weight", "aria-label": "Font weight", onChange: (event) => onStyle({ fontWeight: event.target.value }, { fontWeight: event.target.value }, 'Changed font weight'), children: ['300', '400', '500', '600', '700', '800', '900'].map((weight) => _jsx("option", { value: weight, children: weight }, weight)) }), _jsx("span", { className: "froam-floating-bar__sep" }), _jsxs("div", { className: "froam-floating-bar__group", children: [_jsx("button", { type: "button", className: `froam-floating-bar__btn ${isBold ? 'is-active' : ''}`, title: "Bold", onClick: () => onAction('bold'), children: _jsx(Bold, { size: 13 }) }), _jsx("button", { type: "button", className: `froam-floating-bar__btn ${isItalic ? 'is-active' : ''}`, title: "Italic", onClick: () => onAction('italic'), children: _jsx(Italic, { size: 13 }) }), _jsx("button", { type: "button", className: `froam-floating-bar__btn ${isUnderline ? 'is-active' : ''}`, title: "Underline", onClick: () => onAction('underline'), children: _jsx(Underline, { size: 13 }) }), _jsx("button", { type: "button", className: `froam-floating-bar__btn ${isStrike ? 'is-active' : ''}`, title: "Strikethrough", onClick: () => onAction('strike'), children: _jsx(Strikethrough, { size: 13 }) })] }), _jsx("span", { className: "froam-floating-bar__sep" }), _jsxs("div", { className: "froam-floating-bar__group", children: [_jsx("button", { type: "button", className: `froam-floating-bar__btn ${textAlign === 'left' || textAlign === 'start' ? 'is-active' : ''}`, title: "Align left", onClick: () => onAction('align-left'), children: _jsx(AlignLeft, { size: 13 }) }), _jsx("button", { type: "button", className: `froam-floating-bar__btn ${textAlign === 'center' ? 'is-active' : ''}`, title: "Align center", onClick: () => onAction('align-center'), children: _jsx(AlignCenter, { size: 13 }) }), _jsx("button", { type: "button", className: `froam-floating-bar__btn ${textAlign === 'right' || textAlign === 'end' ? 'is-active' : ''}`, title: "Align right", onClick: () => onAction('align-right'), children: _jsx(AlignRight, { size: 13 }) }), _jsx("button", { type: "button", className: `froam-floating-bar__btn ${textAlign === 'justify' ? 'is-active' : ''}`, title: "Justify", onClick: () => onAction('align-justify'), children: _jsx(AlignJustify, { size: 13 }) })] }), _jsx("span", { className: "froam-floating-bar__sep" }), _jsxs("div", { className: "froam-floating-bar__group", children: [_jsx("button", { type: "button", className: "froam-floating-bar__btn froam-floating-bar__btn--merge", title: selectionCount > 1 ? 'Merge selected into one movable stamp' : 'Merge this with overlapping sibling shapes', onClick: () => onAction('merge'), children: _jsx(Combine, { size: 13 }) }), _jsx("button", { type: "button", className: "froam-floating-bar__btn", title: "Ungroup merged stamp", onClick: () => onAction('unmerge'), children: _jsx(Ungroup, { size: 13 }) })] }), _jsx("span", { className: "froam-floating-bar__sep" }), _jsx("button", { type: "button", className: `froam-floating-bar__btn ${openPop === 'palette' ? 'is-active' : ''}`, title: "Page palette \u2014 colors from this site", onClick: () => togglePop('palette'), children: _jsx(Pipette, { size: 13 }) }), _jsx("button", { type: "button", className: `froam-floating-bar__btn ${openPop === 'looks' ? 'is-active' : ''}`, title: "Quick looks \u2014 one-tap styles", onClick: () => togglePop('looks'), children: _jsx(Sparkles, { size: 13 }) }), _jsxs("label", { className: "froam-floating-bar__color-btn", title: "Text color", style: { '--froam-swatch': color }, children: [_jsx(Type, { size: 11 }), _jsx("input", { type: "color", className: "froam-floating-bar__color-input", value: color, onChange: (event) => onAction('color', event.target.value) })] }), _jsxs("label", { className: "froam-floating-bar__color-btn", title: "Background", style: { '--froam-swatch': background }, children: [_jsx(Palette, { size: 11 }), _jsx("input", { type: "color", className: "froam-floating-bar__color-input", value: background, onChange: (event) => onAction('bg-color', event.target.value) })] }), _jsx("button", { type: "button", className: "froam-floating-bar__btn", title: "Clear fill", onClick: () => onAction('clear-bg'), children: _jsx(Eraser, { size: 13 }) }), _jsx("span", { className: "froam-floating-bar__sep" }), _jsxs("div", { className: "froam-floating-bar__opacity", title: "Opacity \u2014 drag to fade", ...opacityScrub, style: { touchAction: 'none' }, children: [_jsx(Contrast, { size: 13 }), _jsxs("span", { children: [Math.round(opacity * 100), "%"] })] }), _jsx("button", { type: "button", className: `froam-floating-bar__btn ${isHidden ? 'is-active' : ''}`, title: isHidden ? 'Show element' : 'Hide element', onClick: () => onAction('toggle-hidden'), children: isHidden ? _jsx(EyeOff, { size: 13 }) : _jsx(Eye, { size: 13 }) }), docked && (_jsxs(_Fragment, { children: [_jsx("span", { className: "froam-floating-bar__sep" }), _jsx("button", { type: "button", className: "froam-floating-bar__btn", title: "Undo", disabled: !canUndo, onClick: () => onAction('undo'), children: _jsx(Undo2, { size: 13 }) })] })), _jsxs("button", { type: "button", className: `froam-floating-bar__expand ${expanded ? 'is-active' : ''}`, onClick: () => setExpanded((current) => !current), "aria-expanded": expanded, title: "More typography and layout controls", children: [_jsx("span", { children: "More" }), _jsx(ChevronDown, { size: 13 })] })] }), openPop === 'palette' && (_jsxs("div", { className: "froam-floating-bar__pop", "data-chef-editor-root": "true", children: [_jsxs("div", { className: "froam-floating-bar__pop-head", children: [_jsx("span", { children: "Page palette" }), _jsxs("div", { className: "froam-floating-bar__pop-toggle", role: "group", "aria-label": "Apply as", children: [_jsx("button", { type: "button", className: paletteMode === 'fill' ? 'is-active' : '', onClick: () => setPaletteMode('fill'), children: "Fill" }), _jsx("button", { type: "button", className: paletteMode === 'text' ? 'is-active' : '', onClick: () => setPaletteMode('text'), children: "Text" })] })] }), _jsxs("div", { className: "froam-floating-bar__chips", children: [palette.map((hex) => {
                                const readable = paletteMode === 'text' && contrastRatio(hex, backgroundHex) >= 4.5;
                                return (_jsxs("button", { type: "button", className: "froam-floating-bar__chip", style: { '--froam-chip': hex }, title: `${hex}${readable ? ' — readable on current fill' : ''}`, onClick: () => applyChip(hex), children: [paletteMode === 'text' && _jsx("span", { style: { color: hex }, children: "Aa" }), readable && _jsx("i", { className: "froam-floating-bar__chip-ok" })] }, hex));
                            }), palette.length === 0 && _jsx("span", { className: "froam-floating-bar__pop-empty", children: "No colors found yet" })] })] })), openPop === 'looks' && (_jsxs("div", { className: "froam-floating-bar__pop", "data-chef-editor-root": "true", children: [_jsx("div", { className: "froam-floating-bar__pop-head", children: _jsx("span", { children: "Quick looks" }) }), _jsx("div", { className: "froam-floating-bar__looks", children: LOOKS.map((look) => (_jsxs("button", { type: "button", onClick: () => applyLook(look), children: [_jsx("i", { style: look.swatch }), _jsx("span", { children: look.name })] }, look.name))) })] })), expanded && (_jsxs("div", { className: "froam-floating-bar__advanced", children: [_jsxs("section", { children: [_jsxs("header", { children: [_jsx(Type, { size: 13 }), " Typography"] }), _jsxs("div", { className: "froam-floating-bar__fields", children: [_jsx(NumericField, { label: "Line", value: lineHeight, min: 0.5, max: 5, step: 0.05, onChange: (next) => onStyle({ lineHeight: String(next) }, { lineHeight: next }, 'Changed line height') }), _jsx(NumericField, { label: "Tracking", value: letterSpacing, min: -20, max: 100, step: 0.1, unit: "px", onChange: (next) => onStyle({ letterSpacing: `${next}px` }, { letterSpacing: next }, 'Changed letter spacing') }), _jsx(NumericField, { label: "Words", value: wordSpacing, min: -20, max: 100, step: 0.5, unit: "px", onChange: (next) => onStyle({ wordSpacing: `${next}px` }, { wordSpacing: next }, 'Changed word spacing') }), _jsxs("label", { className: "froam-floating-bar__field", children: [_jsx("span", { children: "Case" }), _jsxs("select", { value: textTransform, onChange: (event) => onStyle({ textTransform: event.target.value }, { textTransform: event.target.value }, 'Changed text case'), children: [_jsx("option", { value: "none", children: "Original" }), _jsx("option", { value: "uppercase", children: "UPPER" }), _jsx("option", { value: "lowercase", children: "lower" }), _jsx("option", { value: "capitalize", children: "Title" })] })] })] })] }), _jsxs("section", { children: [_jsxs("header", { children: [_jsx(Maximize, { size: 13 }), " Size & shape"] }), _jsxs("div", { className: "froam-floating-bar__fields", children: [_jsx(NumericField, { label: "Width", value: widthValue, min: 1, max: 5000, unit: "px", onChange: (next) => onStyle({ width: `${next}px` }, { width: `${next}px` }, 'Changed width') }), _jsx(NumericField, { label: "Height", value: heightValue, min: 1, max: 5000, unit: "px", onChange: (next) => onStyle({ height: `${next}px` }, { height: `${next}px` }, 'Changed height') }), _jsx(NumericField, { label: "Padding", value: padding, min: 0, max: 400, unit: "px", onChange: (next) => onStyle({ padding: `${next}px` }, { paddingTop: next, paddingRight: next, paddingBottom: next, paddingLeft: next }, 'Changed padding') }), _jsx(NumericField, { label: "Radius", value: radius, min: 0, max: 1000, unit: "px", onChange: (next) => onStyle({ borderRadius: `${next}px` }, { borderRadiusTL: next, borderRadiusTR: next, borderRadiusBR: next, borderRadiusBL: next }, 'Changed radius') })] }), _jsxs("div", { className: "froam-floating-bar__preset-row", children: [_jsx("button", { type: "button", onClick: () => onStyle({ width: 'auto' }, { width: 'auto' }, 'Width: auto'), children: "Auto W" }), _jsx("button", { type: "button", onClick: () => onStyle({ height: 'auto' }, { height: 'auto' }, 'Height: auto'), children: "Auto H" }), _jsx("button", { type: "button", onClick: () => onStyle({ width: '100%', maxWidth: '100%' }, { width: '100%', maxWidth: '100%' }, 'Fill parent'), children: "Fill" }), _jsx("button", { type: "button", onClick: () => onStyle({ width: 'max-content', height: 'auto', maxWidth: '100%' }, { width: 'max-content', height: 'auto' }, 'Hug content'), children: "Hug" })] })] }), _jsxs("section", { children: [_jsxs("header", { children: [_jsx(LayoutTemplate, { size: 13 }), " Layout"] }), _jsxs("div", { className: "froam-floating-bar__segmented", children: [_jsxs("button", { type: "button", className: display === 'block' ? 'is-active' : '', onClick: () => onStyle({ display: 'block' }, { display: 'block' }, 'Layout: block'), children: [_jsx(RectangleHorizontal, { size: 13 }), " Block"] }), _jsxs("button", { type: "button", className: display.includes('flex') ? 'is-active' : '', onClick: () => onStyle({ display: 'flex' }, { display: 'flex' }, 'Layout: flex'), children: [_jsx(Rows3, { size: 13 }), " Flex"] }), _jsxs("button", { type: "button", className: display === 'grid' ? 'is-active' : '', onClick: () => onStyle({ display: 'grid' }, { display: 'grid' }, 'Layout: grid'), children: [_jsx(Grid2X2, { size: 13 }), " Grid"] })] }), _jsxs("div", { className: "froam-floating-bar__fields", children: [_jsxs("label", { className: "froam-floating-bar__field", children: [_jsx("span", { children: "Direction" }), _jsxs("select", { value: flexDirection, onChange: (event) => onStyle({ display: 'flex', flexDirection: event.target.value }, { display: 'flex', flexDirection: event.target.value }, 'Changed flex direction'), children: [_jsx("option", { value: "row", children: "Row" }), _jsx("option", { value: "column", children: "Column" }), _jsx("option", { value: "row-reverse", children: "Row reverse" }), _jsx("option", { value: "column-reverse", children: "Column reverse" })] })] }), _jsxs("label", { className: "froam-floating-bar__field", children: [_jsx("span", { children: "Justify" }), _jsxs("select", { value: justifyContent, onChange: (event) => onStyle({ justifyContent: event.target.value }, { justifyContent: event.target.value }, 'Changed distribution'), children: [_jsx("option", { value: "flex-start", children: "Start" }), _jsx("option", { value: "center", children: "Center" }), _jsx("option", { value: "flex-end", children: "End" }), _jsx("option", { value: "space-between", children: "Between" }), _jsx("option", { value: "space-around", children: "Around" }), _jsx("option", { value: "space-evenly", children: "Evenly" })] })] }), _jsxs("label", { className: "froam-floating-bar__field", children: [_jsx("span", { children: "Align" }), _jsxs("select", { value: alignItems, onChange: (event) => onStyle({ alignItems: event.target.value }, { alignItems: event.target.value }, 'Changed alignment'), children: [_jsx("option", { value: "stretch", children: "Stretch" }), _jsx("option", { value: "flex-start", children: "Start" }), _jsx("option", { value: "center", children: "Center" }), _jsx("option", { value: "flex-end", children: "End" }), _jsx("option", { value: "baseline", children: "Baseline" })] })] }), _jsx(NumericField, { label: "Gap", value: gap, min: 0, max: 400, unit: "px", onChange: (next) => onStyle({ gap: `${next}px` }, { gap: next }, 'Changed gap') }), _jsxs("label", { className: "froam-floating-bar__field", children: [_jsx("span", { children: "Overflow" }), _jsxs("select", { value: overflow, onChange: (event) => onStyle({ overflow: event.target.value }, { overflow: event.target.value }, 'Changed overflow'), children: [_jsx("option", { value: "visible", children: "Visible" }), _jsx("option", { value: "hidden", children: "Hidden" }), _jsx("option", { value: "auto", children: "Auto" }), _jsx("option", { value: "scroll", children: "Scroll" })] })] })] })] }), _jsxs("section", { children: [_jsxs("header", { children: [_jsx(Layers, { size: 13 }), " Depth & blend"] }), _jsxs("div", { className: "froam-floating-bar__fields", children: [_jsx(NumericField, { label: "Z-index", value: zIndex, min: -999, max: 9999, onChange: (next) => onStyle({ zIndex: String(next) }, { zIndex: next }, 'Changed z-index') }), _jsxs("label", { className: "froam-floating-bar__field", children: [_jsx("span", { children: "Blend" }), _jsxs("select", { value: mixBlendMode, onChange: (event) => onStyle({ mixBlendMode: event.target.value }, { mixBlendMode: event.target.value }, 'Changed blend mode'), children: [_jsx("option", { value: "normal", children: "Normal" }), _jsx("option", { value: "multiply", children: "Multiply" }), _jsx("option", { value: "screen", children: "Screen" }), _jsx("option", { value: "overlay", children: "Overlay" }), _jsx("option", { value: "darken", children: "Darken" }), _jsx("option", { value: "lighten", children: "Lighten" }), _jsx("option", { value: "color-dodge", children: "Color dodge" }), _jsx("option", { value: "color-burn", children: "Color burn" }), _jsx("option", { value: "hard-light", children: "Hard light" }), _jsx("option", { value: "soft-light", children: "Soft light" }), _jsx("option", { value: "difference", children: "Difference" }), _jsx("option", { value: "exclusion", children: "Exclusion" }), _jsx("option", { value: "hue", children: "Hue" }), _jsx("option", { value: "saturation", children: "Saturation" }), _jsx("option", { value: "color", children: "Color" }), _jsx("option", { value: "luminosity", children: "Luminosity" })] })] })] }), _jsxs("div", { className: "froam-floating-bar__preset-row", children: [_jsxs("button", { type: "button", onClick: () => onAction('bring-front'), children: [_jsx(BringToFront, { size: 12 }), " Front"] }), _jsxs("button", { type: "button", onClick: () => onAction('send-back'), children: [_jsx(SendToBack, { size: 12 }), " Back"] })] })] }), _jsxs("section", { className: "froam-floating-bar__actions", children: [_jsxs("button", { type: "button", onClick: () => onAction('image'), children: [_jsx(ImagePlus, { size: 13 }), " Image"] }), _jsxs("button", { type: "button", onClick: () => onAction('duplicate'), children: [_jsx(Copy, { size: 13 }), " Duplicate"] }), _jsxs("button", { type: "button", className: "is-danger", onClick: () => onAction('delete'), children: [_jsx(Trash2, { size: 13 }), " Reset styles"] })] })] }))] }));
}
//# sourceMappingURL=FroamFloatingBar.js.map