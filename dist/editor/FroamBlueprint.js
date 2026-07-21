import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/* ===============================================================
   FROAM STUDIO v4.5 — BLUEPRINT
   The scan's big brother: a full engineering schematic of the page,
   drawn like a blueprint sheet — grid paper, wireframe recreation of
   every element at true document scale, category-coded strokes,
   dimension labels, callout leader lines to the key parts, and a
   title block with the site's specs. Tap any part to jump straight
   to that element in the editor.

   The data computer (`computeBlueprintData`) and the SVG renderer
   (`BlueprintSheet`) are exported so the design panel's Prototype tab
   can show the same full-page picture as a persistent thumbnail.
   =============================================================== */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Box, PenLine, X } from 'lucide-react';
import { collectPagePalette } from './FroamFloatingBar.js';
const CATEGORY_COLOR = {
    heading: '#7df3e1',
    media: '#ffa58e',
    action: '#ffd166',
    container: '#9db8ff',
    text: '#c3d3e8',
};
const CATEGORY_LABEL = {
    heading: 'Headings',
    media: 'Media',
    action: 'Actions',
    container: 'Containers',
    text: 'Text',
};
function categoryOf(el) {
    const tag = el.tagName.toLowerCase();
    if (/^h[1-6]$/.test(tag))
        return 'heading';
    if (tag === 'img' || tag === 'svg' || tag === 'picture' || tag === 'video' || tag === 'canvas')
        return 'media';
    if (tag === 'button' || tag === 'a' || tag === 'input' || tag === 'select' || tag === 'textarea')
        return 'action';
    if (tag === 'p' || tag === 'li' || tag === 'blockquote')
        return 'text';
    if (['section', 'header', 'footer', 'main', 'article', 'nav', 'aside', 'form', 'ul', 'ol', 'div'].includes(tag))
        return 'container';
    return null;
}
function shortLabel(el) {
    const tag = el.tagName.toLowerCase();
    const cls = typeof el.className === 'string' ? el.className.split(' ').filter(Boolean)[0] : '';
    return cls ? `${tag}.${cls}` : tag;
}
function domDepth(el, root) {
    let depth = 0;
    let node = el.parentElement;
    while (node && node !== root) {
        depth += 1;
        node = node.parentElement;
    }
    return depth;
}
function collectBlueprintNodes(root) {
    const selector = 'h1,h2,h3,h4,h5,h6,p,img,svg,picture,video,canvas,button,a,input,select,textarea,section,header,footer,main,article,nav,aside,form,ul,ol,li,blockquote,div';
    const elements = root.querySelectorAll(selector);
    const scrollX = window.scrollX;
    const scrollY = window.scrollY;
    const nodes = [];
    for (const el of elements) {
        if (el.closest('[data-chef-editor-root]'))
            continue;
        const category = categoryOf(el);
        if (!category)
            continue;
        const r = el.getBoundingClientRect();
        if (r.width < 18 || r.height < 10)
            continue;
        if ((category === 'container' || category === 'text') && (r.width < 48 || r.height < 22))
            continue;
        nodes.push({
            el,
            x: r.left + scrollX,
            y: r.top + scrollY,
            w: r.width,
            h: r.height,
            category,
            label: shortLabel(el),
            depth: domDepth(el, root),
        });
        if (nodes.length >= 420)
            break;
    }
    nodes.sort((a, b) => a.y - b.y || a.x - b.x);
    const minDepth = nodes.reduce((min, n) => Math.min(min, n.depth), Infinity);
    if (Number.isFinite(minDepth) && minDepth > 0)
        for (const n of nodes)
            n.depth -= minDepth;
    return nodes;
}
function pickCallouts(nodes) {
    const callouts = [];
    const used = new Set();
    const claim = (node, title) => {
        if (!node || used.has(node))
            return;
        used.add(node);
        callouts.push({ node, title });
    };
    claim(nodes.find((n) => n.el.tagName === 'H1') ?? nodes.find((n) => n.category === 'heading'), 'PRIMARY HEADLINE');
    claim(nodes.find((n) => n.el.tagName === 'NAV' || n.el.tagName === 'HEADER'), 'NAVIGATION');
    claim([...nodes].filter((n) => n.category === 'media').sort((a, b) => b.w * b.h - a.w * a.h)[0], 'HERO MEDIA');
    claim([...nodes].filter((n) => n.category === 'action').sort((a, b) => b.w * b.h - a.w * a.h)[0], 'PRIMARY ACTION');
    claim(nodes.find((n) => n.el.tagName === 'FOOTER'), 'FOOTER');
    return callouts.sort((a, b) => a.node.y - b.node.y).slice(0, 5);
}
function collectFonts(root) {
    const fonts = new Set();
    const sample = [document.body, ...root.querySelectorAll('h1,h2,h3,p,button')];
    for (const el of sample) {
        if (!el || el.closest('[data-chef-editor-root]'))
            continue;
        const family = window.getComputedStyle(el).fontFamily.split(',')[0]?.replace(/["']/g, '').trim();
        if (family)
            fonts.add(family);
        if (fonts.size >= 3)
            break;
    }
    return [...fonts];
}
/** Scan the live page and produce the full blueprint dataset (or null if empty). */
export function computeBlueprintData(root) {
    if (!root)
        return null;
    const nodes = collectBlueprintNodes(root);
    if (nodes.length === 0)
        return null;
    const docWidth = Math.max(window.innerWidth, ...nodes.map((n) => n.x + n.w));
    const docHeight = Math.max(document.documentElement.scrollHeight, ...nodes.map((n) => n.y + n.h));
    const counts = { heading: 0, media: 0, action: 0, container: 0, text: 0 };
    for (const n of nodes)
        counts[n.category] += 1;
    const wideSheet = docWidth >= 900;
    return {
        nodes,
        docWidth,
        docHeight,
        counts,
        callouts: wideSheet ? pickCallouts(nodes) : [],
        gutter: wideSheet ? Math.round(docWidth * 0.24) : 0,
        palette: collectPagePalette().slice(0, 6),
        fonts: collectFonts(root),
        title: (document.title || 'Untitled page').slice(0, 44),
        stamp: new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }),
        reduceMotion: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false,
        maxDepth: nodes.reduce((max, n) => Math.max(max, n.depth), 0),
    };
}
export const BLUEPRINT_CATEGORY_COLOR = CATEGORY_COLOR;
export const BLUEPRINT_CATEGORY_LABEL = CATEGORY_LABEL;
/**
 * The drawn sheet itself: blueprint paper, grid, and a stroke-drawn wireframe
 * of every element at true document scale. `mode="full"` adds labels, callouts
 * and click-to-select; `mode="mini"` is the compact full-page picture used in
 * the Prototype tab (whole sheet handles the click via its parent).
 */
export function BlueprintSheet({ data, mode = 'full', onJumpToElement, }) {
    const { nodes, docWidth, docHeight, callouts, gutter } = data;
    const full = mode === 'full';
    const sheetWidth = docWidth + (full ? gutter : 0);
    const labelled = full ? nodes.filter((n) => n.w * n.h > 14000 || n.category === 'heading').slice(0, 60) : [];
    return (_jsxs("svg", { className: `fs-bp__sheet ${full ? '' : 'fs-bp__sheet--mini'}`, viewBox: `0 0 ${sheetWidth} ${docHeight}`, xmlns: "http://www.w3.org/2000/svg", "data-chef-editor-root": "true", children: [_jsxs("defs", { children: [_jsx("pattern", { id: "fs-bp-grid-minor", width: "40", height: "40", patternUnits: "userSpaceOnUse", children: _jsx("path", { d: "M 40 0 L 0 0 0 40", fill: "none", stroke: "rgba(160, 190, 255, 0.10)", strokeWidth: "1", vectorEffect: "non-scaling-stroke" }) }), _jsxs("pattern", { id: "fs-bp-grid-major", width: "200", height: "200", patternUnits: "userSpaceOnUse", children: [_jsx("rect", { width: "200", height: "200", fill: "url(#fs-bp-grid-minor)" }), _jsx("path", { d: "M 200 0 L 0 0 0 200", fill: "none", stroke: "rgba(160, 190, 255, 0.22)", strokeWidth: "1", vectorEffect: "non-scaling-stroke" })] })] }), _jsx("rect", { x: "0", y: "0", width: sheetWidth, height: docHeight, className: "fs-bp__paper" }), _jsx("rect", { x: "0", y: "0", width: sheetWidth, height: docHeight, fill: "url(#fs-bp-grid-major)" }), _jsx("rect", { x: "1", y: "1", width: docWidth - 2, height: docHeight - 2, className: "fs-bp__frame", vectorEffect: "non-scaling-stroke", pathLength: 100 }), nodes.map((node, index) => (_jsx("rect", { x: node.x, y: node.y, width: node.w, height: node.h, className: `fs-bp__el fs-bp__el--${node.category}`, style: { animationDelay: `${Math.min(index * 14, 2100)}ms`, color: CATEGORY_COLOR[node.category], pointerEvents: full ? 'auto' : 'none' }, vectorEffect: "non-scaling-stroke", pathLength: 100, onClick: full ? () => onJumpToElement?.(node.el) : undefined, children: full && _jsx("title", { children: `${node.label} — ${Math.round(node.w)} × ${Math.round(node.h)}` }) }, index))), labelled.map((node, index) => (_jsxs("text", { x: node.x + 6, y: node.y + 14, className: "fs-bp__tag", style: { animationDelay: `${1200 + Math.min(index * 30, 900)}ms` }, children: [node.label, " \u00B7 ", Math.round(node.w), "\u00D7", Math.round(node.h)] }, `label-${index}`))), full && callouts.map((callout, index) => {
                const anchorX = callout.node.x + callout.node.w;
                const anchorY = callout.node.y + Math.min(callout.node.h / 2, 120);
                const gutterX = docWidth + gutter * 0.22;
                const textY = anchorY;
                return (_jsxs("g", { className: "fs-bp__callout", style: { animationDelay: `${1500 + index * 160}ms` }, children: [_jsx("circle", { cx: anchorX, cy: anchorY, r: "5", fill: "none", stroke: CATEGORY_COLOR[callout.node.category], strokeWidth: "1.5", vectorEffect: "non-scaling-stroke" }), _jsx("line", { x1: anchorX + 5, y1: anchorY, x2: gutterX, y2: textY, stroke: CATEGORY_COLOR[callout.node.category], strokeWidth: "1", strokeDasharray: "6 4", vectorEffect: "non-scaling-stroke" }), _jsx("text", { x: gutterX + 10, y: textY - 6, className: "fs-bp__callout-title", fill: CATEGORY_COLOR[callout.node.category], children: callout.title }), _jsxs("text", { x: gutterX + 10, y: textY + 12, className: "fs-bp__callout-sub", children: [callout.node.label, " \u00B7 ", Math.round(callout.node.w), "\u00D7", Math.round(callout.node.h)] })] }, `callout-${index}`));
            })] }));
}
function hexToRgba(hex, alpha) {
    const n = parseInt(hex.slice(1), 16);
    return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}
/**
 * The 3D sheet: the same live-scanned wireframe, but every element becomes a
 * plane lifted off the paper by its DOM nesting depth — an exploded x-ray of
 * the page's structure. Drag orbits, wheel zooms, double-tap resets, and
 * tapping a plane jumps to that element in the editor (same as 2D).
 */
function BlueprintStage3D({ data, onJumpToElement, }) {
    const { nodes, docWidth, docHeight, reduceMotion } = data;
    const wrapRef = useRef(null);
    const fitRef = useRef(0.1);
    const dragRef = useRef(null);
    const movedRef = useRef(0);
    const [orbit, setOrbit] = useState(null);
    // Fit the whole sheet into view once we know the stage size, then orbit from there.
    useEffect(() => {
        const el = wrapRef.current;
        if (!el)
            return;
        const fit = Math.max(Math.min((el.clientWidth * 0.62) / docWidth, (el.clientHeight * 1.05) / docHeight), 0.03);
        fitRef.current = fit;
        setOrbit({ rotX: 57, rotZ: 0, zoom: fit });
    }, [docWidth, docHeight]);
    // Wheel zoom needs a non-passive listener to swallow the scroll.
    useEffect(() => {
        const el = wrapRef.current;
        if (!el)
            return;
        const onWheel = (event) => {
            event.preventDefault();
            setOrbit((v) => {
                if (!v)
                    return v;
                const zoom = Math.min(Math.max(v.zoom * Math.exp(-event.deltaY * 0.0012), fitRef.current * 0.35), fitRef.current * 8);
                return { ...v, zoom };
            });
        };
        el.addEventListener('wheel', onWheel, { passive: false });
        return () => el.removeEventListener('wheel', onWheel);
    }, []);
    if (!orbit)
        return _jsx("div", { ref: wrapRef, className: "fs-bp__stage-wrap", "data-chef-editor-root": "true" });
    const liftPer = 30 / orbit.zoom; // constant on-screen lift per nesting level
    return (_jsx("div", { ref: wrapRef, className: "fs-bp__stage-wrap", "data-chef-editor-root": "true", onPointerDown: (e) => {
            if (e.button !== 0)
                return;
            dragRef.current = { x: e.clientX, y: e.clientY };
            movedRef.current = 0;
            try {
                e.currentTarget.setPointerCapture(e.pointerId);
            }
            catch { /* synthetic pointer */ }
        }, onPointerMove: (e) => {
            const from = dragRef.current;
            if (!from)
                return;
            const dx = e.clientX - from.x;
            const dy = e.clientY - from.y;
            dragRef.current = { x: e.clientX, y: e.clientY };
            movedRef.current += Math.abs(dx) + Math.abs(dy);
            setOrbit((v) => v && ({
                ...v,
                rotZ: v.rotZ + dx * 0.35,
                rotX: Math.min(Math.max(v.rotX - dy * 0.35, 8), 88),
            }));
        }, onPointerUp: (e) => {
            dragRef.current = null;
            try {
                e.currentTarget.releasePointerCapture(e.pointerId);
            }
            catch { /* synthetic pointer */ }
        }, onPointerCancel: () => { dragRef.current = null; }, onDoubleClick: () => setOrbit({ rotX: 57, rotZ: 0, zoom: fitRef.current }), children: _jsxs("div", { className: "fs-bp__stage", style: {
                width: docWidth,
                height: docHeight,
                transform: `translate(-50%, -50%) scale(${orbit.zoom}) rotateX(${orbit.rotX}deg) rotateZ(${orbit.rotZ}deg)`,
            }, children: [_jsx("div", { className: "fs-bp__floor" }), nodes.map((node, index) => (_jsx("div", { className: `fs-bp__plane ${reduceMotion ? '' : 'fs-bp__plane--rise'}`, style: {
                        left: node.x,
                        top: node.y,
                        width: node.w,
                        height: node.h,
                        transform: `translateZ(${node.depth * liftPer}px)`,
                        borderColor: hexToRgba(CATEGORY_COLOR[node.category], node.category === 'container' ? 0.5 : 0.9),
                        background: hexToRgba(CATEGORY_COLOR[node.category], node.category === 'container' ? 0.03 : 0.07),
                        animationDelay: reduceMotion ? undefined : `${Math.min(node.depth * 90, 1400)}ms`,
                    }, title: `${node.label} — ${Math.round(node.w)} × ${Math.round(node.h)} · L${node.depth}`, onClick: () => {
                        // a drag that ends on a plane shouldn't count as a tap
                        if (movedRef.current < 8)
                            onJumpToElement?.(node.el);
                    } }, index)))] }) }));
}
export default function FroamBlueprint({ open, onClose, routeKey, getRootEl, onJumpToElement }) {
    const scrollRef = useRef(null);
    const [threeD, setThreeD] = useState(false);
    const data = useMemo(() => (open ? computeBlueprintData(getRootEl()) : null), [open, getRootEl]);
    // Escape closes; lock page scroll behind the sheet
    useEffect(() => {
        if (!open)
            return;
        const onKey = (event) => { if (event.key === 'Escape')
            onClose(); };
        window.addEventListener('keydown', onKey, true);
        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        scrollRef.current?.scrollTo({ top: 0 });
        return () => {
            window.removeEventListener('keydown', onKey, true);
            document.body.style.overflow = previousOverflow;
        };
    }, [open, onClose]);
    if (!open || !data)
        return null;
    const { counts, palette, fonts, docWidth, docHeight, title, stamp, reduceMotion, maxDepth } = data;
    return (_jsxs("div", { className: `fs-bp ${reduceMotion ? 'fs-bp--static' : ''}`, "data-chef-editor-root": "true", role: "dialog", "aria-label": "Page blueprint", children: [threeD ? (_jsx(BlueprintStage3D, { data: data, onJumpToElement: onJumpToElement })) : (_jsx("div", { ref: scrollRef, className: "fs-bp__scroll", "data-chef-editor-root": "true", children: _jsx(BlueprintSheet, { data: data, mode: "full", onJumpToElement: onJumpToElement }) })), _jsxs("div", { className: "fs-bp__spec", "data-chef-editor-root": "true", children: [_jsx("p", { className: "fs-bp__spec-title", children: "SPECIFICATIONS" }), _jsx("div", { className: "fs-bp__swatches", children: palette.map((hex) => (_jsx("span", { className: "fs-bp__swatch", style: { background: hex }, title: hex }, hex))) }), _jsx("p", { className: "fs-bp__spec-line", children: fonts.join(' · ') || 'System type' }), _jsxs("p", { className: "fs-bp__spec-line", children: [Math.round(docWidth), " \u00D7 ", Math.round(docHeight), "px sheet"] }), threeD && _jsxs("p", { className: "fs-bp__spec-line", children: [maxDepth + 1, " depth levels"] })] }), _jsxs("div", { className: "fs-bp__titleblock", "data-chef-editor-root": "true", children: [_jsx("p", { className: "fs-bp__brand", children: "FROAM BLUEPRINT" }), _jsx("p", { className: "fs-bp__site", children: title }), _jsxs("p", { className: "fs-bp__meta", children: [routeKey, " \u00B7 ", stamp] }), _jsx("div", { className: "fs-bp__counts", children: Object.keys(counts).filter((c) => counts[c] > 0).map((c) => (_jsxs("span", { className: "fs-bp__count", children: [_jsx("i", { style: { background: CATEGORY_COLOR[c] } }), counts[c], " ", CATEGORY_LABEL[c]] }, c))) }), _jsx("p", { className: "fs-bp__hint", children: threeD ? 'Drag to orbit · Scroll to zoom · Tap a part to edit' : 'Tap any part to edit it' })] }), _jsxs("button", { type: "button", className: `fs-bp__mode ${threeD ? 'fs-bp__mode--3d' : ''}`, onClick: () => setThreeD((v) => !v), "aria-label": threeD ? 'Switch to 2D blueprint' : 'Switch to 3D blueprint', "data-chef-editor-root": "true", children: [threeD ? _jsx(PenLine, { size: 14 }) : _jsx(Box, { size: 14 }), threeD ? '2D' : '3D'] }), _jsx("button", { type: "button", className: "fs-bp__close", onClick: onClose, "aria-label": "Close blueprint", "data-chef-editor-root": "true", children: _jsx(X, { size: 16 }) })] }));
}
//# sourceMappingURL=FroamBlueprint.js.map