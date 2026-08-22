import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { AlignCenter, AlignJustify, AlignLeft, AlignRight, Bold, BringToFront, ChevronDown, ChevronLeft, ChevronRight, Combine, Contrast, Copy, CornerLeftUp, CornerRightDown, Eraser, Eye, EyeOff, Grid2X2, ImagePlus, Italic, Layers, LayoutTemplate, Maximize, Palette, SendToBack, Pipette, RectangleHorizontal, Rows3, Search, SlidersHorizontal, Sparkles, Strikethrough, Trash2, Type, Underline, Undo2, Ungroup, } from 'lucide-react';
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
/* ─── v4: quick looks — one-tap style recipes ─── */
/* v4.8: expanded from 6 → 40+ recipes, grouped for browsing. Every look's
   `styles` is applied live via setProperty (camelCase → kebab) and compiles
   verbatim to froam.generated.css, so anything valid here ships. Looks are
   accent-aware: `accent` is the site's own picked accent, and color-mix
   derives shades from it so recipes fit whatever palette they land on. */
const LOOK_GROUPS = ['Depth', 'Surface', 'Texture', 'Shape', 'Line', 'Accent', 'Type', 'Effect', 'Bold', 'Reset'];
// Uniform corner-radius patch so the editor's own radius controls stay in sync.
const corners = (n) => ({ borderRadiusTL: n, borderRadiusTR: n, borderRadiusBR: n, borderRadiusBL: n });
const LOOKS = [
    /* ─── Depth — shadows & elevation ─── */
    {
        name: 'Lift',
        group: 'Depth',
        swatch: { background: '#1f2937', boxShadow: '0 4px 10px rgba(0,0,0,0.55)', borderRadius: 6 },
        styles: () => ({ boxShadow: '0 14px 34px rgba(0, 0, 0, 0.22)', borderRadius: '16px' }),
        patch: corners(16),
    },
    {
        name: 'Float',
        group: 'Depth',
        swatch: { background: '#1f2937', boxShadow: '0 8px 12px -4px rgba(0,0,0,0.8)', borderRadius: 8 },
        styles: () => ({ boxShadow: '0 30px 60px -24px rgba(0, 0, 0, 0.5)', borderRadius: '20px' }),
        patch: corners(20),
    },
    {
        name: 'Soft',
        group: 'Depth',
        swatch: { background: '#e8ecf3', boxShadow: '3px 3px 6px rgba(163,177,198,0.7), -3px -3px 6px #ffffff', borderRadius: 8 },
        styles: () => ({
            background: '#e8ecf3',
            color: '#334155',
            border: 'none',
            boxShadow: '10px 10px 22px rgba(163, 177, 198, 0.55), -10px -10px 22px rgba(255, 255, 255, 0.9)',
            borderRadius: '20px',
        }),
        patch: corners(20),
    },
    {
        name: 'Inset',
        group: 'Depth',
        swatch: { background: '#1f2937', boxShadow: 'inset 0 2px 6px rgba(0,0,0,0.7)', borderRadius: 6 },
        styles: () => ({ boxShadow: 'inset 0 2px 10px rgba(0, 0, 0, 0.28)', borderRadius: '12px' }),
        patch: corners(12),
    },
    {
        name: 'Ring',
        group: 'Depth',
        swatch: { background: '#1f2937', boxShadow: '0 0 0 3px rgba(20,184,166,0.5)', borderRadius: 6 },
        styles: (accent) => ({ boxShadow: `0 0 0 3px color-mix(in srgb, ${accent} 40%, transparent)`, borderRadius: '12px' }),
        patch: corners(12),
    },
    {
        name: 'Glow',
        group: 'Depth',
        swatch: { background: '#1f2937', boxShadow: '0 0 10px 2px rgba(20,184,166,0.7)', borderRadius: 6 },
        styles: (accent) => ({ boxShadow: `0 0 26px color-mix(in srgb, ${accent} 55%, transparent)`, borderRadius: '14px' }),
        patch: corners(14),
    },
    /* ─── Surface — fills & materials ─── */
    {
        name: 'Glass',
        group: 'Surface',
        swatch: { background: 'rgba(255,255,255,0.14)', border: '1px solid rgba(255,255,255,0.4)', borderRadius: 6 },
        styles: () => ({
            background: 'rgba(255, 255, 255, 0.08)',
            backdropFilter: 'blur(14px)',
            border: '1px solid rgba(255, 255, 255, 0.18)',
            borderRadius: '16px',
        }),
        patch: corners(16),
    },
    {
        name: 'Frost',
        group: 'Surface',
        swatch: { background: 'rgba(255,255,255,0.55)', border: '1px solid rgba(255,255,255,0.8)', borderRadius: 6 },
        styles: () => ({
            background: 'rgba(255, 255, 255, 0.6)',
            backdropFilter: 'blur(10px)',
            border: '1px solid rgba(255, 255, 255, 0.7)',
            color: '#0b0f14',
            borderRadius: '16px',
        }),
        patch: corners(16),
    },
    {
        name: 'Ink',
        group: 'Surface',
        swatch: { background: '#0b0f14', borderRadius: 6 },
        styles: () => ({ background: '#0b0f14', color: '#ffffff', borderRadius: '14px' }),
        patch: corners(14),
    },
    {
        name: 'Paper',
        group: 'Surface',
        swatch: { background: '#faf7f0', border: '1px solid rgba(0,0,0,0.1)', borderRadius: 6 },
        styles: () => ({ background: '#faf7f0', color: '#1f2430', border: '1px solid rgba(0, 0, 0, 0.06)', borderRadius: '12px' }),
        patch: corners(12),
    },
    {
        name: 'Slate',
        group: 'Surface',
        swatch: { background: '#1e293b', borderRadius: 6 },
        styles: () => ({ background: '#1e293b', color: '#e2e8f0', borderRadius: '14px' }),
        patch: corners(14),
    },
    {
        name: 'Tint',
        group: 'Surface',
        swatch: { background: 'rgba(20,184,166,0.22)', border: '1px solid rgba(20,184,166,0.5)', borderRadius: 6 },
        styles: (accent) => ({ background: `color-mix(in srgb, ${accent} 14%, transparent)`, color: accent, borderRadius: '12px' }),
        patch: corners(12),
    },
    /* ─── Shape — corners & geometry ─── */
    {
        name: 'Pill',
        group: 'Shape',
        swatch: { background: '#334155', borderRadius: 999 },
        styles: () => ({ borderRadius: '999px', paddingTop: '10px', paddingBottom: '10px', paddingLeft: '20px', paddingRight: '20px' }),
        patch: corners(999),
    },
    {
        name: 'Slab',
        group: 'Shape',
        swatch: { background: '#334155', borderRadius: 0 },
        styles: () => ({ borderRadius: '0px' }),
        patch: corners(0),
    },
    {
        name: 'Squircle',
        group: 'Shape',
        swatch: { background: '#334155', borderRadius: 10 },
        styles: () => ({ borderRadius: '28px' }),
        patch: corners(28),
    },
    {
        name: 'Blob',
        group: 'Shape',
        swatch: { background: '#334155', borderRadius: '42% 58% 63% 37% / 41% 44% 56% 59%' },
        styles: () => ({ borderRadius: '42% 58% 63% 37% / 41% 44% 56% 59%' }),
    },
    {
        name: 'Bevel',
        group: 'Shape',
        swatch: { background: '#334155', clipPath: 'polygon(6px 0,100% 0,100% calc(100% - 6px),calc(100% - 6px) 100%,0 100%,0 6px)' },
        styles: () => ({ clipPath: 'polygon(12px 0, 100% 0, 100% calc(100% - 12px), calc(100% - 12px) 100%, 0 100%, 0 12px)' }),
    },
    {
        name: 'Tag',
        group: 'Shape',
        swatch: { background: '#334155', clipPath: 'polygon(0 0, calc(100% - 8px) 0, 100% 50%, calc(100% - 8px) 100%, 0 100%)' },
        styles: () => ({ clipPath: 'polygon(0 0, calc(100% - 16px) 0, 100% 50%, calc(100% - 16px) 100%, 0 100%)' }),
    },
    {
        name: 'Arch',
        group: 'Shape',
        swatch: { background: '#334155', borderRadius: '12px 12px 3px 3px' },
        styles: () => ({ borderRadius: '999px 999px 12px 12px' }),
        patch: { borderRadiusTL: 999, borderRadiusTR: 999, borderRadiusBR: 12, borderRadiusBL: 12 },
    },
    {
        name: 'Leaf',
        group: 'Shape',
        swatch: { background: '#334155', borderRadius: '2px 12px 2px 12px' },
        styles: () => ({ borderRadius: '4px 32px 4px 32px' }),
        patch: { borderRadiusTL: 4, borderRadiusTR: 32, borderRadiusBR: 4, borderRadiusBL: 32 },
    },
    /* ─── Line — borders & rules ─── */
    {
        name: 'Outline',
        group: 'Line',
        swatch: { background: 'transparent', border: '1.5px solid currentColor', borderRadius: 6 },
        styles: () => ({ background: 'transparent', border: '1.5px solid currentColor', borderRadius: '12px' }),
        patch: corners(12),
    },
    {
        name: 'Hairline',
        group: 'Line',
        swatch: { background: 'transparent', border: '1px solid rgba(148,163,184,0.6)', borderRadius: 6 },
        styles: () => ({ background: 'transparent', border: '1px solid rgba(128, 128, 128, 0.35)', borderRadius: '12px' }),
        patch: corners(12),
    },
    {
        name: 'Dashed',
        group: 'Line',
        swatch: { background: 'transparent', border: '1.5px dashed #14b8a6', borderRadius: 6 },
        styles: (accent) => ({ background: 'transparent', border: `2px dashed ${accent}`, borderRadius: '12px' }),
        patch: corners(12),
    },
    {
        name: 'Double',
        group: 'Line',
        swatch: { background: 'transparent', border: '3px double #14b8a6', borderRadius: 5 },
        styles: (accent) => ({ background: 'transparent', border: `3px double ${accent}`, borderRadius: '10px' }),
        patch: corners(10),
    },
    {
        name: 'Underline',
        group: 'Line',
        swatch: { background: 'transparent', borderBottom: '3px solid #14b8a6', borderRadius: 0 },
        styles: (accent) => ({ borderBottom: `3px solid ${accent}`, paddingBottom: '4px' }),
    },
    /* ─── Accent — colour & gradients ─── */
    {
        name: 'Pop',
        group: 'Accent',
        swatch: { background: 'var(--fs-accent, #14b8a6)', borderRadius: 6 },
        styles: (accent) => ({ background: accent, color: '#ffffff', fontWeight: '700', borderRadius: '12px' }),
        patch: { ...corners(12), fontWeight: '700' },
    },
    {
        name: 'Gradient',
        group: 'Accent',
        swatch: { background: 'linear-gradient(135deg,#14b8a6,#0f766e)', borderRadius: 6 },
        styles: (accent) => ({
            background: `linear-gradient(135deg, ${accent}, color-mix(in srgb, ${accent} 55%, #000))`,
            color: '#ffffff',
            fontWeight: '600',
            border: 'none',
            borderRadius: '12px',
        }),
        patch: { ...corners(12), fontWeight: '600' },
    },
    {
        name: 'Sunset',
        group: 'Accent',
        swatch: { background: 'linear-gradient(135deg,#ff8a00,#ff2d75)', borderRadius: 6 },
        styles: () => ({ background: 'linear-gradient(135deg, #ff8a00, #ff2d75)', color: '#ffffff', border: 'none', borderRadius: '14px' }),
        patch: corners(14),
    },
    {
        name: 'Aurora',
        group: 'Accent',
        swatch: { background: 'linear-gradient(120deg,#6ee7b7,#3b82f6,#a855f7)', borderRadius: 6 },
        styles: () => ({ background: 'linear-gradient(120deg, #6ee7b7, #3b82f6, #a855f7)', color: '#ffffff', border: 'none', borderRadius: '14px' }),
        patch: corners(14),
    },
    {
        name: 'Ocean',
        group: 'Accent',
        swatch: { background: 'linear-gradient(160deg,#0ea5e9,#2563eb)', borderRadius: 6 },
        styles: () => ({ background: 'linear-gradient(160deg, #0ea5e9, #2563eb)', color: '#ffffff', border: 'none', borderRadius: '14px' }),
        patch: corners(14),
    },
    {
        name: 'Candy',
        group: 'Accent',
        swatch: { background: 'linear-gradient(135deg,#f472b6,#a78bfa)', borderRadius: 6 },
        styles: () => ({ background: 'linear-gradient(135deg, #f472b6, #a78bfa)', color: '#ffffff', border: 'none', borderRadius: '16px' }),
        patch: corners(16),
    },
    {
        name: 'Mesh',
        group: 'Accent',
        swatch: { background: 'radial-gradient(at 20% 20%,#a78bfa,transparent 60%),radial-gradient(at 80% 30%,#f472b6,transparent 55%),#0b1220', borderRadius: 6 },
        styles: () => ({
            background: 'radial-gradient(at 18% 20%, rgba(167, 139, 250, 0.55), transparent 55%), radial-gradient(at 82% 12%, rgba(244, 114, 182, 0.5), transparent 50%), radial-gradient(at 60% 92%, rgba(56, 189, 248, 0.5), transparent 55%), #0b1220',
            color: '#ffffff',
            border: 'none',
            borderRadius: '16px',
        }),
        patch: corners(16),
    },
    /* ─── Type — text treatments ─── */
    {
        name: 'Grad Text',
        group: 'Type',
        swatch: { background: 'linear-gradient(120deg,#22d3ee,#a78bfa,#f472b6)', borderRadius: 6 },
        styles: (accent) => ({
            backgroundImage: `linear-gradient(120deg, ${accent}, color-mix(in srgb, ${accent} 45%, #7c3aed))`,
            WebkitBackgroundClip: 'text',
            backgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            color: accent,
            fontWeight: '800',
        }),
        patch: { fontWeight: '800' },
    },
    {
        name: 'Eyebrow',
        group: 'Type',
        swatch: { background: 'repeating-linear-gradient(90deg,#94a3b8 0 4px,transparent 4px 7px)', borderRadius: 2 },
        styles: (accent) => ({ textTransform: 'uppercase', letterSpacing: '0.18em', fontWeight: '600', fontSize: '0.78em', color: accent }),
        patch: { fontWeight: '600' },
    },
    {
        name: 'Display',
        group: 'Type',
        swatch: { background: '#cbd5e1', borderRadius: 3 },
        styles: () => ({ fontWeight: '800', letterSpacing: '-0.02em', lineHeight: '1.03' }),
        patch: { fontWeight: '800' },
    },
    {
        name: 'Marker',
        group: 'Type',
        swatch: { background: 'rgba(20,184,166,0.4)', borderRadius: 3 },
        styles: (accent) => ({ background: `color-mix(in srgb, ${accent} 32%, transparent)`, paddingLeft: '4px', paddingRight: '4px', borderRadius: '4px' }),
    },
    {
        name: 'Quiet',
        group: 'Type',
        swatch: { background: 'rgba(148,163,184,0.35)', borderRadius: 4 },
        styles: () => ({ opacity: '0.6', fontWeight: '400' }),
        patch: { opacity: 0.6 },
    },
    /* ─── Bold — brutalist & sticker ─── */
    {
        name: 'Sticker',
        group: 'Bold',
        swatch: { background: '#f472b6', border: '2px solid #fff', boxShadow: '0 3px 7px rgba(0,0,0,0.4)', borderRadius: 6 },
        styles: () => ({ background: '#ffffff', color: '#0b0f14', border: '4px solid #ffffff', boxShadow: '0 6px 18px rgba(0, 0, 0, 0.28)', borderRadius: '16px' }),
        patch: corners(16),
    },
    {
        name: 'Brutal',
        group: 'Bold',
        swatch: { background: '#fde047', border: '1.5px solid #000', boxShadow: '3px 3px 0 #000', borderRadius: 0 },
        styles: () => ({ background: '#ffffff', color: '#0b0f14', border: '2px solid #0b0f14', boxShadow: '6px 6px 0 #0b0f14', borderRadius: '0px', fontWeight: '700' }),
        patch: { ...corners(0), fontWeight: '700' },
    },
    {
        name: 'Comic',
        group: 'Bold',
        swatch: { background: '#fff', border: '1.5px solid #000', boxShadow: '2.5px 2.5px 0 rgba(0,0,0,0.9)', borderRadius: 5 },
        styles: () => ({ background: '#ffffff', color: '#0b0f14', border: '3px solid #0b0f14', boxShadow: '5px 5px 0 rgba(11, 15, 20, 0.9)', borderRadius: '14px', fontWeight: '700' }),
        patch: { ...corners(14), fontWeight: '700' },
    },
    {
        name: 'Retro',
        group: 'Bold',
        swatch: { background: '#fff', border: '1.5px solid #0b0f14', boxShadow: '3px 3px 0 #14b8a6', borderRadius: 4 },
        styles: (accent) => ({ background: '#ffffff', color: '#0b0f14', border: '2px solid #0b0f14', boxShadow: `5px 5px 0 ${accent}`, borderRadius: '10px' }),
        patch: corners(10),
    },
    /* ─── v4.9.1: second wave. Grouped by `group` (render order follows
       LOOK_GROUPS), so physical position here doesn't affect where they land. ─── */
    // Depth
    {
        name: 'Layered',
        group: 'Depth',
        swatch: { background: '#1f2937', boxShadow: '0 1px 1px rgba(0,0,0,.5),0 3px 3px rgba(0,0,0,.4)', borderRadius: 6 },
        styles: () => ({ boxShadow: '0 1px 1px rgba(0,0,0,.06), 0 2px 2px rgba(0,0,0,.06), 0 4px 4px rgba(0,0,0,.06), 0 8px 8px rgba(0,0,0,.06), 0 16px 16px rgba(0,0,0,.06)', borderRadius: '14px' }),
        patch: corners(14),
    },
    {
        name: 'Halo',
        group: 'Depth',
        swatch: { background: '#1f2937', boxShadow: '0 0 0 5px rgba(20,184,166,0.25)', borderRadius: 6 },
        styles: (accent) => ({ boxShadow: `0 0 0 6px color-mix(in srgb, ${accent} 16%, transparent)`, borderRadius: '14px' }),
        patch: corners(14),
    },
    // Surface
    {
        name: 'Sheen',
        group: 'Surface',
        swatch: { background: 'linear-gradient(180deg,rgba(255,255,255,0.35),rgba(255,255,255,0) 45%),#1f2937', borderRadius: 6 },
        styles: () => ({ background: 'linear-gradient(180deg, rgba(255,255,255,0.14), rgba(255,255,255,0) 42%), #1f2937', color: '#f8fafc', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '14px' }),
        patch: corners(14),
    },
    {
        name: 'Cream',
        group: 'Surface',
        swatch: { background: '#fff7ed', border: '1px solid rgba(124,45,18,0.2)', borderRadius: 6 },
        styles: () => ({ background: '#fff7ed', color: '#7c2d12', border: '1px solid rgba(124, 45, 18, 0.12)', borderRadius: '14px' }),
        patch: corners(14),
    },
    // Texture
    {
        name: 'Stripes',
        group: 'Texture',
        swatch: { background: 'repeating-linear-gradient(45deg,rgba(20,184,166,0.4) 0 3px,#fff 3px 6px)', borderRadius: 6 },
        styles: (accent) => ({ background: `repeating-linear-gradient(45deg, color-mix(in srgb, ${accent} 12%, transparent) 0 10px, transparent 10px 20px), #ffffff`, color: '#0b0f14', borderRadius: '12px' }),
        patch: corners(12),
    },
    {
        name: 'Dots',
        group: 'Texture',
        swatch: { background: 'radial-gradient(rgba(20,184,166,0.6) 1px,#fff 1.1px) 0 0/5px 5px', borderRadius: 6 },
        styles: (accent) => ({ background: `radial-gradient(color-mix(in srgb, ${accent} 26%, transparent) 1.5px, transparent 1.6px) 0 0 / 12px 12px, #ffffff`, color: '#0b0f14', borderRadius: '12px' }),
        patch: corners(12),
    },
    {
        name: 'Grid',
        group: 'Texture',
        swatch: { background: 'linear-gradient(rgba(20,184,166,0.5) 1px,transparent 1px) 0 0/6px 6px,linear-gradient(90deg,rgba(20,184,166,0.5) 1px,transparent 1px) 0 0/6px 6px,#0b1220', borderRadius: 6 },
        styles: (accent) => ({ background: `linear-gradient(color-mix(in srgb, ${accent} 20%, transparent) 1px, transparent 1px) 0 0 / 16px 16px, linear-gradient(90deg, color-mix(in srgb, ${accent} 20%, transparent) 1px, transparent 1px) 0 0 / 16px 16px, #0b1220`, color: '#e2e8f0', borderRadius: '12px' }),
        patch: corners(12),
    },
    {
        name: 'Spotlight',
        group: 'Texture',
        swatch: { background: 'radial-gradient(120% 90% at 50% -10%,rgba(20,184,166,0.6),transparent 62%),#0b1220', borderRadius: 6 },
        styles: (accent) => ({ background: `radial-gradient(120% 90% at 50% -10%, color-mix(in srgb, ${accent} 34%, transparent), transparent 62%), #0b1220`, color: '#f8fafc', borderRadius: '16px' }),
        patch: corners(16),
    },
    // Shape
    {
        name: 'Chamfer',
        group: 'Shape',
        swatch: { background: '#334155', clipPath: 'polygon(6px 0,calc(100% - 6px) 0,100% 6px,100% calc(100% - 6px),calc(100% - 6px) 100%,6px 100%,0 calc(100% - 6px),0 6px)' },
        styles: () => ({ clipPath: 'polygon(14px 0, calc(100% - 14px) 0, 100% 14px, 100% calc(100% - 14px), calc(100% - 14px) 100%, 14px 100%, 0 calc(100% - 14px), 0 14px)' }),
    },
    {
        name: 'Ticket',
        group: 'Shape',
        swatch: { background: '#334155', clipPath: 'polygon(0 0,100% 0,100% 38%,90% 50%,100% 62%,100% 100%,0 100%,0 62%,10% 50%,0 38%)' },
        styles: () => ({ clipPath: 'polygon(0 0, 100% 0, 100% 38%, 96% 50%, 100% 62%, 100% 100%, 0 100%, 0 62%, 4% 50%, 0 38%)' }),
    },
    {
        name: 'Chevron',
        group: 'Shape',
        swatch: { background: '#334155', clipPath: 'polygon(0 0,78% 0,100% 50%,78% 100%,0 100%,22% 50%)' },
        styles: () => ({ clipPath: 'polygon(0 0, 78% 0, 100% 50%, 78% 100%, 0 100%, 22% 50%)' }),
    },
    {
        name: 'Diamond',
        group: 'Shape',
        swatch: { background: '#334155', clipPath: 'polygon(50% 0,100% 50%,50% 100%,0 50%)' },
        styles: () => ({ clipPath: 'polygon(50% 0, 100% 50%, 50% 100%, 0 50%)' }),
    },
    // Line
    {
        name: 'Edge',
        group: 'Line',
        swatch: { background: 'transparent', border: '2px solid transparent', borderImage: 'linear-gradient(135deg,#14b8a6,#7c3aed) 1', borderRadius: 0 },
        styles: (accent) => ({
            background: 'transparent',
            borderStyle: 'solid',
            borderWidth: '3px',
            borderImage: `linear-gradient(135deg, ${accent}, color-mix(in srgb, ${accent} 45%, #7c3aed)) 1`,
            borderRadius: '0px',
        }),
    },
    {
        name: 'Dotted',
        group: 'Line',
        swatch: { background: 'transparent', border: '2px dotted #14b8a6', borderRadius: 6 },
        styles: (accent) => ({ background: 'transparent', border: `3px dotted ${accent}`, borderRadius: '12px' }),
        patch: corners(12),
    },
    {
        name: 'Quote',
        group: 'Line',
        swatch: { background: 'transparent', borderLeft: '4px solid #14b8a6', borderRadius: 0 },
        styles: (accent) => ({ background: 'transparent', borderLeft: `4px solid ${accent}`, paddingLeft: '14px', borderRadius: '0px' }),
    },
    {
        name: 'Rule',
        group: 'Line',
        swatch: { background: 'transparent', borderTop: '3px solid #14b8a6', borderRadius: 0 },
        styles: (accent) => ({ background: 'transparent', borderTop: `3px solid ${accent}`, paddingTop: '12px', borderRadius: '0px' }),
    },
    // Accent
    {
        name: 'Conic',
        group: 'Accent',
        swatch: { background: 'conic-gradient(from 210deg,#f472b6,#a78bfa,#38bdf8,#34d399,#f472b6)', borderRadius: 6 },
        styles: () => ({ background: 'conic-gradient(from 210deg, #f472b6, #a78bfa, #38bdf8, #34d399, #f472b6)', color: '#0b0f14', border: 'none', borderRadius: '16px' }),
        patch: corners(16),
    },
    {
        name: 'Duotone',
        group: 'Accent',
        swatch: { background: 'linear-gradient(135deg,#14b8a6 0 50%,#0a5c50 50% 100%)', borderRadius: 6 },
        styles: (accent) => ({ background: `linear-gradient(135deg, ${accent} 0 50%, color-mix(in srgb, ${accent} 45%, #000) 50% 100%)`, color: '#ffffff', border: 'none', borderRadius: '12px' }),
        patch: corners(12),
    },
    {
        name: 'Gold',
        group: 'Accent',
        swatch: { background: 'linear-gradient(135deg,#fde047,#f59e0b)', borderRadius: 6 },
        styles: () => ({ background: 'linear-gradient(135deg, #fde047, #f59e0b)', color: '#3b2f0b', border: 'none', borderRadius: '14px' }),
        patch: corners(14),
    },
    {
        name: 'Fire',
        group: 'Accent',
        swatch: { background: 'linear-gradient(135deg,#f97316,#ef4444,#b91c1c)', borderRadius: 6 },
        styles: () => ({ background: 'linear-gradient(135deg, #f97316, #ef4444, #b91c1c)', color: '#ffffff', border: 'none', borderRadius: '14px' }),
        patch: corners(14),
    },
    // Type
    {
        name: 'Serif',
        group: 'Type',
        swatch: { background: '#cbd5e1', borderRadius: 3 },
        styles: () => ({ fontFamily: 'Georgia, "Times New Roman", serif', letterSpacing: '0' }),
        patch: { fontFamily: 'Georgia, "Times New Roman", serif' },
    },
    {
        name: 'Mono',
        group: 'Type',
        swatch: { background: '#94a3b8', borderRadius: 3 },
        styles: () => ({ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', letterSpacing: '0' }),
        patch: { fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' },
    },
    {
        name: 'Neon',
        group: 'Type',
        swatch: { background: '#0b1220', boxShadow: '0 0 8px 1px rgba(20,184,166,0.9)', borderRadius: 6 },
        styles: (accent) => ({ color: accent, textShadow: `0 0 7px color-mix(in srgb, ${accent} 80%, transparent), 0 0 16px color-mix(in srgb, ${accent} 60%, transparent)`, fontWeight: '700' }),
        patch: { fontWeight: '700' },
    },
    {
        name: 'Emboss',
        group: 'Type',
        swatch: { background: '#e2e8f0', boxShadow: 'inset 0 1px 0 #fff', borderRadius: 4 },
        styles: () => ({ color: '#334155', textShadow: '0 1px 0 rgba(255,255,255,0.7), 0 -1px 0 rgba(0,0,0,0.15)', fontWeight: '700' }),
        patch: { fontWeight: '700' },
    },
    // Effect
    {
        name: 'Hollow',
        group: 'Effect',
        swatch: { background: 'transparent', border: '1.5px solid #14b8a6', borderRadius: 3 },
        styles: (accent) => ({ color: accent, WebkitTextStrokeWidth: '1.5px', WebkitTextStrokeColor: accent, WebkitTextFillColor: 'transparent', fontWeight: '800' }),
        patch: { fontWeight: '800' },
    },
    {
        name: 'Invert',
        group: 'Effect',
        swatch: { background: 'linear-gradient(90deg,#111 50%,#eee 50%)', borderRadius: 4 },
        styles: () => ({ mixBlendMode: 'difference', color: '#ffffff' }),
    },
    {
        name: 'Echo',
        group: 'Effect',
        swatch: { background: '#e2e8f0', boxShadow: '3px 3px 0 #14b8a6', borderRadius: 3 },
        styles: (accent) => ({ color: '#0b0f14', textShadow: `3px 3px 0 ${accent}`, fontWeight: '700' }),
        patch: { fontWeight: '700' },
    },
    // Bold
    {
        name: 'Punch',
        group: 'Bold',
        swatch: { background: '#14b8a6', boxShadow: '0 4px 0 #0a5c50', borderRadius: 4 },
        styles: (accent) => ({
            background: accent,
            color: '#ffffff',
            fontWeight: '800',
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
            border: 'none',
            borderRadius: '10px',
            boxShadow: `0 8px 0 color-mix(in srgb, ${accent} 55%, #000)`,
        }),
        patch: { ...corners(10), fontWeight: '800' },
    },
    {
        name: 'Frame',
        group: 'Bold',
        swatch: { background: '#fff', boxShadow: 'inset 0 0 0 3px #0b0f14', borderRadius: 3 },
        styles: () => ({ background: '#ffffff', color: '#0b0f14', border: 'none', boxShadow: 'inset 0 0 0 3px #0b0f14', borderRadius: '4px' }),
        patch: corners(4),
    },
    /* Modern systems — added for the editable Look Studio */
    {
        name: 'Ambient', group: 'Depth',
        swatch: { background: '#172033', boxShadow: '0 5px 13px #14b8a666', borderRadius: 8 },
        styles: (accent) => ({ boxShadow: `0 28px 70px -24px color-mix(in srgb, ${accent} 52%, transparent), 0 10px 26px -16px rgba(0,0,0,.55)`, borderRadius: '22px' }),
        patch: corners(22),
    },
    {
        name: 'Stack', group: 'Depth',
        swatch: { background: '#f8fafc', boxShadow: '3px 3px 0 #94a3b8,6px 6px 0 #334155', borderRadius: 4 },
        styles: (accent) => ({ background: '#ffffff', color: '#0f172a', border: '1px solid rgba(15,23,42,.12)', boxShadow: `8px 8px 0 color-mix(in srgb, ${accent} 38%, #cbd5e1), 16px 16px 0 color-mix(in srgb, ${accent} 16%, #e2e8f0)`, borderRadius: '12px' }),
        patch: corners(12),
    },
    {
        name: 'Clay', group: 'Surface',
        swatch: { background: '#d8b4fe', boxShadow: 'inset 2px 2px 4px #fff8,inset -2px -2px 4px #581c8766', borderRadius: 10 },
        styles: (accent) => ({ background: `color-mix(in srgb, ${accent} 54%, #ffffff)`, color: '#1e1b2e', border: '1px solid rgba(255,255,255,.55)', boxShadow: 'inset 5px 5px 12px rgba(255,255,255,.5), inset -7px -7px 16px rgba(30,27,46,.18), 0 18px 38px -22px rgba(30,27,46,.55)', borderRadius: '28px' }),
        patch: corners(28),
    },
    {
        name: 'Carbon', group: 'Surface',
        swatch: { background: 'linear-gradient(145deg,#0b0f17,#1e293b)', border: '1px solid #ffffff22', borderRadius: 6 },
        styles: (accent) => ({ background: 'linear-gradient(145deg, #0b0f17, #1e293b)', color: '#f8fafc', border: `1px solid color-mix(in srgb, ${accent} 28%, rgba(255,255,255,.12))`, boxShadow: 'inset 0 1px rgba(255,255,255,.08)', borderRadius: '16px' }),
        patch: corners(16),
    },
    {
        name: 'Blueprint', group: 'Texture',
        swatch: { background: 'linear-gradient(#38bdf822 1px,transparent 1px),linear-gradient(90deg,#38bdf822 1px,transparent 1px),#082f49', backgroundSize: '6px 6px', borderRadius: 4 },
        styles: (accent) => ({ backgroundColor: '#082f49', backgroundImage: `linear-gradient(color-mix(in srgb, ${accent} 22%, transparent) 1px, transparent 1px), linear-gradient(90deg, color-mix(in srgb, ${accent} 22%, transparent) 1px, transparent 1px)`, backgroundSize: '24px 24px', color: '#e0f2fe', border: `1px solid color-mix(in srgb, ${accent} 48%, transparent)`, borderRadius: '8px' }),
        patch: corners(8),
    },
    {
        name: 'Halftone', group: 'Texture',
        swatch: { background: 'radial-gradient(circle,#0f172a 1px,transparent 1.5px),#f8fafc', backgroundSize: '5px 5px', borderRadius: 4 },
        styles: (accent) => ({ backgroundColor: '#fff', backgroundImage: `radial-gradient(circle, color-mix(in srgb, ${accent} 72%, #0f172a) 1.2px, transparent 1.5px)`, backgroundSize: '9px 9px', color: '#0f172a', borderRadius: '12px' }),
        patch: corners(12),
    },
    {
        name: 'Notch', group: 'Shape',
        swatch: { background: '#334155', clipPath: 'polygon(7px 0,100% 0,100% 100%,0 100%,0 7px)' },
        styles: () => ({ clipPath: 'polygon(18px 0, 100% 0, 100% calc(100% - 18px), calc(100% - 18px) 100%, 0 100%, 0 18px)' }),
    },
    {
        name: 'Gradient edge', group: 'Line',
        swatch: { background: '#111827', border: '2px solid #a78bfa', borderRadius: 6 },
        styles: (accent) => ({ border: '2px solid transparent', background: `linear-gradient(#0f172a,#0f172a) padding-box, linear-gradient(135deg, ${accent}, color-mix(in srgb, ${accent} 35%, #ec4899)) border-box`, color: '#ffffff', borderRadius: '16px' }),
        patch: corners(16),
    },
    {
        name: 'Lagoon', group: 'Accent',
        swatch: { background: 'linear-gradient(135deg,#06b6d4,#0f766e)', borderRadius: 7 },
        styles: (accent) => ({ background: `linear-gradient(135deg, color-mix(in srgb, ${accent} 75%, #06b6d4), color-mix(in srgb, ${accent} 62%, #064e3b))`, color: '#ffffff', border: 'none', borderRadius: '18px' }),
        patch: corners(18),
    },
    {
        name: 'Citrus', group: 'Accent',
        swatch: { background: 'linear-gradient(135deg,#bef264,#facc15)', borderRadius: 7 },
        styles: () => ({ background: 'linear-gradient(135deg, #d9f99d, #facc15)', color: '#26320a', border: 'none', borderRadius: '16px' }),
        patch: corners(16),
    },
    {
        name: 'Rose gold', group: 'Accent',
        swatch: { background: 'linear-gradient(135deg,#fda4af,#a855f7)', borderRadius: 7 },
        styles: () => ({ background: 'linear-gradient(135deg, #fecdd3, #fb7185 48%, #a855f7)', color: '#3f1221', border: '1px solid rgba(255,255,255,.42)', borderRadius: '18px' }),
        patch: corners(18),
    },
    {
        name: 'Editorial', group: 'Type',
        swatch: { background: '#f8fafc', borderBottom: '3px solid #0f172a' },
        styles: () => ({ fontFamily: 'Georgia, "Times New Roman", serif', fontWeight: '700', letterSpacing: '-0.035em', lineHeight: '.96', borderBottom: '3px solid currentColor', paddingBottom: '.12em' }),
        patch: { fontFamily: 'Georgia, "Times New Roman", serif', fontWeight: '700' },
    },
    {
        name: 'Technical', group: 'Type',
        swatch: { background: '#0f172a', border: '1px solid #22d3ee', borderRadius: 3 },
        styles: (accent) => ({ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', color: accent, textTransform: 'uppercase', letterSpacing: '.13em', fontSize: '.82em', borderLeft: `3px solid ${accent}`, paddingLeft: '.7em' }),
        patch: { fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' },
    },
    {
        name: 'Soft focus', group: 'Effect',
        swatch: { background: '#8b5cf6', filter: 'blur(.4px)', borderRadius: 8 },
        styles: (accent) => ({ background: `color-mix(in srgb, ${accent} 24%, transparent)`, border: `1px solid color-mix(in srgb, ${accent} 38%, transparent)`, boxShadow: `0 24px 70px -28px ${accent}`, backdropFilter: 'blur(18px) saturate(140%)', borderRadius: '24px' }),
        patch: corners(24),
    },
    {
        name: 'Bauhaus', group: 'Bold',
        swatch: { background: 'linear-gradient(90deg,#ef4444 33%,#facc15 33% 66%,#2563eb 66%)', border: '2px solid #111827', borderRadius: 2 },
        styles: () => ({ background: 'linear-gradient(110deg, #ef4444 0 32%, #facc15 32% 66%, #2563eb 66%)', color: '#0b0f14', border: '3px solid #0b0f14', boxShadow: '7px 7px 0 #0b0f14', fontWeight: '900', borderRadius: '2px' }),
        patch: { ...corners(2), fontWeight: '900' },
    },
    {
        name: 'Y2K', group: 'Bold',
        swatch: { background: 'linear-gradient(135deg,#cffafe,#e879f9)', boxShadow: '0 0 0 2px #fff,0 0 0 3px #7c3aed', borderRadius: 10 },
        styles: () => ({ background: 'linear-gradient(135deg, #cffafe, #f0abfc 55%, #c4b5fd)', color: '#3b0764', border: '2px solid #ffffff', boxShadow: '0 0 0 2px #7c3aed, 0 12px 30px -12px #7c3aed', fontWeight: '800', borderRadius: '22px' }),
        patch: { ...corners(22), fontWeight: '800' },
    },
    /* ─── Reset ─── */
    {
        name: 'Reset look',
        group: 'Reset',
        swatch: { background: 'transparent', border: '1px dashed rgba(255,255,255,0.35)', borderRadius: 6 },
        styles: () => ({
            boxShadow: 'none',
            border: 'none',
            borderImage: 'none',
            backdropFilter: 'none',
            backgroundImage: 'none',
            background: 'transparent',
            clipPath: 'none',
            filter: 'none',
            textShadow: 'none',
            textTransform: 'none',
            letterSpacing: 'normal',
            WebkitTextFillColor: 'currentColor',
            WebkitTextStrokeWidth: '0',
            WebkitBackgroundClip: 'border-box',
            backgroundClip: 'border-box',
            mixBlendMode: 'normal',
        }),
    },
];
function NumericField({ label, value, min, max, step = 1, unit, onChange, }) {
    const numericValue = Number.parseFloat(String(value)) || 0;
    const clamp = (next) => Math.min(max ?? Number.POSITIVE_INFINITY, Math.max(min ?? Number.NEGATIVE_INFINITY, next));
    const scrub = useScrub((steps) => onChange(clamp(numericValue + steps * step)), 6);
    return (_jsxs("label", { className: "froam-floating-bar__field froam-floating-bar__field--scrub", children: [_jsx("span", { ...scrub, style: { touchAction: 'none', cursor: 'ew-resize' }, children: label }), _jsxs("div", { className: "froam-floating-bar__number", children: [_jsx("input", { type: "number", value: numericValue, min: min, max: max, step: step, onChange: (event) => onChange(Number(event.target.value)) }), unit && _jsx("small", { children: unit })] })] }));
}
export default function FroamFloatingBar({ targetRect, visible, label, fontFamily, fontSize, fontWeight, lineHeight, letterSpacing, wordSpacing, textTransform, isBold, isItalic, isUnderline, isStrike, textAlign, color, background, width, height, display, flexDirection, justifyContent, alignItems, gap, padding, radius, overflow, opacity, isHidden = false, mixBlendMode, zIndex, fontOptions, selectionCount, docked = false, canUndo = false, onWalk, onAction, onStyle, onSaveLook, }) {
    const barRef = useRef(null);
    const [expanded, setExpanded] = useState(false);
    const [narrow, setNarrow] = useState(false);
    const [position, setPosition] = useState({ left: 12, top: 12 });
    const [openPop, setOpenPop] = useState(null);
    const [palette, setPalette] = useState([]);
    const [paletteMode, setPaletteMode] = useState('fill');
    const [lookSearch, setLookSearch] = useState('');
    const [lookGroup, setLookGroup] = useState('All');
    const [selectedLookName, setSelectedLookName] = useState('Lift');
    const [lookAccent, setLookAccent] = useState('#14b8a6');
    const [lookFill, setLookFill] = useState(() => normalizeToHex(background) ?? '#ffffff');
    const [lookText, setLookText] = useState(() => normalizeToHex(color) ?? '#111827');
    const [overrideLookFill, setOverrideLookFill] = useState(false);
    const [overrideLookText, setOverrideLookText] = useState(false);
    const [overrideLookRadius, setOverrideLookRadius] = useState(false);
    const [lookRadius, setLookRadius] = useState(Math.max(0, Math.round(radius)));
    const [lookState, setLookState] = useState('base');
    const [lookStateDrafts, setLookStateDrafts] = useState({});
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
            if (next && palette.length === 0) {
                const pagePalette = collectPagePalette();
                setPalette(pagePalette);
                if (which === 'looks')
                    setLookAccent(pickAccent(pagePalette));
            }
            if (next === 'looks') {
                setLookFill(normalizeToHex(background) ?? '#ffffff');
                setLookText(normalizeToHex(color) ?? '#111827');
                setLookRadius(Math.max(0, Math.round(radius)));
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
    function customizedLook(look) {
        const styles = { ...look.styles(lookAccent) };
        const patch = { ...(look.patch ?? {}) };
        if (overrideLookFill && look.group !== 'Reset') {
            styles.background = lookFill;
            styles.backgroundImage = 'none';
        }
        if (overrideLookText && look.group !== 'Reset') {
            styles.color = lookText;
            if ('WebkitTextFillColor' in styles)
                styles.WebkitTextFillColor = lookText;
        }
        if (overrideLookRadius && look.group !== 'Reset') {
            styles.borderRadius = `${lookRadius}px`;
            Object.assign(patch, corners(lookRadius));
        }
        return { styles, patch };
    }
    function applyLook(look) {
        const { styles, patch } = customizedLook(look);
        setSelectedLookName(look.name);
        setLookStateDrafts((current) => ({ ...current, [lookState]: styles }));
        if (lookState === 'base')
            onStyle(styles, patch, `Look: ${look.name}`);
        else
            onStyle(Object.fromEntries(Object.entries(styles).map(([property, value]) => [`__froamState:${lookState}:${property}`, value])), undefined, `Look: ${look.name} · ${lookState}`);
        if ('vibrate' in navigator)
            navigator.vibrate?.(6);
    }
    const selectedLook = LOOKS.find((look) => look.name === selectedLookName) ?? LOOKS[0];
    const visibleLooks = LOOKS.filter((look) => {
        const query = lookSearch.trim().toLowerCase();
        return (lookGroup === 'All' || look.group === lookGroup)
            && (!query || `${look.name} ${look.group}`.toLowerCase().includes(query));
    });
    return (_jsxs("div", { ref: barRef, className: `froam-floating-bar ${expanded ? 'is-expanded' : ''} ${narrow ? 'is-narrow' : ''} ${docked ? 'is-docked' : ''}`, "data-chef-editor-root": "true", style: docked ? undefined : { left: position.left, top: position.top }, children: [_jsxs("div", { className: "froam-floating-bar__primary", children: [onWalk && (_jsxs("div", { className: "froam-floating-bar__group froam-floating-bar__walker", role: "group", "aria-label": "Walk selection", children: [_jsx("button", { type: "button", className: "froam-floating-bar__btn", title: "Select parent", onClick: () => onWalk('parent'), children: _jsx(CornerLeftUp, { size: 13 }) }), _jsx("button", { type: "button", className: "froam-floating-bar__btn", title: "Previous sibling", onClick: () => onWalk('prev'), children: _jsx(ChevronLeft, { size: 13 }) }), _jsx("button", { type: "button", className: "froam-floating-bar__btn", title: "Next sibling", onClick: () => onWalk('next'), children: _jsx(ChevronRight, { size: 13 }) }), _jsx("button", { type: "button", className: "froam-floating-bar__btn", title: "Select first child", onClick: () => onWalk('child'), children: _jsx(CornerRightDown, { size: 13 }) })] })), _jsxs("div", { className: "froam-floating-bar__identity", title: label, children: [_jsx(Type, { size: 13 }), _jsx("span", { children: label })] }), _jsx("button", { type: "button", className: "froam-floating-bar__btn froam-floating-bar__edit-text", title: "Edit text", onClick: () => onAction('edit-text'), children: _jsx("span", { className: "froam-floating-bar__aa", children: "Aa" }) }), _jsx("select", { className: "froam-floating-bar__select froam-floating-bar__font", value: fontFamily, title: "Font family", "aria-label": "Font family", onChange: (event) => onStyle({ fontFamily: event.target.value }, { fontFamily: event.target.value }, 'Changed font family'), children: fontOptions.map((font) => _jsx("option", { value: font.value, children: font.label }, font.value)) }), _jsxs("div", { className: "froam-floating-bar__stepper froam-floating-bar__stepper--scrub", title: "Font size \u2014 drag the number to scrub", ...fontScrub, style: { touchAction: 'none' }, children: [_jsx("button", { type: "button", onClick: () => onStyle({ fontSize: `${Math.max(6, fontSize - 1)}px` }, { fontSize: Math.max(6, fontSize - 1) }), children: "\u2212" }), _jsx("input", { type: "number", value: Math.round(fontSize), min: 6, max: 400, "aria-label": "Font size", onChange: (event) => {
                                    const next = Math.max(6, Number(event.target.value));
                                    onStyle({ fontSize: `${next}px` }, { fontSize: next }, 'Changed font size');
                                } }), _jsx("button", { type: "button", onClick: () => onStyle({ fontSize: `${Math.min(400, fontSize + 1)}px` }, { fontSize: Math.min(400, fontSize + 1) }), children: "+" })] }), _jsx("select", { className: "froam-floating-bar__select froam-floating-bar__weight", value: fontWeight, title: "Font weight", "aria-label": "Font weight", onChange: (event) => onStyle({ fontWeight: event.target.value }, { fontWeight: event.target.value }, 'Changed font weight'), children: ['300', '400', '500', '600', '700', '800', '900'].map((weight) => _jsx("option", { value: weight, children: weight }, weight)) }), _jsx("span", { className: "froam-floating-bar__sep" }), _jsxs("div", { className: "froam-floating-bar__group", children: [_jsx("button", { type: "button", className: `froam-floating-bar__btn ${isBold ? 'is-active' : ''}`, title: "Bold", onClick: () => onAction('bold'), children: _jsx(Bold, { size: 13 }) }), _jsx("button", { type: "button", className: `froam-floating-bar__btn ${isItalic ? 'is-active' : ''}`, title: "Italic", onClick: () => onAction('italic'), children: _jsx(Italic, { size: 13 }) }), _jsx("button", { type: "button", className: `froam-floating-bar__btn ${isUnderline ? 'is-active' : ''}`, title: "Underline", onClick: () => onAction('underline'), children: _jsx(Underline, { size: 13 }) }), _jsx("button", { type: "button", className: `froam-floating-bar__btn ${isStrike ? 'is-active' : ''}`, title: "Strikethrough", onClick: () => onAction('strike'), children: _jsx(Strikethrough, { size: 13 }) })] }), _jsx("span", { className: "froam-floating-bar__sep" }), _jsxs("div", { className: "froam-floating-bar__group", children: [_jsx("button", { type: "button", className: `froam-floating-bar__btn ${textAlign === 'left' || textAlign === 'start' ? 'is-active' : ''}`, title: "Align left", onClick: () => onAction('align-left'), children: _jsx(AlignLeft, { size: 13 }) }), _jsx("button", { type: "button", className: `froam-floating-bar__btn ${textAlign === 'center' ? 'is-active' : ''}`, title: "Align center", onClick: () => onAction('align-center'), children: _jsx(AlignCenter, { size: 13 }) }), _jsx("button", { type: "button", className: `froam-floating-bar__btn ${textAlign === 'right' || textAlign === 'end' ? 'is-active' : ''}`, title: "Align right", onClick: () => onAction('align-right'), children: _jsx(AlignRight, { size: 13 }) }), _jsx("button", { type: "button", className: `froam-floating-bar__btn ${textAlign === 'justify' ? 'is-active' : ''}`, title: "Justify", onClick: () => onAction('align-justify'), children: _jsx(AlignJustify, { size: 13 }) })] }), _jsx("span", { className: "froam-floating-bar__sep" }), _jsxs("div", { className: "froam-floating-bar__group", children: [_jsx("button", { type: "button", className: "froam-floating-bar__btn froam-floating-bar__btn--merge", title: selectionCount > 1 ? 'Merge selected into one movable stamp' : 'Merge this with overlapping sibling shapes', onClick: () => onAction('merge'), children: _jsx(Combine, { size: 13 }) }), _jsx("button", { type: "button", className: "froam-floating-bar__btn", title: "Ungroup merged stamp", onClick: () => onAction('unmerge'), children: _jsx(Ungroup, { size: 13 }) })] }), _jsx("span", { className: "froam-floating-bar__sep" }), _jsx("button", { type: "button", className: `froam-floating-bar__btn ${openPop === 'palette' ? 'is-active' : ''}`, title: "Page palette \u2014 colors from this site", onClick: () => togglePop('palette'), children: _jsx(Pipette, { size: 13 }) }), _jsx("button", { type: "button", className: `froam-floating-bar__btn ${openPop === 'looks' ? 'is-active' : ''}`, title: "Quick looks \u2014 one-tap styles", onClick: () => togglePop('looks'), children: _jsx(Sparkles, { size: 13 }) }), _jsxs("label", { className: "froam-floating-bar__color-btn", title: "Text color", style: { '--froam-swatch': color }, children: [_jsx(Type, { size: 11 }), _jsx("input", { type: "color", className: "froam-floating-bar__color-input", value: color, onChange: (event) => onAction('color', event.target.value) })] }), _jsxs("label", { className: "froam-floating-bar__color-btn", title: "Background", style: { '--froam-swatch': background }, children: [_jsx(Palette, { size: 11 }), _jsx("input", { type: "color", className: "froam-floating-bar__color-input", value: background, onChange: (event) => onAction('bg-color', event.target.value) })] }), _jsx("button", { type: "button", className: "froam-floating-bar__btn", title: "Clear fill", onClick: () => onAction('clear-bg'), children: _jsx(Eraser, { size: 13 }) }), _jsx("span", { className: "froam-floating-bar__sep" }), _jsxs("div", { className: "froam-floating-bar__opacity", title: "Opacity \u2014 drag to fade", ...opacityScrub, style: { touchAction: 'none' }, children: [_jsx(Contrast, { size: 13 }), _jsxs("span", { children: [Math.round(opacity * 100), "%"] })] }), _jsx("button", { type: "button", className: `froam-floating-bar__btn ${isHidden ? 'is-active' : ''}`, title: isHidden ? 'Show element' : 'Hide element', onClick: () => onAction('toggle-hidden'), children: isHidden ? _jsx(EyeOff, { size: 13 }) : _jsx(Eye, { size: 13 }) }), docked && (_jsxs(_Fragment, { children: [_jsx("span", { className: "froam-floating-bar__sep" }), _jsx("button", { type: "button", className: "froam-floating-bar__btn", title: "Undo", disabled: !canUndo, onClick: () => onAction('undo'), children: _jsx(Undo2, { size: 13 }) })] })), _jsxs("button", { type: "button", className: `froam-floating-bar__expand ${expanded ? 'is-active' : ''}`, onClick: () => setExpanded((current) => !current), "aria-expanded": expanded, title: "More typography and layout controls", children: [_jsx("span", { children: "More" }), _jsx(ChevronDown, { size: 13 })] })] }), openPop === 'palette' && (_jsxs("div", { className: "froam-floating-bar__pop", "data-chef-editor-root": "true", children: [_jsxs("div", { className: "froam-floating-bar__pop-head", children: [_jsx("span", { children: "Page palette" }), _jsxs("div", { className: "froam-floating-bar__pop-toggle", role: "group", "aria-label": "Apply as", children: [_jsx("button", { type: "button", className: paletteMode === 'fill' ? 'is-active' : '', onClick: () => setPaletteMode('fill'), children: "Fill" }), _jsx("button", { type: "button", className: paletteMode === 'text' ? 'is-active' : '', onClick: () => setPaletteMode('text'), children: "Text" })] })] }), _jsxs("div", { className: "froam-floating-bar__chips", children: [palette.map((hex) => {
                                const readable = paletteMode === 'text' && contrastRatio(hex, backgroundHex) >= 4.5;
                                return (_jsxs("button", { type: "button", className: "froam-floating-bar__chip", style: { '--froam-chip': hex }, title: `${hex}${readable ? ' — readable on current fill' : ''}`, onClick: () => applyChip(hex), children: [paletteMode === 'text' && _jsx("span", { style: { color: hex }, children: "Aa" }), readable && _jsx("i", { className: "froam-floating-bar__chip-ok" })] }, hex));
                            }), palette.length === 0 && _jsx("span", { className: "froam-floating-bar__pop-empty", children: "No colors found yet" })] })] })), openPop === 'looks' && (_jsxs("div", { className: "froam-floating-bar__pop froam-floating-bar__pop--looks", "data-chef-editor-root": "true", children: [_jsxs("div", { className: "froam-floating-bar__pop-head", children: [_jsxs("span", { children: ["Look Studio ", _jsxs("small", { children: [LOOKS.length, " recipes"] })] }), _jsx("button", { type: "button", className: "froam-floating-bar__look-apply", onClick: () => applyLook(selectedLook), children: "Apply changes" })] }), _jsxs("label", { className: "froam-floating-bar__look-search", children: [_jsx(Search, { size: 12 }), _jsx("input", { value: lookSearch, onChange: (event) => setLookSearch(event.target.value), placeholder: "Search looks\u2026" })] }), _jsx("div", { className: "froam-floating-bar__look-groups", role: "tablist", "aria-label": "Look categories", children: ['All', ...LOOK_GROUPS].map((group) => (_jsx("button", { type: "button", role: "tab", "aria-selected": lookGroup === group, className: lookGroup === group ? 'is-active' : '', onClick: () => setLookGroup(group), children: group }, group))) }), _jsx("div", { className: "froam-floating-bar__looks-scroll", children: _jsxs("div", { className: "froam-floating-bar__looks", children: [visibleLooks.map((look) => (_jsxs("button", { type: "button", className: selectedLookName === look.name ? 'is-active' : '', onClick: () => applyLook(look), title: `${look.group} · ${look.name}`, children: [_jsx("i", { style: look.swatch }), _jsx("span", { children: look.name }), _jsx("small", { children: look.group })] }, look.name))), visibleLooks.length === 0 && _jsxs("span", { className: "froam-floating-bar__pop-empty", children: ["No looks match \u201C", lookSearch, "\u201D"] })] }) }), _jsxs("div", { className: "froam-floating-bar__look-editor", children: [_jsxs("div", { className: "froam-floating-bar__look-editor-title", children: [_jsx(SlidersHorizontal, { size: 12 }), _jsxs("span", { children: ["Customize ", selectedLook.name] })] }), _jsx("div", { className: "froam-floating-bar__look-states", role: "tablist", "aria-label": "Style state", children: ['base', 'hover', 'focus', 'active'].map((state) => _jsx("button", { type: "button", role: "tab", "aria-selected": lookState === state, className: lookState === state ? 'is-active' : '', onClick: () => setLookState(state), children: state }, state)) }), _jsxs("div", { className: "froam-floating-bar__look-colors", children: [_jsxs("label", { title: "Accent used by accent-aware looks", children: [_jsx("span", { children: "Accent" }), _jsx("input", { type: "color", value: lookAccent, onChange: (event) => setLookAccent(event.target.value) })] }), _jsxs("label", { className: overrideLookFill ? 'is-enabled' : '', children: [_jsx("input", { type: "checkbox", checked: overrideLookFill, onChange: (event) => setOverrideLookFill(event.target.checked) }), _jsx("span", { children: "Fill" }), _jsx("input", { type: "color", value: lookFill, onChange: (event) => setLookFill(event.target.value), disabled: !overrideLookFill })] }), _jsxs("label", { className: overrideLookText ? 'is-enabled' : '', children: [_jsx("input", { type: "checkbox", checked: overrideLookText, onChange: (event) => setOverrideLookText(event.target.checked) }), _jsx("span", { children: "Text" }), _jsx("input", { type: "color", value: lookText, onChange: (event) => setLookText(event.target.value), disabled: !overrideLookText })] })] }), _jsxs("label", { className: `froam-floating-bar__look-radius ${overrideLookRadius ? 'is-enabled' : ''}`, children: [_jsx("input", { type: "checkbox", checked: overrideLookRadius, onChange: (event) => setOverrideLookRadius(event.target.checked) }), _jsx("span", { children: "Corner radius" }), _jsx("input", { type: "range", min: "0", max: "64", value: lookRadius, onChange: (event) => setLookRadius(Number(event.target.value)), disabled: !overrideLookRadius }), _jsxs("output", { children: [lookRadius, "px"] })] }), _jsx("p", { children: "Choose a recipe, tune its design variables, then apply changes. Accent-aware gradients and effects update automatically." }), onSaveLook && _jsx("button", { type: "button", className: "froam-floating-bar__look-save", onClick: () => onSaveLook({ name: selectedLook.name, states: { ...lookStateDrafts, [lookState]: customizedLook(selectedLook).styles } }), children: "Save as reusable style" })] })] })), expanded && (_jsxs("div", { className: "froam-floating-bar__advanced", children: [_jsxs("section", { children: [_jsxs("header", { children: [_jsx(Type, { size: 13 }), " Typography"] }), _jsxs("div", { className: "froam-floating-bar__fields", children: [_jsx(NumericField, { label: "Line", value: lineHeight, min: 0.5, max: 5, step: 0.05, onChange: (next) => onStyle({ lineHeight: String(next) }, { lineHeight: next }, 'Changed line height') }), _jsx(NumericField, { label: "Tracking", value: letterSpacing, min: -20, max: 100, step: 0.1, unit: "px", onChange: (next) => onStyle({ letterSpacing: `${next}px` }, { letterSpacing: next }, 'Changed letter spacing') }), _jsx(NumericField, { label: "Words", value: wordSpacing, min: -20, max: 100, step: 0.5, unit: "px", onChange: (next) => onStyle({ wordSpacing: `${next}px` }, { wordSpacing: next }, 'Changed word spacing') }), _jsxs("label", { className: "froam-floating-bar__field", children: [_jsx("span", { children: "Case" }), _jsxs("select", { value: textTransform, onChange: (event) => onStyle({ textTransform: event.target.value }, { textTransform: event.target.value }, 'Changed text case'), children: [_jsx("option", { value: "none", children: "Original" }), _jsx("option", { value: "uppercase", children: "UPPER" }), _jsx("option", { value: "lowercase", children: "lower" }), _jsx("option", { value: "capitalize", children: "Title" })] })] })] })] }), _jsxs("section", { children: [_jsxs("header", { children: [_jsx(Maximize, { size: 13 }), " Size & shape"] }), _jsxs("div", { className: "froam-floating-bar__fields", children: [_jsx(NumericField, { label: "Width", value: widthValue, min: 1, max: 5000, unit: "px", onChange: (next) => onStyle({ width: `${next}px` }, { width: `${next}px` }, 'Changed width') }), _jsx(NumericField, { label: "Height", value: heightValue, min: 1, max: 5000, unit: "px", onChange: (next) => onStyle({ height: `${next}px` }, { height: `${next}px` }, 'Changed height') }), _jsx(NumericField, { label: "Padding", value: padding, min: 0, max: 400, unit: "px", onChange: (next) => onStyle({ padding: `${next}px` }, { paddingTop: next, paddingRight: next, paddingBottom: next, paddingLeft: next }, 'Changed padding') }), _jsx(NumericField, { label: "Radius", value: radius, min: 0, max: 1000, unit: "px", onChange: (next) => onStyle({ borderRadius: `${next}px` }, { borderRadiusTL: next, borderRadiusTR: next, borderRadiusBR: next, borderRadiusBL: next }, 'Changed radius') })] }), _jsxs("div", { className: "froam-floating-bar__preset-row", children: [_jsx("button", { type: "button", onClick: () => onStyle({ width: 'auto' }, { width: 'auto' }, 'Width: auto'), children: "Auto W" }), _jsx("button", { type: "button", onClick: () => onStyle({ height: 'auto' }, { height: 'auto' }, 'Height: auto'), children: "Auto H" }), _jsx("button", { type: "button", onClick: () => onStyle({ width: '100%', maxWidth: '100%' }, { width: '100%', maxWidth: '100%' }, 'Fill parent'), children: "Fill" }), _jsx("button", { type: "button", onClick: () => onStyle({ width: 'max-content', height: 'auto', maxWidth: '100%' }, { width: 'max-content', height: 'auto' }, 'Hug content'), children: "Hug" })] })] }), _jsxs("section", { children: [_jsxs("header", { children: [_jsx(LayoutTemplate, { size: 13 }), " Layout"] }), _jsxs("div", { className: "froam-floating-bar__segmented", children: [_jsxs("button", { type: "button", className: display === 'block' ? 'is-active' : '', onClick: () => onStyle({ display: 'block' }, { display: 'block' }, 'Layout: block'), children: [_jsx(RectangleHorizontal, { size: 13 }), " Block"] }), _jsxs("button", { type: "button", className: display.includes('flex') ? 'is-active' : '', onClick: () => onStyle({ display: 'flex' }, { display: 'flex' }, 'Layout: flex'), children: [_jsx(Rows3, { size: 13 }), " Flex"] }), _jsxs("button", { type: "button", className: display === 'grid' ? 'is-active' : '', onClick: () => onStyle({ display: 'grid' }, { display: 'grid' }, 'Layout: grid'), children: [_jsx(Grid2X2, { size: 13 }), " Grid"] })] }), _jsxs("div", { className: "froam-floating-bar__fields", children: [_jsxs("label", { className: "froam-floating-bar__field", children: [_jsx("span", { children: "Direction" }), _jsxs("select", { value: flexDirection, onChange: (event) => onStyle({ display: 'flex', flexDirection: event.target.value }, { display: 'flex', flexDirection: event.target.value }, 'Changed flex direction'), children: [_jsx("option", { value: "row", children: "Row" }), _jsx("option", { value: "column", children: "Column" }), _jsx("option", { value: "row-reverse", children: "Row reverse" }), _jsx("option", { value: "column-reverse", children: "Column reverse" })] })] }), _jsxs("label", { className: "froam-floating-bar__field", children: [_jsx("span", { children: "Justify" }), _jsxs("select", { value: justifyContent, onChange: (event) => onStyle({ justifyContent: event.target.value }, { justifyContent: event.target.value }, 'Changed distribution'), children: [_jsx("option", { value: "flex-start", children: "Start" }), _jsx("option", { value: "center", children: "Center" }), _jsx("option", { value: "flex-end", children: "End" }), _jsx("option", { value: "space-between", children: "Between" }), _jsx("option", { value: "space-around", children: "Around" }), _jsx("option", { value: "space-evenly", children: "Evenly" })] })] }), _jsxs("label", { className: "froam-floating-bar__field", children: [_jsx("span", { children: "Align" }), _jsxs("select", { value: alignItems, onChange: (event) => onStyle({ alignItems: event.target.value }, { alignItems: event.target.value }, 'Changed alignment'), children: [_jsx("option", { value: "stretch", children: "Stretch" }), _jsx("option", { value: "flex-start", children: "Start" }), _jsx("option", { value: "center", children: "Center" }), _jsx("option", { value: "flex-end", children: "End" }), _jsx("option", { value: "baseline", children: "Baseline" })] })] }), _jsx(NumericField, { label: "Gap", value: gap, min: 0, max: 400, unit: "px", onChange: (next) => onStyle({ gap: `${next}px` }, { gap: next }, 'Changed gap') }), _jsxs("label", { className: "froam-floating-bar__field", children: [_jsx("span", { children: "Overflow" }), _jsxs("select", { value: overflow, onChange: (event) => onStyle({ overflow: event.target.value }, { overflow: event.target.value }, 'Changed overflow'), children: [_jsx("option", { value: "visible", children: "Visible" }), _jsx("option", { value: "hidden", children: "Hidden" }), _jsx("option", { value: "auto", children: "Auto" }), _jsx("option", { value: "scroll", children: "Scroll" })] })] })] })] }), _jsxs("section", { children: [_jsxs("header", { children: [_jsx(Layers, { size: 13 }), " Depth & blend"] }), _jsxs("div", { className: "froam-floating-bar__fields", children: [_jsx(NumericField, { label: "Z-index", value: zIndex, min: -999, max: 9999, onChange: (next) => onStyle({ zIndex: String(next) }, { zIndex: next }, 'Changed z-index') }), _jsxs("label", { className: "froam-floating-bar__field", children: [_jsx("span", { children: "Blend" }), _jsxs("select", { value: mixBlendMode, onChange: (event) => onStyle({ mixBlendMode: event.target.value }, { mixBlendMode: event.target.value }, 'Changed blend mode'), children: [_jsx("option", { value: "normal", children: "Normal" }), _jsx("option", { value: "multiply", children: "Multiply" }), _jsx("option", { value: "screen", children: "Screen" }), _jsx("option", { value: "overlay", children: "Overlay" }), _jsx("option", { value: "darken", children: "Darken" }), _jsx("option", { value: "lighten", children: "Lighten" }), _jsx("option", { value: "color-dodge", children: "Color dodge" }), _jsx("option", { value: "color-burn", children: "Color burn" }), _jsx("option", { value: "hard-light", children: "Hard light" }), _jsx("option", { value: "soft-light", children: "Soft light" }), _jsx("option", { value: "difference", children: "Difference" }), _jsx("option", { value: "exclusion", children: "Exclusion" }), _jsx("option", { value: "hue", children: "Hue" }), _jsx("option", { value: "saturation", children: "Saturation" }), _jsx("option", { value: "color", children: "Color" }), _jsx("option", { value: "luminosity", children: "Luminosity" })] })] })] }), _jsxs("div", { className: "froam-floating-bar__preset-row", children: [_jsxs("button", { type: "button", onClick: () => onAction('bring-front'), children: [_jsx(BringToFront, { size: 12 }), " Front"] }), _jsxs("button", { type: "button", onClick: () => onAction('send-back'), children: [_jsx(SendToBack, { size: 12 }), " Back"] })] })] }), _jsxs("section", { className: "froam-floating-bar__actions", children: [_jsxs("button", { type: "button", onClick: () => onAction('image'), children: [_jsx(ImagePlus, { size: 13 }), " Image"] }), _jsxs("button", { type: "button", onClick: () => onAction('duplicate'), children: [_jsx(Copy, { size: 13 }), " Duplicate"] }), _jsxs("button", { type: "button", className: "is-danger", onClick: () => onAction('delete'), children: [_jsx(Trash2, { size: 13 }), " Reset styles"] })] })] }))] }));
}
//# sourceMappingURL=FroamFloatingBar.js.map