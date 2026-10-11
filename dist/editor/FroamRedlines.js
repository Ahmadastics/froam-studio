import { jsx as _jsx, Fragment as _Fragment, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useRef, useState } from 'react';
const toRect = (r) => ({ left: r.left, top: r.top, right: r.right, bottom: r.bottom, width: r.width, height: r.height });
/** Screen pixels per CSS pixel for this element (1 unless a device preview scales the page). */
function scaleOf(el) {
    const r = el.getBoundingClientRect();
    // offsetWidth is rounded to a whole pixel: only a real zoom (a device preview) counts.
    const s = el.offsetWidth ? r.width / el.offsetWidth : 1;
    return Math.abs(s - 1) < 0.03 ? 1 : s;
}
/** Lines between two boxes, the way design tools draw them. */
export function measureBetween(a, b) {
    const lines = [];
    const contains = (o, i) => o.left <= i.left + 0.5 && o.top <= i.top + 0.5 && o.right >= i.right - 0.5 && o.bottom >= i.bottom - 0.5;
    if (contains(b, a) || contains(a, b)) {
        const [outer, inner] = contains(b, a) ? [b, a] : [a, b];
        const cy = inner.top + inner.height / 2;
        const cx = inner.left + inner.width / 2;
        lines.push({ x1: cx, y1: outer.top, x2: cx, y2: inner.top, value: inner.top - outer.top });
        lines.push({ x1: cx, y1: inner.bottom, x2: cx, y2: outer.bottom, value: outer.bottom - inner.bottom });
        lines.push({ x1: outer.left, y1: cy, x2: inner.left, y2: cy, value: inner.left - outer.left });
        lines.push({ x1: inner.right, y1: cy, x2: outer.right, y2: cy, value: outer.right - inner.right });
        return lines.filter((line) => line.value > 0.5);
    }
    // Horizontal gap.
    const overlapTop = Math.max(a.top, b.top);
    const overlapBottom = Math.min(a.bottom, b.bottom);
    const midY = overlapBottom > overlapTop ? (overlapTop + overlapBottom) / 2 : a.top + a.height / 2;
    if (b.left >= a.right)
        lines.push({ x1: a.right, y1: midY, x2: b.left, y2: midY, value: b.left - a.right });
    else if (a.left >= b.right)
        lines.push({ x1: b.right, y1: midY, x2: a.left, y2: midY, value: a.left - b.right });
    // Vertical gap.
    const overlapLeft = Math.max(a.left, b.left);
    const overlapRight = Math.min(a.right, b.right);
    const midX = overlapRight > overlapLeft ? (overlapLeft + overlapRight) / 2 : a.left + a.width / 2;
    if (b.top >= a.bottom)
        lines.push({ x1: midX, y1: a.bottom, x2: midX, y2: b.top, value: b.top - a.bottom });
    else if (a.top >= b.bottom)
        lines.push({ x1: midX, y1: b.bottom, x2: midX, y2: a.top, value: a.top - b.bottom });
    return lines;
}
export default function FroamRedlines({ selection, root, enabled }) {
    const [altDown, setAltDown] = useState(false);
    const [other, setOther] = useState(null);
    const [, setTick] = useState(0);
    const pointer = useRef({ x: -1, y: -1 });
    const usedAlt = useRef(false);
    useEffect(() => {
        if (!enabled) {
            setAltDown(false);
            return;
        }
        const isAltOnly = (e) => e.key === 'Alt' && !e.ctrlKey && !e.metaKey && !e.shiftKey;
        const onDown = (e) => {
            if (!isAltOnly(e))
                return;
            const field = e.target?.closest?.('input, textarea, select, [contenteditable="true"]');
            if (field)
                return;
            setAltDown(true);
        };
        const onUp = (e) => {
            if (e.key !== 'Alt')
                return;
            // Alt alone would otherwise focus the browser's menu on Windows.
            if (usedAlt.current)
                e.preventDefault();
            usedAlt.current = false;
            setAltDown(false);
        };
        const clear = () => setAltDown(false);
        window.addEventListener('keydown', onDown, true);
        window.addEventListener('keyup', onUp, true);
        window.addEventListener('blur', clear);
        return () => {
            window.removeEventListener('keydown', onDown, true);
            window.removeEventListener('keyup', onUp, true);
            window.removeEventListener('blur', clear);
        };
    }, [enabled]);
    // Track what's under the pointer while Alt is held.
    useEffect(() => {
        const pick = () => {
            const page = root();
            if (!page || pointer.current.x < 0) {
                setOther(null);
                return;
            }
            const hits = document.elementsFromPoint(pointer.current.x, pointer.current.y);
            const hit = hits.find((el) => el instanceof HTMLElement && !el.closest('[data-chef-editor-root="true"], #froam-editor-portal') && page.contains(el));
            setOther(hit && hit !== selection ? hit : null);
        };
        const onMove = (e) => {
            pointer.current = { x: e.clientX, y: e.clientY };
            if (altDown)
                pick();
        };
        window.addEventListener('pointermove', onMove, { passive: true });
        if (altDown)
            pick();
        return () => window.removeEventListener('pointermove', onMove);
    }, [altDown, root, selection]);
    // Keep lines glued to the page while it scrolls.
    useEffect(() => {
        if (!altDown)
            return;
        const bump = () => setTick((t) => t + 1);
        window.addEventListener('scroll', bump, true);
        return () => window.removeEventListener('scroll', bump, true);
    }, [altDown]);
    // While measuring, Froam's own floating chrome steps back so it never hides a line.
    useEffect(() => {
        const on = enabled && altDown && !!selection;
        if (on)
            document.documentElement.setAttribute('data-froam-measuring', 'true');
        else
            document.documentElement.removeAttribute('data-froam-measuring');
        return () => document.documentElement.removeAttribute('data-froam-measuring');
    }, [enabled, altDown, selection]);
    // Measuring used Alt: its release shouldn't then open the browser's menu.
    useEffect(() => { if (enabled && altDown && selection)
        usedAlt.current = true; }, [enabled, altDown, selection]);
    if (!enabled || !altDown || !selection || !selection.isConnected)
        return null;
    const a = toRect(selection.getBoundingClientRect());
    const scale = scaleOf(selection) || 1;
    let b = null;
    let against = 'element';
    if (other && other.isConnected)
        b = toRect(other.getBoundingClientRect());
    else {
        const parent = selection.parentElement;
        if (parent && parent !== document.body && parent !== document.documentElement) {
            const cs = getComputedStyle(parent);
            const r = parent.getBoundingClientRect();
            const s = scaleOf(parent) || 1;
            const inset = (v) => (parseFloat(v) || 0) * s;
            b = {
                left: r.left + inset(cs.borderLeftWidth) + inset(cs.paddingLeft),
                top: r.top + inset(cs.borderTopWidth) + inset(cs.paddingTop),
                right: r.right - inset(cs.borderRightWidth) - inset(cs.paddingRight),
                bottom: r.bottom - inset(cs.borderBottomWidth) - inset(cs.paddingBottom),
                width: 0, height: 0,
            };
            b.width = b.right - b.left;
            b.height = b.bottom - b.top;
            against = 'parent';
        }
    }
    if (!b)
        return null;
    const lines = measureBetween(a, b);
    return (_jsxs("div", { className: "froam-redlines", "data-chef-editor-root": "true", "aria-hidden": "true", children: [_jsx("div", { className: "froam-redlines__box is-selection", style: { left: a.left, top: a.top, width: a.width, height: a.height } }), _jsx("div", { className: `froam-redlines__box ${against === 'parent' ? 'is-parent' : 'is-other'}`, style: { left: b.left, top: b.top, width: b.width, height: b.height } }), _jsx("svg", { className: "froam-redlines__svg", width: "100%", height: "100%", children: lines.map((line, i) => (_jsxs("g", { children: [_jsx("line", { x1: line.x1, y1: line.y1, x2: line.x2, y2: line.y2 }), line.y1 === line.y2 ? (_jsxs(_Fragment, { children: [_jsx("line", { x1: line.x1, y1: line.y1 - 4, x2: line.x1, y2: line.y1 + 4 }), _jsx("line", { x1: line.x2, y1: line.y2 - 4, x2: line.x2, y2: line.y2 + 4 })] })) : (_jsxs(_Fragment, { children: [_jsx("line", { x1: line.x1 - 4, y1: line.y1, x2: line.x1 + 4, y2: line.y1 }), _jsx("line", { x1: line.x2 - 4, y1: line.y2, x2: line.x2 + 4, y2: line.y2 })] }))] }, i))) }), lines.map((line, i) => (_jsx("span", { className: "froam-redlines__label", style: { left: (line.x1 + line.x2) / 2, top: (line.y1 + line.y2) / 2 }, children: Math.round((line.value / scale) * 10) / 10 }, i))), lines.length === 0 && against === 'element' && (_jsx("span", { className: "froam-redlines__label", style: { left: b.left + b.width / 2, top: b.top + b.height / 2 }, children: "Overlapping" }))] }));
}
//# sourceMappingURL=FroamRedlines.js.map